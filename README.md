# BD ALL PRO Business Management System

Lightweight, online-only business app for **BD ALL PRO (gadget)** — stock, purchases, orders/COD, repairs, expenses, cashbook and profit reports.
Stack: Node.js + Express + PostgreSQL, server-rendered HTML, **4 dependencies** (`express`, `pg`, `bcryptjs`, `cookie-session`). Mobile friendly. No external APIs.

## What's included
Login (single owner) · Dashboard · Products/categories + search (incl. serial/IMEI) · Stock by condition (good / reserved / needs repair / under repair / awaiting approval / damaged) with append-only ledger and counted-stock adjustments ·
Suppliers, purchases, partial payments, landed-cost allocation, weighted-average costing, purchase returns · Orders (WhatsApp/manual), COD, courier tracking, settlement, cancel, partial/full returns with inspection ·
Repair tickets with owner approval before resale · Expenses · Cash/Bank/MFS accounts, transfers, cashbook · P&L, cash flow, inventory value, receivables/payables · CSV exports · audit log · `/health` · duplicate-submit protection.

## Run it locally
Needs Node 18+ and a PostgreSQL database (local or a free Render/Neon one).
```bash
npm install
cp .env.example .env        # then edit the values
export $(grep -v '^#' .env | xargs)   # Windows: set the variables manually (or use a .env loader of your choice)
npm run dev                 # auto-restarts on change; opens on http://localhost:3000
```
`npm start` is what Render runs. Tables and indexes are created automatically on start (`db/schema.sql` is additive and safe to re-run).

### Environment variables (nothing else is needed)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `SESSION_SECRET` | long random text; required when `NODE_ENV=production` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | create the owner account on first start only |
| `PGSSL` | `1` for Render/hosted Postgres |
| `SEED_DEMO` | `1` = demo products on first start; remove for real use |
| `PORT` | set by Render automatically |

## Using the app (short)
- **Theme**: sun/moon button (top bar on phone, sidebar on desktop). Remembered on this device. Settings also has "Follow device".
- **Menu**: desktop/tablet (>= 900px) has a left sidebar (collapse button at its bottom). Phones get a floating bottom bar: 4 pages + **More**.
- **Change the bottom bar**: Settings > Bottom bar. Pick 1-4 pages, reorder with the arrows, Save. It is saved on your account (follows you to every device). "Reset" restores Dashboard / Orders / Stock / Repairs. "More" is always the last item.
- **Help**: the round **?** button on every page; Settings > Replay tour restarts the guided tour.
- **Wording**: Bangla hints are short and meant to be reviewed by the owner. Edit them in `src/views.js` (`TITLE_BN`, `LABEL_BN`, `PAGES`, `PRIMARY`), `src/forms.js` (pop-up forms), `public/help.js` (`HELP`, `TOUR`).

## How scanning works
Every **Scan** button (purchase serials, new order, repair ticket, add product, products search) opens the rear camera in a full-screen layer.
1. If the browser has `BarcodeDetector` (Chrome on Android, recent desktop Chrome/Edge) it is used directly; nothing extra is downloaded.
2. Otherwise (iPhone Safari, Firefox) `/vendor/zxing.min.js` (~100 KB gzipped) is downloaded once, only at that moment.
3. `public/scan.js` itself is downloaded only on the first Scan tap.
Typing or a USB/Bluetooth scanner always works; scan is optional. `GET /api/serial/:code` (login required) tells the app if a code is a unit, a repair or a product.
**Camera needs HTTPS** (or `localhost`). Render gives HTTPS automatically. On plain `http://192.168.x.x` the browser blocks the camera and the app shows a friendly message; typing still works.

## Step by step: GitHub + Render (free)

### A. Put the code on GitHub
1. Create a free account at https://github.com and click **New repository** → name it `bd-all-pro` → **Private** → Create.
2. Unzip this project. In the folder run:
   ```bash
   git init
   git add .
   git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bd-all-pro.git
   git push -u origin main
   ```
   (No git? On the repo page use **Add file → Upload files**, drag in the *contents* of the folder, and commit.)
   The `.env` file is git-ignored, so no secrets are uploaded.

### B. Create the database on Render
3. Sign up at https://render.com (use "Sign in with GitHub").
4. **New + → PostgreSQL** → Name `bd-all-pro-db` → Plan **Free** → Create Database.
5. When it's ready, copy the **Internal Database URL** (use *External* only if the web service is in another region/account).

