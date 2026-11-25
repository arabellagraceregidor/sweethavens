/* shop.js - Cart, Delivery, Order finished and Receipt pages */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, $$ = SH.$$, fmt = SH.fmt, esc = SH.esc;
    if (SH.needLogin()) return;
    function stockProblem(items) {
        return (items || []).filter(function (item) { return SH.stockCount(item.name) < item.qty; });
    }
    var currentUser = SH.user();
    if (currentUser && currentUser.role === 'admin') {
        if ($('.cart_cont') || $('.delivery-container') || $('#my_orders')) {
            SH.toast($('#my_orders') ? 'My Orders is only available to customer accounts.' : 'Admin accounts cannot place orders.');
            location.replace('dashboard.html');
            return;
        }
    }
    var FEE = 50;

    /* ---------- estimated ready + arrival time ---------- */
    function etaFor(items, mode) {
        var qty = items.reduce(function (a, i) { return a + i.qty; }, 0);
        var prep = Math.min(75, 30 + 5 * Math.max(0, qty - 1));                     /* minutes to bake and pack */
        var ready = new Date(Date.now() + prep * 60000);
        ready = new Date(Math.ceil(ready.getTime() / 300000) * 300000);              /* round up to 5 minutes */
        var arrive = mode === 'Delivery' ? new Date(ready.getTime() + 30 * 60000) : null;   /* + 30 minutes ride */
        return { prep: prep, ready: ready, arrive: arrive };
    }
    function when(d) {
        d = new Date(d);
        var now = new Date(), tm = new Date(now.getTime() + 864e5), t = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
        if (d.toDateString() === now.toDateString()) return 'Today, ' + t;
        if (d.toDateString() === tm.toDateString()) return 'Tomorrow, ' + t;
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ', ' + t;
    }
    function etaReceipt(o) {
        if (!o.readyAt) return '';
        return '<div class="receipt_line" style="font-size:18px"><span>' + (o.mode === 'Delivery' ? 'Estimated ready' : 'Ready for pick up by') + '</span><b>' + when(o.readyAt) + '</b></div>' +
            (o.arriveAt ? '<div class="receipt_line" style="font-size:18px"><span>Estimated arrival</span><b>' + when(o.arriveAt) + '</b></div>' : '');
    }

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
        /* wishlist: a hollow heart on the right side of the cart; click it to see the saved products */
        var wishOpen = false;
        var wishPanel = function () {
            var l = SH.wishList(), rows;
            if (!l.length) rows = '<p class="empty" style="margin:10px 0">No products in your wishlist yet. Tap the heart on a product to save it.</p>';
            else rows = l.map(function (w, i) {
                var p = SH.find(w.name);
                var available = p ? SH.stockCount(w.name) : 0;
                return '<div class="wish_row"><div class="cart_img-cont"><img class="cart_img" src="' + esc(w.img || (p && p.img) || 'assets/Logo.png') + '" alt=""></div>' +
                    '<div class="cart_info-cont"><p class="cart_name">' + esc(w.name) + '</p><p class="cart_price">' + (p ? fmt(p.p) : 'Not available right now') + '</p>' + (available <= 0 ? '<b>Out of Stock</b>' : '') + '</div>' +
                    '<div class="wish_actions">' + (p ? '<button type="button" class="wish_add" data-i="' + i + '"' + (available <= 0 ? ' disabled' : '') + '>' + (available <= 0 ? 'Out of Stock' : 'Add to cart') + '</button>' : '') +
                    '<button type="button" class="wish_rm on" data-i="' + i + '" title="Remove from wishlist" aria-label="Remove ' + esc(w.name) + ' from wishlist">' + SH.HEART + '</button></div></div>';
            }).join('');
            return '<div class="wish_panel" id="wish_panel"' + (wishOpen ? '' : ' hidden') + '><h2>My Wishlist</h2>' + rows + '</div>';
        };
        var wishHead = function () {
            var n = SH.wishList().length;
            return '<div class="wish_top"><button type="button" class="wish_toggle' + (wishOpen ? ' open' : '') + '" aria-expanded="' + wishOpen + '" title="My wishlist" aria-label="My wishlist">' +
                SH.HEART + '<span class="wish_count"' + (n ? '' : ' hidden') + '>' + n + '</span></button></div>' + wishPanel();
        };
        var editMode = false;
        var selectedItems = [];
        var drawCart = function () {
            var c = SH.cart();
            if (!c.length) { wrap.innerHTML = wishHead() + '<p class="empty">Your cart is empty. Add a cookie from the Menu!</p><div style="text-align:center"><button type="button" class="cart_checkout"><a href="home_page.html#weekly">Go to Menu</a></button></div>'; return; }
            var sub = 0;
            var unavailable = stockProblem(c);
            var cartHTML = c.map(function (it, i) {
                sub += it.price * it.qty;
                var available = SH.stockCount(it.name), status = available <= 0 ? 'Out of Stock' : it.qty > available ? 'Only ' + available + ' available' : '';
                var checkbox = editMode ? '<input type="checkbox" class="cart_select" data-i="' + i + '"' + (selectedItems.indexOf(i) > -1 ? ' checked' : '') + '>' : '';
                var editBtn = !editMode ? '<button type="button" class="cart_edit" data-i="' + i + '">Edit</button>' : '';
                return '<div class="cart_card' + (editMode ? ' editing' : '') + '"><div class="cart_img-cont"><img src="' + esc(it.img) + '" class="cart_img"></div>' +
                    '<div class="cart_info-cont"><p class="cart_name">' + esc(it.name) + '</p><p class="cart_price">' + fmt(it.price) + '</p>' + (status ? '<b>' + status + '</b>' : '') + '</div>' +
                    '<div class="cart_quantity-cont"><button class="cart_minus" data-i="' + i + '">-</button><p class="cart_quantity">' + it.qty +
                    '</p><button class="cart_plus" data-i="' + i + '"' + (it.qty >= available ? ' disabled' : '') + '>+</button></div>' +
                    '<div class="cart_actions">' + checkbox + editBtn + '</div></div>';
            }).join('');
            var editActions = editMode ? '<div class="edit_actions"><button type="button" class="edit_buy">Buy Selected (' + selectedItems.length + ')</button>' +
                '<button type="button" class="edit_delete">Delete Selected</button><button type="button" class="edit_wishlist">Add to Wishlist</button><button type="button" class="edit_cancel">Cancel</button></div>' : '';
            wrap.innerHTML = wishHead() + cartHTML + '<div class="cart_total"><span>Subtotal</span><b>' + fmt(sub) + '</b></div>' +
                '<button type="button" class="cart_checkout" data-delivery' + (unavailable.length ? ' disabled aria-disabled="true"' : '') + '>Proceed to Checkout</button>' + editActions;
        };
        wrap.addEventListener('click', function (e) {
            var wt = e.target.closest('.wish_toggle'), wa = e.target.closest('.wish_add'), wr = e.target.closest('.wish_rm');
            var checkout = e.target.closest('[data-delivery]');
            var editBtn = e.target.closest('.cart_edit');
            var selectBox = e.target.closest('.cart_select');
            var buyBtn = e.target.closest('.edit_buy');
            var deleteBtn = e.target.closest('.edit_delete');
            var wishlistBtn = e.target.closest('.edit_wishlist');
            var cancelBtn = e.target.closest('.edit_cancel');

            if (checkout) {
                var checkoutCart = SH.cart(), blocked = stockProblem(checkoutCart);
                if (blocked.length) { SH.toast('Remove unavailable or excess products before checkout.'); return; }
                location.href = 'delivery.html'; return;
            }
            if (wt) { wishOpen = !wishOpen; drawCart(); return; }
            if (wa || wr) {
                var wl = SH.wishList(), w = wl[+(wa || wr).getAttribute('data-i')]; if (!w) return;
                if (wa) {
                    var p = SH.find(w.name), cc = SH.cart(), hit = cc.filter(function (x) { return SH.norm(x.name) === SH.norm(w.name); })[0], available = SH.stockCount(w.name);
                    if (available <= 0) { SH.toast(w.name + ' is out of stock.'); drawCart(); return; }
                    if (hit && hit.qty >= available) { SH.toast('Only ' + available + ' ' + w.name + ' available.'); return; }
                    if (hit) hit.qty++; else cc.push({ name: w.name, price: p ? p.p : 0, img: w.img || (p && p.img) || 'assets/Logo.png', qty: 1 });
                    SH.saveCart(cc); SH.cartToast(w.name);
                } else { SH.toggleWish(w.name); SH.toast(w.name + ' was removed from your wishlist.'); }
                drawCart(); return;
            }
            if (editBtn) {
                editMode = true;
                selectedItems = [];
                drawCart();
                return;
            }
            if (selectBox) {
                var idx = +selectBox.getAttribute('data-i');
                if (selectBox.checked) {
                    if (selectedItems.indexOf(idx) === -1) selectedItems.push(idx);
                } else {
                    selectedItems = selectedItems.filter(function (i) { return i !== idx; });
                }
                drawCart();
                return;
            }
            if (cancelBtn) {
                editMode = false;
                selectedItems = [];
                drawCart();
                return;
            }
            if (buyBtn) {
                if (selectedItems.length === 0) { SH.toast('Select at least one product to buy.'); return; }
                var c = SH.cart();
                var selectedProducts = selectedItems.map(function (i) { return c[i]; });
                var sub = selectedProducts.reduce(function (a, i) { return a + i.price * i.qty; }, 0);
                SH.saveCart(selectedProducts);
                SH.toast(selectedProducts.length + ' product(s) selected. Total: ' + fmt(sub));
                location.href = 'delivery.html';
                return;
            }
            if (deleteBtn) {
                if (selectedItems.length === 0) { SH.toast('Select at least one product to delete.'); return; }
                var c = SH.cart();
                selectedItems.sort(function (a, b) { return b - a; }).forEach(function (i) { c.splice(i, 1); });
                SH.saveCart(c);
                selectedItems = [];
                editMode = false;
                SH.toast('Selected products deleted from cart.');
                drawCart();
                return;
            }
            if (wishlistBtn) {
                if (selectedItems.length === 0) { SH.toast('Select at least one product to add to wishlist.'); return; }
                var c = SH.cart();
                selectedItems.forEach(function (i) {
                    var item = c[i];
                    var p = SH.find(item.name);
                    SH.toggleWish(item.name, item.img || (p && p.img) || 'assets/Logo.png');
                });
                SH.toast(selectedItems.length + ' product(s) added to wishlist.');
                selectedItems = [];
                editMode = false;
                drawCart();
                return;
            }
            var b = e.target.closest('.cart_minus, .cart_plus'); if (!b) return;
            var c = SH.cart(), i = +b.getAttribute('data-i');
            if (b.classList.contains('cart_plus') && c[i].qty >= SH.stockCount(c[i].name)) { SH.toast(c[i].name + ' is out of stock.'); return; }
            c[i].qty += b.classList.contains('cart_plus') ? 1 : -1;
            if (c[i].qty < 1) c.splice(i, 1);
            SH.saveCart(c); drawCart();
        });
        drawCart();
        window.addEventListener('storage', drawCart);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) drawCart(); });
    }

    /* ---------- DELIVERY ---------- */
    var box = $('.delivery-container');
    if (box) {
        var mode = 'Delivery', addr = $('#address'), method = $('#method');
        var payWrap = $('#pay_methods'), payOpts = $$('.pay_opt');
        var payLabels = { cash: 'Cash on Delivery', credit: 'Credit/Debit Card', gcash: 'GCash' };
        var cardBox = $('#card_checkout'), cardMsg = $('#card_msg');
        var cardName = $('#card_name'), cardNum = $('#card_number'), cardExp = $('#card_exp'), cardCvc = $('#card_cvc');
        var gcBox = $('#gcash_checkout'), gcMsg = $('#gc_msg'), gcName = $('#gc_name'), gcNum = $('#gc_num');
        var gcFile = $('#gc_file'), gcPick = $('#gc_pick'), gcPrev = $('#gc_prev'), gcFn = $('#gc_fn'), gcShot = '';
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
            [gcName, gcNum].forEach(function (f) { if (f) f.required = isGc; });
            if (!isCard) setMsg(cardMsg, '');
            if (!isGc) setMsg(gcMsg, '');
        };
        var setPay = function (pay) {
            method.value = pay || '';
            payOpts.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-pay') === pay); });
            if (payWrap) payWrap.classList.remove('invalid');
            showPayPanels();
        };
        /* estimated ready / arrival time shown under the order summary */
        var etaBox = document.createElement('div'); etaBox.className = 'eta_box';
        var sumBox = $('.summary'); if (sumBox) sumBox.after(etaBox);
        var etaPaint = function () {
            var e = etaFor(SH.cart(), mode);
            etaBox.innerHTML = '<h2>Estimated Time</h2><div class="eta_row"><span>' + (mode === 'Delivery' ? 'Estimated ready' : 'Ready for pick up by') + '</span><b>' + when(e.ready) + '</b></div>' +
                (e.arrive ? '<div class="eta_row"><span>Estimated arrival</span><b>' + when(e.arrive) + '</b></div>' : '') +
                '<p class="eta_note">Times can change depending on traffic and how many orders we have.</p>';
        };
        setInterval(etaPaint, 60000);
        var paint = function () {
            var t = totals(), p = $$('.summary div p:nth-child(2)');
            p[0].textContent = fmt(t.sub); p[1].textContent = fmt(t.fee); p[2].textContent = fmt(t.tot);
            addr.required = mode === 'Delivery'; stars(); showPayPanels(); etaPaint();
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
            var d = digits(this.value).slice(0, 11);
            this.value = d.length > 7 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
            this.classList.remove('invalid');
        });
        /* GCash receipt photo: downscaled on the spot and stored with the order */
        if (gcPick && gcFile) {
            gcPick.addEventListener('click', function () { gcFile.click(); });
            gcFile.addEventListener('change', function () {
                var f = gcFile.files && gcFile.files[0];
                gcShot = ''; gcPrev.classList.remove('invalid'); gcPrev.style.backgroundImage = '';
                if (!f) { gcFn.textContent = 'No receipt uploaded'; return; }
                if (!/^image\//.test(f.type)) { setMsg(gcMsg, 'Upload a photo of your GCash receipt (JPG or PNG).', 'err'); gcFile.value = ''; return; }
                var rd = new FileReader();
                rd.onload = function () {
                    var img = new Image();
                    img.onload = function () {
                        var w = img.width, h = img.height, max = 600;
                        if (Math.max(w, h) > max) { var r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
                        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                        cv.getContext('2d').drawImage(img, 0, 0, w, h);
                        gcShot = cv.toDataURL('image/webp', 0.85);
                        gcPrev.style.backgroundImage = 'url(' + gcShot + ')';
                        setMsg(gcMsg, '');
                    };
                    img.onerror = function () { setMsg(gcMsg, 'That photo could not be read. Try another one.', 'err'); };
                    img.src = rd.result;
                };
                rd.readAsDataURL(f);
            });
        }
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
                [gcName, gcNum].forEach(function (f) { if (f) f.classList.remove('invalid'); });
                gcPrev.classList.remove('invalid');
                var bad = [];
                if (!gcName.value.trim()) bad.push(gcName);
                if (!/^09\d{9}$/.test(digits(gcNum.value))) bad.push(gcNum);
                if (!gcShot) gcPrev.classList.add('invalid');
                if (bad.length || !gcShot) {
                    bad.forEach(function (f) { f.classList.add('invalid'); });
                    setMsg(gcMsg, !gcShot ? 'Upload a photo of your GCash receipt to continue.' : 'Enter the GCash account name and an 11-digit number starting with 09.', 'err');
                    (bad[0] || gcPick).focus();
                    reject(new Error('invalid'));
                    return;
                }
                setMsg(gcMsg, 'Checking your GCash receipt...', 'busy');
                waitPay(900).then(function () {
                    setMsg(gcMsg, 'GCash receipt received.', 'ok');
                    resolve({ kind: 'gcash', amount: amount, items: items, receipt: gcShot });
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
            if (stockProblem(c).length) { SH.toast('An item is out of stock or exceeds available stock. Return to your cart to update it.'); return; }
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
            var finish = function (proof) {
                if (stockProblem(c).length) { place.classList.remove('paying'); SH.toast('Stock changed before your order could be placed. Return to your cart and update it.'); return; }
                var t = totals(), L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', id = '';
                for (var k = 0; k < 7; k++) id += L[Math.floor(Math.random() * 26)];
                var st = SH.stock();
                c.forEach(function (i) { st[i.name] = Math.max(0, (st[i.name] == null ? 0 : st[i.name]) - i.qty); });
                SH.saveStock(st);
                SH.ensureOrderTags();
                var orders = S.get('sh_orders', []);
                orders.push({ id: id, name: SH.user().name, mode: mode, addr: mode === 'Delivery' ? addr.value.trim() : 'Pick up at the shop', pay: payLabels[method.value] || method.value, paid: method.value !== 'cash', proof: (proof && proof.receipt) || '', riderLocation: '',
                    items: c.map(function (i) { return { name: i.name, tag: SH.nextOrderTag(i.name), qty: i.qty, price: i.price, img: i.img }; }), sub: t.sub, fee: t.fee, total: t.tot, status: 'Pending', date: new Date().toISOString(),
                    readyAt: etaFor(c, mode).ready.toISOString(), arriveAt: etaFor(c, mode).arrive ? etaFor(c, mode).arrive.toISOString() : null });
                S.set('sh_orders', orders); S.set('sh_last', id); SH.saveCart([]);
                showOrderOverlay();
            };
            var pay = method.value;
            if (pay === 'credit' || pay === 'gcash') {
                place.classList.add('paying');
                var run = pay === 'credit' ? handleCardPayment(totals().tot, c) : handleGcashPayment(totals().tot, c);
                run.then(function (res) {
                    place.classList.remove('paying');
                    finish(res);
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
        var tr = document.createElement('button'); tr.innerHTML = '<a href="my_orders.html">Track Order</a>'; rb.after(tr);
        var lo = S.get('sh_orders', []).filter(function (x) { return x.id === S.get('sh_last', ''); })[0];
        if (lo && lo.readyAt) {
            var ep = document.createElement('p'); ep.className = 'eta_line';
            ep.innerHTML = (lo.arriveAt ? 'Estimated arrival: <b>' + when(lo.arriveAt) + '</b>' : 'Ready for pick up by: <b>' + when(lo.readyAt) + '</b>');
            b0.before(ep);
        }
    }

    /* ---------- MY ORDERS: order status tracking (layout follows the "order tracking" reference photo) ---------- */
    var mo = $('#my_orders');
    if (mo) {
        var STEPS = { 'Delivery': ['Order placed', 'Preparing', 'Out for delivery', 'Delivered'], 'Pick Up': ['Order placed', 'Preparing', 'Ready for pick up', 'Picked up'] };
        var IDX = { Pending: 0, Preparing: 1, Ready: 2, 'Pick Up': 2, Completed: 3 };
        var TABS = ['All', 'To Pay', 'To Ship', 'To Receive', 'To Review', 'Return'];
        var tab = 'All', lastSig = '';
        var SAY = {
            Pending: 'We received your order and will start baking soon.',
            Preparing: 'Your cookies are being baked and packed.',
            'Ready:Delivery': 'Your order is out for delivery.',
            'Ready:Pick Up': 'Your order is ready. Please pick it up at the shop.',
            'Pick Up': 'Your order has been picked up by the rider.',
            'Completed:Delivery': 'Your package has been delivered.',
            'Completed:Pick Up': 'You picked up your order. Enjoy your cookies!',
            Cancelled: 'This order was cancelled.'
        };
        var mine = function () {
            var me = SH.norm(SH.user().name);
            return S.get('sh_orders', []).filter(function (o) { return !o.sample && SH.norm(o.name) === me; })
                .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        };
        var picOf = function (i) { var p = SH.find(i.name); return i.img || (p && p.img) || 'assets/Logo.png'; };
        var allReviews = function () { return S.get('sh_reviews', []); };
        var reviewed = function (o, i) { return allReviews().some(function (r) { return String(r.id) === String(o.id) + '_' + String(i); }); };
        var isPaid = function (o) { return o.paid === true || (o.paid == null && !/cash|cod/i.test(o.pay || '')); };
        var orderCard = function (o) {
            var steps = STEPS[o.mode] || STEPS.Delivery, idx = IDX[o.status] || 0, done = o.status === 'Completed', gone = o.status === 'Cancelled', returned = o.status === 'Returned';
            var head = gone ? 'Order cancelled' : returned ? 'Returned' : o.status === 'Pick Up' ? 'Picked up by rider' : done ? (o.mode === 'Delivery' ? 'Order delivered' : 'Order completed') : steps[idx];
            var say = SAY[o.status === 'Ready' || o.status === 'Completed' ? o.status + ':' + o.mode : o.status] || '';
            if (returned) say = 'This order was successfully returned.';
            var track = gone || returned ? '' : '<div class="track"><span class="track_fill" data-w="calc(75% * ' + (done ? 3 : idx) + ' / 3)"></span>' + steps.map(function (s, i) {
                var d = done || i < idx, n = !done && i === idx;
                return '<div class="step' + (d ? ' done' : n ? ' now' : '') + '"><i>' + (d ? '\u2713' : (i + 1)) + '</i><span>' + s + '</span></div>';
            }).join('') + '</div>';
            var eta = (!gone && !done && o.readyAt) ? '<div class="oc_eta"><div><span>' + (o.mode === 'Delivery' ? 'Estimated ready' : 'Ready for pick up by') + '</span><b>' + when(o.readyAt) + '</b></div>' +
                (o.arriveAt ? '<div><span>Estimated arrival</span><b>' + when(o.arriveAt) + '</b></div>' : '') + '</div>' : '';
            var lines = o.items.map(function (i) {
                return '<div class="oc_line"><img src="' + esc(picOf(i)) + '" alt="' + esc(i.name) + '" style="width:76px;height:76px;object-fit:contain"><div class="oc_name"><b>' + (i.tag ? '<small>' + esc(i.tag) + '</small> ' : '') + esc(i.name) + '</b><span>' + fmt(i.price) + '</span></div><span class="oc_qty">x' + i.qty + '</span></div>';
            }).join('');
            var rider = o.mode === 'Delivery' && (o.status === 'Ready' || o.status === 'Pick Up') ? '<div class="oc_eta"><div><span>Rider location</span><b>' + esc(o.riderLocation || 'Location not updated yet') + '</b></div></div>' : '';
            var note = '';
            if (gone) {
                note = '<p class="oc_note">Reason: <b>' + esc(o.cancelReason || 'Not stated') + '</b>';
                if (o.refundStatus === 'Requested') note += ' &middot; Refund requested, reference ' + esc((o.refund && o.refund.reference) || '') + '.';
                else if (o.refundStatus === 'No refund') note += ' &middot; No refund: cash is paid on delivery, so nothing was charged.';
                note += '</p>';
            }
            var cancel = o.status === 'Pending' ? '<button type="button" class="oc_cancel" data-cancel="' + esc(o.id) + '">Cancel Order</button>' : '';
            return '<div class="order_card"><div class="oc_head"><div class="oc_shop">SweetHavens &rsaquo;<small>Order #' + esc(SH.orderTagLabel(o)) + ' &middot; ' + when(o.date) + ' &middot; ' + esc(o.mode) + '</small></div>' +
                '<span class="pill_s ' + o.status + '">' + head + '</span></div><p class="oc_say">' + say + '</p>' + note + track + eta + rider + lines +
                '<div class="oc_foot"><span>Total: <b>' + fmt(o.total) + '</b> &middot; ' + esc(o.pay) + '</span><div class="oc_btns">' +
                '<button type="button" class="oc_rc" data-rc="' + esc(o.id) + '">View receipt</button><button type="button" class="oc_again" data-again="' + esc(o.id) + '">Buy again</button>' + cancel + '</div></div></div>';
        };
        var isCompletedOrder = function (o) {
            var s = String(o && o.status || '').trim().toLowerCase();
            return s === 'delivered' || s === 'picked up';
        };
        var reviewCards = function (all) {
            var rows = [];
            all.forEach(function (o) {
                if (!isCompletedOrder(o)) return;
                (o.items || []).forEach(function (i, index) {
                    if (reviewed(o, index)) return;
                    rows.push('<div class="order_card"><div class="oc_head"><div class="oc_shop">Order #' + esc(i.tag || SH.orderTagLabel(o)) + '<small>' + when(o.date) + '</small></div><span>' + esc(i.name) + '</span></div>' +
                        '<div class="oc_line"><img src="' + esc(picOf(i)) + '" alt="' + esc(i.name) + '" style="width:76px;height:76px;object-fit:contain"><div class="oc_name"><b>' + (i.tag ? '<small>' + esc(i.tag) + '</small> ' : '') + esc(i.name) + '</b><span>Qty: ' + i.qty + '</span></div></div>' +
                        '<div class="oc_btns" style="align-items:center"><span>Quick review:</span><span class="quick_rating" data-order="' + esc(o.id) + '" data-item="' + index + '" style="display:flex;gap:4px"></span>' +
                        '<button type="button" data-quick-submit="' + esc(o.id) + '" data-item="' + index + '">Submit</button><button type="button" data-refund="' + esc(o.id) + '" data-item="' + index + '">Request Refund</button>' +
                        '<button type="button" class="oc_again" data-write-review="' + esc(o.id) + '" data-item="' + index + '" data-product="' + esc(i.name) + '">Write a Review</button></div></div>');
                });
            });
            return rows.length ? rows.join('') : '<div class="order_card"><p class="empty">No products are waiting for review.</p></div>';
        };
        var drawOrders = function (force) {
            var all = mine(), sig = tab + JSON.stringify(all.map(function (o) { return [o.id, o.status, o.paid, o.riderLocation]; })) + JSON.stringify(allReviews().map(function (r) { return r.id; }));
            if (!force && sig === lastSig) return;
            lastSig = sig;
            var list = all.filter(function (o) {
                if (tab === 'To Pay') return !isPaid(o) && o.status !== 'Cancelled' && o.status !== 'Returned';
                if (tab === 'To Ship') return o.status === 'Pending' || o.status === 'Preparing' || (o.status === 'Ready' && o.mode === 'Pick Up');
                if (tab === 'To Receive') return (o.status === 'Ready' || o.status === 'Pick Up') && o.mode === 'Delivery';
                if (tab === 'Return') return o.status === 'Returned';
                return true;
            });
            var counts = {
                'All': all.length,
                'To Pay': all.filter(function (o) { return !isPaid(o) && o.status !== 'Cancelled' && o.status !== 'Returned'; }).length,
                'To Ship': all.filter(function (o) { return o.status === 'Pending' || o.status === 'Preparing' || (o.status === 'Ready' && o.mode === 'Pick Up'); }).length,
                'To Receive': all.filter(function (o) { return (o.status === 'Ready' || o.status === 'Pick Up') && o.mode === 'Delivery'; }).length,
                'To Review': all.filter(function (o) { return isCompletedOrder(o); }).reduce(function (n, o) { return n + o.items.filter(function (i, ix) { return !reviewed(o, ix); }).length; }, 0),
                'Return': all.filter(function (o) { return o.status === 'Returned'; }).length
            };
            var bar = '<div class="oc_tabs">' + TABS.map(function (name) {
                var n = counts[name];
                return '<button type="button" class="' + (name === tab ? 'on' : '') + '" data-tab="' + name + '">' + name + (n ? ' <em>' + n + '</em>' : '') + '</button>';
            }).join('') + '</div>';
            var body;
            if (!all.length) body = '<p class="empty">You have no orders yet.</p><div style="text-align:center"><button type="button" class="cart_checkout"><a href="home_page.html#weekly">Go to Menu</a></button></div>';
            else if (tab === 'To Review') body = reviewCards(all);
            else if (!list.length) body = '<p class="empty">No orders in "' + tab + '".</p>';
            else body = list.map(orderCard).join('');
            mo.innerHTML = '<h1>My Orders</h1>' + bar + body;
            $$('.quick_rating', mo).forEach(function (host) {
                for (var i = 1; i <= 5; i++) { var star = document.createElement('button'); star.type = 'button'; star.textContent = '\u2606'; star.setAttribute('data-value', i); star.style.cssText = 'border:0;background:transparent;padding:0 2px;color:var(--mar);font-size:26px;cursor:pointer'; host.appendChild(star); }
            });
            requestAnimationFrame(function () { requestAnimationFrame(function () { $$('.track_fill', mo).forEach(function (f) { f.style.width = f.getAttribute('data-w'); }); }); });
        };
        /* ---------- CANCEL ORDER: one reason + the refund details of the payment that was used ---------- */
        var payKind = function (o) {
            var p = String(o.pay || '').toLowerCase();
            return /gcash/.test(p) ? 'gcash' : /cash/.test(p) ? 'cash' : 'card';
        };
        var PAY_NAME = { cash: 'Cash on Delivery', gcash: 'GCash', card: 'Credit/Debit Card' };
        var REASONS = ['Changed my mind', 'Ordered by mistake', 'Wrong item or quantity', 'Found the same item somewhere else', 'Delivery takes too long', 'Wrong delivery details', 'Other reason'];
        var ccPaid = function (o) { return o.paid === true || (o.paid == null && payKind(o) !== 'cash'); };

        var cc = document.createElement('div');
        cc.id = 'cancel_modal';
        cc.innerHTML = '<div class="cc_card" role="dialog" aria-modal="true" aria-labelledby="cc_title">' +
            '<p class="cc_title" id="cc_title">Cancel this order?</p>' +
            '<p class="cc_sub" id="cc_sub"></p>' +
            '<p class="cc_pay" id="cc_pay"></p>' +
            '<label class="cc_label" for="cc_reason">Reason for cancelling</label>' +
            '<select class="cc_sel" id="cc_reason"><option value="">Choose one reason</option>' +
            REASONS.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select>' +
            '<div id="cc_other_box" hidden><label class="cc_label" for="cc_other">Your reason</label>' +
            '<input class="cc_in" id="cc_other" maxlength="90" placeholder="Type your reason"></div>' +
            '<div id="cc_refund" hidden><p class="cc_rf_t">Refund details</p>' +
            '<p class="cc_rf_s">This order was already paid, so the refund needs the reference number and a photo of the receipt.</p>' +
            '<label class="cc_label" for="cc_ref">Reference number</label>' +
            '<input class="cc_in" id="cc_ref" maxlength="24" placeholder="Reference number on your receipt">' +
            '<label class="cc_label" for="cc_file">Receipt</label>' +
            '<div class="photo_row" data-upload><div class="photo_prev cc_prev" id="cc_prev"></div><input type="file" id="cc_file" accept="image/*">' +
            '<button type="button" class="btn_dark cc_pick" id="cc_pick">Upload receipt</button><span class="cc_fn" id="cc_fn">No receipt uploaded</span></div></div>' +
            '<p class="cc_msg" id="cc_msg"></p>' +
            '<div class="cc_btns"><button type="button" class="cc_keep" id="cc_keep">Keep order</button>' +
            '<button type="button" class="cc_go" id="cc_cancel">Cancel order</button></div></div>';
        document.body.appendChild(cc);

        var ccOrder = null, ccShot = '';
        var ccEl = function (id) { return cc.querySelector('#' + id); };
        var ccSay = function (t, bad) { var m = ccEl('cc_msg'); m.textContent = t || ''; m.className = 'cc_msg' + (bad ? ' err' : ''); };
        var ccClose = function () {
            cc.classList.remove('on'); ccOrder = null; ccShot = '';
            ccEl('cc_prev').style.backgroundImage = ''; ccEl('cc_prev').classList.remove('invalid');
            ccEl('cc_fn').textContent = 'No receipt uploaded'; ccEl('cc_file').value = '';
            SH.uploadReset(ccEl('cc_file'));
            ccEl('cc_reason').classList.remove('invalid'); ccEl('cc_other').classList.remove('invalid'); ccEl('cc_ref').classList.remove('invalid');
            ccSay('');
        };
        var openCancel = function (o) {
            ccOrder = o;
            var kind = payKind(o), paid = ccPaid(o), needs = paid && kind !== 'cash';
            ccEl('cc_sub').textContent = 'Order #' + SH.orderTagLabel(o) + ' - ' + o.mode;
            /* the system reads the payment method from the order itself */
            ccEl('cc_pay').innerHTML = 'Payment method: <b>' + PAY_NAME[kind] + '</b> - ' + (paid ? 'already paid' : 'not paid yet');
            ccEl('cc_refund').hidden = !needs;
            ccEl('cc_reason').value = ''; ccEl('cc_other').value = ''; ccEl('cc_other_box').hidden = true;
            ccEl('cc_ref').value = ''; ccEl('cc_ref').classList.remove('invalid');
            ccEl('cc_prev').classList.remove('invalid'); ccEl('cc_prev').style.backgroundImage = '';
            ccShot = ''; ccEl('cc_fn').textContent = 'No receipt uploaded'; ccEl('cc_file').value = '';
            SH.uploadReset(ccEl('cc_file'));
            ccSay('');
            if (!paid) ccSay('No refund will be made: cash is only collected on delivery, so this order was not charged.');
            cc.classList.add('on');
            ccEl('cc_reason').focus();
        };
        ccEl('cc_keep').addEventListener('click', function () { ccClose(); drawOrders(true); });
        cc.addEventListener('click', function (e) { if (e.target === cc) ccClose(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cc.classList.contains('on')) ccClose(); });
        ccEl('cc_reason').addEventListener('change', function () {
            ccEl('cc_reason').classList.remove('invalid');
            ccEl('cc_other_box').hidden = this.value !== 'Other reason';
            if (this.value !== 'Other reason') ccEl('cc_other').value = '';
            ccSay(ccEl('cc_refund').hidden && ccOrder && !ccPaid(ccOrder) ? 'No refund will be made: cash is only collected on delivery, so this order was not charged.' : '');
        });
        ccEl('cc_other').addEventListener('input', function () { ccEl('cc_other').classList.remove('invalid'); });
        ccEl('cc_ref').addEventListener('input', function () { ccEl('cc_ref').classList.remove('invalid'); });
        ccEl('cc_pick').addEventListener('click', function () { ccEl('cc_file').click(); });
        ccEl('cc_file').addEventListener('change', function () {
            var f = this.files && this.files[0];
            ccShot = ''; ccEl('cc_prev').classList.remove('invalid'); ccEl('cc_prev').style.backgroundImage = '';
            if (!f) { ccEl('cc_fn').textContent = 'No receipt uploaded'; return; }
            if (!/^image\//.test(f.type)) { ccSay('Upload a photo of the receipt (JPG or PNG).', true); this.value = ''; return; }
            var rd = new FileReader();
            rd.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var w = img.width, h = img.height, max = 600;
                    if (Math.max(w, h) > max) { var r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
                    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                    cv.getContext('2d').drawImage(img, 0, 0, w, h);
                    ccShot = cv.toDataURL('image/webp', 0.85);
                    ccEl('cc_prev').style.backgroundImage = 'url(' + ccShot + ')';
                    ccSay('');
                };
                img.onerror = function () { ccSay('That receipt could not be read. Try another one.', true); };
                img.src = rd.result;
            };
            rd.readAsDataURL(f);
        });
        ccEl('cc_cancel').addEventListener('click', function () {
            if (!ccOrder) return;
            var reason = ccEl('cc_reason').value.trim(), other = ccEl('cc_other').value.trim();
            var needs = !ccEl('cc_refund').hidden, ref = ccEl('cc_ref').value.trim();
            if (!reason) { ccEl('cc_reason').classList.add('invalid'); ccSay('Choose one reason for cancelling the order.', true); ccEl('cc_reason').focus(); return; }
            if (reason === 'Other reason' && !other) { ccEl('cc_other').classList.add('invalid'); ccSay('Type your reason.', true); ccEl('cc_other').focus(); return; }
            if (needs && !ref) { ccEl('cc_ref').classList.add('invalid'); ccSay('Type the reference number of your payment.', true); ccEl('cc_ref').focus(); return; }
            if (needs && !ccShot) { ccEl('cc_prev').classList.add('invalid'); ccSay('Upload the receipt of your payment.', true); ccEl('cc_pick').focus(); return; }
            var list = S.get('sh_orders', []);
            var target = list.filter(function (o) { return String(o.id) === String(ccOrder.id) && SH.norm(o.name) === SH.norm(SH.user().name); })[0];
            if (!target || target.sample || target.status !== 'Pending') { ccClose(); SH.toast('This order can no longer be cancelled.'); drawOrders(true); return; }
            var kind = payKind(target), full = reason === 'Other reason' ? other : reason, reqId = 'rf' + Date.now();
            /* the refund record is saved first: if the receipt cannot be stored, the order stays as it is */
            if (needs) {
                var reqs = S.get('sh_refunds', []);
                reqs.push({ id: reqId, orderId: target.id, itemIndex: null,
                    product: target.items.map(function (i) { return i.name; }).join(', '), userName: target.name,
                    reason: full, details: '', reference: ref, method: PAY_NAME[kind], kind: 'Order cancellation',
                    evidence: [{ name: 'receipt.webp', type: 'image/webp', data: ccShot }], status: 'Requested', date: new Date().toISOString() });
                S.set('sh_refunds', reqs);
                var kept = S.get('sh_refunds', []).some(function (x) { return x.id === reqId; });
                if (!kept) { ccSay('The receipt is too large to save. Upload a smaller photo.', true); return; }
            }
            var stockLeft = SH.stock();
            target.items.forEach(function (item) { stockLeft[item.name] = (stockLeft[item.name] || 0) + item.qty; });
            SH.saveStock(stockLeft);
            target.status = 'Cancelled';
            target.cancelReason = full;
            target.cancelDate = new Date().toISOString();
            if (needs) {
                target.refundStatus = 'Requested';
                target.refund = { id: reqId, status: 'Requested', method: PAY_NAME[kind], reference: ref, date: new Date().toISOString() };
            } else {
                target.refundStatus = 'No refund';
            }
            S.set('sh_orders', list);
            ccClose();
            SH.toast('Order #' + SH.orderTagLabel(target) + ' was cancelled.' + (needs ? ' Refund requested.' : ' No refund needed.'));
            drawOrders(true);
        });

        mo.addEventListener('click', function (e) {
            var tb = e.target.closest('[data-tab]'), rc = e.target.closest('.oc_rc'), ag = e.target.closest('[data-again]');
            if (tb) { tab = tb.getAttribute('data-tab'); drawOrders(true); return; }
            if (rc) { S.set('sh_last', rc.getAttribute('data-rc')); location.href = 'receipt.html'; return; }
            var cancel = e.target.closest('[data-cancel]');
            if (cancel) {
                var cancelList = S.get('sh_orders', []), target = cancelList.filter(function (o) { return String(o.id) === cancel.getAttribute('data-cancel') && SH.norm(o.name) === SH.norm(SH.user().name); })[0];
                if (!target || target.sample || target.status !== 'Pending') { SH.toast('This order can no longer be cancelled.'); drawOrders(true); return; }
                openCancel(target); return;
            }
            var star = e.target.closest('.quick_rating [data-value]');
            if (star) {
                var host = star.parentNode, value = +star.getAttribute('data-value'); host.setAttribute('data-rating', value);
                Array.prototype.forEach.call(host.children, function (x, i) { x.textContent = i < value ? '\u2605' : '\u2606'; }); return;
            }
            var quick = e.target.closest('[data-quick-submit]');
            if (quick) {
                var orderKey = quick.getAttribute('data-quick-submit'), itemKey = +quick.getAttribute('data-item'), ratingHost = mo.querySelector('.quick_rating[data-order="' + orderKey + '"][data-item="' + itemKey + '"]'), rating = +(ratingHost && ratingHost.getAttribute('data-rating'));
                if (!rating) { SH.toast('Choose one to five stars first.'); return; }
                var orderForReview = all.filter(function (o) { return String(o.id) === orderKey; })[0], reviewItem = orderForReview && orderForReview.items[itemKey];
                if (!orderForReview || !reviewItem) return;
                var reviewList = allReviews(); reviewList.push({ id: String(orderKey) + '_' + itemKey, orderId: orderKey, itemIndex: itemKey, product: reviewItem.name, userName: SH.user().name, stars: rating, text: '', date: new Date().toISOString() });
                S.set('sh_reviews', reviewList); SH.toast('Your quick review was submitted.'); drawOrders(true); return;
            }
            var refund = e.target.closest('[data-refund]');
            if (refund) { location.href = 'refund.html?order=' + encodeURIComponent(refund.getAttribute('data-refund')) + '&item=' + encodeURIComponent(refund.getAttribute('data-item')); return; }
            var write = e.target.closest('[data-write-review]');
            if (write) { location.href = 'product.html?product=' + encodeURIComponent(write.getAttribute('data-product')) + '&order=' + encodeURIComponent(write.getAttribute('data-write-review')); return; }
            if (ag) {
                var o = S.get('sh_orders', []).filter(function (x) { return x.id === ag.getAttribute('data-again'); })[0]; if (!o) return;
                var c = SH.cart(), added = 0;
                o.items.forEach(function (i) {
                    var p = SH.find(i.name); if (!p) return;
                    var hit = c.filter(function (x) { return SH.norm(x.name) === SH.norm(i.name); })[0];
                    if (hit) hit.qty += i.qty; else c.push({ name: i.name, price: p.p, img: picOf(i), qty: i.qty });
                    added++;
                });
                if (!added) { SH.toast('Those products are not available right now.'); return; }
                SH.saveCart(c); SH.toast('\u2713 Your items are back in the cart.', { href: 'cart.html', text: 'View Cart' });
            }
        });
        window.addEventListener('storage', function () { drawOrders(); });
        document.addEventListener('visibilitychange', function () { if (!document.hidden) drawOrders(); });
        setInterval(drawOrders, 5000);
        drawOrders(true);
    }

    /* ---------- RECEIPT ---------- */
    var rc = $('#receipt');
    if (rc) {
        var o = S.get('sh_orders', []).filter(function (x) { return x.id === S.get('sh_last', ''); })[0];
        if (!o) { rc.innerHTML = '<p class="empty">No order yet. Check out a cart first!</p>'; return; }
        rc.innerHTML = '<div class="receipt_box thermal-paper"><div class="receipt_brand">SweetHavens</div><p class="receipt_caption">Order Receipt</p>' +
            '<div class="receipt_head"><h3>Customer Info</h3><b>Order #' + esc(SH.orderTagLabel(o)) + '</b></div>' +
            '<div class="receipt_in">' + esc(o.name) + '</div><h3>' + (o.mode === 'Delivery' ? 'Delivery Address' : 'Pick Up') + '</h3><div class="receipt_in">' + esc(o.addr) + '</div>' +
            '<hr><h3>Order Summary</h3>' + o.items.map(function (i) { return '<div class="receipt_line"><span>' + (i.tag ? '<b>' + esc(i.tag) + '</b> ' : '') + i.qty + 'x ' + esc(i.name) + '</span><b>' + fmt(i.qty * i.price) + '</b></div>'; }).join('') +
            '<div class="receipt_line"><span>Payment: ' + esc(o.pay) + '</span></div>' + etaReceipt(o) + '<hr>' +
            '<div class="receipt_line"><span>Subtotal</span><b>' + fmt(o.sub) + '</b></div><div class="receipt_line"><span>Delivery Fee</span><b>' + fmt(o.fee) + '</b></div>' +
            '<div class="receipt_line tot"><span>TOTAL</span><b>' + fmt(o.total) + '</b></div><p class="receipt_thanks">Thank you for ordering!</p></div>';
    }
})();