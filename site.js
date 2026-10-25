/* site.js - shared by every page: light/dark button, add-to-cart on the home page, header links, helpers */
(function () {
    var S = {
        get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
        set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
    /* Remove the accounts that existed before this update only once; later sign-ups stay available. */
    if (!S.get('sh_existing_nonadmin_removed_v1', false)) {
        S.set('sh_users', S.get('sh_users', []).filter(function (x) { return x && String(x.role || '').toLowerCase() === 'admin'; }));
        var savedSession = S.get('sh_user', null);
        if (savedSession && String(savedSession.role || '').toLowerCase() !== 'admin') S.set('sh_user', null);
        S.set('sh_existing_nonadmin_removed_v1', true);
    }
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var norm = function (s) { return String(s).trim().replace(/\s+/g, ' ').toLowerCase(); };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return '\u20B1 ' + Number(n).toFixed(2); };

    /* products, prices and starting stock (prices come from the design PDF) */
    var CATALOG = [
        { n: 'Matcha Melties', p: 40, s: 30, img: 'assets/MATCHA.png' }, { n: 'Biscoff Choco Crunch', p: 55, s: 30, img: 'assets/BISCOFF.png' },
        { n: 'Oatie Choco Paws', p: 35, s: 30, img: 'assets/OATMEAL.png' }, { n: 'Choco Crinkles', p: 30, s: 30, img: 'assets/CRINKLES.png' },
        { n: 'Chocolate Chip', p: 35, s: 40, img: 'assets/CHOCOLATECHIP.png' }, { n: 'Red Velvet Cloud Bites', p: 40, s: 40, img: 'assets/REDVELVET.png' }
    ];
    var BASE = CATALOG.slice();
    var customList = function () { return S.get('sh_products', []); };
    var edits = function () { return S.get('sh_edits', {}); };
    /* products = the 6 from the design + any product the admin added (name, price, stock, photo) */
    var catalog = function () {
        var ed = edits();
        var base = BASE.filter(function (c) { return !(ed[c.n] && ed[c.n].deleted); }).map(function (c) {
            var e = ed[c.n] || {};
            return { n: c.n, p: e.p != null ? e.p : c.p, s: c.s, img: e.img || c.img, d: e.d, base: true };
        });
        return base.concat(customList().map(function (p) { return { n: p.n, p: p.p, s: p.s, custom: true, id: p.id, img: p.img, d: p.d, t: p.t }; }));
    };
    var find = function (n) { return catalog().filter(function (c) { return norm(c.n) === norm(n); })[0]; };
    var TAG_PREFIX = { 'matcha melties': 'MM', 'biscoff choco crunch': 'BCC', 'oatie choco paws': 'OCP', 'choco crinkles': 'CR', 'chocolate chip': 'CC', 'red velvet cloud bites': 'RVCB' };
    function tagPrefix(name) {
        var key = norm(name); if (TAG_PREFIX[key]) return TAG_PREFIX[key];
        var initials = String(name).trim().split(/\s+/).map(function (part) { return part.charAt(0); }).join('').toUpperCase();
        return initials || 'PR';
    }
    function ensureOrderTags() {
        var orders = S.get('sh_orders', []);
        if (S.get('sh_product_order_tags_v1', false)) return orders;
        var counts = {}, sequence = orders.filter(function (o) { return !o.sample; }).sort(function (a, b) { return new Date(a.date || 0) - new Date(b.date || 0); });
        sequence.forEach(function (o) {
            var seen = {};
            (o.items || []).forEach(function (item) {
                var key = norm(item.name);
                if (seen[key]) { if (!item.tag) item.tag = seen[key]; return; }
                counts[key] = (counts[key] || 0) + 1;
                if (!item.tag) item.tag = tagPrefix(item.name) + counts[key];
                seen[key] = item.tag;
            });
        });
        S.set('sh_orders', orders); S.set('sh_product_order_tags_v1', true);
        return orders;
    }
    function nextOrderTag(name) {
        var orders = ensureOrderTags(), key = norm(name), count = 0;
        orders.forEach(function (o) { if (!o.sample && (o.items || []).some(function (item) { return norm(item.name) === key; })) count++; });
        return tagPrefix(name) + (count + 1);
    }
    function orderTagLabel(order) {
        var tags = [];
        (order && order.items || []).forEach(function (item) {
            if (item.tag && tags.indexOf(item.tag) < 0) tags.push(item.tag);
        });
        return tags.length ? tags.join(', ') : String(order && order.id || '');
    }
    ensureOrderTags();
    var user = function () { return S.get('sh_user', null); };
    var cart = function () { return S.get('sh_cart', []); };
    var saveCart = function (c) { S.set('sh_cart', c); };
    function stock() {
        var st = S.get('sh_stock', {});
        catalog().forEach(function (c) { if (st[c.n] == null) st[c.n] = c.s; });
        return st;
    }
    function stockCount(name) { var st = stock(); return Math.max(0, Number(st[name]) || 0); }
    var saveStock = function (st) { S.set('sh_stock', st); };

    function toast(m, link) {
        var t = $('#toast');
        if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
        t.classList.remove('on');
        t.textContent = '';
        var s = document.createElement('span'); s.textContent = m; t.appendChild(s);
        if (link) { var a = document.createElement('a'); a.href = link.href; a.textContent = link.text; t.appendChild(a); }
        t.style.pointerEvents = link ? 'auto' : 'none';
        void t.offsetWidth;                       /* restart the animation so it shows EVERY time */
        t.classList.add('on');
        clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, link ? 3200 : 2000);
    }
    /* same message every time a product goes into the cart */
    function cartToast(name) { toast('\u2713 ' + name + ' has been added to your cart.', { href: 'cart.html', text: 'View Cart' }); }

    /* "LOG IN FIRST FIRST!" pop-up (design slide) for visitors who are not signed in */
    var WARN = '<svg class="am_icon" viewBox="0 0 120 108" aria-hidden="true"><path d="M60 10 L110 96 H10 Z" fill="#E08EAA" stroke="#F4C2D6" stroke-width="10" stroke-linejoin="round"/>' +
        '<rect x="55" y="38" width="10" height="30" rx="5" fill="#fff"/><circle cx="60" cy="80" r="6" fill="#fff"/></svg>';
    function loginModal() {
        var m = $('#auth_modal');
        if (!m) {
            m = document.createElement('div'); m.id = 'auth_modal';
            m.innerHTML = '<div class="auth_card" role="dialog" aria-modal="true" aria-labelledby="am_t"><p class="am_title" id="am_t">LOG IN FIRST FIRST!</p>' + WARN +
                '<a class="am_btn" id="am_login" href="login.html">Log In</a><p class="am_sub">No account yet? <a href="signup.html">Sign Up</a></p></div>';
            document.body.appendChild(m);
            m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('on'); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') m.classList.remove('on'); });
            /* after logging in, bring the person back to the page they were on */
            m.addEventListener('click', function (e) {
                if (e.target.closest && e.target.closest('#am_login')) {
                    try { sessionStorage.setItem('sh_return', location.pathname.split('/').pop() + location.hash); } catch (x) {}
                }
            });
        }
        m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
        var b = $('#am_login'); if (b) b.focus();
    }
    function needLogin() {
        if (user()) return false;
        loginModal();
        return true;
    }

    /* ---- wishlist (saved per customer) ---- */
    var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"/></svg>';
    var wishKey = function () { var w = user(); return w ? 'sh_wish_' + norm(w.name) : null; };
    var wishList = function () { var k = wishKey(); return k ? S.get(k, []) : []; };
    var inWish = function (n) { return wishList().some(function (w) { return norm(w.name) === norm(n); }); };
    function toggleWish(name, img) {
        var k = wishKey(); if (!k) return null;
        var l = wishList(), at = -1;
        l.forEach(function (w, i) { if (norm(w.name) === norm(name)) at = i; });
        if (at > -1) { l.splice(at, 1); S.set(k, l); return false; }
        l.push({ name: name, img: img || '' }); S.set(k, l); return true;
    }

    /* ---- show / hide password (eye) ---- */
    var EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    var EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>';
    function eyeify(input, host) {
        if (input.getAttribute('data-eye')) return;
        input.setAttribute('data-eye', '1');
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'eye_btn'; b.innerHTML = EYE;
        var say = function (show) { b.title = show ? 'Hide password' : 'Show password'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', show ? 'true' : 'false'); };
        say(false);
        (host || input.parentNode).appendChild(b);
        input.classList.add('has_eye');
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function () {
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            b.innerHTML = show ? EYE_OFF : EYE; say(show);
            try { input.focus({ preventScroll: true }); } catch (x) { input.focus(); }
        });
    }
    function logout() { S.set('sh_user', null); S.set('sh_cart', []); location.href = 'login.html'; }

    window.SH = { cartToast: cartToast, loginModal: loginModal, wishList: wishList, inWish: inWish, toggleWish: toggleWish, HEART: HEART, eyeify: eyeify, catalog: catalog, S: S, $: $, $$: $$, norm: norm, esc: esc, fmt: fmt, CATALOG: CATALOG, find: find, user: user, cart: cart,
        saveCart: saveCart, stock: stock, stockCount: stockCount, saveStock: saveStock, toast: toast, needLogin: needLogin, logout: logout, ensureOrderTags: ensureOrderTags, nextOrderTag: nextOrderTag, orderTagLabel: orderTagLabel };

    /* ---- light / dark mode button ---- */
    var theme = 'light';
    try { theme = localStorage.getItem('sh_theme') || 'light'; } catch (e) {}
    var tb = document.createElement('button');
    tb.id = 'theme'; tb.title = 'Light / Dark mode'; tb.setAttribute('aria-label', 'Switch light or dark mode');
    document.body.appendChild(tb);
    function paintTheme() { document.documentElement.setAttribute('data-theme', theme); tb.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'; }
    paintTheme();
    tb.onclick = function () { theme = theme === 'dark' ? 'light' : 'dark'; paintTheme(); try { localStorage.setItem('sh_theme', theme); } catch (e) {} };

    /* ---- header: admin-only links, log out, current page ---- */
    var u = user();
    var currentPage = location.pathname.split('/').pop();
    if (u && u.role === 'admin' && (currentPage === 'my_orders.html' || currentPage === 'account.html')) location.replace('dashboard.html');
    var nav = $('#admin_nav_buttons') || $('#nav_buttons');
    /* Admin viewing the shop menu: keep admin nav (no About Us / Nearest Shop / Cart) */
    if (u && u.role === 'admin' && $('#nav_buttons') && !$('#admin_nav_buttons')) {
        var cust = $('#nav_buttons'), pfp = cust.lastElementChild;
        cust.id = 'admin_nav_buttons';
        cust.innerHTML = '';
        [
            ['dashboard.html', 'Dashboard'],
            ['create_products.html', 'Create'],
            ['inventory.html', 'Inventory'],
            ['schedule_mngmt.html', 'Schedules'],
            ['admin_orders.html', 'Orders'],
            ['home_page.html#weekly', 'Menu']
        ].forEach(function (x) {
            var d = document.createElement('div');
            d.innerHTML = '<a class="nav1" href="' + x[0] + '">' + x[1] + '</a>';
            cust.appendChild(d);
        });
        if (pfp) cust.appendChild(pfp);
        var title = $('#h_title'); if (title) title.setAttribute('href', 'dashboard.html');
        nav = cust;
    }
    if (nav) {
        var last = nav.lastElementChild, add = function (href, text, id) {
            var d = document.createElement('div');
            d.innerHTML = '<a class="nav1"' + (id ? ' id="' + id + '"' : '') + ' href="' + href + '">' + text + '</a>';
            nav.insertBefore(d, last);
        };
        if (u && u.role !== 'admin') {
            add('my_orders.html', 'My Orders');
        }
        if (u) {
            add('#', 'Log Out', 'logout_link');
            $('#logout_link').addEventListener('click', function (e) { e.preventDefault(); logout(); });
            var pic = $('#pfp_btn'); if (pic) pic.title = u.name + (u.role === 'admin' ? ' (Admin)' : '');
            if (pic && pic.parentNode && pic.parentNode.tagName === 'A') {
                pic.parentNode.href = '#profile';
                pic.parentNode.addEventListener('click', function (e) { e.preventDefault(); openProfile(); });
            }
        }
        /* Menu always opens the product menu; admin nav stays when viewing it */
        $$('a.nav1', nav).forEach(function (a) {
            if (!a.getAttribute('href') && a.textContent.trim() === 'Menu') a.setAttribute('href', 'home_page.html#weekly');
        });
        var here = location.pathname.split('/').pop() || 'home_page.html';
        $$('a.nav1', nav).forEach(function (a) {
            var h = (a.getAttribute('href') || '').split('#')[0];
            if (h === here || (here === 'home_page.html' && a.textContent.trim() === 'Menu')) a.classList.add('here');
        });
        /* modern navbar: a pill that slides under the link you point at */
        var ind = document.createElement('span'); ind.className = 'nav_ind'; nav.appendChild(ind);
        var links = $$('a.nav1', nav), first = true;
        var place = function (a) {
            if (!a) { ind.style.opacity = '0'; links.forEach(function (l) { l.classList.remove('lit'); }); return; }
            if (first) { ind.style.transition = 'none'; }
            ind.style.opacity = '1'; ind.style.left = a.offsetLeft + 'px'; ind.style.top = a.offsetTop + 'px';
            ind.style.width = a.offsetWidth + 'px'; ind.style.height = a.offsetHeight + 'px';
            links.forEach(function (l) { l.classList.toggle('lit', l === a); });
            if (first) { ind.offsetWidth; ind.style.transition = ''; first = false; }
        };
        var rest = function () { place($('a.nav1.here', nav)); };
        links.forEach(function (a) { a.addEventListener('mouseenter', function () { place(a); }); a.addEventListener('focus', function () { place(a); }); });
        nav.addEventListener('mouseleave', rest);
        rest(); window.addEventListener('resize', rest); window.addEventListener('load', rest);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(rest);
    }
    /* the logo goes to the same place as the SweetHavens words next to it */
    var logo = $('#logo'), word = $('#h_title');
    if (logo && word && !(logo.parentNode.tagName === 'A')) {
        var la = document.createElement('a'); la.href = word.getAttribute('href') || 'home_page.html'; la.title = 'SweetHavens';
        logo.parentNode.insertBefore(la, logo); la.appendChild(logo);
    }
    try { var fl = sessionStorage.getItem('sh_flash'); if (fl) { sessionStorage.removeItem('sh_flash'); toast(fl); } } catch (e) {}

    function openProfile() {
        var active = user(); if (!active) { location.href = 'login.html'; return; }
        var isAdmin = active.role === 'admin';
        var profile = isAdmin ? S.get('sh_admin_profile', {}) : (S.get('sh_users', []).filter(function (x) { return norm(x.name) === norm(active.name); })[0] || {});
        var fields = [
            ['name', 'Name'], ['age', 'Age'], ['sex', 'Sex'], ['email', 'Gmail'], ['contact', 'Contact Number'],
            ['address', 'House/Unit No. and Street'], ['region', 'Region'], ['city', 'City/Municipality'],
            ['brgy', 'Barangay'], ['zip', 'ZIP Code'], ['landmark', 'Landmark/Delivery Notes']
        ];
        var fieldHtml = fields.map(function (f) {
            var value = profile[f[0]] == null ? (f[0] === 'name' ? active.name : '') : profile[f[0]];
            return '<label style="display:block;text-align:left;margin:10px 0"><span style="display:block;font-weight:700;margin-bottom:4px">' + f[1] + '</span>' +
                '<input data-profile="' + f[0] + '" value="' + esc(value) + '" readonly style="width:100%;box-sizing:border-box;padding:10px;border:2px solid var(--bord);border-radius:10px;background:var(--field);color:var(--ink)"></label>';
        }).join('');
        var modalBox = $('#modal');
        if (!modalBox) { modalBox = document.createElement('div'); modalBox.id = 'modal'; modalBox.innerHTML = '<div class="mbox" id="mbox"></div>'; document.body.appendChild(modalBox); }
        modalBox.innerHTML = '<div class="mbox" id="mbox"><h3>My Information</h3><form id="profile_form" style="text-align:left">' + fieldHtml +
            '<p id="profile_msg" style="min-height:1.2em"></p><div class="oc_btns" style="justify-content:center"><button class="btn_dark" type="button" id="profile_edit">Edit</button>' +
            '<button class="btn_dark" type="submit" id="profile_save" disabled>Save</button><button class="btn_dark" type="button" data-close>Close</button></div></form></div>';
        modalBox.classList.add('on');
        modalBox.onclick = function (e) { if (e.target === modalBox || e.target.hasAttribute('data-close')) modalBox.classList.remove('on'); };
        var form = $('#profile_form', modalBox), edit = $('#profile_edit', modalBox), save = $('#profile_save', modalBox);
        edit.onclick = function () { $$('[data-profile]', form).forEach(function (input) { input.removeAttribute('readonly'); }); save.disabled = false; edit.disabled = true; };
        form.onsubmit = function (e) {
            e.preventDefault();
            var changes = {};
            $$('[data-profile]', form).forEach(function (input) { changes[input.getAttribute('data-profile')] = input.value.trim(); });
            if (!changes.name) { $('#profile_msg', form).textContent = 'Name is required.'; return; }
            if (isAdmin) {
                var adminProfile = S.get('sh_admin_profile', {}); Object.keys(changes).forEach(function (key) { adminProfile[key] = changes[key]; });
                S.set('sh_admin_profile', adminProfile);
            } else {
                var users = S.get('sh_users', []), oldName = active.name, found = false;
                users.forEach(function (entry) { if (norm(entry.name) === norm(oldName)) { Object.keys(changes).forEach(function (key) { entry[key] = changes[key]; }); found = true; } });
                if (!found) { $('#profile_msg', form).textContent = 'Saved account was not found. Please log in again.'; return; }
                S.set('sh_users', users);
                var orders = S.get('sh_orders', []); orders.forEach(function (order) { if (norm(order.name) === norm(oldName)) order.name = changes.name; }); S.set('sh_orders', orders);
                var oldKey = 'sh_wish_' + norm(oldName), newKey = 'sh_wish_' + norm(changes.name), oldWish = S.get(oldKey, null);
                if (oldWish) { S.set(newKey, oldWish); try { localStorage.removeItem(oldKey); } catch (x) {} }
            }
            active.name = changes.name; S.set('sh_user', active);
            toast('Account information saved.'); modalBox.classList.remove('on');
        };
    }

    /* ---- home page: show products the admin added (after list.js made the others) ---- */
    function injectCustom() {
        var box = $('#classics'); if (!box) return;
        var cols = ['#E08EAA', '#93494A', '#CEA386', '#75672C', '#A15D24', '#554C4E'];
        customList().forEach(function (p, i) {
            var t = document.getElementById(i % 2 ? 'card-template2' : 'card-template'); if (!t) return;
            var k = t.content.cloneNode(true), im = $('.product-img', k);
            im.src = p.img || 'assets/Logo.png'; im.alt = p.n;
            $('.product-card', k).style.backgroundColor = cols[i % cols.length];
            $('.card-header', k).textContent = p.n; $('.card-notif', k).textContent = 'New!';
            $('.card-p', k).textContent = p.d || 'Freshly baked and ready to order.';
            $('.info-btn', k).textContent = 'Learn More'; $('.order-btn', k).textContent = 'Order Now';
            box.appendChild(k);
        });
    }
    function onReady(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
    onReady(injectCustom);
    onReady(function () {
        syncProductStock();
    });

    function syncProductStock() {
        $$('.product-card').forEach(function (card) {
            var title = $('.card-header', card); if (!title) return;
            var count = stockCount(title.textContent.trim()), badge = $('.card-notif', card);
            if (badge) {
                if (!badge.hasAttribute('data-stock-label')) badge.setAttribute('data-stock-label', badge.textContent);
                badge.textContent = count <= 0 ? 'Out of Stock' : badge.getAttribute('data-stock-label');
            }
            $$('.cart-btn, .order-btn', card).forEach(function (button) {
                button.disabled = count <= 0 || (u && u.role === 'admin');
                if (u && u.role === 'admin') button.hidden = true;
            });
        });
    }
    window.addEventListener('storage', syncProductStock);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) syncProductStock(); });

    /* ---- wishlist heart at the top-right of every product ---- */
    function initWish() {
        var cards = $$('.product-card'); if (!cards.length) return;
        var layer = document.createElement('div'); layer.id = 'wish_layer'; document.body.appendChild(layer);
        var nameOf = function (c) { return $('.card-header', c).textContent.trim(); };
        var items = cards.map(function (card) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'wish_btn'; b.innerHTML = HEART; layer.appendChild(b);
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                if (needLogin()) return;
                var on = toggleWish(nameOf(card), $('.product-img', card).getAttribute('src'));
                paint(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
                toast(on ? '\u2665 ' + nameOf(card) + ' was added to your wishlist.' : nameOf(card) + ' was removed from your wishlist.');
            });
            return { card: card, b: b };
        });
        function paint() {
            items.forEach(function (it) {
                var nm = nameOf(it.card), on = inWish(nm);
                it.b.classList.toggle('on', on); it.b.setAttribute('aria-pressed', on ? 'true' : 'false');
                it.b.title = on ? 'In your wishlist (click to remove)' : 'Add to wishlist'; it.b.setAttribute('aria-label', it.b.title + ': ' + nm);
            });
        }
        function place() {
            var sx = window.pageXOffset, sy = window.pageYOffset;
            items.forEach(function (it) {
                var r = it.card.getBoundingClientRect();
                it.b.style.top = (r.top + sy + 14) + 'px'; it.b.style.left = (r.right + sx - 14 - it.b.offsetWidth) + 'px';
            });
        }
        paint(); place();
        window.addEventListener('resize', place); window.addEventListener('load', place); window.addEventListener('storage', paint);
        if (window.ResizeObserver) new ResizeObserver(place).observe(document.body);
    }
    onReady(initWish);

    /* ---- eye on password boxes outside login / sign up (e.g. payment panels) ---- */
    onReady(function () {
        if ($('#login_form') || $('#signup_form')) return;
        $$('input[type="password"]').forEach(function (i) {
            var w = document.createElement('span'); w.className = 'pw_wrap'; i.parentNode.insertBefore(w, i); w.appendChild(i); eyeify(i, w);
        });
    });

    /* ---- home page: Learn More / Add to cart / Order Now ---- */
    function modal(html) {
        var m = $('#modal');
        if (!m) { m = document.createElement('div'); m.id = 'modal'; m.innerHTML = '<div class="mbox" id="mbox"></div>'; document.body.appendChild(m);
            m.addEventListener('click', function (e) { if (e.target === m || e.target.getAttribute('data-close')) m.classList.remove('on'); }); }
        $('#mbox').innerHTML = html; m.classList.add('on');
    }
    function addItem(card) {
        var name = $('.card-header', card).textContent.trim(), p = find(name) || { p: 0 };
        var c = cart(), f = c.filter(function (i) { return norm(i.name) === norm(name); })[0];
        var available = stockCount(name);
        if (available <= 0) { toast(name + ' is out of stock.'); syncProductStock(); return null; }
        if (f && f.qty >= available) { toast('Only ' + available + ' ' + name + ' available.'); return null; }
        if (f) f.qty++; else c.push({ name: name, price: p.p, img: $('.product-img', card).getAttribute('src'), qty: 1 });
        saveCart(c); return name;
    }
    document.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('.product-card') : null;
        if (!card) return;
        var info = e.target.closest('.info-btn'), add = e.target.closest('.cart-btn'), ord = e.target.closest('.order-btn');
        if (u && u.role === 'admin' && (add || ord)) {
            e.preventDefault(); toast('Admin accounts cannot place orders.'); return;
        }
        if (info) {
            var nm = $('.card-header', card).textContent.trim();
            location.href = 'product.html?product=' + encodeURIComponent(nm);
        } else if (add || ord) {
            /* the link inside "Add to cart" must NEVER jump to the cart page (that was the bug on every 2nd product) */
            e.preventDefault();
            if (needLogin()) return;
            var added = addItem(card);
            if (!added) return;
            if (ord) { location.href = 'cart.html'; }
            else cartToast(added);
        }
    });
})();