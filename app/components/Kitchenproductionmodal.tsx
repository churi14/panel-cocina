"use client";
import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed, X, ArrowLeft, Play, CheckSquare, Square,
  CheckCircle2, Clock, Calculator, AlertCircle, Wheat, Droplet, ChefHat, Carrot
} from 'lucide-react';
import type { Recipe, ProductionRecord } from '../types';
import { supabase } from '../supabase';

function formatQty(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  }
  return `${grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)} gr`;
}

const KITCHEN_CATEGORIES = [
  { id: 'Panificados', label: 'Panificados',  border: 'border-amber-200', hover: 'hover:border-amber-400', icon: <Wheat   size={48} className="text-amber-600 mb-4" /> },
  { id: 'Salsas',      label: 'Salsas',       border: 'border-red-200',   hover: 'hover:border-red-400',   icon: <Droplet size={48} className="text-red-600 mb-4" /> },
  { id: 'Milanesas',   label: 'Milanesas',    border: 'border-rose-200',  hover: 'hover:border-rose-400',  icon: <ChefHat size={48} className="text-rose-600 mb-4" /> },
  { id: 'Verduras',    label: 'Verduras',     border: 'border-green-200', hover: 'hover:border-green-400', icon: <Carrot  size={48} className="text-green-600 mb-4" /> },
  { id: 'Prep',        label: 'Prep / Otros', border: 'border-blue-200',  hover: 'hover:border-blue-400',  icon: <Clock   size={48} className="text-blue-600 mb-4" /> },
];

// ─── PERSISTENCIA COCINA ──────────────────────────────────────────────────────

