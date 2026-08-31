import React, { useState } from 'react';
import {
  Vault, Lock, LockOpen, DollarSign, Plus, Minus, TrendingUp, TrendingDown,
  AlertTriangle, Check, X, Receipt, Banknote, Coins, ChevronDown, ChevronUp,
} from 'lucide-react';
import { C, money, fmtDate, fmtTime, BILL_DENOMINATIONS, COIN_DENOMINATIONS } from '../lib/shared';

// Formatea una diferencia con signo de forma más natural: "+S/ 5.00" / "-S/ 16.00"
// (en vez de "S/ -16.00", que se lee raro).
function moneySigned(n) {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return `${sign}${money(Math.abs(n))}`;
}

// ============================================================
// Tarjeta de resumen pequeña (reutilizada varias veces acá)
// ============================================================
function StatPill({ label, value, color }) {
  return (
    <div className="flex-1 min-w-[100px] rounded-lg p-2.5" style={{ backgroundColor: C.surfaceAlt }}>
      <div className="text-xs" style={{ color: C.textFaint }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: color || C.text }}>{value}</div>
    </div>
  );
}

// ============================================================
// Apertura de caja (caja cerrada → formulario de fondo inicial)
// ============================================================
function OpenShiftForm({ onOpen, currentSeller }) {
  const [floatAmount, setFloatAmount] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const num = parseFloat(floatAmount);
    if (isNaN(num) || num < 0) { setError('Ingresa un monto válido.'); return; }
    setError('');
    onOpen(num);
  };

  return (
    <div className="rounded-xl p-6 flex flex-col items-center text-center gap-3" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: C.accentSoft }}>
        <Vault size={26} style={{ color: C.accent }} />
      </div>
      <div className="text-base font-bold" style={{ color: C.text }}>Caja cerrada</div>
      <div className="text-sm max-w-sm" style={{ color: C.textSoft }}>
        Ingresa el fondo de caja (el efectivo con el que empiezas el turno para dar vuelto) para abrir y empezar a vender. Se abrirá a nombre de <strong>{currentSeller}</strong>.
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <input
          type="number" min="0" step="0.10"
          value={floatAmount}
          onChange={(e) => { setFloatAmount(e.target.value); setError(''); }}
          placeholder="Fondo de caja inicial (S/)"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${error ? C.red : C.border}` }}
        />
      </div>
      {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
      <button onClick={submit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: C.accent }}>
        Abrir caja
      </button>
    </div>
  );
}

// ============================================================
// Registrar egreso / ingreso extra durante el turno
// ============================================================
function MovementForm({ onAdd, onClose }) {
  const [type, setType] = useState('egreso');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Ingresa un monto válido.'); return; }
    onAdd({ type, amount: num, reason: reason.trim() });
    setAmount(''); setReason(''); setError('');
    onClose();
  };

  return (
    <div className="rounded-lg p-3 mt-2" style={{ backgroundColor: C.surfaceAlt }}>
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => setType('egreso')} className="flex-1 py-1.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: type === 'egreso' ? C.red : C.surface, color: type === 'egreso' ? '#fff' : C.textSoft }}>
          Egreso (sale plata)
        </button>
        <button onClick={() => setType('ingreso')} className="flex-1 py-1.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: type === 'ingreso' ? C.green : C.surface, color: type === 'ingreso' ? '#fff' : C.textSoft }}>
          Ingreso extra
        </button>
      </div>
      <div className="flex gap-1.5 mb-2">
        <input type="number" min="0" step="0.10" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto (S/)" className="w-28 px-2 py-1.5 rounded-md text-xs outline-none" style={{ border: `1px solid ${C.border}` }} />
        <input value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (ej. pago a proveedor)" className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none" style={{ border: `1px solid ${C.border}` }} />
      </div>
      {error && <div className="text-xs mb-2" style={{ color: C.red }}>{error}</div>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-1.5 rounded-md text-xs font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>Cancelar</button>
        <button onClick={submit} className="flex-1 py-1.5 rounded-md text-xs font-bold text-white" style={{ backgroundColor: C.accent }}>Registrar</button>
      </div>
    </div>
  );
}

// ============================================================
// Formulario de CIERRE CIEGO — el cajero declara billete por billete,
// moneda por moneda, y el total de vouchers. Nunca se le muestra ni se
// calcula acá cuánto "debería" haber.
// ============================================================
function BlindCloseForm({ onConfirm, onCancel }) {
  const [bills, setBills] = useState({});
  const [coins, setCoins] = useState({});
  const [cardVouchers, setCardVouchers] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const totalBills = BILL_DENOMINATIONS.reduce((s, d) => s + (parseFloat(bills[d]) || 0) * d, 0);
  const totalCoins = COIN_DENOMINATIONS.reduce((s, d) => s + (parseFloat(coins[d]) || 0) * d, 0);
  const totalCash = totalBills + totalCoins;

  const submit = () => {
    onConfirm({
      declaredCash: Math.round(totalCash * 100) / 100,
      billsBreakdown: bills,
      coinsBreakdown: coins,
      declaredCardVouchers: parseFloat(cardVouchers) || 0,
      declaredNotes: notes,
    });
  };

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.red}` }}>
      <div className="flex items-center gap-1.5 text-sm font-bold mb-1" style={{ color: C.red }}>
        <AlertTriangle size={15} /> Cierre de caja — arqueo
      </div>
      <div className="text-xs mb-3" style={{ color: C.textSoft }}>
        Cuenta físicamente el efectivo de la caja y declara aquí exactamente lo que encontraste. El sistema no te muestra cuánto "debería" haber — eso lo revisa el administrador después de que cierres.
      </div>

      <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: C.text }}>
        <Banknote size={13} /> Billetes
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {BILL_DENOMINATIONS.map((d) => (
          <div key={d} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: C.surfaceAlt }}>
            <span className="text-xs w-14" style={{ color: C.textSoft }}>S/ {d}</span>
            <input
              type="number" min="0" step="1" value={bills[d] || ''}
              onChange={(e) => setBills({ ...bills, [d]: e.target.value })}
              placeholder="0" className="w-14 px-1.5 py-1 rounded text-xs text-center outline-none" style={{ border: `1px solid ${C.border}` }}
            />
            <span className="text-xs ml-auto font-medium" style={{ color: C.text }}>{money((parseFloat(bills[d]) || 0) * d)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: C.text }}>
        <Coins size={13} /> Monedas
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {COIN_DENOMINATIONS.map((d) => (
          <div key={d} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: C.surfaceAlt }}>
            <span className="text-xs w-14" style={{ color: C.textSoft }}>S/ {d.toFixed(2)}</span>
            <input
              type="number" min="0" step="1" value={coins[d] || ''}
              onChange={(e) => setCoins({ ...coins, [d]: e.target.value })}
              placeholder="0" className="w-14 px-1.5 py-1 rounded text-xs text-center outline-none" style={{ border: `1px solid ${C.border}` }}
            />
            <span className="text-xs ml-auto font-medium" style={{ color: C.text }}>{money((parseFloat(coins[d]) || 0) * d)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center py-2 px-3 rounded-lg mb-3" style={{ backgroundColor: C.accentSoft }}>
        <span className="text-sm font-bold" style={{ color: C.accent }}>Total efectivo contado</span>
        <span className="text-base font-bold" style={{ color: C.accent }}>{money(totalCash)}</span>
      </div>

      <label className="text-xs font-medium" style={{ color: C.textSoft }}>Total de vouchers de tarjeta contados (S/)</label>
      <input
        type="number" min="0" step="0.10" value={cardVouchers} onChange={(e) => setCardVouchers(e.target.value)}
        placeholder="0.00" className="w-full mt-1 mb-3 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${C.border}` }}
      />

      <label className="text-xs font-medium" style={{ color: C.textSoft }}>Notas (opcional)</label>
      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
        placeholder="Ej. faltó un billete de 20 doblado, etc."
        className="w-full mt-1 mb-3 px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: `1px solid ${C.border}` }}
      />

      {!confirming ? (
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft }}>Cancelar</button>
          <button onClick={() => setConfirming(true)} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: C.red }}>Cerrar caja con estos datos</button>
        </div>
      ) : (
        <div className="rounded-lg p-3" style={{ backgroundColor: C.redSoft }}>
          <div className="text-xs font-medium mb-2" style={{ color: C.red }}>
            ¿Confirmas? Una vez cerrada, no vas a poder editar esta declaración — solo un administrador podrá ver el reporte final.
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.textSoft, backgroundColor: C.surface }}>Volver</button>
            <button onClick={submit} className="flex-1 py-2 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: C.red }}>Sí, cerrar caja</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Candado de auditoría (reutiliza la misma contraseña privada del resto
