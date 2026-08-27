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
// Evitamos el típico crema+terracota genérico: aquí usamos un
// marrón "corteza horneada" profundo + un ámbar "miel" como acento,
// sobre un fondo cálido tipo harina, distinto del cliché #D97757.
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

// Redondea a 2 decimales para evitar arrastrar errores de coma
// flotante (ej. 1.5 - 0.5 = 0.9999999998) al sumar/restar cantidades.
const roundQty = (n) => Math.round(n * 100) / 100;

// Solo la categoría "Panadería" admite cantidades fraccionadas (1.5, 2.5...).
const isFractionable = (category) => category === 'Panadería';

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};
const isSameDay = (iso, ref) => {
  const a = new Date(iso), b = ref;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Utilidades para KPIs
const pctChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const median = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function computeCartTotals(cart) {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const subtotalSinIgv = total / (1 + IGV_RATE);
  const igv = total - subtotalSinIgv;
  return { total, subtotalSinIgv, igv };
}

function docPrefix(docType) {
  if (docType === 'Boleta') return 'B001';
  if (docType === 'Factura') return 'F001';
  return 'NV01';
}

// ============================================================
// TOAST simple
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
// TICKET DE IMPRESIÓN — versión "comanda de despacho": rápido de
// leer para quien prepara el pedido. Todo el detalle fiscal (fecha,
// IGV, pago, vuelto, etc.) se sigue guardando en el sistema — solo
// no se imprime en este papel, para que salga corto y rápido.
// ============================================================
function Ticket({ sale, business }) {
  if (!sale) return null;
  return (
    <div
      id="print-ticket"
      style={{
        // Rollo térmico de 58mm: el área imprimible real ronda los 48-50mm
        // (el rollo mide 58mm pero los mecanismos de casi todas las
        // impresoras de este tipo, incluida la Xprinter de la foto, no
        // imprimen hasta el borde físico).
        width: '50mm',
        margin: '0 auto',
        fontFamily: "Arial, Helvetica, sans-serif",
        color: '#000',
        padding: '2mm 1mm',
      }}
    >
      <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '20px', letterSpacing: '0.3px' }}>
        {business.name}
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '11px', margin: '3px 0 6px' }}>
        N.º {sale.docNumber}
      </div>
      <div style={{ borderTop: '2px dashed #000', margin: '4px 0 6px' }} />
      {sale.items.map((it, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            fontWeight: 800,
            fontSize: '17px',
            lineHeight: 1.25,
            padding: '4px 0',
            borderBottom: i < sale.items.length - 1 ? '1px dashed #999' : 'none',
          }}
        >
          <span style={{ flexShrink: 0 }}>{it.qty}x</span>
          <span style={{ textTransform: 'uppercase' }}>{it.name}</span>
        </div>
      ))}
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
// TARJETA MÉTRICA
// ============================================================
function MetricCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: C.textFaint }}>{label}</span>
        {Icon && <Icon size={16} style={{ color: color || C.accent }} />}
      </div>
      <div className="text-2xl font-bold" style={{ color: C.text }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.textSoft }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// PESTAÑA: VENDER (catálogo + carrito)
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

  // Solo para productos de Panadería: permite escribir directamente
  // una cantidad fraccionada como 1.5 o 2.5.
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
      {/* Catálogo */}
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
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-10 text-sm" style={{ color: C.textFaint }}>
              No se encontraron productos.
            </div>
          )}
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

          {docType !== 'Nota de venta' && (
            <div className="grid grid-cols-2 gap-1.5">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cliente (opcional)"
                className="px-2 py-1.5 rounded-md text-xs outline-none"
                style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text }}
              />
              <input
                value={customerDoc}
                onChange={(e) => setCustomerDoc(e.target.value)}
                placeholder={docType === 'Factura' ? 'RUC' : 'DNI (opcional)'}
                className="px-2 py-1.5 rounded-md text-xs outline-none"
                style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text }}
              />
            </div>
          )}

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

          {paymentMethod === 'Efectivo' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.10"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="Monto recibido (opcional)"
                className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text }}
              />
              {cashEntered && (
                <div className="text-xs whitespace-nowrap" style={{ color: C.textSoft }}>
                  Vuelto: <span className="font-bold" style={{ color: C.green }}>{money(change)}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1 pt-1" style={{ borderTop: `1px dashed ${C.borderStrong}` }}>
            <div className="flex justify-between text-xs" style={{ color: C.textSoft }}>
              <span>Op. gravada</span><span>{money(totals.subtotalSinIgv)}</span>
            </div>
            <div className="flex justify-between text-xs" style={{ color: C.textSoft }}>
              <span>IGV (18%)</span><span>{money(totals.igv)}</span>
            </div>
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
  const lowStockCount = products.filter((p) => p.active && p.stock <= LOW_STOCK_THRESHOLD).length;

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
        <div className="flex items-center gap-2">
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: C.honeySoft, color: C.honey }}>
              <AlertTriangle size={13} /> {lowStockCount} con stock bajo
            </span>
          )}
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: C.accent }}
          >
            <PlusCircle size={15} /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr style={{ backgroundColor: C.surfaceAlt }}>
                {['Producto', 'Categoría', 'Precio', 'Costo', 'Margen', 'Stock', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100) : 0;
                const low = p.stock <= LOW_STOCK_THRESHOLD;
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: C.text, textTransform: 'uppercase' }}>{p.name}</div>
                      <div className="text-xs" style={{ color: C.textFaint }}>{p.sku}</div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: C.textSoft }}>{p.category}</td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: C.text }}>{money(p.price)}</td>
                    <td className="px-3 py-2.5" style={{ color: C.textSoft }}>{money(p.cost)}</td>
                    <td className="px-3 py-2.5" style={{ color: C.green }}>{margin.toFixed(0)}%</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: low ? C.redSoft : C.greenSoft, color: low ? C.red : C.green }}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => onEdit(p)}><Edit2 size={14} style={{ color: C.textSoft }} /></button>
                        <button onClick={() => onDelete(p)}><Trash2 size={14} style={{ color: C.red }} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-sm" style={{ color: C.textFaint }}>Sin productos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: FORMULARIO DE PRODUCTO
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
      // Solo Panadería admite stock fraccionado (1.5, 2.5...); el resto
      // de categorías se redondea a un número entero de unidades.
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
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: C.textSoft }}>Nombre</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ border: `1px solid ${C.border}`, textTransform: 'uppercase' }}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" />
            <div className="text-xs mt-1" style={{ color: C.textFaint }}>Se guarda en MAYÚSCULAS automáticamente.</div>
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
              <label className="text-xs font-medium" style={{ color: C.textSoft }}>Stock {fractionable && <span style={{ color: C.honey }}>(admite .5)</span>}</label>
              <input type="number" step={fractionable ? '0.5' : '1'} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: C.textSoft }}>SKU / código (opcional)</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }} />
          </div>
          {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>Cancelar</button>
            <button onClick={submit} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.accent }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PESTAÑA: MÉTRICAS
