/* Customer pages: product reviews, editable account information, password recovery and refunds. */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, esc = SH.esc, fmt = SH.fmt;
    var norm = SH.norm, user = SH.user();
    function params() { return new URLSearchParams(location.search); }
    function reviews() { return S.get('sh_reviews', []); }
    function reviewId(orderId, itemIndex) { return String(orderId) + '_' + String(itemIndex); }
    function orderList() { return S.get('sh_orders', []); }
    function eligible(name, orderId) {
        if (!user) return [];
        var result = [];
        orderList().forEach(function (o) {
            if (o.sample || o.status === 'Cancelled' || o.status === 'Returned' || norm(o.name) !== norm(user.name) || (orderId && String(o.id) !== String(orderId))) return;
            (o.items || []).forEach(function (item, i) {
                if (norm(item.name) === norm(name) && !reviews().some(function (r) { return String(r.id) === reviewId(o.id, i); })) result.push({ order: o, item: item, index: i });
            });
        });
        return result;
    }
    function starButtons(host, initial) {
        var rating = initial || 0;
        host.innerHTML = '';
        for (var i = 1; i <= 5; i++) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'oc_btns quick_star'; b.setAttribute('data-value', i);
            b.style.cssText = 'border:0;background:transparent;padding:0 3px;color:var(--mar);font-size:28px;cursor:pointer';
            b.textContent = i <= rating ? '\u2605' : '\u2606'; b.setAttribute('aria-label', i + ' stars'); host.appendChild(b);
        }
        host.addEventListener('click', function (e) {
            var b = e.target.closest('[data-value]'); if (!b) return;
            rating = +b.getAttribute('data-value');
            Array.prototype.forEach.call(host.children, function (x, i) { x.textContent = i < rating ? '\u2605' : '\u2606'; });
            host.setAttribute('data-rating', rating);
        });
        host.setAttribute('data-rating', rating);
    }

    /* ---------------- Product details and reviews ---------------- */
    var detail = $('#product_detail'), reviewBox = $('#product_reviews');
    if (detail && reviewBox) {
        var productName = params().get('product') || '', product = SH.find(productName);
        if (!product) {
            detail.innerHTML = '<p class="empty">This product is no longer available.</p>';
        } else {
            var image = product.img || 'assets/Logo.png';
            detail.innerHTML = '<div class="order_card"><div class="oc_line"><img src="' + esc(image) + '" alt="' + esc(product.n) + '"><div class="oc_name"><b>' + esc(product.n) + '</b><span>' + fmt(product.p) + '</span></div>' +
                '<button type="button" class="wish_rm" id="product_wish" aria-label="Add to wishlist">' + SH.HEART + '</button></div>' +
                '<p>' + esc(product.d || 'Freshly baked and ready to order.') + '</p><div class="oc_btns"><button class="btn_dark" type="button" id="product_add">Add to Cart</button><button class="btn_dark" type="button" id="product_order">Order Now</button></div></div>';
            var wish = $('#product_wish');
            function paintWish() {
                var on = SH.inWish(product.n); wish.classList.toggle('on', on); wish.setAttribute('aria-pressed', on ? 'true' : 'false');
                wish.title = on ? 'In your wishlist (click to remove)' : 'Add to wishlist';
            }
            wish.addEventListener('click', function () {
                if (SH.needLogin()) return;
                SH.toggleWish(product.n, image); paintWish();
                SH.toast(SH.inWish(product.n) ? product.n + ' was added to your wishlist.' : product.n + ' was removed from your wishlist.');
            });
            paintWish();
            function addToCart(go) {
                if (SH.needLogin()) return;
                var c = SH.cart(), hit = c.filter(function (x) { return norm(x.name) === norm(product.n); })[0];
                if (hit) hit.qty++; else c.push({ name: product.n, price: product.p, img: image, qty: 1 });
                SH.saveCart(c);
                if (go) location.href = 'cart.html'; else { SH.animateCartButton($('#product_add')); SH.cartToast(product.n); }
            }
            $('#product_add').addEventListener('click', function () { addToCart(false); });
            $('#product_order').addEventListener('click', function () { addToCart(true); });
            function drawReviews() {
                var list = reviews().filter(function (r) { return norm(r.product) === norm(product.n); }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
                var html = list.length ? list.map(function (r) {
                    return '<div class="order_card"><div class="oc_head"><b>' + esc(r.userName || 'Buyer') + '</b><small>' + new Date(r.date).toLocaleDateString('en-PH') + '</small></div>' +
                        '<p style="color:var(--mar)">' + '\u2605'.repeat(Math.max(0, Math.min(5, +r.stars || 0))) + '\u2606'.repeat(5 - Math.max(0, Math.min(5, +r.stars || 0))) + '</p>' +
                        (r.text ? '<p>' + esc(r.text) + '</p>' : '<p>Quick rating</p>') + '</div>';
                }).join('') : '<div class="order_card"><p class="empty">No reviews yet.</p></div>';
                var can = eligible(product.n, params().get('order'));
                if (!user) html += '<div class="order_card"><p>Log in after purchasing to write a review.</p></div>';
                else if (!can.length) html += '<div class="order_card"><p>You can write a review after you have ordered this product.</p></div>';
                else {
                    var choice = can[0], rating = params().get('rating') || 0;
                    html += '<div class="order_card"><h2>Write a Review</h2><p>Order #' + esc(choice.order.id) + ' · ' + esc(product.n) + '</p>' +
                        '<div id="review_rating" style="display:flex;gap:4px;align-items:center" aria-label="Choose a rating from one to five stars"></div>' +
                        '<label for="review_text">Your review</label><textarea id="review_text" rows="4" style="width:100%;box-sizing:border-box;border:2px solid var(--bord);background:var(--field);color:var(--ink);border-radius:12px;padding:16px;font:inherit"></textarea>' +
                        '<div class="oc_btns"><button type="button" class="btn_dark" id="review_submit">Submit Review</button></div><p id="review_msg"></p></div>';
                    reviewBox.innerHTML = html;
                    var stars = $('#review_rating'); starButtons(stars, +rating);
                    $('#review_submit').addEventListener('click', function () {
                        var value = +stars.getAttribute('data-rating'), text = $('#review_text').value.trim();
                        if (!value) { $('#review_msg').textContent = 'Choose at least one star.'; return; }
                        var list = reviews();
                        list.push({ id: reviewId(choice.order.id, choice.index), orderId: choice.order.id, itemIndex: choice.index, product: product.n,
                            userName: user.name, stars: value, text: text, date: new Date().toISOString() });
                        S.set('sh_reviews', list); SH.toast('Your review was submitted.'); drawReviews();
                    });
                    return;
                }
                reviewBox.innerHTML = html;
            }
            drawReviews();
        }
    }

    /* ---------------- Account information ---------------- */
    var accountForm = $('#account_form');
    if (accountForm) {
        if (!user) { location.href = 'login.html'; }
        else {
            var admin = user.role === 'admin', profile = admin ? S.get('sh_admin_profile', {}) : (S.get('sh_users', []).filter(function (x) { return norm(x.name) === norm(user.name); })[0] || {});
            var accountFields = ['name', 'age', 'sex', 'email', 'contact', 'address', 'region', 'city', 'brgy', 'zip', 'landmark'];
            accountFields.forEach(function (key) { var el = $('#account_' + key); if (el) el.value = profile[key] == null ? (key === 'name' ? user.name : '') : profile[key]; });
            accountForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var newName = $('#account_name').value.trim();
                if (!newName) { $('#account_msg').textContent = 'Enter your name.'; return; }
                var changes = {};
                accountFields.forEach(function (key) { var el = $('#account_' + key); if (el) changes[key] = el.value.trim(); });
                if (admin) {
                    var ap = S.get('sh_admin_profile', {}); Object.keys(changes).forEach(function (k) { ap[k] = changes[k]; }); S.set('sh_admin_profile', ap);
                } else {
                    var users = S.get('sh_users', []), found = false, oldName = user.name;
                    users.forEach(function (x) { if (norm(x.name) === norm(oldName)) { Object.keys(changes).forEach(function (k) { x[k] = changes[k]; }); found = true; } });
                    if (!found) { $('#account_msg').textContent = 'Your saved account was not found. Please log in again.'; return; }
                    S.set('sh_users', users);
                    var orders = orderList(); orders.forEach(function (o) { if (norm(o.name) === norm(oldName)) o.name = newName; }); S.set('sh_orders', orders);
                    var oldKey = 'sh_wish_' + norm(oldName), newKey = 'sh_wish_' + norm(newName), oldWish = S.get(oldKey, null);
                    if (oldWish) { S.set(newKey, oldWish); try { localStorage.removeItem(oldKey); } catch (x) {} }
                }
                user.name = newName; S.set('sh_user', user);
                $('#account_msg').textContent = 'Account information saved.';
            });
        }
    }

    /* ---------------- Password recovery ---------------- */
    var forgotForm = $('#forgot_form');
    if (forgotForm) forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('#reset_name').value.trim(), age = $('#reset_age').value.trim(), email = $('#reset_email').value.trim().toLowerCase();
        var password = $('#reset_password').value, confirmPassword = $('#reset_confirm').value, msg = $('#forgot_msg');
        if (password.length < 6 || password !== confirmPassword) { msg.textContent = password !== confirmPassword ? 'Passwords do not match.' : 'Password must have at least 6 characters.'; return; }
        var users = S.get('sh_users', []), index = -1;
        users.forEach(function (x, i) { if (norm(x.name) === norm(name) && String(x.age) === String(age) && String(x.email || '').toLowerCase() === email) index = i; });
        if (index >= 0) { users[index].pw = password; S.set('sh_users', users); }
        else {
            var ap = S.get('sh_admin_profile', {});
            if (ap.name && norm(ap.name) === norm(name) && String(ap.age) === String(age) && String(ap.email || '').toLowerCase() === email) S.set('sh_admin_password', password);
            else { msg.textContent = 'The information does not match a saved account.'; return; }
        }
        try { sessionStorage.setItem('sh_flash', 'Password updated. Please log in again.'); } catch (x) {}
        location.href = 'login.html';
    });

    /* ---------------- Refund request ---------------- */
    var refundForm = $('#refund_form');
    if (refundForm) {
        if (!user) { location.href = 'login.html'; }
        else {
            var orderId = params().get('order'), itemIndex = +params().get('item'), refundOrder = orderList().filter(function (o) { return String(o.id) === String(orderId) && norm(o.name) === norm(user.name) && o.status !== 'Cancelled' && o.status !== 'Returned'; })[0];
            var refundItem = refundOrder && refundOrder.items[itemIndex];
            if (!refundItem) { $('#refund_item').textContent = 'Order item was not found.'; $('#refund_form button[type="submit"]').disabled = true; }
            else $('#refund_item').textContent = 'Order #' + refundOrder.id + ' · ' + refundItem.name;
            refundForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var files = $('#refund_evidence').files, rawReason = $('#refund_reason').value, details = $('#refund_details').value.trim(), msg = $('#refund_msg');
                [$('#refund_reason'), $('#refund_details'), $('#refund_prev')].forEach(function (el) { if (el) el.classList.remove('invalid'); });
                msg.textContent = '';

                if (!refundItem) { msg.textContent = 'Order item was not found.'; return; }
                if (!rawReason) { $('#refund_reason').classList.add('invalid'); msg.textContent = 'Please choose a reason.'; $('#refund_reason').focus(); return; }
                if (!details) { $('#refund_details').classList.add('invalid'); msg.textContent = 'Please enter extra details or your reason.'; $('#refund_details').focus(); return; }
                if (!files || !files.length) { $('#refund_prev').classList.add('invalid'); msg.textContent = 'Please attach at least one picture or video.'; return; }

                var reason = rawReason === 'Write my own reason' ? details : rawReason;
                var evidence = [];
                for (var i = 0; i < files.length; i++) {
                    if (!(/^image\//.test(files[i].type) || /^video\//.test(files[i].type))) { msg.textContent = 'Evidence must be a picture or video.'; return; }
                }

                var saveRequests = function () {
                    var requests = S.get('sh_refunds', []);
                    var reqId = 'rf' + Date.now();
                    requests.push({ id: reqId, orderId: refundOrder.id, itemIndex: itemIndex, product: refundItem.name, userName: user.name,
                        reason: reason, details: details, evidence: evidence, status: 'Requested', date: new Date().toISOString() });
                    S.set('sh_refunds', requests);
                    if (!S.get('sh_refunds', []).some(function (x) { return x.id === reqId; })) {
                        msg.textContent = 'The evidence file is too large to save. Please choose a smaller picture or video and try again.';
                        return;
                    }
                    try { sessionStorage.setItem('sh_flash', 'Refund request submitted.'); } catch (x) {}
                    location.href = 'my_orders.html';
                };

                var remaining = files.length;
                Array.prototype.forEach.call(files, function (file) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        if (/^image\//.test(file.type)) {
                            var img = new Image();
                            img.onload = function () {
                                var max = 800, s = Math.min(1, max / Math.max(img.width, img.height));
                                var cv = document.createElement('canvas');
                                cv.width = Math.round(img.width * s);
                                cv.height = Math.round(img.height * s);
                                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                                evidence.push({ name: file.name, type: 'image/webp', data: cv.toDataURL('image/webp', 0.8) });
                                remaining--;
                                if (!remaining) saveRequests();
                            };
                            img.onerror = function () {
                                evidence.push({ name: file.name, type: file.type, data: reader.result });
                                remaining--;
                                if (!remaining) saveRequests();
                            };
                            img.src = reader.result;
                        } else {
                            evidence.push({ name: file.name, type: file.type, data: reader.result });
                            remaining--;
                            if (!remaining) saveRequests();
                        }
                    };
                    reader.onerror = function () { msg.textContent = 'Could not read the selected evidence file.'; };
                    reader.readAsDataURL(file);
                });
            });
        }
    }
})();