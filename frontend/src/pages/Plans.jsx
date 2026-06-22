import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const TIERS = [
  {
    key: 'trial',
    name: 'Trial',
    tagline: 'Time-limited — poora Pro version try karein',
    features: [
      'Pure Pro features, ek limited samay ke liye',
      'Trial khatam hone ke baad upgrade karna padega',
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    tagline: 'Poori team ke saath chalayein',
    features: [
      'Orders, Dashboard, Khata, Kharcha, Menu',
      'Cashier aur Waiter staff add karein (PIN login)',
      'Trends & Analytics — sales/order patterns',
      'Bill print / receipt printing',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Premium customer experience',
    features: [
      'Basic mein jo kuch hai, woh sab',
      'Customer Self-Order — QR scan karke khud order',
      'Live order status customer ke phone par',
    ],
  },
];

export default function Plans() {
  const { plan, rawPlan, daysLeft, isAdmin, refreshPlan } = useAuth();
  const { lang } = useLang();
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState('');

  async function switchTo(newPlan) {
    setSwitching(newPlan); setError('');
    try {
      await api.put('/restaurant/plan', { plan: newPlan });
      refreshPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Plan badal nahi paya');
    } finally { setSwitching(null); }
  }

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title="Plans" />
      <div className="px-4 mt-4 space-y-4">

        {plan === 'expired' && (
          <div className="card p-4 border-2 border-red-300 bg-red-50">
            <p className="text-sm font-bold text-red-600">Trial Khatam Ho Gaya</p>
            <p className="text-xs text-red-500 mt-1">Continue karne ke liye plan upgrade karein — humse contact karein.</p>
          </div>
        )}
        {rawPlan === 'trial' && plan !== 'expired' && daysLeft != null && (
          <p className="text-center text-sm font-semibold text-ledger-red">
            Trial: {daysLeft} din baki hain (Pro features active)
          </p>
        )}

        {isAdmin && (
          <Link to="/admin" className="block text-center text-xs text-ledger-red underline">
            → Admin Panel (Manage all clients)
          </Link>
        )}

        {error && <p className="text-center text-red-600 text-sm">{error}</p>}

        {TIERS.map((tier) => {
          const isCurrent = rawPlan === tier.key;
          return (
            <div key={tier.key}
              className={`card p-4 ${isCurrent ? 'border-2 border-ledger-red' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-display text-xl font-bold text-ledger-ink">{tier.name}</p>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ledger-red text-white">
                    Current Plan
                  </span>
                )}
              </div>
              <p className="text-xs text-ledger-inkSoft mb-3">{tier.tagline}</p>
              <ul className="space-y-1.5 mb-4">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-ledger-ink flex items-start gap-1.5">
                    <span className="text-ledger-sage mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {/* Self-serve plan switching is admin-only now — real clients
                  get provisioned/upgraded by the admin, not themselves. */}
              {isAdmin && !isCurrent && (
                <button onClick={() => switchTo(tier.key)} disabled={switching === tier.key}
                  className="w-full py-2.5 rounded-lg bg-ledger-red text-white text-sm font-semibold disabled:opacity-60">
                  {switching === tier.key ? '...' : `Try ${tier.name} (Demo)`}
                </button>
              )}
            </div>
          );
        })}

        {!isAdmin && (
          <p className="text-center text-xs text-ledger-inkSoft">
            Plan upgrade karne ke liye humse contact karein.
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
