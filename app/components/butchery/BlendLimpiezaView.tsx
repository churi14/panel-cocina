"use client";
import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
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
  const [cortes, setCortes] = useState<CorteDatos[]>(
    productions.map(p => ({ production: p, grasaKg: '', carneLinpiaKg: '' }))
  );
  const [submitting, setSubmitting] = useState(false);

  const setField = (idx: number, field: 'grasaKg' | 'carneLinpiaKg', val: string) => {
    setCortes(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const parsed = cortes.map(c => ({
    production: c.production,
    grasa: parseFloat(c.grasaKg.replace(',', '.')) || 0,
    carne: parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0,
    desperdicio: Math.max(0, parseFloat(
      (c.production.weightKg - (parseFloat(c.grasaKg.replace(',', '.')) || 0) - (parseFloat(c.carneLinpiaKg.replace(',', '.')) || 0)).toFixed(3)
    )),
  }));

  const totalCarne  = parsed.reduce((s, c) => s + c.carne, 0);
  const totalGrasa  = parsed.reduce((s, c) => s + c.grasa, 0);
  const totalDesp   = parsed.reduce((s, c) => s + c.desperdicio, 0);
  const totalBruto  = productions.reduce((s, p) => s + p.weightKg, 0);
  const canFinish   = parsed.every(c => c.carne > 0);

  const blendNombre = `Blend ${productions.map(p => (p.typeName ?? '').replace(/_L$/, '').trim()).join(' + ')}`;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pb-10">

      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-base mb-4 mt-2 px-2 py-2 rounded-xl hover:bg-slate-100 transition-all">
        <ArrowLeft size={18} /> Volver
      </button>

      {/* Header blend */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-black mb-2">
          🍔 BLEND — {productions.length} cortes
        </div>
        <p className="text-slate-500 text-sm">
          Peso bruto total: <span className="font-black text-slate-800">{totalBruto.toFixed(3)} kg</span>
        </p>
        <p className="text-xs text-blue-600 font-bold mt-1">
          Ingresá los kg de cada corte por separado — se van a sumar en un solo blend
        </p>
      </div>

      <div className="space-y-4">
        {cortes.map((corte, idx) => {
          const p = parsed[idx];
          const corteNorm = (corte.production.typeName ?? '').replace(/_L$/, '').trim();
          return (
            <div key={corte.production.id}
              className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">

              {/* Header del corte */}
              <div className="bg-slate-800 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-base">🔪 {corteNorm}</span>
                  <span className="text-slate-400 text-xs font-bold">→ {corteNorm}_L</span>
                </div>
                <span className="text-slate-300 text-sm font-black">{corte.production.weightKg} kg bruto</span>
              </div>

              <div className="p-4 space-y-3">
                {/* Grasa */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                  <p className="text-xs font-black text-amber-700 mb-2">🫙 Grasa usable</p>
                  <div className="relative">
                    <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                      value={corte.grasaKg} onChange={e => setField(idx, 'grasaKg', e.target.value)}
                      className="w-full py-3 px-4 text-2xl font-black text-center text-amber-600 bg-white border-2 border-amber-200 rounded-xl outline-none focus:border-amber-400" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-amber-300">KG</span>
                  </div>
                </div>

                {/* Carne limpia */}
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

                {/* Desperdicio */}
                <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  <span className="text-sm font-black text-slate-500">🗑️ Desperdicio</span>
                  <span className="text-xl font-black text-red-500">{p.desperdicio.toFixed(3)} kg</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Resumen total */}
        {canFinish && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
            <p className="font-black text-blue-800 text-sm mb-2">📊 Resumen del blend</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Bruto total</span>
              <span className="font-black text-slate-700">{totalBruto.toFixed(3)} kg</span>
            </div>
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
            <div className="flex justify-between text-sm border-t border-blue-200 pt-2 mt-1">
              <span className="text-slate-500">Desperdicio total</span>
              <span className="font-black text-red-500">{totalDesp.toFixed(3)} kg</span>
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            if (!canFinish || submitting) return;
            setSubmitting(true);
            await onFinish(parsed.map(p => ({
              production: p.production,
              grasaKg: p.grasa,
              carneLinpiaKg: p.carne,
              desperdicioKg: p.desperdicio,
            })));
          }}
          disabled={!canFinish || submitting}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3
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
    </div>
  );
}
