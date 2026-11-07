const { get, post, msg } = require('./web');
const { page, token, table, opts, rangeForm, dateRange } = require('./views');
const { esc, taka, num, int, arr, move, audit, accTxn, csv, today } = require('./lib');
const LINES = 5;
const serialsOf = t => (t || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);

module.exports = app => {
  app.get('/purchases', get(async (req, db) => {
    const r = dateRange(req.query);
    const [prods, sups, accs] = await Promise.all(['SELECT id,sku,name FROM products WHERE archived=false ORDER BY name', 'SELECT * FROM suppliers WHERE active ORDER BY name', 'SELECT * FROM financial_accounts ORDER BY id'].map(s => db.query(s).then(x => x.rows)));
    const rows = (await db.query(`SELECT pu.*, s.name supplier, (pu.total-pu.paid-pu.credit) due FROM purchases pu LEFT JOIN suppliers s ON s.id=pu.supplier_id
      WHERE pu.pdate BETWEEN $1 AND $2 ORDER BY pu.id DESC`, [r.from, r.to])).rows;
    const cols = [['#', 'id'], ['Date', 'pdate'], ['Supplier', 'supplier'], ['Invoice', 'invoice_no'], ['Total', 'total'], ['Paid', 'paid'], ['Credit', 'credit'], ['Due', 'due']];
    if (req.query.csv) return { csv: csv(cols, rows), name: 'purchases' };
    const bal = (await db.query(`SELECT s.name, COALESCE(SUM(pu.total-pu.paid-pu.credit),0) due FROM suppliers s LEFT JOIN purchases pu ON pu.supplier_id=s.id GROUP BY s.id ORDER BY s.name`)).rows.map(b => ({ ...b, due: taka(b.due) }));
    const line = Array.from({ length: LINES }, (_, i) => `<div class=row><div><label>Product ${i + 1}</label><select name=product_id><option value="">—</option>${opts(prods, 'id', p => p.sku + ' · ' + p.name)}</select></div>
      <div><label>Qty</label><input type=number min=0 name=qty></div><div><label>Unit cost</label><input type=number step=0.01 min=0 name=unit_cost></div>
      <div><label>Serial/IMEI (if tracked, one per line)</label><textarea name=serials rows=1></textarea></div></div>`).join('');
    const list = rows.map(x => ({ ...x, id: `<a href="/purchases/${x.id}">PUR-${x.id}</a>`, total: taka(x.total), paid: taka(x.paid), credit: taka(x.credit), due: taka(x.due) }));
    return page('Purchases & suppliers', rangeForm(req.query, '/purchases') + `<div class=card>${table(cols, list, ['id'], { st: 1, empty: ['No purchases yet', 'এখনো কোনো কেনা নেই', '/purchases', 'purchase', '+ New purchase', 'নতুন কেনা'] })}</div>
      <div class=card><h3>New purchase invoice</h3><form method=post action="/purchases">${token()}<div class=row>
      <div><label>Supplier</label><select name=supplier_id>${opts(sups)}</select></div><div><label>Invoice no.</label><input name=invoice_no></div>
      <div><label>Date</label><input type=date name=pdate value="${today()}"></div></div>${line}<div class=row>
      <div><label>Discount</label><input type=number step=0.01 min=0 name=discount value=0></div><div><label>Landed / extra cost (transport etc.)</label><input type=number step=0.01 min=0 name=extra_cost value=0></div>
      <div><label>Paid now</label><input type=number step=0.01 min=0 name=paid value=0></div><div><label>Paid from</label><select name=account_id>${opts(accs)}</select></div></div>
      <label>Note</label><input name=note><button>Post purchase</button></form><p class=k>Landed cost (extra − discount) is allocated to lines by value. Average cost is recalculated (weighted average).</p></div>
      <div class=card><h3>Supplier balances</h3>${table([['Supplier', 'name'], ['Payable', 'due']], bal)}
      <h4>Add supplier</h4><form method=post action="/suppliers">${token()}<div class=row><div><label>Name</label><input name=name required></div><div><label>Phone</label><input name=phone></div><div><label>Address</label><input name=address></div></div><button>Add</button></form></div>`, msg(req));
  }));
  app.post('/suppliers', post('/purchases', async (req, c) => { await c.query('INSERT INTO suppliers(name,phone,address) VALUES($1,$2,$3)', [req.body.name, req.body.phone, req.body.address]); return { ok: 'Supplier added' }; }));

  app.post('/purchases', post('/purchases', async (req, c) => {
    const b = req.body, pids = arr(b.product_id), qs = arr(b.qty), cs = arr(b.unit_cost), ss = arr(b.serials);
    const lines = pids.map((p, i) => ({ pid: int(p), qty: int(qs[i]), cost: num(cs[i]), serials: serialsOf(ss[i]) })).filter(l => l.pid && l.qty > 0);
    if (!lines.length) throw new Error('Add at least one product line');
    const sub = lines.reduce((a, l) => a + l.qty * l.cost, 0), disc = num(b.discount), extra = num(b.extra_cost), paid = num(b.paid);
    const total = sub - disc + extra; if (total < 0 || paid < 0 || paid > total + 0.001) throw new Error('Check discount / paid amounts');
    const pu = (await c.query('INSERT INTO purchases(supplier_id,invoice_no,pdate,discount,extra_cost,total,paid,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [int(b.supplier_id) || null, b.invoice_no, b.pdate || today(), disc, extra, total, paid, b.note])).rows[0].id;
    for (const l of lines) {
      const p = (await c.query('SELECT avg_cost,serialized,name FROM products WHERE id=$1 FOR UPDATE', [l.pid])).rows[0];
      if (!p) throw new Error('Unknown product');
      const landed = l.cost + (sub > 0 ? (l.qty * l.cost / sub) * (extra - disc) / l.qty : 0);
      const onhand = (await c.query('SELECT COALESCE(SUM(qty),0)::int n FROM stock_balances WHERE product_id=$1', [l.pid])).rows[0].n;
      const avg = (onhand * p.avg_cost + l.qty * landed) / (onhand + l.qty);
      if (p.serialized) {
        if (new Set(l.serials).size !== l.qty) throw new Error(`${p.name}: enter exactly ${l.qty} unique serial/IMEI values`);
        for (const s of l.serials) await c.query('INSERT INTO product_serials(product_id,serial,ref) VALUES($1,$2,$3)', [l.pid, s, 'PUR-' + pu]);
      }
      await c.query('INSERT INTO purchase_items(purchase_id,product_id,qty,unit_cost,landed_unit_cost) VALUES($1,$2,$3,$4,$5)', [pu, l.pid, l.qty, l.cost, landed]);
      await c.query('UPDATE products SET avg_cost=$2 WHERE id=$1', [l.pid, avg]);
      await move(c, l.pid, null, 'good', l.qty, 'purchase', 'PUR-' + pu, null, landed);
    }
    if (paid > 0) await accTxn(c, int(b.account_id), 'supplier_pay', -paid, 'PUR-' + pu, 'Purchase payment', b.pdate);
    await audit(c, 'purchase_post', `PUR-${pu} total ${total}`); return { to: '/purchases/' + pu, ok: 'Purchase posted' };
  }));

  app.get('/purchases/:id', get(async (req, db) => {
    const pu = (await db.query('SELECT pu.*, s.name supplier FROM purchases pu LEFT JOIN suppliers s ON s.id=pu.supplier_id WHERE pu.id=$1', [req.params.id])).rows[0];
    if (!pu) return page('Not found', '');
    const items = (await db.query('SELECT i.*, p.name FROM purchase_items i JOIN products p ON p.id=i.product_id WHERE purchase_id=$1', [pu.id])).rows.map(i => ({ ...i, unit_cost: taka(i.unit_cost), landed_unit_cost: taka(i.landed_unit_cost) }));
    const accs = (await db.query('SELECT * FROM financial_accounts ORDER BY id')).rows, due = pu.total - pu.paid - pu.credit;
    return page('PUR-' + pu.id, `<div class=card>${esc(pu.supplier)} · Invoice ${esc(pu.invoice_no)} · ${pu.pdate}<br>Total ${taka(pu.total)} · Paid ${taka(pu.paid)} · Credit ${taka(pu.credit)} · <b>Due ${taka(due)}</b></div>
      <div class=card>${table([['Product', 'name'], ['Qty', 'qty'], ['Unit cost', 'unit_cost'], ['Landed unit cost', 'landed_unit_cost']], items)}</div>
      ${due > 0 ? `<div class=card><h3>Pay supplier</h3><form method=post action="/purchases/${pu.id}/pay">${token()}<div class=row><div><label>Amount</label><input type=number step=0.01 min=0.01 max=${due} name=amount required></div>
      <div><label>From</label><select name=account_id>${opts(accs)}</select></div></div><button>Record payment</button></form></div>` : ''}
      <div class=card><h3>Purchase return to supplier</h3><form method=post action="/purchases/${pu.id}/return">${token()}<div class=row>
      <div><label>Product</label><select name=product_id>${opts(items, 'product_id', 'name')}</select></div><div><label>Qty (from good stock)</label><input type=number min=1 name=qty required></div>
      <div><label>Credit / refund value</label><input type=number step=0.01 min=0 name=credit required></div><div><label>Serial (if tracked)</label><input name=serial></div>
      <div><label>Refund received to (if paid already)</label><select name=account_id>${opts(accs)}</select></div></div><label>Reason</label><input name=reason required><button>Record return</button></form></div>`, msg(req));
  }));
  app.post('/purchases/:id/pay', post(req => '/purchases/' + req.params.id, async (req, c) => {
    const id = int(req.params.id), a = num(req.body.amount);
    const pu = (await c.query('SELECT total,paid,credit FROM purchases WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!pu || a <= 0 || a > pu.total - pu.paid - pu.credit + 0.001) throw new Error('Amount exceeds amount due');
    await c.query('UPDATE purchases SET paid=paid+$2 WHERE id=$1', [id, a]);
    await accTxn(c, int(req.body.account_id), 'supplier_pay', -a, 'PUR-' + id, 'Supplier payment'); await audit(c, 'supplier_pay', `PUR-${id} ${a}`); return { ok: 'Payment recorded' };
  }));
  app.post('/purchases/:id/return', post(req => '/purchases/' + req.params.id, async (req, c) => {
    const id = int(req.params.id), b = req.body, qty = int(b.qty), credit = num(b.credit);
    const pu = (await c.query('SELECT total,paid,credit FROM purchases WHERE id=$1 FOR UPDATE', [id])).rows[0];
    const p = (await c.query('SELECT id,avg_cost,serialized FROM products WHERE id=$1', [b.product_id])).rows[0];
    if (!pu || !p || qty < 1) throw new Error('Invalid return');
    if (p.serialized) { const r = await c.query(`UPDATE product_serials SET status='returned_to_supplier',updated_at=now() WHERE serial=$1 AND product_id=$2 AND status='in_stock'`, [(b.serial || '').trim(), p.id]); if (qty !== 1 || !r.rowCount) throw new Error('Enter one in-stock serial for tracked products'); }
    await move(c, p.id, 'good', null, qty, 'purchase_return', 'PUR-' + id, b.reason, p.avg_cost);
    const apply = Math.min(credit, Math.max(0, pu.total - pu.paid - pu.credit)), cash = credit - apply;
    await c.query('UPDATE purchases SET credit=credit+$2 WHERE id=$1', [id, apply]);
    if (cash > 0) await accTxn(c, int(b.account_id), 'supplier_refund', cash, 'PUR-' + id, 'Supplier refund');
    await audit(c, 'purchase_return', `PUR-${id} p${p.id} x${qty} ${credit}`); return { ok: 'Return recorded' };
  }));
};
