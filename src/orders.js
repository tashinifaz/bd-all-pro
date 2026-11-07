const { get, post, msg } = require('./web');
const { page, token, table, opts, rangeForm, dateRange } = require('./views');
const { esc, taka, num, int, arr, move, audit, accTxn, csv, today } = require('./lib');
const LINES = 5;
const serialsOf = t => (t || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
const setSerials = (c, list, status, ref) => Promise.all(list.map(s => c.query('UPDATE product_serials SET status=$2,ref=$3,updated_at=now() WHERE serial=$1', [s, status, ref])));
const ORDER_SERIALS = `SELECT serial FROM product_serials WHERE ref=$1 AND status=$2`;

module.exports = app => {
  app.get('/orders', get(async (req, db) => {
    const r = dateRange(req.query), st = req.query.status || '', s = (req.query.s || '').trim(), cr = (req.query.courier || '').trim();
    const rows = (await db.query(`SELECT o.*, c.name cname, c.phone FROM orders o LEFT JOIN customers c ON c.id=o.customer_id
      WHERE o.odate BETWEEN $1 AND $2 AND ($3='' OR o.status=$3) AND ($4='' OR c.phone ILIKE '%'||$4||'%' OR o.order_no ILIKE '%'||$4||'%' OR c.name ILIKE '%'||$4||'%')
      AND ($5='' OR o.courier ILIKE '%'||$5||'%') ORDER BY o.id DESC`, [r.from, r.to, st, s, cr])).rows;
    const cols = [['Order', 'order_no'], ['Date', 'odate'], ['Customer', 'cname'], ['Phone', 'phone'], ['Status', 'status'], ['Total', 'total'], ['COD expected', 'cod_expected'], ['Courier', 'courier'], ['Tracking', 'tracking'], ['Settled', 'settled']];
    if (req.query.csv) return { csv: csv(cols, rows), name: 'orders' };
    const prods = (await db.query(`SELECT p.id,p.sku,p.name,p.price,COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) good FROM products p WHERE archived=false ORDER BY name`)).rows;
    const accs = (await db.query('SELECT * FROM financial_accounts ORDER BY id')).rows;
    const list = rows.map(o => ({ ...o, order_no: `<a href="/orders/${o.id}">${esc(o.order_no)}</a>`, total: taka(o.total), cod_expected: taka(o.cod_expected), settled: o.settled ? 'Yes' : 'No' }));
    const statuses = ['Confirmed', 'Dispatched', 'Delivered', 'Cancelled', 'Partially Returned', 'Returned'];
    const line = Array.from({ length: LINES }, (_, i) => `<div class=row><div><label>Product ${i + 1}</label><select name=product_id><option value="">—</option>${opts(prods, 'id', p => `${p.sku} · ${p.name} (${p.good} avail)`)}</select></div>
      <div><label>Qty</label><input type=number min=0 name=qty></div><div><label>Price (blank = default)</label><input type=number step=0.01 min=0 name=price></div>
      <div><label>Serial/IMEI (tracked items)</label><textarea name=serials rows=1></textarea></div></div>`).join('');
    return page('Orders', rangeForm(req.query, '/orders', `<div><label>Status</label><select name=status><option value="">All</option>${statuses.map(x => `<option ${x === st ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label>Customer / phone / order no</label><input name=s value="${esc(s)}"></div><div><label>Courier</label><input name=courier value="${esc(cr)}"></div>`) +
      `<div class=card>${table(cols, list, ['order_no'], { st: 1, empty: ['No orders yet', 'এখনো কোনো অর্ডার নেই', '/orders', 'order', '+ New order', 'নতুন অর্ডার'] })}</div><div class=card><h3>New order</h3><form method=post action="/orders">${token()}<div class=row>
      <div><label>Customer name</label><input name=name required></div><div><label>Phone</label><input name=phone required></div><div><label>Address</label><input name=address></div>
      <div><label>Channel</label><select name=channel><option>WhatsApp</option><option>Facebook</option><option>Phone</option><option>Other</option></select></div><div><label>Date</label><input type=date name=odate value="${today()}"></div></div>${line}
      <div class=row><div><label>Discount</label><input type=number step=0.01 min=0 name=discount value=0></div><div><label>Delivery fee charged</label><input type=number step=0.01 min=0 name=delivery_fee value=0></div>
      <div><label>Advance received</label><input type=number step=0.01 min=0 name=advance value=0></div><div><label>Advance into</label><select name=account_id>${opts(accs)}</select></div></div>
      <label>Note</label><input name=note><button>Confirm order (reserves stock)</button></form></div>`, msg(req));
  }));

  app.post('/orders', post('/orders', async (req, c) => {
    const b = req.body, pids = arr(b.product_id), qs = arr(b.qty), ps = arr(b.price), ss = arr(b.serials);
    const lines = pids.map((p, i) => ({ pid: int(p), qty: int(qs[i]), price: ps[i], serials: serialsOf(ss[i]) })).filter(l => l.pid && l.qty > 0);
    if (!lines.length) throw new Error('Add at least one product line');
    let cu = (await c.query('SELECT id FROM customers WHERE phone=$1 AND name=$2 LIMIT 1', [b.phone, b.name])).rows[0];
    if (!cu) cu = (await c.query('INSERT INTO customers(name,phone,address) VALUES($1,$2,$3) RETURNING id', [b.name, b.phone, b.address])).rows[0];
    const o = (await c.query(`INSERT INTO orders(order_no,customer_id,odate,channel,discount,delivery_fee,advance,total,cod_expected,note) VALUES('tmp'||random(),$1,$2,$3,0,0,0,0,0,$4) RETURNING id`, [cu.id, b.odate || today(), b.channel, b.note])).rows[0].id;
    const no = 'ORD-' + String(o).padStart(5, '0'); let sub = 0;
    for (const l of lines) {
      const p = (await c.query('SELECT id,name,price,avg_cost,serialized FROM products WHERE id=$1 FOR UPDATE', [l.pid])).rows[0];
      const price = l.price === '' || l.price === undefined ? p.price : num(l.price); sub += price * l.qty;
      if (p.serialized) {
        if (new Set(l.serials).size !== l.qty) throw new Error(`${p.name}: enter exactly ${l.qty} unique serial/IMEI values`);
        for (const s of l.serials) { const r = await c.query(`UPDATE product_serials SET status='reserved',ref=$3,updated_at=now() WHERE serial=$1 AND product_id=$2 AND status='in_stock'`, [s, p.id, no]); if (!r.rowCount) throw new Error(`Serial ${s} is not in stock`); }
      }
      await move(c, p.id, 'good', 'reserved', l.qty, 'reserve', no, null, p.avg_cost); // fails if not enough saleable stock
      await c.query('INSERT INTO order_items(order_id,product_id,qty,price,unit_cost) VALUES($1,$2,$3,$4,$5)', [o, p.id, l.qty, price, p.avg_cost]);
    }
    const disc = num(b.discount), fee = num(b.delivery_fee), adv = num(b.advance), total = sub - disc + fee;
    if (total < 0 || adv < 0 || adv > total + 0.001) throw new Error('Check discount / advance amounts');
    await c.query('UPDATE orders SET order_no=$2,discount=$3,delivery_fee=$4,advance=$5,total=$6,cod_expected=$7 WHERE id=$1', [o, no, disc, fee, adv, total, total - adv]);
    if (adv > 0) await accTxn(c, int(b.account_id), 'receipt', adv, no, 'Advance payment', b.odate);
    await audit(c, 'order_create', `${no} total ${total}`); return { to: '/orders/' + o, ok: 'Order confirmed, stock reserved' };
  }));

  app.get('/orders/:id', get(async (req, db) => {
    const o = (await db.query('SELECT o.*, c.name cname, c.phone, c.address FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=$1', [req.params.id])).rows[0];
    if (!o) return page('Not found', '');
    const items = (await db.query('SELECT i.*, p.name FROM order_items i JOIN products p ON p.id=i.product_id WHERE order_id=$1 ORDER BY i.id', [o.id])).rows;
    const accs = (await db.query('SELECT * FROM financial_accounts ORDER BY id')).rows, A = opts(accs), id = o.id, S = o.status;
    const form = (act, inner, btn, cls = '') => `<form method=post action="/orders/${id}/${act}">${token()}${inner}<button class="${cls}">${btn}</button></form>`;
    const can = [];
    if (S === 'Confirmed') can.push(form('dispatch', `<div class=row><div><label>Courier</label><input name=courier required></div><div><label>Tracking / consignment ID</label><input name=tracking></div><div><label>Dispatch date</label><input type=date name=date value="${today()}"></div></div>`, 'Mark dispatched'));
    if (S === 'Dispatched') can.push(form('deliver', `<div class=row><div><label>Delivered date</label><input type=date name=date value="${today()}"></div></div>`, 'Mark delivered'));
    if (['Confirmed', 'Dispatched'].includes(S)) can.push(form('cancel', `<label>Cancellation reason</label><input name=reason required><div class=row><div><label>Refund advance from</label><select name=account_id>${A}</select></div></div>`, 'Cancel order & release stock', 'red'));
    if (['Delivered', 'Partially Returned'].includes(S) && !o.settled) can.push(form('settle', `<h4>Courier / COD settlement</h4><div class=row><div><label>COD received from courier (gross)</label><input type=number step=0.01 min=0 name=received value="${o.cod_expected}"></div>
      <div><label>Courier fee</label><input type=number step=0.01 min=0 name=fee value=0></div><div><label>Net payout into</label><select name=account_id>${A}</select></div><div><label>Date</label><input type=date name=date value="${today()}"></div></div>`, 'Record settlement'));
    if (['Delivered', 'Partially Returned'].includes(S)) can.push(form('return', `<h4>Customer return (inspect first)</h4>${items.filter(i => i.qty > i.returned_qty).map(i => `<div class=row><div><label>${esc(i.name)} (max ${i.qty - i.returned_qty})</label>
      <input type=number min=0 max=${i.qty - i.returned_qty} name=rq value=0><input type=hidden name=item_id value=${i.id}></div><div><label>Condition</label><select name=cond><option value=good>Good → saleable</option><option value=needs_repair>Needs repair</option><option value=damaged>Damaged</option></select></div></div>`).join('')}
      <div class=row><div><label>Refund to customer</label><input type=number step=0.01 min=0 name=refund value=0></div><div><label>Refund from</label><select name=account_id>${A}</select></div></div>`, 'Record return'));
    const ser = (await db.query('SELECT serial,status FROM product_serials WHERE ref=$1', [o.order_no])).rows;
    return page(o.order_no, `<div class=card><b>${esc(o.status)}</b> · ${o.odate} · ${esc(o.channel)}<br>${esc(o.cname)} · ${esc(o.phone)} · ${esc(o.address)}<br>Courier: ${esc(o.courier)} ${esc(o.tracking)} ${o.dispatch_date || ''}
      <br>Items+fee−discount: <b>${taka(o.total)}</b> · Advance ${taka(o.advance)} · COD expected ${taka(o.cod_expected)} · COD received ${taka(o.cod_received)} · Courier fee ${taka(o.courier_fee)} · Settled: ${o.settled ? 'Yes' : 'No'}
      ${o.cancel_reason ? `<br>Cancelled: ${esc(o.cancel_reason)}` : ''}${ser.length ? `<br>Serials: ${ser.map(s => esc(s.serial) + ' (' + s.status + ')').join(', ')}` : ''}</div>
      <div class=card>${table([['Product', 'name'], ['Qty', 'qty'], ['Price', 'price'], ['Returned', 'returned_qty']], items.map(i => ({ ...i, price: taka(i.price) })))}
      <a class="btn gray noprint" href="javascript:print()">Print</a></div>${can.map(x => `<div class="card noprint">${x}</div>`).join('')}`, msg(req));
  }));

  const ord = async (c, id) => { const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]; if (!o) throw new Error('Order not found'); return o; };
  const items = async (c, id) => (await c.query('SELECT * FROM order_items WHERE order_id=$1', [id])).rows;
  const back = req => '/orders/' + req.params.id;
  app.post('/orders/:id/dispatch', post(back, async (req, c) => {
    const o = await ord(c, req.params.id); if (o.status !== 'Confirmed') throw new Error('Order is not Confirmed');
    await c.query(`UPDATE orders SET status='Dispatched',courier=$2,tracking=$3,dispatch_date=$4 WHERE id=$1`, [o.id, req.body.courier, req.body.tracking, req.body.date || today()]);
    await audit(c, 'order_dispatch', o.order_no); return { ok: 'Dispatched' };
  }));
  app.post('/orders/:id/deliver', post(back, async (req, c) => {
    const o = await ord(c, req.params.id); if (o.status !== 'Dispatched') throw new Error('Order is not Dispatched');
    for (const i of await items(c, o.id)) await move(c, i.product_id, 'reserved', null, i.qty, 'sale', o.order_no, null, i.unit_cost);
    await setSerials(c, (await c.query(ORDER_SERIALS, [o.order_no, 'reserved'])).rows.map(r => r.serial), 'sold', o.order_no);
    await c.query(`UPDATE orders SET status='Delivered',delivered_date=$2 WHERE id=$1`, [o.id, req.body.date || today()]);
    await audit(c, 'order_deliver', o.order_no); return { ok: 'Delivered — revenue & COGS recognised' };
  }));
  app.post('/orders/:id/cancel', post(back, async (req, c) => {
    const o = await ord(c, req.params.id); if (!['Confirmed', 'Dispatched'].includes(o.status)) throw new Error('Cannot cancel at this stage');
    for (const i of await items(c, o.id)) await move(c, i.product_id, 'reserved', 'good', i.qty, 'cancel', o.order_no, req.body.reason, i.unit_cost);
    await setSerials(c, (await c.query(ORDER_SERIALS, [o.order_no, 'reserved'])).rows.map(r => r.serial), 'in_stock', null);
    if (o.advance > 0) await accTxn(c, int(req.body.account_id), 'cancel_refund', -o.advance, o.order_no, 'Advance refunded on cancellation');
    await c.query(`UPDATE orders SET status='Cancelled',cancel_reason=$2 WHERE id=$1`, [o.id, req.body.reason]);
    await audit(c, 'order_cancel', o.order_no + ': ' + req.body.reason); return { ok: 'Order cancelled, stock released' };
  }));
  app.post('/orders/:id/settle', post(back, async (req, c) => {
    const o = await ord(c, req.params.id), got = num(req.body.received), fee = num(req.body.fee);
    if (!['Delivered', 'Partially Returned'].includes(o.status) || o.settled) throw new Error('Cannot settle this order');
    if (got < 0 || fee < 0 || fee > got) throw new Error('Check received / fee amounts');
    await accTxn(c, int(req.body.account_id), 'cod_settle', got - fee, o.order_no, 'COD net payout', req.body.date);
    if (fee > 0) await c.query(`INSERT INTO expenses(edate,category,amount,payee,note,ref) VALUES(COALESCE($1::date,CURRENT_DATE),'courier',$2,$3,'Courier fee (netted from COD)',$4)`, [req.body.date || null, fee, o.courier, o.order_no]);
    await c.query('UPDATE orders SET settled=true,cod_received=$2,courier_fee=$3 WHERE id=$1', [o.id, got, fee]);
    await audit(c, 'cod_settle', `${o.order_no} got ${got} fee ${fee}`); return { ok: 'Settlement recorded' };
  }));
  app.post('/orders/:id/return', post(back, async (req, c) => {
    const o = await ord(c, req.params.id); if (!['Delivered', 'Partially Returned'].includes(o.status)) throw new Error('Order not eligible for return');
    const ids = arr(req.body.item_id), rqs = arr(req.body.rq), conds = arr(req.body.cond); let any = 0;
    for (let k = 0; k < ids.length; k++) {
      const q = int(rqs[k]); if (q <= 0) continue;
      const it = (await c.query('SELECT * FROM order_items WHERE id=$1 AND order_id=$2 FOR UPDATE', [ids[k], o.id])).rows[0];
      if (!it || q > it.qty - it.returned_qty) throw new Error('Return quantity too large');
      const to = ['good', 'needs_repair', 'damaged'].includes(conds[k]) ? conds[k] : 'needs_repair'; any += q;
      await move(c, it.product_id, null, to, q, 'return', o.order_no, 'Customer return → ' + to, it.unit_cost);
      await c.query('UPDATE order_items SET returned_qty=returned_qty+$2 WHERE id=$1', [it.id, q]);
    }
    if (!any) throw new Error('Enter a return quantity');
    const refund = num(req.body.refund); if (refund > 0) await accTxn(c, int(req.body.account_id), 'refund', -refund, o.order_no, 'Customer refund');
    const left = (await c.query('SELECT COALESCE(SUM(qty-returned_qty),0)::int n FROM order_items WHERE order_id=$1', [o.id])).rows[0].n;
    await c.query('UPDATE orders SET status=$2 WHERE id=$1', [o.id, left ? 'Partially Returned' : 'Returned']);
    await audit(c, 'order_return', `${o.order_no} refund ${refund}`); return { ok: 'Return recorded' };
  }));
};
