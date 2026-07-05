import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user && user.role !== 'owner') navigate('/', { replace: true });
  }, [user]);

  useEffect(() => {
    api.get('/restaurant/me').then(({ data }) => {
      if (data.upi_id) setUpiId(data.upi_id);
    }).catch(() => {});
  }, []);

  async function saveUpi() {
    setSaving(true); setMsg('');
    try {
      await api.put('/restaurant/upi', { upi_id: upiId.trim() });
      setMsg('✅ UPI ID save ho gaya!');
    } catch {
      setMsg('❌ Save nahi hua, dobara try karo');
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
          {msg && <p className="text-xs mb-2 text-center">{msg}</p>}
          <button
            onClick={saveUpi}
            disabled={saving || !upiId.trim()}
            className="w-full py-3 rounded-xl bg-ledger-red text-white font-semibold text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save UPI ID'}
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
