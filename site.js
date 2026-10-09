/* site.js - shared by every page: light/dark button, add-to-cart on the home page, header links, helpers */
(function () {
    var S = {
        get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
        set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var norm = function (s) { return String(s).trim().replace(/\s+/g, ' ').toLowerCase(); };
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return '\u20B1 ' + Number(n).toFixed(2); };

    /* products, prices and starting stock (prices come from the design PDF) */
    var CATALOG = [
        { n: 'Matcha Melties', p: 40, s: 30 }, { n: 'Biscoff Choco Crunch', p: 55, s: 30 },
        { n: 'Oatie Choco Paws', p: 35, s: 30 }, { n: 'Choco Crinkles', p: 30, s: 30 },
        { n: 'Chocolate Chip', p: 35, s: 40 }, { n: 'Red Velvet Cloud Bites', p: 40, s: 40 }
    ];
    var BASE = CATALOG.slice();
    var customList = function () { return S.get('sh_products', []); };
    /* products = the 6 from the design + any product the admin added (name, price, stock, photo) */
    var catalog = function () {
        return BASE.concat(customList().map(function (p) { return { n: p.n, p: p.p, s: p.s, custom: true, id: p.id, img: p.img, d: p.d }; }));
    };
    var find = function (n) { return catalog().filter(function (c) { return norm(c.n) === norm(n); })[0]; };
    var user = function () { return S.get('sh_user', null); };
    var cart = function () { return S.get('sh_cart', []); };
    var saveCart = function (c) { S.set('sh_cart', c); };
    function stock() {
        var st = S.get('sh_stock', {});
        catalog().forEach(function (c) { if (st[c.n] == null) st[c.n] = c.s; });
        return st;
    }
    var saveStock = function (st) { S.set('sh_stock', st); };

    function toast(m) {
        var t = $('#toast');
        if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
        t.textContent = m; t.classList.add('on');
        clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 1900);
    }
    function needLogin() {
        if (user()) return false;
        toast('LOG IN FIRST FIRST!');
        setTimeout(function () { location.href = 'login.html'; }, 900);
        return true;
    }
    function logout() { S.set('sh_user', null); S.set('sh_cart', []); location.href = 'login.html'; }

    window.SH = { catalog: catalog, S: S, $: $, $$: $$, norm: norm, esc: esc, fmt: fmt, CATALOG: CATALOG, find: find, user: user, cart: cart,
        saveCart: saveCart, stock: stock, saveStock: saveStock, toast: toast, needLogin: needLogin, logout: logout };

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
    if (u && u.role === 'admin') { nav = $('#admin_nav_buttons') }
    else { nav = $('#nav_buttons') };
    if (nav) {
        var last = nav.lastElementChild, add = function (href, text, id) {
            var d = document.createElement('div');
            d.innerHTML = '<a class="nav1"' + (id ? ' id="' + id + '"' : '') + ' href="' + href + '">' + text + '</a>';
            nav.insertBefore(d, last);
        };
        if (u) {
            add('#', 'Log Out', 'logout_link');
            $('#logout_link').addEventListener('click', function (e) { e.preventDefault(); logout(); });
            var pic = $('#pfp_btn'); if (pic) pic.title = u.name + (u.role === 'admin' ? ' (Admin)' : '');
        }
        /* the Menu button now works: it goes to the menu on the home page */
        $$('a.nav1', nav).forEach(function (a) {
            if (!a.getAttribute('href') && a.textContent.trim() === 'Menu') a.setAttribute('href', 'home_page.html#weekly');
        });
        var here = location.pathname.split('/').pop() || 'home_page.html';
        $$('a.nav1', nav).forEach(function (a) {
            var h = a.getAttribute('href');
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
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCustom); else injectCustom();

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
        if (f) f.qty++; else c.push({ name: name, price: p.p, img: $('.product-img', card).getAttribute('src'), qty: 1 });
        saveCart(c); return name;
    }
    document.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('.product-card') : null;
        if (!card) return;
        var info = e.target.closest('.info-btn'), add = e.target.closest('.cart-btn'), ord = e.target.closest('.order-btn');
        if (info) {
            var nm = $('.card-header', card).textContent.trim(), p = find(nm);
            modal('<img src="' + esc($('.product-img', card).getAttribute('src')) + '" alt=""><h3>' + esc(nm) + '</h3><small>' + esc($('.card-notif', card).textContent) +
                '</small><p>' + esc($('.card-p', card).textContent) + '</p><div class="price">' + (p ? fmt(p.p) : '') + '</div>' +
                '<button class="btn_dark" id="m_add">Add to cart</button> <button class="btn_dark" data-close="1" style="background:#D9D9D9;color:#000">Close</button>');
            $('#m_add').onclick = function () { if (needLogin()) return; toast(addItem(card) + ' added to cart'); $('#modal').classList.remove('on'); };
        } else if (add || ord) {
            if (needLogin()) { e.preventDefault(); return; }
            var added = addItem(card);
            if (ord) { e.preventDefault(); location.href = 'cart.html'; }
            else if (!add.querySelector('a')) toast(added + ' added to cart');
        }
    });
})();