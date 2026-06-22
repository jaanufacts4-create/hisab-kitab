import { createContext, useContext, useState } from 'react';

const DateContext = createContext(null);

// Local-date based (never toISOString() — that converts to UTC first and
// silently shifts the date in timezones ahead of UTC like IST).
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Shared "which day am I looking at" state, so navigating between pages
// that show date-scoped data (Dashboard, Expenses) keeps the same date
// instead of each page silently resetting to today on its own.
export function DateProvider({ children }) {
  const [viewDate, setViewDate] = useState(() => toDateStr(new Date()));
  return (
    <DateContext.Provider value={{ viewDate, setViewDate }}>
      {children}
    </DateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useViewDate() {
  return useContext(DateContext);
}
