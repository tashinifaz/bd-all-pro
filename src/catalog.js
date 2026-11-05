const { get, post, msg } = require('./web');
const { page, token, table, opts } = require('./views');
const { esc, taka, BUCKETS, num, int, move, audit, csv, fmtDT } = require('./lib');

const BL = { good: 'Good', reserved: 'Reserved', needs_repair: 'Needs repair', under_repair: 'Under repair', awaiting_approval: 'Awaiting approval', damaged: 'Damaged' };
async function stockRows(db, where = 'TRUE', params = []) {
  const f = b => `COALESCE(SUM(b.qty) FILTER (WHERE b.bucket='${b}'),0)::int`;
  return (await db.query(`SELECT p.*, c.name AS cat, ${BUCKETS.map(b => f(b) + ' AS ' + b).join(',')}, COALESCE(SUM(b.qty),0)::int AS total
    FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN stock_balances b ON b.product_id=p.id
    WHERE ${where} GROUP BY p.id, c.name ORDER BY p.name`, params)).rows;
}
module.exports = app => {
  app.get('/products', get(async (req, db) => {
    const s = (req.query.q || '').trim(), cat = req.query.cat || '';
    const rows = await stockRows(db, `(p.archived=false OR $3) AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.sku ILIKE '%'||$1||'%' OR p.brand ILIKE '%'||$1||'%' OR p.model ILIKE '%'||$1||'%'
      OR EXISTS(SELECT 1 FROM product_serials s WHERE s.product_id=p.id AND s.serial ILIKE '%'||$1||'%')) AND ($2='' OR p.category_id::text=$2)`, [s, cat, req.query.arch === '1']);
    const cols = [['SKU', 'sku'], ['Name', 'name'], ['Category', 'cat'], ['Good', 'good'], ['Total units', 'total'], ['Avg cost', 'avg_cost'], ['Price', 'price'], ['Min', 'min_stock']];
    if (req.query.csv) return { csv: csv(cols, rows), name: 'products' };
    const cats = (await db.query('SELECT * FROM categories ORDER BY name')).rows;
    const list = rows.map(r => ({ ...r, sku: `<a href="/products/${r.id}">${esc(r.sku)}</a>`, name: esc(r.name) + (r.archived ? ' (archived)' : '') + (r.serialized ? ' 🔢' : ''),
      good: r.good < r.min_stock ? `<b class=warn>${r.good} ⚠</b>` : r.good, avg_cost: taka(r.avg_cost), price: taka(r.price) }));
    return page('Products', `<form method=get class=card><div class=row><div><label>Search name / SKU / brand / model / serial</label><input name=q value="${esc(s)}"></div>
      <div><label>Category</label><select name=cat><option value="">All</option>${opts(cats, 'id', 'name', cat)}</select></div></div><button>Search</button>
      <a class="btn gray" href="?q=${encodeURIComponent(s)}&cat=${cat}&csv=1">CSV</a> <a class="btn gray" href="?arch=1">Show archived</a></form>
      <div class=card>${table(cols.map(c => c), list, ['sku', 'name', 'good'])}</div>
      <div class=card><h3>Add product</h3>${productForm({}, cats, '/products')}</div>`, msg(req));
  }));
  const productForm = (p, cats, action) => `<form method=post action="${action}">${token()}<div class=row>
    <div><label>SKU</label><input name=sku required value="${esc(p.sku)}"></div><div><label>Name</label><input name=name required value="${esc(p.name)}"></div>
    <div><label>Brand</label><input name=brand value="${esc(p.brand)}"></div><div><label>Model</label><input name=model value="${esc(p.model)}"></div>
    <div><label>Category</label><select name=category_id>${opts(cats, 'id', 'name', p.category_id)}</select></div>
    <div><label>Default cost</label><input type=number step=0.01 min=0 name=default_cost value="${p.default_cost ?? 0}"></div>
    <div><label>Selling price</label><input type=number step=0.01 min=0 name=price value="${p.price ?? 0}"></div>
    <div><label>Low-stock threshold</label><input type=number min=0 name=min_stock value="${p.min_stock ?? 0}"></div></div>
    <label>Description</label><textarea name=description rows=2>${esc(p.description)}</textarea>
    <label><input type=checkbox name=serialized value=1 style="width:auto" ${p.serialized ? 'checked' : ''}> Track serial / IMEI per unit</label><br><br><button>Save</button></form>`;
  const fields = b => [b.sku.trim(), b.name.trim(), b.brand, b.model, int(b.category_id) || null, b.description, num(b.default_cost), num(b.price), int(b.min_stock), !!b.serialized];
  app.post('/products', post('/products', async (req, c) => {
    await c.query(`INSERT INTO products(sku,name,brand,model,category_id,description,default_cost,price,min_stock,serialized,avg_cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$7)`, fields(req.body));
    await audit(c, 'product_add', req.body.sku); return { ok: 'Product added' };
  }));
  app.get('/products/:id', get(async (req, db) => {
    const [p] = await stockRows(db, 'p.id=$1', [req.params.id]); if (!p) return page('Not found', '');
    const cats = (await db.query('SELECT * FROM categories ORDER BY name')).rows;
    const ser = (await db.query('SELECT serial,status,ref,updated_at FROM product_serials WHERE product_id=$1 ORDER BY id DESC LIMIT 200', [p.id])).rows.map(s => ({ ...s, updated_at: fmtDT(s.updated_at) }));
    const mv = (await db.query('SELECT * FROM stock_movements WHERE product_id=$1 ORDER BY id DESC LIMIT 30', [p.id])).rows.map(m => ({ ...m, created_at: fmtDT(m.created_at), unit_cost: taka(m.unit_cost) }));
    return page(p.name, `<div class=card>${BUCKETS.map(b => `<span class=k>${BL[b]}</span> <b>${p[b]}</b> &nbsp;`).join('')}<br>Avg cost ${taka(p.avg_cost)} · Stock value ${taka(p.avg_cost * (p.total - p.damaged))}</div>
      <div class=card><h3>Edit</h3>${productForm(p, cats, '/products/' + p.id)}
      <form method=post action="/products/${p.id}/archive">${token()}<button class=gray>${p.archived ? 'Unarchive' : 'Archive'}</button></form></div>
      ${p.serialized ? `<div class=card><h3>Serial / IMEI units</h3>${table([['Serial', 'serial'], ['Status', 'status'], ['Ref', 'ref'], ['Updated', 'updated_at']], ser)}</div>` : ''}
      <div class=card><h3>Recent stock movements</h3>${table([['When', 'created_at'], ['Type', 'mtype'], ['From', 'from_bucket'], ['To', 'to_bucket'], ['Qty', 'qty'], ['Cost', 'unit_cost'], ['Ref', 'ref'], ['Reason', 'reason']], mv)}</div>`, msg(req));
  }));
  // Editing the default price never touches historical order/purchase lines (they store their own prices/costs).
  app.post('/products/:id', post(req => '/products/' + req.params.id, async (req, c) => {
    await c.query(`UPDATE products SET sku=$1,name=$2,brand=$3,model=$4,category_id=$5,description=$6,default_cost=$7,price=$8,min_stock=$9,serialized=$10 WHERE id=${int(req.params.id)}`, fields(req.body));
    return { ok: 'Updated' };
  }));
  app.post('/products/:id/archive', post(req => '/products/' + req.params.id, async (req, c) => {
    await c.query('UPDATE products SET archived=NOT archived WHERE id=$1', [req.params.id]); return { ok: 'Updated' };
  }));

  app.get('/stock', get(async (req, db) => {
    const rows = await stockRows(db, 'p.archived=false');
    const cols = [['SKU', 'sku'], ['Product', 'name'], ...BUCKETS.map(b => [BL[b], b]), ['Total', 'total'], ['Avg cost', 'avg_cost'], ['Stock value', 'value']];
    rows.forEach(r => r.value = (r.avg_cost * (r.total - r.damaged)).toFixed(2));
    if (req.query.csv) return { csv: csv(cols, rows), name: 'inventory' };
    const mv = (await db.query(`SELECT m.*, p.name FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT 60`)).rows.map(m => ({ ...m, created_at: fmtDT(m.created_at) }));
    const adj = (await db.query(`SELECT m.*, p.name FROM stock_movements m JOIN products p ON p.id=m.product_id WHERE mtype='adjust' ORDER BY m.id DESC LIMIT 30`)).rows.map(m => ({ ...m, created_at: fmtDT(m.created_at) }));
    return page('Stock by condition', `<a class="btn gray" href="?csv=1">CSV</a><div class=card>${table(cols, rows)}</div>
      <div class=card><h3>Physical count / adjustment</h3><p class=k>Enter the counted quantity; the difference is booked as a reasoned adjustment. History is never deleted.</p>
      <form method=post action="/stock/adjust">${token()}<div class=row><div><label>Product</label><select name=product_id>${opts(rows, 'id', r => r.sku + ' · ' + r.name)}</select></div>
      <div><label>Condition</label><select name=bucket>${BUCKETS.map(b => `<option value=${b}>${BL[b]}</option>`).join('')}</select></div>
      <div><label>Counted qty</label><input type=number min=0 name=counted required></div><div><label>Reason (required)</label><input name=reason required></div></div><button>Apply</button></form></div>
      <div class=card><h3>Recent adjustments / discrepancies</h3>${table([['When', 'created_at'], ['Product', 'name'], ['Bucket', 'to_bucket'], ['Qty', 'qty'], ['Reason', 'reason']], adj)}</div>
      <div class=card><h3>Stock ledger (latest 60)</h3>${table([['When', 'created_at'], ['Product', 'name'], ['Type', 'mtype'], ['From', 'from_bucket'], ['To', 'to_bucket'], ['Qty', 'qty'], ['Ref', 'ref']], mv)}</div>`, msg(req));
  }));
  app.post('/stock/adjust', post('/stock', async (req, c) => {
    const { product_id, bucket, reason } = req.body, counted = int(req.body.counted);
    if (!BUCKETS.includes(bucket) || !reason.trim() || counted < 0) throw new Error('Reason and valid count required');
    const p = (await c.query('SELECT avg_cost FROM products WHERE id=$1 FOR UPDATE', [product_id])).rows[0];
    const cur = (await c.query('SELECT qty FROM stock_balances WHERE product_id=$1 AND bucket=$2', [product_id, bucket])).rows[0]?.qty || 0;
    const d = counted - cur; if (!d) return { ok: 'Count matches — no change' };
    await move(c, product_id, d < 0 ? bucket : null, d > 0 ? bucket : null, Math.abs(d), 'adjust', 'COUNT', reason, p.avg_cost);
    await audit(c, 'stock_adjust', `p${product_id} ${bucket} ${cur}->${counted}: ${reason}`); return { ok: `Adjusted by ${d}` };
  }));
};
module.exports.stockRows = stockRows; module.exports.BL = BL;
