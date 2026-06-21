const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { todayIST, IST_SHIFT } = require('../utils/date');

const router = express.Router();
router.use(authMiddleware);

// ---- Create a new order ----
router.post('/', async (req, res) => {
  const { table_no, customer_name, customer_phone, items, payment } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Add at least one item to the order' });
  }
  if (payment && payment.mode === 'credit' && !customer_phone) {
    return res.status(400).json({ error: 'Customer phone is required for khata' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const total = subtotal;
    const isBilled = !!payment;
    const payment_status = !payment ? 'unpaid'
      : payment.mode === 'credit' ? 'credit'
      : payment.amount < total ? 'partial' : 'paid';

    const [orderResult] = await conn.query(
      'INSERT INTO orders (restaurant_id,table_no,customer_name,customer_phone,status,payment_status,payment_mode,subtotal,total,created_by,billed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.restaurant_id, table_no||null, customer_name||null, customer_phone||null,
       isBilled?'billed':'open', payment_status, payment?payment.mode:null,
       subtotal, total, req.staff_id, isBilled?new Date().toISOString():null]
    );
    const orderId = orderResult.insertId;

    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id,menu_item_id,item_name,price,qty,line_total) VALUES (?,?,?,?,?,?)',
        [orderId, it.menu_item_id||null, it.name, it.price, it.qty, it.price*it.qty]
      );
    }
    if (payment) {
      const paidAmount = payment.mode === 'credit' ? 0 : payment.amount;
      await conn.query(
        'INSERT INTO payments (restaurant_id,order_id,amount,mode) VALUES (?,?,?,?)',
        [req.restaurant_id, orderId, paidAmount, payment.mode==='credit'?'credit_given':payment.mode]
      );
      if (payment.mode === 'credit') {
        await conn.query(
          'INSERT INTO khata (restaurant_id,customer_name,customer_phone,balance) VALUES (?,?,?,?) ON CONFLICT(restaurant_id,customer_phone) DO UPDATE SET balance=balance+excluded.balance,customer_name=excluded.customer_name',
          [req.restaurant_id, customer_name||'Customer', customer_phone, total]
        );
      }
    }
    await conn.commit();
    res.json({ id: orderId, subtotal, total, payment_status });
  } catch (err) {
    await conn.rollback();
    console.error('Order save error:', err.message);
    res.status(500).json({ error: err.message || 'Could not save the order' });
  } finally { conn.release(); }
});

// ---- Add items to an existing open/preparing/ready order ----
// (ready orders get bumped back to "preparing" since the new items aren't cooked yet)
router.post('/:id/items', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      'SELECT * FROM orders WHERE id=? AND restaurant_id=?',
      [req.params.id, req.restaurant_id]
    );
    if (!orderRows.length) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }
    const order = orderRows[0];
    if (['billed','cancelled'].includes(order.status)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cannot add items to a completed order' });
    }
    const addedAmount = items.reduce((sum, it) => sum + it.price * it.qty, 0);
    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id,menu_item_id,item_name,price,qty,line_total) VALUES (?,?,?,?,?,?)',
        [order.id, it.menu_item_id||null, it.name, it.price, it.qty, it.price*it.qty]
      );
    }
    // If the order was already "ready" (served), the new items still need
    // kitchen prep — send it back to "preparing" instead of leaving it
    // marked ready when half the table's food hasn't even been cooked yet.
    const newStatus = order.status === 'ready' ? 'preparing' : order.status;
    await conn.query(
      'UPDATE orders SET subtotal=subtotal+?,total=total+?,status=? WHERE id=?',
      [addedAmount, addedAmount, newStatus, order.id]
    );
    await conn.commit();
    res.json({ ok: true, added: items.length, addedAmount, status: newStatus });
  } catch (err) {
    await conn.rollback();
    console.error('Add items error:', err.message);
    res.status(500).json({ error: err.message || 'Could not add items' });
  } finally { conn.release(); }
});

// ---- List orders (defaults to today, IST) ----
router.get('/', async (req, res) => {
  const date = req.query.date || todayIST();
  const [rows] = await pool.query(
    `SELECT id,table_no,customer_name,status,payment_status,payment_mode,total,created_at
     FROM orders WHERE restaurant_id=? AND DATE(created_at, '${IST_SHIFT}')=? ORDER BY created_at DESC`,
    [req.restaurant_id, date]
  );
  res.json(rows);
});

// ---- Single order with line items ----
router.get('/:id', async (req, res) => {
  const [orderRows] = await pool.query(
    'SELECT * FROM orders WHERE id=? AND restaurant_id=?',
    [req.params.id, req.restaurant_id]
  );
  if (!orderRows.length) return res.status(404).json({ error: 'Order not found' });
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id=?', [req.params.id]);
  res.json({ ...orderRows[0], items });
});

// ---- Update kitchen status ----
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['preparing','ready'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const [rows] = await pool.query(
    'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
    [req.params.id, req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Order not found' });
  await pool.query(
    'UPDATE orders SET status=? WHERE id=? AND restaurant_id=?',
    [status, req.params.id, req.restaurant_id]
  );
  res.json({ ok: true, status });
});

// ---- Record payment ----
router.put('/:id/payment', async (req, res) => {
  const { mode, amount } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query(
      'SELECT * FROM orders WHERE id=? AND restaurant_id=?',
      [req.params.id, req.restaurant_id]
    );
    if (!orderRows.length) { await conn.rollback(); return res.status(404).json({ error: 'Order not found' }); }
    const order = orderRows[0];
    if (mode === 'credit' && !order.customer_phone) {
      await conn.rollback();
      return res.status(400).json({ error: 'Phone number required for credit' });
    }
    const payment_status = mode==='credit'?'credit':amount<order.total?'partial':'paid';
    await conn.query(
      "UPDATE orders SET status='billed',payment_status=?,payment_mode=?,billed_at=datetime('now') WHERE id=?",
      [payment_status, mode, order.id]
    );
    await conn.query(
      'INSERT INTO payments (restaurant_id,order_id,amount,mode) VALUES (?,?,?,?)',
      [req.restaurant_id, order.id, mode==='credit'?0:amount, mode==='credit'?'credit_given':mode]
    );
    if (mode === 'credit') {
      await conn.query(
        'INSERT INTO khata (restaurant_id,customer_name,customer_phone,balance) VALUES (?,?,?,?) ON CONFLICT(restaurant_id,customer_phone) DO UPDATE SET balance=balance+excluded.balance',
        [req.restaurant_id, order.customer_name||'Customer', order.customer_phone, order.total]
      );
    }
    await conn.commit();
    res.json({ ok: true, payment_status });
  } catch (err) {
    await conn.rollback();
    console.error('Payment error:', err.message);
    res.status(500).json({ error: err.message || 'Could not record payment' });
  } finally { conn.release(); }
});

// ---- Cancel order ----
router.put('/:id/cancel', async (req, res) => {
  await pool.query(
    "UPDATE orders SET status='cancelled' WHERE id=? AND restaurant_id=?",
    [req.params.id, req.restaurant_id]
  );
  res.json({ ok: true });
});

module.exports = router;
