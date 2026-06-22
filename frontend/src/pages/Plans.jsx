import { useState } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const TIERS = [
  {
    key: 'trial',
    name: 'Trial',
    tagline: 'Apna register digital karna shuru karein',
    features: [
      'Orders banayein aur manage karein',
      'Aaj ka Hisab (Dashboard)',
      'Khata (customer credit)',
      'Kharcha (expenses) tracking',
      'Menu management',
      'Sirf Owner login',
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    tagline: 'Poori team ke saath chalayein',
    features: [
      'Trial mein jo kuch hai, woh sab',
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
  const { user, plan, refreshPlan } = useAuth();
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
      <Header title={lang === 'hi' ? 'Plans' : 'Plans'} />
      <div className="px-4 mt-4 space-y-4">
        <p className="text-xs text-ledger-inkSoft text-center">
          {lang === 'hi'
            ? 'Abhi ke liye yahan se plan switch kar sakte ho demo dene ke liye — real billing baad mein jud jayegi.'
            : 'You can switch plans here for now to demo each tier — real billing will be wired up later.'}
        </p>
        {error && <p className="text-center text-red-600 text-sm">{error}</p>}

        {TIERS.map((tier) => {
          const isCurrent = plan === tier.key;
          return (
            <div key={tier.key}
              className={`card p-4 ${isCurrent ? 'border-2 border-ledger-red' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-display text-xl font-bold text-ledger-ink">{tier.name}</p>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ledger-red text-white">
                    {lang === 'hi' ? 'Current Plan' : 'Current Plan'}
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
              {user?.role === 'owner' && !isCurrent && (
                <button onClick={() => switchTo(tier.key)} disabled={switching === tier.key}
                  className="w-full py-2.5 rounded-lg bg-ledger-red text-white text-sm font-semibold disabled:opacity-60">
                  {switching === tier.key ? '...' : (lang === 'hi' ? `${tier.name} Try Karein (Demo)` : `Try ${tier.name} (Demo)`)}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
