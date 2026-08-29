import React, { useState } from 'react';
import { Lock, Unlock, DollarSign, AlertTriangle, Check } from 'lucide-react';

export default function CashRegister({ currentSalesTotal = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [summary, setSummary] = useState(null);

  const handleOpenRegister = (e) => {
    e.preventDefault();
    if (openingAmount !== '') {
      setIsOpen(true);
      setSummary(null);
    }
  };

  const handleCloseRegister = (e) => {
    e.preventDefault();
    const expected = parseFloat(openingAmount) + parseFloat(currentSalesTotal);
    const actual = parseFloat(closingAmount);
    const difference = actual - expected;

    setSummary({ expected, actual, difference });
    setIsOpen(false);
    setOpeningAmount('');
    setClosingAmount('');
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto mt-4 border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
        {isOpen ? <Unlock className="text-green-600" /> : <Lock className="text-red-600" />}
        Control de Caja
      </h2>

      {!isOpen && !summary && (
        <form onSubmit={handleOpenRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto de Apertura (S/)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500"><DollarSign size={18} /></span>
              <input
                type="number"
                step="0.10"
                min="0"
                required
                className="w-full pl-9 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-amber-600 focus:outline-none"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="Ej. 100.00"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-semibold transition-colors">
            Abrir Caja
          </button>
        </form>
      )}

      {isOpen && (
        <form onSubmit={handleCloseRegister} className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-4">
            <p className="text-sm text-blue-800">Ventas del turno actual: <strong>S/ {currentSalesTotal.toFixed(2)}</strong></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto de Cierre (Dinero en caja)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500"><DollarSign size={18} /></span>
              <input
                type="number"
                step="0.10"
                min="0"
                required
                className="w-full pl-9 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-amber-600 focus:outline-none"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                placeholder="Dinero físico contado"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 font-semibold transition-colors">
            Cerrar Caja (Arqueo)
          </button>
        </form>
      )}

      {summary && (
        <div className="mt-4 p-4 border rounded-md bg-gray-50">
          <h3 className="font-bold text-lg border-b pb-2 mb-3">Resumen de Turno</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex justify-between"><span>Esperado:</span> <span>S/ {summary.expected.toFixed(2)}</span></li>
            <li className="flex justify-between"><span>Contado:</span> <span>S/ {summary.actual.toFixed(2)}</span></li>
            <li className={`flex justify-between font-bold pt-2 border-t ${summary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>Diferencia:</span> 
              <span className="flex items-center gap-1">
                {summary.difference !== 0 && <AlertTriangle size={16} />}
                S/ {summary.difference.toFixed(2)}
              </span>
            </li>
          </ul>
          <button onClick={() => setSummary(null)} className="mt-4 w-full border border-gray-300 text-gray-700 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-center gap-2">
            <Check size={16} /> Iniciar Nuevo Turno
          </button>
        </div>
      )}
    </div>
  );
}
