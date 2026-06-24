const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { getEffectivePlan, daysLeft } = require('../utils/plan');

const router = express.Router();
router.use(authMiddleware);
router.use(requireAdmin);

// ---- List every restaurant (tenant) on the platform ----
router.get('/restaurants', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, owner_name, phone, plan, plan_expiry, is_active, due_amount, created_at
     FROM restaurants ORDER BY created_at DESC`
  );
  const withStatus = rows.map((r) => ({
    ...r,
    effective_plan: getEffectivePlan(r),
    days_left: daysLeft(r),
  }));
  res.json(withStatus);
});

// ---- Create a new client account yourself (instead of public /register) ----
// trial_days: how long the client gets full Pro-level access for free
// before needing to be put on Basic/Pro. Omit (or 0) for no expiry — an
// unrestricted trial until you set one later.
router.post('/restaurants', async (req, res) => {
  try {
    const { restaurant_name, owner_name, phone, password, trial_days } = req.body;
    if (!restaurant_name || !owner_name || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const [existing] = await pool.query('SELECT id FROM restaurants WHERE phone = ?', [phone]);
    if (existing.length) return res.status(409).json({ error: 'This phone number is already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    // trial_days=0 means expire immediately (now), positive = future, omitted = no expiry
    const td = Number(trial_days);
    const plan_expiry = (trial_days !== undefined && trial_days !== null && trial_days !== '')
      ? new Date(Date.now() + td * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const [result] = await pool.query(
      'INSERT INTO restaurants (name, owner_name, phone, password_hash, plan, plan_expiry) VALUES (?, ?, ?, ?, ?, ?)',
      [restaurant_name, owner_name, phone, password_hash, 'trial', plan_expiry]
    );
    res.json({ id: result.insertId, name: restaurant_name, plan: 'trial', plan_expiry });
  } catch (err) {
    console.error('Admin create restaurant error:', err.message);
    res.status(500).json({ error: 'Could not create account' });
  }
});

// ---- Update a restaurant's name / plan / trial expiry / active status / amount due ----
router.put('/restaurants/:id', async (req, res) => {
  const { name, owner_name, plan, trial_days, is_active, due_amount } = req.body;
  const updates = [];
  const args = [];

  if (name !== undefined) {
    if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
    updates.push('name = ?'); args.push(name);
  }
  if (owner_name !== undefined) {
    if (!owner_name) return res.status(400).json({ error: 'Owner name cannot be empty' });
    updates.push('owner_name = ?'); args.push(owner_name);
  }
  if (plan) {
    if (!['trial', 'basic', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Plan must be trial, basic, or pro' });
    }
    updates.push('plan = ?'); args.push(plan);
  }
  if (trial_days !== undefined) {
    const td = Number(trial_days);
    const expiry = (trial_days !== null && trial_days !== '')
      ? new Date(Date.now() + td * 24 * 60 * 60 * 1000).toISOString()
      : null;
    updates.push('plan_expiry = ?'); args.push(expiry);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?'); args.push(is_active ? 1 : 0);
  }
  // The amount THIS client needs to pay to continue past trial — shown to
  // them as a UPI payment request once their trial expires.
  if (due_amount !== undefined) {
    updates.push('due_amount = ?'); args.push(due_amount === null || due_amount === '' ? null : Number(due_amount));
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  args.push(req.params.id);
  await pool.query(`UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`, args);
  res.json({ ok: true });
});

// ---- Reset a client's owner password ----
router.put('/restaurants/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password kam se kam 4 characters ka hona chahiye' });
  const password_hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE restaurants SET password_hash = ? WHERE id = ?', [password_hash, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
