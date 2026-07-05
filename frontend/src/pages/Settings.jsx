import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Settings() {
  const { user, isAdmin, refreshPlan } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [upiMsg, setUpiMsg] = useState('');

  useEffect(() => {
    if (user && user.role !== 'owner') navigate('/', { replace: true });
  }, [user]);

  useEffect(() => {
    api.get('/restaurant/me').then(({ data }) => {
      if (data.upi_id) setUpiId(data.upi_id);
    }).catch(() => {});
  }, []);

  async function saveUpi() {
    setSaving(true); setUpiMsg('');
    try {
      await api.put('/restaurant/upi', { upi_id: upiId.trim() });
      setUpiMsg('✅ UPI ID save ho gaya!');
    } catch {
      setUpiMsg('❌ Save nahi hua, dobara try karo');
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title="Settings" />
      <div className="px-4 mt-4 space-y-4">

        {/* UPI ID */}
        <div className="card p-4">
          <p className="font-bold text-sm text-ledger-ink mb-1">📱 UPI ID</p>
          <p className="text-xs text-ledger-inkSoft mb-3">
            Yahi UPI ID billing screen pe QR mein show hogi
          </p>
          <input
            type="text"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="yourname@upi"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-ledger-red"
          />
          {upiMsg && <p className="text-xs mb-2 text-center">{upiMsg}</p>}
          <button
            onClick={saveUpi}
            disabled={saving || !upiId.trim()}
            className="w-full py-3 rounded-xl bg-ledger-red text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save UPI ID'}
          </button>
        </div>

        {/* Manage Staff */}
        <div className="card p-4">
          <p className="font-bold text-sm text-ledger-ink mb-1">👥 Staff</p>
          <p className="text-xs text-ledger-inkSoft mb-3">
            Waiter, cashier, kitchen staff add karo aur unke rights manage karo
          </p>
          <Link to="/staff"
            className="block w-full text-center py-2.5 rounded-xl border border-ledger-red text-ledger-red text-sm font-semibold">
            Manage Staff →
          </Link>
        </div>

        {/* Customer Self-Order QR */}
        <TableQRSection lang={lang} isAdmin={isAdmin} refreshPlan={refreshPlan} />

      </div>
      <BottomNav />
    </div>
  );
}

function TableQRSection({ lang, isAdmin, refreshPlan }) {
  const [plan, setPlan] = useState(null);
  const [qrToken, setQrToken] = useState(null);
  const [tableCount, setTableCount] = useState(8);
  const [qrImages, setQrImages] = useState({});
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
      loadPlan(); refreshPlan();
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
    <div className="card p-4">
      <p className="font-bold text-sm text-ledger-ink mb-1">
        📷 Customer Self-Order (QR)
      </p>
      <p className="text-xs text-ledger-inkSoft mb-3">
        {lang === 'hi'
          ? 'Customer apne phone se table ka QR scan karke khud order kar sakta hai'
          : 'Customers scan the table QR from their phone and order themselves'}
      </p>

      {plan !== 'pro' ? (
        <>
          <p className="text-xs text-amber-600 font-medium mb-3">⭐ Pro plan feature</p>
          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
          {isAdmin && (
            <button onClick={enableProDemo} disabled={switching}
              className="w-full py-2.5 rounded-xl bg-ledger-red text-white text-sm font-semibold disabled:opacity-60 mb-2">
              {switching ? '...' : 'Demo ke liye Pro try karein'}
            </button>
          )}
          <Link to="/plans" className="block text-center text-xs text-ledger-inkSoft underline">
            View All Plans
          </Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input type="number" min="1" max="50" value={tableCount}
              onChange={(e) => setTableCount(Number(e.target.value))}
              className="w-20 px-2 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
            <span className="text-xs text-ledger-inkSoft">tables ke liye QR</span>
            <button onClick={generateQrCodes}
              className="ml-auto px-4 py-2 rounded-xl bg-ledger-red text-white text-xs font-semibold">
              Generate
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
        </>
      )}
    </div>
  );
}