// ============================================================
// ============================================================
// CANDADO DE ACCESO — protege la pestaña de Métricas con contraseña
// ============================================================
function MetricsLock({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (pw === METRICS_PASSWORD) {
      setError('');
      onUnlock();
    } else {
      setError('Contraseña incorrecta.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: C.accentSoft }}>
        <Lock size={20} style={{ color: C.accent }} />
      </div>
      <div className="text-sm font-semibold" style={{ color: C.text }}>Sección privada</div>
      <div className="text-xs mb-1" style={{ color: C.textSoft }}>Ingresa la contraseña para ver las métricas.</div>
      <div className="flex gap-2">
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Contraseña"
          autoFocus
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${error ? C.red : C.border}`, width: 180 }}
        />
        <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.accent }}>
          Entrar
        </button>
      </div>
      {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
    </div>
  );
}

// ============================================================
// Encabezado de sección reutilizable dentro de Métricas
// ============================================================
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <Icon size={16} style={{ color: C.accent }} />
      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: C.text }}>{title}</span>
      {subtitle && <span className="text-xs" style={{ color: C.textFaint }}>· {subtitle}</span>}
    </div>
  );
}

// Insignia de crecimiento (▲/▼ X%) comparado con el período anterior
function GrowthBadge({ pct }) {
  if (!Number.isFinite(pct)) return null;
  const positive = pct >= 0;
  return (
    <span className="inline-flex items-center gap-0.5" style={{ color: positive ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// Insignia de clase ABC (análisis de Pareto)
function ClassBadge({ clase }) {
  const cfg = {
    A: { bg: C.greenSoft, color: C.green },
    B: { bg: C.honeySoft, color: C.honey },
    C: { bg: C.surfaceAlt, color: C.textSoft },
  }[clase];
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{clase}</span>
  );
}

function MetricasTab({ sales, products }) {
  const today = new Date();
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  // ---------- Ventas hoy / semana / mes + comparación con período anterior ----------
  const salesToday = sales.filter((s) => isSameDay(s.date, today));
  const totalToday = salesToday.reduce((s, x) => s + x.total, 0);
  const salesYesterday = sales.filter((s) => isSameDay(s.date, daysAgo(1)));
  const totalYesterday = salesYesterday.reduce((s, x) => s + x.total, 0);
  const growthDay = pctChange(totalToday, totalYesterday);

  const last7Start = daysAgo(6);
  const prev7Start = daysAgo(13);
  const salesWeek = sales.filter((s) => new Date(s.date) >= last7Start);
  const totalWeek = salesWeek.reduce((s, x) => s + x.total, 0);
  const salesPrevWeek = sales.filter((s) => { const d = new Date(s.date); return d >= prev7Start && d < last7Start; });
  const totalPrevWeek = salesPrevWeek.reduce((s, x) => s + x.total, 0);
  const growthWeek = pctChange(totalWeek, totalPrevWeek);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const salesMonth = sales.filter((s) => new Date(s.date) >= monthStart);
  const totalMonth = salesMonth.reduce((s, x) => s + x.total, 0);
  const salesPrevMonth = sales.filter((s) => { const d = new Date(s.date); return d >= prevMonthStart && d < monthStart; });
  const totalPrevMonth = salesPrevMonth.reduce((s, x) => s + x.total, 0);
  const growthMonth = pctChange(totalMonth, totalPrevMonth);

  const avgTicket = sales.length > 0 ? sales.reduce((s, x) => s + x.total, 0) / sales.length : 0;
  const medianTicket = median(sales.map((s) => s.total));

  // ---------- Canasta promedio (ítems por venta) ----------
  const totalItemsSold = sales.reduce((s, x) => s + x.items.reduce((a, it) => a + it.qty, 0), 0);
  const avgBasketSize = sales.length > 0 ? totalItemsSold / sales.length : 0;

  // ---------- Margen bruto (últimos 30 días, con el costo actual de cada producto) ----------
  const last30Start = daysAgo(29);
  const sales30 = sales.filter((s) => new Date(s.date) >= last30Start);
  let revenue30 = 0, cost30 = 0;
  sales30.forEach((s) => s.items.forEach((it) => {
    revenue30 += it.qty * it.price;
    const prod = productById[it.productId];
    cost30 += it.qty * (prod ? prod.cost : 0);
  }));
  const grossProfit30 = revenue30 - cost30;
  const grossMarginPct30 = revenue30 > 0 ? (grossProfit30 / revenue30) * 100 : 0;

  // ---------- Rotación de inventario (30 días) ----------
  const avgInventoryValue = products.filter((p) => p.active).reduce((s, p) => s + p.stock * p.cost, 0);
  const turnover30 = avgInventoryValue > 0 ? cost30 / avgInventoryValue : 0;
  const turnoverAnnualized = turnover30 * (365 / 30);

  // ---------- Ventas por hora del día (horas pico) ----------
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}h`, ventas: 0, transacciones: 0 }));
  sales.forEach((s) => {
    const h = new Date(s.date).getHours();
    hourBuckets[h].ventas += s.total;
    hourBuckets[h].transacciones += 1;
  });
  const peakHour = hourBuckets.reduce((max, b) => (b.ventas > max.ventas ? b : max), hourBuckets[0]);
  const hourChartData = hourBuckets.map((b) => ({ ...b, ventas: Number(b.ventas.toFixed(2)) }));

  // ---------- Ventas por día de la semana ----------
  const dowBuckets = DOW_LABELS.map((label, i) => ({ dow: i, label: label.slice(0, 3), ventas: 0, transacciones: 0 }));
  sales.forEach((s) => {
    const d = new Date(s.date).getDay();
    dowBuckets[d].ventas += s.total;
    dowBuckets[d].transacciones += 1;
  });
  const dowOrdered = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ ...dowBuckets[i], ventas: Number(dowBuckets[i].ventas.toFixed(2)) }));
  const peakDow = dowBuckets.reduce((max, b) => (b.ventas > max.ventas ? b : max), dowBuckets[0]);

  // ---------- Ventas de los últimos 7 días (tendencia) ----------
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = daysAgo(6 - i);
    const dayLabel = d.toLocaleDateString('es-PE', { weekday: 'short' });
    const total = sales.filter((s) => isSameDay(s.date, d)).reduce((s, x) => s + x.total, 0);
    return { day: dayLabel, ventas: Number(total.toFixed(2)) };
  });

  // ---------- Productos: por cantidad, por ingresos, ABC/Pareto, sin movimiento ----------
  const productTotals = {};
  sales.forEach((s) => s.items.forEach((it) => {
    if (!productTotals[it.productId]) productTotals[it.productId] = { productId: it.productId, name: it.name, cantidad: 0, ingresos: 0 };
    productTotals[it.productId].cantidad += it.qty;
    productTotals[it.productId].ingresos += it.qty * it.price;
  }));
  const topByQty = Object.values(productTotals).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6);
  const topByRevenue = [...Object.values(productTotals)].sort((a, b) => b.ingresos - a.ingresos).slice(0, 6);

  const productsByRevenue = Object.values(productTotals).sort((a, b) => b.ingresos - a.ingresos);
  const totalRevenueAll = productsByRevenue.reduce((s, p) => s + p.ingresos, 0);
  let cumulative = 0;
  const abcRows = productsByRevenue.map((p) => {
    cumulative += p.ingresos;
    const cumPct = totalRevenueAll > 0 ? (cumulative / totalRevenueAll) * 100 : 0;
    const clase = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
    return { ...p, pct: totalRevenueAll > 0 ? (p.ingresos / totalRevenueAll) * 100 : 0, cumPct, clase };
  });
  const countA = abcRows.filter((r) => r.clase === 'A').length;

  const soldProductIds30 = new Set();
  sales30.forEach((s) => s.items.forEach((it) => soldProductIds30.add(it.productId)));
  const deadStock = products.filter((p) => p.active && p.stock > 0 && !soldProductIds30.has(p.id));

  // ---------- Cobertura de stock (días hasta quedarse sin stock, al ritmo actual) ----------
  const dailyQtyByProduct = {};
  sales30.forEach((s) => s.items.forEach((it) => {
    dailyQtyByProduct[it.productId] = (dailyQtyByProduct[it.productId] || 0) + it.qty;
  }));
  Object.keys(dailyQtyByProduct).forEach((pid) => { dailyQtyByProduct[pid] = dailyQtyByProduct[pid] / 30; });
  const coverage = products
    .filter((p) => p.active && (dailyQtyByProduct[p.id] || 0) > 0)
    .map((p) => {
      const dailyRate = dailyQtyByProduct[p.id];
      return { id: p.id, name: p.name, stock: p.stock, dailyRate, days: p.stock / dailyRate };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  // ---------- Stock bajo ----------
  const lowStock = products.filter((p) => p.active && p.stock <= LOW_STOCK_THRESHOLD);

  // ---------- Ranking de vendedores ----------
  const bySeller = {};
  sales.forEach((s) => {
    if (!bySeller[s.seller]) bySeller[s.seller] = { seller: s.seller, ventas: 0, transacciones: 0 };
    bySeller[s.seller].ventas += s.total;
    bySeller[s.seller].transacciones += 1;
  });
  const sellerRanking = Object.values(bySeller)
    .map((x) => ({ ...x, ticketProm: x.transacciones > 0 ? x.ventas / x.transacciones : 0 }))
    .sort((a, b) => b.ventas - a.ventas);

  // ---------- Por método de pago y por tipo de documento ----------
  const byPayment = {};
  sales.forEach((s) => { byPayment[s.paymentMethod] = (byPayment[s.paymentMethod] || 0) + s.total; });
  const paymentData = Object.entries(byPayment).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const byDocType = {};
  sales.forEach((s) => { byDocType[s.docType] = (byDocType[s.docType] || 0) + s.total; });
  const docTypeData = Object.entries(byDocType).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const emptyState = (
    <div className="h-full flex items-center justify-center text-xs" style={{ color: C.textFaint }}>Aún no hay suficientes ventas.</div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* ============ RESUMEN GENERAL ============ */}
      <SectionHeader icon={BarChart3} title="Resumen general" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Ventas de hoy" value={money(totalToday)} icon={DollarSign} color={C.accent}
          sub={<span className="flex items-center gap-1.5">{salesToday.length} tickets <GrowthBadge pct={growthDay} /></span>} />
        <MetricCard label="Últimos 7 días" value={money(totalWeek)} icon={TrendingUp} color={C.honey}
          sub={<span className="flex items-center gap-1.5">{salesWeek.length} tickets <GrowthBadge pct={growthWeek} /></span>} />
        <MetricCard label="Este mes" value={money(totalMonth)} icon={BarChart3} color={C.green}
          sub={<span className="flex items-center gap-1.5">{salesMonth.length} tickets <GrowthBadge pct={growthMonth} /></span>} />
        <MetricCard label="Ticket promedio" value={money(avgTicket)} icon={Receipt} color={C.accentDark}
          sub={`Mediana: ${money(medianTicket)}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Margen bruto (30 días)" value={`${grossMarginPct30.toFixed(0)}%`} icon={Percent} color={C.green}
          sub={`${money(grossProfit30)} de utilidad`} />
        <MetricCard label="Canasta promedio" value={avgBasketSize.toFixed(1)} icon={ShoppingBasket} color={C.honey}
          sub="ítems por venta" />
        <MetricCard label="Rotación de inventario" value={`${turnover30.toFixed(2)}x`} icon={Repeat} color={C.accent}
          sub={`≈ ${turnoverAnnualized.toFixed(1)}x al año`} />
        <MetricCard label="Ventas totales" value={sales.length} icon={Receipt} color={C.accentDark}
          sub="tickets registrados" />
      </div>

      {/* ============ PATRONES DE VENTA ============ */}
      <SectionHeader icon={Clock} title="Patrones de venta" subtitle="para planificar turnos y personal" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: C.text }}>Ventas por hora del día</div>
            {sales.length > 0 && <div className="text-xs font-bold" style={{ color: C.accent }}>Hora pico: {peakHour.label}</div>}
          </div>
          <div style={{ height: 200 }}>
            {sales.length === 0 ? emptyState : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.textSoft }} axisLine={{ stroke: C.border }} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: C.textSoft }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="ventas" fill={C.accent} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold" style={{ color: C.text }}>Ventas por día de la semana</div>
            {sales.length > 0 && <div className="text-xs font-bold" style={{ color: C.accent }}>Mejor día: {DOW_LABELS[peakDow.dow]}</div>}
          </div>
          <div style={{ height: 200 }}>
            {sales.length === 0 ? emptyState : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowOrdered}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.textSoft }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="ventas" fill={C.honey} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Tendencia — últimos 7 días</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartDays}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
              <Line type="monotone" dataKey="ventas" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ PRODUCTOS ============ */}
      <SectionHeader icon={Package} title="Productos" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Más vendidos (por cantidad)</div>
          <div style={{ height: 200 }}>
            {topByQty.length === 0 ? emptyState : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByQty} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: C.textSoft }} axisLine={false} tickLine={false} tickFormatter={(n) => n.toUpperCase()} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="cantidad" fill={C.honey} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Más rentables (por ingresos)</div>
          <div style={{ height: 200 }}>
            {topByRevenue.length === 0 ? emptyState : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topByRevenue} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: C.textSoft }} axisLine={false} tickLine={false} tickFormatter={(n) => n.toUpperCase()} />
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <Bar dataKey="ingresos" fill={C.green} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-1.5 text-sm font-semibold mb-1" style={{ color: C.text }}>
          <Layers size={15} style={{ color: C.accent }} /> Análisis ABC (Pareto)
        </div>
        {abcRows.length === 0 ? (
          <div className="text-xs py-3" style={{ color: C.textFaint }}>Aún no hay suficientes ventas para este análisis.</div>
        ) : (
          <>
            <div className="text-xs mb-3" style={{ color: C.textSoft }}>
              <span className="font-bold" style={{ color: C.green }}>{countA}</span> de {abcRows.length} productos (clase A) generan el 80% de tus ingresos. Prioriza su stock y calidad.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 480 }}>
                <thead>
                  <tr style={{ backgroundColor: C.surfaceAlt }}>
                    {['Clase', 'Producto', 'Ingresos', '% del total', '% acumulado'].map((h) => (
                      <th key={h} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {abcRows.slice(0, 10).map((r) => (
                    <tr key={r.productId} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td className="px-2 py-1.5"><ClassBadge clase={r.clase} /></td>
                      <td className="px-2 py-1.5" style={{ color: C.text, textTransform: 'uppercase' }}>{r.name}</td>
                      <td className="px-2 py-1.5" style={{ color: C.text }}>{money(r.ingresos)}</td>
                      <td className="px-2 py-1.5" style={{ color: C.textSoft }}>{r.pct.toFixed(1)}%</td>
                      <td className="px-2 py-1.5" style={{ color: C.textSoft }}>{r.cumPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {deadStock.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: C.text }}>
            <AlertTriangle size={15} style={{ color: C.red }} /> Productos sin movimiento (últimos 30 días)
          </div>
          <div className="text-xs mb-2" style={{ color: C.textSoft }}>Tienen stock pero no se han vendido en un mes — revisa si conviene bajar su precio, promocionarlos o dejar de reponerlos.</div>
          <div className="flex flex-wrap gap-1.5">
            {deadStock.map((p) => (
              <span key={p.id} className="px-2 py-1 rounded-lg text-xs" style={{ backgroundColor: C.redSoft, color: C.red, textTransform: 'uppercase' }}>{p.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* ============ INVENTARIO ============ */}
      <SectionHeader icon={AlertTriangle} title="Inventario" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: C.text }}>
            <AlertTriangle size={15} style={{ color: C.honey }} /> Stock bajo (≤ {LOW_STOCK_THRESHOLD} unidades)
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lowStock.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>Todo el inventario está en buen nivel.</div>}
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span style={{ color: C.text, textTransform: 'uppercase' }}>{p.name}</span>
                <span className="font-bold px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: C.redSoft, color: C.red }}>{p.stock} und.</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-1" style={{ color: C.text }}>
            <Calendar size={15} style={{ color: C.accent }} /> Cobertura de stock
          </div>
          <div className="text-xs mb-2" style={{ color: C.textSoft }}>Días hasta agotarse, al ritmo de venta de los últimos 30 días.</div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {coverage.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>Sin datos suficientes todavía.</div>}
            {coverage.map((c) => {
              const urgent = c.days < 7;
              const warn = c.days >= 7 && c.days < 15;
              return (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: C.text, textTransform: 'uppercase' }}>{c.name}</span>
                  <span className="font-bold px-2 py-0.5 rounded-full text-xs" style={{
                    backgroundColor: urgent ? C.redSoft : warn ? C.honeySoft : C.greenSoft,
                    color: urgent ? C.red : warn ? C.honey : C.green,
                  }}>
                    {c.days < 100 ? `${c.days.toFixed(0)} días` : '90+ días'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============ EQUIPO Y PAGOS ============ */}
      <SectionHeader icon={Users} title="Equipo y pagos" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: C.text }}>
            <Award size={15} style={{ color: C.honey }} /> Ranking de vendedores
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sellerRanking.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>Aún no hay ventas.</div>}
            {sellerRanking.map((s, i) => (
              <div key={s.seller} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5" style={{ color: C.text }}>
                  <span className="text-xs font-bold w-4" style={{ color: C.textFaint }}>#{i + 1}</span> {s.seller}
                </span>
                <span className="text-right">
                  <span className="font-bold" style={{ color: C.text }}>{money(s.ventas)}</span>
                  <span className="text-xs ml-1.5" style={{ color: C.textFaint }}>({s.transacciones} · {money(s.ticketProm)} prom.)</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Ventas por método de pago</div>
          <div style={{ height: 190 }}>
            {paymentData.length === 0 ? emptyState : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={(e) => e.name}>
                    {paymentData.map((_, i) => <Cell key={i} fill={C.chart[i % C.chart.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
        <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Ventas por tipo de documento</div>
        <div style={{ height: 180 }}>
          {docTypeData.length === 0 ? emptyState : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={docTypeData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: C.textSoft }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                <Bar dataKey="value" fill={C.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PESTAÑA: HISTORIAL
// ============================================================
function HistorialTab({ sales, onReprint }) {
  const [filterDoc, setFilterDoc] = useState('Todos');
  const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filtered = filterDoc === 'Todos' ? sorted : sorted.filter((s) => s.docType === filterDoc);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {['Todos', ...TIPOS_DOC].map((d) => (
          <button
            key={d}
            onClick={() => setFilterDoc(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: filterDoc === d ? C.accentSoft : C.surface,
              color: filterDoc === d ? C.accent : C.textSoft,
              border: `1px solid ${filterDoc === d ? C.accent : C.border}`,
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr style={{ backgroundColor: C.surfaceAlt }}>
                {['N.º doc', 'Fecha', 'Vendedor', 'Tipo', 'Pago', 'Total', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C.textSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: C.text }}>{s.docNumber}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: C.textSoft }}>{fmtDate(s.date)} {fmtTime(s.date)}</td>
                  <td className="px-3 py-2.5" style={{ color: C.textSoft }}>{s.seller}</td>
                  <td className="px-3 py-2.5" style={{ color: C.textSoft }}>{s.docType}</td>
                  <td className="px-3 py-2.5" style={{ color: C.textSoft }}>{s.paymentMethod}</td>
                  <td className="px-3 py-2.5 font-bold" style={{ color: C.text }}>{money(s.total)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onReprint(s)} className="flex items-center gap-1 text-xs font-medium" style={{ color: C.accent }}>
                      <Printer size={13} /> Reimprimir
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-sm" style={{ color: C.textFaint }}>Sin ventas registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: SELECCIÓN DE VENDEDOR (por dispositivo)
// ============================================================
function SellerModal({ sellers, onSelect }) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(46,36,24,0.55)' }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: C.surface }}>
        <div className="flex items-center gap-2 mb-1">
          <User size={18} style={{ color: C.accent }} />
          <h3 className="font-bold text-base" style={{ color: C.text }}>¿Quién eres?</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: C.textSoft }}>
          Se guarda solo en este dispositivo, para identificar tus ventas en el historial.
        </p>
        {sellers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sellers.map((s) => (
              <button key={s} onClick={() => onSelect(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: C.accentSoft, color: C.accent }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escribe tu nombre"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSelect(name.trim())}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: `1px solid ${C.border}` }}
          />
          <button
            onClick={() => name.trim() && onSelect(name.trim())}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: C.accent }}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: AJUSTES DEL NEGOCIO
// ============================================================
function SettingsModal({ business, onSave, onClose, currentSeller, onChangeSeller }) {
  const [form, setForm] = useState(business);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(46,36,24,0.5)' }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ backgroundColor: C.surface }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: C.text }}>Ajustes del negocio</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.textSoft }} /></button>
        </div>
        <div className="space-y-3">
          {[
            ['name', 'Nombre del negocio'], ['slogan', 'Descripción corta'], ['ruc', 'RUC'],
            ['address', 'Dirección'], ['phone', 'Teléfono'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-medium" style={{ color: C.textSoft }}>{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${C.border}` }}
              />
            </div>
          ))}
          <div className="pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="text-xs font-medium mb-1" style={{ color: C.textSoft }}>Vendedor de este dispositivo</div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: C.text }}>{currentSeller}</span>
              <button onClick={onChangeSeller} className="text-xs font-medium" style={{ color: C.accent }}>Cambiar</button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>Cancelar</button>
            <button onClick={() => onSave(form)} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.accent }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL: VISTA PREVIA DE TICKET
