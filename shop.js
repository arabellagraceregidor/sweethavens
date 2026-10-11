/* shop.js - Cart, Delivery, Order finished and Receipt pages */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, $$ = SH.$$, fmt = SH.fmt, esc = SH.esc;
    if (SH.needLogin()) return;
    var FEE = 50;

    /* order complete: the page behind blurs (74%) and a truck loads the package, then we go to the "order placed" page */
    function showOrderOverlay() {
        var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        var o = document.createElement('div'); o.id = 'order_overlay';
        o.innerHTML = '<div class="order_pill"><div class="pkg"></div><div class="truck"><div class="cargo"></div><div class="cab"></div>' +
            '<i class="wheel w1"></i><i class="wheel w2"></i></div></div><p class="order_msg">Placing your order...</p>' +
            '<p class="order_sub">Please wait while we pack your cookies.</p>';
        document.body.appendChild(o);
        requestAnimationFrame(function () { requestAnimationFrame(function () { o.classList.add('on'); }); });
        setTimeout(function () { $('.order_msg', o).textContent = 'Order complete!'; $('.order_sub', o).textContent = 'Your treats are on their way.'; }, still ? 400 : 4500);
        setTimeout(function () { location.href = 'orderfinished.html'; }, still ? 1200 : 5700);
    }

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
        var payWrap = $('#pay_methods'), payOpts = $$('.pay_opt');
        var payLabels = { cash: 'Cash on Delivery', credit: 'Credit/Debit Card', gcash: 'GCash' };
        var cardBox = $('#card_checkout'), cardMsg = $('#card_msg');
        var cardName = $('#card_name'), cardNum = $('#card_number'), cardExp = $('#card_exp'), cardCvc = $('#card_cvc');
        var gcBox = $('#gcash_checkout'), gcMsg = $('#gc_msg'), gcName = $('#gc_name'), gcNum = $('#gc_num'), gcPin = $('#gc_pin');
        var btns = $$('.option-btn'); btns[0].classList.add('active');
        var totals = function () {
            var c = SH.cart(), sub = c.reduce(function (a, i) { return a + i.price * i.qty; }, 0), fee = c.length && mode === 'Delivery' ? FEE : 0;
            return { sub: sub, fee: fee, tot: sub + fee };
        };
        var stars = function () { $$('.delivery-container label').forEach(function (l) { var f = l.nextElementSibling; l.classList.toggle('req', !!(f && f.required)); }); };
        var setMsg = function (el, text, kind) {
            if (!el) return;
            el.textContent = text || '';
            el.className = 'pay_msg' + (kind ? ' ' + kind : '');
        };
        var replayIn = function (el) {
            if (!el || el.hidden) return;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = '';
        };
        var showPayPanels = function () {
            var pay = method.value;
            var isCard = pay === 'credit', isGc = pay === 'gcash';
            if (cardBox) { cardBox.hidden = !isCard; if (isCard) replayIn(cardBox); }
            if (gcBox) { gcBox.hidden = !isGc; if (isGc) replayIn(gcBox); }
            [cardName, cardNum, cardExp, cardCvc].forEach(function (f) { if (f) f.required = isCard; });
            [gcName, gcNum, gcPin].forEach(function (f) { if (f) f.required = isGc; });
            if (!isCard) setMsg(cardMsg, '');
            if (!isGc) setMsg(gcMsg, '');
        };
        var setPay = function (pay) {
            method.value = pay || '';
            payOpts.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-pay') === pay); });
            if (payWrap) payWrap.classList.remove('invalid');
            showPayPanels();
        };
        var paint = function () {
            var t = totals(), p = $$('.summary div p:nth-child(2)');
            p[0].textContent = fmt(t.sub); p[1].textContent = fmt(t.fee); p[2].textContent = fmt(t.tot);
            addr.required = mode === 'Delivery'; stars(); showPayPanels();
        };
        var digits = function (s) { return String(s || '').replace(/\D/g, ''); };
        var waitPay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
        var capWords = function (s) {
            return String(s || '').replace(/\S+/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
        };
        payOpts.forEach(function (b) {
            b.addEventListener('click', function () { setPay(b.getAttribute('data-pay')); });
        });
        if (cardNum) cardNum.addEventListener('input', function () {
            var d = digits(this.value).slice(0, 16);
            this.value = d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
            this.classList.remove('invalid');
        });
        if (cardExp) cardExp.addEventListener('input', function () {
            var d = digits(this.value).slice(0, 4);
            this.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
            this.classList.remove('invalid');
        });
        if (cardCvc) cardCvc.addEventListener('input', function () {
            this.value = digits(this.value).slice(0, 4);
            this.classList.remove('invalid');
        });
        if (gcNum) gcNum.addEventListener('input', function () {
            this.value = digits(this.value).slice(0, 11);
            this.classList.remove('invalid');
        });
        if (gcPin) gcPin.addEventListener('input', function () {
            this.value = digits(this.value).slice(0, 6);
            this.classList.remove('invalid');
        });
        if (gcName) gcName.addEventListener('input', function () {
            var pos = this.selectionStart, v = capWords(this.value);
            this.value = v; this.setSelectionRange(pos, pos);
            this.classList.remove('invalid');
        });
        [cardName].forEach(function (f) {
            if (f) f.addEventListener('input', function () { this.classList.remove('invalid'); });
        });
        /* Card payment flow */
        var handleCardPayment = function (amount, items) {
            return new Promise(function (resolve, reject) {
                var bad = [];
                [cardName, cardNum, cardExp, cardCvc].forEach(function (f) { f.classList.remove('invalid'); });
                var cardDigits = digits(cardNum.value);
                if (!cardName.value.trim()) bad.push(cardName);
                if (!(cardDigits.length >= 12 && cardDigits.length % 4 === 0)) bad.push(cardNum);
                if (!/^\d{2}\/\d{2}$/.test(cardExp.value.trim())) bad.push(cardExp);
                if (digits(cardCvc.value).length < 3) bad.push(cardCvc);
                if (bad.length) {
                    bad.forEach(function (f) { f.classList.add('invalid'); });
                    setMsg(cardMsg, 'Use any numbers in a 4-4-4 pattern (e.g. 1234 5678 9012).', 'err');
                    bad[0].focus();
                    reject(new Error('invalid'));
                    return;
                }
                setMsg(cardMsg, 'Processing card payment...', 'busy');
                waitPay(750).then(function () {
                    setMsg(cardMsg, 'Payment authorized.', 'ok');
                    resolve({ kind: 'card', amount: amount, items: items });
                });
            });
        };
        /* GCash payment flow */
        var handleGcashPayment = function (amount, items) {
            return new Promise(function (resolve, reject) {
                var bad = [];
                [gcName, gcNum, gcPin].forEach(function (f) { f.classList.remove('invalid'); });
                if (!gcName.value.trim()) bad.push(gcName);
                if (!/^09\d{9}$/.test(digits(gcNum.value))) bad.push(gcNum);
                if (!/^\d{4,6}$/.test(digits(gcPin.value))) bad.push(gcPin);
                if (bad.length) {
                    bad.forEach(function (f) { f.classList.add('invalid'); });
                    setMsg(gcMsg, 'Enter a valid GCash name, 11-digit number (09…), and MPIN.', 'err');
                    bad[0].focus();
                    reject(new Error('invalid'));
                    return;
                }
                setMsg(gcMsg, 'Sending GCash request...', 'busy');
                waitPay(800).then(function () {
                    setMsg(gcMsg, 'GCash payment approved.', 'ok');
                    resolve({ kind: 'gcash', amount: amount, items: items });
                });
            });
        };
        btns.forEach(function (b) { b.addEventListener('click', function () {
            mode = b.textContent.trim() === 'Pick Up' ? 'Pick Up' : 'Delivery';
            btns.forEach(function (x) { x.classList.toggle('active', x === b); }); paint();
        }); });
        if (addr) addr.addEventListener('input', function () { addr.classList.remove('invalid'); });
        paint();
        var place = $('.delivery-container > button[type="submit"]');
        place.addEventListener('click', function (e) {
            e.preventDefault();
            if (place.classList.contains('paying')) return;
            var c = SH.cart(), badOnes = [];
            if (!c.length) { SH.toast('Your cart is empty.'); return; }
            if (mode === 'Delivery' && !addr.value.trim()) badOnes.push(addr);
            if (!method.value) {
                if (payWrap) {
                    payWrap.classList.add('invalid');
                    payWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                SH.toast('Please choose a payment method.');
                return;
            }
            if (badOnes.length) {
                badOnes.forEach(function (f) { f.classList.add('invalid'); });
                badOnes[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); badOnes[0].focus({ preventScroll: true }); return;
            }
            var finish = function () {
                var t = totals(), L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', id = '';
                for (var k = 0; k < 7; k++) id += L[Math.floor(Math.random() * 26)];
                var st = SH.stock();
                c.forEach(function (i) { st[i.name] = Math.max(0, (st[i.name] == null ? 0 : st[i.name]) - i.qty); });
                SH.saveStock(st);
                var orders = S.get('sh_orders', []);
                orders.push({ id: id, name: SH.user().name, mode: mode, addr: mode === 'Delivery' ? addr.value.trim() : 'Pick up at the shop', pay: payLabels[method.value] || method.value,
                    items: c.map(function (i) { return { name: i.name, qty: i.qty, price: i.price }; }), sub: t.sub, fee: t.fee, total: t.tot, status: 'Pending', date: new Date().toISOString() });
                S.set('sh_orders', orders); S.set('sh_last', id); SH.saveCart([]);
                showOrderOverlay();
            };
            var pay = method.value;
            if (pay === 'credit' || pay === 'gcash') {
                place.classList.add('paying');
                var run = pay === 'credit' ? handleCardPayment(totals().tot, c) : handleGcashPayment(totals().tot, c);
                run.then(function () {
                    place.classList.remove('paying');
                    finish();
                }).catch(function () { place.classList.remove('paying'); });
                return;
            }
            /* Cash on Delivery — no extra payment panel */
            finish();
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