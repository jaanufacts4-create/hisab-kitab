import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Login() {
  const [mode, setMode] = useState('owner');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, toggle } = useLang();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffList, setStaffList] = useState(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleOwnerLogin(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      login(data.token, { role: 'owner', restaurantName: data.restaurant.name, restaurantId: data.restaurant.id });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('login_error'));
    } finally { setLoading(false); }
  }

  async function handleFindStaff(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.get('/auth/staff-list', { params: { restaurant_phone: staffPhone } });
      setStaffList(data.staff); setRestaurantName(data.restaurant_name);
    } catch (err) {
      setError(err.response?.data?.error || t('phone_error'));
    } finally { setLoading(false); }
  }

  async function handleStaffPinLogin(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/staff-login', { staff_id: selectedStaff.id, pin });
      login(data.token, { role: data.staff.role, staffName: data.staff.name, restaurantName });
      // Staff (cashier/waiter) land on Orders — the Sales dashboard is owner-only.
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || t('pin_error'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen ledger-bg flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <p className="text-ledger-rust font-display text-sm tracking-wide mb-1">हिसाब किताब</p>
          <h1 className="font-display text-3xl font-semibold text-ledger-red">Hisab Kitab</h1>
          <p className="text-ledger-inkSoft text-sm mt-1">{t('login_sub')}</p>
          <button onClick={toggle} className="mt-2 text-xs font-semibold bg-ledger-red/10 text-ledger-red px-3 py-1 rounded-full">
            {lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
          </button>
        </div>

        <div className="bg-white/70 rounded-2xl border border-ledger-red/15 shadow-sm p-5">
          <div className="flex gap-1 mb-5 bg-ledger-paperDark rounded-lg p-1">
            <button onClick={() => { setMode('owner'); setError(''); }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'owner' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'}`}>
              {t('owner_login')}
            </button>
            <button onClick={() => { setMode('staff'); setError(''); }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'staff' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'}`}>
              {t('staff_login')}
            </button>
          </div>

          {mode === 'owner' && (
            <form onSubmit={handleOwnerLogin} className="space-y-3">
              <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
              {error && <p className="text-ledger-rust text-sm">{error}</p>}
              <button disabled={loading} className="w-full bg-ledger-red text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
                {loading ? t('loading') : t('login_btn')}
              </button>
              <p className="text-center text-sm text-ledger-inkSoft">
                {t('new_rest')}{' '}
                <Link to="/register" className="text-ledger-red font-medium">{t('create_account')}</Link>
              </p>
            </form>
          )}

          {mode === 'staff' && !staffList && (
            <form onSubmit={handleFindStaff} className="space-y-3">
              <input type="tel" placeholder="Restaurant ka phone number" value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
              {error && <p className="text-ledger-rust text-sm">{error}</p>}
              <button disabled={loading} className="w-full bg-ledger-red text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
                {loading ? t('searching') : t('find_staff')}
              </button>
            </form>
          )}

          {mode === 'staff' && staffList && !selectedStaff && (
            <div className="space-y-2">
              <p className="text-sm text-ledger-inkSoft mb-2">{restaurantName} — {t('choose_name')}</p>
              {staffList.map((s) => (
                <button key={s.id} onClick={() => setSelectedStaff(s)}
                  className="w-full text-left px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white hover:bg-ledger-paperDark">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-ledger-inkSoft ml-2 capitalize">({s.role})</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'staff' && selectedStaff && (
            <form onSubmit={handleStaffPinLogin} className="space-y-3">
              <p className="text-sm text-ledger-inkSoft">
                <span className="font-medium text-ledger-ink">{selectedStaff.name}</span> — {t('enter_pin')}
              </p>
              <input type="password" inputMode="numeric" placeholder="PIN" value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ledger-red/40"
                required autoFocus />
              {error && <p className="text-ledger-rust text-sm">{error}</p>}
              <button disabled={loading} className="w-full bg-ledger-red text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
                {loading ? t('loading') : t('login_btn')}
              </button>
              <button type="button" onClick={() => setSelectedStaff(null)} className="w-full text-sm text-ledger-inkSoft py-1">
                {t('back')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
