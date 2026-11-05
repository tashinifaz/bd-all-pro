// Demo data only. Loaded when SEED_DEMO=1 and there are no products yet. Never overwrites real data.
module.exports = async pool => {
  if ((await pool.query('SELECT 1 FROM products LIMIT 1')).rowCount) return;
  const cat = async n => (await pool.query('SELECT id FROM categories WHERE name=$1', [n])).rows[0].id;
  const demo = [['NB-001', 'Demo Neckband X1', 'Neckband', 650, 990, 10, false, 20], ['EB-001', 'Demo Earbuds Pro', 'Earbuds', 900, 1450, 5, false, 15], ['SW-001', 'Demo Smartwatch S2', 'Smartwatch', 2100, 3200, 2, true, 0]];
  const sup = (await pool.query(`INSERT INTO suppliers(name,phone) VALUES('Demo Supplier','01700000000') RETURNING id`)).rows[0].id;
  for (const [sku, name, c, cost, price, min, ser, qty] of demo) {
    const p = (await pool.query(`INSERT INTO products(sku,name,category_id,default_cost,avg_cost,price,min_stock,serialized) VALUES($1,$2,$3,$4,$4,$5,$6,$7) RETURNING id`, [sku, name, await cat(c), cost, price, min, ser])).rows[0].id;
    if (qty) {
      await pool.query(`INSERT INTO stock_balances(product_id,bucket,qty) VALUES($1,'good',$2)`, [p, qty]);
      await pool.query(`INSERT INTO stock_movements(product_id,to_bucket,qty,mtype,ref,reason,unit_cost) VALUES($1,'good',$2,'adjust','DEMO','Opening demo stock',$3)`, [p, qty, cost]);
    }
  }
  await pool.query(`UPDATE financial_accounts SET opening=50000 WHERE name='Cash'`);
  console.log('Demo data loaded (supplier #' + sup + ')');
};
if (require.main === module) { const pool = require('../src/db'); module.exports(pool).then(() => pool.end()); }
