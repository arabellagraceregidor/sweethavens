/* admin.js - ADMIN ONLY: Dashboard (sales graphs, pie charts, inventory, add product) and Order Management */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, esc = SH.esc, fmt = SH.fmt, BASE = SH.CATALOG;
    var u = SH.user();
    var main = $('.admin_cont');
    if (!u || u.role !== 'admin') {
        if (main) main.style.display = 'none';
        SH.toast('ADMIN ONLY - please log in as admin');
        setTimeout(function () { location.href = 'login.html'; }, 1100);
        return;
    }
    var LOW = 10, STATUS = ['Pending', 'Preparing', 'Ready', 'Completed', 'Returned', 'Cancelled'], DAY = 864e5;
    var PALETTE = ['#93494A', '#E08EAA', '#F4C2D6', '#A15D24', '#75672C', '#CEA386', '#554C4E'];
    var STATUS_COLOR = { Pending: '#E08EAA', Preparing: '#A15D24', Ready: '#75672C', Completed: '#93494A', Returned: '#CEA386', Cancelled: '#554C4E' };
    var cat = function () { return SH.catalog(); };

    /* sample data so the admin pages are not empty (real orders from checkout are added to it) */
    function seed(force) {
        if (!force && S.get('sh_seeded', 0)) return;
        /* a reset uses a fresh seed so the restored sample data is visibly different */
        var s = force ? (Date.now() % 233280) + 7 : 7, rnd = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        var total = force ? 20 + (Date.now() % 7) : 26;
        var names = ['Ana Cruz', 'Ben Reyes', 'Carla Santos', 'Dino Lim', 'Ella Tan', 'Faye Ramos', 'Gio Diaz', 'Hana Co', 'Ivan Uy', 'Jade Ong'];
        var keep = S.get('sh_orders', []).filter(function (o) { return !o.sample; }), made = [];
        for (var i = 0; i < total; i++) {
            var items = [], n = 1 + Math.floor(rnd() * 3);
            for (var k = 0; k < n; k++) {
                var p = BASE[Math.floor(rnd() * BASE.length)];
                if (!items.some(function (x) { return x.name === p.n; })) items.push({ name: p.n, qty: 1 + Math.floor(rnd() * 3), price: p.p });
            }
            var sub = items.reduce(function (a, x) { return a + x.qty * x.price; }, 0), mode = rnd() > .35 ? 'Delivery' : 'Pick Up', fee = mode === 'Delivery' ? 50 : 0;
            var id = ''; for (var j = 0; j < 7; j++) id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(rnd() * 26)];
            made.push({ id: id, name: names[Math.floor(rnd() * names.length)], mode: mode, addr: mode === 'Delivery' ? 'Manila, 1000 Metro Manila' : 'Pick up at the shop',
                pay: ['Cash on Delivery', 'Credit/Debit Card', 'GCash'][Math.floor(rnd() * 3)], items: items, sub: sub, fee: fee, total: sub + fee,
                status: i < 2 ? 'Pending' : i < 4 ? 'Preparing' : i === 4 ? 'Ready' : (i === 9 || i === 17) ? 'Cancelled' : 'Completed',
                cancelledBy: i === 9 ? 'customer' : i === 17 ? 'owner' : '', cancelReason: i === 9 ? 'Changed my mind' : i === 17 ? 'Ingredient supply ran out' : '',
                date: new Date(Date.now() - Math.floor(i / 1.9) * DAY - i * 2.3e6).toISOString(), sample: true });
        }
        S.set('sh_orders', keep.concat(made));
        var st = SH.stock(); BASE.forEach(function (c) { st[c.n] = c.s; });
        st['Matcha Melties'] = 9; st['Choco Crinkles'] = 0; st['Chocolate Chip'] = 26; st['Biscoff Choco Crunch'] = 18;
        SH.saveStock(st); S.set('sh_seeded', 1);
        return made.length;
    }
    seed(false);

    var orders = function () { return S.get('sh_orders', []); };
    var live = function () { return orders().filter(function (o) { return o.status !== 'Cancelled' && o.status !== 'Returned'; }); };
    var dstr = function (iso) { var d = new Date(iso); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); };
    var lvl = function (q) { return q <= 0 ? 'out' : q < LOW ? 'low' : 'ok'; };
    var lvlText = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };

    /* ---------- tiny SVG chart helpers (no libraries) ---------- */
    function pie(data) {
        var tot = data.reduce(function (a, d) { return a + d.v; }, 0);
        if (!tot) return '<p class="empty">No data yet.</p>';
        var C = 2 * Math.PI * 25, off = 0;
        var segs = data.filter(function (d) { return d.v > 0; }).map(function (d) {
            var len = d.v / tot * C, pct = Math.round(d.v / tot * 100);
            var c = '<circle r="25" cx="60" cy="60" fill="none" stroke="' + d.c + '" stroke-width="50" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
                '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"><title>' + esc(d.l) + ': ' + esc(d.t) + ' (' + pct + '%)</title></circle>';
            off += len; return c;
        }).join('');
        var legend = data.map(function (d) { return '<div><i style="background:' + d.c + '"></i><span>' + esc(d.l) + '</span><b>' + Math.round(d.v / tot * 100) + '%</b></div>'; }).join('');
        return '<div class="pie_wrap"><svg viewBox="0 0 120 120" role="img">' + segs + '</svg><div class="legend">' + legend + '</div></div>';
    }
    function line(days) {
        var W = 600, H = 230, L = 48, R = 14, T = 16, B = 34, mx = Math.max.apply(null, days.map(function (d) { return d.v; }).concat([100]));
        mx = Math.ceil(mx / 100) * 100;
        var x = function (i) { return L + i * (W - L - R) / (days.length - 1); }, y = function (v) { return T + (H - T - B) * (1 - v / mx); };
        var grid = '', k;
        for (k = 0; k <= 4; k++) { var gv = mx / 4 * k; grid += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(gv) + '" y2="' + y(gv) + '"/><text x="' + (L - 8) + '" y="' + (y(gv) + 4) + '" text-anchor="end">\u20B1' + Math.round(gv) + '</text>'; }
        var pts = days.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.v).toFixed(1); });
        var area = 'M' + x(0) + ',' + y(0) + ' L' + pts.join(' L') + ' L' + x(days.length - 1) + ',' + y(0) + ' Z';
        var labels = days.map(function (d, i) { return (i % 2 === 0 || days.length < 8) ? '<text x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + d.l + '</text>' : ''; }).join('');
        var dots = days.map(function (d, i) { return '<circle class="dot" cx="' + x(i) + '" cy="' + y(d.v) + '" r="4"><title>' + d.l + ': ' + fmt(d.v) + '</title></circle>'; }).join('');
        return '<svg class="line_svg" viewBox="0 0 ' + W + ' ' + H + '" role="img"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E08EAA" stop-opacity=".55"/><stop offset="1" stop-color="#F4C2D6" stop-opacity="0"/></linearGradient></defs>' +
            grid + '<path d="' + area + '" fill="url(#ag)"/><polyline class="ln" points="' + pts.join(' ') + '"/>' + dots + labels + '</svg>';
    }
    function dayList(n) {
        var days = [], L = live(), i;
        for (i = n - 1; i >= 0; i--) { var d = new Date(Date.now() - i * DAY); days.push({ k: d.toDateString(), l: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), w: d.toLocaleDateString('en-PH', { weekday: 'short' }), v: 0 }); }
        L.forEach(function (o) { var k = new Date(o.date).toDateString(); days.forEach(function (x) { if (x.k === k) x.v += o.total; }); });
        return days;
    }

