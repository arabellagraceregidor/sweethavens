/* auth.js - Login + Sign up: required stars, red highlight, scroll to the empty box, admin login, sliding panel */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$;
    var resetForm = $('#reset_form');
    var form = $('#login_form') || $('#signup_form');
    var STAFF = [{ name: 'Sweet Havens Admin', pw: 'Admin12345', role: 'admin' }];
    var norm = SH.norm;

    /* Password recovery for saved accounts and the built-in admin demo account. */
    if (resetForm) {
        resetForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = $('#recovery_name').value.trim();
            var email = $('#recovery_email').value.trim().toLowerCase();
            var code = $('#admin_recovery_code').value.trim();
            var password = $('#new_password').value;
            var confirmPassword = $('#confirm_password').value;
            var message = $('#reset_message');
            message.textContent = ''; message.className = 'form_msg';
            if (!name) { message.textContent = 'Enter the name on the account.'; $('#recovery_name').focus(); return; }
            if (password.length < 6) { message.textContent = 'Use at least 6 characters for the new password.'; $('#new_password').focus(); return; }
            if (password !== confirmPassword) { message.textContent = 'The passwords do not match.'; $('#confirm_password').focus(); return; }
            if (norm(name) === norm(STAFF[0].name)) {
                if (code !== 'SH-SWEETHAVENS-RESET-2026') { message.textContent = 'Enter the admin recovery code shown on this page.'; $('#admin_recovery_code').focus(); return; }
                S.set('sh_admin_password', password);
            } else {
                if (!email) { message.textContent = 'Enter the Gmail address used when the account was created.'; $('#recovery_email').focus(); return; }
                var users = S.get('sh_users', []);
                var found = users.filter(function (u) { return norm(u.name) === norm(name) && String(u.email || '').trim().toLowerCase() === email; })[0];
                if (!found) { message.textContent = 'No saved account matches that name and Gmail address.'; $('#recovery_email').focus(); return; }
                found.pw = password; S.set('sh_users', users);
            }
            message.textContent = 'Password updated. Return to the login page to sign in.';
            message.classList.add('success'); resetForm.reset();
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
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input'));
    inputs.forEach(function (i) {
        if (!i.id) i.id = i.name + '_in';
        var label = form.querySelector('label[for="' + i.id + '"]') || form.querySelector('label[for="' + i.name + '"]');
        if (label) label.setAttribute('for', i.id);
        var field = document.createElement('div');
        field.className = 'field' + (i.id === 'address' || i.id === 'landmark' ? ' full' : '');
        var fl = document.createElement('div'); fl.className = 'fl';
        var hint = i.getAttribute('placeholder') || ''; i.setAttribute('placeholder', ' ');
        var span = document.createElement('span'); span.textContent = hint;
        var err = document.createElement('small'); err.className = 'ferr';
        (label || i).before(field);
        if (label) { field.appendChild(label); if (i.required) label.classList.add('req'); }
        fl.appendChild(i); fl.appendChild(span); fl.appendChild(document.createElement('i'));
        if (i.type === 'password') SH.eyeify(i, fl);   /* show / hide password */
        field.appendChild(fl); field.appendChild(err);
        i.addEventListener('input', function () { clearBad(i); });
    });
    var msg = document.createElement('p'); msg.className = 'form_msg'; msg.id = 'form_msg';
    form.querySelector('#login_btn').before(msg);
    var contact = $('#contact');
    if (contact) contact.addEventListener('input', function () { contact.value = contact.value.replace(/\D/g, ''); });

    /* Capitalize first letter (names / city); ALL CAPS for region */
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
            clearBad(el);
        });
        el.addEventListener('blur', function () {
            el.value = mode === 'upper' ? el.value.trim().toUpperCase() : capFirst(el.value.trim());
        });
    }
    if (isSignup) {
        wireCap('f_name', 'first');
        wireCap('l_name', 'first');
        wireCap('city', 'first');
        wireCap('region', 'upper');
    }

    function bad(i, m) { var f = i.closest('.field'); f.querySelector('.fl').classList.add('invalid'); f.querySelector('.ferr').textContent = m || ''; }
    function clearBad(i) { var f = i.closest('.field'); f.querySelector('.fl').classList.remove('invalid'); f.querySelector('.ferr').textContent = ''; msg.textContent = ''; }
    function jump(i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }
    var val = function (id) { return $('#' + id).value.trim(); };

    function validate() {
        inputs.forEach(clearBad);
        inputs.forEach(function (i) { if (i.required && !i.value.trim()) bad(i, 'Please fill in this box.'); });
        if (isSignup) {
            var has = function (id) { return val(id) !== ''; };
            if (has('c_password') && val('c_password').length < 6) bad($('#c_password'), 'At least 6 characters.');
            if (has('confirm_password') && val('confirm_password') !== val('c_password')) bad($('#confirm_password'), 'Passwords do not match.');
            if (has('age') && !(+val('age') >= 1 && +val('age') <= 120)) bad($('#age'), 'Enter a valid age.');
            if (has('email') && !/^[^\s@]+@gmail\.com$/i.test(val('email'))) bad($('#email'), 'Must have "@" and end with gmail.com');
            if (has('contact') && !/^\d{11}$/.test(val('contact'))) bad($('#contact'), 'Numbers only, 11 digits.');
            if (has('zip') && !/^\d{4}$/.test(val('zip'))) bad($('#zip'), 'ZIP code must be 4 digits.');
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
            $('#region').value = val('region').toUpperCase(); $('#city').value = capFirst(val('city'));
            if (users.some(function (u) { return norm(u.name) === norm(name); }) || STAFF.some(function (s) { return norm(s.name) === norm(name); })) {
                bad($('#f_name'), 'This account already exists. Please log in.'); jump($('#f_name')); return;
            }
            users.push({ name: name, pw: val('c_password'), age: val('age'), sex: val('sex_in'), email: val('email').toLowerCase(), contact: val('contact'),
                address: val('address'), region: val('region'), city: val('city'), brgy: val('brgy'), zip: val('zip'), landmark: val('landmark') });
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
            if (wantAdmin && !(u && u.role === 'admin')) { bad($('#f_name')); bad($('#password')); msg.textContent = 'ADMIN ONLY!'; jump($('#f_name')); return; }
            if (!u) { bad($('#f_name')); bad($('#password')); msg.textContent = 'LOG IN FIRST FIRST!'; jump($('#f_name')); return; }
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