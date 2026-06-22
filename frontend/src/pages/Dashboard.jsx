import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
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

export default function Dashboard() {
  const { t } = useLang();
  const { user, plan, rawPlan, daysLeft, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Shared with Expenses (and anywhere else date-scoped) — so switching
  // tabs keeps showing the same day instead of silently jumping to today.
  const { viewDate: date, setViewDate: setDate } = useViewDate();

  const today = toDateStr(new Date());
  const isToday = date === today;

  // Dashboard (Sales) is owner-only — keep staff out even if they hit "/" directly.
  useEffect(() => {
    if (user && user.role !== 'owner') navigate('/orders', { replace: true });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setSummary(null);
    api.get(`/dashboard/summary?date=${date}`)
      .then(({ data }) => setSummary(data))
      .catch(() => setError(t('dash_error')))
      .finally(() => setLoading(false));
  }, [date]);

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

  if (user && user.role !== 'owner') return null;

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('dash_title')} />
      <div className="px-4 mt-4">

        {/* Date navigation bar */}
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

        {loading && <p className="text-center text-ledger-inkSoft mt-10">{t('loading')}</p>}
        {error && <p className="text-center text-ledger-rust mt-10">{error}</p>}

        {summary && (
          <>
            <div className="bg-white rounded-2xl border border-ledger-red/15 shadow-sm p-5">
              <p className="text-xs uppercase tracking-widest text-ledger-inkSoft text-center mb-1">
                {t('total_sales')}
              </p>
              <p className="font-display text-4xl font-semibold text-ledger-red text-center figure">
                {rupee(summary.total_sales)}
              </p>
              <p className="text-xs text-ledger-inkSoft text-center mt-1">
                {summary.order_count} {t('orders_today')}
              </p>

              <div className="border-t border-dashed border-ledger-ink/20 my-4" />

              <div className="space-y-2.5">
                <Row label={t('cash')} value={rupee(summary.cash_total)} dot="#059669" />
                <Row label={t('upi')} value={rupee(summary.upi_total)} dot="#059669" />
                <Row label={t('credit')} value={rupee(summary.credit_total)} dot="#EA580C" />
              </div>

              <div className="border-t border-dashed border-ledger-ink/20 my-4" />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ledger-inkSoft">{t('expenses_label')}</span>
                  <div className="text-right">
                    <span className="figure text-sm text-ledger-inkSoft">- {rupee(summary.total_expenses)}</span>
                    {summary.upi_expenses > 0 && (
                      <p className="text-[10px] text-ledger-inkSoft">
                        (Cash: {rupee(summary.cash_expenses)} / UPI: {rupee(summary.upi_expenses)})
                      </p>
                    )}
                  </div>
                </div>
                {/* Expenses are deducted from whichever mode they were paid
                    in — cash expense reduces cash in hand, UPI expense
                    reduces the UPI balance. */}
                <Row
                  label={t('cash_in_hand')}
                  value={rupee(summary.net_cash_in_hand)}
                  bold
                  negative={summary.net_cash_in_hand < 0}
                />
                <Row
                  label={t('upi') + ' (Net)'}
                  value={rupee(summary.net_upi_balance)}
                  bold
                  negative={summary.net_upi_balance < 0}
                />

                <div className="border-t-2 border-ledger-red/20 mt-1 pt-2.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-ledger-ink">
                    Total Net in Hand
                  </span>
                  <span className={`font-display text-xl font-bold figure ${
                    summary.net_total_in_hand < 0 ? 'text-ledger-rust' : 'text-ledger-red'
                  }`}>
                    {rupee(summary.net_total_in_hand)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <MiniCard label={t('total_due')} value={rupee(summary.total_outstanding)} accent="#EA580C" />
              <MiniCard label={t('open_orders')} value={summary.open_orders} accent="#B91C1C" />
            </div>

            <Link to={['basic', 'pro'].includes(plan) ? '/analytics' : '/plans'}
              className="flex items-center justify-center gap-2 bg-white rounded-xl border border-ledger-red/15 p-3 text-sm font-medium text-ledger-red shadow-sm mt-3">
              &#128202; {['basic', 'pro'].includes(plan) ? 'View Trends & Analytics' : 'Trends & Analytics — Upgrade to Basic'}
            </Link>

            {rawPlan === 'trial' && plan !== 'expired' && daysLeft != null && (
              <p className="text-center text-xs font-semibold text-ledger-red mt-2">
                ⏳ Trial: {daysLeft} din baki hain
              </p>
            )}

            <Link to="/plans" className="block text-center text-xs text-ledger-inkSoft mt-2">
              {rawPlan ? `Current plan: ${rawPlan.toUpperCase()}` : ''} · View Plans
            </Link>

            {isAdmin && (
              <Link to="/admin" className="block text-center text-xs text-ledger-red underline mt-1">
                Admin Panel
              </Link>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function Row({ label, value, dot, bold, negative }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ledger-inkSoft">
        {dot && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </span>
      <span className={`figure text-sm ${bold ? 'font-semibold text-base' : ''} ${negative ? 'text-ledger-rust' : 'text-ledger-ink'}`}>
        {value}
      </span>
    </div>
  );
}

function MiniCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5">
      <p className="text-[11px] text-ledger-inkSoft mb-1">{label}</p>
      <p className="font-display text-xl font-semibold figure" style={{ color: accent }}>{value}</p>
    </div>
  );
}
