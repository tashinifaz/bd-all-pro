// Phase 4: GET /api/serial/:code -> {found, kind, product_id, product_name, serialized, status, bucket, ref}. Registered AFTER auth.
// kind: 'unit' (product_serials) | 'repair' (repairs.serial only) | 'product' (products.barcode / sku). Read-only, parameterised.
const { pool } = require('./web');
const BUCKET = { in_stock: 'good', reserved: 'reserved', sold: 'sold', repair: 'under_repair', damaged: 'damaged', returned_to_supplier: 'returned' };
module.exports = app => {
  app.get('/api/serial/:code', async (req, res) => {
    const code = String(req.params.code || '').trim().slice(0, 100); res.set('Cache-Control', 'no-store');
    if (!code) return res.json({ found: false });
    try {
      let r = (await pool.query(`SELECT s.status,s.ref,p.id,p.name,p.serialized FROM product_serials s JOIN products p ON p.id=s.product_id WHERE s.serial=$1`, [code])).rows[0];
      if (r) return res.json({ found: true, kind: 'unit', product_id: r.id, product_name: r.name, serialized: r.serialized, status: r.status, bucket: BUCKET[r.status] || r.status, ref: r.ref });
      r = (await pool.query(`SELECT r.ref,r.status,p.id,p.name,p.serialized FROM repairs r JOIN products p ON p.id=r.product_id WHERE r.serial=$1 ORDER BY r.id DESC LIMIT 1`, [code])).rows[0];
      if (r) return res.json({ found: true, kind: 'repair', product_id: r.id, product_name: r.name, serialized: r.serialized, status: r.status, bucket: 'repair', ref: r.ref });
      r = (await pool.query(`SELECT id,name,serialized FROM products WHERE barcode=$1 OR upper(sku)=upper($1) ORDER BY archived,id LIMIT 1`, [code])).rows[0];
      if (r) return res.json({ found: true, kind: 'product', product_id: r.id, product_name: r.name, serialized: r.serialized, status: 'product', bucket: null });
      res.json({ found: false });
    } catch (e) { console.error(e); res.status(500).json({ found: false, error: 'failed' }); }
  });
};
