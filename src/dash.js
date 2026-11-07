// Dashboard (Phase 2): GET / (server-rendered), GET /api/dash, GET /api/dash/:card. All behind auth (registered after the auth gate).
// Definitions are reused from the old dashboard / reports.js: receivables, payables, low stock, account balance formulas are unchanged.
const { get, pool } = require('./web');
const { page, bn, icon } = require('./views');
const { esc, taka, today } = require('./lib');

// ---- date range (Asia/Dhaka via today()) ------------------------------------------------------------------
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const validDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
// r = today | week (last 7 days incl. today) | month (1st of this month .. today) | custom (+ from, to)
function range(q) {
  const t = today();
  if (q.r === 'custom' && validDay(q.from) && validDay(q.to)) return q.from <= q.to ? { r: 'custom', from: q.from, to: q.to } : { r: 'custom', from: q.to, to: q.from };
  if (q.r === 'week') return { r: 'week', from: addDays(t, -6), to: t };
  if (q.r === 'month') return { r: 'month', from: t.slice(0, 8) + '01', to: t };
  return { r: 'today', from: t, to: t };
}
const rlabel = rg => ({ today: 'Today · আজ', week: 'Last 7 days · ৭ দিন', month: 'This month · এই মাস' }[rg.r] || `${rg.from} → ${rg.to}`);
// last range choice is also kept in a cookie (set by app.js) so the first paint already shows it
function fromCookie(req) {
  try { const m = /(?:^|;\s*)bdap-range=([^;]*)/.exec(req.get('cookie') || ''); if (!m) return {}; const [r, from, to] = decodeURIComponent(m[1]).split('_'); return { r, from, to }; } catch (e) { return {}; }
}
const tk0 = n => '৳' + Math.round(Number(n) || 0).toLocaleString('en-IN'); // whole taka on cards; popups show exact amounts via taka()

// ---- SQL (definitions copied from the previous dashboard) -------------------------------------------------
const SOLD = `status NOT IN('Cancelled','Returned')`;
const RECV = `status IN('Dispatched','Delivered','Partially Returned') AND settled=false`;
const REP_OPEN = `status IN('Needs Repair','Sent for Repair','Awaiting Return-to-Stock Approval')`;
const LOW = `SELECT p.id,p.name,p.min_stock, COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) good FROM products p WHERE archived=false AND min_stock>0
  AND COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) < min_stock`;
const ACCS = `SELECT a.id, a.name, a.opening + COALESCE((SELECT SUM(amount) FROM account_txns t WHERE t.account_id=a.id),0) bal FROM financial_accounts a ORDER BY id`;
const allTime = () => `from=2000-01-01&to=${today()}`;
// "Pending progress" groups: [key, English, Bangla, unit, list URL]
const PROG = () => [
  ['dispatched', 'On delivery', 'ডেলিভারিতে', 'orders', `/orders?status=Dispatched&${allTime()}`],
  ['reserved', 'Reserved', 'রিজার্ভ', 'units', '/stock'],
  ['needs_repair', 'Needs repair', 'মেরামত দরকার', 'units', '/repairs?status=Needs%20Repair'],
  ['under_repair', 'Under repair', 'মেরামতে আছে', 'units', '/repairs?status=Sent%20for%20Repair'],
  ['awaiting_approval', 'Awaiting approval', 'অনুমোদনের অপেক্ষায়', 'units', '/repairs?status=Awaiting%20Return-to-Stock%20Approval'],
];
const progCounts = async db => {
  const disp = (await db.query(`SELECT COUNT(*)::int n FROM orders WHERE status='Dispatched'`)).rows[0].n;
  const b = Object.fromEntries((await db.query(`SELECT b.bucket, COALESCE(SUM(b.qty),0)::int q FROM stock_balances b JOIN products p ON p.id=b.product_id WHERE p.archived=false AND b.bucket IN('reserved','needs_repair','under_repair','awaiting_approval') GROUP BY b.bucket`)).rows.map(r => [r.bucket, r.q]));
  return { dispatched: disp, reserved: b.reserved || 0, needs_repair: b.needs_repair || 0, under_repair: b.under_repair || 0, awaiting_approval: b.awaiting_approval || 0 };
};

