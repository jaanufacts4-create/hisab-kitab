import { NavLink } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { t } = useLang();
  const { user, plan } = useAuth();
  const role = user?.role;

  // Dashboard (Sales) is owner-only. Cashier/waiter never see it.
  // Trends is also Basic+ plan (Trial doesn't include it).
  const ALL_TABS = [
    { to: '/',          label: t('nav_today'),    icon: '◆',  roles: ['owner'] },
    { to: '/orders',    label: t('nav_orders'),   icon: '🧾', roles: ['owner', 'cashier', 'waiter', 'kitchen'] },
    { to: '/khata',     label: t('nav_khata'),    icon: '📖', roles: ['owner', 'cashier'] },
    { to: '/expenses',  label: t('nav_expenses'), icon: '✎',  roles: ['owner', 'cashier'] },
    { to: '/analytics', label: 'Trends',           icon: '📊', roles: ['owner'], minPlan: ['basic', 'pro'] },
    { to: '/menu',      label: t('nav_menu'),     icon: '☷',  roles: ['owner'] },
  ];

  const tabs = ALL_TABS.filter((tab) =>
    tab.roles.includes(role) && (!tab.minPlan || tab.minPlan.includes(plan))
  );

  return (
    <nav className="print-hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-ledger-paper border-t-2 border-ledger-red/20 flex justify-around items-stretch z-20">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              isActive ? 'text-ledger-red' : 'text-ledger-inkSoft'
            }`
          }
        >
          <span className="text-base leading-none">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
