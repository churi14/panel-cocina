"use client";

import React from 'react';

type Props = {
  titulo: string;
  mensaje: string;
  detalle?: string;
  sugerencia?: string | null;  // ej: "¿Quisiste decir 22.48 kg?"
  onConfirmar: () => void;
  onCorregir: (valorSugerido?: number) => void;
  tipo?: 'confirmacion' | 'bloqueo';
};

export default function ConfirmacionCantidad({
  titulo,
  mensaje,
  detalle,
  sugerencia,
  onConfirmar,
  onCorregir,
  tipo = 'confirmacion',
}: Props) {
  // Extraer número sugerido del texto si existe
  const matchNum = sugerencia?.match(/([\d.,]+)\s*kg/);
  const valorSugerido = matchNum ? parseFloat(matchNum[1].replace(',', '.')) : undefined;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
      <div className={`bg-white rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl border-4 ${
        tipo === 'bloqueo' ? 'border-red-600' : 'border-amber-400'
      }`}>
        <div className="text-5xl mb-4">{tipo === 'bloqueo' ? '🚫' : '⚠️'}</div>

        <h2 className={`text-xl font-black mb-2 ${tipo === 'bloqueo' ? 'text-red-600' : 'text-amber-700'}`}>
          {titulo}
        </h2>

        <p className="text-slate-700 font-bold text-lg mb-1">{mensaje}</p>

        {detalle && (
          <p className="text-slate-500 text-sm mb-4">{detalle}</p>
        )}

        {sugerencia && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-blue-500 font-bold uppercase mb-0.5">Posible error de tipeo</p>
            <p className="text-blue-700 font-black text-lg">{sugerencia}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {sugerencia && valorSugerido && (
            <button
              onClick={() => onCorregir(valorSugerido)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all text-sm">
              ✅ Usar {valorSugerido} kg
            </button>
          )}

          {tipo === 'confirmacion' && (
            <button
              onClick={onConfirmar}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all text-sm">
              Confirmar de todas formas
            </button>
          )}

          <button
            onClick={() => onCorregir()}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all text-sm">
            ✏️ Corregir el número
          </button>
        </div>
      </div>
    </div>
  );
}