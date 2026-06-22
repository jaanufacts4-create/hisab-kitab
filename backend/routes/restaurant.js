const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ---- Get this restaurant's plan + QR self-order info ----
// Self-ordering (customer scans QR, orders themselves) is a premium-tier
// feature gated on plan='pro' — trial/basic restaurants keep the existing
// staff-driven order flow only, untouched. This lets the same codebase
// demo both tiers, priced differently, without forking anything.
router.get('/me', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, plan, qr_token FROM restaurants WHERE id = ?',
    [req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });
  res.json({ id: rows[0].id, name: rows[0].name, plan: rows[0].plan, qr_token: rows[0].qr_token });
});

// ---- Get (or lazily create) this restaurant's QR token — owner + pro plan only ----
// The token is the public, unguessable identifier used in customer-facing
// QR URLs (/order/:qrToken/:tableNo) instead of the raw sequential
// restaurant id, so QR codes can't be enumerated/guessed.
router.get('/qr', requireRole('owner'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT plan, qr_token FROM restaurants WHERE id = ?',
    [req.restaurant_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });

  if (rows[0].plan !== 'pro') {
    return res.status(403).json({ error: 'Self-order QR is a Premium (Pro plan) feature', plan: rows[0].plan });
  }

  let token = rows[0].qr_token;
  if (!token) {
    token = crypto.randomBytes(8).toString('hex');
    await pool.query('UPDATE restaurants SET qr_token = ? WHERE id = ?', [token, req.restaurant_id]);
  }
  res.json({ qr_token: token });
});

// ---- Dev/demo helper: change this restaurant's plan ----
// There's no real billing flow yet — this lets you flip a restaurant
// between trial/basic/pro yourself when demoing the two tiers to clients.
router.put('/plan', requireRole('owner'), async (req, res) => {
  const { plan } = req.body;
  if (!['trial', 'basic', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Plan must be trial, basic, or pro' });
  }
  await pool.query('UPDATE restaurants SET plan = ? WHERE id = ?', [plan, req.restaurant_id]);
  res.json({ ok: true, plan });
});

module.exports = router;
