// ============================================================
// PALETA Y UTILIDADES COMPARTIDAS
// Primer paso de la separación del monolito: todo lo que usan varios
// componentes (App.jsx, CashRegister.jsx, y los que se vayan sacando
// después) vive acá, en un solo lugar, para no duplicar código.
// ============================================================

export const C = {
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

export const IGV_RATE = 0.18;
export const LOW_STOCK_THRESHOLD = 5;

export const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const money = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return `S/ ${v.toFixed(2)}`;
};

// Redondea a 2 decimales para evitar arrastrar errores de coma flotante.
export const roundQty = (n) => Math.round(n * 100) / 100;

export const isFractionable = (category) => category === 'Panadería';

export const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

export const isSameDay = (iso, ref) => {
  const a = new Date(iso), b = ref;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const pctChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const median = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function computeCartTotals(cart) {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const subtotalSinIgv = total / (1 + IGV_RATE);
  const igv = total - subtotalSinIgv;
  return { total, subtotalSinIgv, igv };
}

// Denominaciones de billetes y monedas de Perú, para el arqueo de caja.
export const BILL_DENOMINATIONS = [200, 100, 50, 20, 10];
export const COIN_DENOMINATIONS = [5, 2, 1, 0.5, 0.2, 0.1];
