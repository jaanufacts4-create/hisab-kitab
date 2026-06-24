// "plan" on the restaurants row is the raw tier the owner picked/was given
// ('trial' | 'basic' | 'pro'). What actually gates features is the EFFECTIVE
// plan, computed here:
//   - 'basic' / 'pro' rows just use that value as-is (paid, ongoing).
//   - 'trial' rows get full Pro-level access ONLY while plan_expiry hasn't
//     passed yet. Once it has, effective plan becomes 'expired' — locked
//     out of everything until an admin changes the plan.
//   - A 'trial' row with no plan_expiry set at all (e.g. an old/self
//     registered account from before this existed) is treated as an
//     unrestricted trial — 'pro' — until someone (the admin) actually sets
//     an expiry on it.
function getEffectivePlan(restaurant) {
  if (restaurant.plan === 'trial') {
    if (!restaurant.plan_expiry) return 'pro';
    return new Date() > new Date(restaurant.plan_expiry) ? 'expired' : 'pro';
  }
  return restaurant.plan;
}

// Days remaining on the current plan. Works for trial, basic, and pro.
// Returns null if no expiry is set (unlimited).
function daysLeft(restaurant) {
  if (!restaurant.plan_expiry) return null;
  const ms = new Date(restaurant.plan_expiry).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

module.exports = { getEffectivePlan, daysLeft };
