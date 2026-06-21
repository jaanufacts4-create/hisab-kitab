import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLang();
  const [form, setForm] = useState({ restaurant_name: '', owner_name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, { role: 'owner', restaurantName: data.restaurant.name, restaurantId: data.restaurant.id });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('reg_error'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen ledger-bg flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="font-display text-3xl font-semibold text-ledger-red">{t('reg_title')}</h1>
          <p className="text-ledger-inkSoft text-sm mt-1">{t('reg_sub')}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/70 rounded-2xl border border-ledger-red/15 shadow-sm p-5 space-y-3">
          <input placeholder={t('reg_rest_name')} value={form.restaurant_name} onChange={update('restaurant_name')}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
          <input placeholder={t('reg_owner_name')} value={form.owner_name} onChange={update('owner_name')}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
          <input type="tel" placeholder="Phone number" value={form.phone} onChange={update('phone')}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
          <input type="password" placeholder={t('reg_password')} value={form.password} onChange={update('password')}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ledger-red/20 bg-white focus:outline-none focus:ring-2 focus:ring-ledger-red/40" required />
          {error && <p className="text-ledger-rust text-sm">{error}</p>}
          <button disabled={loading} className="w-full bg-ledger-red text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
            {loading ? t('reg_creating') : t('reg_btn')}
          </button>
          <p className="text-center text-sm text-ledger-inkSoft">
            {t('reg_existing')}{' '}
            <Link to="/login" className="text-ledger-red font-medium">{t('reg_login')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
