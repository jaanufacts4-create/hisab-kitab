// The backend stores timestamps as UTC wall-clock strings without a
// timezone suffix (SQLite's datetime('now') format: "YYYY-MM-DD HH:MM:SS").
// Plain `new Date(str)` on a string like that is parsed as LOCAL time by
// the JS engine (no 'Z', space instead of 'T'), which silently shifts the
// displayed time/date by the browser's UTC offset. Force UTC parsing so
// receipts and order lists always show the correct real-world time.
export function parseServerDate(s) {
  if (!s) return new Date(NaN);
  // Already has an explicit timezone? leave it alone.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}
