// Orders/expenses run on IST (India) calendar days, but `created_at` is
// stored as a UTC wall-clock string via SQLite's datetime('now'). Without
// correcting for the +5:30 offset, anything that happens between
// 12:00am-5:30am IST gets bucketed into the *previous* day's totals — the
// "sales showing under yesterday" bug.
//
// Fix has two parts:
//  1. todayIST() / addDaysToDateStr() — compute "today" and date-range
//     defaults in IST regardless of what timezone the server process is in.
//  2. IST_SHIFT — append to any SQL DATE(...)/strftime(...) call on a
//     created_at-style column so the date math happens in IST, not UTC.
//     e.g. DATE(created_at, '+330 minutes')

const IST_OFFSET_MINUTES = 330; // 5 hours 30 minutes
const IST_SHIFT = '+330 minutes';

function todayIST() {
  const istMs = Date.now() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

// Pure calendar-day arithmetic on a "YYYY-MM-DD" string — anchored at UTC
// midnight of that date so it's unaffected by server timezone.
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { todayIST, addDaysToDateStr, IST_SHIFT };
