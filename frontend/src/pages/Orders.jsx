import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import StampBadge from '../components/StampBadge';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { parseServerDate } from '../utils/date';
import { playNewOrderTone, playReadyTone } from '../utils/sound';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }
// Live kitchen timer — counts up from accepted_at.
// When status is 'ready' AND 2+ min passed since ready_at → red + flash.
function KitchenTimer({ acceptedAt, readyAt, status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!acceptedAt) return null;

  const startMs = new Date(acceptedAt.includes('Z') ? acceptedAt : acceptedAt + 'Z').getTime();
  const elapsedSec = Math.floor((now - startMs) / 1000);
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const display = `${mins}:${String(secs).padStart(2, '0')}`;

  const readyMs = readyAt ? new Date(readyAt.includes('Z') ? readyAt : readyAt + 'Z').getTime() : null;
  const overdueReady = status === 'ready' && readyMs && (now - readyMs) > 2 * 60 * 1000;

  if (overdueReady) {
    return (
      <span className="text-xs font-bold text-red-600 animate-pulse">
        ⚠ Ready {display}
      </span>
    );
  }

  const color = status === 'ready' ? 'text-green-600' : 'text-blue-600';
  return (
    <span className={`text-xs font-semibold tabular-nums ${color}`}>
      ⏱ {display}
    </span>
  );
}


const STATUS_COLOR = {
  open:            'bg-yellow-50 text-yellow-700 border-yellow-200',
  preparing:       'bg-blue-50 text-blue-700 border-blue-200',
  ready:           'bg-green-50 text-green-700 border-green-200',
  payment_pending: 'bg-orange-50 text-orange-700 border-orange-300',
  billed:          'bg-gray-50 text-gray-500 border-gray-200',
  cancelled:       'bg-red-50 text-red-400 border-red-200',
};

const ITEM_STATUS_COLOR = {
  open: 'text-amber-600',
  preparing: 'text-blue-600',
  ready: 'text-green-600',
  served: 'text-ledger-inkSoft',
};

