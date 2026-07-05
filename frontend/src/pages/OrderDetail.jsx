import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { parseServerDate } from '../utils/date';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

function padRight(s, len) { s = String(s); return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length); }
function padLeft(s, len) { s = String(s); return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s; }

// Plain monospace text receipt sized for 58/80mm thermal paper (~32 cols).
// Rendered into the .thermal-receipt block, which is hidden on screen and
// on normal print, and only shown when printing on narrow (<=80mm) paper —
// see the @media print rules in index.css.
function buildThermalReceipt(order, restaurantName) {
  const W = 32;
  const rule = '-'.repeat(W);
  const center = (s) => {
    s = String(s);
    const pad = Math.max(0, Math.floor((W - s.length) / 2));
    return ' '.repeat(pad) + s;
  };
  const lines = [];
  lines.push(center(restaurantName || 'Hisab Kitab'));
  lines.push(rule);
  lines.push(`Bill No: ${order.id}`);
  lines.push(order.table_no ? `Table: ${order.table_no}` : (order.customer_name || `Order #${order.id}`));
  lines.push(parseServerDate(order.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }));
  lines.push(rule);
  lines.push(padRight('Item', 14) + padLeft('Qty', 4) + padLeft('Rate', 6) + padLeft('Amt', 8));
  lines.push(rule);
  order.items.forEach((it) => {
    lines.push(
      padRight(it.item_name, 14) +
      padLeft(it.qty, 4) +
      padLeft(Math.round(it.price), 6) +
      padLeft(Math.round(it.line_total), 8)
    );
  });
  lines.push(rule);
  lines.push(padRight('TOTAL', W - 8) + padLeft(Math.round(order.total), 8));
  if (order.payment_mode) lines.push(`Paid via: ${order.payment_mode.toUpperCase()}`);
  lines.push(rule);
  lines.push(center('Thank You! Visit Again'));
  return lines.join('\n');
}

