const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, price, category, is_active FROM menu_items WHERE restaurant_id = ? AND is_active = TRUE ORDER BY category, name',
    [req.restaurant_id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'Name and price are required' });

    const [result] = await pool.query(
      'INSERT INTO menu_items (restaurant_id, name, price, category) VALUES (?, ?, ?, ?)',
      [req.restaurant_id, name, price, category || null]
    );
    res.json({ id: result.insertId, name, price, category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add menu item' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, price, category } = req.body;
  await pool.query(
    'UPDATE menu_items SET name = COALESCE(?, name), price = COALESCE(?, price), category = COALESCE(?, category) WHERE id = ? AND restaurant_id = ?',
    [name, price, category, req.params.id, req.restaurant_id]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  // soft delete so existing order_items keep their historical reference intact
  await pool.query(
    'UPDATE menu_items SET is_active = FALSE WHERE id = ? AND restaurant_id = ?',
    [req.params.id, req.restaurant_id]
  );
  res.json({ ok: true });
});

module.exports = router;
