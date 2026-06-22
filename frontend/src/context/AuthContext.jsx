import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

// Decode JWT payload without verification (for reading role client-side)
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

  // Plan (trial/basic/pro) drives feature gating across the app (Trends,
  // multi-staff, bill print, QR self-order). Fetched fresh from the server
  // rather than trusted from the JWT, since it can change anytime via the
  // demo plan-switcher without anyone logging in again.
  const [plan, setPlan] = useState(null);

  function refreshPlan() {
    if (!user) { setPlan(null); return; }
    api.get('/restaurant/me')
      .then(({ data }) => setPlan(data.plan))
      .catch(() => { /* leave plan as-is; gated routes still enforce server-side */ });
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
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, plan, refreshPlan }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
