const express = require('express');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { todayIST, IST_SHIFT } = require('../utils/date');

const router = express.Router();
router.use(authMiddleware);

// Sales dashboard is owner-only — staff (cashier/waiter) PIN logins must not see this.
router.get('/summary', requireRole('owner'), async (req, res) => {
  const date = req.query.date || todayIST();
  const restaurantId = req.restaurant_id;

  const [salesRows] = await pool.query(
    `SELECT
       COALESCE(SUM(total), 0) AS total_sales,
       COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total ELSE 0 END), 0) AS cash_total,
       COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN total ELSE 0 END), 0) AS upi_total,
       COALESCE(SUM(CASE WHEN payment_mode = 'credit' THEN total ELSE 0 END), 0) AS credit_total,
       COUNT(*) AS order_count
     FROM orders
     WHERE restaurant_id = ? AND DATE(created_at, '${IST_SHIFT}') = ? AND status = 'billed'`,
    [restaurantId, date]
  );

  const [expenseRows] = await pool.query(
    `SELECT
       COALESCE(SUM(amount), 0) AS total_expenses,
       COALESCE(SUM(CASE WHEN mode = 'cash' THEN amount ELSE 0 END), 0) AS cash_expenses,
       COALESCE(SUM(CASE WHEN mode = 'upi' THEN amount ELSE 0 END), 0) AS upi_expenses
     FROM expenses WHERE restaurant_id = ? AND expense_date = ?`,
    [restaurantId, date]
  );

  const [khataRows] = await pool.query(
    `SELECT COALESCE(SUM(balance), 0) AS total_outstanding FROM khata WHERE restaurant_id = ? AND balance > 0`,
    [restaurantId]
  );

  const [openOrdersRows] = await pool.query(
    `SELECT COUNT(*) AS open_orders FROM orders WHERE restaurant_id = ? AND status = 'open'`,
    [restaurantId]
  );

  const cash_total = salesRows[0].cash_total;
  const cash_expenses = expenseRows[0].cash_expenses;

  res.json({
    date,
    ...salesRows[0],
    ...expenseRows[0],
    ...khataRows[0],
    ...openOrdersRows[0],
    net_cash_in_hand: cash_total - cash_expenses,
  });
});

module.exports = router;
