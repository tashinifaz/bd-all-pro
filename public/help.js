/* BD ALL PRO help (lazy): "?" page tips, first-time tour, Settings page behaviour. Loaded by app.js. Global: window.bdapHelp = {open, tour, auto}.
   OWNER: edit the wording in HELP and TOUR below. Each text is [English, Bangla]. Keep 2-4 short sentences per page. */
(function () {
  var d = document, root = d.documentElement;
  var HELP = {
    dashboard: { t: ['Dashboard', 'ড্যাশবোর্ড'], p: [
      ['This is your shop at a glance: sales, cash, stock, repairs and dues.', 'এক নজরে দোকানের বিক্রি, ক্যাশ, স্টক, মেরামত ও বাকি।'],
      ['Pick Today, Week or Month to change the numbers. Tap any card to see the details.', 'আজ, সপ্তাহ বা মাস বেছে নিন। বিস্তারিত দেখতে কার্ডে ট্যাপ করুন।'],
      ['Most common task: after a sale, tap + New order under Quick actions.', 'বিক্রি হলে "দ্রুত কাজ" থেকে + New order চাপুন।']] },
    orders: { t: ['Orders', 'অর্ডার'], p: [
      ['Every sale you made is listed here. Use the dates and Status to find an order.', 'আপনার সব বিক্রি এখানে। তারিখ ও অবস্থা দিয়ে অর্ডার খুঁজুন।'],
      ['Most common task: add a new order, then open it later to dispatch, deliver or return.', 'নতুন অর্ডার যোগ করুন, পরে খুলে পাঠান, ডেলিভারি বা ফেরত দিন।']] },
    order: { t: ['Order details', 'অর্ডারের বিবরণ'], p: [
      ['This page shows one order: items, customer, money and courier.', 'এক অর্ডারের পণ্য, কাস্টমার, টাকা ও কুরিয়ার।'],
      ['Use the buttons here to dispatch, mark delivered, settle COD money, or return items.', 'পাঠানো, ডেলিভারি, ক্যাশ অন ডেলিভারির টাকা মেটানো বা ফেরত এখান থেকে।']] },
    products: { t: ['Products', 'পণ্য'], p: [
      ['Your product list with price and stock. Search by name, code or serial, or tap Scan.', 'দাম ও স্টকসহ পণ্যের তালিকা। নাম, কোড বা সিরিয়াল দিয়ে খুঁজুন, বা স্ক্যান করুন।'],
      ['Most common task: add a new product, then buy stock for it from Purchases.', 'নতুন পণ্য যোগ করুন, তারপর কেনাকাটা থেকে স্টক তুলুন।']] },
    product: { t: ['Product details', 'পণ্যের বিবরণ'], p: [
      ['Stock of this product by condition (good, reserved, repair, damaged) and its units.', 'এই পণ্যের অবস্থা অনুযায়ী স্টক ও ইউনিট।'],
      ['You can edit the price, code or barcode here.', 'এখানে দাম, কোড বা বারকোড বদলাতে পারবেন।']] },
    purchases: { t: ['Purchases', 'কেনাকাটা'], p: [
      ['Stock you buy from suppliers. It adds to your stock and tracks what you still owe.', 'সরবরাহকারীর কাছ থেকে কেনা মাল। এতে স্টক বাড়ে ও কত বাকি আছে দেখা যায়।'],
      ['Most common task: tap + Purchase when new goods arrive.', 'নতুন মাল এলে + Purchase চাপুন।']] },
    purchase: { t: ['Purchase details', 'কেনার বিবরণ'], p: [
      ['One purchase: items, total, paid and due.', 'একটি কেনা: পণ্য, মোট, দেওয়া ও বাকি।'],
      ['Use Pay here when you pay the supplier something more.', 'সরবরাহকারীকে আরও টাকা দিলে এখানে লিখে রাখুন।']] },
    suppliers: { t: ['Suppliers', 'সরবরাহকারী'], p: [
      ['The people and shops you buy from, with how much you owe each.', 'যাদের কাছ থেকে কেনেন এবং প্রত্যেকের কাছে কত বাকি।']] },
    repairs: { t: ['Repairs', 'মেরামত'], p: [
      ['Items that are faulty, at the repair shop, or waiting to go back to stock.', 'খারাপ, মেরামতে থাকা বা স্টকে ফেরার অপেক্ষায় থাকা পণ্য।'],
      ['Most common task: open a repair ticket for a faulty unit, then update it when it comes back.', 'খারাপ পণ্যের জন্য টিকিট খুলুন, ফিরলে আপডেট করুন।']] },
    repair: { t: ['Repair details', 'মেরামতের বিবরণ'], p: [
      ['One repair: fault, shop, dates and cost.', 'একটি মেরামত: সমস্যা, দোকান, তারিখ ও খরচ।'],
      ['Use the buttons to send it out, receive it back, or return it to stock.', 'বাটন দিয়ে পাঠান, ফেরত নিন বা স্টকে ফেরান।']] },
    stock: { t: ['Stock', 'স্টক'], p: [
      ['How many units you have, split by condition: good, reserved, in repair, damaged.', 'অবস্থা অনুযায়ী কতগুলো আছে: ভালো, বুক করা, মেরামতে, নষ্ট।'],
      ['Most common task: tap Adjust stock if a count is wrong, and write a reason.', 'গণনা ভুল হলে Adjust stock চাপুন এবং কারণ লিখুন।']] },
    expenses: { t: ['Expenses', 'খরচ'], p: [
      ['Shop costs like rent, bills, salary and transport.', 'ভাড়া, বিল, বেতন ও যাতায়াতের মতো খরচ।'],
      ['Most common task: tap + Expense and choose the account you paid from.', '+ Expense চাপুন এবং কোন হিসাব থেকে দিলেন বেছে নিন।']] },
    accounts: { t: ['Accounts', 'হিসাব'], p: [
      ['Your cash, bKash, bank and other accounts with their balances.', 'ক্যাশ, বিকাশ, ব্যাংকসহ সব হিসাব ও ব্যালেন্স।'],
      ['Use Transfer to move money between your own accounts. It is not income or expense.', 'নিজের হিসাবগুলোর মধ্যে টাকা সরাতে Transfer ব্যবহার করুন। এটা আয় বা খরচ নয়।']] },
    reports: { t: ['Reports', 'রিপোর্ট'], p: [
      ['Profit and loss and other summaries for the dates you choose.', 'বেছে নেওয়া তারিখের লাভ-ক্ষতি ও অন্যান্য সারাংশ।'],
      ['Pick From and To, then tap Filter. Use CSV to download.', 'থেকে ও পর্যন্ত তারিখ দিয়ে Filter চাপুন। CSV দিয়ে ডাউনলোড করুন।']] },
    settings: { t: ['Settings', 'সেটিংস'], p: [
      ['Choose which pages appear in the phone menu, and in what order.', 'ফোনের মেনুতে কোন পেজ কোন ক্রমে থাকবে বেছে নিন।'],
      ['Change the theme, replay the tour, or change your business name.', 'থিম বদলান, ট্যুর আবার দেখুন বা দোকানের নাম বদলান।']] },
    other: { t: ['Help', 'সাহায্য'], p: [
      ['Use the menu to move between pages. Tap + buttons to add new records.', 'মেনু দিয়ে পেজ বদলান। নতুন কিছু যোগ করতে + বাটন চাপুন।']] }
  };
  // [title, text, selectors (first visible one is highlighted; none = centred card)]
  var TOUR = [
    [['Quick actions', 'দ্রুত কাজ'], ['Start here. Tap a button to add an order, expense, purchase or product.', 'এখান থেকে শুরু করুন। অর্ডার, খরচ, কেনাকাটা বা পণ্য যোগ করতে বাটন চাপুন।'], ['.qa']],
    [['Cards', 'কার্ড'], ['Each card is one quick number. Tap it to see details and open the full list.', 'প্রতিটি কার্ডে একটি হিসাব। বিস্তারিত দেখতে ও পুরো তালিকা খুলতে চাপুন।'], ['[data-card=orders]']],
    [['Menu', 'মেনু'], ['Move between pages here. On a phone, tap More for the other pages.', 'এখান থেকে পেজ বদলান। ফোনে বাকি পেজ দেখতে "আরও" চাপুন।'], ['.bar', '.side']],
    [['Scan', 'স্ক্যান'], ['Inside forms, tap Scan to read an IMEI or barcode with the camera. Typing always works too.', 'ফর্মে Scan চাপলে ক্যামেরায় আইএমইআই বা বারকোড পড়বে। হাতে লিখলেও চলবে।'], ['[data-scan]']],
    [['Help', 'সাহায্য'], ['Tap ? on any page for a short guide to that page.', 'যেকোনো পেজে ? চাপলে সেই পেজের ছোট নির্দেশনা পাবেন।'], ['.ph .hb', '.top .hb']],
    [['Settings', 'সেটিংস'], ['Choose your menu buttons, theme and business name. You can replay this tour there.', 'মেনু, থিম ও দোকানের নাম বদলান। ট্যুর আবার দেখতে পারবেন।'], ['.side a[href="/settings"]', '.bar a[href="/settings"]', '.bar [data-act=more]']]
  ];
  function el(t, c, x) { var e = d.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function line(par, cls, en, b) { var p = el('p', cls, en); if (b) { p.appendChild(el('br')); p.appendChild(el('small', 'bn', b)); } par.appendChild(p); return p; }
  function key() {
    var s = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (!s[0]) return 'dashboard';
    if (s[0] === 'stock') return 'stock';
    var k = s[0].replace(/s$/, ''); // orders/12 -> order
    return s.length > 1 && HELP[k] ? k : HELP[s[0]] ? s[0] : 'other';
  }
  // help.css is lazy too (the Settings page already links it in its HTML)
  function css(cb) {
    if (d.querySelector('link[href^="/help.css"]')) return cb();
    var l = el('link'), s = d.querySelector('script[data-cv]'); l.rel = 'stylesheet'; l.href = '/help.css?v=' + (s ? s.dataset.cv : ''); l.onload = l.onerror = cb; d.head.appendChild(l);
  }
  function open() {
    css(function () {
      var h = HELP[key()] || HELP.other, box = el('div', 'hp');
      h.p.forEach(function (x) { line(box, '', x[0], x[1]); });
      window.openSheet(h.t[0] + ' · ' + h.t[1], box);
    });
  }

  // ---- first-time tour (no library). Done flag: server (user_prefs 'tour') + localStorage fallback ----
  var tr = null;
  function vis(e) { return e && e.getClientRects().length > 0; }
  function find(sels) { for (var i = 0; i < sels.length; i++) { var l = d.querySelectorAll(sels[i]); for (var j = 0; j < l.length; j++) if (vis(l[j])) return l[j]; } return null; }
  function done() {
    try { localStorage.setItem('bdap-tour', '1'); } catch (e) {}
    try { fetch('/api/pref', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'k=tour&v=1' }); } catch (e) {}
    if (/[?&]tour=1/.test(location.search)) try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  function tour(force) {
    if (force && location.pathname !== '/') { location.href = '/?tour=1'; return; }
    if (tr) return; tr = 1;
    css(start);
    function start() {
    var i = 0, from = d.activeElement, w = el('div', 'tr'), hi = el('div', 'th'), c = el('div', 'tc'), steps = TOUR;
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-modal', 'true'); c.setAttribute('aria-label', 'Guided tour'); c.tabIndex = -1;
    w.appendChild(el('div', 'tb')); w.appendChild(hi); w.appendChild(c); d.body.appendChild(w); tr = w;
    function end() { w.remove(); tr = null; d.removeEventListener('keydown', key2); removeEventListener('resize', draw); done(); if (from && from.focus) try { from.focus(); } catch (e) {} }
    function key2(e) { if (e.key === 'Escape') end(); else if (e.key === 'Tab') { var b = c.querySelectorAll('button'); if (!c.contains(d.activeElement)) { e.preventDefault(); b[b.length - 1].focus(); } } }
    function draw() {
      var s = steps[i], t = find(s[2]), vw = innerWidth, vh = innerHeight, r;
      c.textContent = '';
      var hd = el('div', 'tn', (i + 1) + ' / ' + steps.length); c.appendChild(hd);
      var h = el('h4', '', s[0][0]); h.appendChild(document.createTextNode(' ')); h.appendChild(el('small', 'bn', s[0][1])); c.appendChild(h);
      line(c, '', s[1][0], s[1][1]);
      var a = el('div', 'ta'), sk = el('button', 'btn gray', 'Skip'), nx = el('button', '', i === steps.length - 1 ? 'Done' : 'Next');
      sk.type = nx.type = 'button'; sk.appendChild(el('small', 'bn', 'বাদ দিন')); nx.appendChild(el('small', 'bn', i === steps.length - 1 ? 'শেষ' : 'পরের'));
      sk.onclick = end; nx.onclick = function () { if (i === steps.length - 1) end(); else { i++; draw(); } };
      if (i < steps.length - 1) a.appendChild(sk); a.appendChild(nx); c.appendChild(a);
      if (t) { t.scrollIntoView({ block: 'center', inline: 'nearest' }); r = t.getBoundingClientRect(); }
      hi.className = t ? 'th' : 'th nt';
      var cw = c.offsetWidth, ch = c.offsetHeight, x, y;
      if (t) {
        hi.style.cssText = 'left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
        x = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
        if (r.bottom + 14 + ch < vh) y = r.bottom + 14; else if (r.top - 14 - ch > 0) y = r.top - 14 - ch;
        else if (r.right + 14 + cw < vw) { x = r.right + 14; y = Math.max(12, Math.min(r.top, vh - ch - 12)); } else y = Math.max(12, vh - ch - 12);
      } else { hi.style.cssText = ''; x = (vw - cw) / 2; y = Math.max(12, (vh - ch) / 2); }
      c.style.left = x + 'px'; c.style.top = y + 'px'; nx.focus({ preventScroll: true });
    }
    d.addEventListener('keydown', key2); addEventListener('resize', draw); draw();
    }
  }
  function auto() { if (/[?&]tour=1/.test(location.search) || (d.body.hasAttribute('data-first') && location.pathname === '/')) tour(); }

  // ---- Settings page: bottom-bar picker (max 4, reorder with arrows) + theme buttons ----
  function settings() {
    var ul = d.getElementById('barlist'); if (!ul) return;
    var cnt = d.getElementById('barcnt');
    function count() {
      var n = ul.querySelectorAll('input:checked').length;
      cnt.textContent = n + ' / 4 chosen · ' + n + ' / ৪টি বাছাই হয়েছে' + (n >= 4 ? ' (max · সর্বোচ্চ)' : '');
      [].forEach.call(ul.querySelectorAll('li[data-k]'), function (li) { li.classList.toggle('on', li.querySelector('input').checked); });
    }
    ul.addEventListener('change', function (e) {
      if (ul.querySelectorAll('input:checked').length > 4) { e.target.checked = false; cnt.textContent = 'Only 4 pages fit. Untick one first. · ৪টির বেশি হবে না, আগে একটি টিক তুলুন।'; return; }
      count();
    });
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mv]'); if (!b) return;
      var li = b.closest('li'), dir = +b.dataset.mv, o = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
      if (!o || !o.hasAttribute('data-k')) return;
      dir < 0 ? ul.insertBefore(li, o) : ul.insertBefore(o, li); b.focus();
    });
    count();
    var th = d.querySelectorAll('[data-th]');
    function mark() { var s = null; try { s = localStorage.getItem('bdap-theme'); } catch (e) {} s = s === 'light' || s === 'dark' ? s : 'auto'; [].forEach.call(th, function (b) { b.setAttribute('aria-pressed', String(b.dataset.th === s)); }); }
    [].forEach.call(th, function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.th;
        try { v === 'auto' ? localStorage.removeItem('bdap-theme') : localStorage.setItem('bdap-theme', v); } catch (e) {}
        if (v === 'auto') v = matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
        root.dataset.theme = v; var m = d.getElementById('tc'); if (m) m.content = v === 'light' ? '#e9eaec' : '#0e0e10'; mark();
      });
    });
    mark();
  }
  window.bdapHelp = { open: open, tour: tour, auto: auto };
  settings();
})();
