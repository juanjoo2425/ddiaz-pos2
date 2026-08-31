import {
  collection, doc, onSnapshot, query, orderBy, limit,
  setDoc, deleteDoc, runTransaction, serverTimestamp, Timestamp,
  getDocs, writeBatch,
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

// La contraseña que protege Métricas, Historial y Configuraciones vive en
// Firestore (no en el código) para poder cambiarla desde la app sin
// necesidad de volver a publicar el proyecto.
export function subscribeSecurity(onChange, fallback) {
  return onSnapshot(doc(db, 'config', 'security'), (snap) => {
    onChange(snap.exists() ? snap.data() : fallback);
  }, (err) => console.error('subscribeSecurity error', err));
}

export async function saveSecurity(data) {
  await setDoc(doc(db, 'config', 'security'), data, { merge: true });
}

// Categorías de productos: también configurables en vivo desde la app
// (Configuraciones), no hardcodeadas en el código.
export function subscribeCategories(onChange) {
  return onSnapshot(doc(db, 'config', 'categories'), (snap) => {
    // null = el documento todavía no existe (primera vez, hay que sembrarlo)
    onChange(snap.exists() ? (snap.data().names || []) : null);
  }, (err) => console.error('subscribeCategories error', err));
}

export async function seedCategoriesIfEmpty(defaultNames) {
  await setDoc(doc(db, 'config', 'categories'), { names: defaultNames });
}

export async function saveCategories(names) {
  await setDoc(doc(db, 'config', 'categories'), { names });
}

// Ajustes generales del punto de venta (ej. si el monto recibido en
// efectivo es obligatorio u opcional).
export function subscribePosSettings(onChange, fallback) {
  return onSnapshot(doc(db, 'config', 'pos-settings'), (snap) => {
    onChange(snap.exists() ? snap.data() : fallback);
  }, (err) => console.error('subscribePosSettings error', err));
}

export async function savePosSettings(data) {
  await setDoc(doc(db, 'config', 'pos-settings'), data, { merge: true });
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
      // Redondeamos a 2 decimales para no arrastrar errores de coma
      // flotante cuando se venden cantidades fraccionadas (pan por 1.5, etc.)
      tx.update(productRefs[i], { stock: Math.round((snap.data().stock - item.qty) * 100) / 100 });
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
      cashReceived: paymentMethod === 'Efectivo' && cashReceived != null ? cashReceived : null,
      change: paymentMethod === 'Efectivo' && cashReceived != null ? Math.max(0, cashReceived - totals.total) : null,
    };
    tx.set(saleRef, sale);
    tx.set(counterRef, { count: nextCount }, { merge: true });

    return { id: saleRef.id, ...sale, date: new Date().toISOString() };
  });

  return result;
}

/**
 * Elimina una venta del historial (para corregir ventas de prueba/simuladas
 * que no deben afectar tus métricas). De forma ATÓMICA, opcionalmente
 * devuelve el stock vendido a cada producto involucrado.
 */
export async function deleteSale({ saleId, items, restoreStock }) {
  await runTransaction(db, async (tx) => {
    const saleRef = doc(db, 'sales', saleId);

    if (restoreStock && items && items.length > 0) {
      const productRefs = items.map((it) => doc(db, 'products', it.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
      productSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          const restored = Math.round((snap.data().stock + items[i].qty) * 100) / 100;
          tx.update(productRefs[i], { stock: restored });
        }
      });
    }

    tx.delete(saleRef);
  });
}

/**
 * Reemplaza TODO el catálogo de productos y la lista de categorías de una
 * sola vez (borra lo que había y pone la lista nueva). Se usa desde
 * Configuraciones para cargar una carta completa sin tener que borrar
 * producto por producto. No toca las ventas ya registradas.
 */
export async function replaceCatalog({ categories, products }) {
  const batch = writeBatch(db);

  const existingSnap = await getDocs(collection(db, 'products'));
  existingSnap.forEach((d) => batch.delete(d.ref));

  batch.set(doc(db, 'config', 'categories'), { names: categories });

  products.forEach((p) => {
    batch.set(doc(db, 'products', p.id), p);
  });

  await batch.commit();
}

