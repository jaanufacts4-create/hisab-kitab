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
  if (!readyPromise) readyPromise = initDb();
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
