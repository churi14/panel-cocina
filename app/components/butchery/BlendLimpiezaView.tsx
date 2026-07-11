"use client";
import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, Zap, ClipboardList } from 'lucide-react';
import { ButcheryProduction } from '../../types';

type CorteDatos = {
  production: ButcheryProduction;
  grasaKg: string;
  carneLinpiaKg: string;
};

type CorteRapido = {
  production: ButcheryProduction;
  pesoTotal: string; // peso limpio total (carne + grasa sin separar)
};

type Props = {
  productions: ButcheryProduction[];
  onFinish: (cortes: { production: ButcheryProduction; grasaKg: number; carneLinpiaKg: number; desperdicioKg: number }[]) => void;
  onBack: () => void;
};

const GRASA_RAPIDA_PCT = 0.15; // 15% auto en modo rápido

export default function BlendLimpiezaView({ productions, onFinish, onBack }: Props) {
  const [modo, setModo] = useState<'rapida' | 'normal'>('rapida');

  // ── Modo normal ──────────────────────────────────────────────────────────────
  const [cortes, setCortes] = useState<CorteDatos[]>(
    productions.map(p => ({ production: p, grasaKg: '', carneLinpiaKg: '' }))
  );

  // ── Modo rápido ──────────────────────────────────────────────────────────────
  const [cortesRapido, setCortesRapido] = useState<CorteRapido[]>(
    productions.map(p => ({ production: p, pesoTotal: '' }))
  );

  const [submitting, setSubmitting] = useState(false);

  const setField = (idx: number, field: 'grasaKg' | 'carneLinpiaKg', val: string) => {
    setCortes(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const setPesoTotal = (idx: number, val: string) => {
    setCortesRapido(prev => prev.map((c, i) => i === idx ? { ...c, pesoTotal: val } : c));
  };

  // ── Cálculos modo normal ──────────────────────────────────────────────────
  const parsedNormal = cortes.map(c => ({
    production: c.production,
    grasa: parseFloat(c.grasaKg.replace(',', '.')) || 0,
    carne: parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0,
    desperdicio: Math.max(0, parseFloat(
      (c.production.weightKg - (parseFloat(c.grasaKg.replace(',', '.')) || 0) - (parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0)).toFixed(3)
    )),
  }));

  // ── Cálculos modo rápido ──────────────────────────────────────────────────
  const parsedRapido = cortesRapido.map(c => {
    const total = parseFloat(c.pesoTotal.replace(',', '.')) || 0;
    const grasa = parseFloat((total * GRASA_RAPIDA_PCT).toFixed(3));
    const carne = parseFloat((total * (1 - GRASA_RAPIDA_PCT)).toFixed(3));
    const desperdicio = Math.max(0, parseFloat((c.production.weightKg - total).toFixed(3)));
    return { production: c.production, total, grasa, carne, desperdicio };
  });

  const parsed = modo === 'rapida' ? parsedRapido : parsedNormal;

  const totalBruto  = productions.reduce((s, p) => s + p.weightKg, 0);
  const totalCarne  = parsed.reduce((s, c) => s + c.carne, 0);
  const totalGrasa  = parsed.reduce((s, c) => s + c.grasa, 0);
  const totalDesp   = parsed.reduce((s, c) => s + c.desperdicio, 0);
  const totalLimpio = modo === 'rapida'
    ? parsedRapido.reduce((s, c) => s + c.total, 0)
    : totalCarne + totalGrasa;

  const canFinish = modo === 'rapida'
    ? parsedRapido.every(c => c.total > 0 && c.total <= c.production.weightKg * 1.02)
    : parsedNormal.every(c => c.carne > 0);

  const blendNombre = `Blend ${productions.map(p => (p.typeName ?? '').replace(/_L$/, '').trim()).join(' + ')}`;

  const handleConfirm = async () => {
    if (!canFinish || submitting) return;
    setSubmitting(true);
    if (modo === 'rapida') {
      await onFinish(parsedRapido.map(p => ({
        production: p.production,
        grasaKg: p.grasa,
        carneLinpiaKg: p.carne,
        desperdicioKg: p.desperdicio,
      })));
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

      {/* Selector de modo */}
      <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setModo('rapida')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all
            ${modo === 'rapida' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Zap size={16} className={modo === 'rapida' ? 'text-amber-500' : ''} />
          ⚡ Carga Rápida
        </button>
        <button
          onClick={() => setModo('normal')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all
            ${modo === 'normal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ClipboardList size={16} />
          📋 Normal
        </button>
      </div>

      {/* ── MODO RÁPIDO ── */}
      {modo === 'rapida' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800 font-bold">
            ⚡ Pesá el total limpio de cada corte (sin separar la grasa). El sistema asigna <strong>15% como grasa</strong> automáticamente.
          </div>

          {cortesRapido.map((corte, idx) => {
            const p = parsedRapido[idx];
            const corteNorm = (corte.production.typeName ?? '').replace(/_L$/, '').trim();
            const excede = p.total > corte.production.weightKg * 1.02;
            return (
              <div key={corte.production.id}
                className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
                  <span className="text-white font-black text-base">🔪 {corteNorm}</span>
                  <span className="text-slate-300 text-sm font-black">{corte.production.weightKg} kg bruto</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Peso total limpio */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                    <p className="text-xs font-black text-blue-700 mb-2">⚖️ Peso total limpio (carne + grasa juntas)</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                        value={corte.pesoTotal} onChange={e => setPesoTotal(idx, e.target.value)}
                        className="w-full py-3 px-4 text-2xl font-black text-center text-blue-600 bg-white border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-blue-300">KG</span>
                    </div>
                    {excede && <p className="text-xs text-red-600 font-bold mt-1">⚠️ Supera el peso bruto ({corte.production.weightKg} kg)</p>}
                  </div>

                  {/* Auto-cálculo */}
                  {p.total > 0 && !excede && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-green-600 font-black">Carne (85%)</p>
                        <p className="text-lg font-black text-green-700">{p.carne.toFixed(3)} kg</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-amber-600 font-black">Grasa (15%)</p>
                        <p className="text-lg font-black text-amber-600">{p.grasa.toFixed(3)} kg</p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-slate-500 font-black">Desperdicio</p>
                        <p className="text-lg font-black text-red-500">{p.desperdicio.toFixed(3)} kg</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Resumen rápido */}
          {canFinish && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="font-black text-blue-800 text-sm mb-2">📊 Resumen del blend</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Bruto total</span>
                <span className="font-black text-slate-700">{totalBruto.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Limpio total pesado</span>
                <span className="font-black text-slate-700">{totalLimpio.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Carne (85%) → <span className="font-black text-blue-700">{blendNombre}</span></span>
                <span className="font-black text-green-700">+{totalCarne.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Grasa (15%) → Grasa de Pella</span>
                <span className="font-black text-amber-600">+{totalGrasa.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                <span className="text-slate-500">Desperdicio</span>
                <span className="font-black text-red-500">{totalDesp.toFixed(3)} kg</span>
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

          {canFinish && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
              <p className="font-black text-blue-800 text-sm mb-2">📊 Resumen del blend</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Carne limpia total → <span className="font-black text-blue-700">{blendNombre}</span></span>
                <span className="font-black text-green-700">+{totalCarne.toFixed(3)} kg</span>
              </div>
              {totalGrasa > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Grasa → Grasa de Pella</span>
                  <span className="font-black text-orange-600">+{totalGrasa.toFixed(3)} kg</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-blue-200 pt-2">
                <span className="text-slate-500">Desperdicio total</span>
                <span className="font-black text-red-500">{totalDesp.toFixed(3)} kg</span>
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
