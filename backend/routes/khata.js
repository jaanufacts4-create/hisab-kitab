const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// List all customers with an outstanding or historical balance
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, customer_name, customer_phone, balance, last_updated
     FROM khata WHERE restaurant_id = ? ORDER BY balance DESC, last_updated DESC`,
    [req.restaurant_id]
  );
  res.json(rows);
});

// Payment history for a single customer (their orders + settlements)
router.get('/:phone/history', async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, total, payment_mode, created_at FROM orders
     WHERE restaurant_id = ? AND customer_phone = ? AND payment_mode = 'credit' ORDER BY created_at DESC`,
    [req.restaurant_id, req.params.phone]
  );
  const [settlements] = await pool.query(
    `SELECT amount, paid_at FROM payments
     WHERE restaurant_id = ? AND mode = 'credit_settled'
       AND order_id IN (SELECT id FROM orders WHERE customer_phone = ? AND restaurant_id = ?)
     ORDER BY paid_at DESC`,
    [req.restaurant_id, req.params.phone, req.restaurant_id]
  );
  res.json({ credit_orders: orders, settlements });
});

// Record a settlement: customer pays off some/all of their khata balance
// body: { customer_phone, amount, mode: 'cash'|'upi' }
router.post('/settle', async (req, res) => {
  const { customer_phone, amount, mode } = req.body;
  if (!customer_phone || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Customer and a valid amount are required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM khata WHERE restaurant_id = ? AND customer_phone = ? FOR UPDATE',
      [req.restaurant_id, customer_phone]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'No khata entry found for this customer' });
    }

    await conn.query(
      'UPDATE khata SET balance = balance - ? WHERE restaurant_id = ? AND customer_phone = ?',
      [amount, req.restaurant_id, customer_phone]
    );
    await conn.query(
      `INSERT INTO payments (restaurant_id, amount, mode, note) VALUES (?, ?, 'credit_settled', ?)`,
      [req.restaurant_id, amount, `Khata settlement - ${customer_phone}`]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not record settlement' });
  } finally {
    conn.release();
  }
});

module.exports = router;