const STATUS_STYLE = {
  open:       { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  preparing:  { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'  },
  ready:      { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
  billed:     { bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200'  },
  cancelled:  { bg: 'bg-red-50',    text: 'text-red-400',    border: 'border-red-200'   },
};

const ITEM_STATUS_COLOR = {
  open: 'text-amber-600',
  preparing: 'text-blue-600',
  ready: 'text-green-600',
  served: 'text-ledger-inkSoft',
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { user, plan } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get(`/orders/${id}`).then(({ data }) => setOrder(data));
  }
  useEffect(load, [id]);

  // Auto-refresh so owner sees kitchen status changes without manual reload
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function pay(mode) {
    setError(''); setSubmitting(true);
    try {
      if (mode === 'credit' && !order.customer_phone) {
        setError(lang === 'hi' ? 'Khata ke liye phone number zaroori hai' : 'Phone number required for credit');
        setSubmitting(false); return;
      }
      await api.put(`/orders/${id}/payment`, { mode, amount: order.total });
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed');
    } finally { setSubmitting(false); }
  }

  async function updateStatus(status) {
    setSubmitting(true); setError('');
    try { await api.put(`/orders/${id}/status`, { status }); load(); }
    catch (err) { setError(err.response?.data?.error || 'Could not update status'); }
    finally { setSubmitting(false); }
  }

  // IMPORTANT: never let this fail silently — without a .catch() here, a
  // failed request leaves the screen showing stale "Ready" with no
  // indication anything went wrong, which is exactly the "stuck" symptom
  // that's confusing to debug from a bug report alone.
  async function markServed() {
    setSubmitting(true); setError('');
    try { await api.put(`/orders/${id}/serve`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Could not mark as served'); }
    finally { setSubmitting(false); }
  }

  function printBill() {
    window.print();
  }

  if (!order) return <div className="min-h-screen ledger-bg" />;

  const STATUS_LABEL = {
    open:      lang === 'hi' ? 'Naya Order' : 'New Order',
    preparing: lang === 'hi' ? 'Ban Raha Hai' : 'Preparing',
    ready:     lang === 'hi' ? 'Ready Hai' : 'Ready',
    billed:    lang === 'hi' ? 'Bill Ho Gaya' : 'Billed',
    cancelled: lang === 'hi' ? 'Cancel' : 'Cancelled',
  };

  const ITEM_STATUS_LABEL = {
    open: lang === 'hi' ? 'Naya' : 'New',
    preparing: lang === 'hi' ? 'Ban Raha Hai' : 'Preparing',
    ready: lang === 'hi' ? 'Ready' : 'Ready',
    served: lang === 'hi' ? 'Served' : 'Served',
  };

  const s = STATUS_STYLE[order.status] || STATUS_STYLE.open;
  const canBill = (user?.role === 'owner' || user?.role === 'cashier') && (
    order.status === 'ready' ||
    // Direct billing allowed for fresh orders (nothing in kitchen yet)
    (order.status === 'open' && user?.role === 'owner' && !hasReady && !hasPreparing)
  );
  // Allow adding items right up until the bill is actually generated, but
  // not for kitchen staff — only owner/cashier/waiter can add items.
  const canAddItems = ['open','preparing','ready'].includes(order.status) &&
                      user?.role !== 'kitchen';

  // Kitchen actions are driven by item-level status, not just the order's
  // overall status — so already-served items stay "Served" even while a
  // newly added batch on the same order still needs Accept.
  const items = order.items || [];
  const hasOpen = items.some((it) => it.status === 'open');
  const hasPreparing = items.some((it) => it.status === 'preparing');
  const hasReady = items.some((it) => it.status === 'ready');

  return (
    <div className="min-h-screen ledger-bg pb-10">
      <Header title={order.table_no ? `Table ${order.table_no}` : `Order #${order.id}`} />

      <div className="px-4 mt-4 space-y-3">

        {/* Status bar */}
        <div className={`print-hidden flex items-center justify-between px-4 py-2.5 rounded-xl border ${s.bg} ${s.border}`}>
          <span className={`text-sm font-semibold ${s.text}`}>{STATUS_LABEL[order.status]}</span>
          {order.customer_name && (
            <span className="text-xs text-gray-500">{order.customer_name}</span>
          )}
        </div>

        {/* Always-visible error banner — Accept/Mark Ready/Mark Served can
            all fail (network blip, stale data, etc.) and previously failed
            silently, leaving the screen looking "stuck" with no clue why. */}
        {error && (
          <div className="print-hidden bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <p className="text-red-600 text-sm">⚠ {error}</p>
          </div>
        )}

        {/* Kitchen status — per item, with timestamp. Not shown once billed
            (the Bill/Receipt card below covers that case). */}
        {!['billed','cancelled'].includes(order.status) && items.length > 0 && (
          <div className="print-hidden card p-4">
            <p className="font-bold text-sm text-ledger-ink mb-2.5">
              👨‍🍳 {lang === 'hi' ? 'Kitchen Status' : 'Kitchen Status'}
            </p>
            <div className="space-y-1.5">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <span className="text-ledger-ink/80">{it.qty}× {it.item_name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${ITEM_STATUS_COLOR[it.status] || 'text-ledger-inkSoft'}`}>
                      {ITEM_STATUS_LABEL[it.status] || it.status}
                    </span>
                    {it.created_at && (
                      <span className="text-xs text-ledger-inkSoft">
                        {parseServerDate(it.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Itemized Bill Card */}
        <div className="card p-4">
          {/* Print header (only shows when printing) */}
          <div className="hidden print:block text-center mb-4 border-b border-dashed border-gray-300 pb-4">
            <p className="font-bold text-xl">Receipt</p>
            <p className="text-sm text-gray-600 font-semibold">Bill No: {order.id}</p>
            <p className="text-sm text-gray-600">
              {order.table_no ? `Table ${order.table_no}` : order.customer_name || `Order #${order.id}`}
            </p>
            <p className="text-sm text-gray-500">
              {parseServerDate(order.created_at).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm uppercase tracking-wide text-ledger-red">
              🧾 {lang === 'hi' ? 'Bill / Receipt' : 'Bill / Receipt'}
            </p>
            <div className="text-right print-hidden">
              <p className="text-xs font-semibold text-ledger-ink">Bill No: {order.id}</p>
              <p className="text-xs text-ledger-inkSoft">
                {parseServerDate(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })},{' '}
                {parseServerDate(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-12 text-[11px] font-semibold text-ledger-inkSoft uppercase tracking-wide border-b border-dashed border-gray-200 pb-1.5 mb-2">
            <span className="col-span-5">Item</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-2 text-right">Rate</span>
            <span className="col-span-3 text-right">Amount</span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {order.items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 text-sm items-center">
                <span className="col-span-5 font-medium text-ledger-ink leading-tight">{it.item_name}</span>
                <span className="col-span-2 text-center text-ledger-inkSoft figure">{it.qty}</span>
                <span className="col-span-2 text-right text-ledger-inkSoft figure">{rupee(it.price)}</span>
                <span className="col-span-3 text-right font-semibold figure">{rupee(it.line_total)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t-2 border-ledger-red/20 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-sm uppercase tracking-wide">Total</span>
            <span className="font-display text-2xl font-bold text-ledger-red figure">{rupee(order.total)}</span>
          </div>

          {/* Payment info (shown when billed) */}
          {order.status === 'billed' && order.payment_mode && (
            <div className="mt-2 text-xs text-ledger-inkSoft text-right">
              Paid via {order.payment_mode.toUpperCase()}
            </div>
          )}
        </div>

        {/* Thermal-printer receipt — invisible on screen, only rendered
            when printing on narrow (<=80mm) receipt paper. See index.css. */}
        <div className="thermal-receipt">
          <pre style={{ margin: 0, fontFamily: "'Courier New', Courier, monospace" }}>
            {buildThermalReceipt(order, user?.restaurantName)}
          </pre>
        </div>

        {/* Bill printing is a Basic+ plan feature — Trial shows an upgrade
            prompt instead of a working print button. */}
        {['basic', 'pro'].includes(plan) ? (
          <button onClick={printBill}
            className="print-hidden flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-semibold text-sm">
            🖨 {order.status === 'billed'
              ? (lang === 'hi' ? 'Bill Print Karo' : 'Print Bill')
              : (lang === 'hi' ? 'Bill Preview Print Karo' : 'Print Bill Preview')}
          </button>
        ) : (
          <Link to="/plans"
            className="print-hidden flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gray-200 text-gray-400 font-semibold text-sm">
            🖨 {lang === 'hi' ? 'Bill Print — Basic+ Plan' : 'Bill Print — Basic+ Plan'}
          </Link>
        )}

        {/* Add Items button — open/preparing/ready orders */}
        {canAddItems && (
          <Link to={`/orders/${id}/add-items`}
            className="print-hidden flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-ledger-red text-ledger-red font-semibold text-sm">
            ＋ {lang === 'hi' ? 'Aur Items Joṛo' : 'Add More Items'}
          </Link>
        )}

        {/* Kitchen workflow — driven by item-level status so a partially
            served order still surfaces the right next action */}
        {hasOpen && (
          <button onClick={() => updateStatus('preparing')} disabled={submitting}
            className="print-hidden w-full py-3 rounded-xl bg-blue-600 text-white font-semibold shadow">
            👨‍🍳 {lang === 'hi' ? 'Accept — Banana Shuru Karo' : 'Accept — Start Preparing'}
          </button>
        )}

        {hasPreparing && (
          <button onClick={() => updateStatus('ready')} disabled={submitting}
            className="print-hidden w-full py-3 rounded-xl bg-green-600 text-white font-semibold shadow">
            ✓ {lang === 'hi' ? 'Ready Hai — Serve Karo' : 'Mark as Ready'}
          </button>
        )}

        {hasReady && user?.role === 'waiter' && (
          <button onClick={markServed} disabled={submitting}
            className="print-hidden w-full py-3 rounded-xl bg-green-100 text-green-700 font-semibold">
            🛎 {lang === 'hi' ? 'Serve Ho Gaya — Mark Karein' : 'Mark as Served'}
          </button>
        )}

        {/* Billing */}
        {canBill && (
          <div className="print-hidden card p-4">
            <p className="font-bold text-sm mb-3 text-ledger-ink">
              💳 {lang === 'hi' ? 'Payment Method Chunein' : 'Select Payment Method'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => pay('cash')} disabled={submitting}
                className="py-3 rounded-xl bg-ledger-sage text-white font-bold text-sm shadow disabled:opacity-60">
                💵 {lang === 'hi' ? 'Cash' : 'Cash'}
              </button>
              <button onClick={() => pay('upi')} disabled={submitting}
                className="py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow disabled:opacity-60">
                📱 UPI
              </button>
              <button onClick={() => pay('credit')} disabled={submitting}
                className="py-3 rounded-xl bg-ledger-rust text-white font-bold text-sm shadow disabled:opacity-60">
                📒 {lang === 'hi' ? 'Khata' : 'Credit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
