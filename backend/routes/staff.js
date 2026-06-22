const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// List staff for the logged-in restaurant
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, phone, role, is_active, created_at FROM staff WHERE restaurant_id = ? ORDER BY created_at DESC',
    [req.restaurant_id]
  );
  res.json(rows);
});

// Add a staff member (owner only)
// Adding cashier/waiter accounts (multi-staff) is a Basic+ feature — Trial
// is meant for a single owner getting the hang of digitizing their
// register, not yet running a full staff/PIN-login setup.
router.post('/', requireRole('owner'), async (req, res) => {
  try {
    const { name, phone, pin, role } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN are required' });
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN should be 4-6 digits' });

    if (role && role !== 'owner') {
      const [rRows] = await pool.query('SELECT plan FROM restaurants WHERE id = ?', [req.restaurant_id]);
      if (!['basic', 'pro'].includes(rRows[0]?.plan)) {
        return res.status(403).json({
          error: 'Adding staff (cashier/waiter) needs the Basic or Pro plan',
          plan: rRows[0]?.plan,
        });
      }
    }

    const pin_hash = await bcrypt.hash(pin, 10);
    const [result] = await pool.query(
      'INSERT INTO staff (restaurant_id, name, phone, pin_hash, role) VALUES (?, ?, ?, ?, ?)',
      [req.restaurant_id, name, phone || null, pin_hash, role || 'waiter']
    );
    res.json({ id: result.insertId, name, role: role || 'waiter' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add staff member' });
  }
});

// Deactivate a staff member (owner only)
router.put('/:id/deactivate', requireRole('owner'), async (req, res) => {
  await pool.query(
    'UPDATE staff SET is_active = FALSE WHERE id = ? AND restaurant_id = ?',
    [req.params.id, req.restaurant_id]
  );
  res.json({ ok: true });
});

module.exports = router;
