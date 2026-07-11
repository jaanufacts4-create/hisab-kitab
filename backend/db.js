const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error(
    'Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in backend/.env — ' +
    'get these from your Turso database\'s "Connect" tab and add them there.'
  );
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function cleanSql(sql) {
  return sql
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\s+FOR UPDATE\b/gi, '')
    .trim();
}

// Turn a libsql ResultSet into the same [{...}] row shape the rest of the
// app already expects (built from columns + positional access rather than
// trusting any particular Row object behavior).
function toPlainRows(result) {
  const cols = result.columns || [];
  return result.rows.map((row) => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ---- One-time schema + migrations, run lazily on first use ----
let readyPromise = null;
function ensureReady() {
    // If initDb() ever rejects (e.g. a transient Turso/network blip during a
    // cold start), don't cache the rejection forever — that would silently
    // fail every single request on this process until Render restarts it.
    // Clearing the cache lets the next call retry from scratch.
    if (!readyPromise) {
          readyPromise = initDb().catch((err) => {
                  readyPromise = null;
                  throw err;
          });
    }
  return readyPromise;
}

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema-sqlite.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.executeMultiple(schemaSql);
  }

  // Migration 1: add mode column to expenses (older DBs only)
  try {
    await client.execute("ALTER TABLE expenses ADD COLUMN mode TEXT NOT NULL DEFAULT 'cash'");
  } catch (e) { /* already exists */ }

  // Migration 1b: per-item kitchen status + timestamp on order_items (older
  // DBs only) — lets staff see "Roti ×1 Served" vs a newly added "Roti ×2"
  // that still needs Accept, instead of one merged item list per order.
  try {
    await client.execute("ALTER TABLE order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'open'");
  } catch (e) { /* already exists */ }
  // NOTE: ALTER TABLE ADD COLUMN with a non-constant default (datetime('now'))
  // isn't reliably supported here (it silently failed on Turso, leaving the
  // column missing entirely and breaking every query that referenced it).
  // Add it as a plain nullable column instead, then backfill.
  try {
    await client.execute('ALTER TABLE order_items ADD COLUMN created_at TEXT');
  } catch (e) { /* already exists */ }
  try {
    await client.execute("UPDATE order_items SET created_at = datetime('now') WHERE created_at IS NULL");
  } catch (e) { console.error('Backfill order_items.created_at failed:', e.message); }

  // Migration 1c: per-restaurant QR token for customer self-order pages
  // (older DBs only). Nullable, simple constant default — generated lazily
  // by GET /api/restaurant/qr the first time an owner asks for their QR.
  try {
    await client.execute('ALTER TABLE restaurants ADD COLUMN qr_token TEXT');
  } catch (e) { /* already exists */ }

  // Migration 1d: admin's UPI ID (for receiving upgrade payments) + the
  // amount due for a specific client. upi_id only ever gets set on the
  // admin's own row; due_amount is set per-client by the admin.
  try {
    await client.execute('ALTER TABLE restaurants ADD COLUMN upi_id TEXT');
  } catch (e) { /* already exists */ }
  try {
    await client.execute('ALTER TABLE restaurants ADD COLUMN due_amount REAL');
  } catch (e) { /* already exists */ }

  // Migration 2: fix orders table (remove old status CHECK constraint) — only
  // relevant for DBs created before schema-sqlite.sql was fixed; harmless no-op
  // on a fresh Turso database.
  try {
    const bak = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_orders_bak'"
    );
    if (bak.rows.length) {
      const ordersExists = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
      );
      if (!ordersExists.rows.length) {
        await client.execute("ALTER TABLE _orders_bak RENAME TO orders");
        console.log('Migration 2: restored orders from backup');
      } else {
        await client.execute("DROP TABLE _orders_bak");
      }
    }

    const row = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
    );
    const ordersSql = row.rows[0] ? row.rows[0][0] : null;
    if (ordersSql && String(ordersSql).includes("'open','billed','cancelled'")) {
      await client.execute("ALTER TABLE orders RENAME TO _orders_bak");
      await client.execute(
        "CREATE TABLE orders (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
        "restaurant_id INTEGER NOT NULL," +
        "table_no TEXT," +
        "customer_name TEXT," +
        "customer_phone TEXT," +
        "status TEXT NOT NULL DEFAULT 'open'," +
        "payment_status TEXT NOT NULL DEFAULT 'unpaid'," +
        "payment_mode TEXT," +
        "subtotal REAL NOT NULL DEFAULT 0," +
        "total REAL NOT NULL DEFAULT 0," +
        "created_by INTEGER," +
        "created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
        "billed_at TEXT)"
      );
      await client.execute("INSERT INTO orders SELECT * FROM _orders_bak");
      await client.execute("DROP TABLE _orders_bak");
      console.log('Migration 2: orders table rebuilt');
    }
  } catch (e) {
    console.error('Migration 2 error:', e.message);
  }

  // Migration 3: add 'kitchen' to the staff role CHECK constraint — only
  // relevant for DBs whose staff table predates the Kitchen role; harmless
  // no-op on a fresh database.
  try {
    const bak = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_staff_bak'"
    );
    if (bak.rows.length) {
      const staffExists = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='staff'"
      );
      if (!staffExists.rows.length) {
        await client.execute("ALTER TABLE _staff_bak RENAME TO staff");
      } else {
        await client.execute("DROP TABLE _staff_bak");
      }
    }

    const row = await client.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='staff'"
    );
    const staffSql = row.rows[0] ? row.rows[0][0] : null;
    if (staffSql && !String(staffSql).includes('kitchen')) {
      await client.execute("ALTER TABLE staff RENAME TO _staff_bak");
      await client.execute(
        "CREATE TABLE staff (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
        "restaurant_id INTEGER NOT NULL," +
        "name TEXT NOT NULL," +
        "phone TEXT," +
        "pin_hash TEXT NOT NULL," +
        "role TEXT NOT NULL DEFAULT 'waiter' CHECK(role IN ('owner','cashier','waiter','kitchen'))," +
        "is_active INTEGER NOT NULL DEFAULT 1," +
        "created_at TEXT NOT NULL DEFAULT (datetime('now')))"
      );
      await client.execute("INSERT INTO staff SELECT * FROM _staff_bak");
      await client.execute("DROP TABLE _staff_bak");
      console.log('Migration 3: staff table rebuilt with kitchen role');
    }
  } catch (e) {
    console.error('Migration 3 error:', e.message);
  }

  // Migration 4: add can_show_qr permission column to staff
  try {
    await client.execute('ALTER TABLE staff ADD COLUMN can_show_qr INTEGER NOT NULL DEFAULT 0');
  } catch (e) { /* already exists */ }

  // Migration 5: track which staff member collected the payment
  try {
    await client.execute('ALTER TABLE orders ADD COLUMN collected_by_staff_id INTEGER NULL');
  } catch (e) { /* already exists */ }

  // Migration 7: accepted_at and ready_at timestamps on orders (for kitchen timer)
  try {
    await client.execute('ALTER TABLE orders ADD COLUMN accepted_at TEXT NULL');
  } catch (e) { /* already exists */ }
  try {
    await client.execute('ALTER TABLE orders ADD COLUMN ready_at TEXT NULL');
  } catch (e) { /* already exists */ }

  // Migration 6: inventory + menu_recipes tables
  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS inventory (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "restaurant_id INTEGER NOT NULL," +
      "name TEXT NOT NULL," +
      "unit TEXT NOT NULL DEFAULT 'g'," +
      "stock REAL NOT NULL DEFAULT 0," +
      "min_stock REAL NOT NULL DEFAULT 0," +
      "created_at TEXT NOT NULL DEFAULT (datetime('now'))," +
      "FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE)"
    );
  } catch (e) { console.error('Migration 6a error:', e.message); }
  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS menu_recipes (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "menu_item_id INTEGER NOT NULL," +
      "inventory_id INTEGER NOT NULL," +
      "qty_per_serving REAL NOT NULL," +
      "FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE," +
      "FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE," +
      "UNIQUE(menu_item_id, inventory_id))"
    );
  } catch (e) { console.error('Migration 6b error:', e.message); }

  try {
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('DB tables (Turso):', toPlainRows(tables).map((t) => t.name).join(', '));
  } catch (e) { /* ignore */ }
}

