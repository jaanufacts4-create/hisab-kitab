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

    // Items on a brand-new order start at whatever the order itself starts
    // at — 'open' normally, or 'served' if this order was billed instantly
    // (walk-in/parcel paid on the spot, nothing to track in the kitchen).
    const itemStatus = isBilled ? 'served' : 'open';
    for (const it of items) {
      // created_at set explicitly here (not relying on a column default —
      // ALTER TABLE ADD COLUMN with a non-constant default isn't reliable
      // on every SQLite-compatible backend, so don't depend on it for
      // correctness on rows inserted after a migration).
      await conn.query(
        "INSERT INTO order_items (order_id,menu_item_id,item_name,price,qty,line_total,status,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))",
        [orderId, it.menu_item_id||null, it.name, it.price, it.qty, it.price*it.qty, itemStatus]
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
// New items always start at item-status "open" (need a fresh Accept), even
// if the rest of the order's items are already preparing/ready/served. The
// order's overall status gets bumped back to "open" too so the kitchen
// notices a new round needs attention — but earlier items keep whatever
// item-level status they already reached (existing "served" items don't
// get un-served just because someone ordered more food).
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
        "INSERT INTO order_items (order_id,menu_item_id,item_name,price,qty,line_total,status,created_at) VALUES (?,?,?,?,?,?,'open',datetime('now'))",
        [order.id, it.menu_item_id||null, it.name, it.price, it.qty, it.price*it.qty]
      );
    }
    // If the kitchen had already accepted (preparing) or finished (ready)
    // this order, adding more items needs to surface a fresh "Accept" step —
    // otherwise staff just see the bill total change with no clear signal
    // that new items need to be cooked. Only a still-"open" order (not yet
    // accepted at all) is left as-is.
    const newStatus = ['preparing', 'ready'].includes(order.status) ? 'open' : order.status;
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
  try {
    const date = req.query.date || todayIST();
    const [rows] = await pool.query(
      `SELECT id,table_no,customer_name,status,payment_status,payment_mode,total,created_at
       FROM orders WHERE restaurant_id=? AND DATE(created_at, '${IST_SHIFT}')=? ORDER BY created_at DESC`,
      [req.restaurant_id, date]
    );

    // Kitchen/waiter need to see WHAT to cook/serve — and at what stage each
    // item-batch is — not just the bill total. Fetched in ONE query (not
    // one-per-order): a one-query-per-order loop meant a single transient
    // failure could take down the whole list with no error shown.
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const [allItems] = await pool.query(
        `SELECT order_id, item_name, qty, status, created_at FROM order_items
         WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
        ids
      );
      const itemsByOrder = {};
      allItems.forEach((it) => {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push({
          item_name: it.item_name, qty: it.qty, status: it.status, created_at: it.created_at,
        });
      });
      rows.forEach((o) => { o.items = itemsByOrder[o.id] || []; });
    }

    res.json(rows);
  } catch (err) {
    console.error('List orders error:', err.message);
    res.status(500).json({ error: err.message || 'Could not load orders' });
  }
});

// ---- Single order with line items ----
router.get('/:id', async (req, res) => {
  const [orderRows] = await pool.query(
    'SELECT * FROM orders WHERE id=? AND restaurant_id=?',
    [req.params.id, req.restaurant_id]
  );
  if (!orderRows.length) return res.status(404).json({ error: 'Order not found' });
  const [items] = await pool.query(
    'SELECT * FROM order_items WHERE order_id=? ORDER BY created_at ASC',
    [req.params.id]
  );
  res.json({ ...orderRows[0], items });
});

// ---- Update kitchen status ----
// Cascades to item-level status too: Accept advances "open" items to
// "preparing", Mark Ready advances "preparing" items to "ready". Items that
// already moved further (e.g. already "served" from an earlier round) are
// left alone — only items still sitting at the previous stage move.
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

  const fromItemStatus = status === 'preparing' ? 'open' : 'preparing';
  await pool.query(
    "UPDATE order_items SET status=? WHERE order_id=? AND status=?",
    [status, req.params.id, fromItemStatus]
  );
  await pool.query(
    'UPDATE orders SET status=? WHERE id=? AND restaurant_id=?',
    [status, req.params.id, req.restaurant_id]
  );
  res.json({ ok: true, status });
});

// ---- Mark ready items as served (waiter action) ----
router.put('/:id/serve', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id FROM orders WHERE id=? AND restaurant_id=?',
    [req.params.id, req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Order not found' });
  await pool.query(
    "UPDATE order_items SET status='served' WHERE order_id=? AND status='ready'",
    [req.params.id]
  );
  res.json({ ok: true });
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
