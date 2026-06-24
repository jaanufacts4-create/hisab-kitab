const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authMiddleware, requireRole, requireAdmin } = require('../middleware/auth');
const { getEffectivePlan, daysLeft } = require('../utils/plan');
const { ADMIN_PHONES } = require('../utils/admin');

const router = express.Router();
router.use(authMiddleware);

// ---- Get this restaurant's plan + QR self-order info ----
router.get('/me', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, plan, plan_expiry, qr_token, upi_id FROM restaurants WHERE id = ?',
    [req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });
  const r = rows[0];
  res.json({
    id: r.id,
    name: r.name,
    plan: getEffectivePlan(r),      // what feature gating should use
    raw_plan: r.plan,                // the tier actually stored (trial/basic/pro)
    plan_expiry: r.plan_expiry,
    days_left: daysLeft(r),
    qr_token: r.qr_token,
    upi_id: r.upi_id || null,
    is_admin: req.is_admin,
  });
});

// ---- Get (or lazily create) this restaurant's QR token — owner + pro-tier only ----
// The token is the public, unguessable identifier used in customer-facing
// QR URLs (/order/:qrToken/:tableNo) instead of the raw sequential
// restaurant id, so QR codes can't be enumerated/guessed.
router.get('/qr', requireRole('owner'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT plan, plan_expiry, qr_token FROM restaurants WHERE id = ?',
    [req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });

  const effective = getEffectivePlan(rows[0]);
  if (!req.is_admin && effective !== 'pro') {
    return res.status(403).json({ error: 'Self-order QR needs the Pro plan (or an active trial)', plan: effective });
  }

  let token = rows[0].qr_token;
  if (!token) {
    token = crypto.randomBytes(8).toString('hex');
    await pool.query('UPDATE restaurants SET qr_token = ? WHERE id = ?', [token, req.restaurant_id]);
  }
  res.json({ qr_token: token });
});

// ---- Admin-only: set/update your own UPI ID for receiving upgrade payments ----
router.put('/upi', requireRole('owner'), requireAdmin, async (req, res) => {
  const { upi_id } = req.body;
  if (!upi_id) return res.status(400).json({ error: 'UPI ID is required' });
  await pool.query('UPDATE restaurants SET upi_id = ? WHERE id = ?', [upi_id, req.restaurant_id]);
  res.json({ ok: true, upi_id });
});

// ---- Any logged-in restaurant: get payment info for upgrading ----
// Looks up the ADMIN's UPI ID (not the caller's own row — only the admin
// ever sets upi_id) plus the amount the admin set for THIS specific client.
router.get('/payment-info', async (req, res) => {
  if (!ADMIN_PHONES.length) return res.json({ upi_id: null, amount: null });

  const placeholders = ADMIN_PHONES.map(() => '?').join(',');
  const [adminRows] = await pool.query(
    `SELECT upi_id, owner_name FROM restaurants WHERE phone IN (${placeholders}) AND upi_id IS NOT NULL LIMIT 1`,
    ADMIN_PHONES
  );
  const [selfRows] = await pool.query('SELECT due_amount, name FROM restaurants WHERE id = ?', [req.restaurant_id]);

  res.json({
    upi_id: adminRows[0]?.upi_id || null,
    payee_name: adminRows[0]?.owner_name || 'Hisab Kitab',
    amount: selfRows[0]?.due_amount || null,
    restaurant_name: selfRows[0]?.name || '',
    contact_phone: ADMIN_PHONES[0] || null,
  });
});

// ---- Admin-only: flip your OWN (admin) account's plan for live demos ----
// Real client accounts are provisioned via /api/admin instead — this is
// just so the admin can quickly show a prospect what each tier looks like
// on their own test restaurant.
router.put('/plan', requireRole('owner'), requireAdmin, async (req, res) => {
  const { plan } = req.body;
  if (!['trial', 'basic', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Plan must be trial, basic, or pro' });
  }
  // Demo switches clear any expiry so the chosen tier is immediately and
  // fully in effect (a 'trial' picked here behaves as an unrestricted trial).
  await pool.query('UPDATE restaurants SET plan = ?, plan_expiry = NULL WHERE id = ?', [plan, req.restaurant_id]);
  res.json({ ok: true, plan });
});

module.exports = router;
