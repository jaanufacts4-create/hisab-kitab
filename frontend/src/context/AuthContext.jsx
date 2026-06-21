import { createContext, useContext, useState } from 'react';

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

  function login(token, userInfo) {
    localStorage.setItem('hisab_token', token);
    localStorage.setItem('hisab_user', JSON.stringify(userInfo));
    setUser(userInfo);
  }

  function logout() {
    localStorage.removeItem('hisab_token');
    localStorage.removeItem('hisab_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
