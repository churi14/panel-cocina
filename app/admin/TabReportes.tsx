"use client";
import React from 'react';
import { User, BarChart3 } from 'lucide-react';
import { Movement } from './types';

type Props = { movements: Movement[] };

export default function TabReportes({ movements }: Props) {
  const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))];
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Por operador */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2"><User size={18} className="text-slate-400" /> Movimientos por operador</h2>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {operadores.map(op => {
            const opMovs = movements.filter(m => m.operador === op);
            const ingresos = opMovs.filter(m => m.tipo === 'ingreso').length;
            const egresos = opMovs.filter(m => m.tipo === 'egreso').length;
            return (
              <div key={op} className="bg-slate-800 rounded-2xl p-4">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mb-3">
                  <User size={18} className="text-slate-300" />
                </div>
                <p className="font-black text-white text-lg mb-1">{op}</p>
                <p className="text-xs text-slate-400">{opMovs.length} movimientos</p>
                <div className="flex gap-3 mt-3">
                  <span className="text-xs text-green-400 font-bold">↑ {ingresos}</span>
                  <span className="text-xs text-red-400 font-bold">↓ {egresos}</span>
                </div>
              </div>
            );
          })}
          {operadores.length === 0 && (
            <div className="col-span-4 text-center py-10 text-slate-600">No hay datos aún</div>
          )}
        </div>
      </div>

      {/* Por categoría */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2"><BarChart3 size={18} className="text-slate-400" /> Movimientos por categoría</h2>
        </div>
        <div className="p-6 space-y-3">
          {[...new Set(movements.map(m => m.categoria))].map(cat => {
            const catMovs = movements.filter(m => m.categoria === cat);
            const pct = movements.length > 0 ? (catMovs.length / movements.length) * 100 : 0;
            return (
              <div key={cat} className="flex items-center gap-4">
                <span className="w-28 text-sm font-bold text-slate-300 shrink-0">{cat}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-400 w-16 text-right">{catMovs.length} mov.</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}