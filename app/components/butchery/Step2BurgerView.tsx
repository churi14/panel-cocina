"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Scale, Flame, Trash2, Package, ChevronLeft, Clock, AlertTriangle } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import { formatWeight, formatGrams } from './cuts';

const GRASA_TARGET_PCT = 34; // % objetivo de grasa sobre carne neta
const GRASA_TOLERANCE_G = 100; // tolerancia ±100 gramos para considerar OK

export type BurgerBlendResult = {
  stockDestino: string;
  grasaKg: number;       // grasa total usada (ideal = carne * 0.34)
  units: number;
  wasteKg: number;       // desperdicio auto-calculado
  totalBlendKg: number;  // carne neta + grasa ideal
  carneNetaKg: number;
  grasaPct: number;
  paso2DurSeg: number;
  grasaSeparadaKg: number; // la que sacaron de los cortes
  grasaExtraKg: number;    // la que agregaron del stock
};

// ─── Timer hook — arranca desde step2StartTime real, no remontea ──────────────
function useTimer(step2StartTime: number) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - step2StartTime) / 1000));
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - step2StartTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [step2StartTime]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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
        <input
          type="number" inputMode="decimal" step="0.001" placeholder="0,000"
          value={value} onChange={e => onChange(e.target.value)}
          className={`w-full p-4 text-5xl font-black text-center border-2 rounded-2xl outline-none transition-all ${colors[color]}`}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">{unit}</span>
      </div>
    </div>
  );
}

