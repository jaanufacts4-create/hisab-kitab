import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

// Decode JWT payload without verification (for reading role/is_admin client-side)
function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return {}; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('hisab_user');
    const token = localStorage.getItem('hisab_token');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    // Backfill role from JWT if missing (handles old sessions)
    if (!stored.role && token) {
      const payload = decodeJwt(token);
      if (payload.role) {
        stored.role = payload.role;
        localStorage.setItem('hisab_user', JSON.stringify(stored));
      }
    }
    return stored;
  });

  // `plan` is the EFFECTIVE plan (accounts for trial expiry) — what all
  // feature gating in the UI should check. `rawPlan`/`daysLeft`/`isAdmin`
  // are for display only (e.g. "Trial: 5 days left", showing the Admin
  // Panel link). All fetched fresh from the server, not trusted from the
  // JWT, since plan can change anytime via the admin panel.
  const [plan, setPlan] = useState(null);
  const [rawPlan, setRawPlan] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  function refreshPlan() {
    if (!user) { setPlan(null); setRawPlan(null); setDaysLeft(null); setIsAdmin(false); return; }
    api.get('/restaurant/me')
      .then(({ data }) => {
        setPlan(data.plan);
        setRawPlan(data.raw_plan);
        setDaysLeft(data.days_left);
        setIsAdmin(!!data.is_admin);
      })
      .catch(() => { /* leave as-is; gated routes still enforce server-side */ });
  }

  useEffect(refreshPlan, [user]);

  function login(token, userInfo) {
    localStorage.setItem('hisab_token', token);
    localStorage.setItem('hisab_user', JSON.stringify(userInfo));
    setUser(userInfo);
  }

  function logout() {
    localStorage.removeItem('hisab_token');
    localStorage.removeItem('hisab_user');
    setUser(null);
    setPlan(null);
    setRawPlan(null);
    setDaysLeft(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider value={{
      user, login, logout, isLoggedIn: !!user,
      plan, rawPlan, daysLeft, isAdmin, refreshPlan,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
