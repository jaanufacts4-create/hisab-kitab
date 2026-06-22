const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login required' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.restaurant_id = payload.restaurant_id;
    req.staff_id = payload.staff_id || null;
    req.role = payload.role; // 'owner' | 'cashier' | 'waiter'
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// Restrict a route to specific roles, e.g. requireRole('owner')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({ error: 'Not allowed for your role' });
    }
    next();
  };
}

// Restrict a route to specific plan tiers, e.g. requirePlan('basic','pro').
// Looked up live from the DB (not the JWT) so a plan change via the demo
// switcher (PUT /api/restaurant/plan) takes effect immediately, without
// needing the staff to log in again.
function requirePlan(...allowedPlans) {
  return async (req, res, next) => {
    try {
      const [rows] = await pool.query('SELECT plan FROM restaurants WHERE id = ?', [req.restaurant_id]);
      if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });
      if (!allowedPlans.includes(rows[0].plan)) {
        return res.status(403).json({
          error: 'This feature needs a higher plan',
          plan: rows[0].plan,
          required: allowedPlans,
        });
      }
      req.plan = rows[0].plan;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Could not verify plan' });
    }
  };
}

module.exports = { authMiddleware, requireRole, requirePlan, JWT_SECRET };