// ---- card values: one function feeds both the server-rendered page and /api/dash --------------------------
async function vals(db, rg) {
  const q = async (s, p) => (await db.query(s, p)).rows;
  const [o, accs, low, rep, sell, prog, rec, pay] = await Promise.all([
    q(`SELECT COUNT(*)::int n, COALESCE(SUM(total),0) s FROM orders WHERE odate BETWEEN $1 AND $2 AND ${SOLD}`, [rg.from, rg.to]),
    q(ACCS),
    q(`SELECT COUNT(*)::int n FROM (${LOW}) x`),
    q(`SELECT COUNT(*)::int n FROM repairs WHERE ${REP_OPEN}`),
    q(`SELECT COALESCE(SUM(qty),0)::int n FROM stock_balances b JOIN products p ON p.id=b.product_id WHERE b.bucket='good' AND p.archived=false`),
    progCounts(db),
    q(`SELECT COALESCE(SUM(cod_expected),0) v FROM orders WHERE ${RECV}`),
    q('SELECT COALESCE(SUM(total-paid-credit),0) v FROM purchases'),
  ]);
  const pt = Object.values(prog).reduce((a, n) => a + n, 0);
  const ps = PROG().filter(g => prog[g[0]]).slice(0, 2).map(g => `${prog[g[0]]} ${g[1].toLowerCase()}`).join(' · ');
  return {
    orders: { v: String(o[0].n), sub: tk0(o[0].s) },
    cash: { v: tk0(accs.reduce((a, r) => a + r.bal, 0)), sub: `${accs.length} accounts` },
    low: { v: String(low[0].n), sub: '' }, repairs: { v: String(rep[0].n), sub: '' }, sellable: { v: String(sell[0].n), sub: '' },
    progress: { v: String(pt), sub: ps }, recv: { v: tk0(rec[0].v), sub: '' }, pay: { v: tk0(pay[0].v), sub: '' },
  };
}

