const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const taka = n => '৳' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BUCKETS = ['good', 'reserved', 'needs_repair', 'under_repair', 'awaiting_approval', 'damaged'];
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const int = v => Math.trunc(num(v));
const arr = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

// Move qty between buckets (null = outside business). Rejects negative stock via CHECK + explicit test.
async function move(c, pid, from, to, qty, mtype, ref, reason, cost) {
  if (qty <= 0) throw new Error('Quantity must be positive');
  if (from) {
    const r = await c.query('UPDATE stock_balances SET qty=qty-$3 WHERE product_id=$1 AND bucket=$2 AND qty>=$3', [pid, from, qty]);
    if (!r.rowCount) throw new Error(`Not enough stock in "${from}" for product #${pid}`);
  }
  if (to) await c.query(`INSERT INTO stock_balances(product_id,bucket,qty) VALUES($1,$2,$3)
    ON CONFLICT(product_id,bucket) DO UPDATE SET qty=stock_balances.qty+$3`, [pid, to, qty]);
  await c.query(`INSERT INTO stock_movements(product_id,from_bucket,to_bucket,qty,mtype,ref,reason,unit_cost)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [pid, from, to, qty, mtype, ref, reason, cost || 0]);
}
const audit = (c, action, detail) => c.query('INSERT INTO audit_log(action,detail) VALUES($1,$2)', [action, detail]);
// Duplicate-submission guard: each form carries a one-time token.
async function once(c, token) {
  if (!token) return;
  const r = await c.query('INSERT INTO idem(token) VALUES($1) ON CONFLICT DO NOTHING', [token]);
  if (!r.rowCount) { const e = new Error('Duplicate submission ignored'); e.dup = true; throw e; }
}
const accTxn = (c, acc, kind, amt, ref, note, date) =>
  c.query('INSERT INTO account_txns(account_id,kind,amount,ref,note,txn_date) VALUES($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE))', [acc, kind, amt, ref, note, date || null]);
const fmtDT = d => d ? new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }) : '';

function csv(cols, rows) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.map(c => q(c[0])).join(','), ...rows.map(r => cols.map(c => q(r[c[1]])).join(','))].join('\n');
}
module.exports = { esc, taka, BUCKETS, num, int, arr, today, move, audit, once, accTxn, fmtDT, csv };
