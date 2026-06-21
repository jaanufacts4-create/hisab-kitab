import { useEffect, useState } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useLang } from '../context/LangContext';

function rupee(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

const CATEGORIES = ['Raw material', 'Staff', 'Bijli/Paani', 'Gas', 'Maintenance', 'Other'];

export default function Expenses() {
  const { t } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('cash');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get('/expenses')
      .then(({ data }) => setList(data))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addExpense() {
    if (!amount || Number(amount) <= 0) { setError(t('error_amount')); return; }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/expenses', { category, amount: Number(amount), note, mode });
      setAmount(''); setNote(''); setMode('cash'); setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || t('error_save'));
    } finally {
      setSubmitting(false);
    }
  }

  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const cashTotal = list.filter(e => e.mode === 'cash').reduce((s, e) => s + Number(e.amount), 0);
  const upiTotal = list.filter(e => e.mode === 'upi').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('exp_title')} />
      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ledger-inkSoft">{t('exp_total')}</span>
            <span className="font-display text-xl font-semibold figure">{rupee(total)}</span>
          </div>
          {upiTotal > 0 && (
            <div className="flex justify-end gap-4 mt-1.5">
              <span className="text-[11px] text-ledger-inkSoft">Cash: {rupee(cashTotal)}</span>
              <span className="text-[11px] text-ledger-inkSoft">UPI: {rupee(upiTotal)}</span>
            </div>
          )}
        </div>

        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="block w-full text-center bg-ledger-red text-white font-medium py-3 rounded-xl mb-4">
            {t('add_expense')}
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5 mb-4 space-y-2.5">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm bg-white">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Amount" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm figure" />
            <input placeholder="Note (optional)" value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-red/20 text-sm" />

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ledger-inkSoft">{t('exp_mode_label')}</span>
              <div className="flex gap-1 bg-ledger-paperDark rounded-lg p-1 flex-1">
                {['cash', 'upi'].map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
                      mode === m ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'
                    }`}>
                    {m === 'cash' ? t('exp_cash') : t('exp_upi')}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-ledger-rust text-xs">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowForm(false)}
                className="py-2 rounded-lg border border-ledger-ink/20 text-sm">{t('cancel')}</button>
              <button onClick={addExpense} disabled={submitting}
                className="py-2 rounded-lg bg-ledger-red text-white text-sm font-medium disabled:opacity-60">
                {submitting ? '...' : t('save')}
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-ledger-inkSoft mt-8">{t('loading')}</p>}
        {!loading && list.length === 0 && (
          <p className="text-center text-ledger-inkSoft mt-8 text-sm">{t('no_expenses')}</p>
        )}

        <div className="space-y-2">
          {list.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-ledger-red/15 p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{e.category}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    e.mode === 'upi' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'
                  }`}>{e.mode?.toUpperCase()}</span>
                  {e.note && <p className="text-xs text-ledger-inkSoft">{e.note}</p>}
                </div>
              </div>
              <span className="figure text-sm font-medium">{rupee(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
