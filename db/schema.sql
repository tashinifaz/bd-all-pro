CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
INSERT INTO settings VALUES('business','BD ALL PRO (gadget)'),('currency','BDT'),('tz','Asia/Dhaka') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS categories(id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
INSERT INTO categories(name) VALUES('Neckband'),('Earbuds'),('Smartwatch'),('Speaker'),('Power Bank'),('Charger'),('Cable'),('Other') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS products(
  id SERIAL PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, brand TEXT, model TEXT,
  category_id INT REFERENCES categories(id), description TEXT,
  default_cost NUMERIC(12,2) NOT NULL DEFAULT 0, price NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_cost NUMERIC(14,4) NOT NULL DEFAULT 0, min_stock INT NOT NULL DEFAULT 0,
  serialized BOOLEAN NOT NULL DEFAULT FALSE, archived BOOLEAN NOT NULL DEFAULT FALSE);
-- buckets: good, reserved, needs_repair, under_repair, awaiting_approval, damaged
CREATE TABLE IF NOT EXISTS stock_balances(
  product_id INT REFERENCES products(id), bucket TEXT NOT NULL, qty INT NOT NULL DEFAULT 0 CHECK(qty>=0),
  PRIMARY KEY(product_id,bucket));
CREATE TABLE IF NOT EXISTS stock_movements(
  id BIGSERIAL PRIMARY KEY, product_id INT REFERENCES products(id), from_bucket TEXT, to_bucket TEXT,
  qty INT NOT NULL, mtype TEXT NOT NULL, ref TEXT, reason TEXT, unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS product_serials(
  id SERIAL PRIMARY KEY, product_id INT REFERENCES products(id), serial TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_stock', ref TEXT, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS financial_accounts(
  id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, kind TEXT NOT NULL DEFAULT 'cash', opening NUMERIC(14,2) NOT NULL DEFAULT 0);
INSERT INTO financial_accounts(name,kind) VALUES('Cash','cash'),('Bank','bank'),('bKash/Nagad','mfs') ON CONFLICT DO NOTHING;
-- kind: supplier_pay, receipt, cod_settle, refund, cancel_refund, expense, transfer_in, transfer_out, supplier_refund
CREATE TABLE IF NOT EXISTS account_txns(
  id BIGSERIAL PRIMARY KEY, account_id INT REFERENCES financial_accounts(id), kind TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL, ref TEXT, note TEXT, txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS suppliers(id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, notes TEXT, active BOOLEAN DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS purchases(
  id SERIAL PRIMARY KEY, supplier_id INT REFERENCES suppliers(id), invoice_no TEXT, pdate DATE NOT NULL DEFAULT CURRENT_DATE,
  discount NUMERIC(14,2) DEFAULT 0, extra_cost NUMERIC(14,2) DEFAULT 0, total NUMERIC(14,2) NOT NULL,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0, credit NUMERIC(14,2) NOT NULL DEFAULT 0, note TEXT);
CREATE TABLE IF NOT EXISTS purchase_items(
  id SERIAL PRIMARY KEY, purchase_id INT REFERENCES purchases(id), product_id INT REFERENCES products(id),
  qty INT NOT NULL CHECK(qty>0), unit_cost NUMERIC(14,4) NOT NULL, landed_unit_cost NUMERIC(14,4) NOT NULL);
CREATE TABLE IF NOT EXISTS customers(id SERIAL PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, notes TEXT);
CREATE INDEX IF NOT EXISTS customers_phone ON customers(phone);
CREATE TABLE IF NOT EXISTS orders(
  id SERIAL PRIMARY KEY, order_no TEXT UNIQUE NOT NULL, customer_id INT REFERENCES customers(id), odate DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Confirmed', channel TEXT, discount NUMERIC(14,2) DEFAULT 0, delivery_fee NUMERIC(14,2) DEFAULT 0,
  advance NUMERIC(14,2) DEFAULT 0, total NUMERIC(14,2) NOT NULL, cod_expected NUMERIC(14,2) NOT NULL DEFAULT 0,
  courier TEXT, tracking TEXT, dispatch_date DATE, delivered_date DATE, cod_received NUMERIC(14,2) DEFAULT 0,
  courier_fee NUMERIC(14,2) DEFAULT 0, settled BOOLEAN DEFAULT FALSE, cancel_reason TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS order_items(
  id SERIAL PRIMARY KEY, order_id INT REFERENCES orders(id), product_id INT REFERENCES products(id),
  qty INT NOT NULL CHECK(qty>0), price NUMERIC(14,2) NOT NULL, unit_cost NUMERIC(14,4) NOT NULL, returned_qty INT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS repairs(
  id SERIAL PRIMARY KEY, ref TEXT UNIQUE NOT NULL, product_id INT REFERENCES products(id), qty INT NOT NULL CHECK(qty>0),
  serial TEXT, fault TEXT, shop TEXT, status TEXT NOT NULL DEFAULT 'Needs Repair', found_date DATE DEFAULT CURRENT_DATE,
  sent_date DATE, expected_date DATE, actual_date DATE, cost NUMERIC(14,2) DEFAULT 0, warranty TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS expenses(
  id SERIAL PRIMARY KEY, edate DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  account_id INT REFERENCES financial_accounts(id), payee TEXT, note TEXT, ref TEXT);
CREATE TABLE IF NOT EXISTS idem(token TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log(id BIGSERIAL PRIMARY KEY, action TEXT, detail TEXT, created_at TIMESTAMPTZ DEFAULT now());
