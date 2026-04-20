"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Check } from 'lucide-react';
import { ButcheryProductionType } from '../../types';
import { CUTS, PRODUCTION_KINDS, ProductionKind, ProductionKindConfig, getCutsByKind, getCutLabel, getCut, formatWeight } from './cuts';
import { StartConfirmOverlay } from './Overlays';
import { supabase } from '../../supabase';

type WeightEntry = { type: ButcheryProductionType; weight: string; carneLinpiaName?: string };

export function NewProductionWizard({ onStart, onCancel }: {
  onStart: (entries: { type: ButcheryProductionType; weight: number; carneLinpiaName?: string }[], kind: ProductionKind) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'kind' | 'select' | 'weights'>('kind');
  const [selectedKind, setSelectedKind] = useState<ProductionKind | null>(null);
  const [selected, setSelected]         = useState<ButcheryProductionType[]>([]);
  const [weights, setWeights]           = useState<WeightEntry[]>([]);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [tipVisible, setTipVisible]     = useState(() => typeof window !== 'undefined' ? !localStorage.getItem('wizard_tip_seen') : true);
  const [carnesLimpias, setCarnesLimpias] = useState<{producto: string; cantidad: number}[]>([]);
  const [selectedCarneLinpia, setSelectedCarneLinpia] = useState('');
  const [selectedCarnesMulti, setSelectedCarnesMulti] = useState<string[]>([]); // burger multi-select

  const toggleCarneMulti = (producto: string) =>
    setSelectedCarnesMulti(prev => prev.includes(producto) ? prev.filter(x => x !== producto) : [...prev, producto]);

  const kindConfig = selectedKind ? PRODUCTION_KINDS.find(k => k.id === selectedKind)! : null;
  const availableCuts = selectedKind === 'limpieza'
    ? CUTS.filter(c => c.id !== 'grasa_pella' && c.id !== 'not_burger') // todos los cortes de carne
    : selectedKind ? getCutsByKind(selectedKind) : [];

  const toggleCut = (id: ButcheryProductionType) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSelectKind = async (kind: ProductionKind) => {
    setSelectedKind(kind);
    setSelected([]);
    setWeights([]);
    setCarnesLimpias([]);
    setSelectedCarneLinpia('');
    setSelectedCarnesMulti([]);
    setTipVisible(!localStorage.getItem('wizard_tip_seen'));
    // Para lomito/milanesa: fetch carnes limpias del stock_produccion
    // Lista fija de todos los cortes posibles
    const TODOS_CORTES = [
      'Lomo', 'Cuadril', 'Cuadrada', 'Nalga', 'Tapa de Asado',
      'Bife de Chorizo', 'Vacío', 'Picaña', 'Ojo de Bife', 'Roast Beef', 'Pollo',
    ];

    if (kind === 'lomito' || kind === 'milanesa') {
      // Buscar stock existente
      const { data } = await supabase
        .from('stock_produccion')
        .select('producto, cantidad')
        .ilike('producto', '% Limpia')
        .not('producto', 'ilike', 'Carne Limpia Burger%');
      const stockMap: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { stockMap[r.producto] = Number(r.cantidad); });
      // Mostrar todos los cortes, con stock 0 si no existe
      const todos = TODOS_CORTES.map(c => ({
        producto: `${c} Limpia`,
        cantidad: stockMap[`${c} Limpia`] ?? 0,
      }));
      setCarnesLimpias(todos);
    } else if (kind === 'burger') {
      const { data } = await supabase
        .from('stock_produccion')
        .select('producto, cantidad')
        .ilike('producto', 'Carne Limpia Burger%');
      const stockMap: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { stockMap[r.producto] = Number(r.cantidad); });
      const todos = TODOS_CORTES.map(c => ({
        producto: `Carne Limpia Burger - ${c}`,
        cantidad: stockMap[`Carne Limpia Burger - ${c}`] ?? 0,
      }));
      setCarnesLimpias(todos);
    }
    setStep('select');
  };

  const handleGoToWeights = () => {
    if (selectedKind === 'burger' && selectedCarnesMulti.length > 0) {
      // Burger: un peso por cada corte seleccionado
      const fakeType = 'lomo' as ButcheryProductionType;
      setWeights(selectedCarnesMulti.map(p => ({ type: fakeType, weight: '', carneLinpiaName: p })));
    } else if (selectedKind !== 'limpieza' && selectedCarneLinpia) {
      const fakeType = 'lomo' as ButcheryProductionType;
      setWeights([{ type: fakeType, weight: '', carneLinpiaName: selectedCarneLinpia }]);
    } else {
      setWeights(selected.map(type => ({
        type,
        weight: weights.find(w => w.type === type)?.weight ?? '',
      })));
    }
    setTipVisible(!localStorage.getItem('wizard_tip_seen'));
    setStep('weights');
  };

  const setWeight = (type: ButcheryProductionType, val: string) =>
    setWeights(prev => prev.map(w => w.type === type ? { ...w, weight: val } : w));
  const setWeightByIdx = (idx: number, val: string) =>
    setWeights(prev => prev.map((w, i) => i === idx ? { ...w, weight: val } : w));

  const allValid = weights.length > 0 &&
    weights.every(w => w.weight && parseFloat(w.weight.replace(',', '.')) > 0);

  const handleConfirm = () => {
    if (!selectedKind) return;
    onStart(
      weights.map(w => ({
        type: w.type,
        weight: parseFloat(w.weight.replace(',', '.')),
        carneLinpiaName: (w as any).carneLinpiaName ?? (selectedCarneLinpia || undefined),
      })),
      selectedKind
    );
  };


  // ─── Banner de ayuda colapsable ───────────────────────────────────────────
  const TipBox = ({ children }: { children: React.ReactNode }) => (
    <>
      {!tipVisible && (
        <div className="max-w-3xl mx-auto w-full mb-4 flex justify-end">
          <button
            onClick={() => setTipVisible(true)}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full transition-all"
          >
            💡 Ver ayuda
          </button>
        </div>
      )}
      <div className={`max-w-3xl mx-auto w-full mb-8 transition-all ${tipVisible ? '' : 'hidden'}`}>
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">💡</span>
        <div className="flex-1 text-sm text-amber-900 leading-relaxed">{children}</div>
        <button
          onClick={() => { setTipVisible(false); localStorage.setItem('wizard_tip_seen', '1'); }}
          className="shrink-0 text-amber-400 hover:text-amber-600 font-black text-lg leading-none mt-0.5 transition-colors"
          title="Ocultar ayuda"
        >×</button>
      </div>
    </div>
    </>
  );

  // ─── PASO 1: elegir tipo ───
  if (step === 'kind') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col justify-center">
          <TipBox>
            <p className="font-black mb-1">¿Cómo funciona?</p>
            <p><strong>LOMITO</strong> → cuando vas a hacer bifes para sándwiches de lomito.</p>
            <p><strong>BURGER</strong> → cuando vas a hacer medallones de hamburguesa.</p>
            <p><strong>MILANESA</strong> → cuando vas a empanar milanesas.</p>
            <p className="mt-1 text-amber-700">Tocá el que corresponde para arrancar.</p>
          </TipBox>
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

  // Variable para el botón de continuar
  const listo = selectedKind === 'limpieza' ? selected.length > 0
    : selectedKind === 'burger' ? selectedCarnesMulti.length > 0
    : selectedCarneLinpia !== '';

  // ─── PASO 2: seleccionar cortes ───
  if (step === 'select' && kindConfig) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-6">
            {/* Tipo seleccionado */}
            <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-black text-lg mb-4 ${kindConfig.color}`}>
              {kindConfig.emoji} {kindConfig.label}
            </span>
            <h3 className="text-2xl font-black text-slate-800 mb-2">¿Qué cortes vas a usar?</h3>
            <p className="text-slate-400">Podés seleccionar varios a la vez</p>
          </div>
          <TipBox>
            <p className="font-black mb-1">Cómo elegir los cortes:</p>
            <p>• Tocá <strong>uno o más cortes</strong> de la lista. Quedará marcado con un tilde ✓.</p>
            <p>• Si vas a trabajar con más de un corte al mismo tiempo, seleccionalos todos antes de continuar.</p>
            <p>• Cuando tengas los que vas a usar, tocá <strong>INGRESAR PESOS</strong>.</p>
          </TipBox>

          {selectedKind === 'limpieza' ? (
            // LIMPIEZA: mostrar cortes crudos de la lista
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto w-full">
              {availableCuts.map(cut => {
                const isSelected = selected.includes(cut.id);
                return (
                  <button
                    key={cut.id}
                    onClick={() => toggleCut(cut.id)}
                    className={`relative border-2 rounded-2xl p-6 flex flex-col items-center gap-3 transition-all active:scale-95
                      ${isSelected ? `${kindConfig.borderColor} bg-slate-50 shadow-lg` : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}
                  >
                    <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                      ${isSelected ? `${kindConfig.color} border-transparent` : 'border-slate-300 bg-white'}`}>
                      {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-4xl transition-transform ${isSelected ? 'scale-110' : ''}`}>{cut.emoji}</span>
                    <span className={`text-sm font-black text-center leading-tight ${isSelected ? kindConfig.textColor : 'text-slate-700'}`}>{cut.label}</span>
                  </button>
                );
              })}
            </div>
          ) : carnesLimpias.length > 0 ? (
            // LOMITO / MILANESA: selección simple | BURGER: selección múltiple
            <div className="max-w-2xl mx-auto w-full space-y-2">
              <p className="text-center text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">
                {selectedKind === 'burger' ? 'Seleccioná los cortes a usar (puede ser más de uno)' : 'Elegí el corte a procesar'}
              </p>
              {carnesLimpias.map(c => {
                // Nombre corto: "Lomo_L", "Cuadril_L", etc.
                const corteLabel = c.producto
                  .replace('Carne Limpia Burger - ', '')
                  .replace(' Limpia', '');
                const isSelectedMulti = selectedCarnesMulti.includes(c.producto);
                const isSelectedSingle = selectedCarneLinpia === c.producto;
                const isSelected = selectedKind === 'burger' ? isSelectedMulti : isSelectedSingle;
                const onClick = () => selectedKind === 'burger'
                  ? toggleCarneMulti(c.producto)
                  : setSelectedCarneLinpia(c.producto);
                return (
                  <button key={c.producto} onClick={onClick}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all font-bold
                      ${isSelected
                        ? 'border-green-500 bg-green-50 text-green-800 shadow-md'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                        ${isSelected ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                        {isSelected && <span className="text-white text-xs font-black">✓</span>}
                      </div>
                      <span className="text-base font-black">{corteLabel}<span className="text-green-600 font-black">_L</span></span>
                    </div>
                    <span className={`text-sm font-bold ${Number(c.cantidad) > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                      {Number(c.cantidad) > 0 ? `${Number(c.cantidad).toFixed(2)} kg` : 'Sin stock'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            // Sin carne limpia disponible
            <div className="max-w-2xl mx-auto w-full text-center py-16">
              <p className="text-6xl mb-4">🔪</p>
              <h4 className="text-xl font-black text-slate-600 mb-2">No hay carne limpia disponible</h4>
              <p className="text-slate-400 text-sm">Primero hacé una <strong>LIMPIEZA</strong> de carne para generar stock limpio.</p>
            </div>
          )}

          {(selected.length > 0 || selectedCarneLinpia || selectedCarnesMulti.length > 0) && (
            <div className="mt-4 max-w-4xl mx-auto w-full">
              <div className={`border rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3 bg-slate-50`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-500 uppercase">Seleccionados:</span>
                  {selectedKind === 'limpieza' ? selected.map(id => (
                    <span key={id} className={`text-white text-xs font-bold px-3 py-1 rounded-full ${kindConfig.color}`}>{getCutLabel(id)}</span>
                  )) : selectedKind === 'burger' ? selectedCarnesMulti.map(p => (
                    <span key={p} className="text-white text-xs font-bold px-3 py-1 rounded-full bg-green-600">
                      {p.replace('Carne Limpia Burger - ', '')}_L
                    </span>
                  )) : selectedCarneLinpia ? (
                    <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-green-600">
                      {selectedCarneLinpia.replace(' Limpia', '')}_L
                    </span>
                  ) : null}
                </div>
                <span className={`text-2xl font-black ${kindConfig.textColor}`}>
                  {selectedKind === 'limpieza' ? selected.length : selectedKind === 'burger' ? selectedCarnesMulti.length : selectedCarneLinpia ? 1 : 0}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 space-y-3 max-w-4xl mx-auto w-full">
          <button
            onClick={handleGoToWeights}
            disabled={!listo}
            className={`w-full py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
              ${listo ? `${kindConfig.color} text-white hover:opacity-90 shadow-lg` : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            <ChevronRight size={28} />
            INGRESAR PESOS
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
          entries={weights.map(w => ({ label: w.carneLinpiaName ? w.carneLinpiaName.replace('Carne Limpia Burger - ','').replace(' Limpia','') + '_L' : getCutLabel(w.type), weightKg: parseFloat(w.weight.replace(',', '.')) }))}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <button onClick={() => setStep('select')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-sm mb-3 px-2 py-1.5 self-start rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
        <ChevronLeft size={24} /> VOLVER A CORTES
      </button>

      {kindConfig && (
        <div className="text-center mb-3">
          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white font-black text-sm mb-2 ${kindConfig.color}`}>
            {kindConfig.emoji} {kindConfig.label}
          </span>
          <h3 className="text-xl font-black text-slate-800 mb-0.5">Ingresá el peso de cada corte</h3>
          <p className="text-slate-400 text-xs">Peso bruto antes del procesamiento</p>
        </div>
      )}
      {/* Tip solo en desktop */}
      <div className="hidden md:block">
        <TipBox>
          <p className="font-black mb-1">Cómo pesar la carne:</p>
          <p>1. Poné el corte en la báscula <strong>antes de limpiarlo o cortarlo</strong>.</p>
          <p>2. Ingresá el número que muestra la báscula (en kg, con decimales).</p>
          <p>3. Cuando todos los campos estén completos, tocá <strong>EMPEZAR</strong>.</p>
          <p className="mt-1 text-amber-700">⚠️ Es el peso bruto — con todo, sin limpiar.</p>
        </TipBox>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {weights.map((entry, idx) => {
            const cut = getCut(entry.type);
            const parsed = parseFloat(entry.weight.replace(',', '.'));
            const isValid = entry.weight !== '' && parsed > 0;
            return (
              <div key={idx} className={`bg-white rounded-2xl border-2 p-3 md:p-6 transition-all ${isValid ? (kindConfig ? kindConfig.borderColor : 'border-rose-300') : 'border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 transition-all
                    ${isValid ? `${kindConfig?.color ?? 'bg-rose-600'} text-white` : 'bg-slate-200 text-slate-400'}`}>
                    {isValid ? <Check size={18} strokeWidth={3} /> : idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-lg font-black text-slate-800">
                          {entry.carneLinpiaName
                            ? <>{entry.carneLinpiaName.replace('Carne Limpia Burger - ', '').replace(' Limpia', '')}<span className="text-green-600 font-black">_L</span></>
                            : cut.label}
                        </span>
                        <span className="ml-2 text-xs font-bold text-slate-400">
                          → {entry.carneLinpiaName ?? cut.stockDestino}
                        </span>
                      </div>
                      <span className="text-2xl">{cut.emoji}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                        value={entry.weight}
                        onChange={e => {
                          const val = e.target.value;
                          const num = parseFloat(val.replace(',', '.'));
                          if (num > 500 && !val.includes('.') && !val.includes(',')) {
                            setWeightByIdx(idx, (num / 1000).toFixed(3));
                          } else {
                            setWeightByIdx(idx, val);
                          }
                        }}
                        className={`w-full px-5 py-4 text-3xl font-black text-center rounded-xl outline-none transition-all
                          ${parsed > 200
                            ? 'bg-amber-50 border-2 border-amber-400 text-amber-700'
                            : isValid
                              ? `bg-slate-50 border-2 ${kindConfig?.borderColor ?? 'border-rose-300'} ${kindConfig?.textColor ?? 'text-rose-700'} focus:opacity-90`
                              : 'bg-slate-50 border-2 border-slate-200 text-slate-900 focus:border-rose-400'}`}
                      />
                      <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black ${isValid ? 'text-slate-400' : 'text-slate-300'}`}>KG</span>
                    </div>
                    {parsed > 200 && (
                      <div className="mt-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="text-amber-500 text-lg">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-amber-700">¿Pusiste gramos en vez de kilos?</p>
                          <p className="text-xs text-amber-600">{parsed.toFixed(0)} kg parece mucho. Si querías poner {parsed.toFixed(0)}g, son <strong>{(parsed/1000).toFixed(3)} kg</strong>.</p>
                        </div>
                        <button onClick={() => setWeights(prev => prev.map((w, i) => i === idx ? { ...w, weight: (parsed/1000).toFixed(3) } : w))}
                          className="ml-auto px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-lg whitespace-nowrap transition-all">
                          Convertir a {(parsed/1000).toFixed(3)} kg
                        </button>
                      </div>
                    )}
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