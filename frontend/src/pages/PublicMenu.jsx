import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import publicApi from '../publicApi';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

// Customer-facing self-order page — opened by scanning the QR code on the
// table, NOT part of the staff app. No login, no Header/BottomNav from the
// staff UI; this is a deliberately separate, minimal experience.
export default function PublicMenu() {
  const { qrToken, tableNo } = useParams();
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState('');
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [placedOrder, setPlacedOrder] = useState(null); // { id, total }

  useEffect(() => {
    publicApi.get(`/public/${qrToken}/menu`)
      .then(({ data }) => { setRestaurantName(data.restaurant_name); setMenu(data.items); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [qrToken]);

  const cartItems = menu.filter((m) => cart[m.id] > 0).map((m) => ({ ...m, qty: cart[m.id] }));
  const total = cartItems.reduce((s, it) => s + it.price * it.qty, 0);

  const filteredMenu = search.trim()
    ? menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
    : menu;
  const categories = [...new Set(filteredMenu.map((m) => m.category || 'Other'))];

  function changeQty(itemId, delta) {
    setCart((c) => ({ ...c, [itemId]: Math.max(0, (c[itemId] || 0) + delta) }));
  }

  async function confirmOrder() {
    setError(''); setSubmitting(true);
    try {
      const { data } = await publicApi.post(`/public/${qrToken}/orders`, {
        table_no: tableNo,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        items: cartItems.map((it) => ({ menu_item_id: it.id, qty: it.qty })),
      });
      setPlacedOrder({ id: data.id, total: data.total });
      setShowCheckout(false);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
    } catch (err) {
      setError(err.response?.data?.error || 'Order place nahi hua, staff ko bulayein');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading menu...</div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-gray-600">Yeh QR code valid nahi hai, ya self-order abhi available nahi hai. Staff se baat karein.</p>
      </div>
    );
  }

  // ---- Order placed — confirmation screen ----
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5 text-4xl">✓</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Place Ho Gaya!</h1>
        <p className="text-gray-400 text-sm mb-1">Order #{placedOrder.id} · Table {tableNo}</p>
        <p className="text-red-700 font-bold text-xl mb-4">{rupee(placedOrder.total)}</p>
        <p className="text-gray-500 text-sm">Aapka khana jald tayar hoga 🍽️</p>
        <button
          onClick={() => navigate(`/order/${qrToken}/${tableNo}/status/${placedOrder.id}`)}
          className="mt-6 w-full max-w-xs py-3 rounded-xl bg-red-700 text-white font-bold text-sm shadow"
        >
          Order Status Dekho
        </button>
        <button
          onClick={() => setPlacedOrder(null)}
          className="mt-3 w-full max-w-xs py-2.5 rounded-xl border-2 border-red-700 text-red-700 font-semibold text-sm"
        >
          Aur Item Add Karein
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <header style={{ background: 'linear-gradient(135deg,#B91C1C 0%,#7F1D1D 100%)' }}
        className="text-white px-4 pt-6 pb-4 shadow-lg">
        <p className="text-[11px] uppercase tracking-widest text-red-200 font-medium">{restaurantName}</p>
        <h1 className="font-bold text-2xl leading-tight mt-0.5">Table {tableNo}</h1>
        <p className="text-xs text-red-200 mt-1">Apna order khud banayein</p>
        {/* Search bar */}
        <div className="mt-3 relative">
          <input
            type="text"
            placeholder="Menu mein search karein..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl px-4 py-2 text-sm text-gray-800 bg-white/90 placeholder-gray-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl leading-none">×</button>
          )}
        </div>
      </header>

      <div className="px-4 mt-4 max-w-[480px] mx-auto space-y-4">
        {filteredMenu.length === 0 && (
          <p className="text-center text-gray-500 mt-10 text-sm">
            {search ? `"${search}" nahi mila` : 'Menu abhi available nahi hai'}
          </p>
        )}
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">{cat}</p>
            <div className="space-y-2">
              {filteredMenu.filter((m) => (m.category || 'Other') === cat).map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{rupee(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => changeQty(item.id, -1)}
                      className="w-8 h-8 rounded-full border-2 border-red-700 text-red-700 font-bold text-lg flex items-center justify-center">−</button>
                    <span className="w-6 text-center font-bold">{cart[item.id] || 0}</span>
                    <button onClick={() => changeQty(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-red-700 text-white font-bold text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t-2 border-red-200 px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{cartItems.reduce((s, i) => s + i.qty, 0)} item(s)</span>
            <span className="font-bold text-red-700 text-xl">{rupee(total)}</span>
          </div>
          <button onClick={() => { setError(''); setShowCheckout(true); }}
            className="w-full py-3 rounded-xl bg-red-700 text-white font-bold text-sm shadow">
            Order Place Karein →
          </button>
        </div>
      )}

      {/* Checkout confirmation bottom sheet */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCheckout(false); }}>
          <div className="w-full max-w-[480px] bg-white rounded-t-2xl px-4 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">Order Confirm Karein</h2>
              <button onClick={() => setShowCheckout(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            {/* Order summary */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {cartItems.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{it.name} × {it.qty}</span>
                  <span className="text-gray-600 font-medium">{rupee(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-red-700 text-sm">
                <span>Total</span>
                <span>{rupee(total)}</span>
              </div>
            </div>

            {/* Optional name & phone */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Aapki details (optional)</p>
              <input
                type="text"
                placeholder="Naam"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-400"
              />
              <input
                type="tel"
                placeholder="Mobile number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-400"
              />
            </div>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <button onClick={confirmOrder} disabled={submitting}
              className="w-full py-3 rounded-xl bg-red-700 text-white font-bold text-sm shadow disabled:opacity-60">
              {submitting ? 'Order place ho raha hai...' : `Confirm Order — ${rupee(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
