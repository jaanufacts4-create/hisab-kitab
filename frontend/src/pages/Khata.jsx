import { useEffect, useState } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useLang } from '../context/LangContext';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export default function Khata() {
  const { t } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get('/khata').then(({ data }) => setList(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function settle() {
    setError('');
    if (!amount || Number(amount) <= 0) { setError(t('error_amount')); return; }
    setSubmitting(true);
    try {
      await api.post('/khata/settle', { customer_phone: settling.customer_phone, amount: Number(amount), mode: 'cash' });
      setSettling(null); setAmount(''); load();
    } catch (err) {
      setError(err.response?.data?.error || t('settle_error'));
    } finally { setSubmitting(false); }
  }

  const totalDue = list.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('khata_title')} />
      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl border border-ledger-rust/30 p-3.5 mb-4 flex items-center justify-between">
          <span className="text-sm text-ledger-inkSoft">{t('total_credit_due')}</span>
          <span className="font-display text-xl font-semibold text-ledger-rust figure">{rupee(totalDue)}</span>
        </div>
        {loading && <p className="text-center text-ledger-inkSoft mt-8">{t('loading')}</p>}
        {!loading && list.length === 0 && (
          <p className="text-center text-ledger-inkSoft mt-8 text-sm">{t('no_khata')}</p>
        )}
        <div className="space-y-2.5">
          {list.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-ledger-red/15 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.customer_name}</p>
                  <p className="text-xs text-ledger-inkSoft">{c.customer_phone}</p>
                </div>
                <span className={`font-display font-semibold figure ${c.balance > 0 ? 'text-ledger-rust' : 'text-ledger-sage'}`}>
                  {rupee(c.balance)}
                </span>
              </div>
              {c.balance > 0 && settling?.id !== c.id && (
                <div className="mt-2.5 flex gap-2">
                  <button onClick={() => { setSettling(c); setAmount(String(c.balance)); setError(''); }}
                    className="flex-1 text-sm font-medium text-ledger-red border border-ledger-red/30 rounded-lg py-2 hover:bg-ledger-red/5">
                    {t('settle_btn')}
                  </button>
                  <button onClick={() => {
                    const msg = t('khata_title') === 'Khata Bahi' 
                      ? `Namaste ${c.customer_name}, aapka Hisab Kitab par pichla bakaya ₹${c.balance} hai. Kripya jaldi bhugtan karein.`
                      : `Hello ${c.customer_name}, your previous due on Hisab Kitab is ₹${c.balance}. Please settle the amount soon.`;
                    window.open(`https://wa.me/91${c.customer_phone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                    className="flex-1 text-sm font-medium text-[#25D366] border border-[#25D366]/30 rounded-lg py-2 flex items-center justify-center gap-1 hover:bg-[#25D366]/5">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    {t('whatsapp_remind')}
                  </button>
                </div>
              )}
              {settling?.id === c.id && (
                <div className="mt-2.5 space-y-2">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
                  {error && <p className="text-ledger-rust text-xs">{error}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setSettling(null)}
                      className="py-2 rounded-lg border border-ledger-ink/20 text-sm">{t('cancel')}</button>
                    <button onClick={settle} disabled={submitting}
                      className="py-2 rounded-lg bg-ledger-sage text-white text-sm font-medium disabled:opacity-60">
                      {submitting ? '...' : t('confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
