CREATE TABLE IF NOT EXISTS restaurants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  owner_name    TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial' CHECK(plan IN ('trial','basic','pro')),
  plan_expiry   TEXT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT NULL,
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'waiter' CHECK(role IN ('owner','cashier','waiter')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  name          TEXT NOT NULL,
  price         REAL NOT NULL,
  category      TEXT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id   INTEGER NOT NULL,
  table_no        TEXT NULL,
  customer_name   TEXT NULL,
  customer_phone  TEXT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','partial','credit')),
  payment_mode    TEXT NULL,
  subtotal        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  created_by      INTEGER NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  billed_at       TEXT NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL,
  menu_item_id  INTEGER NULL,
  item_name     TEXT NOT NULL,
  price         REAL NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  line_total    REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  order_id      INTEGER NULL,
  amount        REAL NOT NULL,
  mode          TEXT NOT NULL CHECK(mode IN ('cash','upi','credit_given','credit_settled')),
  note          TEXT NULL,
  paid_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS khata (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id   INTEGER NOT NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  balance         REAL NOT NULL DEFAULT 0,
  last_updated    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE(restaurant_id, customer_phone)
);

CREATE TABLE IF NOT EXISTS expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  category      TEXT NOT NULL,
  amount        REAL NOT NULL,
  mode          TEXT NOT NULL DEFAULT 'cash' CHECK(mode IN ('cash','upi')),
  note          TEXT NULL,
  expense_date  TEXT NOT NULL,
  created_by    INTEGER NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
);
