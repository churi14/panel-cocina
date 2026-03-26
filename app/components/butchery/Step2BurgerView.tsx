"use client";

import React, { useState } from 'react';
import { ChevronLeft, CheckCircle2, Package, Trash2, Scale, Flame } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import { formatWeight, formatGrams, ALL_STOCKS } from './cuts';
import { ChevronDown } from 'lucide-react';

// El paso 2 de burger es especial:
// Todas las carnes van al blend → se agrega grasa → se producen unidades de burger

export type BurgerBlendResult = {
  stockDestino: string;
  grasaKg: number;
  units: number;
  wasteKg: number;
  totalBlendKg: number;
};

export function Step2BurgerView({ productions, onFinish, onBack }: {
  productions: ButcheryProduction[];
  onFinish: (result: BurgerBlendResult) => void;
  onBack: () => void;
}) {
  const [grasaKg, setGrasaKg]     = useState('');
  const [units, setUnits]         = useState('');
  const [wasteKg, setWasteKg]     = useState('');
  const [stockDestino, setStockDestino] = useState('Stock Burger');
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const totalMeatKg  = productions.reduce((sum, p) => sum + p.weightKg, 0);
  const grasa        = parseFloat(grasaKg.replace(',', '.')) || 0;
  const qty          = parseInt(units) || 0;
  const waste        = parseFloat(wasteKg.replace(',', '.')) || 0;
  const totalBlend   = totalMeatKg + grasa;
  const grasaPct     = grasa > 0 ? ((grasa / totalMeatKg) * 100).toFixed(1) : null;
  const netBlend     = totalBlend - waste;
  const avgGrams     = qty > 0 ? (netBlend / qty) * 1000 : 0;
  const canFinish    = qty > 0 && waste >= 0 && waste < totalBlend;

  const handleConfirm = () => {
    onFinish({ stockDestino, grasaKg: grasa, units: qty, wasteKg: waste, totalBlendKg: totalBlend });
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">🍔 ¿Confirmar Blend?</h2>
            <p className="text-slate-400 text-sm mt-1">Revisá que todo esté bien</p>
          </div>

          <div className="space-y-2 mb-6">
            {/* Carnes del blend */}
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs font-black text-slate-400 uppercase mb-2">Carnes del blend</p>
              {productions.map(p => (
                <div key={p.id} className="flex justify-between items-center py-1">
                  <span className="text-sm font-bold text-slate-600">{p.typeName}</span>
                  <span className="text-sm font-black text-slate-800">{formatWeight(p.weightKg)} kg</span>
                </div>
              ))}
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-2">
                <span className="text-sm font-black text-slate-700">Total carne</span>
                <span className="font-black text-slate-800">{formatWeight(totalMeatKg)} kg</span>
              </div>
            </div>
            {grasa > 0 && (
              <div className="flex justify-between items-center bg-orange-50 px-4 py-3 rounded-xl border border-orange-200">
                <span className="text-sm font-bold text-orange-600">Grasa ({grasaPct}%)</span>
                <span className="font-black text-orange-600">+ {formatWeight(grasa)} kg</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-blue-50 px-4 py-3 rounded-xl border border-blue-200">
              <span className="text-sm font-black text-blue-700 uppercase">Total blend (bruto)</span>
              <span className="text-xl font-black text-blue-700">{formatWeight(totalBlend)} kg</span>
            </div>
            <div className="flex justify-between items-center bg-green-50 px-4 py-3 rounded-xl border border-green-200">
              <span className="text-sm font-black text-green-700 uppercase">Peso neto</span>
              <span className="text-xl font-black text-green-700">{formatWeight(totalBlend - waste)} kg</span>
            </div>
            <div className="flex justify-between items-center bg-red-50 px-4 py-3 rounded-xl">
              <span className="text-sm font-bold text-red-500">Desperdicio</span>
              <span className="font-black text-red-600">- {formatWeight(waste)} kg</span>
            </div>
            <div className="flex justify-between items-center bg-green-50 px-4 py-3 rounded-xl border border-green-200">
              <span className="text-sm font-black text-green-700">Burgers producidas</span>
              <span className="text-xl font-black text-green-700">{qty} u</span>
            </div>
            <div className="flex justify-between items-center bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
              <span className="text-sm font-black text-amber-700 uppercase">Peso prom / burger</span>
              <span className="text-2xl font-black text-amber-700">{formatGrams(avgGrams)} gr</span>
            </div>
            <div className="flex justify-between items-center bg-blue-50 px-4 py-3 rounded-xl border border-blue-200">
              <span className="text-sm font-black text-blue-700 uppercase">Stock destino</span>
              <span className="font-black text-blue-700">{stockDestino}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 rounded-2xl border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-50 active:scale-95 transition-all">VOLVER</button>
            <button onClick={handleConfirm} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-500 active:scale-95 transition-all shadow-lg">CONFIRMAR TODO</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-lg mb-6 px-2 py-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
        <ChevronLeft size={24} /> VOLVER
      </button>

      {/* Título */}
      <div className="text-center mb-8">
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-2">PASO 2 — BURGER</p>
        <h2 className="text-5xl font-black text-blue-700 mb-3">🍔 Blend</h2>
        <p className="text-slate-500">Las carnes se combinan en un blend para hacer las burgers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUTS */}
        <div className="space-y-5">

          {/* Resumen de carnes del blend */}
          <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Scale size={22} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-lg">Carnes del blend</h4>
                <p className="text-xs text-slate-400">Cortes que entran al blend</p>
              </div>
            </div>
            <div className="space-y-2">
              {productions.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-2.5">
                  <span className="font-bold text-slate-700 text-sm">{p.typeName}</span>
                  <span className="font-black text-slate-800">{formatWeight(p.weightKg)} kg</span>
                </div>
              ))}
              <div className="flex justify-between items-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-2">
                <span className="font-black text-blue-700 text-sm uppercase">Total carne bruto</span>
                <span className="text-xl font-black text-blue-700">{formatWeight(totalMeatKg)} kg</span>
              </div>
            </div>
          </div>

          {/* Grasa */}
          <div className="bg-white border-2 border-orange-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
                  <Flame size={22} className="text-orange-500" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg">Grasa incorporada</h4>
                  <p className="text-xs text-slate-400">Se agrega al blend</p>
                </div>
              </div>
              {grasaPct && (
                <span className="bg-orange-100 text-orange-700 font-black text-lg px-3 py-1 rounded-full">{grasaPct}%</span>
              )}
            </div>
            <div className="relative">
              <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                value={grasaKg} onChange={e => setGrasaKg(e.target.value)} autoFocus
                className="w-full p-5 text-5xl font-black text-center text-orange-600 bg-orange-50 border-2 border-orange-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-300">KG</span>
            </div>
            {grasaPct && (
              <p className="text-center text-sm font-bold text-orange-500 mt-2">
                {grasaPct}% de grasa sobre {formatWeight(totalMeatKg)} kg de carne
              </p>
            )}
          </div>

          {/* Total blend (calculado) */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl px-6 py-4 flex justify-between items-center">
            <span className="font-black text-blue-700 uppercase text-sm">Total Blend</span>
            <span className="text-3xl font-black text-blue-700">{formatWeight(totalBlend)} <span className="text-lg font-bold text-blue-400">kg</span></span>
          </div>

          {/* Burgers producidas */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-green-100 rounded-2xl flex items-center justify-center">
                <Package size={22} className="text-green-600" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-lg">Burgers producidas</h4>
                <p className="text-xs text-slate-400">Unidades totales del blend</p>
              </div>
            </div>
            <div className="relative">
              <input type="number" inputMode="numeric" placeholder="0"
                value={units} onChange={e => setUnits(e.target.value)}
                className="w-full p-5 text-5xl font-black text-center text-green-600 bg-green-50 border-2 border-green-200 rounded-2xl outline-none focus:border-green-500 focus:bg-white transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-green-300">u</span>
            </div>
          </div>

          {/* Desperdicio */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-lg">Desperdicio</h4>
                <p className="text-xs text-slate-400">Merma del proceso</p>
              </div>
            </div>
            <div className="relative">
              <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                value={wasteKg} onChange={e => setWasteKg(e.target.value)}
                className="w-full p-5 text-5xl font-black text-center text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl outline-none focus:border-red-500 focus:bg-white transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-red-300">KG</span>
            </div>
          </div>
        </div>

        {/* RESUMEN */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-7 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center">
              <span className="text-xl">🍔</span>
            </div>
            <h4 className="font-black text-slate-800 text-lg">Resumen del blend</h4>
          </div>
          <div className="space-y-3 flex-1">
            <SRow label="Total carne"  value={`${formatWeight(totalMeatKg)} kg`} />
            {grasa > 0 && <SRow label={`Grasa (${grasaPct}%)`} value={`+ ${formatWeight(grasa)} kg`} color="text-orange-600" bg="bg-orange-50" />}
            <SRow label="Total blend (bruto)"  value={`${formatWeight(totalBlend)} kg`}  color="text-blue-700 text-xl" bg="bg-blue-50 border border-blue-200" />
            <SRow label="Desperdicio"  value={waste > 0 ? `- ${formatWeight(waste)} kg` : '—'} color="text-red-600" bg="bg-red-50" />
            <SRow label="Peso neto"  value={`${formatWeight(totalBlend - waste)} kg`} color="text-green-700 text-xl" bg="bg-green-50 border border-green-200" />
            <SRow label="Burgers"      value={qty > 0 ? `${qty} u` : '—'}        color="text-green-700 text-xl" bg="bg-green-50 border border-green-200" />
            <div className={`p-5 rounded-2xl border-2 text-center transition-all ${qty > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xs font-black uppercase mb-1 ${qty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Peso prom / burger</p>
              <span className={`text-4xl font-black ${qty > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{qty > 0 ? formatGrams(avgGrams) : '—'}</span>
              {qty > 0 && <span className="text-lg font-bold text-amber-500 ml-1">gr</span>}
            </div>

            {/* Stock destino editable */}
            <div className="relative">
              <button onClick={() => setShowStockPicker(!showStockPicker)}
                className="w-full flex justify-between items-center bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl hover:bg-blue-100 transition-all">
                <span className="text-sm font-black text-blue-700 uppercase">Stock destino</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-blue-700 text-sm">{stockDestino}</span>
                  <ChevronDown size={14} className={`text-blue-400 transition-transform ${showStockPicker ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showStockPicker && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-10 max-h-44 overflow-y-auto">
                  {ALL_STOCKS.map(stock => (
                    <button key={stock} onClick={() => { setStockDestino(stock); setShowStockPicker(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-blue-50 ${stock === stockDestino ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>
                      {stock}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button onClick={() => setShowConfirm(true)} disabled={!canFinish}
          className={`w-full py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
            ${canFinish ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <CheckCircle2 size={28} /> CONFIRMAR BLEND
        </button>
      </div>
    </div>
  );
}

function SRow({ label, value, color = 'text-slate-800', bg = 'bg-slate-50' }: {
  label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className={`flex justify-between items-center p-4 rounded-xl ${bg}`}>
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}