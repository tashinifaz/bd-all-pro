const { get, post, msg } = require('./web');
const { page, token, table, opts, rangeForm, dateRange, bn } = require('./views');
const { esc, taka, num, int, move, audit, accTxn, csv, today, fmtDT } = require('./lib');
const CATS = ['advertising', 'courier', 'packaging', 'repair', 'salary', 'website/hosting', 'payment fees', 'transport', 'other'];
const BK = { 'Needs Repair': 'needs_repair', 'Sent for Repair': 'under_repair', 'Awaiting Return-to-Stock Approval': 'awaiting_approval' };

async function addExpense(c, e) { // single place that books an expense + its cash movement (no duplicates)
  await c.query('INSERT INTO expenses(edate,category,amount,account_id,payee,note,ref) VALUES(COALESCE($1::date,CURRENT_DATE),$2,$3,$4,$5,$6,$7)', [e.date || null, e.category, e.amount, e.account_id, e.payee, e.note, e.ref]);
  await accTxn(c, e.account_id, 'expense', -e.amount, e.ref || 'EXP', e.category, e.date);
}
module.exports = app => {
  app.get('/expenses', get(async (req, db) => {
    const r = dateRange(req.query), cat = req.query.cat || '';
    const rows = (await db.query(`SELECT e.*, a.name account FROM expenses e LEFT JOIN financial_accounts a ON a.id=e.account_id WHERE edate BETWEEN $1 AND $2 AND ($3='' OR category=$3) ORDER BY edate DESC,id DESC`, [r.from, r.to, cat])).rows;
    const cols = [['Date', 'edate'], ['Category', 'category'], ['Amount', 'amount'], ['Account', 'account'], ['Payee', 'payee'], ['Ref', 'ref'], ['Note', 'note']];
    if (req.query.csv) return { csv: csv(cols, rows), name: 'expenses' };
    const accs = (await db.query('SELECT * FROM financial_accounts ORDER BY id')).rows, tot = rows.reduce((a, x) => a + x.amount, 0);
    return page('Expenses', rangeForm(req.query, '/expenses', `<div><label>Category</label><select name=cat><option value="">All</option>${CATS.map(x => `<option ${x === cat ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`) +
      `<div class=card><b>Total ${taka(tot)}</b>${table(cols, rows.map(x => ({ ...x, amount: taka(x.amount) })), [], { st: 1, empty: ['No expenses yet', 'এখনো কোনো খরচ নেই', '/expenses', 'expense', '+ Expense', 'খরচ যোগ করুন'] })}</div><div class=card><h3>Add expense</h3><form method=post action="/expenses">${token()}<div class=row>
      <div><label>Date</label><input type=date name=date value="${today()}"></div><div><label>Category</label><select name=category>${CATS.map(x => `<option>${x}</option>`).join('')}</select></div>
      <div><label>Amount</label><input type=number step=0.01 min=0.01 name=amount required></div><div><label>Paid from</label><select name=account_id>${opts(accs)}</select></div>
      <div><label>Payee</label><input name=payee></div><div><label>Note</label><input name=note></div></div><button>Save</button></form></div>`, msg(req));
  }));
  app.post('/expenses', post('/expenses', async (req, c) => {
    const b = req.body; await addExpense(c, { date: b.date, category: b.category, amount: num(b.amount), account_id: int(b.account_id), payee: b.payee, note: b.note, ref: 'EXP' });
    await audit(c, 'expense', `${b.category} ${b.amount}`); return { ok: 'Expense recorded' };
  }));

  app.get('/accounts', get(async (req, db) => {
    const r = dateRange(req.query), acc = req.query.acc || '';
    const bal = (await db.query(`SELECT a.*, a.opening + COALESCE((SELECT SUM(amount) FROM account_txns t WHERE t.account_id=a.id),0) balance FROM financial_accounts a ORDER BY id`)).rows;
    const tx = (await db.query(`SELECT t.*, a.name account FROM account_txns t JOIN financial_accounts a ON a.id=t.account_id WHERE txn_date BETWEEN $1 AND $2 AND ($3='' OR account_id::text=$3) ORDER BY txn_date DESC, t.id DESC`, [r.from, r.to, acc])).rows;
    const cols = [['Date', 'txn_date'], ['Account', 'account'], ['Type', 'kind'], ['Amount', 'amount'], ['Ref', 'ref'], ['Note', 'note']];
    if (req.query.csv) return { csv: csv(cols, tx), name: 'cashbook' };
    return page('Accounts & cashbook', `<div class=card><p class=k>Recorded balances only. Transfers are not income or expense.</p>${table([['Account', 'name'], ['Type', 'kind'], ['Balance', 'balance']], bal.map(b => ({ ...b, balance: taka(b.balance) })))}</div>` +
      rangeForm(req.query, '/accounts', `<div><label>Account</label><select name=acc><option value="">All</option>${opts(bal, 'id', 'name', acc)}</select></div>`) +
      `<div class=card>${table(cols, tx.map(x => ({ ...x, amount: taka(x.amount) })), [], { st: 1 })}</div>
      <div class=card id=transfer><h3>Transfer</h3><form method=post action="/accounts/transfer">${token()}<div class=row><div><label>From</label><select name=from>${opts(bal)}</select></div><div><label>To</label><select name=to>${opts(bal)}</select></div>
      <div><label>Amount</label><input type=number step=0.01 min=0.01 name=amount required></div><div><label>Date</label><input type=date name=date value="${today()}"></div></div><button>${bn('Transfer', 'টাকা সরান')}</button></form></div>
      <div class=card><h3>Add account</h3><form method=post action="/accounts">${token()}<div class=row><div><label>Name</label><input name=name required></div><div><label>Type</label><select name=kind><option>cash</option><option>bank</option><option>mfs</option></select></div>
      <div><label>Opening balance</label><input type=number step=0.01 name=opening value=0></div></div><button>Add</button></form></div>`, msg(req));
  }));
  app.post('/accounts', post('/accounts', async (req, c) => { await c.query('INSERT INTO financial_accounts(name,kind,opening) VALUES($1,$2,$3)', [req.body.name, req.body.kind, num(req.body.opening)]); return { ok: 'Account added' }; }));
  app.post('/accounts/transfer', post('/accounts', async (req, c) => {
    const a = num(req.body.amount), f = int(req.body.from), t = int(req.body.to); if (f === t || a <= 0) throw new Error('Choose two different accounts and a positive amount');
    await accTxn(c, f, 'transfer_out', -a, 'TRF', 'Transfer', req.body.date); await accTxn(c, t, 'transfer_in', a, 'TRF', 'Transfer', req.body.date); await audit(c, 'transfer', `${f}->${t} ${a}`); return { ok: 'Transferred' };
  }));

  app.get('/repairs', get(async (req, db) => {
    const st = req.query.status || '';
    const rows = (await db.query(`SELECT r.*, p.name pname, (CURRENT_DATE - r.found_date) age FROM repairs r JOIN products p ON p.id=r.product_id WHERE ($1='' OR r.status=$1) ORDER BY r.id DESC`, [st])).rows;
    const cols = [['Ref', 'ref'], ['Product', 'pname'], ['Qty', 'qty'], ['Fault', 'fault'], ['Shop', 'shop'], ['Status', 'status'], ['Age (days)', 'age'], ['Cost', 'cost']];
    if (req.query.csv) return { csv: csv(cols, rows), name: 'repairs' };
    const prods = (await db.query('SELECT id,sku,name FROM products WHERE archived=false ORDER BY name')).rows;
    return page('Repairs', `<a class="btn gray" href="?csv=1">CSV</a> ${['Needs Repair', 'Sent for Repair', 'Awaiting Return-to-Stock Approval'].map(s => `<a class="btn gray" href="?status=${encodeURIComponent(s)}">${s}</a>`).join(' ')}
      <div class=card>${table(cols, rows.map(r => ({ ...r, ref: `<a href="/repairs/${r.id}">${esc(r.ref)}</a>`, cost: taka(r.cost) })), ['ref'], { st: 1, empty: ['No repairs yet', 'এখনো কোনো মেরামত নেই', '/repairs', 'repair', '+ New repair', 'নতুন মেরামত'] })}</div>
      <div class=card><h3>New repair ticket</h3><form method=post action="/repairs">${token()}<div class=row><div><label>Product</label><select name=product_id>${opts(prods, 'id', p => p.sku + ' · ' + p.name)}</select></div>
      <div><label>Qty</label><input type=number min=1 name=qty value=1></div><div><label>Unit is currently in</label><select name=source><option value=good>Good stock</option><option value=needs_repair>Already in Needs-repair</option></select></div>
      <div><label>Serial/IMEI (optional)</label><input name=serial></div><div><label>Technician / shop</label><input name=shop></div><div><label>Warranty details</label><input name=warranty></div></div>
      <label>Fault</label><input name=fault required><button>Create ticket</button></form></div>`, msg(req));
  }));
  app.post('/repairs', post('/repairs', async (req, c) => {
    const b = req.body, qty = int(b.qty), pid = int(b.product_id); if (qty < 1) throw new Error('Invalid quantity');
    const p = (await c.query('SELECT avg_cost FROM products WHERE id=$1', [pid])).rows[0];
    const id = (await c.query(`INSERT INTO repairs(ref,product_id,qty,serial,fault,shop,warranty) VALUES('tmp'||random(),$1,$2,$3,$4,$5,$6) RETURNING id`, [pid, qty, b.serial, b.fault, b.shop, b.warranty])).rows[0].id;
    const ref = 'REP-' + String(id).padStart(5, '0'); await c.query('UPDATE repairs SET ref=$2 WHERE id=$1', [id, ref]);
    if (b.source === 'good') await move(c, pid, 'good', 'needs_repair', qty, 'repair_flag', ref, b.fault, p.avg_cost);
    else if (!(await c.query('SELECT 1 FROM stock_balances WHERE product_id=$1 AND bucket=$2 AND qty>=$3', [pid, 'needs_repair', qty])).rowCount) throw new Error('Not enough units in Needs-repair');
    if (b.serial) await c.query(`UPDATE product_serials SET status='repair',ref=$2,updated_at=now() WHERE serial=$1`, [b.serial.trim(), ref]);
    await audit(c, 'repair_create', ref); return { to: '/repairs/' + id, ok: 'Ticket created' };
  }));
  app.get('/repairs/:id', get(async (req, db) => {
    const r = (await db.query('SELECT r.*, p.name pname FROM repairs r JOIN products p ON p.id=r.product_id WHERE r.id=$1', [req.params.id])).rows[0]; if (!r) return page('Not found', '');
    const accs = (await db.query('SELECT * FROM financial_accounts ORDER BY id')).rows, id = r.id, S = r.status;
    const f = (act, inner, btn, cls = '') => `<div class="card noprint"><form method=post action="/repairs/${id}/${act}">${token()}${inner}<button class="${cls}">${btn}</button></form></div>`;
    return page(r.ref, `<div class=card><b>${esc(S)}</b> · ${esc(r.pname)} × ${r.qty} ${esc(r.serial)}<br>Fault: ${esc(r.fault)} · Shop: ${esc(r.shop)} · Warranty: ${esc(r.warranty)}<br>Found ${r.found_date} · Sent ${r.sent_date || '-'} · Expected ${r.expected_date || '-'} · Back ${r.actual_date || '-'} · Cost ${taka(r.cost)}</div>` +
      (S === 'Needs Repair' ? f('send', `<div class=row><div><label>Shop</label><input name=shop value="${esc(r.shop)}"></div><div><label>Sent date</label><input type=date name=date value="${today()}"></div><div><label>Expected back</label><input type=date name=expected></div></div>`, 'Send for repair') : '') +
      (S === 'Sent for Repair' ? f('complete', `<div class=row><div><label>Returned date</label><input type=date name=date value="${today()}"></div><div><label>Repair cost (0 if warranty)</label><input type=number step=0.01 min=0 name=cost value=0></div><div><label>Paid from</label><select name=account_id>${opts(accs)}</select></div></div>`, 'Repair completed → awaiting approval') : '') +
      (S === 'Awaiting Return-to-Stock Approval' ? f('approve', '', 'Approve → return to Good stock') : '') +
      (BK[S] ? f('damage', '<label>Note</label><input name=note>', 'Mark permanently damaged', 'red') : ''), msg(req));
  }));
  const rep = async (c, id) => (await c.query('SELECT r.*, p.avg_cost FROM repairs r JOIN products p ON p.id=r.product_id WHERE r.id=$1 FOR UPDATE', [id])).rows[0];
  const rb = req => '/repairs/' + req.params.id;
  app.post('/repairs/:id/send', post(rb, async (req, c) => {
    const r = await rep(c, req.params.id); if (r.status !== 'Needs Repair') throw new Error('Wrong status');
    await move(c, r.product_id, 'needs_repair', 'under_repair', r.qty, 'repair_send', r.ref, null, r.avg_cost);
    await c.query(`UPDATE repairs SET status='Sent for Repair',shop=$2,sent_date=$3,expected_date=$4 WHERE id=$1`, [r.id, req.body.shop, req.body.date || today(), req.body.expected || null]); return { ok: 'Sent for repair' };
  }));
  app.post('/repairs/:id/complete', post(rb, async (req, c) => {
    const r = await rep(c, req.params.id), cost = num(req.body.cost); if (r.status !== 'Sent for Repair') throw new Error('Wrong status');
    await move(c, r.product_id, 'under_repair', 'awaiting_approval', r.qty, 'repair_done', r.ref, null, r.avg_cost);
    if (cost > 0) await addExpense(c, { date: req.body.date, category: 'repair', amount: cost, account_id: int(req.body.account_id), payee: r.shop, note: 'Repair ' + r.ref, ref: r.ref });
    await c.query(`UPDATE repairs SET status='Awaiting Return-to-Stock Approval',actual_date=$2,cost=$3 WHERE id=$1`, [r.id, req.body.date || today(), cost]); return { ok: 'Awaiting your approval' };
  }));
  app.post('/repairs/:id/approve', post(rb, async (req, c) => {
    const r = await rep(c, req.params.id); if (r.status !== 'Awaiting Return-to-Stock Approval') throw new Error('Wrong status');
    await move(c, r.product_id, 'awaiting_approval', 'good', r.qty, 'repair_approved', r.ref, 'Owner approved', r.avg_cost);
    if (r.serial) await c.query(`UPDATE product_serials SET status='in_stock',updated_at=now() WHERE serial=$1`, [r.serial.trim()]);
    await c.query(`UPDATE repairs SET status='Returned to Good Stock' WHERE id=$1`, [r.id]); await audit(c, 'repair_approve', r.ref); return { ok: 'Back in saleable stock' };
  }));
  app.post('/repairs/:id/damage', post(rb, async (req, c) => {
    const r = await rep(c, req.params.id), from = BK[r.status]; if (!from) throw new Error('Wrong status');
    await move(c, r.product_id, from, 'damaged', r.qty, 'repair_fail', r.ref, req.body.note, r.avg_cost);
    if (r.serial) await c.query(`UPDATE product_serials SET status='damaged',updated_at=now() WHERE serial=$1`, [r.serial.trim()]);
    await c.query(`UPDATE repairs SET status='Permanently Damaged',note=$2 WHERE id=$1`, [r.id, req.body.note]); await audit(c, 'repair_damage', r.ref); return { ok: 'Marked damaged' };
  }));
};
