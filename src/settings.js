// /settings (Phase 5): bottom bar items, theme, tour replay, business name. Per-user prefs live in user_prefs(user_id,key,value).
const { get, post, pool } = require('./web');
const { esc, arr } = require('./lib');
const { page, token, bn, icon, ALL, byKey, barKeys, ver } = require('./views');
const { can, requireRole } = require('./access');
const { audit } = require('./lib');
const BAR_MAX = 4;
const setPref = (c, uid, k, v) => c.query('INSERT INTO user_prefs(user_id,key,value) VALUES($1,$2,$3) ON CONFLICT(user_id,key) DO UPDATE SET value=EXCLUDED.value', [uid, k, v]);
// Preferences the browser may save via POST /api/pref (key -> validator)
const PREF_API = { tour: v => v === '1' };

module.exports = app => {
  app.get('/settings', get(async req => {
    const on = barKeys().filter(k => k !== 'more'), list = on.map(byKey).concat(ALL.filter(p => !on.includes(p.k)));
    const row = p => `<li data-k=${p.k} class="${on.includes(p.k) ? 'on' : ''}"><label><input type=checkbox name=bar value=${p.k}${on.includes(p.k) ? ' checked' : ''}>${icon(p.icon)}<span>${bn(p.en, p.bn)}</span></label>
<span class=mv><button type=button class="ib gray" data-mv=-1 aria-label="Move ${esc(p.en)} up">↑</button><button type=button class="ib gray" data-mv=1 aria-label="Move ${esc(p.en)} down">↓</button></span></li>`;
    const t = () => token();
    return page('Settings', `<link rel=stylesheet href="/help.css?v=${ver('help.css')}"><div id=stg>
<div class=card><h3>${bn('Bottom bar', 'নিচের মেনু')}</h3><p class=k>${bn('Phone menu. Tick up to 4 pages and use the arrows to reorder. "More" is always last.', 'ফোনের মেনু। সর্বোচ্চ ৪টি পেজ টিক দিন, তীর দিয়ে সাজান। "আরও" সবসময় শেষে।')}</p>
<form method=post action=/settings/bar>${t()}<ul class=bl id=barlist>${list.map(row).join('')}<li class=fix><span>${icon('more')} ${bn('More', 'আরও')} <small class=bn>always last · সবসময় শেষে</small></span></li></ul>
<p class=k id=barcnt role=status>${on.length} / ${BAR_MAX}</p><button type=submit>${bn('Save', 'সেভ করুন')}</button></form>
<form method=post action=/settings/bar/reset>${t()}<button class=gray type=submit>${bn('Reset to default', 'আগের মতো করুন')}</button></form></div>
<div class=card><h3>${bn('Theme', 'থিম')}</h3><p class=k>${bn('Saved on this device.', 'এই ডিভাইসে সেভ থাকে।')}</p><div class=thm>
<button type=button class=gray data-th=light>${bn('Light', 'আলো')}</button><button type=button class=gray data-th=dark>${bn('Dark', 'অন্ধকার')}</button><button type=button class=gray data-th=auto>${bn('Follow device', 'ডিভাইস অনুযায়ী')}</button></div></div>
<div class=card><h3>${bn('Guided tour', 'গাইডেড ট্যুর')}</h3><p class=k>${bn('A short walk through the main parts of the app.', 'অ্যাপের মূল অংশগুলোর ছোট পরিচিতি।')}</p><button type=button class=gray data-tour>${bn('Replay tour', 'আবার দেখুন')}</button></div>
${can(req, 'settings.business') ? `<div class=card><h3>${bn('Business name', 'দোকানের নাম')}</h3><form method=post action=/settings/business>${t()}<label for=biz>${bn('Name shown on the dashboard', 'ড্যাশবোর্ডে যে নাম দেখাবে')}</label>
<input id=biz name=business value="${esc(req.user.biz)}" maxlength=60 required placeholder="BD ALL PRO"><button type=submit>${bn('Save', 'সেভ করুন')}</button></form></div>` : ''}</div>`, { ok: req.query.ok, err: req.query.err });
  }));
  app.post('/settings/bar', post('/settings', async (req, c) => {
    const ks = arr(req.body.bar).map(String);
    if (!ks.length) throw new Error('Pick at least one page · কমপক্ষে একটি পেজ বেছে নিন');
    if (ks.length > BAR_MAX || new Set(ks).size !== ks.length || !ks.every(k => ALL.some(p => p.k === k))) throw new Error('Choose up to 4 different pages · সর্বোচ্চ ৪টি আলাদা পেজ বেছে নিন');
    await setPref(c, req.user.id, 'bar', ks.join(','));
    return { ok: 'Bottom bar saved · সেভ হয়েছে' };
  }));
  app.post('/settings/bar/reset', post('/settings', async (req, c) => {
    await c.query("DELETE FROM user_prefs WHERE user_id=$1 AND key='bar'", [req.user.id]);
    return { ok: 'Back to default · আগের মতো হয়েছে' };
  }));
  app.post('/settings/business', requireRole('owner'), post('/settings', async (req, c) => {
    const v = String(req.body.business || '').trim().slice(0, 60);
    if (!v) throw new Error('Enter a name · নাম লিখুন');
    await c.query("INSERT INTO settings(k,v) VALUES('business',$1) ON CONFLICT(k) DO UPDATE SET v=EXCLUDED.v", [v]);
    await audit(c, 'settings_business', v);
    return { ok: 'Name saved · সেভ হয়েছে' };
  }));
  // tiny JSON endpoint for UI flags (e.g. tour done); same-origin check applies globally
  app.post('/api/pref', async (req, res) => {
    const k = String(req.body.k || ''), v = String(req.body.v || '');
    if (!PREF_API[k] || !PREF_API[k](v)) return res.status(400).json({ ok: false });
    try { await setPref(pool, req.user.id, k, v); res.json({ ok: true }); } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
  });
};
