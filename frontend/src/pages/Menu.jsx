import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
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

        {user?.role === 'owner' && <TableQRSection lang={lang} />}

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

// ---- Customer self-order QR codes — Premium (Pro plan) feature ----
function TableQRSection({ lang }) {
  const [plan, setPlan] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [tableCount, setTableCount] = useState(8);
  const [qrImages, setQrImages] = useState({}); // tableNo -> data URL
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  function loadPlan() {
    api.get('/restaurant/me')
      .then(({ data }) => { setPlan(data.plan); setQrToken(data.qr_token); })
      .catch(() => setError('Plan info load nahi hui'))
      .finally(() => setLoadingPlan(false));
  }
  useEffect(loadPlan, []);

  async function enableProDemo() {
    setSwitching(true); setError('');
    try {
      await api.put('/restaurant/plan', { plan: 'pro' });
      loadPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Plan badal nahi paya');
    } finally { setSwitching(false); }
  }

  async function generateQrCodes() {
    setError('');
    try {
      const { data } = await api.get('/restaurant/qr');
      const token = data.qr_token;
      setQrToken(token);

      const images = {};
      for (let t = 1; t <= tableCount; t++) {
        const url = `${window.location.origin}/order/${token}/${t}`;
        images[t] = { url, dataUrl: await QRCode.toDataURL(url, { width: 220, margin: 1 }) };
      }
      setQrImages(images);
    } catch (err) {
      setError(err.response?.data?.error || 'QR generate nahi hua');
    }
  }

  if (loadingPlan) return null;

  return (
    <div className="mt-8">
      <p className="text-xs uppercase tracking-widest text-ledger-inkSoft font-semibold mb-2">
        {lang === 'hi' ? 'Customer Self-Order (QR)' : 'Customer Self-Order (QR)'}
      </p>

      {plan !== 'pro' ? (
        <div className="card p-4">
          <p className="text-sm text-ledger-ink mb-1 font-semibold">
            ⭐ {lang === 'hi' ? 'Premium Feature' : 'Premium Feature'}
          </p>
          <p className="text-xs text-ledger-inkSoft mb-3">
            {lang === 'hi'
              ? 'Customer apne phone se QR scan karke khud order kar sakta hai. Yeh Pro plan mein milta hai.'
              : 'Customers can scan a QR at their table and order themselves. Included in the Pro plan.'}
          </p>
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
          <button onClick={enableProDemo} disabled={switching}
            className="w-full py-2.5 rounded-lg bg-ledger-red text-white text-sm font-semibold disabled:opacity-60 mb-2">
            {switching ? '...' : (lang === 'hi' ? 'Demo ke liye Pro try karein' : 'Try Pro for demo')}
          </button>
          <Link to="/plans" className="block text-center text-xs text-ledger-inkSoft underline">
            {lang === 'hi' ? 'Saare Plans Dekhein' : 'View All Plans'}
          </Link>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <input type="number" min="1" max="50" value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
              className="w-20 px-2 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
            <span className="text-xs text-ledger-inkSoft">{lang === 'hi' ? 'tables ke liye QR' : 'tables’ worth of QR'}</span>
            <button onClick={generateQrCodes}
              className="ml-auto px-3 py-2 rounded-lg bg-ledger-red text-white text-xs font-semibold">
              {lang === 'hi' ? 'Generate Karein' : 'Generate'}
            </button>
          </div>
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

          {Object.keys(qrImages).length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(qrImages).map(([tableNo, info]) => (
                <div key={tableNo} className="border border-gray-200 rounded-lg p-2 text-center">
                  <img src={info.dataUrl} alt={`Table ${tableNo} QR`} className="w-full" />
                  <p className="text-xs font-semibold mt-1">Table {tableNo}</p>
                </div>
              ))}
            </div>
          )}
          {Object.keys(qrImages).length > 0 && (
            <p className="text-[11px] text-ledger-inkSoft mt-3">
              {lang === 'hi'
                ? 'Screenshot le ke print kar lo, ya is page se directly print karo.'
                : 'Screenshot and print these, or print directly from this page.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
