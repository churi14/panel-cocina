"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Scale, Flame, Trash2, Package, ChevronLeft, Clock } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import { formatWeight, formatGrams } from './cuts';

const GRASA_TARGET_PCT = 34; // % objetivo de grasa

export type BurgerBlendResult = {
  stockDestino: string;
  grasaKg: number;
  units: number;
  wasteKg: number;
  totalBlendKg: number;
  carneNetaKg: number;
  grasaPct: number;
  paso2DurSeg: number;
};

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const [startAt] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };
  return { elapsed, fmt: fmt(elapsed) };
}

// ─── Componente input grande ──────────────────────────────────────────────────
function BigInput({ label, sublabel, value, onChange, unit, color = 'blue', autoFocus = false, required = false }: {
  label: string; sublabel?: string; value: string;
  onChange: (v: string) => void; unit: string;
  color?: 'blue' | 'orange' | 'red' | 'green'; autoFocus?: boolean; required?: boolean;
}) {
  const colors = {
    blue:   'border-blue-200 bg-blue-50 text-blue-600 focus:border-blue-500',
    orange: 'border-orange-200 bg-orange-50 text-orange-600 focus:border-orange-500',
    red:    'border-red-200 bg-red-50 text-red-600 focus:border-red-500',
    green:  'border-green-200 bg-green-50 text-green-600 focus:border-green-500',
  };
  return (
    <div className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm">
      <div className="mb-3">
        <h4 className="font-black text-slate-800 text-base">{label} {required && <span className="text-red-500">*</span>}</h4>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
      </div>
      <div className="relative">
        <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
          value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
          className={`w-full p-4 text-5xl font-black text-center border-2 rounded-2xl outline-none transition-all ${colors[color]}`}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

// ─── Fila resumen ────────────────────────────────────────────────────────────
function SRow({ label, value, color = 'text-slate-800', bg = 'bg-slate-50' }: {
  label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className={`flex justify-between items-center p-3 rounded-xl ${bg}`}>
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function Step2BurgerView({ productions, onFinish, onBack }: {
  productions: ButcheryProduction[];
  onFinish: (result: BurgerBlendResult) => void;
  onBack: () => void;
}) {
  const [subStep, setSubStep] = useState<'peso' | 'medallones' | 'confirm'>('peso');

  // Paso 2 — pesaje
  const [carneNeta, setCarneNeta] = useState('');
  const [grasaUtil, setGrasaUtil]  = useState('');
  const [desperdicio, setDesperdicio] = useState('');
  const timer2 = useTimer(subStep === 'peso');

  // Paso 3 — medallones
  const [medallones, setMedallones] = useState('');
  const [paso2DurSeg, setPaso2DurSeg] = useState(0);

  // Cálculos
  const carneNetaKg   = parseFloat(carneNeta.replace(',', '.'))   || 0;
  const grasaKg       = parseFloat(grasaUtil.replace(',', '.'))   || 0;
  const wasteKg       = parseFloat(desperdicio.replace(',', '.')) || 0;
  const totalBlendKg  = carneNetaKg + grasaKg;
  const grasaPct      = carneNetaKg > 0 ? (grasaKg / carneNetaKg) * 100 : 0;
  const grasaIdeal    = carneNetaKg * (GRASA_TARGET_PCT / 100);
  const qty           = parseInt(medallones) || 0;
  const avgGrams      = qty > 0 ? ((totalBlendKg - wasteKg) / qty) * 1000 : 0;

  // Diferencia de grasa vs objetivo
  const grasaDiff     = grasaKg - grasaIdeal;
  const grasaOk       = Math.abs(grasaPct - GRASA_TARGET_PCT) <= 2;

  const canAdvance2   = carneNetaKg > 0 && grasaKg > 0;
  const canFinish     = qty > 0;

  const handleAdvance = () => {
    setPaso2DurSeg(timer2.elapsed);
    setSubStep('medallones');
  };

  const handleConfirm = () => {
    onFinish({
      stockDestino: 'Stock Burger',
      grasaKg,
      units: qty,
      wasteKg,
      totalBlendKg,
      carneNetaKg,
      grasaPct,
      paso2DurSeg,
    });
  };

  // ── PASO 2: PESAJE ──────────────────────────────────────────────────────────
  if (subStep === 'peso') {
    return (
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <ChevronLeft size={20} /> VOLVER
          </button>
          <div className="text-center">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">PASO 2 — BURGER</p>
            <h2 className="text-2xl font-black text-blue-700">⚖️ Pesaje y Separación</h2>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
            <Clock size={16} className="text-green-400" />
            <span className="font-mono font-black text-green-400">{timer2.fmt}</span>
          </div>
        </div>

        {/* Carnes que entran */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <p className="text-xs font-black text-blue-600 uppercase mb-2">Carnes brutas del paso 1</p>
          <div className="flex flex-wrap gap-3">
            {productions.map(p => (
              <div key={p.id} className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm">
                <span className="font-bold text-slate-600">{p.typeName}</span>
                <span className="font-black text-blue-700 ml-2">{formatWeight(p.weightKg)} kg</span>
              </div>
            ))}
            <div className="bg-blue-600 rounded-xl px-3 py-2 text-sm">
              <span className="font-bold text-blue-200">TOTAL</span>
              <span className="font-black text-white ml-2">{formatWeight(productions.reduce((s,p) => s + p.weightKg, 0))} kg</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {/* Carne neta limpia */}
          <BigInput
            label="🥩 Carne neta limpia"
            sublabel="Peso real de carne limpia pesada"
            value={carneNeta} onChange={setCarneNeta}
            unit="KG" color="blue" autoFocus required
          />

          {/* Grasa separada - la ingresan */}
          <div className="bg-white border-2 border-orange-100 rounded-3xl p-5 shadow-sm">
            <div className="mb-3">
              <h4 className="font-black text-slate-800 text-base">🫙 Grasa separada <span className="text-red-500">*</span></h4>
              <p className="text-xs text-slate-400">La que sacaste de los cortes</p>
            </div>
            <div className="relative">
              <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                value={grasaUtil} onChange={e => setGrasaUtil(e.target.value)}
                className="w-full p-4 text-5xl font-black text-center border-2 border-orange-200 bg-orange-50 text-orange-600 rounded-2xl outline-none focus:border-orange-500 transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-300">KG</span>
            </div>
          </div>

          {/* Grasa a agregar - calculada automáticamente */}
          <div className={`border-2 rounded-3xl p-5 shadow-sm ${carneNetaKg > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
            <div className="mb-3">
              <h4 className="font-black text-slate-800 text-base">📐 Grasa a agregar</h4>
              <p className="text-xs text-slate-400">Calculada para llegar al {GRASA_TARGET_PCT}% sobre carne neta</p>
            </div>
            {carneNetaKg > 0 ? (
              <>
                <div className="text-center py-3">
                  <span className="text-6xl font-black text-amber-700">{formatWeight(grasaIdeal)}</span>
                  <span className="text-2xl font-bold text-amber-500 ml-2">kg</span>
                </div>
                {grasaKg > 0 && (
                  <div className={`mt-3 flex items-center justify-center gap-2 p-2 rounded-xl text-sm font-black
                    ${grasaOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {grasaOk
                      ? '✓ Grasa OK'
                      : `${grasaDiff > 0 ? 'Sobran' : 'Faltan'} ${formatWeight(Math.abs(grasaDiff))} kg`}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-slate-300">
                <p className="text-2xl font-black">—</p>
                <p className="text-xs">Ingresá la carne neta primero</p>
              </div>
            )}
          </div>

          {/* Desperdicio */}
          <BigInput
            label="🗑️ Desperdicio"
            sublabel="Hueso, sebo descartado, merma"
            value={desperdicio} onChange={setDesperdicio}
            unit="KG" color="red"
          />
        </div>

        {/* Resumen previo */}
        {carneNetaKg > 0 && grasaKg > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Carne neta</p>
              <p className="text-2xl font-black text-blue-700">{formatWeight(carneNetaKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Grasa ({grasaPct.toFixed(1)}%)</p>
              <p className="text-2xl font-black text-orange-600">{formatWeight(grasaKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Total blend</p>
              <p className="text-2xl font-black text-slate-800">{formatWeight(totalBlendKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Desperdicio</p>
              <p className="text-2xl font-black text-red-500">{wasteKg > 0 ? formatWeight(wasteKg) + ' kg' : '—'}</p>
            </div>
          </div>
        )}

        <button onClick={handleAdvance} disabled={!canAdvance2}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3
            ${canAdvance2 ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <CheckCircle2 size={24} /> CONFIRMAR PESAJE → PASO 3
        </button>
      </div>
    );
  }

  // ── PASO 3: MEDALLONES ──────────────────────────────────────────────────────
  if (subStep === 'medallones' || subStep === 'confirm') {
    return (
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setSubStep('peso')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <ChevronLeft size={20} /> VOLVER
          </button>
          <div className="text-center">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">PASO 3 — BURGER</p>
            <h2 className="text-2xl font-black text-green-700">🍔 Medallones</h2>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
            <Clock size={16} className="text-green-400" />
            <span className="font-mono font-black text-green-400 text-sm">Paso 2: {Math.floor(paso2DurSeg/60).toString().padStart(2,'0')}:{(paso2DurSeg%60).toString().padStart(2,'0')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cantidad medallones */}
          <div className="space-y-5">
            <div className="bg-white border-2 border-green-200 rounded-3xl p-6 shadow-sm">
              <div className="mb-4">
                <h4 className="font-black text-slate-800 text-lg">🍔 Cantidad de medallones <span className="text-red-500">*</span></h4>
                <p className="text-xs text-slate-400">Unidades totales producidas</p>
                {totalBlendKg > 0 && (
                  <p className="text-xs font-bold text-green-600 mt-1">
                    Blend disponible: {formatWeight(totalBlendKg - wasteKg)} kg neto
                  </p>
                )}
              </div>
              <div className="relative">
                <input type="number" inputMode="numeric" placeholder="0"
                  value={medallones} onChange={e => setMedallones(e.target.value)} autoFocus
                  className="w-full p-5 text-6xl font-black text-center border-2 border-green-200 bg-green-50 text-green-600 rounded-2xl outline-none focus:border-green-500 focus:bg-white transition-all"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-green-300">u</span>
              </div>
              {qty > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-amber-600 font-black uppercase mb-1">Peso promedio por medallón</p>
                  <p className="text-4xl font-black text-amber-700">{formatGrams(avgGrams)} <span className="text-xl font-bold text-amber-500">gr</span></p>
                </div>
              )}
            </div>

            {/* Stock destino */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <span className="font-black text-blue-700 text-sm uppercase">Stock destino</span>
              <span className="font-black text-blue-800">🍔 Stock Burger</span>
            </div>
          </div>

          {/* Resumen completo */}
          <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm">
            <h4 className="font-black text-slate-800 text-base mb-4">📋 Resumen final</h4>
            <div className="space-y-2">
              <SRow label="Carne neta" value={`${formatWeight(carneNetaKg)} kg`} />
              <SRow label={`Grasa (${grasaPct.toFixed(1)}%)`} value={`+ ${formatWeight(grasaKg)} kg`} color="text-orange-600" bg="bg-orange-50" />
              <SRow label="Total blend" value={`${formatWeight(totalBlendKg)} kg`} color="text-blue-700 text-lg" bg="bg-blue-50 border border-blue-200" />
              {wasteKg > 0 && <SRow label="Desperdicio" value={`- ${formatWeight(wasteKg)} kg`} color="text-red-600" bg="bg-red-50" />}
              <SRow label="Peso neto" value={`${formatWeight(totalBlendKg - wasteKg)} kg`} color="text-green-700 text-lg" bg="bg-green-50 border border-green-200" />
              <SRow label="Medallones" value={qty > 0 ? `${qty} u` : '—'} color="text-green-700 text-xl" bg="bg-green-50 border border-green-200" />
              {qty > 0 && <SRow label="Peso prom/u" value={`${formatGrams(avgGrams)} gr`} color="text-amber-700 text-lg" bg="bg-amber-50 border border-amber-200" />}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-400 text-center">
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="font-bold uppercase">Timer paso 2</p>
                  <p className="font-black text-slate-600">{Math.floor(paso2DurSeg/60)}:{(paso2DurSeg%60).toString().padStart(2,'0')} min</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="font-bold uppercase">% grasa final</p>
                  <p className={`font-black ${grasaOk ? 'text-green-600' : 'text-amber-600'}`}>{grasaPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleConfirm} disabled={!canFinish}
          className={`w-full mt-8 py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
            ${canFinish ? 'bg-green-600 text-white hover:bg-green-500 shadow-xl active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <CheckCircle2 size={28} /> CONFIRMAR PRODUCCIÓN → STOCK BURGER
        </button>
      </div>
    );
  }

  return null;
}