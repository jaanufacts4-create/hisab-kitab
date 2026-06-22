import { useEffect, useState } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useLang } from '../context/LangContext';
import { useViewDate, toDateStr } from '../context/DateContext';

function rupee(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function formatDateLabel(dateStr) {
  const today = toDateStr(new Date());
  const d = new Date(dateStr + 'T00:00:00');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === today) return 'Aaj (Today)';
  if (dateStr === toDateStr(yesterday)) return 'Kal (Yesterday)';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CATEGORIES = ['Raw material', 'Staff', 'Bijli/Paani', 'Gas', 'Maintenance', 'Other'];

export default function Expenses() {
  const { t, lang } = useLang();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('cash');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Shared with Dashboard — switching tabs keeps showing the same day
  // instead of silently resetting to today.
  const { viewDate: date, setViewDate: setDate } = useViewDate();

  // Editing state — when set, the form above is reused in "edit" mode
  // instead of "add new" mode.
  const [editingId, setEditingId] = useState(null);

  const today = toDateStr(new Date());
  const isToday = date === today;

  function load() {
    setLoading(true);
    api.get(`/expenses?date=${date}`)
      .then(({ data }) => setList(data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [date]);

  function prevDay() {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setDate(toDateStr(d));
  }

  function nextDay() {
    if (isToday) return;
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setDate(toDateStr(d));
  }

  function resetForm() {
    setCategory(CATEGORIES[0]); setAmount(''); setNote(''); setMode('cash');
    setEditingId(null); setShowForm(false); setError('');
  }

  function startEdit(e) {
    setEditingId(e.id);
    setCategory(e.category);
    setAmount(String(e.amount));
    setNote(e.note || '');
    setMode(e.mode || 'cash');
    setShowForm(true);
    setError('');
  }

  async function saveExpense() {
    if (!amount || Number(amount) <= 0) { setError(t('error_amount')); return; }
    setError('');
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/expenses/${editingId}`, { category, amount: Number(amount), note, mode });
      } else {
        // New expenses get logged against whichever date is currently being
        // viewed — useful for backfilling a forgotten entry on a past day.
        await api.post('/expenses', { category, amount: Number(amount), note, mode, expense_date: date });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || t('error_save'));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(id) {
    const msg = lang === 'hi' ? 'Yeh expense delete karein?' : 'Delete this expense?';
    if (!window.confirm(msg)) return;
    await api.delete(`/expenses/${id}`);
    load();
  }

  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const cashTotal = list.filter(e => e.mode === 'cash').reduce((s, e) => s + Number(e.amount), 0);
  const upiTotal = list.filter(e => e.mode === 'upi').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('exp_title')} />
      <div className="px-4 mt-4">

        {/* Date navigation bar — same pattern as Dashboard, and now backed
            by the SAME shared date, so switching tabs doesn't reset it. */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-ledger-red/20 px-3 py-2.5 mb-2 shadow-sm gap-1">
          <button onClick={prevDay} aria-label="Previous day"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-ledger-red font-bold text-lg hover:bg-red-50 transition-colors shrink-0">
            &#8592;
          </button>

          <div className="flex-1 text-center min-w-0">
            <p className="text-sm font-semibold text-ledger-ink leading-tight">{formatDateLabel(date)}</p>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="text-[11px] text-ledger-inkSoft text-center bg-transparent border-none outline-none w-full"
            />
          </div>

          <button onClick={nextDay} disabled={isToday} aria-label="Next day"
            className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg transition-colors shrink-0 ${
              isToday ? 'text-gray-300 cursor-default' : 'text-ledger-red hover:bg-red-50'
            }`}>
            &#8594;
          </button>
        </div>

        {!isToday && (
          <button onClick={() => setDate(today)} className="block mx-auto text-xs text-ledger-red font-semibold mb-4">
            &#8635; Jump to Today
          </button>
        )}
        {isToday && <div className="mb-2" />}

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
            {editingId ? (
              <p className="text-xs font-semibold text-ledger-red uppercase tracking-wide">
                {lang === 'hi' ? 'Expense Edit Karein' : 'Editing Expense'}
              </p>
            ) : !isToday && (
              <p className="text-xs font-semibold text-ledger-red uppercase tracking-wide">
                {lang === 'hi' ? `Yeh ${formatDateLabel(date)} ke liye add hoga` : `Adding for ${formatDateLabel(date)}`}
              </p>
            )}
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
              <button onClick={resetForm}
                className="py-2 rounded-lg border border-ledger-ink/20 text-sm">{t('cancel')}</button>
              <button onClick={saveExpense} disabled={submitting}
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
            <div key={e.id} className="bg-white rounded-xl border border-ledger-red/15 p-3">
              <div className="flex justify-between items-center">
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
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => startEdit(e)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-ledger-red/30 text-ledger-red">
                  {lang === 'hi' ? '✎ Edit Karein' : '✎ Edit'}
                </button>
                <button onClick={() => deleteExpense(e.id)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-500">
                  {lang === 'hi' ? '🗑 Hatayein' : '🗑 Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
