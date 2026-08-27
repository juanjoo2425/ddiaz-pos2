import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Printer, Search, TrendingUp, Package,
  Receipt, BarChart3, X, Settings, AlertTriangle, RefreshCw, User, Check,
  DollarSign, Store, Edit2, PlusCircle, Lock, LockOpen, WifiOff,
  Clock, Users, Calendar, Percent, Layers, Award, TrendingDown, ShoppingBasket, Repeat
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  subscribeProducts, subscribeSales, subscribeBusiness, subscribeSellers,
  saveProduct as fbSaveProduct, deleteProductDoc, saveBusinessInfo as fbSaveBusiness,
  addSeller as fbAddSeller, seedProductsIfEmpty, checkoutSale,
} from './lib/pos-data';

// ============================================================
// PALETA DE MARCA — D'DIAZ (panadería)
// ============================================================
const C = {
  bg: '#FBF8F3',            // fondo general (harina)
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE3',
  border: '#E4DCC9',
  borderStrong: '#D3C7AA',
  text: '#2E2418',           // marrón espresso
  textSoft: '#7A6C58',
  textFaint: '#A79A85',
  accent: '#8C3A2B',         // ladrillo horneado (acento primario)
  accentDark: '#6E2C20',
  accentSoft: '#F3E1DA',
  honey: '#C9862B',          // ámbar miel (acento secundario / dinero)
  honeySoft: '#FBEDD6',
  green: '#3F6B4C',
  greenSoft: '#E4EFE6',
  red: '#B23B2E',
  redSoft: '#FBE7E3',
  chart: ['#8C3A2B', '#C9862B', '#3F6B4C', '#6E5A9E', '#3E7C8C', '#B25B8C'],
};

const IGV_RATE = 0.18;
const LOW_STOCK_THRESHOLD = 5;
const METRICS_PASSWORD = 'clea25';

const CATEGORIAS = ['Panadería', 'Pastelería', 'Galletas y snacks', 'Bebidas', 'Otros'];
const METODOS_PAGO = ['Efectivo', 'Yape / Plin', 'Tarjeta'];
const TIPOS_DOC = ['Boleta', 'Factura', 'Nota de venta'];

const SEED_PRODUCTS = [
  { id: 'p1', name: 'Pan francés (unidad)', category: 'Panadería', price: 0.40, cost: 0.18, stock: 200, unit: 'unidad', sku: 'PAN-001', active: true },
  { id: 'p2', name: 'Pan de yema', category: 'Panadería', price: 1.00, cost: 0.45, stock: 80, unit: 'unidad', sku: 'PAN-002', active: true },
  { id: 'p3', name: 'Baguette artesanal', category: 'Panadería', price: 6.50, cost: 2.80, stock: 25, unit: 'unidad', sku: 'PAN-003', active: true },
  { id: 'p4', name: 'Torta de chocolate (porción)', category: 'Pastelería', price: 9.50, cost: 3.80, stock: 18, unit: 'unidad', sku: 'PAS-001', active: true },
  { id: 'p5', name: 'Torta tres leches (porción)', category: 'Pastelería', price: 8.50, cost: 3.40, stock: 15, unit: 'unidad', sku: 'PAS-002', active: true },
  { id: 'p6', name: 'Alfajor de maicena', category: 'Galletas y snacks', price: 2.50, cost: 1.00, stock: 60, unit: 'unidad', sku: 'GAL-001', active: true },
  { id: 'p7', name: 'Galletas de avena (paquete x6)', category: 'Galletas y snacks', price: 5.00, cost: 2.10, stock: 30, unit: 'paquete', sku: 'GAL-002', active: true },
  { id: 'p8', name: 'Empanada de pollo', category: 'Panadería', price: 3.50, cost: 1.60, stock: 40, unit: 'unidad', sku: 'PAN-004', active: true },
  { id: 'p9', name: 'Café americano', category: 'Bebidas', price: 4.00, cost: 1.20, stock: 999, unit: 'unidad', sku: 'BEB-001', active: true },
  { id: 'p10', name: 'Chicha morada (vaso)', category: 'Bebidas', price: 3.50, cost: 1.00, stock: 999, unit: 'unidad', sku: 'BEB-002', active: true },
  { id: 'p11', name: 'Queque inglés (porción)', category: 'Pastelería', price: 4.50, cost: 1.80, stock: 22, unit: 'unidad', sku: 'PAS-003', active: true },
  { id: 'p12', name: 'Croissant', category: 'Panadería', price: 3.00, cost: 1.30, stock: 4, unit: 'unidad', sku: 'PAN-005', active: true },
];

