import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const { lang, toggle } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  // Owner's home is the Dashboard; staff (cashier/waiter) land on Orders.
  const homePath = user?.role === 'owner' ? '/' : '/orders';
  const isHome = location.pathname === homePath;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  // Logout needs to be reachable from every page for every role — staff
  // (waiter/cashier) had no way to log out before, which meant the owner
  // couldn't log in on the same shared device without clearing the app.
  function handleLogout() {
    const msg = lang === 'hi' ? 'Logout karna hai?' : 'Log out?';
    if (window.confirm(msg)) {
      logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <header style={{background:'linear-gradient(135deg,#B91C1C 0%,#7F1D1D 100%)'}}
      className="print-hidden text-white px-4 pt-4 pb-5 shadow-lg">

      {!isHome && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate(-1)} aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/15 active:bg-white/30 text-white text-lg">
            &#8592;
          </button>
          <button onClick={() => navigate(homePath)} aria-label="Home"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/15 active:bg-white/30 text-white text-lg">
            &#8962;
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-red-200 font-medium">
            {user?.restaurantName || 'Hisab Kitab'}
            {user?.staffName ? ` · ${user.staffName}` : ''}
          </p>
          <h1 className="font-display text-2xl font-bold leading-tight mt-0.5">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full transition-colors"
          >
            {lang === 'hi' ? 'EN' : 'हि'}
          </button>
          <button
            onClick={handleLogout}
            aria-label="Logout"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-[11px] text-red-200 font-medium text-right mt-1">{today}</p>
    </header>
  );
}
