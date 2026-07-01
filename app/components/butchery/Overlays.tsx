"use client";

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, ChevronDown } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import { getCut, formatWeight, formatTimer, formatGrams, ALL_STOCKS } from './cuts';

// --- OVERLAY: CONFIRMAR INICIO ---
export function StartConfirmOverlay({ entries, onConfirm, onCancel }: {
  entries: { label: string; weightKg: number }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={40} className="text-amber-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">
          ¿Arrancar {entries.length} producción{entries.length > 1 ? 'es' : ''}?
        </h2>
        <p className="text-slate-500 mb-6">Confirmá los pesos antes de empezar</p>
        <div className="space-y-2 mb-8 text-left">
          {entries.map((e, i) => (
            <div key={i} className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3">
              <span className="font-bold text-slate-700">{e.label}</span>
              <span className="font-black text-slate-900 text-lg">{formatWeight(e.weightKg)} <span className="text-sm text-slate-400 font-bold">KG</span></span>
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-5 rounded-2xl border-2 border-slate-300 text-slate-600 font-bold text-xl hover:bg-slate-50 active:scale-95 transition-all">CANCELAR</button>
          <button onClick={onConfirm} className="flex-1 py-5 rounded-2xl bg-rose-600 text-white font-bold text-xl hover:bg-rose-500 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2">
            <Play size={20} fill="currentColor" /> ARRANCAR
          </button>
        </div>
      </div>
    </div>
  );
}

// --- OVERLAY: FINALIZAR PASO 1 ---
export function FinishStep1Overlay({ productions, onConfirm, onCancel }: {
  productions: ButcheryProduction[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">¿Finalizaste el procesamiento?</h2>
        <p className="text-slate-500 mb-6">
          Se van a cerrar <span className="font-black text-slate-700">{productions.length} producción{productions.length > 1 ? 'es' : ''}</span> simultáneamente
        </p>
        <div className="space-y-2 mb-8 text-left">
          {productions.map(p => (
            <div key={p.id} className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3">
              <span className="font-bold text-slate-700">{p.typeName}</span>
              <span className="font-black text-slate-500">{formatWeight(p.weightKg)} kg</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 py-5 rounded-2xl border-2 border-slate-300 text-slate-600 font-bold text-xl hover:bg-slate-50 active:scale-95 transition-all">VOLVER</button>
          <button onClick={onConfirm} className="flex-1 py-5 rounded-2xl bg-green-600 text-white font-bold text-xl hover:bg-green-500 active:scale-95 transition-all shadow-lg">SÍ, FINALIZAR TODO</button>
        </div>
      </div>
    </div>
  );
}

// --- OVERLAY: CONFIRMAR PASO 2 (stock editable) ---
export type Step2ConfirmData = {
  production: ButcheryProduction;
  quantity: number;
  unit: 'unid' | 'kg';
  wasteKg: number;
  grasaKg: number;
  stockDestino: string;
};

export function FinishStep2Overlay({ data, onConfirm, onCancel }: {
  data: Step2ConfirmData;
  onConfirm: (stockDestino: string, observacion?: string) => void;
  onCancel: () => void;
}) {
  const { production, quantity, unit, wasteKg, grasaKg, stockDestino: defaultStock } = data;
  const [selectedStock, setSelectedStock] = useState(defaultStock);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [observacion, setObservacion] = useState('');

  const netWeight = production.weightKg - wasteKg;
  const avgGrams  = unit === 'unid' && quantity > 0 ? (netWeight / quantity) * 1000 : 0;
  const grasaPct  = grasaKg > 0 ? ((grasaKg / production.weightKg) * 100).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">¿Confirmar producción?</h2>
          <p className="text-slate-400 text-sm mt-1">Revisá que todo esté bien</p>
        </div>

        <div className="space-y-2 mb-6">
          <Row label="Corte"       value={production.typeName} />
          <Row label="Cantidad"    value={`${quantity} ${unit}`}                    color="text-blue-600" />
          <Row label="Peso bruto"  value={`${formatWeight(production.weightKg)} kg`} />
          <Row label="Desperdicio" value={`- ${formatWeight(wasteKg)} kg`}          color="text-red-600"   bg="bg-red-50" />
          {grasaKg > 0 && (
            <Row label={`Grasa (${grasaPct}%)`} value={`+ ${formatWeight(grasaKg)} kg`} color="text-orange-600" bg="bg-orange-50" />
          )}
          <Row label="Peso neto"   value={`${formatWeight(netWeight)} kg`}          color="text-green-700" bg="bg-green-50 border border-green-200" />
          {unit === 'unid' && quantity > 0 && (
            <div className="flex justify-between items-center bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
              <span className="text-sm font-black text-amber-700 uppercase">Prom / unidad</span>
              <span className="text-2xl font-black text-amber-700">{formatGrams(avgGrams)} gr</span>
            </div>
          )}

          {/* Stock destino editable */}
          <div className="relative">
            <button
              onClick={() => setShowStockPicker(!showStockPicker)}
              className="w-full flex justify-between items-center bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl hover:bg-blue-100 transition-all"
            >
              <span className="text-sm font-black text-blue-700 uppercase">Stock destino</span>
              <div className="flex items-center gap-2">
                <span className="font-black text-blue-700 text-sm">{selectedStock}</span>
                <ChevronDown size={14} className={`text-blue-400 transition-transform ${showStockPicker ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {showStockPicker && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-10 max-h-44 overflow-y-auto">
                {ALL_STOCKS.map(stock => (
                  <button key={stock} onClick={() => { setSelectedStock(stock); setShowStockPicker(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-blue-50 ${stock === selectedStock ? 'bg-blue-100 text-blue-700' : 'text-slate-700'}`}>
                    {stock}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

                  <div className="mb-4">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">
              Observaciones (opcional)
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Ej: demoró más por temperatura de cámara, corte difícil..."
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 rounded-2xl border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-50 active:scale-95 transition-all">
            VOLVER
          </button>
          <button onClick={() => onConfirm(selectedStock, observacion || undefined)} className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-500 active:scale-95 transition-all shadow-lg">
            CONFIRMAR TODO
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color = 'text-slate-800', bg = 'bg-slate-50' }: {
  label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 rounded-xl ${bg}`}>
      <span className="text-sm font-bold text-slate-400 uppercase">{label}</span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}