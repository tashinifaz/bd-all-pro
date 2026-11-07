/* BD ALL PRO core JS: theme toggle, sidebar collapse, active nav, "More" sheet.
   Storage keys: bdap-theme (light|dark), bdap-side (min|full). Initial values are applied by the inline <head> script (views.js HEAD_JS). */
(function () {
  var d = document, root = d.documentElement;
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function themeColor() { var m = d.getElementById('tc'); if (m) m.content = root.dataset.theme === 'light' ? '#e9eaec' : '#0e0e10'; }

  // highlight current page in sidebar / bottom bar / More sheet
  var p = location.pathname.replace(/\/+$/, '') || '/';
  if (p === '/suppliers') p = '/purchases';
  [].forEach.call(d.querySelectorAll('[data-nav]'), function (a) {
    var h = a.getAttribute('href');
    if (h === p || (h !== '/' && p.indexOf(h + '/') === 0)) a.setAttribute('aria-current', 'page');
  });

  // More sheet
  var sheet = d.getElementById('sheet'), opener = null;
  function openSheet(btn) {
    if (!sheet) return;
    opener = btn; sheet.hidden = false; d.body.style.overflow = 'hidden';
    if (btn) btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add('open'); }); });
    sheet.querySelector('.sp').focus();
  }
  function closeSheet(now) {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('open'); d.body.style.overflow = '';
    if (opener) { opener.setAttribute('aria-expanded', 'false'); opener.focus(); }
    setTimeout(function () { sheet.hidden = true; }, now ? 0 : 250);
  }

  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.dataset.act;
    if (a === 'theme') {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      save('bdap-theme', root.dataset.theme); themeColor();
    } else if (a === 'collapse') {
      if (root.dataset.side === 'min') { delete root.dataset.side; save('bdap-side', 'full'); }
      else { root.dataset.side = 'min'; save('bdap-side', 'min'); }
    } else if (a === 'more') openSheet(t);
    else if (a === 'close') closeSheet();
  });

  d.addEventListener('keydown', function (e) {
    if (!sheet || sheet.hidden) return;
    if (e.key === 'Escape') return closeSheet();
    if (e.key !== 'Tab') return;
    var f = sheet.querySelectorAll('a[href],button'), first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (d.activeElement === first || d.activeElement === sheet.querySelector('.sp'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { opener = null; closeSheet(true); } });

  // ---- shared popup: openSheet(title, node) -> {body, set(node), close()}. Bottom sheet < 900px, centered modal >= 900px ----
  function el(t, c, x) { var e = d.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function hint(parent, en, bn) { parent.appendChild(d.createTextNode(en)); if (bn) { parent.appendChild(d.createTextNode(' ')); parent.appendChild(el('small', 'bn', bn)); } return parent; }
  var dlg = null;
  function openSheet(title, node) {
    if (dlg) dlg.end(true);
    var from = d.activeElement, wrap = el('div', 'dlg'), p = el('div', 'dp'), dz = el('div', 'dz'), hd = el('div', 'sh'), t = el('span'), x = el('button', 'ib'), body = el('div', 'db'), pushed = true, y0 = null, dy = 0;
    typeof title === 'string' ? (t.textContent = title) : t.appendChild(title);
    x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-close"/></svg>';
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-label', t.textContent); p.tabIndex = -1;
    hd.appendChild(t); hd.appendChild(x); dz.appendChild(el('div', 'sgrip')); dz.appendChild(hd);
    p.appendChild(dz); p.appendChild(body); body.appendChild(node);
    var bg = el('div', 'sbg'); wrap.appendChild(bg); wrap.appendChild(p); d.body.appendChild(wrap); d.body.style.overflow = 'hidden';
    try { history.pushState({ bdapDlg: 1 }, ''); } catch (e) { pushed = false; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('open'); }); });
    p.focus();
    var h = {
      body: body,
      set: function (n) { body.textContent = ''; body.appendChild(n); },
      close: function () {
        if (pushed && history.state && history.state.bdapDlg) { history.back(); setTimeout(function () { if (dlg === h) h.end(); }, 400); } else h.end();
      },
      end: function (now) {
        if (dlg !== h) return; dlg = null; pushed = false;
        wrap.classList.remove('open'); d.body.style.overflow = '';
        setTimeout(function () { wrap.remove(); }, now ? 0 : 250);
        if (from && d.body.contains(from)) from.focus();
      }
    };
    bg.addEventListener('click', h.close); x.addEventListener('click', h.close);
    dz.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; dy = 0; p.style.transition = 'none'; }, { passive: true });
    dz.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); p.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    dz.addEventListener('touchend', function () { if (y0 == null) return; y0 = null; p.style.transition = ''; p.style.transform = ''; if (dy > 90) h.close(); });
    dlg = h; return h;
  }
  window.openSheet = openSheet;
  window.addEventListener('popstate', function () { if (dlg) dlg.end(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && dlg) dlg.end(true); });
  d.addEventListener('keydown', function (e) {
    if (!dlg) return;
    if (e.key === 'Escape') return dlg.close();
    if (e.key !== 'Tab') return;
    var p = d.querySelector('.dp'), f = [].slice.call(p.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,summary')), a = d.activeElement;
    if (!f.length) { e.preventDefault(); return; }
    if (e.shiftKey && (a === f[0] || a === p)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---- dashboard: range chips, live card refresh, detail popups ----
  var dash = d.getElementById('dash');
  if (dash) (function () {
    var cur = JSON.parse(dash.dataset.rg), chips = [].slice.call(dash.querySelectorAll('.chips [data-r]')), cust = d.getElementById('cust'),
        fi = d.getElementById('rf'), ti = d.getElementById('rt'), msg = d.getElementById('dmsg'), seq = 0;
    function qs() { return 'r=' + cur.r + (cur.r === 'custom' ? '&from=' + cur.from + '&to=' + cur.to : ''); }
    function mark() { chips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.r === cur.r)); }); }
    function remember() {
      save('bdap-range', JSON.stringify(cur));
      try { d.cookie = 'bdap-range=' + (cur.r === 'custom' ? 'custom_' + cur.from + '_' + cur.to : cur.r) + ';path=/;max-age=31536000;samesite=lax'; } catch (e) {}
    }
    function note(t) { msg.textContent = ''; if (t) { msg.appendChild(el('div', 'err', t)); } }
    function json(r) { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw new Error('bad'); return r.json(); }
    function load() {
      var n = ++seq; dash.setAttribute('aria-busy', 'true');
      fetch('/api/dash?' + qs(), { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(json).then(function (j) {
        if (n !== seq) return; note('');
        Object.keys(j.cards).forEach(function (k) {
          var c = dash.querySelector('[data-card=' + k + ']'); if (!c) return;
          c.querySelector('.v').textContent = j.cards[k].v; c.querySelector('.cs').textContent = j.cards[k].sub || '';
        });
        d.getElementById('rl').textContent = j.rl;
        var o = dash.querySelector('[data-card=orders]'); o.href = '/orders?from=' + j.from + '&to=' + j.to;
      }).catch(function () { if (n === seq) note('Could not update. Check your connection and try again. · আবার চেষ্টা করুন'); })
        .then(function () { if (n === seq) dash.removeAttribute('aria-busy'); });
    }
    d.addEventListener('bdap:saved', load);
    function pick(r, from, to) { cur = r === 'custom' ? { r: r, from: from, to: to } : { r: r }; mark(); remember(); load(); }
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.r === 'custom') { cust.hidden = !cust.hidden; if (!cust.hidden) fi.focus(); return; }
        cust.hidden = true; pick(b.dataset.r);
      });
    });
    d.getElementById('rapply').addEventListener('click', function () {
      var a = fi.value, b = ti.value; if (!a || !b) { note('Pick both dates · দুটি তারিখ দিন'); return; }
      if (a > b) { var x = a; a = b; b = x; fi.value = a; ti.value = b; }
      pick('custom', a, b);
    });
    // saved choice differs from what the server drew (e.g. cookie cleared): apply it
    try {
      var sv = JSON.parse(localStorage.getItem('bdap-range') || 'null');
      if (sv && /^(today|week|month|custom)$/.test(sv.r) && (sv.r !== cur.r || (sv.r === 'custom' && (sv.from !== cur.from || sv.to !== cur.to)))) {
        if (sv.r !== 'custom' || (/^\d{4}-\d{2}-\d{2}$/.test(sv.from) && /^\d{4}-\d{2}-\d{2}$/.test(sv.to))) {
          cur = sv; if (sv.r === 'custom') { fi.value = sv.from; ti.value = sv.to; cust.hidden = false; } mark(); remember(); load();
        }
      }
    } catch (e) {}

    function skeleton() { var f = el('div'); for (var i = 0; i < 5; i++) f.appendChild(el('div', 'sk')); return f; }
    function render(j, fallback) {
      var f = el('div'), foot = el('div', 'df');
      f.appendChild(el('div', 'tot', j.total));
      if (j.note) f.appendChild(el('p', 'k', j.note));
      if (!j.rows.length) f.appendChild(el('p', 'k', 'Nothing here yet · কিছু নেই'));
      j.rows.forEach(function (r) {
        var row = el(r.href ? 'a' : 'div', 'li'), m = el('span', 'lm'); if (r.href) row.href = r.href;
        m.appendChild(el('b', 0, r.a)); if (r.b) m.appendChild(el('span', 0, r.b)); row.appendChild(m);
        if (r.v != null) row.appendChild(el('span', 'lv', r.v)); f.appendChild(row);
      });
      var va = el('a', 'va'); va.href = j.viewAllUrl; hint(va, 'View all →', 'সব দেখুন'); f.appendChild(va);
      j.actions.forEach(function (a) { var b = el('a', a.p ? 'btn' : 'btn gray'); b.href = a.href; if (a.form) b.dataset.form = a.form; hint(b, a.en, a.bn); foot.appendChild(b); });
      if (j.actions.length) f.appendChild(foot);
      return f;
    }
    dash.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-card]');
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      var t = el('span'), sh;
      hint(t, a.dataset.t, a.dataset.b); sh = openSheet(t, skeleton());
      fetch('/api/dash/' + a.dataset.card + '?' + qs(), { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(json)
        .then(function (j) { if (dlg === sh) sh.set(render(j)); })
        .catch(function () {
          if (dlg !== sh) return;
          var f = el('div'), l = el('a', 'btn'); f.appendChild(el('div', 'err', 'Could not load. Check your connection, or sign in again. · লোড হয়নি'));
          l.href = a.getAttribute('href'); hint(l, 'Open page', 'পেজ খুলুন'); f.appendChild(l); sh.set(f);
        });
    });
  })();

  // ---- forms (Phase 3): pop-up forms + AJAX submit for every POST form (no reload on error, typed input kept) ----
  var FV = (d.currentScript && d.currentScript.dataset.fv) || '', SV = (d.currentScript && d.currentScript.dataset.sv) || '', cssOk = 0, toastT;
  function toast(msg, url) {
    var t = d.getElementById('toast') || d.body.appendChild(el('div')); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg + ' ';
    if (url) { var a = el('a', 0, 'Open · খুলুন'); a.href = url; t.appendChild(a); }
    clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 6000);
  }
  function loadCss(cb) {
    if (cssOk) return cb(); var l = el('link'); l.rel = 'stylesheet'; l.href = '/forms.css?v=' + FV;
    l.onload = l.onerror = function () { cssOk = 1; cb(); }; d.head.appendChild(l);
  }
  function openForm(name, href) {
    var t = el('span'), sh = openSheet(t, el('div', 'sk')), ready = 0;
    loadCss(function () { ready = 1; });
    fetch('/f/' + name, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw 0; return r.json(); })
      .then(function (j) {
        if (dlg !== sh) return; t.textContent = ''; hint(t, j.t, j.b);
        var f = el('div'); f.innerHTML = j.html; // server-built markup, every value esc()'d on the server
        function show() { if (dlg !== sh) return; sh.set(f); var i = f.querySelector('[autofocus]'); if (i && matchMedia('(min-width:900px)').matches) i.focus(); }
        ready ? show() : setTimeout(show, 150);
      })
      .catch(function () {
        if (dlg !== sh) return; var f = el('div'), l = el('a', 'btn');
        f.appendChild(el('div', 'err', 'Could not open the form. Check your connection, or sign in again. · ফর্ম খোলেনি'));
        l.href = href || '/'; hint(l, 'Open page', 'পেজ খুলুন'); f.appendChild(l); sh.set(f);
      });
  }
  window.openForm = openForm;
  d.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-form]');
    if (a && !e.button && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); openForm(a.dataset.form, a.getAttribute('href')); return; }
    var b = e.target.closest('[data-add]');
    if (b) { var n = b.closest('form').querySelector('.ln[hidden]'); if (n) { n.hidden = false; var s = n.querySelector('select'); if (s) s.focus(); } if (!b.closest('form').querySelector('.ln[hidden]')) b.hidden = true; }
  });
  // live total for order / purchase popups (qty x price + fee - discount)
  function calc(f) {
    var box = f.querySelector('[data-total]'); if (!box) return; var sub = 0, g = function (n) { var i = f.elements[n]; return i ? Number(i.value) || 0 : 0; };
    [].forEach.call(f.querySelectorAll('.ln'), function (ln) {
      var s = ln.querySelector('select'), q = Number(ln.querySelector('[name=qty]').value) || 0, p = ln.querySelector('[name=price],[name=unit_cost]');
      var o = s.selectedOptions[0]; sub += q * (p && p.value !== '' ? Number(p.value) || 0 : o ? Number(o.dataset.p) || 0 : 0);
    });
    var tot = sub - g('discount') + g('delivery_fee') + g('extra_cost'), paid = g('advance') + g('paid'), fm = function (n) { return '৳' + Math.round(n).toLocaleString('en-IN'); };
    box.textContent = sub ? 'Total · মোট ' + fm(tot) + (paid ? ' · Left · বাকি ' + fm(tot - paid) : '') : '';
  }
  d.addEventListener('input', function (e) { var f = e.target.form; if (f && f.dataset.calc) calc(f); });
  d.addEventListener('change', function (e) { var f = e.target.form; if (f && f.dataset.calc) calc(f); });
  // AJAX submit for every POST form except login (which has no token): inline error, input kept, button locked while sending
  d.addEventListener('submit', function (e) {
    var f = e.target; if (e.defaultPrevented || f.method !== 'post' || !f.elements._t || !window.fetch) return;
    e.preventDefault();
    var box = f.querySelector('.fe'), btn = f.querySelector('button[type=submit],button:not([type])');
    if (!box) { box = el('div', 'err fe'); box.setAttribute('role', 'alert'); f.insertBefore(box, f.firstChild); }
    function fail(m) { box.className = 'err fe'; box.textContent = m; box.hidden = false; box.scrollIntoView({ block: 'nearest' }); if (btn) btn.disabled = false; }
    box.hidden = true; if (btn) btn.disabled = true;
    fetch(f.getAttribute('action') || location.pathname, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch', Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)).toString() })
      .then(function (r) {
        if (!/json/.test(r.headers.get('content-type') || '')) throw 0;
        return r.json();
      })
      .then(function (j) {
        if (!j.ok) return fail(j.err || 'Could not save. · সেভ হয়নি');
        var inDlg = f.closest('.dlg');
        if (inDlg && dlg) { dlg.close(); toast(j.msg, j.url.split('?')[0] !== location.pathname ? j.url : ''); d.dispatchEvent(new Event('bdap:saved')); if (!d.getElementById('dash')) setTimeout(function () { location.href = j.url; }, 700); }
        else location.href = j.url;
      })
      .catch(function () { fail('Could not reach the server, or your session ended. Check your connection or sign in again. · সংযোগ বা লগইন দেখুন'); });
  });
  // Phase 4: camera scan is lazy: /scan.js loads only on the first Scan tap. Enter in [data-noenter] fields (USB/Bluetooth scanners) never submits.
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-scan]'); if (!b) return; e.preventDefault();
    if (window.bdapScan) return window.bdapScan(b);
    var s = el('script'); s.src = '/scan.js?v=' + SV; s.onload = function () { window.bdapScan(b); };
    s.onerror = function () { alert('Could not load the scanner. Type instead. · স্ক্যানার লোড হয়নি, হাতে লিখুন'); }; d.head.appendChild(s);
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-noenter')) e.preventDefault(); });
  themeColor();
  // Phase 5: help.js (? tips, first-time tour, Settings page UI) is lazy: loads on first "?" / tour tap, on /settings, and on the very first visit
  var HV = (d.currentScript && d.currentScript.dataset.hv) || '';
  function loadHelp(cb) {
    if (window.bdapHelp) return cb && cb();
    var s = el('script'); s.src = '/help.js?v=' + HV; s.onload = function () { cb && cb(); };
    s.onerror = function () { alert('Could not load help. · সাহায্য লোড হয়নি'); }; d.head.appendChild(s);
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-help],[data-tour]'); if (!b) return; e.preventDefault();
    loadHelp(function () { b.hasAttribute('data-help') ? window.bdapHelp.open() : window.bdapHelp.tour(true); });
  });
  var tdone = 0; try { tdone = localStorage.getItem('bdap-tour'); } catch (e) {}
  if (d.getElementById('stg') || /[?&]tour=1/.test(location.search) || (d.body.hasAttribute('data-first') && !tdone && location.pathname === '/')) loadHelp(function () { window.bdapHelp.auto(); });
  themeColor();
})();
