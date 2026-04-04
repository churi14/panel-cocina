"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Check } from 'lucide-react';
import { ButcheryProductionType } from '../../types';
import { CUTS, PRODUCTION_KINDS, ProductionKind, ProductionKindConfig, getCutsByKind, getCutLabel, getCut, formatWeight } from './cuts';
import { StartConfirmOverlay } from './Overlays';

type WeightEntry = { type: ButcheryProductionType; weight: string };

export function NewProductionWizard({ onStart, onCancel }: {
  onStart: (entries: { type: ButcheryProductionType; weight: number }[], kind: ProductionKind) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'kind' | 'select' | 'weights'>('kind');
  const [selectedKind, setSelectedKind] = useState<ProductionKind | null>(null);
  const [selected, setSelected]         = useState<ButcheryProductionType[]>([]);
  const [weights, setWeights]           = useState<WeightEntry[]>([]);
  const [showConfirm, setShowConfirm]   = useState(false);

  const kindConfig = selectedKind ? PRODUCTION_KINDS.find(k => k.id === selectedKind)! : null;
  const availableCuts = selectedKind ? getCutsByKind(selectedKind) : [];

  const toggleCut = (id: ButcheryProductionType) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSelectKind = (kind: ProductionKind) => {
    setSelectedKind(kind);
    setSelected([]);
    setWeights([]);
    setStep('select');
  };

  const handleGoToWeights = () => {
    setWeights(selected.map(type => ({
      type,
      weight: weights.find(w => w.type === type)?.weight ?? '',
    })));
    setStep('weights');
  };

  const setWeight = (type: ButcheryProductionType, val: string) =>
    setWeights(prev => prev.map(w => w.type === type ? { ...w, weight: val } : w));

  const allValid = weights.length > 0 &&
    weights.every(w => w.weight && parseFloat(w.weight.replace(',', '.')) > 0);

  const handleConfirm = () => {
    if (!selectedKind) return;
    onStart(
      weights.map(w => ({ type: w.type, weight: parseFloat(w.weight.replace(',', '.')) })),
      selectedKind
    );
  };

  // ─── PASO 1: elegir tipo ───
  if (step === 'kind') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-12">
            <h3 className="text-xl md:text-3xl font-black text-slate-800 mb-2">¿Qué vas a producir?</h3>
            <p className="text-slate-400 text-sm md:text-lg">Elegí el tipo de producción</p>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-3xl mx-auto w-full px-2">
            {PRODUCTION_KINDS.map(kind => (
              <button
                key={kind.id}
                onClick={() => handleSelectKind(kind.id)}
                className={`bg-white border-2 border-slate-200 hover:${kind.borderColor} rounded-2xl p-4 md:p-10 flex flex-col items-center gap-2 md:gap-5 transition-all active:scale-95 hover:shadow-xl group`}
              >
                <span className="text-4xl md:text-7xl group-hover:scale-110 transition-transform">{kind.emoji}</span>
                <span className={`text-sm md:text-3xl font-black ${kind.textColor} text-center leading-tight`}>{kind.label}</span>
                <span className="text-[10px] md:text-xs text-slate-400 font-medium text-center hidden md:block">{kind.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-6 max-w-3xl mx-auto w-full">
          <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold text-lg hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            CANCELAR
          </button>
        </div>
      </div>
    );
  }

  // ─── PASO 2: seleccionar cortes ───
  if (step === 'select' && kindConfig) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-10">
            {/* Tipo seleccionado */}
            <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-black text-lg mb-4 ${kindConfig.color}`}>
              {kindConfig.emoji} {kindConfig.label}
            </span>
            <h3 className="text-2xl font-black text-slate-800 mb-2">¿Qué cortes vas a usar?</h3>
            <p className="text-slate-400">Podés seleccionar varios a la vez</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
            {availableCuts.map(cut => {
              const isSelected = selected.includes(cut.id);
              return (
                <button
                  key={cut.id}
                  onClick={() => toggleCut(cut.id)}
                  className={`relative border-2 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all active:scale-95
                    ${isSelected
                      ? `${kindConfig.borderColor} bg-slate-50 shadow-lg`
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}
                >
                  <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                    ${isSelected ? `${kindConfig.color} border-transparent` : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-4xl transition-transform ${isSelected ? 'scale-110' : ''}`}>{cut.emoji}</span>
                  <span className={`text-sm font-black text-center leading-tight
                    ${isSelected ? kindConfig.textColor : 'text-slate-700'}`}>
                    {cut.label}
                  </span>
                </button>
              );
            })}
          </div>

          {selected.length > 0 && (
            <div className="mt-8 max-w-4xl mx-auto w-full">
              <div className={`border rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3 bg-slate-50`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-500 uppercase">Seleccionados:</span>
                  {selected.map(id => (
                    <span key={id} className={`text-white text-xs font-bold px-3 py-1 rounded-full ${kindConfig.color}`}>
                      {getCutLabel(id)}
                    </span>
                  ))}
                </div>
                <span className={`text-2xl font-black ${kindConfig.textColor}`}>{selected.length}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 space-y-3 max-w-4xl mx-auto w-full">
          <button
            onClick={handleGoToWeights}
            disabled={selected.length === 0}
            className={`w-full py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
              ${selected.length > 0 ? `${kindConfig.color} text-white hover:opacity-90 shadow-lg` : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <ChevronRight size={28} />
            INGRESAR PESOS {selected.length > 0 && `(${selected.length} corte${selected.length > 1 ? 's' : ''})`}
          </button>
          <button onClick={() => setStep('kind')} className="w-full py-4 text-slate-400 font-bold text-lg hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            ← VOLVER
          </button>
        </div>
      </div>
    );
  }

  // ─── PASO 3: ingresar pesos ───
  return (
    <div className="flex flex-col h-full">
      {showConfirm && (
        <StartConfirmOverlay
          entries={weights.map(w => ({ label: getCutLabel(w.type), weightKg: parseFloat(w.weight.replace(',', '.')) }))}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <button onClick={() => setStep('select')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-lg mb-6 px-2 py-2 self-start rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
        <ChevronLeft size={24} /> VOLVER A CORTES
      </button>

      {kindConfig && (
        <div className="text-center mb-8">
          <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-black text-lg mb-3 ${kindConfig.color}`}>
            {kindConfig.emoji} {kindConfig.label}
          </span>
          <h3 className="text-2xl font-black text-slate-800 mb-1">Ingresá el peso de cada corte</h3>
          <p className="text-slate-400 text-sm">Peso bruto antes del procesamiento</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {weights.map((entry, idx) => {
            const cut = getCut(entry.type);
            const parsed = parseFloat(entry.weight.replace(',', '.'));
            const isValid = entry.weight !== '' && parsed > 0;
            return (
              <div key={entry.type} className={`bg-white rounded-2xl border-2 p-6 transition-all ${isValid ? (kindConfig ? kindConfig.borderColor : 'border-rose-300') : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 transition-all
                    ${isValid ? `${kindConfig?.color ?? 'bg-rose-600'} text-white` : 'bg-slate-200 text-slate-400'}`}>
                    {isValid ? <Check size={18} strokeWidth={3} /> : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-lg font-black text-slate-800">{cut.label}</span>
                        <span className="ml-2 text-xs font-bold text-slate-400">→ {cut.stockDestino}</span>
                      </div>
                      <span className="text-2xl">{cut.emoji}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                        value={entry.weight}
                        onChange={e => setWeight(entry.type, e.target.value)}
                        autoFocus={idx === 0}
                        className={`w-full px-5 py-4 text-3xl font-black text-center rounded-xl outline-none transition-all
                          ${isValid
                            ? `bg-slate-50 border-2 ${kindConfig?.borderColor ?? 'border-rose-300'} ${kindConfig?.textColor ?? 'text-rose-700'} focus:opacity-90`
                            : 'bg-slate-50 border-2 border-slate-200 text-slate-900 focus:border-rose-400'}`}
                      />
                      <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black ${isValid ? 'text-slate-400' : 'text-slate-300'}`}>KG</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 max-w-2xl mx-auto w-full space-y-3">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!allValid}
          className={`w-full py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
            ${allValid ? `${kindConfig?.color ?? 'bg-rose-600'} text-white hover:opacity-90 shadow-lg` : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          <Play size={28} fill="currentColor" />
          EMPEZAR {weights.length} PRODUCCIÓN{weights.length > 1 ? 'ES' : ''}
        </button>
        <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold text-lg hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
          CANCELAR
        </button>
      </div>
    </div>
  );
}