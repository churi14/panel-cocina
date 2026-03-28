"use client";
import React from 'react';
import { Filter, User } from 'lucide-react';
import { Movement, formatFecha } from './types';

type Props = {
  movements: Movement[];
  filterType: 'all' | 'ingreso' | 'egreso';
  setFilterType: React.Dispatch<React.SetStateAction<'all' | 'ingreso' | 'egreso'>>;
  filterOp: string;
  setFilterOp: React.Dispatch<React.SetStateAction<string>>;
};

export default function TabMovimientos({ movements, filterType, setFilterType, filterOp, setFilterOp }: Props) {
  const filtered = movements.filter(m => {
    if (filterType !== 'all' && m.tipo !== filterType) return false;
    if (filterOp !== 'all' && m.operador !== filterOp) return false;
    return true;
  });
  const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))];
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-sm text-slate-400 font-bold">
          <Filter size={16} /> Filtros:
        </div>
        {/* Tipo */}
        <div className="flex bg-slate-800 p-1 rounded-xl gap-1">
          {(['all', 'ingreso', 'egreso'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterType === t ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
              {t === 'all' ? 'Todos' : t === 'ingreso' ? '↑ Ingresos' : '↓ Egresos'}
            </button>
          ))}
        </div>
        {/* Operador */}
        <select value={filterOp} onChange={e => setFilterOp(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-sm text-slate-300 rounded-xl px-3 py-2 outline-none">
          <option value="all">Todos los operadores</option>
          {operadores.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
        <span className="text-slate-600 text-xs ml-auto">{filtered.length} registros</span>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left">Fecha y hora</th>
                <th className="px-6 py-3 text-left">Operador</th>
                <th className="px-6 py-3 text-left">Producto</th>
                <th className="px-6 py-3 text-left">Categoría</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-left">Motivo</th>
                <th className="px-6 py-3 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                  <td className="px-6 py-3 font-bold text-slate-300">{m.operador ?? '—'}</td>
                  <td className="px-6 py-3 font-bold text-white">{m.nombre}</td>
                  <td className="px-6 py-3 text-slate-400">{m.categoria}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black
                      ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {m.tipo === 'ingreso' ? '↑ INGRESO' : '↓ EGRESO'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-400 text-xs max-w-xs truncate">{m.motivo ?? '—'}</td>
                  <td className="px-6 py-3 text-right font-black text-white">{m.cantidad} {m.unidad}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-600">No hay movimientos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}