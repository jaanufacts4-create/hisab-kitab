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

  useEffect(() => {
    publicApi.get(`/public/${qrToken}/menu`)
      .then(({ data }) => { setRestaurantName(data.restaurant_name); setMenu(data.items); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [qrToken]);

  const cartItems = menu.filter((m) => cart[m.id] > 0).map((m) => ({ ...m, qty: cart[m.id] }));
  const total = cartItems.reduce((s, it) => s + it.price * it.qty, 0);

  function changeQty(itemId, delta) {
    setCart((c) => ({ ...c, [itemId]: Math.max(0, (c[itemId] || 0) + delta) }));
  }

  async function placeOrder() {
    if (cartItems.length === 0) { setError('Kam se kam ek item chunein'); return; }
    setError(''); setSubmitting(true);
    try {
      const { data } = await publicApi.post(`/public/${qrToken}/orders`, {
        table_no: tableNo,
        items: cartItems.map((it) => ({ menu_item_id: it.id, qty: it.qty })),
      });
      navigate(`/order/${qrToken}/${tableNo}/status/${data.id}`);
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

  const categories = [...new Set(menu.map((m) => m.category || 'Other'))];

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <header style={{ background: 'linear-gradient(135deg,#B91C1C 0%,#7F1D1D 100%)' }}
        className="text-white px-4 pt-6 pb-5 shadow-lg">
        <p className="text-[11px] uppercase tracking-widest text-red-200 font-medium">{restaurantName}</p>
        <h1 className="font-bold text-2xl leading-tight mt-0.5">Table {tableNo}</h1>
        <p className="text-xs text-red-200 mt-1">Apna order khud banayein</p>
      </header>

      <div className="px-4 mt-4 max-w-[480px] mx-auto space-y-4">
        {menu.length === 0 && (
          <p className="text-center text-gray-500 mt-10 text-sm">Menu abhi available nahi hai</p>
        )}
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">{cat}</p>
            <div className="space-y-2">
              {menu.filter((m) => (m.category || 'Other') === cat).map((item) => (
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

      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t-2 border-red-200 px-4 py-3 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{cartItems.length} item(s)</span>
            <span className="font-bold text-red-700 text-xl">{rupee(total)}</span>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button onClick={placeOrder} disabled={submitting}
            className="w-full py-3 rounded-xl bg-red-700 text-white font-bold text-sm shadow disabled:opacity-60">
            {submitting ? 'Order place ho raha hai...' : 'Order Place Karein'}
          </button>
        </div>
      )}
    </div>
  );
}
