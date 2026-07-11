"use client";
import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, Zap, ClipboardList, Minus, Plus } from 'lucide-react';
import { ButcheryProduction } from '../../types';

type CorteDatos = {
  production: ButcheryProduction;
  grasaKg: string;
  carneLinpiaKg: string;
};

type Props = {
  productions: ButcheryProduction[];
  onFinish: (cortes: { production: ButcheryProduction; grasaKg: number; carneLinpiaKg: number; desperdicioKg: number }[]) => void;
  onBack: () => void;
};

export default function BlendLimpiezaView({ productions, onFinish, onBack }: Props) {
  const [modo, setModo] = useState<'rapida' | 'normal'>('rapida');

  // ── Modo normal ──────────────────────────────────────────────────────────────
  const [cortes, setCortes] = useState<CorteDatos[]>(
    productions.map(p => ({ production: p, grasaKg: '', carneLinpiaKg: '' }))
  );

  // ── Modo rápido — UN SOLO peso total + selector de % grasa ────────────────────
  const [totalRapido, setTotalRapido] = useState('');
  const [grasaPctRapido, setGrasaPctRapido] = useState(15);

  const [submitting, setSubmitting] = useState(false);

  const totalBruto = productions.reduce((s, p) => s + p.weightKg, 0);
  const blendNombre = `Blend ${productions.map(p => (p.typeName ?? '').replace(/_L$/, '').trim()).join(' + ')}`;

  // ── Cálculos modo rápido ──────────────────────────────────────────────────
  const totalCarneRapido = parseFloat(totalRapido.replace(',', '.')) || 0;
  const grasaPctFrac = grasaPctRapido / 100;
  // grasa = X% del blend total → grasa = carne * pct/(1-pct)
  const grasaAgregar = totalCarneRapido > 0
    ? parseFloat((totalCarneRapido * grasaPctFrac / (1 - grasaPctFrac)).toFixed(3))
    : 0;
  const totalBlendPicar = parseFloat((totalCarneRapido + grasaAgregar).toFixed(3));
  const desperdicioRapido = Math.max(0, parseFloat((totalBruto - totalCarneRapido).toFixed(3)));
  const excedeRapido = totalCarneRapido > totalBruto * 1.02;
  const canFinishRapido = totalCarneRapido > 0 && !excedeRapido;

  // ── Cálculos modo normal ──────────────────────────────────────────────────
  const parsedNormal = cortes.map(c => ({
    production: c.production,
    grasa: parseFloat(c.grasaKg.replace(',', '.')) || 0,
    carne: parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0,
    desperdicio: Math.max(0, parseFloat(
      (c.production.weightKg - (parseFloat(c.grasaKg.replace(',', '.')) || 0) - (parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0)).toFixed(3)
    )),
  }));
  const totalCarneNormal = parsedNormal.reduce((s, c) => s + c.carne, 0);
  const totalGrasaNormal = parsedNormal.reduce((s, c) => s + c.grasa, 0);
  const totalDespNormal = parsedNormal.reduce((s, c) => s + c.desperdicio, 0);
  const canFinishNormal = parsedNormal.every(c => c.carne > 0);

  const canFinish = modo === 'rapida' ? canFinishRapido : canFinishNormal;

  const setField = (idx: number, field: 'grasaKg' | 'carneLinpiaKg', val: string) => {
    setCortes(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const handleConfirm = async () => {
    if (!canFinish || submitting) return;
    setSubmitting(true);
    if (modo === 'rapida') {
      // Distribuir el total proporcionalmente por peso bruto de cada corte
      const result = productions.map(p => {
        const ratio = totalBruto > 0 ? p.weightKg / totalBruto : 1 / productions.length;
        const carne = parseFloat((totalCarneRapido * ratio).toFixed(3));
        const desp = Math.max(0, parseFloat((p.weightKg - carne).toFixed(3)));
        return { production: p, grasaKg: 0, carneLinpiaKg: carne, desperdicioKg: desp };
      });
      await onFinish(result);
    } else {
      await onFinish(parsedNormal.map(p => ({
        production: p.production,
        grasaKg: p.grasa,
        carneLinpiaKg: p.carne,
        desperdicioKg: p.desperdicio,
      })));
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pb-10">

      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-base mb-4 mt-2 px-2 py-2 rounded-xl hover:bg-slate-100 transition-all">
        <ArrowLeft size={18} /> Volver
      </button>

      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-black mb-2">
          🍔 BLEND — {productions.length} cortes
        </div>
        <p className="text-slate-500 text-sm">
          Peso bruto total: <span className="font-black text-slate-800">{totalBruto.toFixed(3)} kg</span>
        </p>
      </div>

      {/* Selector de modo — más visible */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setModo('rapida')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all border-2
            ${modo === 'rapida'
              ? 'bg-amber-400 border-amber-400 text-slate-900 shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50'}`}>
          <Zap size={16} className={modo === 'rapida' ? 'text-slate-900' : 'text-amber-500'} />
          ⚡ Carga Rápida
        </button>
        <button
          onClick={() => setModo('normal')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all border-2
            ${modo === 'normal'
              ? 'bg-slate-800 border-slate-800 text-white shadow-lg scale-[1.02]'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}`}>
          <ClipboardList size={16} />
          📋 Normal
        </button>
      </div>

      {/* ── MODO RÁPIDO ── */}
      {modo === 'rapida' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800 font-bold">
            ⚡ Ingresá el peso <strong>total del blend limpiado</strong> (todos los cortes juntos). Luego ajustá el % de grasa y el sistema te dice cuánta agregar.
          </div>

          {/* Input total único */}
          <div className="bg-white border-2 border-blue-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
              <span className="text-white font-black text-base">⚖️ Peso total del blend limpiado</span>
              <span className="text-slate-300 text-sm font-black">{totalBruto.toFixed(3)} kg bruto</span>
            </div>
            <div className="p-4">
              <p className="text-xs font-black text-slate-500 mb-2 uppercase tracking-wide">
                {productions.map(p => (p.typeName ?? '').replace(/_L$/, '').trim()).join(' + ')} — todo junto, ya limpiado
              </p>
              <div className="relative">
                <input
                  type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                  value={totalRapido} onChange={e => setTotalRapido(e.target.value)}
                  className="w-full py-4 px-4 text-4xl font-black text-center text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-blue-300">KG</span>
              </div>
              {excedeRapido && (
                <p className="text-xs text-red-600 font-bold mt-2">⚠️ Supera el peso bruto total ({totalBruto.toFixed(3)} kg)</p>
              )}
              {totalCarneRapido > 0 && !excedeRapido && (
                <div className="mt-3 flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  <span className="text-sm font-black text-slate-500">🗑️ Desperdicio</span>
                  <span className="text-xl font-black text-red-500">{desperdicioRapido.toFixed(3)} kg</span>
                </div>
              )}
            </div>
          </div>

          {/* Selector de % de grasa */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
            <p className="text-sm font-black text-amber-900 mb-0.5">🫙 % Grasa de Pella a agregar</p>
            <p className="text-xs text-amber-600 mb-4">Se calcula sobre el peso total del blend final</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGrasaPctRapido(prev => Math.max(0, prev - 1))}
                className="w-14 h-14 rounded-xl bg-amber-200 hover:bg-amber-300 font-black text-amber-900 flex items-center justify-center transition-all active:scale-95 select-none">
                <Minus size={22} />
              </button>
              <div className="flex-1 text-center bg-white rounded-xl py-3 border-2 border-amber-200">
                <span className="text-5xl font-black text-amber-700">{grasaPctRapido}</span>
                <span className="text-2xl font-black text-amber-400 ml-1">%</span>
              </div>
              <button
                onClick={() => setGrasaPctRapido(prev => Math.min(50, prev + 1))}
                className="w-14 h-14 rounded-xl bg-amber-200 hover:bg-amber-300 font-black text-amber-900 flex items-center justify-center transition-all active:scale-95 select-none">
                <Plus size={22} />
              </button>
            </div>

            {totalCarneRapido > 0 && !excedeRapido && (
              <div className="mt-4 space-y-2 pt-3 border-t border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-800">🫙 Grasa de pella a agregar:</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-700">{grasaAgregar.toFixed(3)} kg</span>
                    <span className="text-base font-black text-amber-400 ml-2">/ {Math.round(grasaAgregar * 1000)} gr</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-700">🍔 Total blend para picar:</span>
                  <span className="text-2xl font-black text-blue-700">{totalBlendPicar.toFixed(3)} kg</span>
                </div>
              </div>
            )}
          </div>

          {/* Resumen cuando está listo */}
          {canFinishRapido && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="font-black text-blue-800 text-sm mb-2">📊 Resumen del blend</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Bruto total</span>
                <span className="font-black text-slate-700">{totalBruto.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Carne limpiada → <span className="font-black text-blue-700">{blendNombre}</span></span>
                <span className="font-black text-green-700">+{totalCarneRapido.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Grasa de pella a agregar ({grasaPctRapido}%)</span>
                <span className="font-black text-amber-600">+{grasaAgregar.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total blend para picar</span>
                <span className="font-black text-blue-700">{totalBlendPicar.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                <span className="text-slate-500">Desperdicio</span>
                <span className="font-black text-red-500">{desperdicioRapido.toFixed(3)} kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODO NORMAL ── */}
      {modo === 'normal' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-600 font-bold">
            📋 Ingresá carne limpia y grasa por separado para cada corte.
          </div>

          {cortes.map((corte, idx) => {
            const p = parsedNormal[idx];
            const corteNorm = (corte.production.typeName ?? '').replace(/_L$/, '').trim();
            return (
              <div key={corte.production.id}
                className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-base">🔪 {corteNorm}</span>
                    <span className="text-slate-400 text-xs font-bold">→ {corteNorm}_L</span>
                  </div>
                  <span className="text-slate-300 text-sm font-black">{corte.production.weightKg} kg bruto</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <p className="text-xs font-black text-amber-700 mb-2">🫙 Grasa usable</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                        value={corte.grasaKg} onChange={e => setField(idx, 'grasaKg', e.target.value)}
                        className="w-full py-3 px-4 text-2xl font-black text-center text-amber-600 bg-white border-2 border-amber-200 rounded-xl outline-none focus:border-amber-400" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-amber-300">KG</span>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
                    <p className="text-xs font-black text-green-700 mb-2">✅ Carne neta limpia <span className="text-red-500">*</span></p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                        value={corte.carneLinpiaKg} onChange={e => setField(idx, 'carneLinpiaKg', e.target.value)}
                        className="w-full py-3 px-4 text-2xl font-black text-center text-blue-600 bg-white border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-blue-300">KG</span>
                    </div>
                    {p.carne > 0 && p.carne > corte.production.weightKg * 1.05 && (
                      <p className="text-xs text-amber-600 font-bold mt-1.5">⚠️ Parece más que el bruto ({corte.production.weightKg} kg)</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                    <span className="text-sm font-black text-slate-500">🗑️ Desperdicio</span>
                    <span className="text-xl font-black text-red-500">{p.desperdicio.toFixed(3)} kg</span>
                  </div>
                </div>
              </div>
            );
          })}

          {canFinishNormal && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="font-black text-blue-800 text-sm mb-2">📊 Resumen del blend</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Carne limpia total → <span className="font-black text-blue-700">{blendNombre}</span></span>
                <span className="font-black text-green-700">+{totalCarneNormal.toFixed(3)} kg</span>
              </div>
              {totalGrasaNormal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Grasa → Grasa de Pella</span>
                  <span className="font-black text-orange-600">+{totalGrasaNormal.toFixed(3)} kg</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                <span className="text-slate-500">Desperdicio total</span>
                <span className="font-black text-red-500">{totalDespNormal.toFixed(3)} kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón confirmar */}
      <button
        onClick={handleConfirm}
        disabled={!canFinish || submitting}
        className={`w-full mt-6 py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3
          ${submitting
            ? 'bg-blue-600 text-white cursor-not-allowed opacity-80'
            : canFinish
              ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
        {submitting ? (
          <>
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Guardando blend...
          </>
        ) : (
          <><CheckCircle2 size={24} /> Confirmar blend — {productions.length} cortes</>
        )}
      </button>
    </div>
  );
}
