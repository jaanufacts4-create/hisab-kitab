import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export default function Menu() {
  const { user, logout } = useAuth();
  const { t, lang } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get('/menu').then(({ data }) => setList(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addItem() {
    if (!name || !price) { setError(t('menu_error')); return; }
    setError(''); setSubmitting(true);
    try {
      await api.post('/menu', { name, price: Number(price), category: category || null });
      setName(''); setPrice(''); setCategory(''); setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.error || t('error_save'));
    } finally { setSubmitting(false); }
  }

  async function removeItem(id) {
    await api.delete(`/menu/${id}`); load();
  }

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('menu_title')} />
      <div className="px-4 mt-4">
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="block w-full text-center bg-ledger-red text-white font-medium py-3 rounded-xl mb-4">
            {t('add_item')}
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5 mb-4 space-y-2.5">
            <input placeholder={t('item_name')} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
            <input placeholder={t('item_category')} value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />
            {error && <p className="text-ledger-rust text-xs">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowForm(false)}
                className="py-2 rounded-lg border border-ledger-ink/20 text-sm">{t('cancel')}</button>
              <button onClick={addItem} disabled={submitting}
                className="py-2 rounded-lg bg-ledger-red text-white text-sm font-medium disabled:opacity-60">
                {submitting ? '...' : t('save')}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-ledger-inkSoft mt-8">{t('loading')}</p>}
        {!loading && list.length === 0 && (
          <p className="text-center text-ledger-inkSoft mt-8 text-sm">{t('no_menu')}</p>
        )}

        <div className="space-y-2">
          {list.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-ledger-red/15 p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-ledger-inkSoft">{item.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="figure text-sm font-medium">{rupee(item.price)}</span>
                <button onClick={() => removeItem(item.id)} className="text-ledger-rust text-xs">{t('remove')}</button>
              </div>
            </div>
          ))}
        </div>

        {user?.role === 'owner' && (
          <div className="mt-8 space-y-2">
            <Link to="/staff"
              className="block w-full text-center text-sm font-medium text-ledger-red border border-ledger-red/30 py-2.5 rounded-xl">
              👥 {lang === 'hi' ? 'Staff Manage Karein' : 'Manage Staff'}
            </Link>
            <button onClick={logout} className="w-full text-center text-sm text-ledger-inkSoft py-2">
              {t('logout')}
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
