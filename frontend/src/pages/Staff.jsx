import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Staff() {
  const { user, plan } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('waiter');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only owner can access this page
  useEffect(() => {
    if (user?.role !== 'owner') navigate('/');
  }, [user]);

  function load() {
    api.get('/staff').then(({ data }) => setList(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Multi-staff (cashier/waiter) is Basic+ — Trial is single-owner only.
  const canAddStaff = ['basic', 'pro'].includes(plan);

  async function addStaff() {
    if (!name || !pin) { setError(lang === 'hi' ? 'Naam aur PIN zaroori hai' : 'Name and PIN are required'); return; }
    if (!/^\d{4,6}$/.test(pin)) { setError(lang === 'hi' ? 'PIN 4-6 digit ka hona chahiye' : 'PIN must be 4-6 digits'); return; }
    setError(''); setSubmitting(true);
    try {
      await api.post('/staff', { name, phone: phone || undefined, pin, role });
      setName(''); setPhone(''); setPin(''); setRole('waiter'); setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'hi' ? 'Save nahi hua' : 'Could not save'));
    } finally { setSubmitting(false); }
  }

  async function deactivate(id) {
    if (!confirm(lang === 'hi' ? 'Is staff member ko hata dein?' : 'Remove this staff member?')) return;
    await api.put(`/staff/${id}/deactivate`);
    load();
  }

  async function toggleQr(id) {
    await api.put(`/staff/${id}/toggle-qr`);
    load();
  }

  const ROLE_LABELS = {
    waiter:  lang === 'hi' ? 'Waiter' : 'Waiter',
    cashier: lang === 'hi' ? 'Cashier' : 'Cashier',
    kitchen: lang === 'hi' ? 'Kitchen' : 'Kitchen',
    owner:   lang === 'hi' ? 'Malik' : 'Owner',
  };

  const title = lang === 'hi' ? 'Staff Manage Karein' : 'Manage Staff';
  const addBtn = lang === 'hi' ? '+ Naya Staff Add Karein' : '+ Add New Staff';
  const namePh = lang === 'hi' ? 'Naam' : 'Name';
  const phonePh = lang === 'hi' ? 'Phone (optional)' : 'Phone (optional)';
  const pinPh = lang === 'hi' ? 'PIN (4-6 digit)' : 'PIN (4-6 digits)';
  const saveBtn = lang === 'hi' ? 'Save Karein' : 'Save';
  const cancelBtn = lang === 'hi' ? 'Cancel' : 'Cancel';
  const removeBtn = lang === 'hi' ? 'Hatayein' : 'Remove';
  const loadingTxt = lang === 'hi' ? 'Load ho raha hai...' : 'Loading...';
  const emptyTxt = lang === 'hi' ? 'Abhi koi staff member nahi hai' : 'No staff members yet';
  const roleLabel = lang === 'hi' ? 'Role:' : 'Role:';

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={title} />
      <div className="px-4 mt-4">

        {!canAddStaff ? (
          <div className="card p-4 mb-4">
            <p className="text-sm font-semibold text-ledger-ink mb-1">
              ⭐ {lang === 'hi' ? 'Basic+ Plan Feature' : 'Basic+ Plan Feature'}
            </p>
            <p className="text-xs text-ledger-inkSoft mb-3">
              {lang === 'hi'
                ? 'Trial plan mein sirf owner login chalta hai. Cashier/Waiter add karne ke liye Basic ya Pro plan chahiye.'
                : 'Trial only supports the owner login. Adding cashier/waiter staff needs the Basic or Pro plan.'}
            </p>
            <Link to="/plans" className="block w-full text-center bg-ledger-red text-white font-medium py-2.5 rounded-xl text-sm">
              {lang === 'hi' ? 'Plans Dekhein' : 'View Plans'}
            </Link>
          </div>
        ) : !showForm ? (
          <button onClick={() => setShowForm(true)}
            className="block w-full text-center bg-ledger-red text-white font-medium py-3 rounded-xl mb-4">
            {addBtn}
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5 mb-4 space-y-2.5">
            <input placeholder={namePh} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input type="tel" placeholder={phonePh} value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input type="password" inputMode="numeric" placeholder={pinPh} value={pin} onChange={(e) => setPin(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm tracking-widest" />

            {/* Role selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ledger-inkSoft">{roleLabel}</span>
              <div className="flex gap-1 bg-ledger-paperDark rounded-lg p-1 flex-1">
                {['waiter', 'cashier', 'kitchen'].map((r) => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors capitalize ${
                      role === r ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'
                    }`}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-ledger-rust text-xs">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="py-2 rounded-lg border border-ledger-ink/20 text-sm">{cancelBtn}</button>
              <button onClick={addStaff} disabled={submitting}
                className="py-2 rounded-lg bg-ledger-red text-white text-sm font-medium disabled:opacity-60">
                {submitting ? '...' : saveBtn}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-ledger-inkSoft mt-8">{loadingTxt}</p>}
        {!loading && list.length === 0 && (
          <p className="text-center text-ledger-inkSoft mt-8 text-sm">{emptyTxt}</p>
        )}

        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-ledger-red/15 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-ledger-red/10 text-ledger-red capitalize">
                      {ROLE_LABELS[s.role] || s.role}
                    </span>
                    {s.phone && <span className="text-xs text-ledger-inkSoft">{s.phone}</span>}
                  </div>
                </div>
                {s.role !== 'owner' && (
                  <button onClick={() => deactivate(s.id)}
                    className="text-ledger-rust text-xs font-medium border border-ledger-rust/30 px-2.5 py-1 rounded-lg">
                    {removeBtn}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