/* ---------------- INVENTORY TABLE (inventory.html & dashboard.html) ---------------- */
    var drawInv = function () {
        if (!$('#inv')) return;
        var C = cat(), st = SH.stock();
        $('#inv').innerHTML = '<tr><th>Product</th><th>Price</th><th>In stock</th><th>Status</th><th>Adjust</th></tr>' + C.map(function (c) {
            var q = st[c.n], l = lvl(q), nm = esc(c.n);
            return '<tr><td>' + (c.img ? '<img class="thumb" src="' + esc(c.img) + '" alt="">' : '') + nm + '</td><td>' + fmt(c.p) + '</td><td><b>' + q + '</b></td><td><span class="pill_s ' + l + '">' + lvlText[l] + '</span></td>' +
                '<td><button class="mini" data-s="' + nm + '" data-d="-1">-</button><button class="mini" data-s="' + nm + '" data-d="1">+</button> <button class="mini wide" data-s="' + nm + '" data-d="10">Restock +10</button>' +
                (c.custom ? ' <button class="mini wide del" data-del="' + esc(c.id) + '">Remove</button>' : '') + '</td></tr>';
        }).join('');
    };

    if ($('#inv')) {
        drawInv();
        $('#inv').addEventListener('click', function (e) {
            var b = e.target.closest('[data-s]'), del = e.target.closest('[data-del]');
            if (b) {
                var st = SH.stock(), n = b.getAttribute('data-s');
                st[n] = Math.max(0, st[n] + +b.getAttribute('data-d'));
                SH.saveStock(st);
                drawInv();
                if (typeof drawDash === 'function' && $('#adminDash')) drawDash();
            }
            if (del) {
                var list = S.get('sh_products', []).filter(function (p) { return p.id !== del.getAttribute('data-del'); });
                S.set('sh_products', list);
                SH.toast('Product removed');
                drawInv();
                if (typeof drawDash === 'function' && $('#adminDash')) drawDash();
            }
        });
    }

    /* ---------------- DASHBOARD ---------------- */
    if ($('#adminDash')) {
        var photo = '';
        var drawDash = function () {
            var L = live(), total = L.reduce(function (a, o) { return a + o.total; }, 0), sold = 0, per = {}, rev = {}, pay = {};
            L.forEach(function (o) {
                pay[o.pay] = (pay[o.pay] || 0) + 1;
                o.items.forEach(function (i) { sold += i.qty; per[i.name] = (per[i.name] || 0) + i.qty; rev[i.name] = (rev[i.name] || 0) + i.qty * i.price; });
            });
            var C = cat(), st = SH.stock(), lowCount = C.filter(function (c) { return st[c.n] < LOW; }).length;
            var pend = orders().filter(function (o) { return o.status === 'Pending'; }).length;
            $('#stats').innerHTML = [['Total Sales', fmt(total)], ['Orders', L.length], ['Cookies Sold', sold], ['Pending Orders', pend]]
                .map(function (a) { return '<div class="stat"><span>' + a[0] + '</span><b>' + a[1] + '</b></div>'; }).join('') +
                '<div class="stat' + (lowCount ? ' warn' : '') + '"><span>Low / Out of Stock</span><b>' + lowCount + '</b></div>';

            var d7 = dayList(7), mx = Math.max.apply(null, d7.map(function (x) { return x.v; }).concat([1]));
            $('#bars').innerHTML = d7.map(function (x) { return '<div class="bar"><em>' + (x.v ? '\u20B1' + x.v : '') + '</em><i style="height:' + Math.round(x.v / mx * 150) + 'px"></i><small>' + x.w + '</small></div>'; }).join('');
            $('#line').innerHTML = line(dayList(14));

            var names = Object.keys(rev).sort(function (a, b) { return rev[b] - rev[a]; });
            $('#pie1').innerHTML = pie(names.map(function (n, i) { return { l: n, v: rev[n], t: fmt(rev[n]), c: PALETTE[i % PALETTE.length] }; }));
            $('#pie2').innerHTML = pie(STATUS.map(function (s) { var n = orders().filter(function (o) { return o.status === s; }).length; return { l: s, v: n, t: n + ' orders', c: STATUS_COLOR[s] }; }));
            $('#pie3').innerHTML = pie(Object.keys(pay).map(function (p, i) { return { l: p, v: pay[p], t: pay[p] + ' orders', c: PALETTE[(i * 2) % PALETTE.length] }; }));

            var top = Object.keys(per).sort(function (a, b) { return per[b] - per[a]; }), tm = per[top[0]] || 1;
            $('#top').innerHTML = top.length ? top.map(function (n) { return '<div class="top_row"><div><span>' + esc(n) + '</span><b>' + per[n] + '</b></div><div class="meter"><i style="width:' + Math.round(per[n] / tm * 100) + '%"></i></div></div>'; }).join('') : '<p class="empty">No sales yet.</p>';

            var smax = Math.max.apply(null, C.map(function (c) { return st[c.n]; }).concat([LOW * 3]));
            $('#stockbars').innerHTML = C.map(function (c) { var q = st[c.n], l = lvl(q); return '<div class="sbar"><span>' + esc(c.n) + '</span><div class="meter"><i class="' + l + '" style="width:' + Math.max(2, Math.round(q / smax * 100)) + '%"></i></div><b>' + q + '</b></div>'; }).join('');

            drawInv();

            var rec = orders().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 5);
            $('#recent').innerHTML = '<tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr>' + rec.map(function (o) {
                return '<tr><td>#' + esc(o.id) + '</td><td>' + esc(o.name) + '</td><td>' + dstr(o.date) + '</td><td>' + fmt(o.total) + '</td><td><span class="pill_s ' + o.status + '">' + o.status + '</span></td></tr>';
            }).join('');
        };

        drawDash();

        /* "Reset sample data": build a fresh set of sample orders and repaint the dashboard */
        var resetBtn = $('#reset');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            seed(true);
            drawDash();
            SH.toast('Sample data was reset.');
        });
    }

    /* ---------------- ORDER MANAGEMENT + REFUND / RETURN APPROVALS ---------------- */
    if ($('#adminOrders')) {
        var filter = 'All', q = '';
        var FILTERS = ['All', 'Pending', 'Preparing', 'Ready', 'Completed', 'Returned', 'Cancelled', 'Cancelled by owner', 'Cancelled by customer'];
        var RF_CLASS = { Requested: 'Pending', Approved: 'ok', Rejected: 'Rejected' };
        var matchFilter = function (o, f) {
            if (f === 'All') return true;
            if (f === 'Cancelled by owner') return o.status === 'Cancelled' && o.cancelledBy === 'owner';
            if (f === 'Cancelled by customer') return o.status === 'Cancelled' && o.cancelledBy === 'customer';
            return o.status === f;
        };
        var cancelByText = function (o) {
            if (o.status !== 'Cancelled') return '';
            return o.cancelledBy === 'owner' ? 'by owner' : o.cancelledBy === 'customer' ? 'by customer' : '';
        };
        var findOrder = function (id) { return orders().filter(function (o) { return String(o.id) === String(id); })[0]; };
        var refundTotal = function (rf) {
            var o = findOrder(rf.orderId);
            if (!o) return 0;
            if (rf.itemIndex != null && o.items && o.items[rf.itemIndex]) return o.items[rf.itemIndex].price * o.items[rf.itemIndex].qty;
            return o.total;
        };

        var drawRefunds = function () {
            var host = $('#refunds');
            if (!host) return;
            var all = S.get('sh_refunds', []).slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
            host.innerHTML = '<tr><th>Order</th><th>Customer</th><th>Item</th><th>Reason</th><th>Refund</th><th>Evidence</th><th>Requested</th><th>Status</th></tr>' + (all.length ? all.map(function (rf) {
                var o = findOrder(rf.orderId), item = o && rf.itemIndex != null ? o.items[rf.itemIndex] : null;
                var shots = (rf.evidence || []).map(function (ev, i) {
                    return ev && /^image\//.test(ev.type || '') ? '<img class="rf_thumb" src="' + ev.data + '" alt="Refund evidence" data-shot="' + esc(rf.id) + '" data-i="' + i + '">' : '';
                }).join('') || '<span class="empty_note">No picture</span>';
                var act = rf.status === 'Requested'
                    ? '<button type="button" class="mini wide approve" data-rf="' + esc(rf.id) + '" data-do="approve">Approve</button><button type="button" class="mini wide reject" data-rf="' + esc(rf.id) + '" data-do="reject">Decline</button>'
                    : '<span class="pill_s ' + (RF_CLASS[rf.status] || '') + '">' + esc(rf.status) + '</span>';
                return '<tr><td><b>#' + esc(rf.orderId) + '</b>' + (rf.kind ? '<small class="rf_kind">' + esc(rf.kind) + '</small>' : '') + '</td><td>' + esc(rf.userName) + '</td><td class="rf_item">' + esc(rf.product) + (item ? '<small>Qty: ' + item.qty + '</small>' : '') +
                    '</td><td class="rf_reason">' + esc(rf.reason) + (rf.details ? '<small>' + esc(rf.details) + '</small>' : '') + (rf.reference ? '<small>Ref: ' + esc(rf.reference) + '</small>' : '') +
                    '</td><td><b>' + fmt(refundTotal(rf)) + '</b>' + (rf.method ? '<small class="rf_kind">' + esc(rf.method) + '</small>' : '') +
                    '</td><td>' + shots + '</td><td>' + dstr(rf.date) + '</td><td>' + act + '</td></tr>';
            }).join('') : '<tr><td colspan="8" class="empty">No refund or return requests yet.</td></tr>');
        };

        var decide = function (id, approve) {
            var reqs = S.get('sh_refunds', []), rf = reqs.filter(function (x) { return x.id === id; })[0];
            if (!rf || rf.status !== 'Requested') return;
            rf.status = approve ? 'Approved' : 'Rejected';
            rf.decidedAt = new Date().toISOString();
            var all = orders(), o = all.filter(function (x) { return String(x.id) === String(rf.orderId); })[0], moved = false;
            if (o) {
                o.refundStatus = rf.status;
                if (!o.refund) o.refund = {};
                o.refund.status = rf.status;
                if (approve && o.status !== 'Cancelled') { o.status = 'Returned'; o.returnedAt = rf.decidedAt; moved = true; }
                S.set('sh_orders', all);
            }
            S.set('sh_refunds', reqs);
            SH.toast(approve
                ? (moved ? 'Refund approved. Order #' + rf.orderId + ' is now under Return.' : 'Refund approved. Order #' + rf.orderId + ' stays cancelled.')
                : 'Refund request for order #' + rf.orderId + ' was declined.');
            drawRefunds(); drawOrders();
        };

        /* ---------- CUSTOMER CANCELLATION REQUESTS: the owner approves or declines them ---------- */
        var requestedCancel = function (o) { return !!(o.cancelRequest && o.cancelRequest.status === 'Requested'); };
        var CR_CLASS = { Requested: 'Pending', Approved: 'ok', Declined: 'Rejected' };
        var drawCancels = function () {
            var host = $('#cancels');
            if (!host) return;
            var all = orders().filter(function (o) { return o.cancelRequest && o.cancelRequest.id; })
                .sort(function (a, b) { return new Date(b.cancelRequest.date) - new Date(a.cancelRequest.date); });
            host.innerHTML = '<tr><th>Order</th><th>Customer</th><th>Items</th><th>Reason</th><th>Total</th><th>Requested</th><th>Status</th></tr>' + (all.length ? all.map(function (o) {
                var cr = o.cancelRequest, act = cr.status === 'Requested'
                    ? '<button type="button" class="mini wide approve" data-cr="' + esc(o.id) + '" data-do="approve">Approve</button><button type="button" class="mini wide reject" data-cr="' + esc(o.id) + '" data-do="reject">Decline</button>'
                    : '<span class="pill_s ' + (CR_CLASS[cr.status] || '') + '">' + esc(cr.status) + '</span>';
                return '<tr><td><b>#' + esc(o.id) + '</b></td><td>' + esc(o.name) + '</td><td>' +
                    o.items.map(function (i) { return i.qty + 'x ' + esc(i.name); }).join('<br>') + '</td><td class="rf_reason">' + esc(cr.reason) +
                    (cr.needsRefund ? '<small>Refund requested' + (cr.reference ? ' &middot; Ref: ' + esc(cr.reference) : '') + '</small>' : '<small>No payment to refund</small>') +
                    '</td><td><b>' + fmt(o.total) + '</b></td><td>' + dstr(cr.date) + '</td><td>' + act + '</td></tr>';
            }).join('') : '<tr><td colspan="7" class="empty">No cancellation requests yet.</td></tr>');
        };

        var decideCancel = function (id, approve) {
            var all = orders(), o = all.filter(function (x) { return String(x.id) === String(id); })[0];
            if (!o || !requestedCancel(o)) return;
            var cr = o.cancelRequest, now = new Date().toISOString(), st = SH.stock();
            cr.decidedAt = now;
            if (approve) {
                cr.status = 'Approved';
                o.items.forEach(function (i) { st[i.name] = (st[i.name] || 0) + i.qty; });
                o.status = 'Cancelled';
                o.cancelledBy = 'customer';
                o.cancelReason = cr.reason;
                o.cancelDate = now;
                if (cr.needsRefund) {
                    var reqs = S.get('sh_refunds', []);
                    reqs.push({ id: cr.id, orderId: o.id, itemIndex: null, product: o.items.map(function (i) { return i.name; }).join(', '),
                        userName: o.name, reason: cr.reason, details: '', reference: cr.reference, method: cr.method, kind: 'Order cancellation',
                        evidence: cr.evidence || [], status: 'Approved', date: cr.date, decidedAt: now });
                    S.set('sh_refunds', reqs);
                    o.refundStatus = 'Approved';
                    o.refund = { id: cr.id, status: 'Approved', method: cr.method, reference: cr.reference, date: now };
                } else {
                    o.refundStatus = 'No refund';
                }
                SH.saveStock(st);
            } else {
                cr.status = 'Declined';
            }
            S.set('sh_orders', all);
            SH.toast(approve
                ? 'Cancellation approved. Order #' + o.id + ' is now cancelled.'
                : 'Cancellation request for order #' + o.id + ' was declined.');
            drawCancels(); drawRefunds(); drawOrders();
        };

        /* ---------- OWNER CANCELLATION: the reason is required and the customer sees it ---------- */
        var OWNER_REASONS = ['Out of stock', 'Store is closed at the chosen time', 'Cannot deliver to this address', 'Schedule change', 'Other reason'];
        var reasonBox = document.createElement('div');
        reasonBox.id = 'cancel_modal';
        reasonBox.innerHTML = '<div class="cc_card" role="dialog" aria-modal="true" aria-labelledby="oc_title">' +
            '<p class="cc_title" id="oc_title">Cancel this order?</p>' +
            '<p class="cc_sub" id="oc_sub"></p>' +
            '<p class="cc_pay">The customer sees the reason you choose here in My Orders.</p>' +
            '<label class="cc_label" for="oc_reason">Reason for cancelling</label>' +
            '<select class="cc_sel" id="oc_reason"><option value="">Choose one reason</option>' + OWNER_REASONS.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select>' +
            '<div id="oc_other_box" hidden><label class="cc_label" for="oc_other">Your reason</label>' +
            '<input class="cc_in" id="oc_other" maxlength="90" placeholder="Type your reason"></div>' +
            '<p class="cc_msg" id="oc_msg"></p>' +
            '<div class="cc_btns"><button type="button" class="cc_keep" id="oc_keep">Keep order</button>' +
            '<button type="button" class="cc_go" id="oc_go">Cancel order</button></div></div>';
        document.body.appendChild(reasonBox);

        var ocOrder = null;
        var ocEl = function (id) { return reasonBox.querySelector('#' + id); };
        var ocSay = function (t, bad) { var m = ocEl('oc_msg'); m.textContent = t || ''; m.className = 'cc_msg' + (bad ? ' err' : ''); };
        var ocClose = function () { reasonBox.classList.remove('on'); ocOrder = null; };
        var openOwnerCancel = function (o) {
            ocOrder = o;
            ocEl('oc_sub').textContent = 'Order #' + SH.orderTagLabel(o) + ' - ' + o.name + ' - ' + o.mode;
            ocEl('oc_reason').value = ''; ocEl('oc_other').value = ''; ocEl('oc_other_box').hidden = true;
            ocEl('oc_reason').classList.remove('invalid'); ocEl('oc_other').classList.remove('invalid');
            ocSay('');
            reasonBox.classList.add('on');
            ocEl('oc_reason').focus();
        };
        ocEl('oc_reason').addEventListener('change', function () {
            ocEl('oc_reason').classList.remove('invalid');
            ocEl('oc_other_box').hidden = this.value !== 'Other reason';
            if (this.value !== 'Other reason') ocEl('oc_other').value = '';
            ocSay('');
        });
        ocEl('oc_other').addEventListener('input', function () { ocEl('oc_other').classList.remove('invalid'); });
        ocEl('oc_keep').addEventListener('click', function () { ocClose(); drawOrders(); });
        reasonBox.addEventListener('click', function (e) { if (e.target === reasonBox) { ocClose(); drawOrders(); } });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && reasonBox.classList.contains('on')) { ocClose(); drawOrders(); } });
        ocEl('oc_go').addEventListener('click', function () {
            if (!ocOrder) return;
            var reason = ocEl('oc_reason').value, other = ocEl('oc_other').value.trim();
            if (!reason) { ocEl('oc_reason').classList.add('invalid'); ocSay('Choose one reason for cancelling the order.', true); ocEl('oc_reason').focus(); return; }
            if (reason === 'Other reason' && !other) { ocEl('oc_other').classList.add('invalid'); ocSay('Type the reason you are cancelling this order.', true); ocEl('oc_other').focus(); return; }
            var all = orders(), o = all.filter(function (x) { return String(x.id) === String(ocOrder.id); })[0];
            if (!o) { ocClose(); drawOrders(); return; }
            var st = SH.stock();
            o.items.forEach(function (i) { st[i.name] = (st[i.name] || 0) + i.qty; });
            o.status = 'Cancelled';
            o.cancelledBy = 'owner';
            o.cancelReason = reason === 'Other reason' ? other : reason;
            o.cancelDate = new Date().toISOString();
            S.set('sh_orders', all); SH.saveStock(st);
            ocClose();
            SH.toast('Order #' + o.id + ' is cancelled. The customer can see the reason.');
            drawCancels(); drawRefunds(); drawOrders();
        });

        var drawOrders = function () {
            var all = orders().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
            $('#filters').innerHTML = FILTERS.map(function (s) {
                var n = all.filter(function (o) { return matchFilter(o, s); }).length;
                return '<button type="button" class="' + (s === filter ? 'on' : '') + '" data-f="' + esc(s) + '">' + s + ' (' + n + ')</button>';
            }).join('') + '<input id="q" placeholder="Search order # or customer" value="' + esc(q) + '">';
            var list = all.filter(function (o) { return matchFilter(o, filter) && (!q || (o.id + ' ' + o.name).toLowerCase().indexOf(q.toLowerCase()) > -1); });
            $('#ord').innerHTML = '<tr><th>Order</th><th>Customer</th><th>Items</th><th>Type</th><th>Payment</th><th>Total</th><th>Date</th><th>Rider Location</th><th>Status</th></tr>' + (list.length ? list.map(function (o) {
                var by = cancelByText(o);
                return '<tr><td><b>#' + esc(o.id) + '</b>' + (o.sample ? ' <small>(sample)</small>' : '') + '</td><td>' + esc(o.name) + '</td><td>' +
                    o.items.map(function (i) { return i.qty + 'x ' + esc(i.name); }).join('<br>') + '</td><td>' + esc(o.mode) + '</td><td>' + esc(o.pay) + '</td><td><b>' + fmt(o.total) + '</b></td><td>' + dstr(o.date) +
                    '</td><td><input type="text" class="rider_location" data-location="' + esc(o.id) + '" value="' + esc(o.riderLocation || '') + '" placeholder="Enter rider location"></td><td><select class="st" data-o="' + esc(o.id) + '">' + STATUS.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' + (by ? '<small class="st_by">' + by + '</small>' : '') + '</td></tr>';
            }).join('') : '<tr><td colspan="9" class="empty">No orders found.</td></tr>');
            var qi = $('#q'); qi.addEventListener('input', function () { q = qi.value; var p = qi.selectionStart; drawOrders(); var n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
        };

        $('#filters').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { filter = b.getAttribute('data-f'); drawOrders(); } });
        $('#ord').addEventListener('change', function (e) {
            var loc = e.target.closest('input[data-location]');
            if (loc) {
                var locOrders = orders(), locOrder = locOrders.filter(function (x) { return x.id === loc.getAttribute('data-location'); })[0];
                if (locOrder) { locOrder.riderLocation = loc.value.trim(); S.set('sh_orders', locOrders); SH.toast('Rider location updated.'); }
                return;
            }
            var sel = e.target.closest('select[data-o]'); if (!sel) return;
            var all = orders(), o = all.filter(function (x) { return x.id === sel.getAttribute('data-o'); })[0], st = SH.stock(), was = o.status, now = sel.value;
            if (now === 'Cancelled' && was !== 'Cancelled') {
                /* an owner cancellation needs a reason the customer can read; a pending request is approved instead */
                if (requestedCancel(o)) { decideCancel(o.id, true); return; }
                openOwnerCancel(o);
                return;
            }
            if (was === 'Cancelled' && now !== 'Cancelled') {
                o.items.forEach(function (i) { st[i.name] = Math.max(0, (st[i.name] || 0) - i.qty); });
                o.cancelledBy = '';
            }
            o.status = now;
            if (now === 'Completed' && was !== 'Completed') o.completedAt = new Date().toISOString();
            if (now === 'Completed' && /cash|cod/i.test(o.pay || '')) o.paid = true;
            if (now === 'Returned' && was !== 'Returned') o.returnedAt = new Date().toISOString();
            S.set('sh_orders', all); SH.saveStock(st); SH.toast('Order #' + o.id + ' is now ' + now); drawOrders();
        });

        var rfHost = $('#refunds');
        if (rfHost) rfHost.addEventListener('click', function (e) {
            var shot = e.target.closest('[data-shot]');
            if (shot) {
                var rf = S.get('sh_refunds', []).filter(function (x) { return x.id === shot.getAttribute('data-shot'); })[0];
                var ev = rf && rf.evidence && rf.evidence[+shot.getAttribute('data-i')];
                if (ev && ev.data) { $('#rf_img').src = ev.data; $('#rf_view').classList.add('on'); $('#rf_view').setAttribute('aria-hidden', 'false'); }
                return;
            }
            var b = e.target.closest('[data-rf]');
            if (b) decide(b.getAttribute('data-rf'), b.getAttribute('data-do') === 'approve');
        });
        var rfView = $('#rf_view');
        if (rfView) {
            rfView.addEventListener('click', function () { rfView.classList.remove('on'); rfView.setAttribute('aria-hidden', 'true'); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { rfView.classList.remove('on'); rfView.setAttribute('aria-hidden', 'true'); } });
        }
        var crHost = $('#cancels');
        if (crHost) crHost.addEventListener('click', function (e) {
            var b = e.target.closest('[data-cr]');
            if (b) decideCancel(b.getAttribute('data-cr'), b.getAttribute('data-do') === 'approve');
        });
        drawCancels();
        drawRefunds();
        drawOrders();
    }

    /* ---------------- CREATE PRODUCTS (add / modify / delete) ---------------- */
    if ($('#createProducts')) {
        var cpPhoto = '', epPhoto = '', editKey = null, editCustom = false;
        var cpMsg = function (m, bad) { var e = $('#cp_msg'); e.textContent = m; e.style.color = bad ? 'var(--err)' : 'var(--mar)'; };
        var epMsg = function (m, bad) { var e = $('#ep_msg'); e.textContent = m; e.style.color = bad ? 'var(--err)' : 'var(--mar)'; };
        var readImg = function (file, done, fail) {
            if (!file) return;
            if (!/^image\//.test(file.type)) { fail('Please choose an image file.'); return; }
            var r = new FileReader();
            r.onload = function () {
                var im = new Image();
                im.onload = function () {
                    var sc = Math.min(1, 600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
                    c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
                    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
                    done(c.toDataURL('image/webp', .85), file.name);
                };
                im.src = r.result;
            };
            r.readAsDataURL(file);
        };
        var clearAdd = function () {
            ['flavor', 'price', 'type', 'desc'].forEach(function (id) { $('#' + id).value = ''; });
            cpPhoto = ''; $('#cp_prev').style.backgroundImage = ''; $('#cp_fn').textContent = 'No photo selected'; $('#cp_file').value = '';
        };
        var closeEdit = function () {
            editKey = null; editCustom = false; epPhoto = '';
            $('#cp_editPanel').hidden = true; $('#ep_msg').textContent = '';
            $('#ep_price').value = ''; $('#ep_prev').style.backgroundImage = ''; $('#ep_fn').textContent = 'Keep current photo'; $('#ep_file').value = '';
        };
        var drawList = function () {
            var C = cat();
            $('#cp_list').innerHTML = '<tr><th>Product</th><th>Type</th><th>Price</th><th>Actions</th></tr>' + (C.length ? C.map(function (c) {
                var key = c.custom ? c.id : c.n;
                return '<tr><td>' + (c.img ? '<img class="thumb" src="' + esc(c.img) + '" alt="">' : '') + esc(c.n) +
                    '</td><td>' + esc(c.t || (c.custom ? 'Custom' : 'Catalog')) +
                    '</td><td>' + fmt(c.p) +
                    '</td><td><button type="button" class="mini wide" data-edit="' + esc(key) + '" data-custom="' + (c.custom ? '1' : '0') + '">Modify</button> ' +
                    '<button type="button" class="mini wide del" data-rm="' + esc(key) + '" data-custom="' + (c.custom ? '1' : '0') + '">Delete</button></td></tr>';
            }).join('') : '<tr><td colspan="4" class="empty">No products yet.</td></tr>');
        };

        $('#cp_pick').addEventListener('click', function () { $('#cp_file').click(); });
        $('#cp_file').addEventListener('change', function () {
            readImg(this.files[0], function (data, name) {
                cpPhoto = data; $('#cp_prev').style.backgroundImage = 'url(' + data + ')'; $('#cp_fn').textContent = name; cpMsg('');
            }, function (m) { cpMsg(m, 1); });
        });
        $('#cp_clear').addEventListener('click', function () {
            clearAdd();
            ['flavor', 'price'].forEach(function (id) { $('#' + id).classList.remove('invalid'); });
            cpMsg('');
            $('#flavor').focus();
        });
        $('#cp_save').addEventListener('click', function () {
            var nm = $('#flavor'), pr = $('#price'), bad = [];
            [nm, pr].forEach(function (i) { i.classList.remove('invalid'); });
            if (!nm.value.trim()) bad.push(nm);
            if (!(+pr.value > 0)) bad.push(pr);
            if (bad.length) { bad.forEach(function (i) { i.classList.add('invalid'); }); bad[0].focus(); cpMsg('Please fill in the flavor and price.', 1); return; }
            if (cat().some(function (c) { return SH.norm(c.n) === SH.norm(nm.value); })) { nm.classList.add('invalid'); cpMsg('That product already exists.', 1); return; }
            var list = S.get('sh_products', []);
            list.push({ id: 'p' + Date.now(), n: nm.value.trim(), p: +pr.value, s: 0, d: $('#desc').value.trim(), t: $('#type').value.trim(), img: cpPhoto });
            S.set('sh_products', list);
            var st = SH.stock(); st[nm.value.trim()] = 0; SH.saveStock(st);
            clearAdd(); cpMsg('Product added! It now shows on the home page.'); drawList();
        });

        $('#ep_pick').addEventListener('click', function () { $('#ep_file').click(); });
        $('#ep_file').addEventListener('change', function () {
            readImg(this.files[0], function (data, name) {
                epPhoto = data; $('#ep_prev').style.backgroundImage = 'url(' + data + ')'; $('#ep_fn').textContent = name; epMsg('');
            }, function (m) { epMsg(m, 1); });
        });
        $('#ep_cancel').addEventListener('click', closeEdit);
        $('#ep_save').addEventListener('click', function () {
            if (!editKey) return;
            var pr = $('#ep_price'); pr.classList.remove('invalid');
            if (!(+pr.value > 0)) { pr.classList.add('invalid'); epMsg('Enter a valid price.', 1); return; }
            if (editCustom) {
                var list = S.get('sh_products', []), p = list.filter(function (x) { return x.id === editKey; })[0];
                if (!p) { epMsg('Product not found.', 1); return; }
                p.p = +pr.value; if (epPhoto) p.img = epPhoto;
                S.set('sh_products', list);
            } else {
                var ed = S.get('sh_edits', {});
                ed[editKey] = ed[editKey] || {};
                ed[editKey].p = +pr.value;
                if (epPhoto) ed[editKey].img = epPhoto;
                S.set('sh_edits', ed);
            }
            SH.toast('Product updated'); closeEdit(); drawList();
        });

        $('#cp_list').addEventListener('click', function (e) {
            var mod = e.target.closest('[data-edit]'), rm = e.target.closest('[data-rm]');
            if (mod) {
                editKey = mod.getAttribute('data-edit');
                editCustom = mod.getAttribute('data-custom') === '1';
                epPhoto = '';
                var item = editCustom
                    ? S.get('sh_products', []).filter(function (x) { return x.id === editKey; })[0]
                    : cat().filter(function (x) { return x.n === editKey; })[0];
                if (!item) return;
                $('#cp_editName').textContent = 'Editing: ' + (item.n || editKey);
                $('#ep_price').value = item.p;
                $('#ep_prev').style.backgroundImage = item.img ? 'url(' + item.img + ')' : '';
                $('#ep_fn').textContent = item.img ? 'Current photo' : 'No photo yet';
                $('#ep_file').value = ''; $('#ep_msg').textContent = '';
                $('#cp_editPanel').hidden = false;
                $('#cp_editPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
if (rm) {
                var key = rm.getAttribute('data-rm'), isCustom = rm.getAttribute('data-custom') === '1';
                var targetItem = isCustom
                    ? S.get('sh_products', []).filter(function (p) { return p.id === key; })[0]
                    : cat().filter(function (c) { return c.n === key; })[0];
                var deletedName = targetItem ? targetItem.n : key;
                var currentStock = SH.stock()[deletedName] || 0;
                var batchCount = S.get('sh_batches', []).filter(function (b) {
                    return SH.norm(b.product) === SH.norm(deletedName);
                }).length;

                var delModal = $('#cp_del_modal');
                $('#cp_del_summary').innerHTML =
                    '<b>Product:</b> ' + esc(deletedName) + '<br>' +
                    '<b>Price:</b> ' + (targetItem ? fmt(targetItem.p) : '-') + '<br>' +
                    '<b>Current Stock:</b> ' + currentStock + ' pcs<br>' +
                    '<b>Logged Batches to Remove:</b> ' + batchCount + ' batch(es)';

                delModal.classList.add('open');

                $('#cp_del_cancel').onclick = function () {
                    delModal.classList.remove('open');
                };
                delModal.onclick = function (ev) {
                    if (ev.target === delModal) delModal.classList.remove('open');
                };
                $('#cp_del_confirm').onclick = function () {
                    delModal.classList.remove('open');

                    if (isCustom) {
                        S.set('sh_products', S.get('sh_products', []).filter(function (p) { return p.id !== key; }));
                    } else {
                        var ed = S.get('sh_edits', {});
                        ed[key] = ed[key] || {};
                        ed[key].deleted = true;
                        S.set('sh_edits', ed);
                    }

                    var remainingBatches = S.get('sh_batches', []).filter(function (b) {
                        return SH.norm(b.product) !== SH.norm(deletedName);
                    });
                    S.set('sh_batches', remainingBatches);

                    var st = SH.stock();
                    delete st[deletedName];
                    SH.saveStock(st);

                    if (editKey === key) closeEdit();
                    SH.toast('Product and its batches removed'); drawList();
                };
            }
        });
        drawList();
    }
})();