// ============================================================
// CAJA — turnos (shifts) y arqueo ciego
//
// Colecciones nuevas:
//  - shifts/{shiftId}            → un documento por turno (apertura/cierre)
//  - shift_movements/{moveId}    → egresos/ingresos extra durante el turno
//
// El "cuadre" (comparar lo declarado por el cajero contra lo que el
// sistema esperaba) NUNCA se guarda en el turno ni se calcula hasta que
// un admin abre el reporte — así el cierre es realmente ciego: el cajero
// jamás ve, ni en el código, cuánto debería haber.
// ============================================================

export function subscribeActiveShift(onChange) {
  const q = query(collection(db, 'shifts'), orderBy('openedAt', 'desc'), limit(1));
  return onSnapshot(q, (snap) => {
    if (snap.empty) { onChange(null); return; }
    const d = snap.docs[0];
    const data = d.data();
    const shift = {
      id: d.id,
      ...data,
      openedAt: data.openedAt instanceof Timestamp ? data.openedAt.toDate().toISOString() : data.openedAt,
      closedAt: data.closedAt instanceof Timestamp ? data.closedAt.toDate().toISOString() : data.closedAt,
    };
    onChange(shift.status === 'open' ? shift : null);
  }, (err) => console.error('subscribeActiveShift error', err));
}

export async function openShift({ openedBy, openingFloat }) {
  const ref = doc(collection(db, 'shifts'));
  await setDoc(ref, {
    status: 'open',
    openedAt: serverTimestamp(),
    openedBy,
    openingFloat,
    closedAt: null,
    closedBy: null,
    declaredCash: null,
    declaredBillsBreakdown: null,
    declaredCoinsBreakdown: null,
    declaredCardVouchers: null,
    declaredNotes: '',
  });
  return ref.id;
}

// Se traen los movimientos recientes sin filtrar por shiftId en la
// consulta (para no depender de un índice compuesto en Firestore) y se
// filtra en el cliente — el volumen por turno es bajo, así que es seguro.
export function subscribeShiftMovements(shiftId, onChange, max = 200) {
  const q = query(collection(db, 'shift_movements'), orderBy('date', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date };
    });
    onChange(shiftId ? all.filter((m) => m.shiftId === shiftId) : all);
  }, (err) => console.error('subscribeShiftMovements error', err));
}

export async function addShiftMovement({ shiftId, type, amount, reason, seller }) {
  const ref = doc(collection(db, 'shift_movements'));
  await setDoc(ref, { shiftId, type, amount, reason: reason || '', seller, date: serverTimestamp() });
}

/**
 * Cierre CIEGO del turno: guarda exactamente lo que el cajero declaró
 * (efectivo contado, desglose de billetes/monedas, vouchers de tarjeta),
 * sin calcular ni mostrar en ningún momento cuánto "debería" haber.
 */
export async function closeShiftBlind({ shiftId, closedBy, declaredCash, billsBreakdown, coinsBreakdown, declaredCardVouchers, declaredNotes }) {
  await setDoc(doc(db, 'shifts', shiftId), {
    status: 'closed',
    closedAt: serverTimestamp(),
    closedBy,
    declaredCash,
    declaredBillsBreakdown: billsBreakdown,
    declaredCoinsBreakdown: coinsBreakdown,
    declaredCardVouchers,
    declaredNotes: declaredNotes || '',
  }, { merge: true });
}

// Lista de turnos cerrados para el reporte de auditoría (solo Admin).
// Se ordena solo por closedAt (sin "where status==closed") para evitar
// depender de un índice compuesto; se filtra en el cliente.
export function subscribeClosedShifts(onChange, max = 60) {
  const q = query(collection(db, 'shifts'), orderBy('closedAt', 'desc'), limit(max));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          openedAt: data.openedAt instanceof Timestamp ? data.openedAt.toDate().toISOString() : data.openedAt,
          closedAt: data.closedAt instanceof Timestamp ? data.closedAt.toDate().toISOString() : data.closedAt,
        };
      })
      .filter((s) => s.status === 'closed');
    onChange(items);
  }, (err) => console.error('subscribeClosedShifts error', err));
}

