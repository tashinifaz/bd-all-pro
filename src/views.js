const { esc, taka, today } = require('./lib');
const crypto = require('crypto');
const NAV = [['/', 'Dashboard'], ['/products', 'Products'], ['/purchases', 'Purchases'], ['/orders', 'Orders'], ['/repairs', 'Repairs'],
  ['/expenses', 'Expenses'], ['/accounts', 'Accounts'], ['/stock', 'Stock'], ['/reports', 'Reports']];
const CSS = `*{box-sizing:border-box}body{font:15px system-ui,sans-serif;margin:0;background:#f4f5f7;color:#1c1e21}
nav{background:#14213d;display:flex;overflow-x:auto;white-space:nowrap}nav a{color:#fff;padding:12px 14px;text-decoration:none}
main{max-width:1000px;margin:auto;padding:12px}.card{background:#fff;border-radius:8px;padding:12px;margin:10px 0;box-shadow:0 1px 2px #0002}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.k{font-size:12px;color:#667}.v{font-size:19px;font-weight:700}
table{border-collapse:collapse;width:100%}.w{overflow-x:auto}th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:14px}
input,select,textarea{width:100%;padding:8px;margin:3px 0 8px;border:1px solid #ccd;border-radius:6px;font:inherit}
button,.btn{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:9px 14px;text-decoration:none;display:inline-block;cursor:pointer;font:inherit}
.red{background:#dc2626}.gray{background:#64748b}.err{background:#fee2e2;padding:8px;border-radius:6px}.ok{background:#dcfce7;padding:8px;border-radius:6px}
.warn{color:#b45309}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0 8px}label{font-size:12px;color:#556}
@media print{nav,.noprint{display:none}}`;
const page = (title, body, msg) => `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${esc(title)} · BD ALL PRO</title><style>${CSS}</style></head><body>
<nav>${NAV.map(n => `<a href="${n[0]}">${n[1]}</a>`).join('')}<a href="/logout">Logout</a></nav><main>
${msg?.err ? `<div class=err>${esc(msg.err)}</div>` : ''}${msg?.ok ? `<div class=ok>${esc(msg.ok)}</div>` : ''}
<h2>${esc(title)}</h2>${body}</main></body></html>`;
const token = () => `<input type=hidden name=_t value="${crypto.randomUUID()}">`;
const table = (cols, rows, raw = []) => `<div class=w><table><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr>${rows.map(r =>
  `<tr>${cols.map(c => `<td>${raw.includes(c[1]) ? r[c[1]] : esc(r[c[1]])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan=${cols.length}>No records</td></tr>`}</table></div>`;
const opts = (rows, val = 'id', lab = 'name', sel) => rows.map(r => `<option value="${esc(r[val])}"${String(sel) === String(r[val]) ? ' selected' : ''}>${esc(typeof lab === 'function' ? lab(r) : r[lab])}</option>`).join('');
const dateRange = q => {
  const t = today();
  return { from: q.from || t.slice(0, 8) + '01', to: q.to || t };
};
const rangeForm = (q, action, extra = '') => { const r = dateRange(q); return `<form class=noprint method=get action="${action}"><div class=row>
<div><label>From</label><input type=date name=from value="${r.from}"></div><div><label>To</label><input type=date name=to value="${r.to}"></div>${extra}</div>
<button>Filter</button> <a class="btn gray" href="?from=${r.from}&to=${r.to}&csv=1">CSV</a></form>`; };
module.exports = { page, token, table, opts, dateRange, rangeForm, taka };
