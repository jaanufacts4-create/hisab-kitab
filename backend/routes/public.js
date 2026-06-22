const express = require('express');
const pool = require('../db');
const { getEffectivePlan } = require('../utils/plan');

const router = express.Router();
// NOTE: deliberately NO authMiddleware here — this router serves the
// customer-facing, no-login QR ordering flow. Every route below must
// independently look up the restaurant by qr_token and verify its
// EFFECTIVE plan (accounts for trial expiry) before doing anything, since
// there's no staff JWT to trust.

async function getProRestaurantByToken(qrToken) {
  const [rows] = await pool.query(
    "SELECT id, name, plan, plan_expiry FROM restaurants WHERE qr_token = ? AND is_active = 1",
    [qrToken]
  );
  if (!rows.length) return null;
  if (getEffectivePlan(rows[0]) !== 'pro') return null; // self-order needs Pro (or an active trial)
  return rows[0];
}

// ---- Public menu for a table's QR ----
router.get('/:qrToken/menu', async (req, res) => {
  const restaurant = await getProRestaurantByToken(req.params.qrToken);
  if (!restaurant) return res.status(404).json({ error: 'Menu not available' });

  const [items] = await pool.query(
    'SELECT id, name, price, category FROM menu_items WHERE restaurant_id = ? AND is_active = 1 ORDER BY category, name',
    [restaurant.id]
  );
  res.json({ restaurant_name: restaurant.name, items });
});

// ---- Customer places their own order ----
// SECURITY: price/name are looked up server-side from menu_items, never
// trusted from the client — a customer could otherwise submit a
// fake/cheap price for an expensive item via a direct API call.
router.post('/:qrToken/orders', async (req, res) => {
  const restaurant = await getProRestaurantByToken(req.params.qrToken);
  if (!restaurant) return res.status(404).json({ error: 'Ordering not available' });

  const { table_no, items, customer_name, customer_phone } = req.body;
  if (!table_no) return res.status(400).json({ error: 'Table number is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Add at least one item to the order' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Look up real menu items (id, price, name) — ignore anything else the
    // client sent for these fields.
    const ids = items.map((it) => it.menu_item_id);
    const placeholders = ids.map(() => '?').join(',');
    const [menuRows] = await conn.query(
      `SELECT id, name, price FROM menu_items WHERE restaurant_id=? AND is_active=1 AND id IN (${placeholders})`,
      [restaurant.id, ...ids]
    );
    const menuById = {};
    menuRows.forEach((m) => { menuById[m.id] = m; });

    const lineItems = [];
    for (const it of items) {
      const menuItem = menuById[it.menu_item_id];
      if (!menuItem) { await conn.rollback(); return res.status(400).json({ error: 'One of the items is no longer available' }); }
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      lineItems.push({ menu_item_id: menuItem.id, name: menuItem.name, price: menuItem.price, qty });
    }

    const subtotal = lineItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    const [orderResult] = await conn.query(
      "INSERT INTO orders (restaurant_id,table_no,customer_name,customer_phone,status,payment_status,subtotal,total,created_by,billed_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [restaurant.id, String(table_no), customer_name || null, customer_phone || null, 'open', 'unpaid', subtotal, subtotal, null, null]
    );
    const orderId = orderResult.insertId;

    for (const it of lineItems) {
      await conn.query(
        "INSERT INTO order_items (order_id,menu_item_id,item_name,price,qty,line_total,status,created_at) VALUES (?,?,?,?,?,?,'open',datetime('now'))",
        [orderId, it.menu_item_id, it.name, it.price, it.qty, it.price * it.qty]
      );
    }

    await conn.commit();
    res.json({ id: orderId, total: subtotal });
  } catch (err) {
    await conn.rollback();
    console.error('Public order error:', err.message);
    res.status(500).json({ error: 'Could not place order — please tell the staff' });
  } finally { conn.release(); }
});

// ---- Customer checks their own order's status ----
// Scoped tightly: only returns this one order, and only if it belongs to
// the restaurant matching this qrToken — never a list of all orders.
router.get('/:qrToken/orders/:orderId', async (req, res) => {
  const restaurant = await getProRestaurantByToken(req.params.qrToken);
  if (!restaurant) return res.status(404).json({ error: 'Not available' });

  const [orderRows] = await pool.query(
    'SELECT id,table_no,status,total,created_at FROM orders WHERE id=? AND restaurant_id=?',
    [req.params.orderId, restaurant.id]
  );
  if (!orderRows.length) return res.status(404).json({ error: 'Order not found' });

  const [items] = await pool.query(
    'SELECT item_name, qty, status FROM order_items WHERE order_id=? ORDER BY created_at ASC',
    [req.params.orderId]
  );
  res.json({ ...orderRows[0], items });
});

module.exports = router;