// ─── Fila resumen ─────────────────────────────────────────────────────────────
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
export function Step2BurgerView({ productions, step2StartTime, onFinish, onBack }: {
  productions: ButcheryProduction[];
  step2StartTime: number;
  onFinish: (result: BurgerBlendResult) => void;
  onBack: () => void;
}) {
  const [subStep, setSubStep] = useState<'peso' | 'medallones'>('peso');

  // Inputs de paso 2
  const [carneNeta, setCarneNeta]   = useState('');
  const [grasaSep,  setGrasaSep]    = useState(''); // grasa separada de los cortes

  // Timer continuo desde step2StartTime real
  const timer2 = useTimer(step2StartTime);

  // Paso 3
  const [medallones, setMedallones] = useState('');
  const [paso2DurSeg, setPaso2DurSeg] = useState(0);

  // ── Cálculos principales ──────────────────────────────────────────────────
  const totalBrutoKg    = productions.reduce((s, p) => s + p.weightKg, 0);
  const carneNetaKg     = parseFloat(carneNeta.replace(',', '.'))  || 0;
  const grasaSepKg      = parseFloat(grasaSep.replace(',', '.'))   || 0;

  // Objetivo de grasa: 34% sobre carne neta
  const grasaIdealKg    = carneNetaKg * (GRASA_TARGET_PCT / 100);

  // Grasa extra que hay que agregar del stock (puede ser 0 si se separó suficiente)
  const grasaExtraKg    = Math.max(0, grasaIdealKg - grasaSepKg);

  // Grasa total que va al blend (lo que se separó + lo que se agrega = ideal)
  const grasaTotalKg    = Math.min(grasaSepKg, grasaIdealKg) + grasaExtraKg;
  // Nota: si grasaSep > grasaIdeal, el exceso va a desperdicio

  // Total blend = carne neta + grasa ideal (proyectado, asumiendo que agregan lo necesario)
  const totalBlendKg    = carneNetaKg + grasaIdealKg;

  // Desperdicio = lo que sobra del bruto al separar carne y grasa
  // (bones, sebo descartado, merma). Auto-calculado, no manual.
  const wasteAutoKg     = Math.max(0, totalBrutoKg - carneNetaKg - grasaSepKg);

  // % de grasa real sobre carne neta
  const grasaPct        = carneNetaKg > 0 ? (grasaIdealKg / carneNetaKg) * 100 : 0;

  // ¿Falta grasa? Diferencia en gramos
  const grasaFaltaKg    = grasaIdealKg - grasaSepKg;
  const grasaFaltaGr    = grasaFaltaKg * 1000;
  const grasaOk         = grasaFaltaKg <= GRASA_TOLERANCE_G / 1000; // ≤ 100g de diferencia

  // Medallones
  const qty             = parseInt(medallones) || 0;
  const avgGrams        = qty > 0 ? (totalBlendKg / qty) * 1000 : 0;

  const canAdvance2     = carneNetaKg > 0 && grasaSepKg >= 0;
  const canFinish       = qty > 0;

  const handleAdvance = () => {
    setPaso2DurSeg(timer2.elapsed);
    setSubStep('medallones');
  };

  const handleConfirm = () => {
    onFinish({
      stockDestino:    'Stock Burger',
      grasaKg:         grasaIdealKg,      // grasa total usada (la ideal)
      units:           qty,
      wasteKg:         wasteAutoKg,
      totalBlendKg,
      carneNetaKg,
      grasaPct,
      paso2DurSeg,
      grasaSeparadaKg: grasaSepKg,
      grasaExtraKg,
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
          {/* Timer continuo — sigue aunque vuelvas para atrás */}
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
            <Clock size={16} className="text-green-400" />
            <span className="font-mono font-black text-green-400">{timer2.fmt}</span>
          </div>
        </div>

        {/* Carnes que entran (del paso 1) */}
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
              <span className="font-black text-white ml-2">{formatWeight(totalBrutoKg)} kg</span>
            </div>
          </div>
        </div>

        {/* Inputs: solo carne neta y grasa separada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <BigInput
            label="🥩 Carne neta limpia"
            sublabel="Peso real de carne limpia pesada"
            value={carneNeta} onChange={setCarneNeta}
            unit="KG" color="blue" required
          />

          <BigInput
            label="🫙 Grasa separada de los cortes"
            sublabel="Solo la que extrajiste durante la limpieza"
            value={grasaSep} onChange={setGrasaSep}
            unit="KG" color="orange" required
          />
        </div>

        {/* Panel calculado automáticamente */}
        {carneNetaKg > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

            {/* Grasa a agregar del stock */}
            <div className={`rounded-2xl p-5 border-2 ${grasaOk ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
              <p className="text-xs font-black uppercase text-slate-500 mb-1">📐 Objetivo grasa (34%)</p>
              <p className="text-3xl font-black text-slate-800">{formatWeight(grasaIdealKg)} <span className="text-lg font-bold text-slate-400">kg</span></p>
              {grasaSepKg > 0 && (
                <div className={`mt-3 rounded-xl p-2 text-center text-sm font-black ${grasaOk ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {grasaOk ? '✓ Grasa OK' : grasaFaltaKg > 0 ? '⚠ Ver aviso abajo' : `Sobran ${formatWeight(Math.abs(grasaFaltaKg))} kg`}
                </div>
              )}
              {grasaSepKg === 0 && (
                <p className="text-xs text-slate-400 mt-2">Ingresá la grasa separada →</p>
              )}
            </div>

            {/* Desperdicio auto-calculado */}
            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5">
              <p className="text-xs font-black uppercase text-slate-500 mb-1">🗑️ Desperdicio (auto)</p>
              <p className="text-3xl font-black text-red-600">
                {carneNetaKg > 0 ? formatWeight(wasteAutoKg) : '—'} <span className="text-lg font-bold text-red-300">kg</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">Bruto − Neta − Grasa sep.</p>
            </div>

            {/* Total blend proyectado */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5">
              <p className="text-xs font-black uppercase text-slate-500 mb-1">⚡ Total blend</p>
              <p className="text-3xl font-black text-blue-700">
                {formatWeight(totalBlendKg)} <span className="text-lg font-bold text-blue-400">kg</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">Neta + Grasa ideal (34%)</p>
              {grasaExtraKg > 0 && (
                <p className="text-xs font-black text-amber-600 mt-1">
                  + {formatWeight(grasaExtraKg)} kg del stock de grasa
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resumen previo completo */}
        {carneNetaKg > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Carne neta</p>
              <p className="text-2xl font-black text-blue-700">{formatWeight(carneNetaKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Grasa ({grasaPct.toFixed(1)}%)</p>
              <p className="text-2xl font-black text-orange-600">{formatWeight(grasaIdealKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Total blend</p>
              <p className="text-2xl font-black text-slate-800">{formatWeight(totalBlendKg)} kg</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Desperdicio</p>
              <p className="text-2xl font-black text-red-500">{formatWeight(wasteAutoKg)} kg</p>
            </div>
          </div>
        )}

        {/* ─── AVISO GRASA A AGREGAR — tamaño grande, imposible de ignorar ─── */}
        {grasaExtraKg > 0.001 && carneNetaKg > 0 && (
          <div className="mb-5 rounded-3xl border-4 border-amber-400 bg-amber-50 shadow-lg overflow-hidden">
            <div className="bg-amber-400 px-6 py-3 flex items-center gap-3">
              <AlertTriangle size={24} className="text-white shrink-0" />
              <span className="text-white font-black text-lg uppercase tracking-wide">Agregar grasa del stock</span>
            </div>
            <div className="px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-7xl font-black text-amber-700">{formatWeight(grasaExtraKg)}</span>
                <span className="text-3xl font-black text-amber-500">kg</span>
                <span className="text-4xl font-black text-amber-400 mx-2">/</span>
                <span className="text-5xl font-black text-amber-600">{Math.round(grasaExtraKg * 1000)}</span>
                <span className="text-3xl font-black text-amber-500">gr</span>
              </div>
              <div className="text-right text-sm text-amber-700 space-y-1">
                <p className="font-bold">Separados: <span className="font-black">{formatWeight(grasaSepKg)} kg</span></p>
                <p className="font-bold">Objetivo (34%): <span className="font-black">{formatWeight(grasaIdealKg)} kg</span></p>
              </div>
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
  if (subStep === 'medallones') {
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
          {/* Muestra el tiempo total del paso 2 */}
          <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl">
            <Clock size={16} className="text-green-400" />
            <span className="font-mono font-black text-green-400 text-sm">
              Paso 2: {Math.floor(paso2DurSeg / 60).toString().padStart(2, '0')}:{(paso2DurSeg % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input cantidad medallones */}
          <div className="space-y-5">
            <div className="bg-white border-2 border-green-200 rounded-3xl p-6 shadow-sm">
              <div className="mb-4">
                <h4 className="font-black text-slate-800 text-lg">🍔 Cantidad de medallones <span className="text-red-500">*</span></h4>
                <p className="text-xs text-slate-400">Unidades totales producidas</p>
                {totalBlendKg > 0 && (
                  <p className="text-xs font-bold text-green-600 mt-1">
                    Blend total: {formatWeight(totalBlendKg)} kg
                  </p>
                )}
              </div>
              <div className="relative">
                <input
                  type="number" inputMode="numeric" placeholder="0"
                  value={medallones} onChange={e => setMedallones(e.target.value)}
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
              <SRow
                label={`Grasa separada`}
                value={`${formatWeight(grasaSepKg)} kg`}
                color="text-orange-500" bg="bg-orange-50"
              />
              {grasaExtraKg > 0.001 && (
                <SRow
                  label={`+ Grasa del stock`}
                  value={`+ ${formatWeight(grasaExtraKg)} kg`}
                  color="text-amber-700 font-black"
                  bg="bg-amber-50 border border-amber-200"
                />
              )}
              <SRow
                label={`Grasa total (${grasaPct.toFixed(1)}%)`}
                value={`${formatWeight(grasaIdealKg)} kg`}
                color="text-orange-600"
                bg="bg-orange-50"
              />
              <SRow
                label="Total blend"
                value={`${formatWeight(totalBlendKg)} kg`}
                color="text-blue-700 text-lg"
                bg="bg-blue-50 border border-blue-200"
              />
              <SRow
                label="Desperdicio (auto)"
                value={`- ${formatWeight(wasteAutoKg)} kg`}
                color="text-red-500"
                bg="bg-red-50"
              />
              <SRow label="Medallones" value={qty > 0 ? `${qty} u` : '—'} color="text-green-700 text-xl" bg="bg-green-50 border border-green-200" />
              {qty > 0 && (
                <SRow label="Peso prom/u" value={`${formatGrams(avgGrams)} gr`} color="text-amber-700 text-lg" bg="bg-amber-50 border border-amber-200" />
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-400 text-center">
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="font-bold uppercase">Timer paso 2</p>
                  <p className="font-black text-slate-600">{Math.floor(paso2DurSeg / 60)}:{(paso2DurSeg % 60).toString().padStart(2, '0')} min</p>
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