### C. Create the web service
6. **New + → Web Service** → connect your `bd-all-pro` GitHub repo.
7. Settings: Runtime **Node**, Build command `npm install`, Start command `npm start`, Plan **Free**, Health check path `/health`.
   (Or use **New + → Blueprint**; `render.yaml` already holds these settings.)
8. Add **Environment variables**:

| Key | Value |
|---|---|
| `DATABASE_URL` | the URL copied in step 5 |
| `SESSION_SECRET` | any long random text |
| `ADMIN_USER` | e.g. `owner` |
| `ADMIN_PASSWORD` | a strong password (only used to create the owner on first start) |
| `PGSSL` | `1` |
| `NODE_ENV` | `production` |
| `SEED_DEMO` | `1` for demo products on first test, then remove / set `0` for real use |

9. Click **Create Web Service**. Wait for "Live", then open the `https://….onrender.com` link.

### D. Test checklist (≈10 minutes)
1. Open `/health` → shows `{"ok":true}`. Log in with `ADMIN_USER` / `ADMIN_PASSWORD`.
2. **Products**: add a product (SKU, cost, price, low-stock level). Try a duplicate SKU → rejected.
3. **Purchases**: add a supplier, post a purchase (qty 10, cost 500, extra cost 100, pay part) → Stock shows 10 Good, average cost includes landed cost; supplier payable shows the balance. Pay the rest on the purchase page.
4. **Orders**: create an order for 2 units + advance → stock moves Good→Reserved. Try ordering more than available → rejected. Dispatch (courier + tracking) → Deliver → Record settlement (COD received, courier fee).
5. **Reports**: net sales, COGS, gross profit and net profit appear; fee shows as an expense; cash balance changed by the net payout only.
6. **Return**: on a delivered order record a return as *Damaged* with a refund → write-off appears in P&L.
7. **Repairs**: create ticket from Good stock → Send → Complete (cost) → stock sits in *Awaiting approval* and is **not sellable** until you press **Approve**.
8. **Stock → count**: enter a different counted quantity with a reason → adjustment logged.
9. Double-click any Save button → only one record is created.
10. Export CSVs from Reports.

### Render Free notes
- The free web service sleeps after idle time (first load can take ~1 minute).
- Free Render PostgreSQL databases expire after a limited period — **export/backup regularly** (below) and upgrade or move before expiry.

## Backup & restore (portable PostgreSQL tools)
```bash
pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%F).dump     # backup
pg_restore --clean --no-owner -d "$NEW_DATABASE_URL" backup_2026-01-01.dump   # restore
```
Also use Reports → CSV exports for regular business-data copies. To move hosts: restore the dump, set the same env variables, `npm start`.

## Business rules implemented
- Costing: perpetual **weighted average**; landed cost (extra − discount) is allocated to purchase lines **by value**.
- Revenue and COGS are recognised on **delivery**; refunds reduce revenue; returns to good stock reverse COGS; damaged items are shown as write-offs (stock value excludes damaged).
- Purchases are not expenses (inventory is an asset). Repair cost is booked once as an expense; courier fee once at settlement (COD payout is booked net).
- Transfers are not income/expense. Profit and cash are separate; reports flag **provisional** when COD settlements are pending.
- No negative stock; posted records are never deleted (corrections via adjustments/returns); every stock/money operation runs in one DB transaction.

## Known limits of this first version
Serial status on customer *returns* is not auto-updated; product photos, CSV import, password-change screen and Excel export are not included (CSV export is). To change the owner password, delete the row in `users` and restart with a new `ADMIN_PASSWORD`.
Not yet run against a live database in the build environment — follow the test checklist above and report any error.

## Speed notes
Assets are served from `/public` with a 7-day cache (URLs carry `?v=<file time>` so updates show immediately). Text responses and assets are gzip-compressed with Node's built-in `zlib` (`src/gzip.js`, no dependency). Core files: `app.css` ~15 KB, `app.js` ~19 KB. Lazy: `forms.css`, `scan.js`, `help.js`, `help.css`, `vendor/zxing.min.js`, `print.css` (print only), `login.css` (login page only).

## Manual test list
See `TESTING.md`.
