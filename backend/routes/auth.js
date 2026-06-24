const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { isAdminPhone } = require('../utils/admin');

const router = express.Router();

// Self-service registrations default to a short trial instead of an
// unlimited one — the open /register page shouldn't be a backdoor to
// permanent free Pro access. Real clients should be set up by the admin
// (with whatever trial length was actually agreed) via the Admin panel.
const DEFAULT_SELF_SIGNUP_TRIAL_DAYS = 7;

// ---- Owner signup: creates a new restaurant tenant ----
router.post('/register', async (req, res) => {
  try {
    const { restaurant_name, owner_name, phone, password } = req.body;
    if (!restaurant_name || !owner_name || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const [existing] = await pool.query('SELECT id FROM restaurants WHERE phone = ?', [phone]);
    if (existing.length) {
      return res.status(409).json({ error: 'This phone number is already registered' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const expiry = new Date(Date.now() + DEFAULT_SELF_SIGNUP_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [result] = await pool.query(
      'INSERT INTO restaurants (name, owner_name, phone, password_hash, plan, plan_expiry) VALUES (?, ?, ?, ?, ?, ?)',
      [restaurant_name, owner_name, phone, password_hash, 'trial', expiry]
    );
    const is_admin = isAdminPhone(phone);
    const token = jwt.sign(
      { restaurant_id: result.insertId, staff_id: null, role: 'owner', is_admin },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, restaurant: { id: result.insertId, name: restaurant_name }, is_admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create account, please try again' });
  }
});

// ---- Owner login ----
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM restaurants WHERE phone = ? AND is_active = TRUE', [phone]);
    if (!rows.length) return res.status(401).json({ error: 'Phone number or password is incorrect' });

    const restaurant = rows[0];
    const valid = await bcrypt.compare(password, restaurant.password_hash);
    if (!valid) return res.status(401).json({ error: 'Phone number or password is incorrect' });

    const is_admin = isAdminPhone(phone);
    const token = jwt.sign(
      { restaurant_id: restaurant.id, staff_id: null, role: 'owner', is_admin },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, restaurant: { id: restaurant.id, name: restaurant.name }, is_admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed, please try again' });
  }
});

// ---- List staff names for a restaurant phone (used on staff-login picker screen) ----
router.get('/staff-list', async (req, res) => {
  try {
    const { restaurant_phone } = req.query;
    const [restRows] = await pool.query('SELECT id, name FROM restaurants WHERE phone = ?', [restaurant_phone]);
    if (!restRows.length) return res.status(404).json({ error: 'No restaurant found for this number' });

    const [staffRows] = await pool.query(
      'SELECT id, name, role FROM staff WHERE restaurant_id = ? AND is_active = TRUE',
      [restRows[0].id]
    );
    res.json({ restaurant_name: restRows[0].name, staff: staffRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load staff list' });
  }
});

// ---- Staff PIN login ----
router.post('/staff-login', async (req, res) => {
  try {
    const { staff_id, pin } = req.body;
    const [rows] = await pool.query('SELECT * FROM staff WHERE id = ? AND is_active = TRUE', [staff_id]);
    if (!rows.length) return res.status(401).json({ error: 'Staff account not found' });

    const staff = rows[0];
    const valid = await bcrypt.compare(pin, staff.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect PIN' });

    const token = jwt.sign(
      { restaurant_id: staff.restaurant_id, staff_id: staff.id, role: staff.role },
      JWT_SECRET,
      { expiresIn: '12h' } // shorter session for shared-device staff logins
    );
    res.json({ token, staff: { id: staff.id, name: staff.name, role: staff.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed, please try again' });
  }
});

// ---- Public: return admin contact phone for "forgot password" ----
router.get('/admin-contact', async (req, res) => {
  const { ADMIN_PHONES } = require('../utils/admin');
  res.json({ phone: ADMIN_PHONES[0] || null });
});

module.exports = router;
