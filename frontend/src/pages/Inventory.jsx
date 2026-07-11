import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

const TABS = ['Stock', 'Items', 'Recipes'];

// Which units are compatible with a given inventory unit
const UNIT_GROUPS = {
  g:   ['g', 'kg'],
  kg:  ['g', 'kg'],
  ml:  ['ml', 'L'],
  l:   ['ml', 'L'],
  L:   ['ml', 'L'],
};
function compatibleUnits(invUnit) {
  return UNIT_GROUPS[(invUnit || '').toLowerCase()] || [invUnit || 'pcs'];
}

// All primary unit options
const ALL_UNITS = ['g', 'kg', 'ml', 'L', 'pcs'];

// Convert qty from one unit to another (client-side, mirrors backend logic)
function convertUnit(qty, fromUnit, toUnit) {
  const n = Number(qty) || 0;
  if (!fromUnit || fromUnit === toUnit) return n;
  const from = fromUnit.toLowerCase();
  const to   = toUnit.toLowerCase();
  if (from === 'g'  && to === 'kg') return n / 1000;
  if (from === 'kg' && to === 'g')  return n * 1000;
  if (from === 'ml' && (to === 'l')) return n / 1000;
  if (from === 'l'  && to === 'ml') return n * 1000;
  return n; // incompatible — store as-is
}

