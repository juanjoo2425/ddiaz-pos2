import {
  collection, doc, onSnapshot, query, orderBy, limit,
  setDoc, deleteDoc, runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// Colecciones:
//  - products/{productId}
//  - sales/{saleId}
//  - config/business   (documento único con datos del negocio)
//  - config/sellers    (documento único con lista de vendedores)
//  - counters/{docType}  (contador atómico para numerar tickets)
// ============================================================

export function subscribeProducts(onChange) {
  return onSnapshot(collection(db, 'products'), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onChange(items);
  }, (err) => console.error('subscribeProducts error', err));
}

export function subscribeSales(onChange, max = 2000) {
  const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      };
    });
    onChange(items);
  }, (err) => console.error('subscribeSales error', err));
}

export function subscribeBusiness(onChange, fallback) {
  return onSnapshot(doc(db, 'config', 'business'), (snap) => {
    onChange(snap.exists() ? snap.data() : fallback);
  }, (err) => console.error('subscribeBusiness error', err));
}

export function subscribeSellers(onChange) {
  return onSnapshot(doc(db, 'config', 'sellers'), (snap) => {
    onChange(snap.exists() ? (snap.data().names || []) : []);
  }, (err) => console.error('subscribeSellers error', err));
}

export async function saveProduct(product) {
  const id = product.id || crypto.randomUUID();
  await setDoc(doc(db, 'products', id), { ...product, id });
}

export async function deleteProductDoc(id) {
  await deleteDoc(doc(db, 'products', id));
}

export async function saveBusinessInfo(info) {
  await setDoc(doc(db, 'config', 'business'), info);
}

export async function addSeller(name, currentList) {
  if (currentList.includes(name)) return;
  await setDoc(doc(db, 'config', 'sellers'), { names: [...currentList, name] });
}

export async function seedProductsIfEmpty(seedList) {
  // Se llama solo si la colección de productos está vacía (primera vez).
  for (const p of seedList) {
    await setDoc(doc(db, 'products', p.id), p);
  }
}

function docPrefix(docType) {
  if (docType === 'Boleta') return 'B001';
  if (docType === 'Factura') return 'F001';
  return 'NV01';
}

/**
 * Registra una venta de forma ATÓMICA:
 *  - Verifica stock suficiente de cada producto.
 *  - Descuenta el stock exacto (sin condiciones de carrera, aunque dos
 *    vendedores cobren al mismo tiempo desde dispositivos distintos).
 *  - Genera un número de ticket secuencial único usando un contador
 *    atómico por tipo de documento.
 * Si algo fallara a mitad de camino (ej. sin stock), NINGÚN cambio se
 * guarda — o se registra todo, o no se registra nada.
 */
export async function checkoutSale({ cart, seller, docType, customerName, customerDoc, paymentMethod, cashReceived, totals }) {
  const saleRef = doc(collection(db, 'sales'));
  const counterRef = doc(db, 'counters', docType);

  const result = await runTransaction(db, async (tx) => {
    // 1. Leer contador y productos involucrados
    const counterSnap = await tx.get(counterRef);
    const currentCount = counterSnap.exists() ? counterSnap.data().count : 0;
    const nextCount = currentCount + 1;

    const productRefs = cart.map((it) => doc(db, 'products', it.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // 2. Verificar stock suficiente
    for (let i = 0; i < cart.length; i++) {
      const snap = productSnaps[i];
      const item = cart[i];
      if (!snap.exists()) throw new Error(`El producto "${item.name}" ya no existe.`);
      const stock = snap.data().stock;
      if (stock < item.qty) throw new Error(`Sin stock suficiente de "${item.name}" (quedan ${stock}).`);
    }

    // 3. Descontar stock
    productSnaps.forEach((snap, i) => {
      const item = cart[i];
      tx.update(productRefs[i], { stock: snap.data().stock - item.qty });
    });

    // 4. Guardar venta y actualizar contador
    const docNumber = `${docPrefix(docType)}-${String(nextCount).padStart(6, '0')}`;
    const sale = {
      date: serverTimestamp(),
      seller,
      docType,
      docNumber,
      customerName: customerName || '',
      customerDoc: customerDoc || '',
      items: cart.map((it) => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty, subtotal: it.price * it.qty })),
      subtotalSinIgv: totals.subtotalSinIgv,
      igv: totals.igv,
      total: totals.total,
      paymentMethod,
      cashReceived: paymentMethod === 'Efectivo' ? cashReceived : null,
      change: paymentMethod === 'Efectivo' ? Math.max(0, cashReceived - totals.total) : null,
    };
    tx.set(saleRef, sale);
    tx.set(counterRef, { count: nextCount }, { merge: true });

    return { id: saleRef.id, ...sale, date: new Date().toISOString() };
  });

  return result;
}
