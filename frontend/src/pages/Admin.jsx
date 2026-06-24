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
  pro:   'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-red-50 text-red-600 border-red-200',
};

const PLAN_DURATION = { trial: 15, basic: 30, pro: 365 };

export default function Admin() {
  const { isAdmin, refreshPlan } = useAuth();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New restaurant form
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [trialDays, setTrialDays] = useState(15);

  // UPI ID
  const [upiId, setUpiId] = useState('');
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  // Per-restaurant "Confirm Payment" panel — keyed by restaurant id
  const [confirmPanel, setConfirmPanel] = useState(null); // { id, plan, days, amount }

  useEffect(() => { if (isAdmin === false) navigate('/'); }, [isAdmin]);

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

  async function editName(id, current) {
    const name = window.prompt('Restaurant ka naya naam:', current || '');
    if (!name || name === current) return;
    await api.put(`/admin/restaurants/${id}`, { name });
    load();
    refreshPlan();
  }

  async function toggleActive(id, current) {
    await api.put(`/admin/restaurants/${id}`, { is_active: !current });
    load();
  }

  function openConfirmPanel(r) {
    const plan = r.effective_plan === 'expired' || !r.effective_plan ? 'basic' : r.plan;
    setConfirmPanel({
      id: r.id,
      plan,
      days: PLAN_DURATION[plan] ?? 30,
      amount: r.due_amount ?? '',
    });
  }

  async function resetPassword(id) {
    const pwd = window.prompt('Naya password set karein (kam se kam 4 characters):');
    if (!pwd) return;
    if (pwd.length < 4) { alert('Password kam se kam 4 characters ka hona chahiye'); return; }
    await api.put(`/admin/restaurants/${id}/password`, { password: pwd });
    alert('✓ Password reset ho gaya');
  }

  async function saveConfirmPayment() {
    if (!confirmPanel) return;
    const { id, plan, days, amount } = confirmPanel;
    await api.put(`/admin/restaurants/${id}`, {
      plan,
      trial_days: Number(days),   // reuses trial_days field to set plan_expiry
      is_active: 1,
      due_amount: amount === '' ? null : Number(amount),
    });
    setConfirmPanel(null);
    load();
  }

  if (isAdmin === false) return null;

  return (
    <div className="min-h-screen ledger-bg pb-10">
      <Header title="Admin Panel" />
      <div className="px-4 mt-4 space-y-4">

        {/* UPI ID */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-ledger-ink mb-1">💳 Aapka UPI ID</p>
          <p className="text-xs text-ledger-inkSoft mb-2.5">
            Clients ko yahi UPI dikhayi dega jab unka trial khatam ho. Amount alag-alag client ke liye "Confirm Payment" mein set karo.
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

        {/* New client form */}
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
              <span className="text-[11px] text-ledger-inkSoft">(0 = abhi se expired)</span>
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

        {/* Restaurant list */}
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="card p-3.5">
              {/* Header row */}
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => editName(r.id, r.name)} className="font-semibold text-sm text-ledger-ink text-left">
                  {r.name} <span className="text-ledger-inkSoft text-xs">✎</span>
                </button>
                <div className="flex items-center gap-2">
                  {!r.is_active && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">DISABLED</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PLAN_COLOR[r.effective_plan] || ''}`}>
                    {r.effective_plan?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Info row */}
              <p className="text-xs text-ledger-inkSoft mb-0.5">{r.owner_name} · {r.phone}</p>
              <p className="text-[11px] text-ledger-inkSoft mb-3">
                Expiry: {fmtDate(r.plan_expiry)}
                {r.days_left > 0 && ` (${r.days_left} din baki)`}
                {r.due_amount ? ` · Due: ${rupee(r.due_amount)}` : ''}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => openConfirmPanel(r)}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-green-600 text-white">
                  ✓ Payment Confirm
                </button>
                <button
                  onClick={() => toggleActive(r.id, r.is_active)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border ${
                    r.is_active
                      ? 'border-red-300 text-red-500'
                      : 'border-green-400 text-green-600'
                  }`}>
                  {r.is_active ? '⏸ Disable' : '▶ Enable'}
                </button>
                <button
                  onClick={() => resetPassword(r.id)}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-300 text-gray-500">
                  🔑 Password
                </button>
              </div>

              {/* Confirm Payment inline panel */}
              {confirmPanel?.id === r.id && (
                <div className="mt-3 border-t pt-3 space-y-2.5">
                  <p className="text-xs font-semibold text-ledger-ink">Payment Confirm Karo</p>

                  {/* Plan selector */}
                  <div>
                    <p className="text-[11px] text-ledger-inkSoft mb-1">Plan</p>
                    <div className="flex gap-2">
                      {['trial', 'basic', 'pro'].map((p) => (
                        <button key={p} onClick={() => setConfirmPanel((prev) => ({ ...prev, plan: p, days: PLAN_DURATION[p] }))}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border ${
                            confirmPanel.plan === p
                              ? 'bg-ledger-red text-white border-ledger-red'
                              : 'border-ledger-red/30 text-ledger-red'
                          }`}>
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ledger-inkSoft shrink-0">Duration (din):</span>
                    <input type="number" min="1" value={confirmPanel.days}
                      onChange={(e) => setConfirmPanel((prev) => ({ ...prev, days: e.target.value }))}
                      className="w-20 px-2 py-1.5 rounded-lg border border-ledger-red/20 text-sm figure" />
                  </div>

                  {/* Amount due (optional) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ledger-inkSoft shrink-0">Amount due (₹):</span>
                    <input type="number" min="0" value={confirmPanel.amount}
                      placeholder="0 = clear"
                      onChange={(e) => setConfirmPanel((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-24 px-2 py-1.5 rounded-lg border border-ledger-red/20 text-sm figure" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setConfirmPanel(null)}
                      className="py-2 rounded-lg border border-ledger-ink/20 text-xs text-ledger-inkSoft">
                      Cancel
                    </button>
                    <button onClick={saveConfirmPayment}
                      className="py-2 rounded-lg bg-green-600 text-white text-xs font-bold">
                      ✓ Enable + Save
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-ledger-inkSoft mt-2">Created: {fmtDate(r.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
