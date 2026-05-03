"use client";
import React, { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { deductStockForFiambre, clearCocinaProduccion } from './kitchenHelpers';

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
  const baseKg = prod.baseKg ?? 0;
  const limiteMax = baseKg > 0 ? baseKg * 1.1 : 999; // máx 10% más de lo que se inició

  const [kgProcesados, setKgProcesados] = useState(baseKg > 0 ? String(baseKg) : '');
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);

  const kgNum = parseFloat(kgProcesados.replace(',', '.')) || 0;

  // Validaciones
  const warnGramos   = kgNum > 100;                          // probablemente puso gramos
  const sugerirKg    = warnGramos ? parseFloat((kgNum / 1000).toFixed(3)) : null;
  const warnExcede   = !warnGramos && baseKg > 0 && kgNum > limiteMax; // excede lo iniciado
  const warnZero     = kgProcesados !== '' && kgNum === 0;

  const canConfirm = kgNum > 0 && !warnGramos && !warnExcede && !warnZero;

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
      <div>
        <p className="text-amber-300 font-black text-sm uppercase">🧀 Finalizar — {prod.recipeName}</p>
        {baseKg > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            ⚠️ <strong className="text-white">Ingresá en KG.</strong> Iniciaste con {baseKg} kg — el valor tiene que ser similar.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Kg procesados / preparados</label>
        <div className="relative">
          <input
            type="number" inputMode="decimal" step="0.1" min="0"
            value={kgProcesados}
            onChange={e => setKgProcesados(e.target.value)}
            placeholder="0.000"
            className={`w-full border-2 rounded-xl px-4 py-3 text-3xl font-black text-center outline-none transition-all
              ${warnGramos || warnExcede
                ? 'bg-red-900/40 border-red-500 text-red-300'
                : 'bg-slate-800 border-amber-500/50 text-white focus:border-amber-400'}`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400">KG</span>
        </div>

        {/* ⛔ Parece gramos */}
        {warnGramos && (
          <div className="mt-2 bg-red-900/40 border-2 border-red-500 rounded-xl px-4 py-3 space-y-2">
            <p className="text-sm font-black text-red-300">⛔ {kgNum} kg es imposible para esta producción</p>
            <p className="text-xs text-red-400">¿Pusiste gramos en vez de kg? {kgNum} gr = <strong>{sugerirKg} kg</strong></p>
            {sugerirKg && (
              <button onClick={() => setKgProcesados(String(sugerirKg))}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-lg text-sm">
                Usar {sugerirKg} kg
              </button>
            )}
          </div>
        )}

        {/* ⛔ Excede lo iniciado */}
        {warnExcede && !warnGramos && (
          <div className="mt-2 bg-red-900/40 border-2 border-red-500 rounded-xl px-4 py-3">
            <p className="text-sm font-black text-red-300">⛔ No puede salir más de lo que entró</p>
            <p className="text-xs text-red-400 mt-1">
              Iniciaste {baseKg} kg — el máximo esperado es {limiteMax.toFixed(2)} kg.<br/>
              Si realmente salió {kgNum} kg, verificá con el supervisor.
            </p>
          </div>
        )}
      </div>

      {/* Resumen — solo si los valores son válidos */}
      {kgNum > 0 && !warnGramos && !warnExcede && (
        <div className="bg-slate-800/50 rounded-xl px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Iniciado con:</span>
            <span className="font-black text-slate-300">{baseKg} kg</span>
          </div>
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

      <div className="flex gap-3">
        <button onClick={handleConfirmar} disabled={!canConfirm || guardando}
          className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
          {guardando ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : '✓ Confirmar producción'}
        </button>
        <button onClick={onCancelar}
          className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}