// ---- popup data: {title, bn, total, rows[{a,b,v,href}], viewAllUrl, actions[{href,en,bn,p}]} ------------------
async function detail(db, k, rg) {
  const q = async (s, p) => (await db.query(s, p)).rows, rq = `from=${rg.from}&to=${rg.to}`;
  const A = (href, en, b, p) => ({ href, en, bn: b, p: p ? 1 : 0, form: FORM[href] }); // form = pop-up form key (see forms.js), href stays as no-JS fallback
  switch (k) {
    case 'orders': {
      const s = (await q(`SELECT COUNT(*)::int n, COALESCE(SUM(total),0) s FROM orders WHERE odate BETWEEN $1 AND $2 AND ${SOLD}`, [rg.from, rg.to]))[0];
      const rows = (await q(`SELECT o.id,o.order_no,o.status,o.total,o.odate,c.name cname FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.odate BETWEEN $1 AND $2 AND o.${SOLD} ORDER BY o.id DESC LIMIT 10`, [rg.from, rg.to]))
        .map(r => ({ a: r.order_no, b: [r.cname, r.status].filter(Boolean).join(' · '), v: taka(r.total), href: '/orders/' + r.id }));
      return { title: 'Orders', bn: 'অর্ডার', total: `${s.n} orders · ${taka(s.s)}`, note: rlabel(rg), rows, viewAllUrl: `/orders?${rq}`, actions: [A('/orders', '+ New order', 'নতুন অর্ডার', 1)] };
    }
    case 'cash': {
      const accs = await q(ACCS);
      return { title: 'Cash balance', bn: 'নগদ ব্যালেন্স', total: taka(accs.reduce((a, r) => a + r.bal, 0)), rows: accs.map(r => ({ a: r.name, v: taka(r.bal), href: '/accounts' })), viewAllUrl: '/accounts', actions: [A('/expenses', '+ Expense', 'খরচ', 1)] };
    }
    case 'low': {
      const rows = await q(`${LOW} ORDER BY good, p.name LIMIT 10`), n = (await q(`SELECT COUNT(*)::int n FROM (${LOW}) x`))[0].n;
      return { title: 'Low stock', bn: 'কম স্টক', total: `${n} products`, rows: rows.map(r => ({ a: r.name, b: `Min ${r.min_stock}`, v: `${r.good} left`, href: '/products/' + r.id })), viewAllUrl: '/stock', actions: [A('/purchases', '+ Purchase', 'কেনাকাটা', 1)] };
    }
    case 'repairs': {
      const n = (await q(`SELECT COUNT(*)::int n FROM repairs WHERE ${REP_OPEN}`))[0].n;
      const rows = await q(`SELECT r.id,r.ref,r.status,p.name pname,(CURRENT_DATE - r.found_date) age FROM repairs r JOIN products p ON p.id=r.product_id WHERE r.${REP_OPEN} ORDER BY r.id DESC LIMIT 10`);
      return { title: 'Pending repairs', bn: 'মেরামত বাকি', total: `${n} tickets`, rows: rows.map(r => ({ a: `${r.ref} · ${r.pname}`, b: r.status, v: `${r.age ?? 0} d`, href: '/repairs/' + r.id })), viewAllUrl: '/repairs', actions: [A('/repairs', '+ New ticket', 'নতুন টিকিট', 1)] };
    }
    case 'sellable': {
      const n = (await q(`SELECT COALESCE(SUM(qty),0)::int n FROM stock_balances b JOIN products p ON p.id=b.product_id WHERE b.bucket='good' AND p.archived=false`))[0].n;
      const rows = await q(`SELECT p.id,p.name,b.qty FROM stock_balances b JOIN products p ON p.id=b.product_id WHERE b.bucket='good' AND b.qty>0 AND p.archived=false ORDER BY b.qty DESC, p.name LIMIT 10`);
      return { title: 'Sellable units', bn: 'বিক্রয়যোগ্য', total: `${n} units`, rows: rows.map(r => ({ a: r.name, v: String(r.qty), href: '/products/' + r.id })), viewAllUrl: '/stock', actions: [A('/products', '+ Add product', 'পণ্য যোগ', 1), A('/stock', 'Adjust stock', 'স্টক ঠিক করুন')] };
    }
    case 'progress': {
      const c = await progCounts(db), g = PROG();
      return { title: 'Pending progress', bn: 'চলমান কাজ', total: String(Object.values(c).reduce((a, n) => a + n, 0)), rows: g.map(x => ({ a: x[1], b: x[2] + ' · ' + x[3], v: String(c[x[0]]), href: x[4] })), viewAllUrl: g[0][4], actions: [A(g[0][4], 'Open on-delivery orders', 'ডেলিভারির অর্ডার', 1)] };
    }
    case 'recv': {
      const t = (await q(`SELECT COALESCE(SUM(cod_expected),0) v FROM orders WHERE ${RECV}`))[0];
      const rows = (await q(`SELECT o.id,o.order_no,o.status,o.cod_expected,c.name cname FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.${RECV} AND o.cod_expected>0 ORDER BY o.cod_expected DESC LIMIT 10`))
        .map(r => ({ a: r.order_no, b: [r.cname, r.status].filter(Boolean).join(' · '), v: taka(r.cod_expected), href: '/orders/' + r.id }));
      return { title: 'Dues to receive', bn: 'পাওনা', total: taka(t.v), note: 'Courier / COD not yet settled', rows, viewAllUrl: `/orders?${allTime()}`, actions: rows.length ? [A(rows[0].href, 'Open order to settle', 'নিষ্পত্তি করুন', 1)] : [] };
    }
    case 'pay': {
      const t = (await q('SELECT COALESCE(SUM(total-paid-credit),0) v FROM purchases'))[0];
      const rows = (await q(`SELECT pu.id, pu.invoice_no, to_char(pu.pdate,'YYYY-MM-DD') d, s.name sname, pu.total-pu.paid-pu.credit due FROM purchases pu LEFT JOIN suppliers s ON s.id=pu.supplier_id WHERE pu.total-pu.paid-pu.credit>0 ORDER BY due DESC LIMIT 10`))
        .map(r => ({ a: r.sname || 'Supplier', b: [r.invoice_no, r.d].filter(Boolean).join(' · '), v: taka(r.due), href: '/purchases/' + r.id }));
      return { title: 'Dues to pay', bn: 'দেনা', total: taka(t.v), note: 'Supplier balance not yet paid', rows, viewAllUrl: '/purchases', actions: rows.length ? [A(rows[0].href, 'Open purchase to pay', 'পরিশোধ করুন', 1)] : [] };
    }
  }
  return null;
}

// ---- HTML ---------------------------------------------------------------------------------------------------
const FORM = { '/orders': 'order', '/expenses': 'expense', '/purchases': 'purchase', '/products': 'product', '/stock': 'adjust', '/repairs': 'repair' };
const QA = [['/orders', '+ New order', 'নতুন অর্ডার', 1], ['/expenses', '+ Expense', 'খরচ'], ['/purchases', '+ Purchase', 'কেনাকাটা'], ['/products', '+ Add product', 'পণ্য যোগ'], ['/stock', 'Adjust stock', 'স্টক ঠিক করুন']];
// Quick actions: one place, reusable inside popups (Phase 3 turns these links into pop-up forms)
const quickActions = () => `<div class=qa>${QA.map(([h, en, b, p]) => `<a class="btn${p ? '' : ' gray'}" href="${h}" data-form="${FORM[h]}">${bn(en, b)}</a>`).join('')}</div>`;

