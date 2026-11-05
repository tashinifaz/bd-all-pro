const express = require('express'), session = require('cookie-session'), bcrypt = require('bcryptjs'), crypto = require('crypto');
const pool = require('./db'), migrate = require('../db/migrate');
const { esc } = require('./lib');
const app = express();
const prod = process.env.NODE_ENV === 'production';
const secret = process.env.SESSION_SECRET || (prod ? null : 'dev-secret');
if (!secret) { console.error('SESSION_SECRET is required'); process.exit(1); }
app.set('trust proxy', 1); app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(session({ name: 'bdap', keys: [secret], maxAge: 8 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: prod }));
app.use((req, res, next) => { res.set({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' }); next(); });
require('./reports')(app); // /health is registered here, before auth
// CSRF defence in depth: same-origin POSTs only (plus SameSite=Lax cookie)
app.use((req, res, next) => {
  if (req.method === 'POST') { const o = req.get('origin'); if (o && new URL(o).host !== req.get('host')) return res.status(403).send('Bad origin'); }
  next();
});
const fails = new Map();
const loginPage = (err) => `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Login</title><body style="font:16px system-ui;max-width:340px;margin:12vh auto;padding:12px">
<h2>BD ALL PRO</h2>${err ? `<p style="background:#fee2e2;padding:8px">${esc(err)}</p>` : ''}<form method=post action=/login>
<input name=username placeholder=Username autocomplete=username style="width:100%;padding:10px;margin:4px 0"><input name=password type=password placeholder=Password autocomplete=current-password style="width:100%;padding:10px;margin:4px 0">
<button style="width:100%;padding:10px;background:#2563eb;color:#fff;border:0">Sign in</button></form>`;
app.get('/login', (req, res) => res.send(loginPage()));
app.post('/login', async (req, res) => {
  const ip = req.ip, f = fails.get(ip) || { n: 0, t: 0 };
  if (f.n >= 5 && Date.now() - f.t < 15 * 60000) return res.status(429).send(loginPage('Too many attempts. Try again later.'));
  const u = (await pool.query('SELECT * FROM users WHERE username=$1', [req.body.username || ''])).rows[0];
  if (u && await bcrypt.compare(req.body.password || '', u.pass_hash)) { fails.delete(ip); req.session = { uid: u.id }; return res.redirect('/'); }
  fails.set(ip, { n: f.n + 1, t: Date.now() }); res.status(401).send(loginPage('Invalid username or password'));
});
app.get('/logout', (req, res) => { req.session = null; res.redirect('/login'); });
app.use((req, res, next) => req.session?.uid ? next() : res.redirect('/login'));
['catalog', 'purchases', 'orders', 'ops'].forEach(m => require('./' + m)(app));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Server error'); });

async function ensureOwner() {
  if ((await pool.query('SELECT 1 FROM users LIMIT 1')).rowCount) return;
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
  await pool.query('INSERT INTO users(username,pass_hash) VALUES($1,$2)', [process.env.ADMIN_USER || 'owner', await bcrypt.hash(pw, 10)]);
  if (!process.env.ADMIN_PASSWORD) console.log('Generated owner password:', pw);
}
(async () => {
  await migrate(); await ensureOwner();
  if (process.env.SEED_DEMO === '1') await require('../db/seed')(pool);
  const port = process.env.PORT || 3000; app.listen(port, () => console.log('BD ALL PRO listening on', port));
})().catch(e => { console.error(e); process.exit(1); });
