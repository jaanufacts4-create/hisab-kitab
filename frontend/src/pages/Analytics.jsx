import { useEffect, useState } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

// Local-date based (see Dashboard.jsx for why toISOString() is wrong here).
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PRESETS = [['7', '7D'], ['14', '14D'], ['30', '30D']];

function BarChart({ data, valueKey, labelKey, color, formatVal }) {
  if (!data || data.length === 0) return (
    <p className="text-center text-ledger-inkSoft text-sm py-6">No data for this range</p>
  );
  const max = Math.max(...data.map(d => d[valueKey])) || 1;
  const minBarWidth = 30;
  return (
    <div className="overflow-x-auto mt-2 -mx-1 px-1">
      <div className="flex items-end gap-1.5 h-32" style={{ minWidth: data.length * minBarWidth }}>
        {data.map((d, i) => {
          const pct = (d[valueKey] / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ minWidth: minBarWidth - 6 }}>
              <span className="text-ledger-inkSoft leading-none" style={{ fontSize: '9px' }}>
                {formatVal ? formatVal(d[valueKey]) : d[valueKey]}
              </span>
              <div className="w-full rounded-t-sm" style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
              <span className="text-ledger-inkSoft text-center leading-tight" style={{ fontSize: '9px' }}>
                {d[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function fetchRange(from, to) {
    setLoading(true); setError('');
    api.get(`/analytics/summary?from=${from}&to=${to}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setError('Could not load analytics'))
      .finally(() => setLoading(false));
  }

  // Preset ranges fetch automatically
  useEffect(() => {
    if (range === 'custom') return;
    const to = toDateStr(new Date());
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - (parseInt(range) - 1));
    fetchRange(toDateStr(fromD), to);
  }, [range]);

  // Seed sensible defaults the first time "Custom" is opened
  useEffect(() => {
    if (range === 'custom' && !customFrom && !customTo) {
      const to = toDateStr(new Date());
      const fromD = new Date();
      fromD.setDate(fromD.getDate() - 6);
      setCustomFrom(toDateStr(fromD));
      setCustomTo(to);
    }
  }, [range]);

  function applyCustomRange() {
    if (!customFrom || !customTo) return;
    fetchRange(customFrom, customTo);
  }

  // Fill missing days using the server-confirmed from/to so this also
  // works correctly for custom ranges.
  function filledDaily() {
    if (!data) return [];
    const map = {};
    data.daily.forEach(d => { map[d.date] = d; });
    const result = [];
    const start = new Date(data.from + 'T00:00:00');
    const end = new Date(data.to + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d);
      const shortLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const existing = map[ds];
      result.push(existing
        ? { ...existing, label: shortLabel }
        : { date: ds, order_count: 0, revenue: 0, label: shortLabel });
    }
    return result;
  }

  function filledDow() {
    if (!data) return [];
    const map = {};
    data.dow.forEach(d => { map[d.dow] = d; });
    return DOW_LABEL.map((label, i) => ({
      dow: i,
      label,
      order_count: map[i]?.order_count || 0,
      revenue: map[i]?.revenue || 0,
    }));
  }

  const totalRevenue = data?.daily?.reduce((s, d) => s + d.revenue, 0) || 0;
  const totalOrders = data?.daily?.reduce((s, d) => s + d.order_count, 0) || 0;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="min-h-screen ledger-bg pb-24">
      <Header title="Trends & Analytics" />

      <div className="px-4 mt-4 space-y-4">

        {/* Range selector */}
        <div className="flex gap-2">
          {PRESETS.map(([v, label]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                range === v
                  ? 'bg-ledger-red text-white border-ledger-red'
                  : 'bg-white text-ledger-inkSoft border-gray-200'
              }`}>
              {label}
            </button>
          ))}
          <button onClick={() => setRange('custom')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              range === 'custom'
                ? 'bg-ledger-red text-white border-ledger-red'
                : 'bg-white text-ledger-inkSoft border-gray-200'
            }`}>
            &#128197; Custom
          </button>
        </div>

        {/* Custom date range picker */}
        {range === 'custom' && (
          <div className="card p-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-ledger-inkSoft block mb-0.5">From</label>
              <input type="date" value={customFrom} max={customTo || toDateStr(new Date())}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-ledger-inkSoft block mb-0.5">To</label>
              <input type="date" value={customTo} max={toDateStr(new Date())} min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
            </div>
            <button onClick={applyCustomRange}
              className="bg-ledger-red text-white text-xs font-semibold px-4 py-2 rounded-lg shrink-0">
              Go
            </button>
          </div>
        )}

        {loading && <p className="text-center text-ledger-inkSoft py-8">Loading...</p>}
        {error && <p className="text-center text-red-600 py-4">{error}</p>}

        {data && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card p-3 text-center">
                <p className="text-[10px] text-ledger-inkSoft mb-0.5">Revenue</p>
                <p className="font-bold text-ledger-red text-sm figure">{rupee(totalRevenue)}</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] text-ledger-inkSoft mb-0.5">Orders</p>
                <p className="font-bold text-ledger-ink text-sm">{totalOrders}</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] text-ledger-inkSoft mb-0.5">Avg/Order</p>
                <p className="font-bold text-ledger-ink text-sm figure">{rupee(Math.round(avgOrder))}</p>
              </div>
            </div>

            {/* Daily Revenue chart */}
            <div className="card p-4">
              <p className="font-bold text-sm text-ledger-ink mb-1">&#128200; Daily Revenue</p>
              <BarChart
                data={filledDaily()}
                valueKey="revenue"
                labelKey="label"
                color="#B91C1C"
                formatVal={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`}
              />
            </div>

            {/* Day-of-Week pattern */}
            <div className="card p-4">
              <p className="font-bold text-sm text-ledger-ink mb-1">&#128197; Busy Days (Orders by Weekday)</p>
              <p className="text-xs text-ledger-inkSoft mb-2">Kaunsa din sabse zyada orders aata hai</p>
              <BarChart
                data={filledDow()}
                valueKey="order_count"
                labelKey="label"
                color="#D97706"
              />
            </div>

            {/* Top selling items */}
            {data.topItems && data.topItems.length > 0 && (
              <div className="card p-4">
                <p className="font-bold text-sm text-ledger-ink mb-3">&#127942; Top Selling Items</p>
                <div className="space-y-2.5">
                  {data.topItems.map((item, i) => {
                    const maxQty = data.topItems[0].total_qty;
                    const pct = (item.total_qty / maxQty) * 100;
                    return (
                      <div key={item.item_name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-ledger-ink">
                            <span className="text-ledger-inkSoft mr-1.5">#{i + 1}</span>
                            {item.item_name}
                          </span>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-ledger-red figure">{rupee(item.total_revenue)}</span>
                            <span className="text-[10px] text-ledger-inkSoft ml-1">({item.total_qty} pcs)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-ledger-red/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment split */}
            {data.payments && data.payments.length > 0 && (
              <div className="card p-4">
                <p className="font-bold text-sm text-ledger-ink mb-3">&#128179; Payment Mode Split</p>
                <div className="space-y-2">
                  {data.payments.map(p => {
                    const totalPay = data.payments.reduce((s, x) => s + x.total, 0);
                    const pct = totalPay > 0 ? Math.round((p.total / totalPay) * 100) : 0;
                    const colors = { cash: 'bg-green-500', upi: 'bg-blue-500', credit: 'bg-orange-500' };
                    return (
                      <div key={p.payment_mode}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm capitalize text-ledger-ink">{p.payment_mode || 'unknown'}</span>
                          <span className="text-xs text-ledger-inkSoft">{rupee(p.total)} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[p.payment_mode] || 'bg-gray-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