const CARDS = [
  { k: 'orders', en: 'Orders', bn: 'অর্ডার', icon: 'orders', cls: 'hero w2', href: '/orders', range: 1 },
  { k: 'cash', en: 'Cash balance', bn: 'নগদ ব্যালেন্স', icon: 'wallet', cls: 'w2', href: '/accounts' },
  { k: 'low', en: 'Low stock', bn: 'কম স্টক', icon: 'alert', href: '/stock' },
  { k: 'repairs', en: 'Pending repairs', bn: 'মেরামত বাকি', icon: 'repairs', href: '/repairs' },
  { k: 'sellable', en: 'Sellable units', bn: 'বিক্রয়যোগ্য', icon: 'stock', href: '/stock' },
  { k: 'progress', en: 'Pending progress', bn: 'চলমান কাজ', icon: 'clock', href: '/orders?status=Dispatched' },
  { k: 'recv', en: 'Dues to receive', bn: 'পাওনা', icon: 'down', cls: 'd2', href: '/orders' },
  { k: 'pay', en: 'Dues to pay', bn: 'দেনা', icon: 'up', cls: 'd2', href: '/purchases' },
];
const cardHtml = (c, v, rg) => `<a class="card dc ${c.cls || ''}" href="${c.href}${c.range ? `?from=${rg.from}&to=${rg.to}` : c.k === 'recv' ? '?' + allTime() : c.k === 'progress' ? '&' + allTime() : ''}" data-card=${c.k} data-t="${esc(c.en)}" data-b="${esc(c.bn)}" aria-haspopup=dialog>
<div class=ch>${icon(c.icon)}<span class=nw${c.range ? ' id=rl' : ''}>${c.range ? esc(rlabel(rg)) : bn('Now', 'এখন')}</span></div>
<div class=ct>${bn(c.en, c.bn)}</div><div class=v>${esc(v.v)}</div><div class=cs>${esc(v.sub || '')}</div></a>`;

function dashHtml(name, rg, v) {
  const t = today(), dt = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const chip = (r, en, b) => `<button type=button data-r=${r} aria-pressed=${rg.r === r}>${bn(en, b)}</button>`;
  return `<div id=dash data-rg="${esc(JSON.stringify(rg))}"><div class=dh><h2>${bn('Hi, ' + name, 'স্বাগতম')}</h2><time datetime=${t}>${esc(((require('./views').me() || {}).biz ? require('./views').me().biz + ' · ' : '') + dt)}</time></div>
<div class=chips role=group aria-label="Date range">${chip('today', 'Today', 'আজ')}${chip('week', 'Week', 'সপ্তাহ')}${chip('month', 'Month', 'মাস')}${chip('custom', 'Custom', 'নিজে')}</div>
<div class=cust id=cust${rg.r === 'custom' ? '' : ' hidden'}><div><label for=rf>From</label><input type=date id=rf value="${rg.from}"></div><div><label for=rt>To</label><input type=date id=rt value="${rg.to}"></div>
<button type=button id=rapply>${bn('Apply', 'প্রয়োগ')}</button></div><div id=dmsg role=status></div>
<div class=dg>${CARDS.map(c => cardHtml(c, v[c.k], rg)).join('')}</div>
<h3 class=qh>${bn('Quick actions', 'দ্রুত কাজ')}</h3>${quickActions()}</div>`;
}

module.exports = app => {
  app.get('/', get(async (req, db) => {
    const rg = range(fromCookie(req)), name = req.user.username;
    return page('Dashboard', dashHtml(name, rg, await vals(db, rg)));
  }));
  app.get('/api/dash', async (req, res) => {
    try { const rg = range(req.query); res.set('Cache-Control', 'no-store').json({ ...rg, rl: rlabel(rg), cards: await vals(pool, rg) }); }
    catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
  });
  app.get('/api/dash/:card', async (req, res) => {
    try { const d = await detail(pool, req.params.card, range(req.query)); res.set('Cache-Control', 'no-store'); d ? res.json(d) : res.status(404).json({ error: 'unknown card' }); }
    catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
  });
};
module.exports.quickActions = quickActions;
