import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import StampBadge from '../components/StampBadge';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { parseServerDate } from '../utils/date';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

const STATUS_COLOR = {
  open:       'bg-yellow-50 text-yellow-700 border-yellow-200',
  preparing:  'bg-blue-50 text-blue-700 border-blue-200',
  ready:      'bg-green-50 text-green-700 border-green-200',
  billed:     'bg-gray-50 text-gray-500 border-gray-200',
  cancelled:  'bg-red-50 text-red-400 border-red-200',
};

export default function Orders() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // IMPORTANT: always handle the failure case — without a .catch() here, a
  // failed request silently leaves `orders` empty and looks exactly like
  // "no orders today" even though the data is fine on the server.
  function load() {
    api.get('/orders')
      .then(({ data }) => { setOrders(data); setError(''); })
      .catch((err) => setError(err.response?.data?.error || (lang === 'hi' ? 'Orders load nahi hue' : 'Could not load orders')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Auto-refresh every 15 sec for live kitchen updates
  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(id, status, e) {
    e.preventDefault(); e.stopPropagation();
    await api.put(`/orders/${id}/status`, { status });
    load();
  }

  const STATUS_LABEL = {
    open:      lang === 'hi' ? 'Naya' : 'New',
    preparing: lang === 'hi' ? 'Ban Raha Hai' : 'Preparing',
    ready:     lang === 'hi' ? '✓ Ready' : '✓ Ready',
    billed:    lang === 'hi' ? 'Bill Ho Gaya' : 'Billed',
    cancelled: lang === 'hi' ? 'Cancel' : 'Cancelled',
  };

  // Separate active vs done orders
  const active = orders.filter(o => !['billed','cancelled'].includes(o.status));
  const done   = orders.filter(o =>  ['billed','cancelled'].includes(o.status));

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title={t('orders_title')} />
      <div className="px-4 mt-4">
        <Link to="/orders/new"
          className="block text-center bg-ledger-red text-white font-medium py-3 rounded-xl mb-4">
          {t('new_order')}
        </Link>

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
            {active.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`}
                className="block bg-white rounded-xl border border-ledger-red/15 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">
                      {o.table_no ? `Table ${o.table_no}` : o.customer_name || `Order #${o.id}`}
                    </p>
                    <p className="text-xs text-ledger-inkSoft">
                      {parseServerDate(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold figure text-sm">{rupee(o.total)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[o.status] || ''}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                </div>

                {/* Items — kitchen/waiter need to know WHAT to cook/serve,
                    not just the bill total */}
                {o.items && o.items.length > 0 && (
                  <p className="text-xs text-ledger-ink/80 mb-2 leading-snug">
                    {o.items.map((it) => `${it.qty}× ${it.item_name}`).join(', ')}
                  </p>
                )}

                {/* Kitchen action buttons */}
                <div className="flex gap-2" onClick={e => e.preventDefault()}>
                  {o.status === 'open' && (
                    <>
                    <button onClick={(e) => updateStatus(o.id, 'preparing', e)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white">
                      {lang === 'hi' ? '👨‍🍳 Accept' : '👨‍🍳 Accept'}
                    </button>
                    <Link to={`/orders/${o.id}/add-items`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-ledger-red text-ledger-red text-center">
                      {lang === 'hi' ? '＋ Items Joṛo' : '＋ Add Items'}
                    </Link>
                    </>
                  )}
                  {o.status === 'preparing' && (
                    <>
                    <button onClick={(e) => updateStatus(o.id, 'ready', e)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-500 text-white">
                      {lang === 'hi' ? '✓ Ready Hai' : '✓ Mark Ready'}
                    </button>
                    <Link to={`/orders/${o.id}/add-items`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-ledger-red text-ledger-red text-center">
                      {lang === 'hi' ? '＋ Items Joṛo' : '＋ Add Items'}
                    </Link>
                    </>
                  )}
                  {o.status === 'ready' && (
                    <>
                    <Link to={`/orders/${o.id}/add-items`} onClick={e => e.stopPropagation()}
                      className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-ledger-red text-ledger-red text-center">
                      {lang === 'hi' ? '＋ Items Joṛo' : '＋ Add Items'}
                    </Link>
                    {(user?.role === 'owner' || user?.role === 'cashier') && (
                      <Link to={`/orders/${o.id}`} onClick={e => e.stopPropagation()}
                        className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-ledger-red text-white text-center">
                        {lang === 'hi' ? '💳 Bill Banao' : '💳 Create Bill'}
                      </Link>
                    )}
                    {user?.role === 'waiter' && (
                      <span className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 text-center">
                        {lang === 'hi' ? '🛎 Serve Karein' : '🛎 Serve to customer'}
                      </span>
                    )}
                    </>
                  )}
                </div>
              </Link>
            ))}
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
                className="block bg-white/70 rounded-xl border border-ledger-red/10 p-3 flex items-center justify-between opacity-70">
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
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
