const { esc, taka, today } = require('./lib');
const crypto = require('crypto'), als = require('./ctx');
const fs = require('fs'), path = require('path');

// ---- helpers -------------------------------------------------------------------------------------------
// bn(en, bangla): English text + small muted Bangla hint. Both are escaped.
const bn = (en, b) => esc(en) + (b ? ` <small class=bn>${esc(b)}</small>` : '');
// icon(name, cls): <svg> referencing a <symbol id="i-name"> in SPRITE
const icon = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden=true focusable=false><use href="#i-${n}"/></svg>`;
const ver = f => { try { return Math.floor(fs.statSync(path.join(__dirname, '..', 'public', f)).mtimeMs / 1000).toString(36); } catch (e) { return '0'; } };

// ---- navigation data -----------------------------------------------------------------------------------
// All pages. group: main | manage. To add a page: add a row here (and an icon in SPRITE).
const PAGES = [
  { k: 'dashboard', href: '/', en: 'Dashboard', bn: 'ড্যাশবোর্ড', icon: 'dash', group: 'main' },
  { k: 'orders', href: '/orders', en: 'Orders', bn: 'অর্ডার', icon: 'orders', group: 'main' },
  { k: 'stock', href: '/stock', en: 'Stock', bn: 'স্টক', icon: 'stock', group: 'main' },
  { k: 'repairs', href: '/repairs', en: 'Repairs', bn: 'মেরামত', icon: 'repairs', group: 'main' },
  { k: 'products', href: '/products', en: 'Products', bn: 'পণ্য', icon: 'tag', group: 'manage' },
  { k: 'purchases', href: '/purchases', en: 'Purchases', bn: 'কেনাকাটা', icon: 'cart', group: 'manage' },
  { k: 'expenses', href: '/expenses', en: 'Expenses', bn: 'খরচ', icon: 'receipt', group: 'manage' },
  { k: 'accounts', href: '/accounts', en: 'Accounts', bn: 'হিসাব', icon: 'wallet', group: 'manage' },
  { k: 'reports', href: '/reports', en: 'Reports', bn: 'রিপোর্ট', icon: 'chart', group: 'manage' },
];
const SETTINGS_PAGE = { k: 'settings', href: '/settings', en: 'Settings', bn: 'সেটিংস', icon: 'gear', group: 'main' };
const ALL = PAGES.concat(SETTINGS_PAGE); // every page a user can put in the bottom bar
// Mobile bottom bar DEFAULT. Keys of ALL, plus 'more' (always last; opens the sheet with every page not in the bar). Per-user choice: barKeys().
const BOTTOM_ITEMS = ['dashboard', 'orders', 'stock', 'repairs', 'more'];
// Signed-in user for this request ({id,username,role,prefs,biz}), set by access.load(); null on the login page
const me = () => als.getStore() || null;
const barKeys = () => {
  const u = me(), ks = String((u && u.prefs.bar) || '').split(',').filter((k, i, a) => ALL.some(p => p.k === k) && a.indexOf(k) === i).slice(0, 4);
  return (ks.length ? ks : BOTTOM_ITEMS.slice(0, 4)).concat('more');
};
// Page-title Bangla hints (titles not listed here, e.g. order numbers or product names, get none)
const TITLE_BN = {
  'Dashboard': 'ড্যাশবোর্ড', 'Orders': 'অর্ডার', 'Products': 'পণ্য', 'Purchases & suppliers': 'কেনাকাটা ও সরবরাহকারী', 'Repairs': 'মেরামত',
  'Expenses': 'খরচ', 'Accounts & cashbook': 'হিসাব ও ক্যাশবুক', 'Stock by condition': 'অবস্থা অনুযায়ী স্টক', 'Reports': 'রিপোর্ট',
  'Not found': 'পাওয়া যায়নি', 'Error': 'সমস্যা হয়েছে', 'Settings': 'সেটিংস', 'Not allowed': 'অনুমতি নেই',
};

// ---- icons: one inline sprite, rendered once per page --------------------------------------------------
const S = {
  dash: '<rect x=3 y=3 width=7 height=9 rx=2 /><rect x=14 y=3 width=7 height=5 rx=2 /><rect x=14 y=12 width=7 height=9 rx=2 /><rect x=3 y=16 width=7 height=5 rx=2 />',
  orders: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  stock: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  repairs: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  more: '<circle cx=5 cy=12 r=1.6 /><circle cx=12 cy=12 r=1.6 /><circle cx=19 cy=12 r=1.6 />',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx=7.5 cy=7.5 r=1.3 />',
  cart: '<circle cx=9 cy=20 r=1.5 /><circle cx=18 cy=20 r=1.5 /><path d="M3 4h2.5l2.2 11h10.6l2-8H6.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h12v4"/><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z"/><circle cx=16.5 cy=14 r=1 />',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  gear: '<circle cx=12 cy=12 r=3 /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  sun: '<circle cx=12 cy=12 r=4 /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  chevl: '<path d="M15 6l-6 6 6 6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  clock: '<circle cx=12 cy=12 r=9 /><path d="M12 7v5l3 2"/>',
  down: '<path d="M12 4v14M6 12l6 6 6-6"/>',
  up: '<path d="M12 20V6M6 12l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const SPRITE = `<svg width=0 height=0 style="position:absolute" aria-hidden=true focusable=false>${Object.entries(S).map(([n, p]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${p}</symbol>`).join('')}</svg>`;

// ---- <head>: shared by app pages and the login page ----------------------------------------------------
// Runs before first paint: applies saved theme (else device setting) and sidebar state, so there is no flash.
const HEAD_JS = `var d=document.documentElement,t,m;try{t=localStorage.getItem('bdap-theme');m=localStorage.getItem('bdap-side')}catch(e){}
if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';
d.dataset.theme=t;if(m==='min')d.dataset.side='min';document.getElementById('tc').content=t==='light'?'#e9eaec':'#0e0e10'`;
const head = title => `<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=color-scheme content="dark light">
<meta name=theme-color id=tc content="#0e0e10"><title>${esc(title)}</title><link rel=icon type=image/png href="/icon-64.png"><link rel=apple-touch-icon href="/icon-180.png">
<script>${HEAD_JS}</script><link rel=stylesheet href="/app.css?v=${ver('app.css')}"><link rel=stylesheet href="/print.css?v=${ver('print.css')}" media=print>`;
const foot = () => `<script src="/app.js?v=${ver('app.js')}" data-fv="${ver('forms.css')}" data-sv="${ver('scan.js')}" data-hv="${ver('help.js')}" data-cv="${ver('help.css')}"></script>`; // data-fv/sv/hv = cache-bust for lazy forms.css, scan.js, help.js
const logo = h => `<img src="/logo-mark.png" width=${Math.round(h * 114 / 96)} height=${h} alt="">`;
const themeBtn = (cls, label) => `<button type=button class="${cls}" data-act=theme aria-label="Switch light / dark theme" title="Theme">${icon('sun', 'ts')}${icon('moon', 'tm')}${label || ''}</button>`;

// ---- shell parts ---------------------------------------------------------------------------------------
const byKey = k => ALL.find(p => p.k === k);
const helpBtn = cls => `<button type=button class="${cls} hb noprint" data-help aria-label="Help for this page · এই পেজের সাহায্য" title="Help">?</button>`;
const navLink = (p, cls, inner) => `<a class="${cls}" href="${p.href}" data-nav title="${esc(p.en)}">${icon(p.icon)}${inner}</a>`;
const sidebar = () => {
  const grp = (g, en, b) => `<div class=gl>${bn(en, b)}</div>` + PAGES.filter(p => p.group === g).map(p => navLink(p, 'ni', `<span class=lab>${bn(p.en, p.bn)}</span>`)).join('');
  return `<aside class=side aria-label="Menu"><a class=brand href="/" aria-label="BD ALL PRO home">${logo(32)}<b>BD ALL PRO</b></a><nav>
${grp('main', 'Main', 'মূল')}${grp('manage', 'Manage', 'পরিচালনা')}</nav><div class=sfoot>
${navLink(SETTINGS_PAGE, 'ni', `<span class=lab>${bn(SETTINGS_PAGE.en, SETTINGS_PAGE.bn)}</span>`)}
${themeBtn('ni', `<span class=lab>${bn('Theme', 'থিম')}</span>`)}
<a class=ni href="/logout" title="Logout">${icon('logout')}<span class=lab>${bn('Logout', 'বের হন')}</span></a>
<button type=button class="ni col" data-act=collapse aria-label="Collapse or expand menu" title="Collapse menu">${icon('chevl')}<span class=lab>${bn('Collapse', 'ছোট করুন')}</span></button></div></aside>`;
};
const topbar = title => `<header class=top><a href="/" aria-label="BD ALL PRO home">${logo(30)}</a><div class=tt>${bn(title, TITLE_BN[title])}</div>${helpBtn('ib')}${themeBtn('ib')}</header>`;
const bottombar = (items = barKeys()) => `<nav class=bar aria-label="Quick menu">${items.map(k => {
  if (k === 'more') return `<button type=button class=bi data-act=more aria-haspopup=dialog aria-expanded=false>${icon('more')}<span>${bn('More', 'আরও')}</span></button>`;
  const p = byKey(k); return p ? navLink(p, 'bi', `<span>${bn(p.en, p.bn)}</span>`) : '';
}).join('')}</nav>`;
const moreSheet = (items = barKeys()) => `<div class=sheet id=sheet hidden><div class=sbg data-act=close></div><div class=sp role=dialog aria-modal=true aria-label="More pages" tabindex=-1>
<div class=sgrip></div><div class=sh><span>${bn('More', 'আরও')}</span><button type=button class="ib" data-act=close aria-label="Close">${icon('close')}</button></div><div class=sg>
${ALL.filter(p => !items.includes(p.k)).map(p => navLink(p, 'si', `<span>${bn(p.en, p.bn)}</span>`)).join('')}</div>
<div class=srow>${themeBtn('btn gray', `<span>${bn('Theme', 'থিম')}</span>`)}<a class="btn gray" href="/logout">${icon('logout')}<span>${bn('Logout', 'বের হন')}</span></a></div></div></div>`;

// One primary action per list page, always in the page header (same place everywhere). Key = page title. [form key, fallback href, English, Bangla]
const PRIMARY = { 'Orders': ['order', '/orders', '+ New order', 'নতুন অর্ডার'], 'Products': ['product', '/products', '+ Add product', 'পণ্য যোগ করুন'], 'Purchases & suppliers': ['purchase', '/purchases', '+ New purchase', 'নতুন কেনা'],
  'Repairs': ['repair', '/repairs', '+ New repair', 'নতুন মেরামত'], 'Expenses': ['expense', '/expenses', '+ Expense', 'খরচ যোগ করুন'], 'Stock by condition': ['adjust', '/stock', 'Adjust stock', 'স্টক ঠিক করুন'], 'Accounts & cashbook': ['', '#transfer', 'Transfer money', 'টাকা সরান'] };
const primary = t => { const p = PRIMARY[t]; return p ? `<a class="btn pa noprint" href="${p[1]}"${p[0] ? ` data-form="${p[0]}"` : ''}>${bn(p[2], p[3])}</a>` : ''; };
// Bangla hints for plain English <label>s in older pages. Edit wording here; labels not listed stay as they are.
const LABEL_BN = { 'Date': 'তারিখ', 'Note': 'নোট', 'From': 'থেকে', 'To': 'পর্যন্ত', 'Category': 'ধরন', 'Qty': 'পরিমাণ', 'Product': 'পণ্য', 'Paid from': 'যে হিসাব থেকে দেওয়া', 'Name': 'নাম', 'Amount': 'টাকা',
  'Phone': 'ফোন', 'Discount': 'ছাড়', 'Courier': 'কুরিয়ার', 'Condition': 'অবস্থা', 'Address': 'ঠিকানা', 'Warranty details': 'ওয়ারেন্টির তথ্য', 'Unit cost': 'একক দাম', 'Type': 'ধরন', 'Supplier': 'সরবরাহকারী',
  'Status': 'অবস্থা', 'Shop': 'দোকান', 'SKU': 'কোড', 'Model': 'মডেল', 'Brand': 'ব্র্যান্ড', 'Selling price': 'বিক্রয় মূল্য', 'Reason': 'কারণ', 'Reason (required)': 'কারণ (জরুরি)', 'Payee': 'যাকে দেওয়া', 'Paid now': 'এখন দেওয়া',
  'Opening balance': 'শুরুর ব্যালেন্স', 'Invoice no.': 'ইনভয়েস নম্বর', 'Fault': 'সমস্যা', 'Description': 'বিবরণ', 'Default cost': 'সাধারণ ক্রয়মূল্য', 'Delivery fee charged': 'ডেলিভারি চার্জ', 'Delivered date': 'পৌঁছানোর তারিখ',
  'Dispatch date': 'পাঠানোর তারিখ', 'Sent date': 'পাঠানোর তারিখ', 'Returned date': 'ফেরতের তারিখ', 'Expected back': 'ফেরত আসার সম্ভাব্য তারিখ', 'Low-stock threshold': 'কম স্টকের সীমা', 'Repair cost (0 if warranty)': 'মেরামত খরচ (ওয়ারেন্টি হলে ০)',
  'Technician / shop': 'মিস্ত্রি / দোকান', 'Tracking / consignment ID': 'ট্র্যাকিং আইডি', 'Serial/IMEI (optional)': 'সিরিয়াল/আইএমইআই (ঐচ্ছিক)', 'Serial (if tracked)': 'সিরিয়াল (থাকলে)', 'Refund to customer': 'কাস্টমারকে ফেরত',
  'Net payout into': 'নিট টাকা যে হিসাবে ঢুকবে', 'Price (blank = default)': 'দাম (খালি = সাধারণ দাম)', 'Qty (from good stock)': 'পরিমাণ (ভালো স্টক থেকে)', 'Search name / SKU / brand / model / serial': 'নাম / কোড / ব্র্যান্ড / মডেল / সিরিয়াল দিয়ে খুঁজুন' };
const withBn = h => h.replace(/<label([^>]*)>([^<]+)<\/label>/g, (m, a, t) => LABEL_BN[t] ? `<label${a}>${t} <small class=bn>${LABEL_BN[t]}</small></label>` : m);
const page = (title, body, msg) => `<!doctype html><html lang=en><head>${head(title + ' · BD ALL PRO')}</head><body${me() && !me().prefs.tour ? ' data-first=1' : ''}>${SPRITE}<a class=skip href="#main">Skip to content</a>
${sidebar()}${topbar(title)}<main id=main>
${msg?.err ? `<div class=err role=alert>${esc(msg.err)}</div>` : ''}${msg?.ok ? `<div class=ok role=status>${esc(msg.ok)}</div>` : ''}
<div class=ph><h1 class=ptitle>${bn(title, TITLE_BN[title])}</h1>${helpBtn('ib')}${primary(title)}</div>${withBn(body)}</main>${bottombar()}${moreSheet()}${foot()}</body></html>`;
const token = () => `<input type=hidden name=_t value="${crypto.randomUUID()}">`;
const table = (cols, rows, raw = [], o = {}) => {
  if (!rows.length && o.empty) { const e = o.empty; return `<div class=empty><p>${bn(e[0], e[1])}</p><a class=btn href="${e[2]}" data-form="${e[3]}">${bn(e[4], e[5])}</a></div>`; }
  return `<div class=w><table${o.st ? ' class=st' : ''}><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr>${rows.map(r =>
    `<tr>${cols.map(c => `<td data-l="${esc(c[0])}">${raw.includes(c[1]) ? r[c[1]] : esc(r[c[1]])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan=${cols.length}>${bn('No records', 'কোনো তথ্য নেই')}</td></tr>`}</table></div>`;
};
const opts = (rows, val = 'id', lab = 'name', sel) => rows.map(r => `<option value="${esc(r[val])}"${String(sel) === String(r[val]) ? ' selected' : ''}>${esc(typeof lab === 'function' ? lab(r) : r[lab])}</option>`).join('');
const dateRange = q => {
  const t = today();
  return { from: q.from || t.slice(0, 8) + '01', to: q.to || t };
};
const rangeForm = (q, action, extra = '') => { const r = dateRange(q); return `<form class=noprint method=get action="${action}"><div class=row>
<div><label>From</label><input type=date name=from value="${r.from}"></div><div><label>To</label><input type=date name=to value="${r.to}"></div>${extra}</div>
<button>${bn('Filter', 'ফিল্টার')}</button> <a class="btn gray" href="?from=${r.from}&to=${r.to}&csv=1">CSV</a></form>`; };
module.exports = { page, token, table, opts, dateRange, rangeForm, taka, bn, icon, SPRITE, BOTTOM_ITEMS, PAGES, ALL, SETTINGS_PAGE, byKey, barKeys, me, ver, head, foot, logo, themeBtn };