async function saveCocinaProduccion(recipeName: string, targetUnits: number, unit: string, baseQtyKg: number, startTime: number) {
  try {
    // Borra cualquier producción activa anterior y guarda la nueva
    await supabase.from('cocina_produccion_activa').delete().neq('id', 0);
    await supabase.from('cocina_produccion_activa').insert({
      recipe_name: recipeName,
      target_units: targetUnits,
      unit,
      base_qty_kg: baseQtyKg,
      start_time: startTime,
      status: 'running',
      updated_at: new Date().toISOString(),
    });
    // Notificar al panel admin via produccion_eventos
    await supabase.from('produccion_eventos').insert({
      tipo: 'inicio_cocina',
      kind: 'cocina',
      corte: recipeName,
      peso_kg: baseQtyKg,
      detalle: `Inicio cocina — ${recipeName}`,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error guardando producción cocina:', e);
  }
}

async function clearCocinaProduccion(recipeName: string, baseQtyKg: number) {
  try {
    await supabase.from('cocina_produccion_activa').delete().neq('id', 0);
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina',
      kind: 'cocina',
      corte: recipeName,
      peso_kg: baseQtyKg,
      detalle: `Fin cocina — ${recipeName}`,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error limpiando producción cocina:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────


// ─── Descuento de stock para recetas de Milanesa (Menjunje) ───────────────────
async function deductStockForMilanesa(
  corteNombre: string,  // ej: "Cuadrada", "Nalga"
  cantidadKg: number,   // kg de milanesa cruda a usar
  ingredientes: { nombre: string; cantidad: number; unidad: string }[]
) {
  try {
    // 1. Descontar del stock_produccion: Milanesa - {corte}
    const productoMila = `Milanesa - ${corteNombre}`;
    const { data: milaData } = await supabase
      .from('stock_produccion')
      .select('id, cantidad')
      .eq('producto', productoMila)
      .maybeSingle();

    if (milaData) {
      const newQty = Math.max(0, Number(milaData.cantidad) - cantidadKg);
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat(newQty.toFixed(3)) })
        .eq('id', milaData.id);
    }

    // 2. Descontar ingredientes del stock directo (huevo, pan rallado, etc.)
    for (const ing of ingredientes) {
      const { data: stockData } = await supabase
        .from('stock')
        .select('id, cantidad')
        .ilike('nombre', ing.nombre)
        .maybeSingle();

      if (stockData) {
        const newQty = Math.max(0, Number(stockData.cantidad) - ing.cantidad);
        await supabase.from('stock')
          .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
          .eq('id', stockData.id);

        // Log movement
        await supabase.from('stock_movements').insert({
          nombre: ing.nombre, categoria: 'SECOS',
          tipo: 'egreso', cantidad: ing.cantidad, unidad: ing.unidad,
          motivo: `Menjunje Milanesa — ${productoMila}`,
          operador: 'Cocina', fecha: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('Error descontando stock menjunje:', e);
  }
}


// ─── Descuento de stock para salsas en potes ──────────────────────────────────
const POTES_MAP: Record<string, string> = {
  'potes_ketchup':  'KETCHUP',
  'potes_barbacoa': 'BARBACOA',
  'potes_mayonesa': 'MAYONESA',
  'potes_savora':   'SAVORA',
};
const POTE_ML = 500; // ml por pote

async function deductStockForSalsa(recipeId: string, baseKgUsado: number, potesProducidos: number) {
  try {
    const stockNombre = POTES_MAP[recipeId];
    if (!stockNombre || baseKgUsado <= 0) return;

    // 1. Descontar kg de stock directo
    const { data } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('nombre', stockNombre)
      .maybeSingle();

    if (data) {
      const newQty = Math.max(0, Number(data.cantidad) - baseKgUsado);
      await supabase.from('stock')
        .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'SECOS',
        tipo: 'egreso', cantidad: parseFloat(baseKgUsado.toFixed(3)), unidad: 'kg',
        motivo: `Producción potes ${stockNombre}`,
        operador: 'Cocina', fecha: new Date().toISOString(),
      });
    }

    // 2. Sumar potes a stock_produccion
    if (potesProducidos > 0) {
      const prodNombre = `Potes ${stockNombre.charAt(0) + stockNombre.slice(1).toLowerCase()} 500ml`;
      const { data: prodData } = await supabase
        .from('stock_produccion')
        .select('id, cantidad')
        .eq('producto', prodNombre)
        .maybeSingle();

      if (prodData) {
        await supabase.from('stock_produccion')
          .update({ cantidad: Number(prodData.cantidad) + potesProducidos, ultima_prod: new Date().toISOString() })
          .eq('id', prodData.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'salsas', cantidad: potesProducidos, unidad: 'u', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) {
    console.error('Error descontando stock salsa:', e);
  }
}


// ─── Stock map verduras: nombre en stock ──────────────────────────────────────
const VERDURA_STOCK_MAP: Record<string, string> = {
  'verdura_tomate_rodajas': 'TOMATE',
  'verdura_lechuga':        'LECHUGA',
  'verdura_cebolla_brunoise': 'CEBOLLA',
  'verdura_cebolla_rodajas':  'CEBOLLA',
  'verdura_morron':           'MORRON',
};
const VERDURA_PROD_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'Tomate cortado',
  'verdura_lechuga':          'Lechuga preparada',
  'verdura_cebolla_brunoise': 'Cebolla brunoise',
  'verdura_cebolla_rodajas':  'Cebolla rodajas',
  'verdura_morron':           'Morrón preparado',
};

async function deductStockForVerdura(recipeId: string, brutoPesoKg: number, desperdicioKg: number) {
  const stockNombre = VERDURA_STOCK_MAP[recipeId];
  const prodNombre  = VERDURA_PROD_MAP[recipeId];
  if (!stockNombre || brutoPesoKg <= 0) return;

  const netoKg = Math.max(0, brutoPesoKg - desperdicioKg);

  try {
    // 1. Descontar bruto del stock
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = Math.max(0, Number(data.cantidad) - brutoPesoKg);
      await supabase.from('stock')
        .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'VERDURA',
        tipo: 'egreso', cantidad: parseFloat(brutoPesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Producción ${prodNombre}`, operador: 'Cocina', fecha: new Date().toISOString(),
      });
    }

    // 2. Sumar neto a stock_produccion
    if (netoKg > 0) {
      const { data: prodData } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', prodNombre).maybeSingle();
      if (prodData) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(prodData.cantidad) + netoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', prodData.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'verduras', cantidad: parseFloat(netoKg.toFixed(3)), unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) { console.error('Error deductStockForVerdura:', e); }
}

export default function KitchenProductionModal({ onClose, activeProduction, setActiveProduction, recipesDB, setProductionHistory }: any) {
  const [view, setView] = useState<'category' | 'product' | 'recipe'>(activeProduction ? 'recipe' : 'category');
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
    if (activeProduction && !selectedProduct) {
      const found = recipesDB.find((r: Recipe) => r.name === activeProduction.recipeName);
      if (found) {
        setSelectedProduct(found);
        setTargetUnits(activeProduction.targetUnits);
        setCheckedIngredients(new Set(found.ingredients.map((_: any, i: number) => i)));
        // Restaurar baseQtyKg si la unidad es kg base
        if (activeProduction.unit === 'kg base') {
          setBaseQtyKg(String(activeProduction.targetUnits));
        }
      }
    }
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeProduction]);

  const handleProductSelect = (r: Recipe) => {
    setSelectedProduct(r);
    setTargetUnits(r.baseYield || 0);
    setBaseQtyKg('');
    setCheckedIngredients(new Set());
    setView('recipe');
  };

  const toggleCheck = (idx: number) => {
    if (activeProduction) return;
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

    setActiveProduction({
      recipeName: selectedProduct.name,
      targetUnits: finalTargetUnits,
      unit: finalUnit,
      startTime: now,
      status: 'running',
    });

    // Persistir en Supabase y notificar al admin
    await saveCocinaProduccion(selectedProduct.name, finalTargetUnits, finalUnit, finalBaseKg, now);
  };

  // ── Estado para menjunje milanesa ─────────────────────────────────────────
  const [showMenjunjeModal, setShowMenjunjeModal] = useState(false);
  const [menjunjeCorte, setMenjunjeCorte]         = useState('');
  const [menjunjeKg, setMenjunjeKg]               = useState('');

  const isSalsaPotes    = selectedProduct?.id?.startsWith('potes_')    ?? false;
  const isVerduraRecipe = selectedProduct?.id?.startsWith('verdura_') ?? false;
  const isMilanesaRecipe = selectedProduct?.category === 'Milanesas' ||
    activeProduction?.recipeName?.toLowerCase().includes('menjunje');

  // Detectar si es carne o pollo para descuento correcto
  const menjunjeTipo = activeProduction?.recipeName?.toLowerCase().includes('pollo') ? 'Pollo' : 'Carne';

  const handleFinish = async () => {
    // Si es receta de milanesa, mostrar modal de menjunje primero
    if (isMilanesaRecipe && !showMenjunjeModal) {
      setShowMenjunjeModal(true);
      return;
    }
    setShowMenjunjeModal(false);

    const endTime = Date.now();
    const dur = (endTime - activeProduction.startTime) / 1000;
    const baseKg = parseFloat(baseQtyKg || String(activeProduction.targetUnits) || '0');

    setProductionHistory((prev: ProductionRecord[]) => [...prev, {
      id: Date.now(), date: new Date().toLocaleDateString(), timestamp: endTime,
      recipeName: activeProduction.recipeName,
      quantity: activeProduction.targetUnits, unit: activeProduction.unit,
      durationSeconds: dur,
      startTime: new Date(activeProduction.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      const potesProducidos = Math.round(activeProduction.targetUnits);
      const kgUsados = potesProducidos * 0.5;
      await deductStockForSalsa(selectedProduct.id, kgUsados, potesProducidos);
    }

    // Limpiar Supabase y notificar al admin
    await clearCocinaProduccion(activeProduction.recipeName, baseKg);

    setActiveProduction(null);
    setMenjunjeCorte('');
    setMenjunjeKg('');
    onClose();
  };

  const elapsedTime = activeProduction ? currentTime - activeProduction.startTime : 0;
  const formatTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            {(view === 'product' || view === 'recipe') && !activeProduction && (
              <button onClick={() => setView(view === 'recipe' ? 'product' : 'category')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><UtensilsCrossed className="text-amber-600" /> Cocina General</h2>
              <p className="text-slate-500 text-sm">{activeProduction ? 'Producción en curso...' : view === 'recipe' ? `Configurando: ${selectedProduct?.name}` : view === 'product' ? selectedCategory : 'Seleccioná una categoría'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
          {view === 'category' && !activeProduction && (
            <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto w-full content-center h-full">
              {KITCHEN_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setView('product'); }}
                  className={`flex flex-col items-center justify-center p-8 bg-white border-2 ${cat.border} rounded-3xl ${cat.hover} hover:shadow-xl transition-all group`}>
                  <div className="group-hover:scale-110 transition-transform">{cat.icon}</div>
                  <span className="text-xl font-bold text-slate-800">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {view === 'product' && !activeProduction && (
            <div className="grid grid-cols-2 gap-3">
              {(groupedRecipes[selectedCategory] ?? []).map((r: Recipe) => (
                <button key={r.id} onClick={() => handleProductSelect(r)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all text-left group relative">
                  {r.recipeType === 'percent' && (
                    <span className="absolute top-3 right-3 text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">%</span>
                  )}
                  <h3 className="font-bold text-base text-slate-800 group-hover:text-amber-600 pr-8 mb-1">{r.name}</h3>
                  <p className="text-xs text-slate-500">{r.recipeType === 'percent' ? 'Receta porcentual' : `Rinde: ${r.baseYield} ${r.unit}`}</p>
                  {r.warning && <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">{r.warning}</span>}
                </button>
              ))}
              {(!groupedRecipes[selectedCategory] || groupedRecipes[selectedCategory].length === 0) && (
                <div className="col-span-3 text-center py-16 text-slate-400">
                  <ChefHat size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">No hay recetas en esta categoría</p>
                </div>
              )}
            </div>
          )}

          {view === 'recipe' && selectedProduct && (
            <div className="flex gap-8 h-full">
              <div className="w-1/3 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col shadow-sm">
                <h3 className="font-bold text-slate-400 uppercase text-xs mb-6 tracking-wider">{activeProduction ? 'Estado Actual' : 'Planificación'}</h3>

                {isVerdura ? (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-600 mb-1">Peso bruto a trabajar</label>
                    <p className="text-xs text-slate-400 mb-3">Ingresá los kg que vas a preparar</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" value={verduraBrutoKg} disabled={!!activeProduction}
                        onChange={e => setVerduraBrutoKg(e.target.value)} placeholder="0"
                        className={`w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all ${activeProduction ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-green-200 text-green-600 focus:border-green-500 focus:bg-white'}`} />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300">KG</span>
                    </div>
                  </div>
                ) : isPercent ? (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-600 mb-1">
                      {selectedProduct.ingredients.find(i => i.isBase)?.name ?? 'Ingrediente base'}
                    </label>
                    <p className="text-xs text-slate-400 mb-3">Ingresá la cantidad en kg</p>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="0.1" value={baseQtyKg} disabled={!!activeProduction}
                        onChange={e => setBaseQtyKg(e.target.value)} placeholder="0"
                        className={`w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all ${activeProduction ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-amber-200 text-amber-600 focus:border-amber-500 focus:bg-white'}`} />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300">KG</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-slate-600 mb-2">Cantidad a producir</label>
                    <div className="relative">
                      <input type="number" value={targetUnits} disabled={!!activeProduction}
                        onChange={e => setTargetUnits(Math.max(0, Number(e.target.value)))}
                        className={`w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-all ${activeProduction ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-amber-200 text-amber-600 focus:border-amber-500 focus:bg-white'}`} />
                      <span className="absolute right-4 top-6 text-sm font-bold text-slate-300 uppercase">{selectedProduct.unit}</span>
                    </div>
                  </div>
                )}

                {activeProduction && (
                  <div className="mt-auto mb-4 bg-slate-900 rounded-2xl p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500 animate-pulse" />
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block mb-2">Tiempo Transcurrido</span>
                    <span className="text-5xl font-mono font-bold text-white">{formatTimer(elapsedTime)}</span>
                  </div>
                )}

                {selectedProduct.warning && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 mt-auto">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <p className="text-sm text-blue-600 leading-tight">{selectedProduct.warning}</p>
                  </div>
                )}
              </div>

              <div className="w-2/3 flex flex-col">
                {isVerdura ? (
                  <div className="bg-white rounded-2xl border border-green-200 flex-1 flex flex-col overflow-hidden shadow-sm p-6 space-y-4">
                    <h3 className="font-bold text-green-700 text-sm uppercase">🥬 {selectedProduct.name}</h3>
                    {activeProduction ? (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500">Bruto: <strong>{verduraBrutoKg} kg</strong> — ingresá el desperdicio al terminar.</p>
                        <div>
                          <label className="text-xs font-black text-slate-500 uppercase mb-1 block">Desperdicio (kg)</label>
                          <input type="number" value={verduraDesperdicioKg}
                            onChange={e => setVerduraDesperdicioKg(e.target.value)}
                            placeholder="0.000"
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-3xl font-black text-center outline-none focus:border-green-400" />
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                          <p className="text-xs text-slate-500 mb-1">Neto estimado</p>
                          <p className="text-3xl font-black text-green-700">
                            {Math.max(0, parseFloat(verduraBrutoKg || '0') - (parseFloat(verduraDesperdicioKg) || 0)).toFixed(3)} kg
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm text-center">
                        <p>Ingresá el peso bruto e iniciá la producción</p>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm">
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
                        {!isVerdura && selectedProduct.ingredients.map((ing, idx) => {
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
                  <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0">
                    {!activeProduction ? (
                      <button onClick={handleStart} disabled={!canStart}
                        className={`w-full py-4 font-bold rounded-xl text-lg transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${canStart ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                        {isVerdura ? <><Play size={20} fill="currentColor" /> INICIAR PRODUCCIÓN</> : allChecked ? <><Play size={20} fill="currentColor" /> INICIAR PRODUCCIÓN</> : `FALTAN ${selectedProduct.ingredients.length - checkedIngredients.size} CHECKS`}
                      </button>
                    ) : (
                      <>
                      {isVerduraRecipe && (
                        <div className="bg-green-950/40 border border-green-500/30 rounded-2xl p-4 space-y-3 mb-4">
                          <p className="text-green-300 font-black text-sm uppercase">🥬 ¿Cuánto desperdicio?</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Desperdicio (kg)</label>
                              <input type="number" value={verduraDesperdicioKg}
                                onChange={e => setVerduraDesperdicioKg(e.target.value)}
                                placeholder="0.000"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-3 text-2xl font-black text-center outline-none focus:border-green-500" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 mb-1">Neto</p>
                              <p className="text-2xl font-black text-green-400">
                                {Math.max(0, parseFloat(verduraBrutoKg || '0') - (parseFloat(verduraDesperdicioKg) || 0)).toFixed(3)} kg
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {showMenjunjeModal && (
                        <div className="bg-rose-950/50 border border-rose-500/30 rounded-2xl p-5 space-y-4 mb-4">
                          <p className="text-rose-300 font-black text-sm uppercase">🥩 Menjunje {menjunjeTipo} — Ingresá los kg usados</p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Corte (ej: Cuadrada, Nalga)</label>
                              <input
                                value={menjunjeCorte}
                                onChange={e => setMenjunjeCorte(e.target.value)}
                                placeholder={menjunjeTipo === 'Pollo' ? 'Pollo' : 'Cuadrada / Nalga / etc.'}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:border-rose-500"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg de milanesa usada</label>
                              <input
                                type="number"
                                value={menjunjeKg}
                                onChange={e => setMenjunjeKg(e.target.value)}
                                placeholder="5.000"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:border-rose-500"
                              />
                            </div>
                            <p className="text-xs text-slate-500">Esto descuenta del stock de producción y suma el menjunje al historial.</p>
                          </div>
                        </div>
                      )}
                      <button onClick={handleFinish} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl text-lg hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <CheckCircle2 size={20} /> FINALIZAR Y GUARDAR
                      </button>
                      </>
                    )}
                  </div>
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