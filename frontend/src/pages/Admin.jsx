import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function rupee(n) { return n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`; }

const PLAN_COLOR = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
  basic: 'bg-blue-50 text-blue-700 border-blue-200',
  pro: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
};

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [trialDays, setTrialDays] = useState(15);

  // Your own UPI ID — used to build the payment request clients see once
  // their trial expires (see /restaurant/payment-info on the backend).
  const [upiId, setUpiId] = useState('');
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  useEffect(() => {
    if (isAdmin === false) navigate('/');
  }, [isAdmin]);

  function load() {
    api.get('/admin/restaurants').then(({ data }) => setList(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    api.get('/restaurant/me').then(({ data }) => { if (data.upi_id) setUpiId(data.upi_id); }).catch(() => {});
  }, []);

  async function saveUpi() {
    if (!upiId) return;
    setUpiSaving(true); setUpiSaved(false);
    try {
      await api.put('/restaurant/upi', { upi_id: upiId });
      setUpiSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'UPI ID save nahi hua');
    } finally { setUpiSaving(false); }
  }

  async function createRestaurant() {
    if (!restaurantName || !ownerName || !phone || !password) {
      setError('Sab fields zaroori hain'); return;
    }
    setError(''); setSubmitting(true);
    try {
      await api.post('/admin/restaurants', {
        restaurant_name: restaurantName, owner_name: ownerName, phone, password, trial_days: trialDays,
      });
      setRestaurantName(''); setOwnerName(''); setPhone(''); setPassword(''); setTrialDays(15);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Account nahi bana');
    } finally { setSubmitting(false); }
  }

  async function updatePlan(id, plan) {
    await api.put(`/admin/restaurants/${id}`, { plan });
    load();
  }

  async function extendTrial(id) {
    const days = window.prompt('Kitne din ka trial set karein?', '15');
    if (!days) return;
    await api.put(`/admin/restaurants/${id}`, { trial_days: Number(days) });
    load();
  }

  async function setAmount(id, current) {
    const amount = window.prompt('Upgrade ke liye kitna amount (₹) due hai?', current || '');
    if (amount === null) return;
    await api.put(`/admin/restaurants/${id}`, { due_amount: amount === '' ? null : amount });
    load();
  }

  async function toggleActive(id, current) {
    await api.put(`/admin/restaurants/${id}`, { is_active: !current });
    load();
  }

  if (isAdmin === false) return null;

  return (
    <div className="min-h-screen ledger-bg pb-10">
      <Header title="Admin Panel" />
      <div className="px-4 mt-4 space-y-4">

        {/* Your UPI ID — clients see a payment request to this once their
            trial expires, for whatever amount you set per client below. */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-ledger-ink mb-1">💳 Aapka UPI ID</p>
          <p className="text-xs text-ledger-inkSoft mb-2.5">
            Yeh wahi UPI ID hai jahan clients ka payment jayega jab unka trial khatam ho jaye. Kabhi bhi badal sakte ho.
          </p>
          <div className="flex gap-2">
            <input value={upiId} onChange={(e) => { setUpiId(e.target.value); setUpiSaved(false); }}
              placeholder="yourname@upi"
              className="flex-1 px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <button onClick={saveUpi} disabled={upiSaving}
              className="px-4 py-2 rounded-lg bg-ledger-red text-white text-sm font-semibold disabled:opacity-60">
              {upiSaving ? '...' : 'Save'}
            </button>
          </div>
          {upiSaved && <p className="text-green-600 text-xs mt-1.5">✓ Save ho gaya</p>}
        </div>

        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="block w-full text-center bg-ledger-red text-white font-medium py-3 rounded-xl">
            + Naya Client Account Banayein
          </button>
        ) : (
          <div className="card p-4 space-y-2.5">
            <input placeholder="Restaurant ka naam" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input placeholder="Owner ka naam" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-ledger-inkSoft shrink-0">Trial (din):</span>
              <input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)}
                className="w-20 px-2 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
              <span className="text-[11px] text-ledger-inkSoft">(0 = unlimited)</span>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="py-2 rounded-lg border border-ledger-ink/20 text-sm">Cancel</button>
              <button onClick={createRestaurant} disabled={submitting}
                className="py-2 rounded-lg bg-ledger-red text-white text-sm font-medium disabled:opacity-60">
                {submitting ? '...' : 'Banayein'}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-ledger-inkSoft mt-8">Loading...</p>}

        <div className="space-y-2.5">
          {list.map((r) => (
            <div key={r.id} className="card p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-semibold text-sm text-ledger-ink">{r.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PLAN_COLOR[r.effective_plan] || ''}`}>
                  {r.effective_plan?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-ledger-inkSoft mb-1">{r.owner_name} · {r.phone}</p>
              <p className="text-[11px] text-ledger-inkSoft mb-2.5">
                Plan: {r.plan} {r.plan === 'trial' && r.plan_expiry && (
                  r.days_left > 0 ? `(${r.days_left} din baki)` : '(expired)'
                )}
                {' · '}Amount due: {rupee(r.due_amount)}
                {!r.is_active && <span className="text-red-500 font-semibold"> · DISABLED</span>}
              </p>

              <div className="flex gap-1.5 flex-wrap">
                {['trial', 'basic', 'pro'].map((p) => (
                  <button key={p} onClick={() => updatePlan(r.id, p)}
                    disabled={r.plan === p}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${
                      r.plan === p ? 'bg-ledger-red text-white border-ledger-red' : 'border-ledger-red/30 text-ledger-red'
                    } disabled:opacity-50`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => extendTrial(r.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-ledger-inkSoft/30 text-ledger-inkSoft">
                  Set Trial Days
                </button>
                <button onClick={() => setAmount(r.id, r.due_amount)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-ledger-inkSoft/30 text-ledger-inkSoft">
                  Set Amount
                </button>
                <button onClick={() => toggleActive(r.id, r.is_active)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${
                    r.is_active ? 'border-red-300 text-red-500' : 'border-green-300 text-green-600'
                  }`}>
                  {r.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
              <p className="text-[10px] text-ledger-inkSoft mt-2">Created: {fmtDate(r.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
