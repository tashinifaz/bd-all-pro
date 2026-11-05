const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v); // DATE as plain string
types.setTypeParser(1700, v => Number(v)); // NUMERIC -> number (BDT, 2dp; fine at this scale)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : false,
  max: 5,
});
pool.tx = async fn => {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
};
module.exports = pool;
