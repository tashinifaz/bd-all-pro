/* BD ALL PRO scanner (Phase 4). Lazy-loaded by app.js on the first [data-scan] tap. window.bdapScan(button).
   Native BarcodeDetector when present; otherwise lazy-loads /vendor/zxing.min.js (@zxing/library 0.21.3 UMD, see HANDOFF).
   Modes by button data-scan: serials (multi, purchase / opening stock) | order | repair | barcode | search. */
(function () {
  var d = document, FMT = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'itf', 'qr_code', 'data_matrix'], cur = null, css = 0, ac;
  function el(t, c, x) { var e = d.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function T(en, bn) { return en + ' · ' + bn; }
  function fire(i, ev) { i.dispatchEvent(new Event(ev || 'input', { bubbles: true })); }
  function luhn(s) { var n = 0, a = 0, i, x; for (i = s.length - 1; i >= 0; i--) { x = +s[i]; if (a) { x *= 2; if (x > 9) x -= 9; } n += x; a = !a; } return n % 10 === 0; }
  // IMEI: strip spaces/dashes when the text is only digits (15 digits kept as is); other serials stay as typed
  function norm(c) { var t = String(c || '').trim(), g = t.replace(/[\s-]/g, ''); return /^\d{14,17}$/.test(g) ? g : t; }
  function warnImei(c) { return /^\d{15}$/.test(c) && !luhn(c) ? T('This IMEI looks mistyped (check digit does not match). Added anyway.', 'IMEI ভুল হতে পারে, তবুও যোগ হয়েছে।') : ''; }
  function api(c) { return fetch('/api/serial/' + encodeURIComponent(c), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return null; }); }
  function beep() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = .12; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .09); } catch (e) {} }
  var ST = { reserved: 'reserved for an order', sold: 'already sold', repair: 'in repair', damaged: 'marked damaged', returned: 'returned to supplier' };
  var STB = { reserved: 'অর্ডারের জন্য রাখা', sold: 'আগেই বিক্রি', repair: 'মেরামতে', damaged: 'নষ্ট', returned: 'সাপ্লায়ারকে ফেরত' };

  // ---- per-field behaviour. Each returns Promise<{t:'ok'|'warn'|'err', m:text, done:bool, add:bool}> ----
  var H = {
    serials: function (c, x) {
      var ta = x.fld(x.b.dataset.t || 'serials'); if (!ta) return Promise.resolve({ t: 'err', m: 'Field not found' });
      var list = lines(ta);
      if (list.indexOf(c) > -1) return Promise.resolve({ t: 'err', m: T('Already in this list', 'এই তালিকায় আগেই আছে') });
      return api(c).then(function (r) {
        if (r && r.found && r.kind !== 'product') return { t: 'err', m: T(c + ' already exists: ' + r.product_name + ' (' + (ST[r.bucket] || r.status) + ')', 'সিস্টেমে আগে থেকেই আছে') };
        if (r && r.found) return { t: 'err', m: T('That is a product barcode, not a unit serial', 'এটা পণ্যের বারকোড, ইউনিটের সিরিয়াল নয়') };
        list.push(c); ta.value = list.join('\n'); fire(ta); x.count(list.length); setQty(x, list.length);
        var w = warnImei(c) || (r ? '' : T('Could not check the database, added anyway.', 'ডাটাবেস দেখা যায়নি, যোগ হয়েছে।'));
        return { t: w ? 'warn' : 'ok', m: w || '#' + list.length + ' ' + c };
      });
    },
    order: function (c, x) {
      var ta = x.fld('serials'), sel = x.fld('product_id');
      return api(c).then(function (r) {
        if (!r) return { t: 'err', m: T('Could not check. Check your connection or type it.', 'দেখা যায়নি, ইন্টারনেট দেখুন বা হাতে লিখুন') };
        if (!r.found) return { t: 'err', m: T('Not found in stock records. If this item is not tracked by serial, choose the product from the list.', 'স্টক রেকর্ডে নেই। সিরিয়াল ছাড়া পণ্য হলে তালিকা থেকে বাছুন।') };
        if (r.kind === 'repair') return { t: 'err', m: T('This unit is only in repair records, not in stock.', 'এই ইউনিট শুধু মেরামত তালিকায়, স্টকে নেই।') };
        if (!pick(sel, r.product_id)) return { t: 'err', m: T('Product is not in the list (archived?).', 'পণ্যটি তালিকায় নেই') };
        if (r.kind === 'product') return { t: 'ok', done: 1, m: T(r.product_name + ' selected. Enter the quantity.', 'পণ্য বাছা হয়েছে, পরিমাণ লিখুন') };
        if (r.bucket !== 'good') return { t: 'err', m: T(c + ' is ' + (ST[r.bucket] || r.status) + (r.ref ? ' (' + r.ref + ')' : '') + ', so it cannot be sold.', 'বিক্রি করা যাবে না: ' + (STB[r.bucket] || r.status)) };
        var list = lines(ta); if (list.indexOf(c) > -1) return { t: 'err', m: T('Already added to this order', 'এই অর্ডারে আগেই আছে') };
        list.push(c); ta.value = list.join('\n'); fire(ta); setQty(x, list.length); var dt = ta.closest('details'); if (dt) dt.open = true;
        return { t: 'ok', done: 1, m: T(r.product_name + ' · ' + c + ' added', 'যোগ হয়েছে') };
      });
    },
    repair: function (c, x) {
      var inp = x.fld('serial'), sel = x.fld('product_id'); inp.value = c; fire(inp); var dt = inp.closest('details'); if (dt) dt.open = true;
      return api(c).then(function (r) {
        if (r && r.found && r.kind !== 'product' && pick(sel, r.product_id)) return { t: 'ok', done: 1, m: T('Found: ' + r.product_name, 'পাওয়া গেছে') };
        return { t: 'warn', done: 1, m: T('Not in the system yet. Serial filled in; choose the product and continue.', 'সিস্টেমে নেই। সিরিয়াল বসেছে, পণ্য বাছুন') };
      });
    },
    barcode: function (c, x) {
      var inp = x.fld('barcode'); inp.value = c; fire(inp);
      return api(c).then(function (r) { return r && r.found && r.kind === 'product' ? { t: 'warn', done: 1, m: T('Already used by ' + r.product_name, 'আরেক পণ্যে আছে') } : { t: 'ok', done: 1, m: T('Barcode filled in', 'বারকোড বসেছে') }; });
    },
    search: function (c, x) {
      var inp = x.fld('q'); inp.value = c;
      return api(c).then(function (r) {
        if (r && r.found) location.href = '/products/' + r.product_id;
        else if (x.f) x.f.requestSubmit ? x.f.requestSubmit() : x.f.submit();
        return { t: 'ok', done: 1, m: T('Searching…', 'খোঁজা হচ্ছে…') };
      });
    }
  };
  function lines(ta) { return ta.value.split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function pick(sel, id) { if (!sel) return false; sel.value = String(id); if (sel.value !== String(id)) return false; fire(sel, 'change'); return true; }
  function setQty(x, n) { var q = x.b.dataset.q ? x.f.elements[x.b.dataset.q] : x.ln && x.ln.querySelector('[name=qty]'); if (q) { q.value = n; fire(q); } }

  function style() {
    if (css) return; css = 1; var s = el('style');
    s.textContent = '.scn{position:fixed;inset:0;z-index:2000;background:#000;color:#fff;display:flex;flex-direction:column;font:15px system-ui,sans-serif}.scn video{flex:1;min-height:0;width:100%;object-fit:cover}' +
      '.scn .st{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#000a,#0000)}.scn .st b{flex:1}' +
      '.scn button{min-height:44px;min-width:44px;border:0;border-radius:12px;padding:0 14px;font:inherit;background:#fff3;color:#fff;cursor:pointer}.scn button.p{background:var(--acc,#d4a84b);color:var(--on,#111);font-weight:600}.scn button:focus-visible,.scn input:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
      '.scn .fr{position:absolute;left:50%;top:38%;width:min(78vw,340px);height:min(40vw,170px);transform:translate(-50%,-50%);border:3px solid var(--acc,#d4a84b);border-radius:16px;box-shadow:0 0 0 100vmax #0006;pointer-events:none}' +
      '.scn .pn{background:#111;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;flex-direction:column;gap:8px}.scn .ms{min-height:22px;font-size:14px}.scn .ms.ok{color:#7ee2a0}.scn .ms.warn{color:#ffd166}.scn .ms.err{color:#ff8f8f}' +
      '.scn .mr{display:flex;gap:8px}.scn input{flex:1;min-width:0;min-height:44px;border-radius:12px;border:1px solid #fff4;background:#000;color:#fff;padding:0 12px;font:inherit}.scn .rw{display:flex;gap:8px}.scn .rw button{flex:1}';
    d.head.appendChild(s);
  }

  function start(b) {
    if (cur) cur.close();
    style();
    var f = b.closest('form'), ln = b.closest('.ln'), kind = b.dataset.scan, multi = kind === 'serials', from = d.activeElement, stream, timer, dead = 0, last = '', lastT = 0, busy = 0, torch = 0, n = 0;
    var x = { b: b, f: f, ln: ln, fld: function (nm) { return (ln && ln.querySelector('[name=' + nm + ']')) || (f && f.querySelector('[name=' + nm + ']')) || (b.parentNode && b.parentNode.querySelector('[name=' + nm + ']')); }, count: function (k) { n = k; cnt.textContent = k ? T(k + ' scanned', k + 'টি স্ক্যান হয়েছে') : ''; } };
    var L = el('div', 'scn'), v = el('video'), top = el('div', 'st'), ttl = el('b', '', multi ? T('Scan units one by one', 'একটা একটা করে স্ক্যান করুন') : T('Scan barcode / IMEI', 'বারকোড / IMEI স্ক্যান করুন')),
      fl = el('button', '', T('Light', 'লাইট')), xb = el('button', '', '✕'), fr = el('div', 'fr'), pn = el('div', 'pn'), cnt = el('div', 'ms'), ms = el('div', 'ms'), mr = el('div', 'mr'), mi = el('input'), ma = el('button', '', T('Add', 'যোগ')), rw = el('div', 'rw'), ty = el('button', '', T('Type instead', 'হাতে লিখুন')), dn = el('button', 'p', T('Done', 'শেষ'));
    L.setAttribute('role', 'dialog'); L.setAttribute('aria-modal', 'true'); L.setAttribute('aria-label', 'Scanner'); L.tabIndex = -1;
    v.setAttribute('playsinline', ''); v.muted = true; xb.type = fl.type = ma.type = ty.type = dn.type = 'button'; xb.setAttribute('aria-label', 'Close'); fl.hidden = true;
    mi.placeholder = T('Type or scan with a scanner device', 'লিখুন বা স্ক্যানার মেশিনে স্ক্যান করুন'); mi.setAttribute('aria-label', 'Code'); mi.autocomplete = 'off'; mi.setAttribute('autocapitalize', 'off');
    ms.setAttribute('aria-live', 'polite'); top.append(ttl, fl, xb); mr.append(mi, ma); rw.append(ty, dn); pn.append(cnt, ms, mr, rw); L.append(v, fr, top, pn); d.body.appendChild(L);
    if (multi) { var ta = x.fld(b.dataset.t || 'serials'); if (ta) x.count(lines(ta).length); }
    function say(t, m) { ms.className = 'ms ' + t; ms.textContent = m || ''; }
    function close() { if (dead) return; dead = 1; clearTimeout(timer); if (stream) stream.getTracks().forEach(function (k) { k.stop(); }); v.srcObject = null; d.removeEventListener('keydown', key, true); L.remove(); cur = null; if (from && d.body.contains(from)) from.focus(); }
    cur = { close: close };
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function typeIn() { close(); var t = x.fld(b.dataset.t || { serials: 'serials', order: 'serials', repair: 'serial', barcode: 'barcode', search: 'q' }[kind]); if (t) { var dt = t.closest('details'); if (dt) dt.open = true; t.focus(); } }
    function handle(raw) {
      var c = norm(raw); if (!c || busy) return; busy = 1;
      H[kind](c, x).then(function (r) {
        busy = 0; say(r.t, r.m); if (r.t !== 'err') { beep(); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} } else { try { navigator.vibrate && navigator.vibrate([40, 40, 40]); } catch (e) {} }
        if (r.done) setTimeout(close, r.t === 'ok' ? 700 : 1800);
      }, function () { busy = 0; say('err', T('Something went wrong. Please type it.', 'কিছু ভুল হয়েছে, হাতে লিখুন')); });
    }
    function typed() { var c = mi.value; mi.value = ''; handle(c); mi.focus(); }
    xb.onclick = dn.onclick = close; ty.onclick = typeIn; ma.onclick = typed;
    mi.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); typed(); } }; // scanner devices send Enter: never submits the page form
    d.addEventListener('keydown', key, true);
    L.focus();
    function noCam(en, bn) { say('err', T(en, bn)); fr.hidden = true; mi.focus(); }
    // camera
    if (!window.isSecureContext) return noCam('Camera needs a secure (HTTPS) page. You can still type or use a scanner device.', 'ক্যামেরার জন্য HTTPS লাগে। হাতে লিখতে পারেন বা স্ক্যানার মেশিন ব্যবহার করুন।');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return noCam('This browser cannot open the camera. Please type the code.', 'এই ব্রাউজারে ক্যামেরা খোলে না, হাতে লিখুন।');
    var fmtP = window.BarcodeDetector ? (BarcodeDetector.getSupportedFormats ? BarcodeDetector.getSupportedFormats() : Promise.resolve(FMT)).then(function (s) { var f2 = FMT.filter(function (k) { return s.indexOf(k) > -1; }); return f2.length ? new BarcodeDetector({ formats: f2 }) : null; }).catch(function () { return null; }) : Promise.resolve(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (s) {
      if (dead) { s.getTracks().forEach(function (k) { k.stop(); }); return; }
      stream = s; v.srcObject = s; v.play().catch(function () {});
      var tr = s.getVideoTracks()[0], cap = tr && tr.getCapabilities ? tr.getCapabilities() : {};
      if (cap.torch) { fl.hidden = false; fl.onclick = function () { torch = !torch; tr.applyConstraints({ advanced: [{ torch: !!torch }] }).catch(function () { fl.hidden = true; }); fl.setAttribute('aria-pressed', torch ? 'true' : 'false'); }; }
      say('', T('Point the camera at the code', 'ক্যামেরা কোডের দিকে ধরুন'));
      return fmtP.then(function (det) { return det ? function () { return det.detect(v).then(function (a) { return a[0] ? a[0].rawValue : ''; }); } : fallback(); });
    }).then(function (read) {
      if (!read || dead) return;
      (function loop() {
        if (dead) return;
        var p = busy || v.readyState < 2 ? Promise.resolve('') : Promise.resolve(read()).catch(function () { return ''; });
        p.then(function (c) { if (dead) return; var now = Date.now(); if (c && (c !== last || now - lastT > 2500)) { last = c; lastT = now; handle(c); } timer = setTimeout(loop, 180); });
      })();
    }).catch(function (e) {
      if (dead) return; var nm = e && e.name;
      if (nm === 'NotAllowedError' || nm === 'SecurityError') noCam('Camera permission was denied. Allow the camera in browser settings, or type the code.', 'ক্যামেরার অনুমতি দেওয়া হয়নি। ব্রাউজার সেটিংসে অনুমতি দিন বা হাতে লিখুন।');
      else if (nm === 'NotFoundError' || nm === 'OverconstrainedError' || nm === 'DevicesNotFoundError') noCam('No camera found on this device. Please type the code.', 'এই ডিভাইসে ক্যামেরা নেই, হাতে লিখুন।');
      else noCam('Scanning is not supported here. Please type the code.', 'এখানে স্ক্যান চলছে না, হাতে লিখুন।');
    });
  }

  // fallback decoder: vendored @zxing/library UMD, loaded only when BarcodeDetector is missing
  function fallback() {
    return new Promise(function (ok, no) {
      if (window.ZXing) return ok(); var s = el('script'); s.src = '/vendor/zxing.min.js?v=0.21.3'; s.onload = ok; s.onerror = no; d.head.appendChild(s);
    }).then(function () {
      var Z = window.ZXing, h = new Map(), r = new Z.MultiFormatReader(), cv = el('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      h.set(Z.DecodeHintType.POSSIBLE_FORMATS, ['CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A', 'ITF', 'QR_CODE', 'DATA_MATRIX'].map(function (k) { return Z.BarcodeFormat[k]; }));
      h.set(Z.DecodeHintType.TRY_HARDER, true); r.setHints(h);
      return function () {
        var v = cur && d.querySelector('.scn video'); if (!v || !v.videoWidth) return '';
        var sc = Math.min(1, 800 / v.videoWidth); cv.width = v.videoWidth * sc; cv.height = v.videoHeight * sc; cx.drawImage(v, 0, 0, cv.width, cv.height);
        try { return r.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText(); } catch (e) { return ''; }
      };
    }).catch(function () { var m = d.querySelector('.scn .ms'); if (m) { m.className = 'ms err'; m.textContent = T('Camera scanning is not available in this browser. Please type the code.', 'এই ব্রাউজারে ক্যামেরা স্ক্যান নেই, হাতে লিখুন।'); } return null; });
  }
  window.bdapScan = start;
})();
