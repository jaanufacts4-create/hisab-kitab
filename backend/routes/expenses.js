const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { todayIST } = require('../utils/date');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const date = req.query.date || todayIST();
  const [rows] = await pool.query(
    'SELECT id, category, amount, mode, note, expense_date FROM expenses WHERE restaurant_id = ? AND expense_date = ? ORDER BY created_at DESC',
    [req.restaurant_id, date]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { category, amount, note, expense_date, mode } = req.body;
  if (!category || !amount) return res.status(400).json({ error: 'Category and amount are required' });

  const [result] = await pool.query(
    'INSERT INTO expenses (restaurant_id, category, amount, mode, note, expense_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.restaurant_id, category, amount, mode || 'cash', note || null, expense_date || todayIST(), req.staff_id]
  );
  res.json({ id: result.insertId });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id = ? AND restaurant_id = ?', [req.params.id, req.restaurant_id]);
  res.json({ ok: true });
});

module.exports = router;
