import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState('owner');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, toggle } = useLang();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [staffPhone, setStaffPhone] = useState('');
  const [staffList, setStaffList] = useState(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [adminContact, setAdminContact] = useState(null);

  async function handleOwnerLogin(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      login(data.token, { role: 'owner', restaurantName: data.restaurant.name, restaurantId: data.restaurant.id });
      navigate(data.is_admin ? '/admin' : '/');
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
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || t('pin_error'));
    } finally { setLoading(false); }
  }

  async function handleForgot() {
    setShowForgot(true);
    if (!adminContact) {
      try {
        const { data } = await api.get('/auth/admin-contact');
        setAdminContact(data.phone);
      } catch { setAdminContact(null); }
    }
  }

  const waLink = adminContact
    ? `https://wa.me/91${adminContact.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent('Hisab Kitab password reset karna hai')}`
    : null;

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
            <button onClick={() => { setMode('owner'); setError(''); setShowForgot(false); }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'owner' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'}`}>
              {t('owner_login')}
            </button>
            <button onClick={() => { setMode('staff'); setError(''); setShowForgot(false); }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'staff' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'}`}>
              {t('staff_login')}
            </button>
          </div>

          {mode === 'owner' && !showForgot && (
            <form onSubmit={handleOwnerLogin} className="space-y-3">
              <input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ledger-inkSoft">
                  <EyeIcon open={showPwd} />
                </button>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={handleForgot} className="text-xs text-ledger-red font-medium">
                  {t('forgot_pwd')}
                </button>
              </div>
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

          {/* Forgot password panel */}
          {mode === 'owner' && showForgot && (
            <div className="space-y-4 text-center">
              <p className="text-ledger-ink font-semibold text-sm">{t('forgot_title')}</p>
              <p className="text-ledger-inkSoft text-xs">{t('forgot_desc')}</p>
              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-green-500 text-green-600 font-bold text-sm">
                  <svg className="w-5 h-5 fill-green-500" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {t('forgot_wa_btn')}
                </a>
              ) : (
                <p className="text-ledger-inkSoft text-xs">Admin se directly contact karein.</p>
              )}
              <button type="button" onClick={() => setShowForgot(false)} className="text-sm text-ledger-red font-medium underline">
                {t('forgot_back')}
              </button>
            </div>
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
              <div className="relative">
                <input type={showPin ? 'text' : 'password'} inputMode="numeric" placeholder="PIN" value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-ledger-red/20 bg-white text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ledger-red/40"
                  required autoFocus />
                <button type="button" onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ledger-inkSoft">
                  <EyeIcon open={showPin} />
                </button>
              </div>
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
