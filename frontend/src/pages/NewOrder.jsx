import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';

function rupee(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({}); // menu_item_id -> qty
  const [tableNo, setTableNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState(null); // null | 'cash' | 'upi' | 'credit'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/menu').then(({ data }) => setMenu(data));
  }, []);

  const cartItems = menu
    .filter((m) => cart[m.id] > 0)
    .map((m) => ({ ...m, qty: cart[m.id] }));
  const total = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  function changeQty(id, delta) {
    setCart((c) => {
      const next = { ...c, [id]: Math.max(0, (c[id] || 0) + delta) };
      return next;
    });
  }

  async function submit(withPayment) {
    if (cartItems.length === 0) {
      setError('Pehle kuch items select karein');
      return;
    }
    if (withPayment === 'credit' && !customerPhone) {
      setError('Khata ke liye customer ka phone number zaroori hai');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const body = {
        table_no: tableNo || null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        items: cartItems.map((it) => ({ menu_item_id: it.id, name: it.name, price: it.price, qty: it.qty })),
      };
      if (withPayment) {
        body.payment = { mode: withPayment, amount: total };
      }
      await api.post('/orders', body);
      navigate('/orders');
    } catch (err) {
      setError(err.response?.data?.error || 'Order save nahi hua, dobara try karein');
    } finally {
      setSubmitting(false);
    }
  }

  const categories = [...new Set(menu.map((m) => m.category || 'Other'))];

  return (
    <div className="min-h-screen ledger-bg pb-32">
      <Header title="Naya Order" />

      <div className="px-4 mt-4 space-y-4">
        <div className="bg-white rounded-xl border border-ledger-red/15 p-3.5 grid grid-cols-2 gap-2.5">
          <input
            placeholder="Table no. (optional)"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-ledger-red/20 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-red/30 col-span-2"
          />
          <input
            placeholder="Customer naam"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-ledger-red/20 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-red/30"
          />
          <input
            placeholder="Phone (khata ke liye)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="px-3 py-2 rounded-lg border border-ledger-red/20 text-sm focus:outline-none focus:ring-2 focus:ring-ledger-red/30"
          />
        </div>

        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-widest text-ledger-inkSoft mb-2">{cat}</p>
            <div className="space-y-2">
              {menu
                .filter((m) => (m.category || 'Other') === cat)
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-ledger-red/15 p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-ledger-inkSoft figure">{rupee(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeQty(item.id, -1)}
                        className="w-7 h-7 rounded-full border border-ledger-red/30 text-ledger-red font-semibold"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-medium figure">{cart[item.id] || 0}</span>
                      <button
                        onClick={() => changeQty(item.id, 1)}
                        className="w-7 h-7 rounded-full bg-ledger-red text-white font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {menu.length === 0 && (
          <p className="text-center text-ledger-inkSoft text-sm mt-8">
            Pehle Menu tab mein items add karein
          </p>
        )}
      </div>

      {/* Sticky checkout bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t-2 border-ledger-red/15 px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ledger-inkSoft">{cartItems.length} item • Total</span>
            <span className="font-display text-xl font-semibold text-ledger-red figure">{rupee(total)}</span>
          </div>
          {error && <p className="text-ledger-rust text-xs">{error}</p>}

          {!paymentMode ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => submit(null)}
                disabled={submitting}
                className="py-2.5 rounded-lg border border-ledger-red text-ledger-red text-sm font-medium disabled:opacity-60"
              >
                Order Save Karein
              </button>
              <button
                onClick={() => setPaymentMode('choose')}
                className="py-2.5 rounded-lg bg-ledger-red text-white text-sm font-medium"
              >
                Bill Banayein
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => submit('cash')}
                  disabled={submitting}
                  className="py-2.5 rounded-lg bg-ledger-sage text-white text-sm font-medium disabled:opacity-60"
                >
                  Cash
                </button>
                <button
                  onClick={() => submit('upi')}
                  disabled={submitting}
                  className="py-2.5 rounded-lg bg-ledger-sage text-white text-sm font-medium disabled:opacity-60"
                >
                  UPI
                </button>
                <button
                  onClick={() => submit('credit')}
                  disabled={submitting}
                  className="py-2.5 rounded-lg bg-ledger-rust text-white text-sm font-medium disabled:opacity-60"
                >
                  Khata
                </button>
              </div>
              <button onClick={() => setPaymentMode(null)} className="w-full text-xs text-ledger-inkSoft py-1">
                ← Wapas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