export default function Orders() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('today'); // 'today' | 'open'

  // Snapshot of the previous poll's orders (keyed by id), used purely to
  // detect what changed since last time so we know when to play a
  // notification tone. Stays null until the first successful load so
  // opening the page doesn't beep for orders that were already there.
  const prevOrdersRef = useRef(null);
  const filterRef = useRef(filter);

  // IMPORTANT: always handle the failure case — without a .catch() here, a
  // failed request silently leaves `orders` empty and looks exactly like
  // "no orders today" even though the data is fine on the server.
  function load(currentFilter) {
    const f = currentFilter ?? filterRef.current;
    api.get(f === 'open' ? '/orders?filter=open' : '/orders')
      .then(({ data }) => {
        if (prevOrdersRef.current) {
          const prevById = prevOrdersRef.current;
          const isStaff = ['waiter', 'cashier', 'kitchen'].includes(user?.role);
          const isOwner = user?.role === 'owner';

          // A brand-new order appeared since the last poll — alert staff
          // (kitchen/waiter) so they notice it without staring at the screen.
          if (isStaff) {
            const hasNewOrder = data.some((o) => !prevById[o.id]);
            if (hasNewOrder) playNewOrderTone();
          }

          // An order that had no "ready" items before now has one — alert
          // the owner that something needs billing/serving.
          if (isOwner) {
            const justBecameReady = data.some((o) => {
              const prev = prevById[o.id];
              if (!prev) return false;
              const prevReady = (prev.items || []).some((it) => it.status === 'ready');
              const nowReady = (o.items || []).some((it) => it.status === 'ready');
              return !prevReady && nowReady;
            });
            if (justBecameReady) playReadyTone();
          }
        }

        const snapshot = {};
        data.forEach((o) => { snapshot[o.id] = o; });
        prevOrdersRef.current = snapshot;

        setOrders(data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.error || (lang === 'hi' ? 'Orders load nahi hue' : 'Could not load orders')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { filterRef.current = filter; load(filter); }, [filter]);

  // Auto-refresh for live kitchen updates — 5s gives a much snappier
  // cross-device sync than the old 15s without meaningfully increasing
  // load for a single restaurant's traffic.
  useEffect(() => {
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, []);

  // Same rule as the order-detail page: never swallow a failure here — a
  // silently-failed tap looks exactly like a "stuck" status to the person
  // tapping it, with nothing telling them it didn't actually work.
  async function updateStatus(id, status, e) {
    e.preventDefault(); e.stopPropagation();
    try {
      await api.put(`/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'hi' ? 'Status update nahi hua' : 'Could not update status'));
    }
  }

  async function markServed(id, e) {
    e.preventDefault(); e.stopPropagation();
    try {
      await api.put(`/orders/${id}/serve`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'hi' ? 'Serve mark nahi hua' : 'Could not mark as served'));
    }
  }

  const STATUS_LABEL = {
    open:            lang === 'hi' ? 'Naya' : 'New',
    preparing:       lang === 'hi' ? 'Ban Raha Hai' : 'Preparing',
    ready:           lang === 'hi' ? '✓ Ready' : '✓ Ready',
    payment_pending: lang === 'hi' ? '💰 Payment Pending' : '💰 Payment Pending',
    billed:          lang === 'hi' ? 'Bill Ho Gaya' : 'Billed',
    cancelled:       lang === 'hi' ? 'Cancel' : 'Cancelled',
  };

  const ITEM_STATUS_LABEL = {
    open: lang === 'hi' ? 'Naya' : 'New',
    preparing: lang === 'hi' ? 'Ban Raha Hai' : 'Preparing',
    ready: lang === 'hi' ? 'Ready' : 'Ready',
    served: lang === 'hi' ? 'Served' : 'Served',
  };

  // Separate active vs done orders
  const active = orders.filter(o => !['billed','cancelled'].includes(o.status));
  const done   = orders.filter(o =>  ['billed','cancelled'].includes(o.status));

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('orders_title')} />
      <div className="px-4 mt-4">
        <Link to="/orders/new"
          className="block text-center bg-ledger-red text-white font-medium py-3 rounded-xl mb-3">
          {t('new_order')}
        </Link>

        {/* Filter toggle */}
        <div className="flex gap-1.5 mb-4 bg-white rounded-xl border border-ledger-red/15 p-1">
          <button onClick={() => setFilter('today')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'today' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'
            }`}>
            {lang === 'hi' ? '📅 Aaj' : '📅 Today'}
          </button>
          <button onClick={() => setFilter('open')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === 'open' ? 'bg-ledger-red text-white' : 'text-ledger-inkSoft'
            }`}>
            {lang === 'hi' ? '🔴 Sab Open' : '🔴 All Open'}
          </button>
        </div>

        {loading && <p className="text-center text-ledger-inkSoft mt-8">{t('loading')}</p>}
        {!loading && error && (
          <p className="text-center text-red-600 text-sm mt-8">⚠ {error}</p>
        )}
        {!loading && !error && orders.length === 0 && (
          <p className="text-center text-ledger-inkSoft mt-8 text-sm">{t('no_orders')}</p>
        )}

        {/* Active orders */}
        {active.length > 0 && (
          <div className="space-y-2.5 mb-4">
            {active.map((o) => {
              const items = o.items || [];
              const hasOpen = items.some((it) => it.status === 'open');
              const hasPreparing = items.some((it) => it.status === 'preparing');
              const hasReady = items.some((it) => it.status === 'ready');

              return (
              <Link key={o.id} to={`/orders/${o.id}`}
                className="block bg-white rounded-xl border border-ledger-red/15 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">
                      {o.table_no ? `Table ${o.table_no}` : o.customer_name || `Order #${o.id}`}
                    </p>
                    <p className="text-xs text-ledger-inkSoft">
                      {filter === 'open'
                        ? parseServerDate(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + parseServerDate(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : parseServerDate(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold figure text-sm">{rupee(o.total)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[o.status] || ''}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                </div>

                {/* Kitchen timer */}
                {['preparing','ready'].includes(o.status) && (
                  <div className="mb-1.5">
                    <KitchenTimer acceptedAt={o.accepted_at} readyAt={o.ready_at} status={o.status} />
                  </div>
                )}

                {/* Per-item status + timestamp — kitchen/waiter need to know
                    WHAT to cook/serve and which batch is at which stage, not
                    just one merged bill total. A newly added "Roti ×2" stays
                    visibly distinct from an already-"Served" "Roti ×1". */}
                {items.length > 0 && (
                  <div className="mb-2.5 space-y-1 border-b border-dashed border-gray-200 pb-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-ledger-ink/80">{it.qty}× {it.item_name}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-semibold ${ITEM_STATUS_COLOR[it.status] || 'text-ledger-inkSoft'}`}>
                            {ITEM_STATUS_LABEL[it.status] || it.status}
                          </span>
                          {it.created_at && (
                            <span className="text-ledger-inkSoft">
                              {parseServerDate(it.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Kitchen action buttons — driven by what's actually pending
                    at the item level, not just the order's overall status */}
                <div className="flex gap-2 flex-wrap" onClick={e => e.preventDefault()}>
                  {hasOpen && (
                    <button onClick={(e) => updateStatus(o.id, 'preparing', e)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white">
                      {lang === 'hi' ? '👨‍🍳 Accept' : '👨‍🍳 Accept'}
                    </button>
                  )}
                  {hasPreparing && (
                    <button onClick={(e) => updateStatus(o.id, 'ready', e)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-500 text-white">
                      {lang === 'hi' ? '✓ Ready Hai' : '✓ Mark Ready'}
                    </button>
                  )}
                  {hasReady && user?.role === 'waiter' && (
                    <button onClick={(e) => markServed(o.id, e)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700">
                      {lang === 'hi' ? '🛎 Serve Ho Gaya' : '🛎 Mark Served'}
                    </button>
                  )}
                  {hasReady && (user?.role === 'owner' || user?.role === 'cashier') && (
                    <Link to={`/orders/${o.id}`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-ledger-red text-white text-center">
                      {lang === 'hi' ? '💳 Bill Banao' : '💳 Create Bill'}
                    </Link>
                  )}
                  {o.status === 'payment_pending' && (user?.role === 'owner' || user?.role === 'cashier') && (
                    <Link to={`/orders/${o.id}`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white text-center animate-pulse">
                      {lang === 'hi' ? '✅ Payment Confirm Karo' : '✅ Confirm Payment'}
                    </Link>
                  )}
                  {user?.role !== 'kitchen' && (
                    <Link to={`/orders/${o.id}/add-items`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-ledger-red text-ledger-red text-center">
                      {lang === 'hi' ? '＋ Items Joṛo' : '＋ Add Items'}
                    </Link>
                  )}
                </div>
              </Link>
              );
            })}
          </div>
        )}

        {/* Completed orders (collapsed) */}
        {done.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ledger-inkSoft font-medium uppercase tracking-wide">
              {lang === 'hi' ? 'Completed' : 'Completed'}
            </p>
            {done.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`}
                className="block bg-white/70 rounded-xl border border-ledger-red/10 p-3 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{o.table_no ? `Table ${o.table_no}` : o.customer_name || `Order #${o.id}`}</p>
                    <p className="text-xs text-ledger-inkSoft">
                      {parseServerDate(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="figure text-sm">{rupee(o.total)}</span>
                    <StampBadge status={o.payment_mode || o.payment_status} />
                  </div>
                </div>
                {o.collected_by_name && (
                  <p className="text-[10px] text-green-700 mt-1">✅ Received by {o.collected_by_name}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
