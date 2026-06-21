const jwt = require('jsonwebtoken');

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

module.exports = { authMiddleware, requireRole, JWT_SECRET };
