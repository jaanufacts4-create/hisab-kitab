import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import publicApi from '../publicApi';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

const STATUS_LABEL = {
  open: 'Order Mil Gaya — Jald Shuru Hoga',
  preparing: 'Ban Raha Hai',
  ready: 'Ready Hai!',
  served: 'Serve Ho Gaya',
  billed: 'Bill Ho Gaya',
};

// Lets the customer keep an eye on their own order after placing it —
// polls every 5s, same pattern as the staff Orders page.
export default function PublicOrderStatus() {
  const { qrToken, tableNo, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  function load() {
    publicApi.get(`/public/${qrToken}/orders/${orderId}`)
      .then(({ data }) => { setOrder(data); setError(''); })
      .catch(() => setError('Order nahi mil raha'));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [qrToken, orderId]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center px-6 text-center text-gray-500">{error}</div>;
  }
  if (!order) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header style={{ background: 'linear-gradient(135deg,#B91C1C 0%,#7F1D1D 100%)' }}
        className="text-white px-4 pt-6 pb-5 shadow-lg">
        <h1 className="font-bold text-2xl">Table {order.table_no}</h1>
        <p className="text-sm text-red-200 mt-1">{STATUS_LABEL[order.status] || order.status}</p>
      </header>

      <div className="px-4 mt-4 max-w-[480px] mx-auto space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Aapka Order</p>
          <div className="space-y-2">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{it.qty}× {it.item_name}</span>
                <span className="text-xs font-semibold text-gray-500">{STATUS_LABEL[it.status] || it.status}</span>
              </div>
            ))}
          </div>
          <div className="border-t-2 border-red-100 mt-3 pt-3 flex justify-between">
            <span className="font-bold text-sm">Total</span>
            <span className="font-bold text-red-700 text-lg">{rupee(order.total)}</span>
          </div>
        </div>

        <Link to={`/order/${qrToken}/${tableNo}`}
          className="block text-center border-2 border-red-700 text-red-700 font-semibold py-3 rounded-xl">
          ＋ Aur Order Karein
        </Link>
      </div>
    </div>
  );
}
