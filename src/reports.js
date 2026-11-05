const { get, msg } = require('./web');
const { page, table, rangeForm, dateRange } = require('./views');
const { esc, taka, BUCKETS, csv, today, fmtDT } = require('./lib');
const { BL } = require('./catalog');
const D = `(created_at AT TIME ZONE 'Asia/Dhaka')::date BETWEEN $1 AND $2`;

// Profit & loss for a date range. Profit is NOT cash: revenue recognised on delivery, COGS from average cost.
async function pnl(db, from, to) {
  const one = async (sql) => Object.values((await db.query(sql, [from, to])).rows[0])[0] || 0;
  const items = await one(`SELECT SUM(i.price*i.qty) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.delivered_date BETWEEN $1 AND $2`);
  const disc = await one(`SELECT SUM(discount) FROM orders WHERE delivered_date BETWEEN $1 AND $2`);
  const fees = await one(`SELECT SUM(delivery_fee) FROM orders WHERE delivered_date BETWEEN $1 AND $2`);
  const refunds = -(await one(`SELECT SUM(amount) FROM account_txns WHERE kind='refund' AND txn_date BETWEEN $1 AND $2`));
  const cogsOut = await one(`SELECT SUM(qty*unit_cost) FROM stock_movements WHERE mtype='sale' AND ${D}`);
  const cogsBack = await one(`SELECT SUM(qty*unit_cost) FROM stock_movements WHERE mtype='return' AND ${D}`);
  const wIn = await one(`SELECT SUM(qty*unit_cost) FROM stock_movements WHERE to_bucket='damaged' AND ${D}`);
  const wOut = await one(`SELECT SUM(qty*unit_cost) FROM stock_movements WHERE from_bucket='damaged' AND ${D}`);
  const exp = await one(`SELECT SUM(amount) FROM expenses WHERE edate BETWEEN $1 AND $2`);
  const pend = (await db.query(`SELECT COUNT(*)::int n FROM orders WHERE status IN('Dispatched','Delivered','Partially Returned') AND settled=false`)).rows[0].n;
  const net = items - disc - refunds, cogs = cogsOut - cogsBack, gross = net - cogs, writeoff = wIn - wOut;
  return { items, disc, fees, refunds, net, cogs, gross, exp, writeoff, fees_income: fees, nop: gross + fees - exp - writeoff, pending: pend };
}
const inventoryValue = async db => (await db.query(`SELECT b.bucket, SUM(b.qty)::int qty, SUM(b.qty*p.avg_cost) cost FROM stock_balances b JOIN products p ON p.id=b.product_id GROUP BY b.bucket`)).rows;

