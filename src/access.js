// Staff-account groundwork (Phase 5). Today only role 'owner' exists and may do everything.
// req.user = { id, username, role, prefs:{key:value}, biz } is loaded ONCE per request by load() (after the login gate).
const pool = require('./db'), als = require('./ctx');
// role -> permissions. '*' = everything. To add staff: add e.g. staff: ['orders.write','stock.view'] and call can(req,'orders.write').
const ROLES = { owner: ['*'] };
const can = (req, perm) => { const p = ROLES[req.user && req.user.role] || []; return p.includes('*') || p.includes(perm); };
// requireRole('owner', ...): owner is always allowed; other roles only if listed.
const requireRole = (...roles) => (req, res, next) => {
  const r = req.user && req.user.role;
  if (r === 'owner' || roles.includes(r)) return next();
  const msg = 'Not allowed for your account · আপনার অ্যাকাউন্টে অনুমতি নেই';
  if (req.get('x-requested-with') === 'fetch') return res.status(403).json({ ok: false, err: msg });
  res.status(403).send(require('./views').page('Not allowed', `<div class=err>${msg}</div>`));
};
async function load(req, res, next) {
  try {
    const r = (await pool.query(`SELECT u.id, u.username, u.role,
      (SELECT json_object_agg(p.key, p.value) FROM user_prefs p WHERE p.user_id = u.id) prefs,
      (SELECT v FROM settings WHERE k = 'business') biz FROM users u WHERE u.id = $1`, [req.session.uid])).rows[0];
    if (!r) { req.session = null; return res.redirect('/login'); }
    req.user = { id: r.id, username: r.username, role: r.role || 'owner', prefs: r.prefs || {}, biz: r.biz || 'BD ALL PRO' };
    als.run(req.user, next);
  } catch (e) { next(e); }
}
module.exports = { load, can, requireRole, ROLES };
