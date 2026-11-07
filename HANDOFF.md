# HANDOFF — BD ALL PRO redesign

## ALL 6 PHASES DONE (1 shell, 2 dashboard, 3 pop-up AJAX forms, 4 camera scan, 5 help/Settings/staff groundwork, 6 consistency + speed + docs). Nothing is "next" except the optional items under Known issues.

# Phase 6 — final pass (this phase)
## What changed
- `src/views.js` — `table(cols, rows, raw, opts)`: every `<td>` has `data-l` (column label); `opts.st` = stack as cards on phones (< 640px, CSS `.st`); `opts.empty = [en, bn, href, formKey, btnEn, btnBn]` = friendly empty state (`.empty`) with a button that opens the pop-up form. `PRIMARY` map (page title -> primary action) + `primary()` renders ONE primary button in the page header (`.ph .pa`) for Orders, Products, Purchases, Repairs, Expenses, Stock (Adjust stock), Accounts (scrolls to `#transfer`). `head()` links `/print.css` (media=print).
- Pages using `st` + empty states: Orders, Products, Purchases, Repairs, Expenses (Accounts cashbook uses `st` only). Other tables (ledgers, reports) stay horizontally scrollable on phones by design.
- `public/app.css` — comments removed, login block moved to `public/login.css` (linked only by /login), print block moved to `public/print.css` (print only); added `.pa .empty .st` and a sticky Save button on long mobile forms (`main form[method=post]:not(.pf)>button:last-of-type`, < 900px).
- `src/gzip.js` (NEW) — gzip through built-in `zlib`: static css/js/txt (cached in memory, incl. zxing 336 KB -> 99 KB) and any HTML/JSON/CSV response > 1 KB. No dependency. Registered in `server.js` before `express.static`.
- `src/server.js` — origin check no longer throws on a malformed `Origin` (answers 403); login page links `login.css`.
- `src/dash.js` — **fix**: Sellable units and Pending progress (stock buckets) now exclude archived products, matching the Stock page (before, archived stock made the dashboard higher than /stock).
- `db/schema.sql` — 11 `CREATE INDEX IF NOT EXISTS` (orders odate/status, order_items, repairs status, expenses edate, purchases pdate, purchase_items, account_txns(account,date), stock_movements(product,id)/(mtype,id), product_serials(product)).
- `src/ops.js` — fixed an import (`bn`) needed by the Transfer button label; transfer card has `id=transfer`.
- `README.md` rewritten local-run / env vars / bottom bar / scan / HTTPS sections. `TESTING.md` (20-step manual checklist) NEW.

## Final sizes (bytes raw / gzip -9)
app.css 15,274 / 4,208 (14.9 KiB; was 15,695) · app.js 19,099 / 6,259 · scan.js 17,639 / 6,467 (lazy) · help.js 17,212 / 6,171 (lazy) · help.css 1,596 · forms.css 1,384 (lazy) · login.css 383 · print.css 335 · vendor/zxing.min.js 336,008 / 99,193 (lazy, only without BarcodeDetector). Core CSS + JS = 34.4 KB raw, 10.5 KB gzipped. Dead-CSS scan: only `.grid` is unused by the code and it is kept on purpose (legacy class). All 24 sprite icons are in use. New dependencies: none.

## Cross-check of numbers (by reading the SQL; NOT run against data)
- Cash card = sum over accounts of `opening + SUM(account_txns)` = same formula as /accounts. OK.
- Dues to pay = `SUM(total-paid-credit)` over purchases = sum of Supplier balances on /purchases (they differ only for a purchase with no supplier). OK.
- Dues to receive = unsettled COD of Dispatched/Delivered/Partially Returned orders (same as the old dashboard). OK.
- Low stock = same query as before (archived excluded). OK.
- Sellable / progress: was different from /stock for archived products -> FIXED (see above).
- Orders card (orders placed in range, not Cancelled/Returned, by `total`) is NOT the same number as Reports "Gross item sales" (delivered orders by delivered date, item prices before discount). Different definitions on purpose; do not "fix".