module.exports = app => {
  app.get('/health', async (req, res) => { try { await require('./db').query('SELECT 1'); res.json({ ok: true }); } catch { res.status(500).json({ ok: false }); } });
  app.get('/version', (req, res) => res.json({ app: 'bd-all-pro', version: require('../package.json').version }));

  app.get('/', get(async (req, db) => {
    const t = today(), p = await pnl(db, t, t), inv = await inventoryValue(db), by = Object.fromEntries(inv.map(i => [i.bucket, i]));
    const models = (await db.query('SELECT COUNT(*)::int n FROM products WHERE archived=false')).rows[0].n;
    const total = inv.reduce((a, i) => a + i.qty, 0);
    const rec = (await db.query(`SELECT COALESCE(SUM(cod_expected),0) v FROM orders WHERE status IN('Dispatched','Delivered','Partially Returned') AND settled=false`)).rows[0].v;
    const pay = (await db.query('SELECT COALESCE(SUM(total-paid-credit),0) v FROM purchases')).rows[0].v;
    const accs = (await db.query(`SELECT a.name, a.opening + COALESCE((SELECT SUM(amount) FROM account_txns t WHERE t.account_id=a.id),0) bal FROM financial_accounts a ORDER BY id`)).rows;
    const low = (await db.query(`SELECT p.id,p.name,p.min_stock, COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) good FROM products p WHERE archived=false AND min_stock>0
      AND COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) < min_stock`)).rows;
    const recent = (await db.query(`SELECT 'Order' k, order_no r, status s, odate d FROM orders UNION ALL SELECT 'Purchase','PUR-'||id,'',pdate FROM purchases UNION ALL SELECT 'Repair',ref,status,found_date FROM repairs ORDER BY d DESC LIMIT 8`)).rows;
    const card = (k, v, href) => `<a href="${href}" style="text-decoration:none;color:inherit"><div class=card><div class=k>${k}</div><div class=v>${v}</div></div></a>`;
    return page('Dashboard', `<div class=grid>${card('Product models', models, '/products')}${card('Physical units', total, '/stock')}${card('Saleable units', by.good?.qty || 0, '/stock')}
      ${card('Today sales (net)', taka(p.net), '/reports')}${card("Today expenses", taka(p.exp), '/expenses')}${card('Today gross profit', taka(p.gross), '/reports')}${card('Today net operating profit', taka(p.nop), '/reports')}
      ${card('Customer receivables (COD pending)', taka(rec), '/orders?status=Dispatched')}${card('Supplier payables', taka(pay), '/purchases')}</div>
      <div class=card><h3>Stock by condition (at cost)</h3>${table([['Condition', 'c'], ['Units', 'q'], ['Cost', 'v']], BUCKETS.map(b => ({ c: BL[b], q: by[b]?.qty || 0, v: taka(by[b]?.cost) })))}</div>
      <div class=card><h3>Account balances</h3>${table([['Account', 'name'], ['Recorded balance', 'bal']], accs.map(a => ({ ...a, bal: taka(a.bal) })))}</div>
      ${low.length ? `<div class=card><h3 class=warn>Low stock</h3>${table([['Product', 'name'], ['Good', 'good'], ['Min', 'min_stock']], low)}</div>` : ''}
      <div class=card><h3>Recent activity</h3>${table([['Type', 'k'], ['Ref', 'r'], ['Status', 's'], ['Date', 'd']], recent)}</div>
      ${p.pending ? `<p class=k>⚠ Figures are provisional: ${p.pending} order(s) have no courier settlement recorded yet.</p>` : ''}`, msg(req));
  }));

  app.get('/reports', get(async (req, db) => {
    const r = dateRange(req.query), p = await pnl(db, r.from, r.to);
    const rows = [['Gross item sales', p.items], ['− Discounts', -p.disc], ['− Refunds', -p.refunds], ['= Net sales', p.net], ['− COGS (average cost)', -p.cogs], ['= Gross profit', p.gross], ['+ Delivery fees charged', p.fees],
      ['− Operating expenses', -p.exp], ['− Inventory write-offs (damaged, at cost)', -p.writeoff], ['= Net operating profit', p.nop]].map(x => ({ line: x[0], amount: x[1].toFixed(2) }));
    if (req.query.csv) return { csv: csv([['Line', 'line'], ['Amount', 'amount']], rows), name: 'profit_loss' };
    const cash = (await db.query(`SELECT COALESCE(SUM(amount) FILTER (WHERE amount>0 AND kind NOT LIKE 'transfer%'),0) i, COALESCE(SUM(amount) FILTER (WHERE amount<0 AND kind NOT LIKE 'transfer%'),0) o FROM account_txns WHERE txn_date BETWEEN $1 AND $2`, [r.from, r.to])).rows[0];
    const inv = await inventoryValue(db), val = inv.filter(i => i.bucket !== 'damaged').reduce((a, i) => a + i.cost, 0);
    const daily = (await db.query(`SELECT o.delivered_date d, SUM(i.price*i.qty) sales, SUM(i.unit_cost*i.qty) cogs FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.delivered_date BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1 DESC`, [r.from, r.to])).rows;
    const aud = (await db.query('SELECT * FROM audit_log ORDER BY id DESC LIMIT 25')).rows.map(a => ({ ...a, created_at: fmtDT(a.created_at) }));
    return page('Reports', rangeForm(req.query, '/reports') + `${p.pending ? `<p class=warn>Provisional: ${p.pending} order(s) have unsettled COD/courier fees.</p>` : ''}
      <div class=card><h3>Profit & loss</h3>${table([['Line', 'line'], ['৳', 'amount']], rows)}<p class=k>Profit ≠ cash. Stock purchases are not expenses (they sit in inventory until sold).</p></div>
      <div class=card><h3>Cash flow (excludes transfers)</h3>Money in ${taka(cash.i)} · Money out ${taka(-cash.o)} · Net ${taka(cash.i + cash.o)}</div>
      <div class=card><h3>Inventory value (excl. damaged)</h3><b>${taka(val)}</b> · <a href="/stock">by condition</a></div>
      <div class=card><h3>Daily sales (delivered)</h3>${table([['Date', 'd'], ['Sales', 'sales'], ['COGS', 'cogs']], daily.map(x => ({ ...x, sales: taka(x.sales), cogs: taka(x.cogs) })))}</div>
      <div class=card><h3>Exports</h3><a class="btn gray" href="/products?csv=1">Products</a> <a class="btn gray" href="/stock?csv=1">Inventory</a> <a class="btn gray" href="/orders?csv=1&from=${r.from}&to=${r.to}">Orders</a>
      <a class="btn gray" href="/purchases?csv=1&from=${r.from}&to=${r.to}">Purchases</a> <a class="btn gray" href="/expenses?csv=1&from=${r.from}&to=${r.to}">Expenses</a> <a class="btn gray" href="/accounts?csv=1&from=${r.from}&to=${r.to}">Cashbook</a> <a class="btn gray" href="/repairs?csv=1">Repairs</a></div>
      <div class=card><h3>Audit log</h3>${table([['When', 'created_at'], ['Action', 'action'], ['Detail', 'detail']], aud)}</div>`, msg(req));
  }));
};
