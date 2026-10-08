/* admin.js - ADMIN ONLY: Dashboard (sales + inventory monitoring) and Order Management */
(function () {
    var SH = window.SH, S = SH.S, $ = SH.$, esc = SH.esc, fmt = SH.fmt, CAT = SH.CATALOG;
    var u = SH.user();
    var main = $('.admin_cont');
    if (!u || u.role !== 'admin') {
        if (main) main.style.display = 'none';
        SH.toast('ADMIN ONLY - please log in as admin');
        setTimeout(function () { location.href = 'login.html'; }, 1100);
        return;
    }
    var LOW = 10, STATUS = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
    var DAY = 864e5;

    /* sample data so the admin pages are not empty (real orders from checkout are added to it) */
    function seed(force) {
        if (!force && S.get('sh_seeded', 0)) return;
        var s = 7, rnd = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        var names = ['Ana Cruz', 'Ben Reyes', 'Carla Santos', 'Dino Lim', 'Ella Tan', 'Faye Ramos', 'Gio Diaz', 'Hana Co', 'Ivan Uy', 'Jade Ong'];
        var keep = S.get('sh_orders', []).filter(function (o) { return !o.sample; }), made = [];
        for (var i = 0; i < 18; i++) {
            var items = [], n = 1 + Math.floor(rnd() * 3);
            for (var k = 0; k < n; k++) {
                var p = CAT[Math.floor(rnd() * CAT.length)];
                if (!items.some(function (x) { return x.name === p.n; })) items.push({ name: p.n, qty: 1 + Math.floor(rnd() * 3), price: p.p });
            }
            var sub = items.reduce(function (a, x) { return a + x.qty * x.price; }, 0), mode = rnd() > .35 ? 'Delivery' : 'Pick Up', fee = mode === 'Delivery' ? 50 : 0;
            var id = ''; for (var j = 0; j < 7; j++) id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(rnd() * 26)];
            made.push({ id: id, name: names[Math.floor(rnd() * names.length)], mode: mode, addr: mode === 'Delivery' ? 'Manila, 1000 Metro Manila' : 'Pick up at the shop',
                pay: ['Cash on Delivery', 'Credit/Debit Card', 'PayPal'][Math.floor(rnd() * 3)], items: items, sub: sub, fee: fee, total: sub + fee,
                status: i < 2 ? 'Pending' : i < 4 ? 'Preparing' : i === 4 ? 'Ready' : i === 9 ? 'Cancelled' : 'Completed',
                date: new Date(Date.now() - Math.floor(i / 2.7) * DAY - i * 2.3e6).toISOString(), sample: true });
        }
        S.set('sh_orders', keep.concat(made));
        var st = {}; CAT.forEach(function (c) { st[c.n] = c.s; });
        st['Matcha Melties'] = 9; st['Choco Crinkles'] = 0; st['Chocolate Chip'] = 26; st['Biscoff Choco Crunch'] = 18;
        SH.saveStock(st); S.set('sh_seeded', 1);
    }
    seed(false);

    var orders = function () { return S.get('sh_orders', []); };
    var live = function () { return orders().filter(function (o) { return o.status !== 'Cancelled'; }); };
    var dstr = function (iso) { var d = new Date(iso); return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }); };
    var lvl = function (q) { return q <= 0 ? 'out' : q < LOW ? 'low' : 'ok'; };
    var lvlText = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };

    /* ---------------- DASHBOARD ---------------- */
    if ($('#adminDash')) {
        var drawDash = function () {
            var L = live(), total = L.reduce(function (a, o) { return a + o.total; }, 0), sold = 0, per = {};
            L.forEach(function (o) { o.items.forEach(function (i) { sold += i.qty; per[i.name] = (per[i.name] || 0) + i.qty; }); });
            var st = SH.stock(), lowCount = CAT.filter(function (c) { return st[c.n] < LOW; }).length;
            var pend = orders().filter(function (o) { return o.status === 'Pending'; }).length;
            $('#stats').innerHTML = [['Total Sales', fmt(total)], ['Orders', L.length], ['Cookies Sold', sold], ['Pending Orders', pend]]
                .map(function (a) { return '<div class="stat"><span>' + a[0] + '</span><b>' + a[1] + '</b></div>'; }).join('') +
                '<div class="stat' + (lowCount ? ' warn' : '') + '"><span>Low / Out of Stock</span><b>' + lowCount + '</b></div>';
            $('#stats').style.gridTemplateColumns = '';
            var days = [], i;
            for (i = 6; i >= 0; i--) { var d = new Date(Date.now() - i * DAY); days.push({ k: d.toDateString(), l: d.toLocaleDateString('en-PH', { weekday: 'short' }), v: 0 }); }
            L.forEach(function (o) { var k = new Date(o.date).toDateString(); days.forEach(function (x) { if (x.k === k) x.v += o.total; }); });
            var mx = Math.max.apply(null, days.map(function (x) { return x.v; }).concat([1]));
            $('#bars').innerHTML = days.map(function (x) { return '<div class="bar"><em>' + (x.v ? '\u20B1' + x.v : '') + '</em><i style="height:' + Math.round(x.v / mx * 150) + 'px"></i><small>' + x.l + '</small></div>'; }).join('');
            var top = Object.keys(per).sort(function (a, b) { return per[b] - per[a]; }), tm = per[top[0]] || 1;
            $('#top').innerHTML = top.length ? top.map(function (n) { return '<div class="top_row"><div><span>' + esc(n) + '</span><b>' + per[n] + '</b></div><div class="meter"><i style="width:' + Math.round(per[n] / tm * 100) + '%"></i></div></div>'; }).join('') : '<p class="empty">No sales yet.</p>';
            $('#inv').innerHTML = '<tr><th>Product</th><th>Price</th><th>In stock</th><th>Status</th><th>Adjust</th></tr>' + CAT.map(function (c) {
                var q = st[c.n], l = lvl(q);
                return '<tr><td>' + esc(c.n) + '</td><td>' + fmt(c.p) + '</td><td><b>' + q + '</b></td><td><span class="pill_s ' + l + '">' + lvlText[l] + '</span></td>' +
                    '<td><button class="mini" data-s="' + esc(c.n) + '" data-d="-1">-</button><button class="mini" data-s="' + esc(c.n) + '" data-d="1">+</button> <button class="mini wide" data-s="' + esc(c.n) + '" data-d="10">Restock +10</button></td></tr>';
            }).join('');
            var rec = orders().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 5);
            $('#recent').innerHTML = '<tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr>' + rec.map(function (o) {
                return '<tr><td>#' + esc(o.id) + '</td><td>' + esc(o.name) + '</td><td>' + dstr(o.date) + '</td><td>' + fmt(o.total) + '</td><td><span class="pill_s ' + o.status + '">' + o.status + '</span></td></tr>';
            }).join('');
        };
        $('#inv').addEventListener('click', function (e) {
            var b = e.target.closest('[data-s]'); if (!b) return;
            var st = SH.stock(); st[b.getAttribute('data-s')] = Math.max(0, st[b.getAttribute('data-s')] + +b.getAttribute('data-d'));
            SH.saveStock(st); drawDash();
        });
        $('#reset').addEventListener('click', function () { seed(true); drawDash(); SH.toast('Sample data reset'); });
        drawDash();
    }

    /* ---------------- ORDER MANAGEMENT ---------------- */
    if ($('#adminOrders')) {
        var filter = 'All', q = '';
        var drawOrders = function () {
            var all = orders().slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
            $('#filters').innerHTML = ['All'].concat(STATUS).map(function (s) {
                var n = s === 'All' ? all.length : all.filter(function (o) { return o.status === s; }).length;
                return '<button class="' + (s === filter ? 'on' : '') + '" data-f="' + s + '">' + s + ' (' + n + ')</button>';
            }).join('') + '<input id="q" placeholder="Search order # or customer" value="' + esc(q) + '">';
            var list = all.filter(function (o) { return (filter === 'All' || o.status === filter) && (!q || (o.id + ' ' + o.name).toLowerCase().indexOf(q.toLowerCase()) > -1); });
            $('#ord').innerHTML = '<tr><th>Order</th><th>Customer</th><th>Items</th><th>Type</th><th>Payment</th><th>Total</th><th>Date</th><th>Status</th></tr>' + (list.length ? list.map(function (o) {
                return '<tr><td><b>#' + esc(o.id) + '</b>' + (o.sample ? ' <small>(sample)</small>' : '') + '</td><td>' + esc(o.name) + '</td><td>' +
                    o.items.map(function (i) { return i.qty + 'x ' + esc(i.name); }).join('<br>') + '</td><td>' + esc(o.mode) + '</td><td>' + esc(o.pay) + '</td><td><b>' + fmt(o.total) + '</b></td><td>' + dstr(o.date) +
                    '</td><td><select class="st" data-o="' + esc(o.id) + '">' + STATUS.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>';
            }).join('') : '<tr><td colspan="8" class="empty">No orders found.</td></tr>');
            var qi = $('#q'); qi.addEventListener('input', function () { q = qi.value; var p = qi.selectionStart; drawOrders(); var n = $('#q'); n.focus(); n.setSelectionRange(p, p); });
        };
        $('#filters').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { filter = b.getAttribute('data-f'); drawOrders(); } });
        $('#ord').addEventListener('change', function (e) {
            var sel = e.target.closest('select[data-o]'); if (!sel) return;
            var all = orders(), o = all.filter(function (x) { return x.id === sel.getAttribute('data-o'); })[0], st = SH.stock(), was = o.status, now = sel.value;
            if (now === 'Cancelled' && was !== 'Cancelled') o.items.forEach(function (i) { st[i.name] += i.qty; });
            if (was === 'Cancelled' && now !== 'Cancelled') o.items.forEach(function (i) { st[i.name] = Math.max(0, st[i.name] - i.qty); });
            o.status = now; S.set('sh_orders', all); SH.saveStock(st); SH.toast('Order #' + o.id + ' is now ' + now); drawOrders();
        });
        drawOrders();
    }
})();