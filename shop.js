/* shop.js - Cart, Delivery, Order finished and Receipt pages */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, $$ = SH.$$, fmt = SH.fmt, esc = SH.esc;
    if (SH.needLogin()) return;
    var FEE = 50;

    /* ---------- CART ---------- */
    var wrap = $('.cart_cont');
    if (wrap) {
        var drawCart = function () {
            var c = SH.cart();
            if (!c.length) { wrap.innerHTML = '<p class="empty">Your cart is empty. Add a cookie from the Menu!</p><div style="text-align:center"><button type="button" class="cart_checkout"><a href="home_page.html#weekly">Go to Menu</a></button></div>'; return; }
            var sub = 0;
            wrap.innerHTML = c.map(function (it, i) {
                sub += it.price * it.qty;
                return '<div class="cart_card"><div class="cart_img-cont"><img src="' + esc(it.img) + '" class="cart_img"></div>' +
                    '<div class="cart_info-cont"><p class="cart_name">' + esc(it.name) + '</p><p class="cart_price">' + fmt(it.price) + '</p></div>' +
                    '<div class="cart_quantity-cont"><button class="cart_minus" data-i="' + i + '">-</button><p class="cart_quantity">' + it.qty +
                    '</p><button class="cart_plus" data-i="' + i + '">+</button></div></div>';
            }).join('') + '<div class="cart_total"><span>Subtotal</span><b>' + fmt(sub) + '</b></div>' +
                '<button type="submit" class="cart_checkout"><a href="delivery.html">Proceed to Checkout</a></button>';
        };
        wrap.addEventListener('click', function (e) {
            var b = e.target.closest('.cart_minus, .cart_plus'); if (!b) return;
            var c = SH.cart(), i = +b.getAttribute('data-i');
            c[i].qty += b.classList.contains('cart_plus') ? 1 : -1;
            if (c[i].qty < 1) c.splice(i, 1);
            SH.saveCart(c); drawCart();
        });
        drawCart();
    }

    /* ---------- DELIVERY ---------- */
    var box = $('.delivery-container');
    if (box) {
        var mode = 'Delivery', addr = $('#address'), method = $('#method');
        var btns = $$('.option-btn'); btns[0].classList.add('active');
        var totals = function () {
            var c = SH.cart(), sub = c.reduce(function (a, i) { return a + i.price * i.qty; }, 0), fee = c.length && mode === 'Delivery' ? FEE : 0;
            return { sub: sub, fee: fee, tot: sub + fee };
        };
        var stars = function () { $$('.delivery-container label').forEach(function (l) { var f = l.nextElementSibling; l.classList.toggle('req', !!(f && f.required)); }); };
        var paint = function () {
            var t = totals(), p = $$('.summary div p:nth-child(2)');
            p[0].textContent = fmt(t.sub); p[1].textContent = fmt(t.fee); p[2].textContent = fmt(t.tot);
            addr.required = mode === 'Delivery'; stars();
        };
        btns.forEach(function (b) { b.addEventListener('click', function () {
            mode = b.textContent.trim() === 'Pick Up' ? 'Pick Up' : 'Delivery';
            btns.forEach(function (x) { x.classList.toggle('active', x === b); }); paint();
        }); });
        [addr, method].forEach(function (f) { f.addEventListener('input', function () { f.classList.remove('invalid'); }); });
        paint();
        var place = $('.delivery-container > button[type="submit"]');
        place.addEventListener('click', function (e) {
            e.preventDefault();
            var c = SH.cart(), badOnes = [];
            if (!c.length) { SH.toast('Your cart is empty.'); return; }
            if (mode === 'Delivery' && !addr.value.trim()) badOnes.push(addr);
            if (!method.value) badOnes.push(method);
            if (badOnes.length) {
                badOnes.forEach(function (f) { f.classList.add('invalid'); });
                badOnes[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); badOnes[0].focus({ preventScroll: true }); return;
            }
            var t = totals(), L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', id = '';
            for (var k = 0; k < 7; k++) id += L[Math.floor(Math.random() * 26)];
            var st = SH.stock();
            c.forEach(function (i) { st[i.name] = Math.max(0, (st[i.name] == null ? 0 : st[i.name]) - i.qty); });
            SH.saveStock(st);
            var orders = S.get('sh_orders', []);
            orders.push({ id: id, name: SH.user().name, mode: mode, addr: mode === 'Delivery' ? addr.value.trim() : 'Pick up at the shop', pay: method.options[method.selectedIndex].text,
                items: c.map(function (i) { return { name: i.name, qty: i.qty, price: i.price }; }), sub: t.sub, fee: t.fee, total: t.tot, status: 'Pending', date: new Date().toISOString() });
            S.set('sh_orders', orders); S.set('sh_last', id); SH.saveCart([]);
            location.href = 'orderfinished.html';
        }, true);
    }

    /* ---------- ORDER FINISHED ---------- */
    var fin = $('.order_finished');
    if (fin) {
        var b0 = fin.querySelector('button'), rb = document.createElement('button');
        rb.innerHTML = '<a href="receipt.html">View Receipt</a>';
        b0.after(rb);
    }

    /* ---------- RECEIPT ---------- */
    var rc = $('#receipt');
    if (rc) {
        var o = S.get('sh_orders', []).filter(function (x) { return x.id === S.get('sh_last', ''); })[0];
        if (!o) { rc.innerHTML = '<p class="empty">No order yet. Check out a cart first!</p>'; return; }
        rc.innerHTML = '<div class="receipt_box"><div class="receipt_head"><h3>Customer Info</h3><b>Order #' + esc(o.id) + '</b></div>' +
            '<div class="receipt_in">' + esc(o.name) + '</div><h3>' + (o.mode === 'Delivery' ? 'Address Delivery' : 'Pick Up') + '</h3><div class="receipt_in">' + esc(o.addr) + '</div>' +
            '<hr><h3>Order Summary</h3>' + o.items.map(function (i) { return '<div class="receipt_line"><span>' + i.qty + 'x ' + esc(i.name) + '</span><b>' + fmt(i.qty * i.price) + '</b></div>'; }).join('') +
            '<div class="receipt_line" style="font-size:16px;color:inherit"><span>Payment: ' + esc(o.pay) + '</span></div><hr>' +
            '<div class="receipt_line"><span>Subtotal</span><b>' + fmt(o.sub) + '</b></div><div class="receipt_line"><span>Delivery Fee</span><b>' + fmt(o.fee) + '</b></div>' +
            '<div class="receipt_line tot"><span>TOTAL</span><b>' + fmt(o.total) + '</b></div></div>';
    }
})();