async function runQuery(sql, params) {
  await ensureReady();
  if (params === undefined) params = [];
  const s = cleanSql(sql);
  const result = await client.execute({ sql: s, args: params });
  const upper = s.replace(/\s+/g, ' ').trimStart().toUpperCase();
  if (upper.startsWith('SELECT')) {
    return [toPlainRows(result)];
  } else {
    return [{ insertId: Number(result.lastInsertRowid), affectedRows: result.rowsAffected }];
  }
}

const pool = {
  query: async function (sql, params) { return runQuery(sql, params); },
  getConnection: async function () {
    await ensureReady();
    const tx = await client.transaction('write');
    let active = true;

    async function txQuery(sql, params) {
      if (params === undefined) params = [];
      const s = cleanSql(sql);
      const result = await tx.execute({ sql: s, args: params });
      const upper = s.replace(/\s+/g, ' ').trimStart().toUpperCase();
      if (upper.startsWith('SELECT')) {
        return [toPlainRows(result)];
      } else {
        return [{ insertId: Number(result.lastInsertRowid), affectedRows: result.rowsAffected }];
      }
    }

    return {
      query: txQuery,
      // libsql already opens the transaction in client.transaction('write')
      // above, so this is just kept for API compatibility with callers.
      beginTransaction: async function () {},
      commit: async function () { if (active) { await tx.commit(); active = false; } },
      rollback: async function () { if (active) { await tx.rollback(); active = false; } },
      release: async function () { try { tx.close(); } catch (e) { /* ignore */ } },
    };
  },
};

module.exports = pool;
