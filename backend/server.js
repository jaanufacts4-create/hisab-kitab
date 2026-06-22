require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/khata', require('./routes/khata'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/restaurant', require('./routes/restaurant'));
// Super Admin only — manage all restaurant tenants (see ADMIN_PHONE in .env)
app.use('/api/admin', require('./routes/admin'));
// Customer-facing QR self-order flow — deliberately separate from the routes
// above: no staff login involved, gated per-restaurant on plan='pro' inside
// the route handlers themselves (see public.js).
app.use('/api/public', require('./routes/public'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Hisab Kitab backend running on port ${PORT}`));
