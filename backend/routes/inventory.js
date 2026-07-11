const express = require('express');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ---- Inventory CRUD ----

// GET /api/inventory  — list all raw materials for the restaurant
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM inventory WHERE restaurant_id = ? ORDER BY name',
      [req.restaurant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load inventory' });
  }
});

// POST /api/inventory  — add a new raw material
router.post('/', requireRole('owner', 'cashier'), async (req, res) => {
  try {
    const { name, unit = 'g', stock = 0, min_stock = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const [result] = await pool.query(
      "INSERT INTO inventory (restaurant_id, name, unit, stock, min_stock) VALUES (?,?,?,?,?)",
      [req.restaurant_id, name.trim(), unit.trim(), Number(stock), Number(min_stock)]
    );
    const [rows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add item' });
  }
});

// PUT /api/inventory/:id  — update stock / details
router.put('/:id', requireRole('owner', 'cashier'), async (req, res) => {
  try {
    const { name, unit, stock, min_stock } = req.body;
    const [rows] = await pool.query(
      'SELECT * FROM inventory WHERE id = ? AND restaurant_id = ?',
      [req.params.id, req.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    const cur = rows[0];
    await pool.query(
      'UPDATE inventory SET name=?, unit=?, stock=?, min_stock=? WHERE id=?',
      [
        name !== undefined ? name.trim() : cur.name,
        unit !== undefined ? unit.trim() : cur.unit,
        stock !== undefined ? Number(stock) : cur.stock,
        min_stock !== undefined ? Number(min_stock) : cur.min_stock,
        req.params.id,
      ]
    );
    const [updated] = await pool.query('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update item' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM inventory WHERE id = ? AND restaurant_id = ?',
      [req.params.id, req.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    await pool.query('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete item' });
  }
});

// ---- Recipe linking ----

// GET /api/inventory/recipes/:menu_item_id
router.get('/recipes/:menu_item_id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mr.id, mr.inventory_id, mr.qty_per_serving, mr.qty_unit,
              i.name AS ingredient_name, i.unit
       FROM menu_recipes mr
       JOIN inventory i ON i.id = mr.inventory_id
       WHERE mr.menu_item_id = ?`,
      [req.params.menu_item_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load recipes' });
  }
});

// GET /api/inventory/recipes  — all recipes for all menu items of this restaurant
router.get('/recipes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mr.id, mr.menu_item_id, mr.inventory_id, mr.qty_per_serving, mr.qty_unit,
              m.name AS menu_item_name, i.name AS ingredient_name, i.unit
       FROM menu_recipes mr
       JOIN menu_items m ON m.id = mr.menu_item_id
       JOIN inventory i ON i.id = mr.inventory_id
       WHERE m.restaurant_id = ?
       ORDER BY m.name, i.name`,
      [req.restaurant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load recipes' });
  }
});

// POST /api/inventory/recipes  — add/update a recipe ingredient
router.post('/recipes', requireRole('owner', 'cashier'), async (req, res) => {
  try {
    const { menu_item_id, inventory_id, qty_per_serving, qty_unit = '' } = req.body;
    if (!menu_item_id || !inventory_id || qty_per_serving == null) {
      return res.status(400).json({ error: 'menu_item_id, inventory_id, qty_per_serving are required' });
    }
    // Verify menu_item belongs to this restaurant
    const [mRows] = await pool.query(
      'SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?',
      [menu_item_id, req.restaurant_id]
    );
    if (!mRows.length) return res.status(404).json({ error: 'Menu item not found' });

    // Upsert — update qty if the pair already exists
    await pool.query(
      `INSERT INTO menu_recipes (menu_item_id, inventory_id, qty_per_serving, qty_unit)
       VALUES (?,?,?,?)
       ON CONFLICT(menu_item_id, inventory_id)
       DO UPDATE SET qty_per_serving = excluded.qty_per_serving, qty_unit = excluded.qty_unit`,
      [menu_item_id, inventory_id, Number(qty_per_serving), qty_unit.trim()]
    );
    const [rows] = await pool.query(
      `SELECT mr.id, mr.menu_item_id, mr.inventory_id, mr.qty_per_serving, mr.qty_unit,
              i.name AS ingredient_name, i.unit
       FROM menu_recipes mr JOIN inventory i ON i.id = mr.inventory_id
       WHERE mr.menu_item_id = ? AND mr.inventory_id = ?`,
      [menu_item_id, inventory_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save recipe' });
  }
});

// DELETE /api/inventory/recipes/:id
router.delete('/recipes/:id', requireRole('owner', 'cashier'), async (req, res) => {
  try {
    // Ensure the recipe belongs to this restaurant via join
    const [rows] = await pool.query(
      `SELECT mr.id FROM menu_recipes mr
       JOIN menu_items m ON m.id = mr.menu_item_id
       WHERE mr.id = ? AND m.restaurant_id = ?`,
      [req.params.id, req.restaurant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Recipe not found' });
    await pool.query('DELETE FROM menu_recipes WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete recipe' });
  }
});

module.exports = router;
