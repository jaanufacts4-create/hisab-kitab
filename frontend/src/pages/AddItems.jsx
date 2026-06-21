import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Header from '../components/Header';
import { useLang } from '../context/LangContext';

function rupee(n) { return `₹${Number(n || 0).toLocaleString('en-IN')}`; }

export default function AddItems() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLang();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/menu').then(({ data }) => setMenu(data));
  }, []);

  const cartItems = menu.filter(m => cart[m.id] > 0).map(m => ({ ...m, qty: cart[m.id] }));
  const addedTotal = cartItems.reduce((s, it) => s + it.price * it.qty, 0);

  function changeQty(itemId, delta) {
    setCart(c => ({ ...c, [itemId]: Math.max(0, (c[itemId] || 0) + delta) }));
  }

  async function submit() {
    if (cartItems.length === 0) { setError(lang === 'hi' ? 'Kuch items chunein' : 'Select at least one item'); return; }
    setError(''); setSubmitting(true);
    try {
      await api.post(`/orders/${id}/items`, {
        items: cartItems.map(it => ({ menu_item_id: it.id, name: it.name, price: it.price, qty: it.qty }))
      });
      navigate(`/orders/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add items');
    } finally { setSubmitting(false); }
  }

  const categories = [...new Set(menu.map(m => m.category || 'Other'))];

  return (
    <div className="min-h-screen ledger-bg pb-36">
      <Header title={lang === 'hi' ? `Order #${id} — Items Joṛo` : `Order #${id} — Add Items`} />

      <div className="px-4 mt-4 space-y-4">
        {categories.map(cat => (
          <div key={cat}>
            <p className="text-xs uppercase tracking-widest text-ledger-inkSoft font-semibold mb-2">{cat}</p>
            <div className="space-y-2">
              {menu.filter(m => (m.category || 'Other') === cat).map(item => (
                <div key={item.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-xs text-ledger-inkSoft figure">{rupee(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => changeQty(item.id, -1)}
                      className="w-8 h-8 rounded-full border-2 border-ledger-red text-ledger-red font-bold text-lg flex items-center justify-center">−</button>
                    <span className="w-6 text-center font-bold figure">{cart[item.id] || 0}</span>
                    <button onClick={() => changeQty(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-ledger-red text-white font-bold text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t-2 border-ledger-red/20 px-4 py-3 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ledger-inkSoft">{cartItems.length} {lang === 'hi' ? 'item add hoga' : 'item(s) to add'}</span>
            <span className="font-bold text-ledger-red text-xl figure">{rupee(addedTotal)}</span>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate(`/orders/${id}`)}
              className="py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-semibold text-sm">
              {lang === 'hi' ? '← Wapas' : '← Back'}
            </button>
            <button onClick={submit} disabled={submitting}
              className="py-3 rounded-xl bg-ledger-red text-white font-bold text-sm shadow disabled:opacity-60">
              {submitting ? '...' : (lang === 'hi' ? 'Items Joṛo' : 'Add Items')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
