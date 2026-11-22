/* auth.js - Login + Sign up: validation, admin login, warning pop-ups, sliding panel, password recovery */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$;
    var form = $('#login_form') || $('#signup_form');
    var STAFF = [{ name: 'Sweet Havens Admin', pw: 'Admin12345', role: 'admin' }];
    var norm = SH.norm;
    var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
    var NAME_RE = /^[A-Za-zÑñ.'\-\s]+$/;

    /* Capitalize first letter (names / city) */
    function capFirst(s) {
        s = String(s || '');
        if (!s) return s;
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function wireCap(id, mode) {
        var el = $('#' + id); if (!el) return;
        el.addEventListener('input', function () {
            var start = el.selectionStart, end = el.selectionEnd, v = el.value;
            el.value = mode === 'upper' ? v.toUpperCase() : capFirst(v);
            try { el.setSelectionRange(start, end); } catch (e) {}
        });
        el.addEventListener('blur', function () {
            el.value = mode === 'upper' ? el.value.trim().toUpperCase() : capFirst(el.value.trim());
        });
    }

    /* ---------------- FORGOT PASSWORD: security question + one-time e-mail code ---------------- */
var forgot = $('#forgot_form');
    if (forgot) {
        var nameIn = $('#reset_name'), mailIn = $('#reset_email'), ansIn = $('#reset_answer');
        var pwIn = $('#reset_password'), cfIn = $('#reset_confirm'), fmsg = $('#forgot_msg');
        var hint = $('#sec_hint'), secQText = $('#sec_question_text');
        var stepId = $('#step_id'), stepCode = $('#step_code'), stepSec = $('#step_sec'), stepPw = $('#step_pw');
        var codeIn = $('#reset_code'), codeHint = $('#code_hint'), codeTimer = $('#code_timer');
        var sendBtn = $('#send_code'), verifyBtn = $('#verify_code'), verifyAnsBtn = $('#verify_answer'), resendLink = $('#resend_code');
        var account = null, otp = null, tick = null, issued = {}, secOk = false;

        /* EMAILJS KEYS PARA SA SWEETHAVENS */
        var EMAILJS_PUBLIC_KEY = 'LKZ32eIs0NYi2M_12';
        var EMAILJS_SERVICE_ID = 'service_k3y3p5u';
        var EMAILJS_TEMPLATE_ID = 'template_b2ilw9p';

        if (window.emailjs) {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        }

        var say = function (t, bad) { fmsg.textContent = t || ''; fmsg.className = 'form_msg' + (bad ? ' err' : ''); };

        /* j***@gmail.com */
        var maskMail = function (m) {
            var s = String(m || '').trim(), at = s.indexOf('@');
            if (at < 1) return s || 'your Gmail';
            var head = s.slice(0, Math.min(2, at)), star = '';
            for (var i = 0; i < Math.min(6, Math.max(1, at - 2)); i++) star += '*';
            return head + star + s.slice(at);
        };

        var newCode = function () {
            var c;
            do {
                if (window.crypto && crypto.getRandomValues) {
                    var buf = new Uint32Array(1); crypto.getRandomValues(buf); c = String(100000 + (buf[0] % 900000));
                } else c = String(100000 + Math.floor(Math.random() * 900000));
            } while (issued[c]);
            issued[c] = 1;
            return c;
        };

        var stopTick = function () { if (tick) { clearInterval(tick); tick = null; } };

        var resetAllSteps = function () {
            stopTick(); account = null; otp = null; secOk = false;
            stepId.hidden = false; stepCode.hidden = true; stepSec.hidden = true; stepPw.hidden = true;
            codeIn.value = ''; ansIn.value = ''; codeTimer.textContent = ''; codeTimer.className = 'fhint';
            sendBtn.disabled = false; sendBtn.textContent = 'Send Code to Email';
            say('');
        };

        var showTimer = function () {
            stopTick();
            var paint = function () {
                var left = Math.max(0, otp.exp - Date.now());
                if (!left) {
                    codeTimer.textContent = 'This code has expired. Send a new code.';
                    codeTimer.className = 'fhint bad';
                    stopTick(); return;
                }
                var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
                codeTimer.textContent = 'This code works once and expires in ' + m + ':' + (s < 10 ? '0' : '') + s + '.';
                codeTimer.className = 'fhint';
            };
            paint(); tick = setInterval(paint, 1000);
        };

        /* STEP 1: Verify Name + Gmail, then send real email via EmailJS */
        var sendCode = function () {
            say('');
            var n = nameIn.value.trim();
            var m = mailIn.value.trim();
            if (!n) { say('Enter the name on the account.', true); nameIn.focus(); return; }
            if (!m) { say('Enter the Gmail address linked to the account.', true); mailIn.focus(); return; }
            if (norm(n) === norm(STAFF[0].name)) {
                say('This is the shop admin account. Its password can only be changed by the shop owner.', true);
                return;
            }
            var users = S.get('sh_users', []);
            var found = users.filter(function (x) {
                return norm(x.name) === norm(n) && norm(x.email) === norm(m);
            })[0];

            if (!found) {
                say('No saved account matches that Name and Gmail address.', true);
                return;
            }

            account = found;
            secOk = false;
            var generatedOtp = newCode();
            otp = { code: generatedOtp, exp: Date.now() + 5 * 60000, tries: 0, ok: false };

            var goToCodeStep = function (note) {
                codeIn.value = '';
                codeHint.textContent = note;
                stepId.hidden = true; stepCode.hidden = false; stepSec.hidden = true; stepPw.hidden = true;
                sendBtn.disabled = false; sendBtn.textContent = 'Send Code to Email';
                showTimer();
                codeIn.focus();
            };

            if (window.emailjs) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
                emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    to_name: account.name,
                    to_email: account.email,
                    otp_code: generatedOtp
                }).then(function () {
                    goToCodeStep('A 6-digit verification code was sent to ' + maskMail(account.email) + '. Please check your Gmail inbox or Spam folder.');
                }, function (err) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Send Code to Email';
                    say('Failed to send email. Please check your internet connection or EmailJS setup.', true);
                });
            } else {
                say('Email service script failed to load. Please refresh the page.', true);
            }
        };

        /* STEP 2: Verify 6-digit code */
        var verifyCode = function () {
            say('');
            if (!otp) { say('Send a code first.', true); return; }
            if (Date.now() > otp.exp) { stopTick(); otp = null; say('That code has expired. Send a new code.', true); return; }
            var typed = digits(codeIn.value);
            if (typed.length !== 6) { say('Type the 6-digit code sent to your Gmail.', true); codeIn.focus(); return; }
            if (typed !== otp.code) {
                otp.tries++;
                if (otp.tries >= 5) { stopTick(); otp = null; say('Too many wrong codes. Send a new code.', true); }
                else say('That code is not correct. ' + (5 - otp.tries) + ' tries left.', true);
                try { codeIn.select(); } catch (x) {}
                return;
            }
            otp.ok = true;
            stopTick();

            /* STEP 3: Security Question (kung meron), o diretso Step 4 kung legacy account */
            if (account && account.secQ && account.secA) {
                secQText.textContent = account.secQ;
                ansIn.value = '';
                stepCode.hidden = true; stepSec.hidden = false; stepPw.hidden = true;
                say('Code verified. Answer your security question to continue.');
                ansIn.focus();
            } else {
                secOk = true;
                stepCode.hidden = true; stepSec.hidden = true; stepPw.hidden = false;
                say('Code verified. Choose a new password.');
                pwIn.focus();
            }
        };

        /* STEP 3: Verify Security Question Answer */
        var verifyAnswer = function () {
            say('');
            if (!otp || !otp.ok) { say('Verify the email code first.', true); return; }
            if (!ansIn.value.trim()) { say('Type the answer to your security question.', true); ansIn.focus(); return; }
            if (norm(ansIn.value) !== norm(account.secA)) {
                say('That answer does not match. Please try again.', true);
                ansIn.focus();
                return;
            }
            secOk = true;
            stepSec.hidden = true; stepPw.hidden = false;
            say('Security answer verified. Choose a new password.');
            pwIn.focus();
        };

        /* Event Listeners */
        [nameIn, mailIn, ansIn, pwIn, cfIn].forEach(function (el) {
            if (el) el.addEventListener('input', function () { say(''); });
        });
        codeIn.addEventListener('input', function () { codeIn.value = digits(codeIn.value).slice(0, 6); say(''); });
        codeIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verifyCode(); } });
        ansIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verifyAnswer(); } });

        sendBtn.addEventListener('click', sendCode);
        verifyBtn.addEventListener('click', verifyCode);
        verifyAnsBtn.addEventListener('click', verifyAnswer);
        resendLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (!account) { resetAllSteps(); return; }
            sendCode();
        });

        /* STEP 4: Update Password */
        forgot.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!otp || !otp.ok) { say('Verify the email code first.', true); return; }
            if (!secOk) { say('Answer your security question before changing the password.', true); return; }
            if (!SH.pwChecks(pwIn.value).ok) { say('Use 8+ characters with A-Z, a-z, 0-9 and a symbol.', true); pwIn.focus(); return; }
            if (pwIn.value !== cfIn.value) { say('The passwords do not match.', true); cfIn.focus(); return; }

            var users = S.get('sh_users', []);
            var live = users.filter(function (x) { return norm(x.name) === norm(account.name) && norm(x.email) === norm(account.email); })[0];
            if (!live) { say('No saved account matches that name.', true); return; }
            live.pw = pwIn.value;
            S.set('sh_users', users);
            forgot.reset();
            resetAllSteps();
            say('Password updated! You can now sign in with your new password.');
        });
        return;
    }

    if (!form) return;
    var isSignup = form.id === 'signup_form';
    form.noValidate = true;

    /* Remove only non-admin accounts saved before this update, once. Future sign-ups stay saved. */
    if (!S.get('sh_accounts_cleanup_v1', false)) {
        var savedUsers = S.get('sh_users', []);
        if (!Array.isArray(savedUsers)) savedUsers = [];
        S.set('sh_users', savedUsers.filter(function (u) { return u && u.role === 'admin'; }));
        var activeUser = S.get('sh_user', null);
        if (activeUser && activeUser.role !== 'admin') S.set('sh_user', null);
        S.set('sh_accounts_cleanup_v1', true);
    }
    var adminOnly = false;

    /* copy fix from the design: the link under the sign up form says Log In */
    var back = form.querySelector('p a[href="login.html"]');
    if (back) back.textContent = 'Log In';

    /* floating-label fields + asterisk on required boxes */
    var FULL = ['address', 'landmark', 'sec_q', 'sec_a'];
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input, select')).filter(function (i) { return i.id !== 'remember_me'; });
    inputs.forEach(function (i) {
        if (!i.id) i.id = i.name + '_in';
        var label = form.querySelector('label[for="' + i.id + '"]') || form.querySelector('label[for="' + i.name + '"]');
        if (label) label.setAttribute('for', i.id);
        var field = document.createElement('div');
        field.className = 'field' + (FULL.indexOf(i.id) > -1 ? ' full' : '');
        var fl = document.createElement('div'); fl.className = 'fl';
        var err = document.createElement('small'); err.className = 'ferr';
        (label || i).before(field);
        if (label) { field.appendChild(label); if (i.required) label.classList.add('req'); }
        fl.appendChild(i);
        if (i.tagName === 'INPUT' && i.type !== 'file') {
            var hintText = i.getAttribute('placeholder') || '';
            i.setAttribute('placeholder', ' ');
            var span = document.createElement('span'); span.textContent = hintText;
            fl.appendChild(span);
            if (i.type === 'password') SH.eyeify(i, fl);   /* show / hide password */
        }
        fl.appendChild(document.createElement('i'));
        field.appendChild(fl);
        if (i.id === 'c_password') {
            var ph = document.createElement('small'); ph.className = 'fhint';
            ph.textContent = 'Use 8+ characters with A-Z, a-z, 0-9 and a symbol.';
            field.appendChild(ph);
        }
        field.appendChild(err);
        i.addEventListener('input', function () { clearBad(i); });
    });
    var msg = document.createElement('p'); msg.className = 'form_msg'; msg.id = 'form_msg';
    form.querySelector('#login_btn').before(msg);

    /* ---- live input rules: letters only, digits only, 09XX XXX XXXX ---- */
    if (isSignup) {
        ['f_name', 'l_name'].forEach(function (id) {
            var el = $('#' + id); if (!el) return;
            el.addEventListener('input', function () {
                var before = el.value, pos = el.selectionStart;
                var clean = before.replace(/[^A-Za-zÑñ.'\-\s]/g, '');
                if (clean !== before) {
                    var keep = before.slice(0, pos).replace(/[^A-Za-zÑñ.'\-\s]/g, '').length;
                    el.value = clean;
                    try { el.setSelectionRange(keep, keep); } catch (e) {}
                }
                clearBad(el);
            });
        });
        wireCap('f_name', 'first');
        wireCap('l_name', 'first');
        /* city and barangay are selects: choosing a value only clears the error */
        ['city', 'brgy'].forEach(function (id) {
            var el = $('#' + id); if (!el) return;
            el.addEventListener('change', function () { clearBad(el); });
        });
        var zip = $('#zip');
        if (zip) zip.addEventListener('input', function () { zip.value = digits(zip.value).slice(0, 4); clearBad(zip); });
        var contact = $('#contact');
        if (contact) contact.addEventListener('input', function () {
            var d = digits(contact.value).slice(0, 11);
            contact.value = d.length > 7 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7)
                : d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
            clearBad(contact);
        });
    }

    function bad(i, m) { var f = i.closest('.field'); f.querySelector('.fl').classList.add('invalid'); f.querySelector('.ferr').textContent = m || ''; }
    function clearBad(i) { var f = i.closest('.field'); if (!f) return; f.querySelector('.fl').classList.remove('invalid'); f.querySelector('.ferr').textContent = ''; if (msg) msg.textContent = ''; }
    function jump(i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }
    var val = function (id) { var el = $('#' + id); return el ? String(el.value).trim() : ''; };

    function validate() {
        inputs.forEach(clearBad);
        inputs.forEach(function (i) { if (i.required && !String(i.value).trim()) bad(i, 'Please fill in this box.'); });
        if (isSignup) {
            var has = function (id) { return val(id) !== ''; };
            ['f_name', 'l_name'].forEach(function (id) {
                if (has(id) && !NAME_RE.test(val(id))) bad($('#' + id), 'Letters only. Numbers and symbols are not allowed.');
            });
            if (has('c_password') && !SH.pwChecks($('#c_password').value).ok) bad($('#c_password'), 'Use 8+ characters with A-Z, a-z, 0-9 and a symbol.');
            if (has('confirm_password') && $('#confirm_password').value !== $('#c_password').value) bad($('#confirm_password'), 'Passwords do not match.');
            if (has('age') && !(+val('age') >= 1 && +val('age') <= 120)) bad($('#age'), 'Enter an age from 1 to 120.');
            if (has('email') && !/^[^\s@]+@gmail\.com$/i.test(val('email'))) bad($('#email'), 'Must have "@" and end with gmail.com');
            if (has('contact') && !/^09\d{9}$/.test(digits(val('contact')))) bad($('#contact'), 'Use 09XX XXX XXXX, it must start with 09.');
            if (has('zip') && !/^\d{4}$/.test(val('zip'))) bad($('#zip'), 'ZIP code must be 4 digits.');
            if (has('sec_a') && val('sec_a').length < 2) bad($('#sec_a'), 'Type an answer you will remember.');
        }
        return inputs.filter(function (i) { return i.closest('.field').querySelector('.fl').classList.contains('invalid'); })[0] || null;
    }

    function submit(e) {
        e.preventDefault();
        var first = validate();
        if (first) { jump(first); return; }
        if (isSignup) {
            var fn = capFirst(val('f_name')), ln = capFirst(val('l_name'));
            var users = S.get('sh_users', []), name = fn + ' ' + ln;
            $('#f_name').value = fn; $('#l_name').value = ln;
            if (users.some(function (u) { return norm(u.name) === norm(name); }) || STAFF.some(function (s) { return norm(s.name) === norm(name); })) {
                bad($('#f_name'), 'This account already exists. Please log in.'); jump($('#f_name')); return;
            }
            users.push({ name: name, pw: val('c_password'), age: val('age'), sex: val('sex'), email: val('email').toLowerCase(), contact: val('contact'),
                address: val('address'), region: val('region'), city: val('city'), brgy: val('brgy'), zip: val('zip'), landmark: val('landmark'),
                secQ: val('sec_q'), secA: norm(val('sec_a')) });
            S.set('sh_users', users);
            try { sessionStorage.setItem('sh_flash', 'Account created! Please log in.'); } catch (x) {}
            go('login.html', 'login');
        } else {
            var n = val('f_name'), p = $('#password').value;
            var u = STAFF.filter(function (s) {
                var savedPassword = s.role === 'admin' ? S.get('sh_admin_password', s.pw) : s.pw;
                return norm(s.name) === norm(n) && savedPassword === p;
            })[0] ||
                S.get('sh_users', []).filter(function (x) { return norm(x.name) === norm(n) && x.pw === p; })[0];
            var wantAdmin = adminOnly; adminOnly = false;
            if (wantAdmin) {
                if (!(u && u.role === 'admin')) { SH.warningCard('admin'); return; }
            } else if (!u || u.role === 'admin') {
                /* an admin must use Login as Admin, and an unknown name/password is never accepted */
                SH.warningCard('user');
                return;
            }
            S.set('sh_user', { name: u.name, role: u.role || 'customer' });
            var back = '';
            try { back = sessionStorage.getItem('sh_return') || ''; sessionStorage.removeItem('sh_return'); } catch (x) {}
            location.href = u.role === 'admin' ? 'dashboard.html' : (back || 'home_page.html');
        }
    }
    /* the Login / Sign Up button has a temporary link inside it, so we take over the click */
    form.querySelector('#login_btn').addEventListener('click', submit, true);
    var ab = $('#admin_btn');
    if (ab) ab.addEventListener('click', function (e) { adminOnly = true; submit(e); }, true);

    /* sliding panel between Login and Create Account */
    var TEXT = { signup: 'Create your account to start ordering your favorite treats.', login: 'Welcome back! Enter your details to continue.' };
    var cur = document.createElement('div'); cur.className = 'curtain'; cur.innerHTML = '<p></p>'; document.body.appendChild(cur);
    var EASE = 'cubic-bezier(.4,0,.6,1)';
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(url, to) {
        if (still || !cur.animate) { location.href = url; return; }
        var r = to === 'signup';
        cur.querySelector('p').textContent = TEXT[to]; cur.className = 'curtain' + (r ? '' : ' toL'); cur.style.display = 'flex';
        try { sessionStorage.setItem('sh_cur', to); } catch (x) {}
        cur.animate([{ transform: 'translateX(' + (r ? 100 : -100) + '%)' }, { transform: 'translateX(0)' }], { duration: 1050, easing: EASE, fill: 'forwards' })
            .onfinish = function () { location.href = url; };
    }
    Array.prototype.forEach.call(document.querySelectorAll('a[href="login.html"], a[href="signup.html"]'), function (a) {
        a.addEventListener('click', function (e) {
            if (a.closest('#login_btn')) return;
            e.preventDefault();
            var h = a.getAttribute('href'); go(h, h === 'signup.html' ? 'signup' : 'login');
        });
    });
})();
