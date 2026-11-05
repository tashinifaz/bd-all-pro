const pool = require('./db');
const { once } = require('./lib');
const { page } = require('./views');
const msg = req => ({ err: req.query.err, ok: req.query.ok });
const q = (to, k, v) => to + (to.includes('?') ? '&' : '?') + k + '=' + encodeURIComponent(v);
// GET handler: fn(req, pool) -> html string | {csv, name} ; errors become a friendly page
const get = fn => async (req, res) => {
  try {
    const out = await fn(req, pool);
    if (out && out.csv !== undefined) { res.type('text/csv').set('Content-Disposition', `attachment; filename="${out.name}.csv"`); return res.send(out.csv); }
    res.send(out);
  } catch (e) { console.error(e); res.status(500).send(page('Error', '<p>Something went wrong. Please go back and try again.</p>')); }
};
// POST handler: runs in one DB transaction, with duplicate-submission guard. fn returns {to, ok}
const post = (fallback, fn) => async (req, res) => {
  const back = req.body._back || (typeof fallback === 'function' ? fallback(req) : fallback);
  try {
    const r = await pool.tx(async c => { await once(c, req.body._t); return fn(req, c); });
    res.redirect(q(r.to || back, 'ok', r.ok || 'Saved'));
  } catch (e) {
    if (e.dup) return res.redirect(q(back, 'ok', 'Already saved'));
    const known = e.code === '23505' ? 'Duplicate value (SKU / serial / number already exists)' : e.code === '23514' ? 'Invalid quantity or amount' : e.message;
    if (!e.code) console.warn('rejected:', e.message); else console.error(e);
    res.redirect(q(back, 'err', known));
  }
};
module.exports = { get, post, msg, pool };
