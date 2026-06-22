const express = require('express');
const pool = require('../db');
const { authMiddleware, requireRole, requirePlan } = require('../middleware/auth');
const { todayIST, addDaysToDateStr, IST_SHIFT } = require('../utils/date');

const router = express.Router();
router.use(authMiddleware);

// Trends/Analytics is owner-only, and Basic plan or above (Trial doesn't
// include it) — staff (cashier/waiter) PIN logins must not see this either way.
// GET /analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', requireRole('owner'), requirePlan('basic', 'pro'), async (req, res) => {
  const to = req.query.to || todayIST();
  const from = req.query.from || addDaysToDateStr(to, -6);
  const rid = req.restaurant_id;

  try {
    // Daily sales
    const [daily] = await pool.query(
      `SELECT DATE(created_at, '${IST_SHIFT}') AS date,
              COUNT(*) AS order_count,
              COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE restaurant_id=? AND DATE(created_at, '${IST_SHIFT}') BETWEEN ? AND ? AND status='billed'
       GROUP BY DATE(created_at, '${IST_SHIFT}')
       ORDER BY date ASC`,
      [rid, from, to]
    );

    // Top items by quantity
    const [topItems] = await pool.query(
      `SELECT oi.item_name,
              SUM(oi.qty) AS total_qty,
              COALESCE(SUM(oi.line_total), 0) AS total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id=? AND DATE(o.created_at, '${IST_SHIFT}') BETWEEN ? AND ? AND o.status='billed'
       GROUP BY oi.item_name
       ORDER BY total_qty DESC
       LIMIT 10`,
      [rid, from, to]
    );

    // Day-of-week averages (0=Sun, 1=Mon...6=Sat)
    const [dow] = await pool.query(
      `SELECT CAST(strftime('%w', created_at, '${IST_SHIFT}') AS INTEGER) AS dow,
              COUNT(*) AS order_count,
              COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE restaurant_id=? AND DATE(created_at, '${IST_SHIFT}') BETWEEN ? AND ? AND status='billed'
       GROUP BY dow
       ORDER BY dow ASC`,
      [rid, from, to]
    );

    // Payment mode split
    const [payments] = await pool.query(
      `SELECT payment_mode, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE restaurant_id=? AND DATE(created_at, '${IST_SHIFT}') BETWEEN ? AND ? AND status='billed'
       GROUP BY payment_mode`,
      [rid, from, to]
    );

    res.json({ from, to, daily, topItems, dow, payments });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