const DEFAULT_BUSINESS = {
  name: "D'DIAZ",
  slogan: 'Panadería y pastelería',
  ruc: '20000000001',
  address: 'Trujillo, La Libertad, Perú',
  phone: '999 999 999',
};

// ============================================================
// UTILIDADES
// ============================================================
const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const money = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return `S/ ${v.toFixed(2)}`;
};

const roundQty = (n) => Math.round(n * 100) / 100;
const isFractionable = (category) => category === 'Panadería';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

function computeCartTotals(cart) {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const subtotalSinIgv = total / (1 + IGV_RATE);
  const igv = total - subtotalSinIgv;
  return { total, subtotalSinIgv, igv };
}

// ============================================================
// TOAST SIMPLE
// ============================================================
function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === 'error' ? C.red : toast.type === 'warn' ? C.honey : C.green;
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white flex items-center gap-2 print:hidden"
      style={{ backgroundColor: bg }}
    >
      {toast.type !== 'error' && <Check size={16} />}
      {toast.type === 'error' && <AlertTriangle size={16} />}
      {toast.msg}
    </div>
  );
}

// ============================================================
// TICKET DE IMPRESIÓN (Optimizado para 58mm)
// ============================================================
function Ticket({ sale, business }) {
  if (!sale) return null;
  return (
    <div
      id="printable-ticket"
      style={{
        width: '48mm',
        margin: '0 auto',
        fontFamily: 'monospace',
        color: '#000',
        padding: '2mm 0',
      }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>
        {business?.name || "D'DIAZ"}
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px' }}>
        {business?.slogan || 'Panadería y pastelería'}
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px' }}>
        RUC: {business?.ruc || '20000000001'}
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '4px' }}>
        {business?.address || 'Trujillo, Perú'}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
        {sale.docType || 'Nota de venta'}: {sale.docNumber || 'NV01-0001'}
      </div>
      <div style={{ fontSize: '10px' }}>Fecha: {fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}</div>
      <div style={{ fontSize: '10px' }}>Pago: {sale.paymentMethod || 'Efectivo'}</div>
      {sale.customerName && <div style={{ fontSize: '10px' }}>Cliente: {sale.customerName}</div>}

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {sale.items?.map((it, i) => (
        <div key={i} style={{ fontSize: '11px', marginBottom: '3px' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{it.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>{it.qty} x {money(it.price)}</span>
            <span>{money(it.qty * it.price)}</span>
          </div>
        </div>
      ))}

      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
        <span>TOTAL:</span>
        <span>{money(sale.total)}</span>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0 4px' }} />
      <div style={{ textAlign: 'center', fontSize: '10px' }}>¡Gracias por su compra!</div>
    </div>
  );
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function NavTabs({ active, onChange }) {
  const tabs = [
    { id: 'pos', label: 'Vender', icon: ShoppingCart },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'metricas', label: 'Métricas', icon: BarChart3 },
    { id: 'historial', label: 'Historial', icon: Receipt },
  ];
  return (
    <div className="flex gap-1 print:hidden">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: isActive ? C.accent : 'transparent',
              color: isActive ? '#fff' : C.textSoft,
            }}
          >
            <Icon size={16} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// PESTAÑA: VENDER (Catálogo + Carrito)
// ============================================================
function PosTab({
  products, cart, setCart, search, setSearch, categoryFilter, setCategoryFilter,
  docType, setDocType, customerName, setCustomerName, customerDoc, setCustomerDoc,
  paymentMethod, setPaymentMethod, cashReceived, setCashReceived, onCheckout, checkingOut,
}) {
  const filtered = products.filter((p) => {
    if (!p.active) return false;
    if (categoryFilter !== 'Todas' && p.category !== categoryFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totals = computeCartTotals(cart);
  const cashEntered = cashReceived.trim() !== '';
  const change = paymentMethod === 'Efectivo' && cashEntered ? Math.max(0, (parseFloat(cashReceived) || 0) - totals.total) : null;

  const addToCart = (p) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === p.id);
      const currentQty = existing ? existing.qty : 0;
      if (currentQty + 1 > p.stock) return prev;
      if (existing) {
        return prev.map((it) => it.productId === p.id ? { ...it, qty: roundQty(it.qty + 1) } : it);
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, qty: 1, maxStock: p.stock, category: p.category }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart((prev) => prev
      .map((it) => it.productId === productId ? { ...it, qty: roundQty(Math.min(it.maxStock, Math.max(0, it.qty + delta))) } : it)
      .filter((it) => it.qty > 0));
  };

  const setExactQty = (productId, rawValue) => {
    setCart((prev) => prev.map((it) => {
      if (it.productId !== productId) return it;
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed)) return { ...it, qty: rawValue === '' ? 0.5 : it.qty };
      return { ...it, qty: roundQty(Math.min(it.maxStock, Math.max(0.5, parsed))) };
    }));
  };

  const removeItem = (productId) => setCart((prev) => prev.filter((it) => it.productId !== productId));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {['Todas', ...CATEGORIAS].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: categoryFilter === cat ? C.accentSoft : C.surface,
                  color: categoryFilter === cat ? C.accent : C.textSoft,
                  border: `1px solid ${categoryFilter === cat ? C.accent : C.border}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 content-start">
          {filtered.map((p) => {
            const inCart = cart.find((it) => it.productId === p.id);
            const outOfStock = p.stock <= 0;
            const lowStock = p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;
            return (
              <button
                key={p.id}
                onClick={() => !outOfStock && addToCart(p)}
                disabled={outOfStock}
                className="text-left rounded-xl p-3 transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{
                  backgroundColor: C.surface,
                  border: `1px solid ${inCart ? C.accent : C.border}`,
                  cursor: outOfStock ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="text-sm font-semibold mb-1 leading-tight" style={{ color: C.text, textTransform: 'uppercase' }}>{p.name}</div>
                <div className="text-xs mb-2" style={{ color: C.textFaint }}>{p.category}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: C.accent }}>{money(p.price)}</span>
                  {inCart && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: C.accent }}>
                      {inCart.qty}
                    </span>
                  )}
                </div>
                {outOfStock && <div className="text-xs font-medium mt-1" style={{ color: C.red }}>Sin stock</div>}
                {!outOfStock && lowStock && <div className="text-xs font-medium mt-1" style={{ color: C.honey }}>Quedan {p.stock}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Carrito */}
      <div className="flex flex-col rounded-xl overflow-hidden" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
          <ShoppingCart size={16} style={{ color: C.accent }} />
          <span className="font-semibold text-sm" style={{ color: C.text }}>Carrito ({cart.reduce((s, i) => s + i.qty, 0)})</span>
        </div>

        <div className="flex-1 overflow-y-auto max-h-64 px-3 py-2">
          {cart.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: C.textFaint }}>Toca un producto para agregarlo</div>
          )}
          {cart.map((it) => {
            const fractionable = isFractionable(it.category);
            return (
              <div key={it.productId} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: C.text, textTransform: 'uppercase' }}>{it.name}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>{money(it.price)} c/u</div>
                </div>
                <button onClick={() => changeQty(it.productId, fractionable ? -0.5 : -1)} className="w-6 h-6 flex items-center justify-center rounded-full" style={{ backgroundColor: C.surfaceAlt }}>
                  <Minus size={12} style={{ color: C.text }} />
                </button>
                {fractionable ? (
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={it.maxStock}
                    value={it.qty}
                    onChange={(e) => setExactQty(it.productId, e.target.value)}
                    className="text-xs font-bold w-12 text-center rounded-md outline-none"
                    style={{ color: C.text, border: `1px solid ${C.border}` }}
                  />
                ) : (
                  <span className="text-xs font-bold w-4 text-center" style={{ color: C.text }}>{it.qty}</span>
                )}
                <button onClick={() => changeQty(it.productId, fractionable ? 0.5 : 1)} className="w-6 h-6 flex items-center justify-center rounded-full" style={{ backgroundColor: C.surfaceAlt }}>
                  <Plus size={12} style={{ color: C.text }} />
                </button>
                <button onClick={() => removeItem(it.productId)} className="w-6 h-6 flex items-center justify-center">
                  <Trash2 size={13} style={{ color: C.red }} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 space-y-2.5" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surfaceAlt }}>
          <div className="grid grid-cols-3 gap-1.5">
            {TIPOS_DOC.map((d) => (
              <button
                key={d}
                onClick={() => setDocType(d)}
                className="py-1.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: docType === d ? C.accent : C.surface,
                  color: docType === d ? '#fff' : C.textSoft,
                  border: `1px solid ${docType === d ? C.accent : C.border}`,
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {METODOS_PAGO.map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className="py-1.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: paymentMethod === m ? C.honey : C.surface,
                  color: paymentMethod === m ? '#fff' : C.textSoft,
                  border: `1px solid ${paymentMethod === m ? C.honey : C.border}`,
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="space-y-1 pt-1" style={{ borderTop: `1px dashed ${C.borderStrong}` }}>
            <div className="flex justify-between text-base font-bold" style={{ color: C.text }}>
              <span>TOTAL</span><span>{money(totals.total)}</span>
            </div>
          </div>

          <button
            onClick={onCheckout}
            disabled={cart.length === 0 || checkingOut}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: C.accent }}
          >
            {checkingOut ? <RefreshCw size={15} className="animate-spin" /> : <Receipt size={15} />}
            {checkingOut ? 'Procesando...' : 'Cobrar y emitir ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PESTAÑA: INVENTARIO
// ============================================================
function InventarioTab({ products, onAdd, onEdit, onDelete, search, setSearch }) {
  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.textFaint }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: C.accent }}
        >
          <PlusCircle size={15} /> Nuevo producto
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: C.surfaceAlt }}>
              {['Producto', 'Categoría', 'Precio', 'Costo', 'Stock', 'Acciones'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                <td className="px-3 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 py-2.5">{p.category}</td>
                <td className="px-3 py-2.5">{money(p.price)}</td>
                <td className="px-3 py-2.5">{money(p.cost)}</td>
                <td className="px-3 py-2.5 font-bold">{p.stock}</td>
                <td className="px-3 py-2.5 flex gap-2">
                  <button onClick={() => onEdit(p)}><Edit2 size={14} style={{ color: C.textSoft }} /></button>
                  <button onClick={() => onDelete(p)}><Trash2 size={14} style={{ color: C.red }} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: PRODUCTO
// ============================================================
function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product || {
    name: '', category: CATEGORIAS[0], price: '', cost: '', stock: '', unit: 'unidad', sku: '', active: true,
  });
  const [error, setError] = useState('');
  const fractionable = isFractionable(form.category);

  const submit = () => {
    if (!form.name.trim()) { setError('Ingresa un nombre.'); return; }
    if (form.price === '' || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) { setError('Ingresa un precio válido.'); return; }
    if (form.stock === '' || isNaN(parseFloat(form.stock)) || parseFloat(form.stock) < 0) { setError('Ingresa un stock válido.'); return; }
    onSave({
      ...form,
      id: form.id || genId(),
      name: form.name.trim().toUpperCase(),
      price: parseFloat(form.price),
      cost: parseFloat(form.cost) || 0,
      stock: fractionable ? roundQty(parseFloat(form.stock)) : Math.round(parseFloat(form.stock)),
      active: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(46,36,24,0.5)' }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ backgroundColor: C.surface }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: C.text }}>{product ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textSoft }} /></button>
        </div>
        {error && <div className="text-xs mb-3 text-red-600 font-medium">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: C.textSoft }}>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ border: `1px solid ${C.border}`, textTransform: 'uppercase' }}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: C.textSoft }}>Categoría</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }}>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium" style={{ color: C.textSoft }}>Precio (S/)</label>
              <input type="number" step="0.10" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: C.textSoft }}>Costo (S/)</label>
              <input type="number" step="0.10" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: C.textSoft }}>Stock</label>
              <input type="number" step={fractionable ? '0.5' : '1'} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: C.surfaceAlt, color: C.textSoft }}>Cancelar</button>
          <button onClick={submit} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.accent }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [sales, setSales] = useState([]);
  const [business, setBusiness] = useState(DEFAULT_BUSINESS);

  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [docType, setDocType] = useState('Boleta');
  const [customerName, setCustomerName] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentSale, setCurrentSale] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const totals = computeCartTotals(cart);
      const newSale = {
        id: genId(),
        docType,
        docNumber: `NV01-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName,
        customerDoc,
        paymentMethod,
        items: [...cart],
        total: totals.total,
        createdAt: new Date().toISOString(),
      };

      setSales((prev) => [newSale, ...prev]);
      setCurrentSale(newSale);
      setCart([]);
      setCashReceived('');
      showToast('Venta realizada con éxito');

      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      showToast('Error al procesar venta', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: C.bg, color: C.text }}>
      {/* REGLA CSS DE IMPRESIÓN PARA TICKETS DE 58MM */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ticket, #printable-ticket * {
            visibility: visible !important;
          }
          #printable-ticket {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 48mm !important;
            max-width: 48mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* TICKET (Oculto en pantalla, visible al imprimir) */}
      <div className="hidden print:block">
        <Ticket sale={currentSale} business={business} />
      </div>

      {/* INTERFAZ PRINCIPAL DE LA APP */}
      <div className="max-w-6xl mx-auto p-4 print:hidden">
        <header className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: C.accent }}>{business.name}</h1>
            <p className="text-xs" style={{ color: C.textSoft }}>Sistema de Ventas</p>
          </div>
          <NavTabs active={activeTab} onChange={setActiveTab} />
        </header>

        {activeTab === 'pos' && (
          <PosTab
            products={products} cart={cart} setCart={setCart}
            search={search} setSearch={setSearch}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            docType={docType} setDocType={setDocType}
            customerName={customerName} setCustomerName={setCustomerName}
            customerDoc={customerDoc} setCustomerDoc={setCustomerDoc}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            cashReceived={cashReceived} setCashReceived={setCashReceived}
            onCheckout={handleCheckout} checkingOut={checkingOut}
          />
        )}

        {activeTab === 'inventario' && (
          <InventarioTab
            products={products}
            onAdd={() => { setEditingProduct(null); setShowProductModal(true); }}
            onEdit={(p) => { setEditingProduct(p); setShowProductModal(true); }}
            onDelete={(p) => setProducts((prev) => prev.filter((it) => it.id !== p.id))}
            search={search} setSearch={setSearch}
          />
        )}

        {showProductModal && (
          <ProductModal
            product={editingProduct}
            onSave={(p) => {
              setProducts((prev) => {
                const idx = prev.findIndex((it) => it.id === p.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = p;
                  return copy;
                }
                return [...prev, p];
              });
              setShowProductModal(false);
            }}
            onClose={() => setShowProductModal(false)}
          />
        )}

        <Toast toast={toast} />
      </div>
    </div>
  );
}
