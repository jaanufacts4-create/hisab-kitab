const jwt = require('jsonwebtoken');
const pool = require('../db');
const { getEffectivePlan } = require('../utils/plan');

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
    req.is_admin = !!payload.is_admin;
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

// Super Admin only (Prem's own account — see ADMIN_PHONE in backend/.env).
function requireAdmin(req, res, next) {
  if (!req.is_admin) return res.status(403).json({ error: 'Admin access only' });
  next();
}

// Restrict a route to specific EFFECTIVE plan tiers, e.g.
// requirePlan('basic','pro'). Looked up live from the DB so a plan change
// (or a trial simply expiring) takes effect immediately, without needing
// the staff to log in again. Admin accounts always pass, regardless of plan.
function requirePlan(...allowedPlans) {
  return async (req, res, next) => {
    if (req.is_admin) return next();
    try {
      const [rows] = await pool.query('SELECT plan, plan_expiry FROM restaurants WHERE id = ?', [req.restaurant_id]);
      if (!rows.length) return res.status(404).json({ error: 'Restaurant not found' });
      const effective = getEffectivePlan(rows[0]);
      if (!allowedPlans.includes(effective)) {
        return res.status(403).json({
          error: effective === 'expired'
            ? 'Your trial has expired — please upgrade to continue'
            : 'This feature needs a higher plan',
          plan: effective,
          required: allowedPlans,
        });
      }
      req.plan = effective;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Could not verify plan' });
    }
  };
}

module.exports = { authMiddleware, requireRole, requireAdmin, requirePlan, JWT_SECRET };