## Security recheck (by reading code)
Auth gate before `dash forms scan settings access` and reports pages; only `/health`, `/version`, `/login`, static files are public. Origin check covers every POST (incl. `/api/pref`, AJAX posts); login rate limit (5 fails / 15 min per IP) untouched; no secrets in `/public` (css, js, images, vendor decoder only); every interpolation into SQL is a code constant or `int()`; user text goes through `esc()` (new code: `data-l` is escaped; empty-state texts are constants); form token guard untouched.

## Known issues / NOT verified (honest list)
- **Nothing was run against Express + PostgreSQL in this phase** (sandbox had no network, no Postgres). Verified: `node --check` on all JS; `views.js` render test (empty state, stacked table, primary button, escaping); gzip middleware unit test with a fake req/res (static, traversal, dynamic, no-header); headless Chromium on the new table/empty/header CSS at 360px in dark and light (no sideways scroll). The owner MUST run `TESTING.md` once on the real deployment.
- gzip is tested only with mocks; if anything looks odd, comment out the `app.use(require('./gzip'))` line in `server.js` (Render's proxy may compress anyway).
- Sticky Save button on long mobile forms is CSS only and untested on a real phone; if it overlaps something, delete the last rule in `app.css`.
- Old full-page forms (orders/purchases/ops.js) still have some English-only headings and buttons; the pop-up forms are fully bilingual. Bangla wording is the AI's draft: owner to review.
- Not tested: real phone, iOS Safari, real camera decode (native or zxing), screen reader, Render deploy, very short landscape screens.
- Staff accounts: groundwork only (`role`, `can()`, `requireRole`), no Users UI (see Phase 5 notes).
- `/suppliers` is POST-only. `bd-all-pro` `package.json` version is still 1.0.0.

---
# Phase 5 — newbie help, Settings, staff groundwork (this phase)
## What exists now (new / changed)
- `db/schema.sql` — additive: `users.role TEXT NOT NULL DEFAULT 'owner'`; `user_prefs(user_id INT REFERENCES users ON DELETE CASCADE, key, value, PRIMARY KEY(user_id,key))`. Existing `settings` table reused for the business name (`k='business'`).
- `src/ctx.js` (NEW) — AsyncLocalStorage; lets `page()` read the current user without changing its signature.
- `src/access.js` (NEW) — `load` middleware (registered right after the login gate in server.js): ONE query loads `req.user = {id, username, role, prefs:{key:value}, biz}`; a deleted user is logged out. `can(req, perm)` and `requireRole(...roles)` (owner always allowed; today only 'owner' exists). `ROLES = { owner: ['*'] }` is the permission table.
- `src/settings.js` (NEW) — `GET /settings`; `POST /settings/bar` (1-4 distinct page keys, order kept), `POST /settings/bar/reset`, `POST /settings/business` (guarded by `requireRole('owner')`, audit-logged), `POST /api/pref` (whitelist `PREF_API`, now only `tour=1`). All forms use `post()` (token + transaction + AJAX for free).
- `src/views.js` — `SETTINGS_PAGE` is now set (sidebar footer + More sheet + selectable for the bar); new exports `ALL byKey barKeys me ver SETTINGS_PAGE`. `barKeys()` = the user's saved `bar` pref (validated, max 4) or default `dashboard,orders,stock,repairs`, plus `'more'` last; `page()` passes it to `bottombar()/moreSheet()`. "?" button (`helpBtn`, `data-help`) in the mobile top bar and beside the desktop title (`.ph`). `<body data-first=1>` when the user has no `tour` pref. `LABEL_BN` map + `withBn()` adds Bangla hints to plain `<label>Date</label>`-style labels of the older pages in one place (edit wording there). `table()` empty row and `rangeForm()` Filter button got hints. `foot()` script tag now carries `data-hv`, `data-cv` (cache-bust for help.js / help.css).
- `src/dash.js` — uses `req.user.username` (one query less); business name shown before the date.
- `public/help.js` (NEW, ~17 KB, lazy) — **owner edits wording here**: `HELP` (per page: title + 2-4 sentences, each `[English, Bangla]`; keys dashboard orders order products product purchases purchase suppliers repairs repair stock expenses accounts reports settings other) and `TOUR` (6 steps: Quick actions, Cards, Menu, Scan, Help, Settings; each step lists CSS selectors, first visible one is highlighted, none visible = centred card). Also the tour runner and the Settings page behaviour (4-item limit, up/down arrows, theme buttons). `window.bdapHelp = {open, tour(force), auto}`.
- `public/help.css` (NEW, 1.6 KB, lazy; also linked by the Settings page) — help sheet, tour, Settings list.
- `public/app.js` (19.1 KB) — +~1 KB: lazy loader for help.js (on `[data-help]` / `[data-tour]` click, on `/settings`, on `?tour=1`, and on first visit to `/`).
- `public/app.css` (15.7 KB) — only +0.15 KB (`.ph`, `.hb`).
- `public/vendor/zxing.min.js` (NEW, 336 KB, @zxing/library 0.21.3 UMD from npm) — the Phase 4 fallback decoder is now vendored (loads only when `BarcodeDetector` is missing). Not tested on a real iPhone.

## Behaviour
- Tour: runs once on the first visit to `/` after login when the user has no `tour` pref; Next / Skip / Esc; finishing OR skipping saves `user_prefs.tour=1` (and localStorage `bdap-tour`). Replay: Settings > Replay tour -> `/?tour=1` (flag removed from URL afterwards).
- Bottom bar: saved per user in the DB, so it follows the account to every device. After Save the page reloads and the bar is already updated. Reset restores the default.
- Theme in Settings: Light / Dark / Follow device (removes `bdap-theme`); stored per device in localStorage as before (not per user).
- "?" popup uses `openSheet` (bottom sheet on mobile, modal on desktop). Page key comes from the URL (`/orders/12` -> `order`).

## Conventions introduced
`req.user`, `can(req,perm)`, `requireRole(...)`, `user_prefs` keys `bar` (comma list of PAGES keys) and `tour` (`1`), `views.barKeys()`, `views.me()`, `data-help`, `data-tour` (replay button), `data-first` (body flag), `LABEL_BN`, `HELP`, `TOUR`, CSS `.ph .hb .tr .th .tc .ta .bl .thm .hp`.

## How to add staff accounts later (NOT built)
1. Users UI (owner-only): create user with `role` ('staff' etc.), bcrypt hash; login already works for any row in `users`. Add roles + permissions to `ROLES` in `access.js`, e.g. `staff: ['orders.write','orders.view','stock.view','repairs.write','expenses.write']`.
2. Guard routes with `requireRole('owner')` or a permission check. Recommended owner-only: `/reports` and `/api/dash` cash/profit numbers (or hide those cards via `can()`), `/accounts` + `/accounts/transfer`, `/expenses` delete/edit, `/settings/business`, any cost-price / avg-cost / stock-value columns (hide in `catalog.js` product pages and `/stock`), purchases (cost) and supplier dues, `/stock/adjust`, audit log. Staff-ok: create orders, repairs, view stock/products without cost.
3. Because AJAX forms hit the same POST routes, protect the POST route itself, not only the page. `requireRole` already answers JSON 403 for AJAX.
4. Hide nav items the role may not open: filter `ALL` in `barKeys()/sidebar()/moreSheet()` using `can()`; `Settings` bar choices already work per user.
5. Add a small "Users" card to `/settings` (owner only) and put `role` in the session if you want to avoid the DB read (today it is read every request on purpose, so a role change applies immediately).

## Verified (real Express + PostgreSQL 16 + headless Chromium, this phase)
Migration on a fresh DB; every page 200; `/health` public; `/settings`, `/api/pref` redirect to login when logged out; bar save / 5 items rejected / none rejected / duplicate token ignored / unknown key rejected; bar saved in one session shows in a second session; reset; business name saved and shown; `/api/pref` bad key 400 and foreign Origin 403; tour on 390px and 1280px (6 steps, card always inside the viewport, Skip/Done saves, no reappearance after reload, replay from Settings); "?" popup on 10 pages both layouts; Settings reorder + 4-item limit + theme buttons; no console errors.

## Known issues / NOT verified
- Bangla (help, tour, labels in `LABEL_BN`) is mine; owner to review.
- `app.css` is 15.7 KB (target 15 KB); not trimmed. Core JS 19.1 KB (target 20 KB) so little room left; new JS should go in lazy files.
- Old full-page forms in orders/purchases/ops.js are still English-first; only labels listed in `LABEL_BN` got hints (buttons / headings / table headers inside them did not).
- Not tested: real phone, iOS Safari, real camera decode (incl. the new zxing file), tour on very short screens (landscape phone), screen reader walk-through, Render deploy.
- No roles other than owner exist; nothing enforces permissions yet beyond `/settings/business`.
- `/suppliers` is POST-only (GET 404), as before.

## Next phase (Phase 6) must do
The Phase 5 prompt covered the tour and "?" tips, so Phase 6 is polish: review Bangla wording with the owner; trim app.css to <= 15 KB; finish bn() hints on old full-page forms/buttons/table headers; optionally the staff UI + permission checks above; real-device test list (iOS scan, tour on small screens, Render deploy).

---
(Earlier phases below.)

# Phase 4 — camera scan (this phase)
## What exists now (new / changed)
- `public/scan.js` (NEW, ~17 KB, lazy) — `window.bdapScan(button)`. Full-screen own layer (NOT openSheet, so a scan opened from a pop-up form does not close the form): live rear-camera video, scan frame, light toggle (only if `torch` supported), manual input + Add, "Type instead · হাতে লিখুন" (closes and focuses the real field), Done, Esc/✕; tracks always stopped on close; vibrate + beep on success. Native `BarcodeDetector` (code_128, code_39, ean_13, ean_8, upc_a, itf, qr_code, data_matrix, filtered by `getSupportedFormats`), else lazy `/vendor/zxing.min.js`. Friendly EN+BN errors: permission denied, no camera, not HTTPS, unsupported. IMEI: spaces/dashes stripped when 14-17 digits; 15-digit Luhn failure = gentle warning, still added. Scanner-device Enter inside the overlay never submits the page form.
- `public/app.js` (~18 KB) — +~0.9 KB: delegated click on `[data-scan]` lazy-loads `/scan.js?v=<data-sv>`; Enter on `[data-noenter]` inputs is blocked (USB/Bluetooth scanners). Textareas keep Enter = new line (one serial per line works with keyboard scanners).
- `public/vendor/README.txt` — how to add the fallback decoder (see Known issues: **file not included**).
- `src/scan.js` (NEW) — `GET /api/serial/:code` (after auth): `{found, kind:'unit'|'repair'|'product', product_id, product_name, serialized, status, bucket, ref}`. unit = `product_serials`, repair = `repairs.serial`, product = `products.barcode` or SKU. Buckets: in_stock→good, reserved, sold, repair→under_repair, damaged, returned.
- `db/schema.sql` — additive: `products.barcode TEXT` + `products_barcode_idx`.
- `src/catalog.js` — `barcode` in add/edit forms, search (`p.barcode=$1`), Scan button in search box; `fields()` now returns 11 values (barcode last). `POST /products` also takes optional `open_qty` + `open_serials`: inserts `product_serials` (ref `OPEN-<id>`), `move(null→good, mtype 'opening')`, audit `opening_stock`. Serialized: serial count must equal qty (qty defaults to serial count). Edit form has barcode only.
- `src/forms.js` — Scan buttons (`SC()` helper) in pop-ups: purchase/order serials, repair serial, product barcode + opening qty/serials. `src/views.js` foot(): `data-sv` cache-bust for scan.js. `src/server.js`: registers `scan`.

## Behaviour per screen
- Purchase / opening stock (`data-scan=serials`): continuous; each scan appends a line, sets qty to the count, shows running count; rejects in-batch duplicates and serials already in DB (plain message); product-barcode scans rejected as serials; Done closes.
- New order (`data-scan=order`): unit must be `in_stock` -> selects product, appends serial, qty=count; otherwise plain reason (reserved/sold/repair/damaged/returned, not found, repair-only). A product barcode/SKU just selects the product.
- Repair (`data-scan=repair`): fills serial; prefills product if known, else says to continue by typing.
- Add product (`data-scan=barcode`, warns if barcode already used) and opening serials (`data-t=open_serials data-q=open_qty`).
- Products page search box: Scan -> opens the product/unit page, else runs text search.

## Conventions
`data-scan="serials|order|repair|barcode|search"`, optional `data-t` (target field name), `data-q` (qty field name); `data-noenter` on single-line fields. Add a mode: add `H.<mode>` in scan.js returning `Promise<{t:'ok|warn|err', m, done}>`.

## Known issues / NOT verified
- **Fallback decoder not vendored**: build sandbox had no network. Add `public/vendor/zxing.min.js` (@zxing/library 0.21.3 UMD, chosen: mature, handles all required formats incl. Code128/EAN/ITF/QR/DataMatrix, pure JS no WASM, works on iOS Safari). Until then iPhone/Firefox get a friendly message + typing. Phase 5 must (or owner) add it BEFORE claiming iOS support.
- Real Express + PostgreSQL NOT run (none available). Verified: `node --check` all JS; headless Chromium with stub data + fake camera stream: continuous serials (dup in batch, dup in DB, qty autofill, Luhn-valid ok), order sold/unknown/good, repair prefill, barcode fill, opening serials, Esc closes, tracks stopped, not-HTTPS message, Enter blocked on `data-noenter`. NOT tested: real camera decode, Android native detector, torch, `POST /products` opening stock against Postgres, iOS.
- Old full-page forms in orders/purchases/ops.js have no Scan buttons (pop-ups do; the `/products` page form does).
- app.css still ~15.5 KB (Phase 5 should trim).

## Next phase must do (Phase 5)
Settings page (set `SETTINGS_PAGE` in views.js, configurable bottom bar via `bottombar(items)`/`moreSheet(items)`), staff-account groundwork, vendor `zxing.min.js`, trim app.css. Then Phase 6: guided tour, "?" help tips.

---
(Earlier phases below.)


## Phases done: 1 (shell + design system), 2 (dashboard), 3 (pop-up AJAX forms). Next: Phase 4.

# Phase 3 — pop-up forms + AJAX (this phase)
## What exists now (new / changed)
- `src/forms.js` (NEW) — `GET /f/:name` (auth-gated, registered after login gate in server.js) -> JSON `{t,b,html}`. Forms: `order expense purchase product adjust repair`. All field names / POST routes identical to the full-page forms. Essentials first, rest under `<details class=more>` "More options · আরও অপশন". Order/purchase: 1 product line visible, `+ Add another product` reveals lines 2-5 (all still submit as arrays, so POST handlers are untouched). Live total preview (`[data-total]`) for order/purchase. Add a form: add entry to `FORMS`, link with `data-form="name"`.
- `src/web.js` — `post()` now has an AJAX path: request header `X-Requested-With: fetch` -> JSON `{ok:true,msg,url}` or `422 {ok:false,err}`; duplicate token -> `{ok:true,msg:'Already saved'}`. Without the header it still redirects with `?ok=/?err=` exactly as before (works with JS off).
- `src/dash.js` — `FORM` map href->form key; Quick-action links and popup `+ New …` actions carry `data-form` (href kept as no-JS fallback). `/api/dash/:card` actions now include `form`.
- `public/app.js` (~17 KB) — `openForm(name, hrefFallback)` (global), `toast(msg,url)`, delegated `a[data-form]` click, `[data-add]`, live total, and a **global AJAX submit handler for every `<form method=post>` that has a `_t` token** (so all existing in-page forms are AJAX too: error shown inline in `.fe`, typed input kept, button locked while sending, success -> navigate to `url`). In a popup: closes, toast, fires `document` event `bdap:saved` (dashboard listens and refreshes cards), on non-dashboard pages then goes to the result URL. Session expiry/offline -> inline message.
- `public/forms.css` (NEW, 1.4 KB) — popup-form styles, lazy-loaded on first `openForm` (cache-busted via `data-fv` on the app.js `<script>`, set in `foot()` in views.js).
- `public/app.css` (15.5 KB, slightly over the 15 KB target — Phase 5 should trim) — added `.toast` and light-theme polish.
- `docs/design-refs/light-ref.jpg` — light-mode reference (the iDraft-style black/white dashboard). Light theme now: soft grey gradient backdrop, white 24px cards, black hero cards, floating-style sidebar shadow. Reference is style inspiration only.

## Conventions introduced
- `data-form="order|expense|purchase|product|adjust|repair"` on any `<a>` opens the pop-up form. `window.openForm(name)`.
- Form HTML helpers inside forms.js: `form() more() lines() L() sel() num()`; class hooks `.pf .fe .ln .more .mb .df .tot[data-total]`, `data-calc`, `data-add`.
- Events: `document` `bdap:saved` after a successful popup save.
- Server JSON contract for POST (see web.js) — new POST routes using `post()` get AJAX for free.

## Known issues / not verified
- **Real Express + PostgreSQL were NOT run** (no npm network / Postgres in sandbox). Verified: `node --check` on all touched JS; forms.js output rendered against a stub DB (all 6 forms, field names match the original forms, values escaped); `post()` JSON/redirect/dup/error paths against a stub tx; in headless Chromium (stub server, real app.js/app.css/forms.css/views.js): popup opens on 390px and 1280px, "Add another product", live total, inline server error with input kept, success toast + popup close, all 6 forms open, light theme. NOT tested: real DB writes via popups, iOS Safari, dashboard refresh after save (`bdap:saved` wiring is simple but untested live), session-expired path.
- Quick actions list has no "New repair ticket" button (brief lists 5); repair popup opens from the Pending repairs card.
- "Add product with existing stock" and camera scan are Phase 4 (not done). No customer-name suggestions yet (placeholders only; reason chips for stock adjust via datalist).
- Order form is long on small phones (5 lines, 1 shown); fine but could use a compact review step later.
- Bangla wording is mine; owner to review.

## Next phase must do (Phase 4: camera scan)
Add camera scan buttons (BarcodeDetector, lazy-loaded fallback only when needed) for IMEI/serial/barcode in: Purchase (serials textarea in `lines()`), New order (serials), Repair ticket (`serial`), Add product with existing stock (add optional "opening stock + serials" fields to the product popup AND handle them in `POST /products`, additive only). Typing must keep working. Hook into forms.js markup (`name=serials`, `name=serial`) and add a lazy `scan.js`. Then Phase 5: Settings page (set `SETTINGS_PAGE`, configurable bottom bar), staff groundwork; Phase 6: guided tour, "?" help tips.

---
(Earlier phases below.)

(Phase 1 notes follow after the Phase 2 section. Phase 2 was smoke-tested against real PostgreSQL 16 + Chromium; see Known issues.)

## Phases done
- **Phase 2: dashboard** (cards, range filter, detail popups) — see "Phase 2" section below.
- **Phase 1: app shell + design system** (this file written at the end of Phase 1). No routes, form fields, SQL or business logic changed.

## What exists now (new / changed files)
- `public/app.css` (~10 KB) — design tokens (dark + light), shell, legacy classes restyled.
- `public/app.js` (~3 KB) — theme toggle, sidebar collapse, active-nav highlight, "More" sheet (focus trap, Esc).
- `public/logo-mark.png` (off-white glyph, 114x96; CSS turns it black in light theme), `icon-64.png`, `icon-180.png` (favicon / apple-touch), `logo-original.jpg` (original, not loaded anywhere).
- `src/views.js` — new `page()` shell + helpers (below). `table() opts() token() dateRange() rangeForm()` untouched.
- `src/server.js` — `express.static('public', 7d)` registered before `/health` and auth; login page rebuilt with shared head/CSS/logo.
- `package.json` — added `npm run dev` (`node --watch`). Added `.env.example` and `.gitignore` (both were missing from the zip).
- `docs/design-refs/dark-ref.jpg` — dark reference. `light-ref.jpg` was added in Phase 3.

## Conventions introduced
- Views helpers (exported): `bn(en, bangla)`, `icon(name, cls)`, `SPRITE`, `PAGES`, `BOTTOM_ITEMS`, `head(title)`, `foot()`, `logo(h)`, `themeBtn(cls,label)`.
- `PAGES` = every page {k, href, en, bn, icon, group:'main'|'manage'}. `BOTTOM_ITEMS = ['dashboard','orders','stock','repairs','more']` (keys of PAGES + `'more'`); `bottombar(items)` / `moreSheet(items)` accept a list so Phase 5 can pass the user's choice. `SETTINGS_PAGE = null` is the reserved spot: set it to `{k,href,en,bn,icon:'gear'}` and sidebar + More sheet show it.
- `TITLE_BN` maps page titles to Bangla hints (used in page header and mobile top bar).
- Icons: add a path to `S` in views.js, use `icon('name')`. Classes `.ic` (svg), `.ts/.tm` (sun/moon shown per theme).
- CSS variables: `--bg --sf --sf2 --bd --tx --mu --acc --on --link --glow --ok/--okb --er/--erb --wn --dng --sh --hero --herotx --herobd --focus`; themes via `:root[data-theme=dark|light]`; sidebar width `--sw`, collapsed via `:root[data-side=min]`.
- Classes: `.card .hero .grid .k .v .row .w .err .ok .warn .btn .gray .red .bn .sr`; shell: `.side .ni .gl .top .tt .ib .bar .bi .sheet .sp .si`; login: `.lg .lc .lh .lt`.
- JS hooks: `data-act="theme|collapse|more|close"`, `data-nav` (active-state), localStorage `bdap-theme` (light|dark), `bdap-side` (min|full). Inline `HEAD_JS` in `<head>` applies both before paint.
- Cache busting: asset URLs carry `?v=<file mtime>`.
- Page title h1 is `.ptitle` (visually hidden on mobile because the top bar shows the title).

## Known issues / not verified
- **Could not run Postgres or `npm install` in the build sandbox** (no network). Verified: `node --check` on all JS; `views.js` + login markup rendered and screenshotted in Chromium (dark/light, 1280px/360px, collapsed sidebar, More sheet, login); theme + sidebar persistence after reload; active-nav on `/stock/adjust` and `/suppliers`; no horizontal page scroll at 360px. The real Express app was NOT started — owner must run it (see test list).
- Dashboard still the old content (restyled only); the `.hero` card style is defined but not yet used.
- Wide tables (4+ columns) scroll sideways inside `.w` on phones by design.
- No gzip (no compression dependency added).

## Next phase must do (Phase 3: pop-up forms)
Turn Quick actions (`quickActions()` in `src/dash.js`, also reusable inside popups) and the popup "+ New …" buttons into AJAX pop-up forms opened with `openSheet(title, node)` (see below): New order, Expense, Purchase, Add product, Adjust stock, new repair ticket. Keep every form field name and route; keep `post()` (transaction + one-time `_t` token + redirect) working for non-JS use, and add a JSON/AJAX response path next to it. Note `/stock/adjust` is POST-only (the Adjust-stock link goes to `/stock`).

# Phase 2 — what was done
## New / changed files
- `src/dash.js` (NEW) — `GET /` (server-rendered dashboard), `GET /api/dash`, `GET /api/dash/:card`. Exports `module.exports = app => …` and `.quickActions`.
- `src/reports.js` — old `/` dashboard removed. File now exports `app => {/health, /version}` (registered BEFORE auth) and `.pages(app)` (`/reports`, registered AFTER auth).
- `src/server.js` — registers `'dash'` with the other modules after the auth gate, then `require('./reports').pages(app)`.
- `src/views.js` — 4 new sprite icons: `alert clock down up`.
- `public/app.css` (14.5 KB) — appended dashboard + popup styles. `public/app.js` (~12 KB) — appended `openSheet` and dashboard logic.

## SECURITY FIX (please note)
In the Phase 1 zip, `require('./reports')(app)` ran before the auth gate, so `/` and `/reports` (P&L, audit log) were reachable without login. Fixed as above; verified that `/`, `/reports`, `/api/dash*` redirect to `/login` when logged out, while `/health` stays public.

## Conventions introduced
- Range: `?r=today|week|month|custom[&from=YYYY-MM-DD&to=YYYY-MM-DD]`. today = today (Asia/Dhaka); week = LAST 7 DAYS incl. today; month = 1st of month..today; custom validated (bad dates fall back to today). Server fn `range(q)`.
- Last range is remembered in localStorage `bdap-range` AND cookie `bdap-range` (`today|week|month|custom_FROM_TO`) so the server draws the right range on first paint (no flicker).
- `GET /api/dash` → `{r,from,to,rl,cards:{orders,cash,low,repairs,sellable,progress,recv,pay}}`, each `{v,sub}` display strings. `GET /api/dash/:card` → `{title,bn,total,note?,rows:[{a,b,v,href}],viewAllUrl,actions:[{href,en,bn,p}]}` (p=1 primary). 404 JSON for unknown card. `Cache-Control: no-store`.
- `openSheet(title, node)` (global, in app.js) → `{body,set(node),close()}`. `title` = string or DOM node. Bottom sheet < 900px (grip drag-down, tap outside, Esc, browser Back, scroll lock), centered modal >= 900px; focus moves in and is restored. Build content with DOM + `textContent` (never innerHTML with data). Helpers inside app.js IIFE: `el(tag,cls,text)`, `hint(parent,en,bn)`.
- CSS: `.dg` card grid, `.dc` card (`.w2` span 2, `.d2` span 2 on desktop, `.hero`), `.ch .nw .ct .v .cs`, `.chips`, `.cust`, `.qa` quick actions, popup `.dlg .dp .dz .db .df .tot .li .lm .lv .va .sk`.
- Card keys: `orders cash low repairs sellable progress recv pay`. To add a card: add to `CARDS`, `vals()`, `detail()` in dash.js.

## Definitions used (cross-checked against the old SQL on test data: dues, cash, sellable matched exactly)
- Orders (range): orders with `odate` in range, status NOT Cancelled/Returned; count + sum of `total` (Partially Returned counted at full total).
- Cash: sum over accounts of `opening + SUM(account_txns)` (same formula as before). Low stock: the exact old query. Dues to receive: `SUM(cod_expected)` for Dispatched/Delivered/Partially Returned with `settled=false`. Dues to pay: `SUM(total-paid-credit)` over purchases. (Popup rows list only positive items; the total is the exact old sum.)
- Pending repairs: repairs in Needs Repair / Sent for Repair / Awaiting Return-to-Stock Approval (ticket count).
- Sellable: `SUM(qty)` of bucket `good`. Pending progress: Dispatched orders (count) + reserved / needs_repair / under_repair / awaiting_approval stock units (sum shown on card, split in popup).
- Cards show whole taka (`tk0`, Indian grouping); popups show exact `taka()`.

## Known issues / owner to check
- Bangla hints are mine; owner should review wording (e.g. "নগদ ব্যালেন্স", "চলমান কাজ", "পাওনা", "দেনা").
- Card/Quick-action links go to list pages (forms live there); Phase 3 replaces with pop-ups. /orders list filters by date, so snapshot links add `from=2000-01-01&to=today`; "Dues to receive" View all shows all statuses (the list supports only one status filter).
- Progress popup mixes orders (count) and stock units; each row is labelled.
- Tested: real Express + PostgreSQL 16 + Chromium (390px dark, 1280px light): auth redirects, API numbers, range chips incl. custom + reload persistence, popup open/close by Esc / Back / outside tap, focus restore, scroll lock, no horizontal scroll, no console errors. NOT tested: real phone swipe-to-close, iOS Safari, slow network, Render deploy, dark-desktop/light-mobile screenshots.
