// Pop-up forms (Phase 3). GET /f/:name -> JSON {t, b, html}. Registered AFTER the auth gate.
// Every field name and POST route is the same as the full-page forms; the POST handlers live in catalog/orders/purchases/ops.
// To add a form: add an entry to FORMS (async db => {t, b, html}) and use data-form="<name>" on any link.
const { pool } = require('./web');
const { token, opts, bn } = require('./views');
const { esc, today, BUCKETS } = require('./lib');

const BL = { good: 'Good · ভালো', reserved: 'Reserved · রিজার্ভ', needs_repair: 'Needs repair · মেরামত দরকার', under_repair: 'Under repair · মেরামতে', awaiting_approval: 'Awaiting approval · অনুমোদনের অপেক্ষায়', damaged: 'Damaged · নষ্ট' };
const CATS = ['advertising', 'courier', 'packaging', 'repair', 'salary', 'website/hosting', 'payment fees', 'transport', 'other'];
const CAT_BN = { advertising: 'বিজ্ঞাপন', courier: 'কুরিয়ার', packaging: 'প্যাকেজিং', repair: 'মেরামত', salary: 'বেতন', 'website/hosting': 'ওয়েবসাইট', 'payment fees': 'পেমেন্ট ফি', transport: 'যাতায়াত', other: 'অন্যান্য' };
const SC = (k, extra = '') => `<button type=button class="btn gray sc" data-scan="${k}" ${extra}>${bn('Scan', 'স্ক্যান')}</button>`;
const q = (db, s) => db.query(s).then(r => r.rows);
const accounts = db => q(db, 'SELECT * FROM financial_accounts ORDER BY id');
const products = db => q(db, `SELECT p.id,p.sku,p.name,p.price,p.default_cost,COALESCE((SELECT qty FROM stock_balances WHERE product_id=p.id AND bucket='good'),0) good FROM products p WHERE archived=false ORDER BY name`);

const L = (en, b, hintTxt) => `<label>${bn(en, b)}</label>`;
const more = inner => `<details class=more><summary>${bn('More options', 'আরও অপশন')}</summary><div class=mb>${inner}</div></details>`;
const form = (action, body, en, b, calc) => `<form method=post action="${action}" class=pf${calc ? ' data-calc=1' : ''}>${token()}<div class=fe role=alert hidden></div>${body}<div class=df><button type=submit>${bn(en, b)}</button></div></form>`;
const sel = (name, inner, req) => `<select name=${name}${req ? ' required' : ''}>${inner}</select>`;
const num = (name, ph, extra = '') => `<input type=number inputmode=decimal step=0.01 min=0 name=${name} placeholder="${ph}" ${extra}>`;
// one product line; lines 2+ are hidden until "+ Add another product"
const lines = (prods, n, kind) => Array.from({ length: n }, (_, i) => {
  const po = prods.map(p => `<option value="${p.id}" data-p="${kind === 'order' ? p.price : p.default_cost}">${esc(p.sku + ' · ' + p.name)}${kind === 'order' ? ` (${p.good} left)` : ''}</option>`).join('');
  const price = kind === 'order' ? `${L('Price (blank = normal price)', 'দাম (খালি = সাধারণ দাম)')}${num('price', 'Normal price')}` : `${L('Unit cost', 'প্রতি পিস দাম')}${num('unit_cost', 'e.g. 850')}`;
  return `<div class=ln${i ? ' hidden' : ''}><div class=row><div>${L('Product ' + (i + 1), 'পণ্য ' + (i + 1))}<select name=product_id><option value="">— Choose · বাছাই করুন —</option>${po}</select></div>
    <div>${L('Quantity', 'পরিমাণ')}<input type=number inputmode=numeric min=0 name=qty placeholder="1"></div></div>
    <details class=more><summary>${bn('Price / serial', 'দাম / সিরিয়াল')}</summary><div class=mb>${price}${L('Serial / IMEI (one per line, only for tracked items)', 'সিরিয়াল / IMEI (প্রতি লাইনে একটি)')}<textarea name=serials rows=2 placeholder="Type, paste or scan"></textarea>${SC(kind === 'order' ? 'order' : 'serials')}</div></details></div>`;
}).join('') + `<button type=button class="btn gray" data-add>${bn('+ Add another product', 'আরেকটি পণ্য')}</button>`;