// ============================================================
function TicketModal({ sale, business, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(46,36,24,0.55)' }}>
      <div className="w-full max-w-xs rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: C.surface, maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-bold text-sm" style={{ color: C.text }}>Venta registrada</span>
          <button onClick={onClose}><X size={18} style={{ color: C.textSoft }} /></button>
        </div>

        {/* Resumen para el vendedor (queda en el sistema, no se imprime) */}
        <div className="px-4 py-3 space-y-1" style={{ backgroundColor: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
          <div className="flex justify-between text-sm font-bold" style={{ color: C.text }}>
            <span>Total cobrado</span><span>{money(sale.total)}</span>
          </div>
          <div className="flex justify-between text-xs" style={{ color: C.textSoft }}>
            <span>{sale.docType} · {sale.docNumber}</span><span>{sale.paymentMethod}</span>
          </div>
          {sale.paymentMethod === 'Efectivo' && sale.cashReceived != null && (
            <div className="flex justify-between text-xs" style={{ color: C.textSoft }}>
              <span>Recibido {money(sale.cashReceived)}</span><span>Vuelto {money(sale.change)}</span>
            </div>
          )}
        </div>

        <div className="text-center text-xs pt-2" style={{ color: C.textFaint }}>Esto es lo que se va a imprimir ↓</div>
        <div className="overflow-y-auto p-3" style={{ backgroundColor: '#fff' }}>
          <Ticket sale={sale} business={business} />
        </div>
        <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>Cerrar</button>
          <button
            onClick={() => window.print()}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-1.5"
            style={{ backgroundColor: C.accent }}
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [business, setBusiness] = useState(DEFAULT_BUSINESS);
  const [sellersList, setSellersList] = useState([]);
  const [currentSeller, setCurrentSeller] = useState(null);

  const [activeTab, setActiveTab] = useState('pos');
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [docType, setDocType] = useState('Boleta');
  const [customerName, setCustomerName] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [productModal, setProductModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketModal, setTicketModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastSync, setLastSync] = useState(Date.now());

  const seededRef = useRef(false);
  const toastRef = useRef(null);
  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ---------- Vendedor de este dispositivo (localStorage real) ----------
  useEffect(() => {
    const saved = localStorage.getItem('ddiaz-current-seller');
    if (saved) setCurrentSeller(saved);
  }, []);

  const handleSelectSeller = async (name) => {
    setCurrentSeller(name);
    localStorage.setItem('ddiaz-current-seller', name);
    try {
      await fbAddSeller(name, sellersList);
    } catch (e) {
      // no bloquear el flujo si falla, es un detalle menor
    }
  };

  // ---------- Suscripciones en tiempo real a Firestore ----------
  useEffect(() => {
    let productsLoaded = false;
    let salesLoaded = false;

    const unsubProducts = subscribeProducts(async (items) => {
      if (!seededRef.current && items.length === 0) {
        seededRef.current = true;
        try {
          await seedProductsIfEmpty(SEED_PRODUCTS);
        } catch (e) {
          showToast('No se pudo conectar con la base de datos. Revisa tu configuración de Firebase.', 'error');
          setOffline(true);
        }
        return; // el propio seed disparará este mismo listener de nuevo
      }
      setProducts(items);
      setLastSync(Date.now());
      setOffline(false);
      if (!productsLoaded) { productsLoaded = true; checkReady(); }
    });

    const unsubSales = subscribeSales((items) => {
      setSales(items);
      setLastSync(Date.now());
      if (!salesLoaded) { salesLoaded = true; checkReady(); }
    });

    const unsubBusiness = subscribeBusiness((b) => setBusiness(b || DEFAULT_BUSINESS), DEFAULT_BUSINESS);
    const unsubSellers = subscribeSellers((list) => setSellersList(list || []));

    function checkReady() {
      if (productsLoaded && salesLoaded) setReady(true);
    }

    // Si en 8 segundos no hay respuesta de Firestore, probablemente
    // falta configurar las variables de entorno de Firebase.
    const timeout = setTimeout(() => {
      if (!productsLoaded || !salesLoaded) {
        setOffline(true);
        setReady(true);
      }
    }, 8000);

    return () => {
      unsubProducts(); unsubSales(); unsubBusiness(); unsubSellers();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Checkout (transacción atómica en Firestore) ----------
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const totals = computeCartTotals(cart);
      const cashNum = cashReceived.trim() !== '' ? (parseFloat(cashReceived) || 0) : null;

      const sale = await checkoutSale({
        cart,
        seller: currentSeller,
        docType,
        customerName: customerName.trim(),
        customerDoc: customerDoc.trim(),
        paymentMethod,
        cashReceived: paymentMethod === 'Efectivo' ? cashNum : null,
        totals,
      });

      setCart([]);
      setCustomerName('');
      setCustomerDoc('');
      setCashReceived('');
      setTicketModal(sale);
      showToast('Venta registrada correctamente.');
    } catch (e) {
      showToast(e.message || 'No se pudo registrar la venta. Intenta de nuevo.', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  // ---------- Productos ----------
  const handleSaveProduct = async (product) => {
    const isNew = !products.some((p) => p.id === product.id);
    try {
      await fbSaveProduct(product);
      setProductModal(null);
      showToast(isNew ? 'Producto agregado.' : 'Producto actualizado.');
    } catch (e) {
      showToast('No se pudo guardar el producto.', 'error');
    }
  };

  const handleDeleteProduct = async (product) => {
    try {
      await deleteProductDoc(product.id);
      showToast('Producto eliminado.');
    } catch (e) {
      showToast('No se pudo eliminar el producto.', 'error');
    }
  };

  const handleSaveBusiness = async (form) => {
    try {
      await fbSaveBusiness(form);
      setBusiness(form);
      setSettingsOpen(false);
      showToast('Datos del negocio actualizados.');
    } catch (e) {
      showToast('No se pudo guardar la configuración.', 'error');
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin" style={{ color: C.accent }} />
      </div>
    );
  }

  const secondsAgo = Math.round((Date.now() - lastSync) / 1000);

  return (
    <div style={{ backgroundColor: C.bg, minHeight: '100vh' }} className="p-4">
      <style>{`
        @media print {
          /* Le decimos al navegador el tamaño REAL del rollo térmico
             (58mm de ancho) y que el alto sea automático según el
             contenido — así no imprime una hoja tipo carta con la
             comanda perdida en una esquina y todo lo demás en blanco. */
          @page {
            size: 58mm auto;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden; }
          #print-ticket, #print-ticket * { visibility: visible; }
          #print-ticket {
            position: absolute;
            left: 0;
            top: 0;
            width: 50mm;
            margin: 0;
          }
        }
      `}</style>

      {offline && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium print:hidden" style={{ backgroundColor: C.redSoft, color: C.red }}>
          <WifiOff size={14} />
          No se pudo conectar con la base de datos. Revisa las variables de Firebase en tu despliegue (ver README.md).
        </div>
      )}

      {!currentSeller && <SellerModal sellers={sellersList} onSelect={handleSelectSeller} />}

      {productModal && (
        <ProductModal
          product={productModal.product}
          onSave={handleSaveProduct}
          onClose={() => setProductModal(null)}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          business={business}
          currentSeller={currentSeller}
          onSave={handleSaveBusiness}
          onClose={() => setSettingsOpen(false)}
          onChangeSeller={() => { localStorage.removeItem('ddiaz-current-seller'); setCurrentSeller(null); setSettingsOpen(false); }}
        />
      )}
      {ticketModal && <TicketModal sale={ticketModal} business={business} onClose={() => setTicketModal(null)} />}

      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.accent }}>
            <Store size={20} color="#fff" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight" style={{ color: C.text }}>{business.name}</div>
            <div className="text-xs" style={{ color: C.textFaint }}>{business.slogan}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <NavTabs active={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: C.surfaceAlt, color: C.textFaint }} title="Datos en vivo, sincronizados entre todos los dispositivos">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: offline ? C.red : C.green }} />
            {offline ? 'Sin conexión' : 'En vivo'}
          </div>
          {(activeTab === 'metricas' || activeTab === 'historial') && privateUnlocked && (
            <button
              onClick={() => setPrivateUnlocked(false)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ border: `1px solid ${C.border}`, color: C.textSoft }}
              title="Bloquear de nuevo"
            >
              <LockOpen size={13} /> Bloquear
            </button>
          )}
          {currentSeller && (
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>
              <User size={13} /> {currentSeller}
              <Settings size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="print:hidden">
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
            onAdd={() => setProductModal({ product: null })}
            onEdit={(p) => setProductModal({ product: p })}
            onDelete={handleDeleteProduct}
            search={invSearch} setSearch={setInvSearch}
          />
        )}
        {activeTab === 'metricas' && (
          privateUnlocked
            ? <MetricasTab sales={sales} products={products} />
            : <MetricsLock onUnlock={() => setPrivateUnlocked(true)} />
        )}
        {activeTab === 'historial' && (
          privateUnlocked
            ? <HistorialTab sales={sales} onReprint={(s) => setTicketModal(s)} />
            : <MetricsLock onUnlock={() => setPrivateUnlocked(true)} />
        )}
      </div>
    </div>
  );
}
