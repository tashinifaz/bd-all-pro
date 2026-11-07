const express = require('express'), session = require('cookie-session'), bcrypt = require('bcryptjs'), crypto = require('crypto');
const pool = require('./db'), migrate = require('../db/migrate');
const { esc } = require('./lib');
const { head, foot, logo, themeBtn, SPRITE, bn, ver } = require('./views');
const app = express();
const prod = process.env.NODE_ENV === 'production';
const secret = process.env.SESSION_SECRET || (prod ? null : 'dev-secret');
if (!secret) { console.error('SESSION_SECRET is required'); process.exit(1); }
app.set('trust proxy', 1); app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(session({ name: 'bdap', keys: [secret], maxAge: 8 * 3600 * 1000, httpOnly: true, sameSite: 'lax', secure: prod }));
app.use((req, res, next) => { res.set({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' }); next(); });
app.use(require('./gzip')); // built-in zlib only; compresses text assets and HTML/JSON
// shared assets (css/js/logo): public only, cached 7 days (file URLs carry ?v=mtime), registered before auth so /login can use them
app.use(express.static(require('path').join(__dirname, '..', 'public'), { maxAge: '7d' }));
require('./reports')(app); // /health and /version only, registered before auth
// CSRF defence in depth: same-origin POSTs only (plus SameSite=Lax cookie)
app.use((req, res, next) => {
  if (req.method === 'POST') { const o = req.get('origin'); if (o) { let h = ''; try { h = new URL(o).host; } catch (e) {} if (h !== req.get('host')) return res.status(403).send('Bad origin'); } }
  next();
});
const fails = new Map();
const loginPage = (err) => `<!doctype html><html lang=en><head>${head('Login · BD ALL PRO')}<link rel=stylesheet href="/login.css?v=${ver('login.css')}"></head><body>${SPRITE}${themeBtn('ib lt')}<div class=lg><div class=lc>
<div class=lh>${logo(72)}<h1>BD ALL PRO</h1></div><div class=card>${err ? `<div class=err role=alert>${esc(err)}</div>` : ''}<form method=post action=/login>
<label for=u>${bn('Username', 'ইউজারনেম')}</label><input id=u name=username placeholder="Username" autocomplete=username autocapitalize=none autofocus>
<label for=p>${bn('Password', 'পাসওয়ার্ড')}</label><input id=p name=password type=password placeholder="Password" autocomplete=current-password>
<button type=submit>${bn('Sign in', 'লগইন করুন')}</button></form></div></div></div>${foot()}</body></html>`;
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
app.use(require('./access').load); // loads req.user (id, username, role, prefs, biz) once per request
['catalog', 'purchases', 'orders', 'ops', 'dash', 'forms', 'scan', 'settings'].forEach(m => require('./' + m)(app));
require('./reports').pages(app);
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
