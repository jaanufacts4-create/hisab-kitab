// Phone number(s) (comma-separated) that get Super Admin access — set
// ADMIN_PHONE in backend/.env (and on Render) to your own restaurant
// account's phone number(s).
const ADMIN_PHONES = (process.env.ADMIN_PHONE || '').split(',').map((p) => p.trim()).filter(Boolean);

function isAdminPhone(phone) {
  return ADMIN_PHONES.includes(phone);
}

module.exports = { ADMIN_PHONES, isAdminPhone };