const FORMS = {
  order: async db => {
    const [prods, accs] = await Promise.all([products(db), accounts(db)]);
    return { t: 'New order', b: 'নতুন অর্ডার', html: form('/orders', `<div class=row><div>${L('Customer name', 'কাস্টমার নাম')}<input name=name required autocomplete=off placeholder="e.g. Rahim"></div>
      <div>${L('Phone', 'ফোন')}<input name=phone required type=tel inputmode=tel placeholder="01XXXXXXXXX"></div></div>${lines(prods, 5, 'order')}
      <div class=tot data-total aria-live=polite></div>
      ${more(`<div class=row><div>${L('Address', 'ঠিকানা')}<input name=address placeholder="Delivery address"></div>
        <div>${L('Channel', 'কোথা থেকে')}<select name=channel><option>WhatsApp</option><option>Facebook</option><option>Phone</option><option>Other</option></select></div>
        <div>${L('Date', 'তারিখ')}<input type=date name=odate value="${today()}"></div></div>
        <div class=row><div>${L('Discount', 'ছাড়')}${num('discount', '0', 'value=0')}</div><div>${L('Delivery fee charged', 'ডেলিভারি চার্জ')}${num('delivery_fee', '0', 'value=0')}</div>
        <div>${L('Advance received', 'অগ্রিম পেয়েছি')}${num('advance', '0', 'value=0')}</div><div>${L('Advance into', 'অগ্রিম কোথায়')}${sel('account_id', opts(accs))}</div></div>
        ${L('Note', 'নোট')}<input name=note placeholder="Optional">`)}`, 'Confirm order', 'অর্ডার নিশ্চিত করুন', 1) };
  },
  expense: async db => {
    const accs = await accounts(db);
    return { t: 'Add expense', b: 'খরচ যোগ', html: form('/expenses', `${L('Amount', 'টাকার পরিমাণ')}<input type=number inputmode=decimal step=0.01 min=0.01 name=amount required placeholder="e.g. 500" autofocus>
      ${L('Category', 'ধরন')}<select name=category>${CATS.map(x => `<option value="${x}">${x} · ${CAT_BN[x]}</option>`).join('')}</select>
      ${L('Paid from', 'কোথা থেকে দিলাম')}${sel('account_id', opts(accs))}
      ${more(`<div class=row><div>${L('Date', 'তারিখ')}<input type=date name=date value="${today()}"></div><div>${L('Payee', 'কাকে দিলাম')}<input name=payee placeholder="Who was paid"></div></div>${L('Note', 'নোট')}<input name=note placeholder="Optional">`)}`, 'Save expense', 'খরচ সেভ করুন') };
  },
  purchase: async db => {
    const [prods, sups, accs] = await Promise.all([products(db), q(db, 'SELECT * FROM suppliers WHERE active ORDER BY name'), accounts(db)]);
    return { t: 'New purchase', b: 'নতুন কেনাকাটা', html: form('/purchases', `${L('Supplier', 'সরবরাহকারী')}${sel('supplier_id', opts(sups))}${lines(prods, 5, 'purchase')}
      <div class=tot data-total aria-live=polite></div>
      <div class=row><div>${L('Paid now', 'এখন দিলাম')}${num('paid', '0', 'value=0')}</div><div>${L('Paid from', 'কোথা থেকে দিলাম')}${sel('account_id', opts(accs))}</div></div>
      ${more(`<div class=row><div>${L('Invoice no.', 'ইনভয়েস নং')}<input name=invoice_no placeholder="Optional"></div><div>${L('Date', 'তারিখ')}<input type=date name=pdate value="${today()}"></div></div>
        <div class=row><div>${L('Discount', 'ছাড়')}${num('discount', '0', 'value=0')}</div><div>${L('Extra cost (transport etc.)', 'বাড়তি খরচ (যাতায়াত ইত্যাদি)')}${num('extra_cost', '0', 'value=0')}</div></div>${L('Note', 'নোট')}<input name=note placeholder="Optional">`)}`, 'Save purchase', 'কেনাকাটা সেভ করুন', 1) };
  },
  product: async db => {
    const cats = await q(db, 'SELECT * FROM categories ORDER BY name');
    return { t: 'Add product', b: 'পণ্য যোগ', html: form('/products', `${L('Name', 'নাম')}<input name=name required autocomplete=off placeholder="e.g. Neckband X1" autofocus>
      <div class=row><div>${L('SKU (short code)', 'SKU (ছোট কোড)')}<input name=sku required autocapitalize=characters placeholder="e.g. NB-X1"></div><div>${L('Selling price', 'বিক্রয় দাম')}${num('price', 'e.g. 1200', 'value=0')}</div></div>
      ${L('Category', 'ক্যাটাগরি')}${sel('category_id', opts(cats))}
      ${more(`<div class=row><div>${L('Brand', 'ব্র্যান্ড')}<input name=brand></div><div>${L('Model', 'মডেল')}<input name=model></div>
        <div>${L('Default cost', 'কেনা দাম')}${num('default_cost', '0', 'value=0')}</div><div>${L('Low-stock alert at', 'কম স্টক সতর্কতা')}<input type=number min=0 name=min_stock value=0></div>
        <div>${L('Barcode', 'বারকোড')}<input name=barcode data-noenter placeholder=\"Type or scan\">${SC('barcode')}</div></div>
        <div class=row><div>${L('Opening quantity (already in stock)', 'শুরুর স্টক (আগে থেকে আছে)')}<input type=number inputmode=numeric min=0 name=open_qty value=0></div></div>
        ${L('Opening serials / IMEI (one per line, tracked items)', 'শুরুর সিরিয়াল / IMEI')}<textarea name=open_serials rows=2 placeholder=\"Type, paste or scan\"></textarea>${SC('serials', 'data-t=open_serials data-q=open_qty')}
        ${L('Description', 'বিবরণ')}<textarea name=description rows=2></textarea><label class=chk><input type=checkbox name=serialized value=1> ${bn('Track serial / IMEI per unit', 'প্রতি পিসের সিরিয়াল / IMEI রাখুন')}</label>`)}`, 'Save product', 'পণ্য সেভ করুন') };
  },
  adjust: async db => {
    const prods = await products(db);
    return { t: 'Adjust stock', b: 'স্টক ঠিক করুন', html: form('/stock/adjust', `<p class=k>${bn('Type what you counted. The difference is saved with your reason.', 'যা গুনেছেন তা লিখুন। পার্থক্য কারণসহ সেভ হবে।')}</p>
      ${L('Product', 'পণ্য')}<select name=product_id required><option value="">— Choose · বাছাই করুন —</option>${prods.map(p => `<option value="${p.id}">${esc(p.sku + ' · ' + p.name)} (${p.good} good)</option>`).join('')}</select>
      ${L('Counted quantity', 'গোনা পরিমাণ')}<input type=number inputmode=numeric min=0 name=counted required placeholder="e.g. 12">
      ${L('Reason', 'কারণ')}<input name=reason required placeholder="e.g. Physical count" list=adj-r autocomplete=off><datalist id=adj-r><option value="Physical count"><option value="Damaged"><option value="Found extra"><option value="Lost / missing"><option value="Correction"></datalist>
      ${more(`${L('Condition', 'অবস্থা')}<select name=bucket>${BUCKETS.map(b => `<option value=${b}>${BL[b]}</option>`).join('')}</select>`)}`, 'Apply', 'প্রয়োগ করুন') };
  },
  repair: async db => {
    const prods = await products(db);
    return { t: 'New repair ticket', b: 'নতুন মেরামত টিকিট', html: form('/repairs', `${L('Product', 'পণ্য')}<select name=product_id required><option value="">— Choose · বাছাই করুন —</option>${prods.map(p => `<option value="${p.id}">${esc(p.sku + ' · ' + p.name)}</option>`).join('')}</select>
      ${L('What is the fault?', 'সমস্যা কী?')}<input name=fault required placeholder="e.g. No charging" autocomplete=off>
      ${L('Quantity', 'পরিমাণ')}<input type=number inputmode=numeric min=1 name=qty value=1>
      ${more(`${L('Unit is currently in', 'পণ্যটি এখন কোথায়')}<select name=source><option value=good>Good stock · ভালো স্টক</option><option value=needs_repair>Already in Needs-repair · আগে থেকেই মেরামত তালিকায়</option></select>
        ${L('Serial / IMEI', 'সিরিয়াল / IMEI')}<input name=serial data-noenter placeholder="Optional">${SC('repair')}<div class=row><div>${L('Technician / shop', 'মেকানিক / দোকান')}<input name=shop></div><div>${L('Warranty details', 'ওয়ারেন্টি')}<input name=warranty></div></div>`)}`, 'Create ticket', 'টিকিট তৈরি করুন') };
  },
};

module.exports = app => {
  app.get('/f/:name', async (req, res) => {
    const f = Object.prototype.hasOwnProperty.call(FORMS, req.params.name) && FORMS[req.params.name];
    if (!f) return res.status(404).json({ error: 'unknown form' });
    try { res.set('Cache-Control', 'no-store').json(await f(pool)); }
    catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
  });
};
module.exports.FORMS = FORMS;