export default function Inventory() {
  const [tab, setTab] = useState('Stock');
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const [invRes, recRes, menuRes] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory/recipes'),
        api.get('/menu'),
      ]);
      setItems(invRes.data);
      setRecipes(recRes.data);
      setMenuItems(menuRes.data.filter(m => m.is_active));
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Unknown error';
      const status = e.response?.status || 'network';
      setErr(`Load failed (${status}): ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-ledger-paper flex items-center justify-center text-ledger-inkSoft">
      Loading…
    </div>
  );

  return (
    <div className="min-h-screen bg-ledger-paper pb-24">
      <Header title="Inventory" />

      {err && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between items-start gap-2">
          <span>{err}</span>
          <button onClick={load} className="shrink-0 text-xs underline font-semibold">Retry</button>
        </div>
      )}

      <div className="flex border-b-2 border-ledger-red/20 mx-4 mt-4">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-ledger-red border-b-2 border-ledger-red -mb-0.5'
                : 'text-ledger-inkSoft'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'Stock'   && <StockTab items={items} />}
        {tab === 'Items'   && <ItemsTab items={items} onRefresh={load} />}
        {tab === 'Recipes' && <RecipesTab recipes={recipes} menuItems={menuItems} items={items} onRefresh={load} />}
      </div>
    </div>
  );
}

function StockTab({ items }) {
  const low = items.filter(i => i.min_stock > 0 && i.stock <= i.min_stock);

  if (!items.length) {
    return <EmptyState text="No raw materials added yet. Go to Items tab to add stock." />;
  }

  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-700 font-semibold text-sm mb-2">Warning: Low Stock ({low.length})</p>
          {low.map(i => (
            <div key={i.id} className="flex justify-between text-sm py-1">
              <span className="text-red-800 font-medium">{i.name}</span>
              <span className="text-red-600">{i.stock} {i.unit} (min {i.min_stock})</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {items.map(i => {
          const pct = i.min_stock > 0 ? Math.min(100, (i.stock / (i.min_stock * 2)) * 100) : 100;
          const isLow = i.min_stock > 0 && i.stock <= i.min_stock;
          return (
            <div key={i.id} className="bg-white border border-ledger-red/10 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-medium text-ledger-ink text-sm">{i.name}</span>
                <span className={`text-sm font-semibold ${isLow ? 'text-red-600' : 'text-green-700'}`}>
                  {i.stock} {i.unit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${isLow ? 'bg-red-400' : 'bg-green-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {i.min_stock > 0 && (
                <p className="text-[10px] text-ledger-inkSoft mt-1">Min: {i.min_stock} {i.unit}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemsTab({ items, onRefresh }) {
  const [form, setForm] = useState({ name: '', unit: 'g', stock: '', stock_unit: 'g', min_stock: '', min_unit: 'g' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function startEdit(item) {
    setEditId(item.id);
    setForm({ name: item.name, unit: item.unit, stock: item.stock, stock_unit: item.unit, min_stock: item.min_stock, min_unit: item.unit });
  }

  function cancelEdit() {
    setEditId(null);
    setForm({ name: '', unit: 'g', stock: '', stock_unit: 'g', min_stock: '', min_unit: 'g' });
  }

  async function save() {
    if (!form.name.trim()) return setMsg('Name required');
    setSaving(true);
    setMsg('');
    try {
      // Convert stock and min_stock to the item's primary unit before saving
      const payload = {
        name: form.name,
        unit: form.unit,
        stock: convertUnit(form.stock, form.stock_unit, form.unit),
        min_stock: convertUnit(form.min_stock, form.min_unit, form.unit),
      };
      if (editId) {
        await api.put(`/inventory/${editId}`, payload);
      } else {
        await api.post('/inventory', payload);
      }
      cancelEdit();
      await onRefresh();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Save failed';
      const status = e.response?.status || 'network';
      setMsg(`Error ${status}: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!confirm('Delete this item? Its recipes will also be removed.')) return;
    try {
      await api.delete(`/inventory/${id}`);
      await onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || 'Delete failed');
    }
  }

  async function adjustStock(item, delta) {
    const newStock = Math.max(0, Number(item.stock) + delta);
    try {
      await api.put(`/inventory/${item.id}`, { stock: newStock });
      await onRefresh();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ledger-red/20 rounded-xl p-4 space-y-3">
        <p className="font-semibold text-sm text-ledger-ink">{editId ? 'Edit Item' : 'Add Raw Material'}</p>

        <input
          className="w-full border border-ledger-red/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger-red"
          placeholder="Name (e.g. Paneer)"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />

        {/* Primary unit */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ledger-inkSoft w-24 shrink-0">Primary unit</span>
          <select
            className="flex-1 border border-ledger-red/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value, stock_unit: e.target.value, min_unit: e.target.value }))}
          >
            {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {/* Stock in hand */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ledger-inkSoft w-24 shrink-0">Stock in hand</span>
          <input
            type="number"
            className="flex-1 border border-ledger-red/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger-red"
            placeholder="e.g. 10"
            value={form.stock}
            onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
          />
          <select
            className="w-16 border border-ledger-red/20 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
            value={form.stock_unit}
            onChange={e => setForm(f => ({ ...f, stock_unit: e.target.value }))}
          >
            {compatibleUnits(form.unit).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {/* Min stock alert */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ledger-inkSoft w-24 shrink-0">Min stock</span>
          <input
            type="number"
            className="flex-1 border border-ledger-red/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger-red"
            placeholder="e.g. 250"
            value={form.min_stock}
            onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
          />
          <select
            className="w-16 border border-ledger-red/20 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
            value={form.min_unit}
            onChange={e => setForm(f => ({ ...f, min_unit: e.target.value }))}
          >
            {compatibleUnits(form.unit).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {msg && <p className="text-red-600 text-xs">{msg}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-ledger-red text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
          </button>
          {editId && (
            <button
              onClick={cancelEdit}
              className="px-4 py-2 rounded-lg border border-ledger-red/30 text-sm text-ledger-inkSoft"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {!items.length
        ? <EmptyState text="No items yet. Add your first raw material above." />
        : items.map(item => (
          <div key={item.id} className="bg-white border border-ledger-red/10 rounded-xl p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm text-ledger-ink">{item.name}</p>
                <p className="text-xs text-ledger-inkSoft">Min: {item.min_stock} {item.unit}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjustStock(item, -10)}
                  className="w-7 h-7 rounded-full border border-ledger-red/20 text-ledger-inkSoft text-sm flex items-center justify-center"
                >
                  -
                </button>
                <span className={`text-sm font-semibold w-20 text-center ${item.stock <= item.min_stock && item.min_stock > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {item.stock} {item.unit}
                </span>
                <button
                  onClick={() => adjustStock(item, 10)}
                  className="w-7 h-7 rounded-full border border-ledger-red/20 text-ledger-inkSoft text-sm flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => startEdit(item)}
                className="text-xs text-ledger-red border border-ledger-red/30 px-3 py-1 rounded-lg"
              >
                Edit
              </button>
              <button
                onClick={() => del(item.id)}
                className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function RecipesTab({ recipes, menuItems, items, onRefresh }) {
  const [selectedMenu, setSelectedMenu] = useState('');
  const [form, setForm] = useState({ inventory_id: '', qty_per_serving: '', qty_unit: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const menuRecipes = recipes.filter(r => String(r.menu_item_id) === String(selectedMenu));

  async function addIngredient() {
    if (!selectedMenu) return setMsg('Select a dish first');
    if (!form.inventory_id || !form.qty_per_serving) return setMsg('Fill all fields');
    setSaving(true);
    setMsg('');
    try {
      await api.post('/inventory/recipes', {
        menu_item_id: Number(selectedMenu),
        inventory_id: Number(form.inventory_id),
        qty_per_serving: Number(form.qty_per_serving),
        qty_unit: form.qty_unit,
      });
      setForm({ inventory_id: '', qty_per_serving: '', qty_unit: '' });
      await onRefresh();
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || 'Save failed';
      const status = e.response?.status || 'network';
      setMsg(`Error ${status}: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }

  async function delRecipe(id) {
    try {
      await api.delete(`/inventory/recipes/${id}`);
      await onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || 'Delete failed');
    }
  }

  if (!items.length) {
    return <EmptyState text="Add raw materials in the Items tab first, then link them to dishes here." />;
  }

  if (!menuItems.length) {
    return <EmptyState text="No menu items found. Add dishes in Menu first." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ledger-red/20 rounded-xl p-4 space-y-3">
        <p className="font-semibold text-sm text-ledger-ink">Link Ingredients to a Dish</p>

        <select
          className="w-full border border-ledger-red/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
          value={selectedMenu}
          onChange={e => { setSelectedMenu(e.target.value); setMsg(''); }}
        >
          <option value="">Select dish</option>
          {menuItems.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {selectedMenu && (
          <>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-ledger-red/20 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
                value={form.inventory_id}
                onChange={e => {
                  const selItem = items.find(i => String(i.id) === e.target.value);
                  setForm(f => ({ ...f, inventory_id: e.target.value, qty_unit: selItem?.unit || '' }));
                }}
              >
                <option value="">Select ingredient</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
              <input
                type="number"
                className="w-20 border border-ledger-red/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ledger-red"
                placeholder="Qty"
                value={form.qty_per_serving}
                onChange={e => setForm(f => ({ ...f, qty_per_serving: e.target.value }))}
              />
              {form.inventory_id && (() => {
                const selItem = items.find(i => String(i.id) === form.inventory_id);
                const units = compatibleUnits(selItem?.unit);
                return (
                  <select
                    className="w-16 border border-ledger-red/20 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-ledger-red"
                    value={form.qty_unit || selItem?.unit || ''}
                    onChange={e => setForm(f => ({ ...f, qty_unit: e.target.value }))}
                  >
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                );
              })()}
            </div>

            {msg && <p className="text-red-600 text-xs">{msg}</p>}

            <button
              onClick={addIngredient}
              disabled={saving}
              className="w-full bg-ledger-red text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : '+ Add Ingredient'}
            </button>

            {menuRecipes.length > 0 && (
              <div className="border-t border-ledger-red/10 pt-3 space-y-2">
                <p className="text-xs text-ledger-inkSoft font-medium">Current recipe:</p>
                {menuRecipes.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-sm">
                    <span className="text-ledger-ink">{r.ingredient_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-ledger-inkSoft">{r.qty_per_serving} {r.qty_unit || r.unit}</span>
                      <button
                        onClick={() => delRecipe(r.id)}
                        className="text-red-400 text-xs border border-red-200 px-2 py-0.5 rounded"
                      >
                        x
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!selectedMenu && menuItems.filter(m => recipes.some(r => r.menu_item_id === m.id)).map(m => {
        const mrs = recipes.filter(r => r.menu_item_id === m.id);
        return (
          <div key={m.id} className="bg-white border border-ledger-red/10 rounded-xl p-3">
            <p
              className="font-medium text-sm text-ledger-red mb-2 cursor-pointer"
              onClick={() => setSelectedMenu(String(m.id))}
            >
              {m.name}
            </p>
            <div className="space-y-1">
              {mrs.map(r => (
                <div key={r.id} className="flex justify-between text-xs text-ledger-inkSoft">
                  <span>{r.ingredient_name}</span>
                  <span>{r.qty_per_serving} {r.qty_unit || r.unit}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!selectedMenu && !recipes.length && (
        <EmptyState text="No recipes yet. Select a dish above to start linking ingredients." />
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-12 text-ledger-inkSoft text-sm px-4">{text}</div>
  );
}
