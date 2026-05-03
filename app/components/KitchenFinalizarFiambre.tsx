"use client";
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { deductStockForFiambre } from './kitchenHelpers';
import { clearCocinaProduccion } from './kitchenHelpers';

interface Prod {
  id: number;
  recipeId?: string;
  recipeName: string;
  baseKg?: number;
  targetUnits: number;
  unit: string;
  startTime: number;
}

interface Props {
  prod: Prod;
  operador: string;
  onFinalizado: () => void;
  onCancelar: () => void;
}

export default function KitchenFinalizarFiambre({ prod, operador, onFinalizado, onCancelar }: Props) {
  // Siempre usar baseKg ?? 0 — NUNCA targetUnits como kg
  const baseKg = prod.baseKg ?? 0;

  const [kgProcesados, setKgProcesados] = useState(baseKg > 0 ? String(baseKg) : '');
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);

  const kgNum = parseFloat(kgProcesados.replace(',', '.')) || 0;
  const canConfirm = kgNum > 0;

  // Sugerir corrección si parece que pusieron gramos en vez de kg
  const sugerirKg = kgNum > 100 ? parseFloat((kgNum / 1000).toFixed(3)) : null;

  const handleConfirmar = async () => {
    if (!canConfirm || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    await deductStockForFiambre(prod.recipeId ?? '', kgNum, operador);
    await clearCocinaProduccion(prod.id, prod.recipeName, kgNum, operador);

    setGuardando(false);
    guardandoRef.current = false;
    onFinalizado();
  };

  return (
    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-4">
      <p className="text-amber-300 font-black text-sm uppercase">
        🧀 Finalizar — {prod.recipeName}
      </p>

      {/* Kg procesados */}
      <div>
        <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
          Kg procesados / preparados
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={kgProcesados}
            onChange={e => setKgProcesados(e.target.value)}
            placeholder="0.000"
            className="w-full bg-slate-800 border-2 border-amber-500/50 text-white rounded-xl px-4 py-3 text-3xl font-black text-center outline-none focus:border-amber-400"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400">KG</span>
        </div>

        {/* Advertencia si parece gramos */}
        {sugerirKg && (
          <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-amber-400">
              ⚠ ¿Quisiste decir <span className="font-black">{sugerirKg} kg</span>?
            </p>
            <button
              onClick={() => setKgProcesados(String(sugerirKg))}
              className="text-xs font-black text-amber-300 underline ml-3"
            >
              Usar {sugerirKg} kg
            </button>
          </div>
        )}
      </div>

      {/* Resumen */}
      {kgNum > 0 && (
        <div className="bg-slate-800/50 rounded-xl px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Descuenta de admin:</span>
            <span className="font-black text-red-400">−{kgNum.toFixed(3)} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Suma a stock producción:</span>
            <span className="font-black text-green-400">+{kgNum.toFixed(3)} kg</span>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirmar}
          disabled={!canConfirm || guardando}
          className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {guardando
            ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</>
            : '✓ Confirmar producción'}
        </button>
        <button
          onClick={onCancelar}
          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}