// de la app: Métricas / Historial / Configuraciones).
// ============================================================
function AuditLock({ correctPassword, onUnlock }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (pw === correctPassword) { setError(''); onUnlock(); }
    else setError('Contraseña incorrecta.');
  };
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <Lock size={20} style={{ color: C.accent }} />
      <div className="text-xs" style={{ color: C.textSoft }}>Solo administradores pueden ver el reporte de cuadre.</div>
      <div className="flex gap-2">
        <input
          type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Contraseña" className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${error ? C.red : C.border}`, width: 160 }}
        />
        <button onClick={submit} className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: C.accent }}>Entrar</button>
      </div>
      {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
    </div>
  );
}

// ============================================================
// Reporte de cuadre de UN turno cerrado (solo se calcula acá, al momento
// de que el admin lo abre — nunca antes, nunca visible para el cajero).
// ============================================================
function ShiftReport({ shift, sales }) {
  const start = new Date(shift.openedAt);
  const end = shift.closedAt ? new Date(shift.closedAt) : new Date();
  const shiftSales = sales.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  });

  const cashSales = shiftSales.filter((s) => s.paymentMethod === 'Efectivo').reduce((s, x) => s + x.total, 0);
  const cardSales = shiftSales.filter((s) => s.paymentMethod === 'Tarjeta').reduce((s, x) => s + x.total, 0);
  const yapeSales = shiftSales.filter((s) => s.paymentMethod === 'Yape / Plin').reduce((s, x) => s + x.total, 0);

  const egresos = (shift.movements || []).filter((m) => m.type === 'egreso').reduce((s, m) => s + m.amount, 0);
  const ingresos = (shift.movements || []).filter((m) => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0);

  const expectedCash = (shift.openingFloat || 0) + cashSales - egresos + ingresos;
  const declaredCash = shift.declaredCash || 0;
  const diffCash = Math.round((declaredCash - expectedCash) * 100) / 100;

  const diffCard = Math.round(((shift.declaredCardVouchers || 0) - cardSales) * 100) / 100;

  let status, statusColor, statusBg;
  if (Math.abs(diffCash) < 0.05) { status = 'Cuadre exacto'; statusColor = C.green; statusBg = C.greenSoft; }
  else if (diffCash > 0) { status = 'Sobrante'; statusColor = C.honey; statusBg = C.honeySoft; }
  else { status = 'Faltante'; statusColor = C.red; statusBg = C.redSoft; }

  return (
    <div className="rounded-lg p-3 mt-2" style={{ backgroundColor: C.surfaceAlt, border: `1px solid ${C.border}` }}>
      <div className="flex justify-between items-center mb-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: statusBg }}>
        <span className="text-sm font-bold" style={{ color: statusColor }}>{status}</span>
        <span className="text-sm font-bold" style={{ color: statusColor }}>{moneySigned(diffCash)}</span>
      </div>
      <div className="space-y-1 text-xs" style={{ color: C.textSoft }}>
        <div className="flex justify-between"><span>Fondo inicial</span><span>{money(shift.openingFloat || 0)}</span></div>
        <div className="flex justify-between"><span>+ Ventas en efectivo</span><span>{money(cashSales)}</span></div>
        <div className="flex justify-between"><span>− Egresos</span><span>{money(egresos)}</span></div>
        <div className="flex justify-between"><span>+ Ingresos extra</span><span>{money(ingresos)}</span></div>
        <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${C.borderStrong}`, color: C.text }}>
          <span>= Efectivo esperado</span><span>{money(expectedCash)}</span>
        </div>
        <div className="flex justify-between font-bold" style={{ color: C.text }}>
          <span>Efectivo declarado por el cajero</span><span>{money(declaredCash)}</span>
        </div>
      </div>
      <div className="flex justify-between text-xs mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}`, color: C.textSoft }}>
        <span>Tarjeta: ventas {money(cardSales)} vs. vouchers {money(shift.declaredCardVouchers || 0)}</span>
        <span style={{ color: Math.abs(diffCard) < 0.05 ? C.green : C.red, fontWeight: 700 }}>
          {moneySigned(diffCard)}
        </span>
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: C.textSoft }}>
        <span>Yape / Plin del turno</span><span>{money(yapeSales)}</span>
      </div>
      {shift.declaredNotes && (
        <div className="text-xs mt-2 pt-2 italic" style={{ borderTop: `1px solid ${C.border}`, color: C.textFaint }}>
          Nota del cajero: "{shift.declaredNotes}"
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sección de auditoría — siempre disponible en la pestaña Caja, tenga
// o no haya un turno abierto en este momento (un admin debe poder
// revisar cierres pasados aunque nadie haya abierto caja hoy todavía).
// ============================================================
function AuditSection({ closedShifts, movements, sales, privateUnlocked, correctPassword, onUnlockPrivate, expandedReportId, setExpandedReportId }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-1.5 text-sm font-bold mb-1" style={{ color: C.text }}>
        <Vault size={15} style={{ color: C.accent }} /> Auditoría de cierres (solo administrador)
      </div>
      {!privateUnlocked ? (
        <AuditLock correctPassword={correctPassword} onUnlock={onUnlockPrivate} />
      ) : (
        <div className="mt-2">
          {closedShifts.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>Todavía no hay turnos cerrados.</div>}
          {closedShifts.map((shift) => (
            <div key={shift.id} className="py-2" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setExpandedReportId(expandedReportId === shift.id ? null : shift.id)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="text-sm font-medium" style={{ color: C.text }}>{shift.openedBy} → {shift.closedBy}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>{fmtDate(shift.openedAt)} {fmtTime(shift.openedAt)} – {fmtTime(shift.closedAt)}</div>
                </div>
                {expandedReportId === shift.id ? <ChevronUp size={16} style={{ color: C.textSoft }} /> : <ChevronDown size={16} style={{ color: C.textSoft }} />}
              </button>
              {expandedReportId === shift.id && (
                <ShiftReport shift={{ ...shift, movements: movements.filter((m) => m.shiftId === shift.id) }} sales={sales} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function CashRegister({
  activeShift, movements, closedShifts, sales, currentSeller,
  onOpenShift, onAddMovement, onCloseShift,
  privateUnlocked, correctPassword, onUnlockPrivate,
}) {
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  const shiftMovements = activeShift ? movements.filter((m) => m.shiftId === activeShift.id) : [];

  // Resumen operativo normal mientras la caja está abierta (esto NO es el
  // arqueo: es solo el resumen de ventas del turno, información que
  // cualquier cajero ve normalmente mientras trabaja).
  const shiftSales = activeShift
    ? sales.filter((s) => new Date(s.date) >= new Date(activeShift.openedAt))
    : [];
  const totalShiftSales = shiftSales.reduce((s, x) => s + x.total, 0);

  if (!activeShift) {
    return (
      <div className="flex flex-col gap-4 max-w-xl">
        <OpenShiftForm onOpen={onOpenShift} currentSeller={currentSeller} />
        <AuditSection
          closedShifts={closedShifts} movements={movements} sales={sales}
          privateUnlocked={privateUnlocked} correctPassword={correctPassword} onUnlockPrivate={onUnlockPrivate}
          expandedReportId={expandedReportId} setExpandedReportId={setExpandedReportId}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {!showCloseForm && (
        <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.green }}>
              <LockOpen size={15} /> Caja abierta
            </div>
            <span className="text-xs" style={{ color: C.textFaint }}>{fmtDate(activeShift.openedAt)} · {fmtTime(activeShift.openedAt)}</span>
          </div>
          <div className="text-xs mb-3" style={{ color: C.textSoft }}>Abierta por <strong>{activeShift.openedBy}</strong></div>

          <div className="flex flex-wrap gap-2 mb-3">
            <StatPill label="Fondo inicial" value={money(activeShift.openingFloat)} />
            <StatPill label="Ventas del turno" value={money(totalShiftSales)} color={C.accent} />
            <StatPill label="Tickets" value={shiftSales.length} />
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-bold" style={{ color: C.text }}>Egresos e ingresos del turno</div>
            <button onClick={() => setShowMovementForm((v) => !v)} className="flex items-center gap-1 text-xs font-medium" style={{ color: C.accent }}>
              <Plus size={13} /> Registrar
            </button>
          </div>
          {showMovementForm && <MovementForm onAdd={onAddMovement} onClose={() => setShowMovementForm(false)} />}

          <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto">
            {shiftMovements.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>Sin egresos ni ingresos registrados todavía.</div>}
            {shiftMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1" style={{ color: C.textSoft }}>
                  {m.type === 'egreso' ? <TrendingDown size={12} style={{ color: C.red }} /> : <TrendingUp size={12} style={{ color: C.green }} />}
                  {m.reason || (m.type === 'egreso' ? 'Egreso' : 'Ingreso')}
                </span>
                <span className="font-bold" style={{ color: m.type === 'egreso' ? C.red : C.green }}>
                  {m.type === 'egreso' ? '−' : '+'}{money(m.amount)}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCloseForm(true)}
            className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: C.red }}
          >
            <Lock size={15} /> Cerrar caja (arqueo)
          </button>
        </div>
      )}

      {showCloseForm && (
        <BlindCloseForm
          onConfirm={(data) => { onCloseShift(data); setShowCloseForm(false); }}
          onCancel={() => setShowCloseForm(false)}
        />
      )}

      <AuditSection
        closedShifts={closedShifts} movements={movements} sales={sales}
        privateUnlocked={privateUnlocked} correctPassword={correctPassword} onUnlockPrivate={onUnlockPrivate}
        expandedReportId={expandedReportId} setExpandedReportId={setExpandedReportId}
      />
    </div>
  );
}
