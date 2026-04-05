"use client";

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed, X, ArrowLeft, Play, CheckSquare, Square, Plus,
  CheckCircle2, Calculator, AlertCircle, Wheat, Droplet, ChefHat, Carrot
} from 'lucide-react';
import type { Recipe, ProductionRecord } from '../types';
import {
  formatQty, saveCocinaProduccion, clearCocinaProduccion,
  deductStockForMilanesa, deductStockForSalsa, deductStockForVerdura,
  KITCHEN_CATEGORIES, OPERADORES,
} from './kitchen/kitchenHelpers';

export default function KitchenProductionModal({ onClose, activeProductions, setActiveProductions, recipesDB, setProductionHistory }: {
  onClose: () => void;
  activeProductions: import('../types').ActiveProductionItem[];
  setActiveProductions: React.Dispatch<React.SetStateAction<import('../types').ActiveProductionItem[]>>;
  recipesDB: any[];
  setProductionHistory: any;
}) {
  const [operador, setOperador] = useState('');
  const [modalView, setModalView] = useState<'list' | 'new'>('list');
  const [view, setView] = useState<'category' | 'product' | 'recipe'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Recipe | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [targetUnits, setTargetUnits] = useState(0);
  const [baseQtyKg, setBaseQtyKg] = useState('');

  const [verduraDesperdicioKg, setVerduraDesperdicioKg] = useState('');
  const [verduraBrutoKg, setVerduraBrutoKg]             = useState('');

  const isPercent  = selectedProduct?.recipeType === 'percent';
  const isVerdura  = selectedProduct?.recipeType === 'verdura';
  const baseQtyGr = parseFloat(baseQtyKg || '0') * 1000;

  const groupedRecipes = recipesDB.reduce((acc: any, r: Recipe) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleProductSelect = (r: Recipe) => {
    setSelectedProduct(r);
    setTargetUnits(r.baseYield || 0);
    setBaseQtyKg('');
    setCheckedIngredients(new Set());
    setView('recipe');
  };

  const toggleCheck = (idx: number) => {
    if (finishingProd) return;
    const next = new Set(checkedIngredients);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setCheckedIngredients(next);
  };

  const calcIngredient = (idx: number): string => {
    if (!selectedProduct) return '—';
    const ing = selectedProduct.ingredients[idx];
    if (isPercent) {
      if (baseQtyGr <= 0) return '—';
      if (ing.isBase) return formatQty(baseQtyGr);
      return formatQty((ing.qty / 100) * baseQtyGr);
    } else {
      const mult = selectedProduct.baseYield > 0 ? targetUnits / selectedProduct.baseYield : 0;
      const val = ing.qty * mult;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)} ${ing.unit}`;
    }
  };

  const allChecked = selectedProduct ? checkedIngredients.size === selectedProduct.ingredients.length : false;
  const canStart = isVerdura ? parseFloat(verduraBrutoKg) > 0 : isPercent ? baseQtyGr > 0 && allChecked : targetUnits > 0 && allChecked;

  const handleStart = async () => {
    if (!canStart || !selectedProduct) return;
    const now = Date.now();
    const finalTargetUnits = isVerdura ? parseFloat(verduraBrutoKg) : isPercent ? parseFloat(baseQtyKg) : targetUnits;
    const finalUnit = isVerdura ? 'kg bruto' : isPercent ? 'kg base' : selectedProduct.unit;
    const finalBaseKg = isVerdura ? parseFloat(verduraBrutoKg) : parseFloat(baseQtyKg || '0');

    const newProd: import('../types').ActiveProductionItem = {
      id: now,
      recipeName: selectedProduct.name,
      recipeId: selectedProduct.id,
      targetUnits: finalTargetUnits,
      unit: finalUnit,
      startTime: now,
      status: 'running',
      operador,
      baseKg: finalBaseKg,
    };
    setActiveProductions(prev => [...prev, newProd]);
    setModalView('list');
    setView('category');
    setSelectedProduct(null);
    setCheckedIngredients(new Set());
    setTargetUnits(0);
    setBaseQtyKg('');

    // Persistir en Supabase y notificar al admin
    await saveCocinaProduccion(now, selectedProduct.name, finalTargetUnits, finalUnit, finalBaseKg, now, operador);
  };

  // ── Produccion activa seleccionada para finalizar ────────────────────────
  const [finishingProd, setFinishingProd] = useState<import('../types').ActiveProductionItem | null>(null);

  // ── Estado para menjunje milanesa ─────────────────────────────────────────
  const [showMenjunjeModal, setShowMenjunjeModal] = useState(false);
  const [menjunjeCorte, setMenjunjeCorte]         = useState('');
  const [menjunjeKg, setMenjunjeKg]               = useState('');

  const activeRecipeId = finishingProd?.recipeId ?? selectedProduct?.id ?? '';
  const activeRecipeName = finishingProd?.recipeName ?? '';
  const isSalsaPotes    = activeRecipeId.startsWith('potes_');
  const isVerduraRecipe = activeRecipeId.startsWith('verdura_');
  const isMilanesaRecipe = activeRecipeName.toLowerCase().includes('menjunje') ||
    recipesDB.find((r: any) => r.name === activeRecipeName)?.category === 'Milanesas';
  const menjunjeTipo = activeRecipeName.toLowerCase().includes('pollo') ? 'Pollo' : 'Carne';

  const handleFinish = async () => {
    const prod = finishingProd;
    if (!prod) return;
    // Si es receta de milanesa, mostrar modal de menjunje primero
    if (isMilanesaRecipe && !showMenjunjeModal) {
      setShowMenjunjeModal(true);
      return;
    }
    setShowMenjunjeModal(false);

    const endTime = Date.now();
    const dur = (endTime - prod.startTime) / 1000;
    const baseKg = prod.baseKg ?? prod.targetUnits;

    setProductionHistory((prev: ProductionRecord[]) => [...prev, {
      id: Date.now(), date: new Date().toLocaleDateString(), timestamp: endTime,
      recipeName: prod.recipeName,
      quantity: prod.targetUnits, unit: prod.unit,
      durationSeconds: dur,
      startTime: new Date(prod.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);

    // Si es menjunje, descontar stock
    if (isMilanesaRecipe && menjunjeCorte && menjunjeKg) {
      const kg = parseFloat(menjunjeKg);
      // Ingredientes menjunje por kg de milanesa (proporcional)
      // Proporciones reales del menjunje: base 10kg carne
      const ingredientes = [
        { nombre: 'HUEVO',    cantidad: Math.ceil(kg * 4.2),                      unidad: 'u'  },
        { nombre: 'AJO',      cantidad: parseFloat((kg * 0.0125).toFixed(3)),     unidad: 'kg' },
        { nombre: 'LIMÓN',    cantidad: parseFloat((kg * 0.0175).toFixed(3)),     unidad: 'u'  },
        { nombre: 'SAL',      cantidad: parseFloat((kg * 0.0195).toFixed(3)),     unidad: 'kg' },
        { nombre: 'PEREJIL',  cantidad: parseFloat((kg * 0.015).toFixed(3)),      unidad: 'kg' },
      ];
      // corte viene del input, tipo (carne/pollo) viene de la receta seleccionada
      const corteKey = menjunjeCorte || menjunjeTipo;
      await deductStockForMilanesa(corteKey, kg, ingredientes);
    }

    // Descuento stock verduras producidas
    if (isVerduraRecipe && selectedProduct) {
      const bruto = parseFloat(verduraBrutoKg) || baseKg;
      const desperdicio = parseFloat(verduraDesperdicioKg) || 0;
      await deductStockForVerdura(selectedProduct.id, bruto, desperdicio);
      setVerduraBrutoKg('');
      setVerduraDesperdicioKg('');
    }

    // Descuento stock salsas en potes — siempre: potes * 0.5 kg
    if (isSalsaPotes && selectedProduct) {
      const potesProducidos = Math.round((finishingProd?.targetUnits ?? 0));
      const kgUsados = potesProducidos * 0.5;
      await deductStockForSalsa(selectedProduct.id, kgUsados, potesProducidos);
    }

    // Limpiar Supabase y notificar al admin
    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    setActiveProductions(prev => prev.filter(p => p.id !== prod.id));
    setFinishingProd(null);

    setMenjunjeCorte('');
    setMenjunjeKg('');
  };


  const formatTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            {modalView === 'new' && (
              <button onClick={() => { setModalView('list'); setView('category'); setSelectedProduct(null); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UtensilsCrossed className="text-amber-600" size={20} /> Cocina General
              </h2>
              <p className="text-slate-400 text-xs">
                {!operador ? 'Seleccioná tu nombre'
                  : modalView === 'list'
                    ? `${activeProductions.length} produccion${activeProductions.length !== 1 ? 'es' : ''} activa${activeProductions.length !== 1 ? 's' : ''} · ${operador}`
                    : `Configurando: ${selectedProduct?.name ?? 'nueva'}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={22} className="text-slate-500" />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* SELECTOR OPERADOR */}
          {!operador && (
            <div className="flex flex-col items-center justify-center min-h-96 space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">👤</div>
                <h3 className="text-xl font-black text-slate-800">¿Quién sos?</h3>
                <p className="text-slate-400 text-sm mt-1">Seleccioná tu nombre para registrar la producción</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {OPERADORES.map(op => (
                  <button key={op} onClick={() => setOperador(op)}
                    className="py-4 rounded-2xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all font-black text-slate-700 hover:text-amber-700 active:scale-95">
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VISTA LISTA DE PRODUCCIONES */}
          {!!operador && modalView === 'list' && (
            <div className="space-y-4">
              {/* Producciones activas */}
              {activeProductions.length > 0 ? activeProductions.map(prod => {
                const elapsed = currentTime - prod.startTime;
                const recipe = recipesDB.find((r: any) => r.name === prod.recipeName);
                const isFin = finishingProd?.id === prod.id;
                return (
                  <div key={prod.id} className={`bg-slate-900 rounded-2xl border overflow-hidden transition-all ${isFin ? 'border-amber-500' : 'border-slate-800'}`}>
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <p className="font-black text-white">{prod.recipeName}</p>
                        </div>
                        <p className="text-slate-400 text-xs">{prod.operador} · {prod.targetUnits} {prod.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold text-green-400">{formatTimer(elapsed)}</p>
                        <button
                          onClick={() => { setFinishingProd(prod); setSelectedProduct(recipe ?? null); }}
                          className="mt-1 text-xs text-amber-400 hover:text-amber-300 font-bold underline">
                          Finalizar
                        </button>
                      </div>
                    </div>

                    {/* Panel de finalización */}
                    {isFin && (
                      <div className="border-t border-slate-700 p-5 space-y-4 bg-slate-800/50">

                        {isVerduraRecipe && (
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Desperdicio (kg)</label>
                              <input type="number" value={verduraDesperdicioKg}
                                onChange={e => setVerduraDesperdicioKg(e.target.value)} placeholder="0.000"
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-xl font-black text-center outline-none focus:border-green-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 mb-1">Neto</p>
                              <p className="text-xl font-black text-green-400">
                                {Math.max(0, (prod.baseKg ?? 0) - (parseFloat(verduraDesperdicioKg) || 0)).toFixed(3)} kg
                              </p>
                            </div>
                          </div>
                        )}

                        {isMilanesaRecipe && showMenjunjeModal && (
                          <div className="bg-rose-950/50 border border-rose-500/30 rounded-xl p-4 space-y-3">
                            <p className="text-rose-300 font-black text-sm uppercase">🥩 Menjunje {menjunjeTipo} — Ingresá los kg usados</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Corte</label>
                                <input value={menjunjeCorte} onChange={e => setMenjunjeCorte(e.target.value)}
                                  placeholder={menjunjeTipo === 'Pollo' ? 'Pollo' : 'Cuadrada / Nalga'}
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg usados</label>
                                <input type="number" value={menjunjeKg} onChange={e => setMenjunjeKg(e.target.value)}
                                  placeholder="5.000"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button onClick={handleFinish}
                            className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2">
                            <CheckCircle2 size={16} /> Confirmar y finalizar
                          </button>
                          <button onClick={() => { setFinishingProd(null); setShowMenjunjeModal(false); }}
                            className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-12 text-slate-400">
                  <UtensilsCrossed size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-lg">Sin producciones activas</p>
                  <p className="text-sm mt-1">Iniciá una nueva producción</p>
                </div>
              )}

              <button onClick={() => setModalView('new')}
                className="w-full py-5 bg-slate-900 text-white font-black text-xl rounded-2xl hover:bg-amber-600 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3">
                <Plus size={24} /> NUEVA PRODUCCIÓN
              </button>
            </div>
          )}

          {/* VISTA NUEVA PRODUCCION */}
          {!!operador && modalView === 'new' && (
            <div className="flex gap-8 h-full">
              {/* LEFT: Planificación */}
              <div className="w-1/3 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shadow-sm">
                <h3 className="font-bold text-slate-400 uppercase text-xs mb-6 tracking-wider">Planificación</h3>

                {isVerdura ? (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-600 mb-1">Peso bruto a trabajar</label>
                    <p className="text-xs text-slate-400 mb-3">Ingresá los kg que vas a preparar</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" value={verduraBrutoKg}
                        onChange={e => setVerduraBrutoKg(e.target.value)} placeholder="0"
                        className="w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all bg-slate-50 border-green-200 text-green-600 focus:border-green-500 focus:bg-white" />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300">KG</span>
                    </div>
                  </div>
                ) : isPercent ? (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-600 mb-1">
                      {selectedProduct?.ingredients.find((i: any) => i.isBase)?.name ?? 'Ingrediente base'}
                    </label>
                    <p className="text-xs text-slate-400 mb-3">Ingresá la cantidad en kg</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" value={baseQtyKg}
                        onChange={e => setBaseQtyKg(e.target.value)} placeholder="0"
                        className="w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all bg-slate-50 border-amber-200 text-amber-600 focus:border-amber-500 focus:bg-white" />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300">KG</span>
                    </div>
                  </div>
                ) : selectedProduct ? (
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-slate-600 mb-2">Cantidad a producir</label>
                    <div className="relative">
                      <input type="number" value={targetUnits}
                        onChange={e => setTargetUnits(Math.max(0, Number(e.target.value)))}
                        className="w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all bg-slate-50 border-amber-200 text-amber-600 focus:border-amber-500 focus:bg-white" />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300 uppercase">{selectedProduct.unit}</span>
                    </div>
                  </div>
                ) : null}

                {selectedProduct?.warning && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 mt-auto">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <p className="text-sm text-blue-600 leading-tight">{selectedProduct.warning}</p>
                  </div>
                )}

                {selectedProduct && (
                  <button onClick={handleStart} disabled={!canStart}
                    className={`mt-4 w-full py-4 font-bold rounded-xl text-lg transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${canStart ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                    {isVerdura ? <><Play size={20} fill="currentColor" /> INICIAR</> :
                     allChecked ? <><Play size={20} fill="currentColor" /> INICIAR PRODUCCIÓN</> :
                     `FALTAN ${selectedProduct.ingredients.length - checkedIngredients.size} CHECKS`}
                  </button>
                )}
              </div>

              {/* RIGHT: Categorías / Productos / Receta */}
              <div className="w-2/3 flex flex-col">
                {isVerdura ? (
                  <div className="bg-white rounded-2xl border border-green-200 flex-1 flex items-center justify-center shadow-sm p-6">
                    <div className="text-center text-slate-400">
                      <p className="font-bold">Ingresá el peso bruto e iniciá la producción</p>
                    </div>
                  </div>
                ) : (
                <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm">
                  {/* Categorías */}
                  {view === 'category' && !selectedProduct && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
                      {KITCHEN_CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setView('product'); }}
                          className={`bg-white p-8 rounded-2xl border-2 ${cat.border} ${cat.hover} flex flex-col items-center transition-all active:scale-95`}>
                          {cat.icon}
                          <span className="font-bold text-slate-700">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Productos */}
                  {view === 'product' && !selectedProduct && (
                    <div className="p-4 flex-1 overflow-y-auto">
                      <button onClick={() => setView('category')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4">
                        <ArrowLeft size={14} /> Categorías
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        {(groupedRecipes[selectedCategory] ?? []).map((r: Recipe) => (
                          <button key={r.id} onClick={() => handleProductSelect(r)}
                            className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all text-left group relative">
                            {r.recipeType === 'percent' && (
                              <span className="absolute top-3 right-3 text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">%</span>
                            )}
                            <h3 className="font-bold text-base text-slate-800 group-hover:text-amber-600 pr-8 mb-1">{r.name}</h3>
                            <p className="text-xs text-slate-500">{r.recipeType === 'percent' ? 'Receta porcentual' : `Rinde: ${r.baseYield} ${r.unit}`}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Checklist */}
                  {selectedProduct && !isVerdura && (
                    <>
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><Calculator size={18} /> Checklist de Insumos</h3>
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {isPercent ? (baseQtyGr > 0 ? `Base: ${baseQtyKg} kg` : 'Ingresá la cantidad base') : `Para ${targetUnits} ${selectedProduct.unit}`}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold sticky top-0">
                          <tr>
                            <th className="py-3 pl-6 text-left w-12">✓</th>
                            <th className="py-3 text-left">Ingrediente</th>
                            <th className="py-3 pr-6 text-right">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedProduct.ingredients.map((ing: any, idx: number) => {
                            const isChecked = checkedIngredients.has(idx);
                            return (
                              <tr key={idx} onClick={() => toggleCheck(idx)}
                                className={`cursor-pointer transition-colors ${isChecked ? 'bg-green-50/50' : 'hover:bg-slate-50'}`}>
                                <td className="py-4 pl-6">{isChecked ? <CheckSquare className="text-green-500" size={20} /> : <Square className="text-slate-300" size={20} />}</td>
                                <td className={`py-4 font-medium ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                  {ing.name}
                                  {ing.isBase && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 font-black px-1.5 py-0.5 rounded">BASE</span>}
                                </td>
                                <td className={`py-4 pr-6 text-right font-black text-lg ${isChecked ? 'text-slate-300' : ing.isBase ? 'text-amber-600' : 'text-slate-900'}`}>
                                  {calcIngredient(idx)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}