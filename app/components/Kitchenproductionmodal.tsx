"use client";
import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed, X, ArrowLeft, Play, CheckSquare, Square, Plus,
  CheckCircle2, Clock, Calculator, AlertCircle, Wheat, Droplet, ChefHat, Carrot
} from 'lucide-react';
import type { Recipe, ProductionRecord } from '../types';
import { supabase } from '../supabase';
import { checkAndNotifyStock, sendResumenTurno, checkAndNotifyProduccionByName } from './pushEvents';

function formatQty(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  }
  return `${grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)} gr`;
}

const KITCHEN_CATEGORIES = [
  { id: 'Panificados', label: 'Panificados',  border: 'border-amber-200',  hover: 'hover:border-amber-400',  icon: <Wheat   size={36} className="text-amber-600 mb-4" /> },
  { id: 'Salsas',      label: 'Salsas',       border: 'border-red-200',    hover: 'hover:border-red-400',    icon: <Droplet size={36} className="text-red-600 mb-4" /> },
  { id: 'Fraccionar',  label: 'Fraccionar',   border: 'border-purple-200', hover: 'hover:border-purple-400', icon: <Droplet size={36} className="text-purple-600 mb-4" /> },
  { id: 'Milanesas',   label: 'Milanesas',    border: 'border-rose-200',   hover: 'hover:border-rose-400',   icon: <ChefHat size={36} className="text-rose-600 mb-4" /> },
  { id: 'Verduras',    label: 'Verduras',     border: 'border-green-200',  hover: 'hover:border-green-400',  icon: <Carrot  size={36} className="text-green-600 mb-4" /> },
  { id: 'Fiambres',    label: 'Fiambres',     border: 'border-yellow-200', hover: 'hover:border-yellow-400', icon: <ChefHat size={36} className="text-yellow-600 mb-4" /> },
  { id: 'Prep',        label: 'Prep / Otros', border: 'border-blue-200',   hover: 'hover:border-blue-400',   icon: <Clock   size={36} className="text-blue-600 mb-4" /> },
];

// ─── PERSISTENCIA COCINA ──────────────────────────────────────────────────────

async function saveCocinaProduccion(id: number, recipeName: string, targetUnits: number, unit: string, baseQtyKg: number, startTime: number, operadorCocina: string, recipeId?: string) {
  try {
    await supabase.from('cocina_produccion_activa').insert({
      id,
      recipe_name: recipeName,
      recipe_id: recipeId ?? null,
      target_units: targetUnits,
      unit,
      base_qty_kg: baseQtyKg,
      start_time: startTime,
      status: 'running',
      operador: operadorCocina,
      updated_at: new Date().toISOString(),
    });
    // Notificar al panel admin via produccion_eventos
    await supabase.from('produccion_eventos').insert({
      tipo: 'inicio_cocina',
      kind: 'cocina',
      corte: recipeName,
      operador: operadorCocina,
      peso_kg: baseQtyKg,
      detalle: `Inicio cocina — ${recipeName}`,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error guardando producción cocina:', e);
  }
}

async function clearCocinaProduccion(prodId: number, recipeName: string, baseQtyKg: number, operadorCocina: string) {
  try {
    await supabase.from('cocina_produccion_activa').delete().eq('id', prodId);
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina',
      kind: 'cocina',
      corte: recipeName,
      operador: operadorCocina,
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
      const newQty = parseFloat((Number(milaData.cantidad) - cantidadKg).toFixed(3));
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat(newQty.toFixed(3)) })
        .eq('id', milaData.id);
      await checkAndNotifyProduccionByName(productoMila, newQty, 'kg', supabase);
    }

    // 2. Descontar ingredientes del stock directo (huevo, pan rallado, etc.)
    for (const ing of ingredientes) {
      const { data: stockData } = await supabase
        .from('stock')
        .select('id, cantidad')
        .ilike('nombre', ing.nombre)
        .maybeSingle();

      if (stockData) {
        const newQty = parseFloat((Number(stockData.cantidad) - ing.cantidad).toFixed(3));
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


// ─── Fraccionado de salsas en potes ────────────────────────────────────────
async function deductStockForFraccion(
  stockNombre: string, stockOrigen: 'stock' | 'stock_produccion',
  kgUsado: number, potesProducidos: number, tipoPote: string, operador: string
) {
  if (kgUsado <= 0 || potesProducidos <= 0) return;
  const tabla = stockOrigen === 'stock' ? 'stock' : 'stock_produccion';
  const campoNombre = stockOrigen === 'stock' ? 'nombre' : 'producto';
  const { data } = await supabase.from(tabla).select('id, cantidad').eq(campoNombre, stockNombre).maybeSingle();
  if (data) {
    const newQty = parseFloat((Number(data.cantidad) - kgUsado).toFixed(3));
    await supabase.from(tabla).update({ cantidad: newQty, ...(stockOrigen === 'stock' ? { fecha_actualizacion: new Date().toISOString().slice(0,10) } : { ultima_prod: new Date().toISOString() }) }).eq('id', data.id);
    if (stockOrigen === 'stock') {
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({ nombre: stockNombre, categoria: 'SECOS', tipo: 'egreso', cantidad: parseFloat(kgUsado.toFixed(3)), unidad: 'kg', motivo: `Fraccionado ${stockNombre} — ${potesProducidos}u ${tipoPote}`, operador, fecha: new Date().toISOString() });
    }
  }
  const { data: pd } = await supabase.from('stock_produccion').select('id, cantidad').ilike('producto', `%${stockNombre}%`).maybeSingle();
  if (pd) {
    await supabase.from('stock_produccion').update({ cantidad: Number(pd.cantidad) + potesProducidos, ultima_prod: new Date().toISOString() }).eq('id', pd.id);
  } else {
    await supabase.from('stock_produccion').insert({ producto: `POTES ${stockNombre}`, categoria: 'dip', cantidad: potesProducidos, unidad: 'u', ultima_prod: new Date().toISOString() });
  }
  await supabase.from('produccion_eventos').insert({ tipo: 'fin_cocina', kind: 'salsa', corte: stockNombre, peso_kg: kgUsado, operador, detalle: `${potesProducidos} potes ${tipoPote} · ${kgUsado.toFixed(3)}kg`, fecha: new Date().toISOString() });
}

// ─── Stock map verduras: nombre en stock ──────────────────────────────────────
const VERDURA_STOCK_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'TOMATE',
  'verdura_lechuga':          'LECHUGA',
  'verdura_cebolla_brunoise': 'CEBOLLA',
  'verdura_cebolla_rodajas':  'CEBOLLA',
  'verdura_morron':           'MORRON',
  'verdura_ajo':              'AJO',
  'verdura_verdeo':           'CEBOLLA DE VERDEO',
};
const VERDURA_PROD_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'Tomate cortado',
  'verdura_lechuga':          'Lechuga preparada',
  'verdura_cebolla_brunoise': 'Cebolla brunoise',
  'verdura_cebolla_rodajas':  'Cebolla rodajas',
  'verdura_morron':           'Morrón preparado',
  'verdura_ajo':              'Ajo preparado',
  'verdura_verdeo':           'Cebolla de verdeo',
};

// ─── Stock map fiambres ───────────────────────────────────────────────────────
const FIAMBRE_STOCK_MAP: Record<string, string> = {
  'fiambre_jamon':          'JAMÓN',
  'fiambre_panceta':        'PANCETA',
  'fiambre_cheddar_feta':   'CHEDDAR EN FETA',
  'fiambre_cheddar_liq':    'CHEDDAR LIQUIDO',
  'fiambre_cheddar_burger': 'CHEDDAR PARA BURGUER',
  'fiambre_provoleta':      'PROVOLETA',
  'fiambre_muzza_sanguch':  'QUESO MUZZA',
  'fiambre_muzza_mila':     'QUESO MUZZA',
  'fiambre_tybo':           'QUESO TYBO',
};
const FIAMBRE_PROD_MAP: Record<string, string> = {
  'fiambre_jamon':          'Jamón',
  'fiambre_panceta':        'Panceta',
  'fiambre_cheddar_feta':   'Cheddar en Feta',
  'fiambre_cheddar_liq':    'Cheddar Líquido',
  'fiambre_cheddar_burger': 'Cheddar para Burger',
  'fiambre_provoleta':      'Provoleta',
  'fiambre_muzza_sanguch':  'Queso Muzza para Sanguchería',
  'fiambre_muzza_mila':     'Queso Muzza para Mila al Plato',
  'fiambre_tybo':           'Queso Tybo',
};
const FIAMBRE_UNIDAD_MAP: Record<string, string> = {
  'fiambre_cheddar_feta': 'u',
};

async function deductStockForFiambre(recipeId: string, pesoKg: number, operador: string) {
  const stockNombre = FIAMBRE_STOCK_MAP[recipeId];
  const prodNombre  = FIAMBRE_PROD_MAP[recipeId];
  const unidad      = FIAMBRE_UNIDAD_MAP[recipeId] ?? 'kg';
  if (!stockNombre || pesoKg <= 0) return;
  try {
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = parseFloat((Number(data.cantidad) - pesoKg).toFixed(3));
      await supabase.from('stock')
        .update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0,10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'FIAMBRE',
        tipo: 'egreso', cantidad: parseFloat(pesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Preparación ${prodNombre}`, operador, fecha: new Date().toISOString(),
      });
    }
    const { data: pd } = await supabase.from('stock_produccion')
      .select('id, cantidad').ilike('producto', prodNombre).maybeSingle();
    if (pd) {
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat((Number(pd.cantidad) + pesoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
        .eq('id', pd.id);
    } else {
      await supabase.from('stock_produccion')
        .insert({ producto: prodNombre, categoria: 'fiambre', cantidad: parseFloat(pesoKg.toFixed(3)), unidad, ultima_prod: new Date().toISOString() });
    }
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'fiambre', corte: prodNombre,
      peso_kg: pesoKg, operador, detalle: `${pesoKg}kg preparado`,
      fecha: new Date().toISOString(),
    });
  } catch(e) { console.error('deductStockForFiambre:', e); }
}

async function addSalsaToStock(prodNombre: string, kgProducidos: number, operador: string) {
  if (kgProducidos <= 0) return;
  try {
    const { data: pd } = await supabase.from('stock_produccion')
      .select('id, cantidad').ilike('producto', prodNombre).maybeSingle();
    if (pd) {
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat((Number(pd.cantidad) + kgProducidos).toFixed(3)), ultima_prod: new Date().toISOString() })
        .eq('id', pd.id);
    } else {
      await supabase.from('stock_produccion')
        .insert({ producto: prodNombre, categoria: 'salsa', cantidad: parseFloat(kgProducidos.toFixed(3)), unidad: 'kg', ultima_prod: new Date().toISOString() });
    }
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'salsa', corte: prodNombre,
      peso_kg: kgProducidos, operador, detalle: `${kgProducidos}kg producidos`,
      fecha: new Date().toISOString(),
    });
  } catch(e) { console.error('addSalsaToStock:', e); }
}

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
      const newQty = parseFloat((Number(data.cantidad) - brutoPesoKg).toFixed(3));
      await supabase.from('stock')
        .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'VERDURA',
        tipo: 'egreso', cantidad: parseFloat(brutoPesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Producción ${prodNombre}`, operador: 'Cocina', fecha: new Date().toISOString(),
      });
      // Log desperdicio
      await supabase.from('produccion_eventos').insert({
        tipo: 'fin_cocina', kind: 'cocina', corte: prodNombre,
        peso_kg: brutoPesoKg, waste_kg: desperdicioKg,
        operador: 'Cocina', detalle: `Bruto: ${brutoPesoKg}kg | Desperdicio: ${desperdicioKg}kg | Neto: ${netoKg}kg`,
        fecha: new Date().toISOString(),
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

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];

export default function KitchenProductionModal({ onClose, activeProductions, setActiveProductions, recipesDB, setProductionHistory, operadorNombre }: {
  onClose: () => void;
  activeProductions: import('../types').ActiveProductionItem[];
  setActiveProductions: React.Dispatch<React.SetStateAction<import('../types').ActiveProductionItem[]>>;
  recipesDB: any[];
  setProductionHistory: any;
  operadorNombre?: string;
}) {
  const [operador, setOperador] = useState(''); // Siempre mostrar selector — no auto-fill
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

  // Mobile keyboard: handled via sheet layout and autoFocus

  const handleProductSelect = async (r: Recipe) => {
    setSelectedProduct(r);
    setTargetUnits(r.baseYield || 0);
    setBaseQtyKg('');
    setCheckedIngredients(new Set());
    setSelectedMenjunjeStock('');
    // Si es menjunje, fetch stocks disponibles
    if (r.id.startsWith('menjunje_')) {
      const { data } = await supabase.from('stock_produccion')
        .select('producto, cantidad')
        .eq('categoria', 'milanesa')
        .gt('cantidad', 0)
        .order('producto');
      const filtered = (data ?? [])
        .filter((s: any) => !s.producto.toLowerCase().includes('jugo') && !s.producto.toLowerCase().includes('empanada'))
        .map((s: any) => ({
          ...s,
          producto: s.producto.toLowerCase().includes('nalga feteada') ? 'Milanesa - Nalga' : s.producto,
        }));
      setMenjunjeStocks(filtered);
    }
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
  const isFiambre  = selectedProduct?.recipeType === 'fiambre';
  const isEmpanado = selectedProduct?.recipeType === 'empanado';
  const canStart = (isVerdura || isFiambre) ? parseFloat(verduraBrutoKg) > 0 : isPercent ? baseQtyGr > 0 && allChecked : targetUnits > 0 && (isEmpanado || allChecked);

  const handleStart = async () => {
    if (!canStart || !selectedProduct) return;
    const now = Date.now();
    const finalTargetUnits = (isVerdura || isFiambre) ? parseFloat(verduraBrutoKg) : isPercent ? parseFloat(baseQtyKg) : targetUnits;
    const finalUnit = (isVerdura || isFiambre) ? 'kg' : isPercent ? 'kg base' : selectedProduct.unit;
    const finalBaseKg = (isVerdura || isFiambre) ? parseFloat(verduraBrutoKg) : parseFloat(baseQtyKg || '0');

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
    await saveCocinaProduccion(now, selectedProduct.name, finalTargetUnits, finalUnit, finalBaseKg, now, operador, selectedProduct.id);
  };

  // ── Produccion activa seleccionada para finalizar ────────────────────────
  const [finishingProd, setFinishingProd] = useState<import('../types').ActiveProductionItem | null>(null);

  // ── Estado para menjunje milanesa ─────────────────────────────────────────
  const [showMenjunjeModal, setShowMenjunjeModal] = useState(false);
  const [menjunjeCorte, setMenjunjeCorte]         = useState('');
  const [menjunjeStocks, setMenjunjeStocks]       = useState<{producto: string; cantidad: number}[]>([]);
  const [selectedMenjunjeStock, setSelectedMenjunjeStock] = useState('');
  const [menjunjeKg, setMenjunjeKg]               = useState('');
  const [milanesaKgSalieron, setMilanesaKgSalieron] = useState('');
  const [milanesaUnidades, setMilanesaUnidades]     = useState('');
  const [panUnidades, setPanUnidades]               = useState('');
  const [showPanModal, setShowPanModal]             = useState(false);
  const [fraccionPote, setFraccionPote]             = useState('');
  const [fraccionCantidad, setFraccionCantidad]     = useState('');
  const [showFraccionModal, setShowFraccionModal]   = useState(false);
  // Salsa kg modal
  const [showSalsaModal, setShowSalsaModal]         = useState(false);
  const [salsaKgProducidos, setSalsaKgProducidos]   = useState('');
  // Empanado modal
  const [showEmpanadoModal, setShowEmpanadoModal]   = useState(false);
  const [empanadoMenjunjeKg, setEmpanadoMenjunjeKg] = useState('');
  const [empanadoSalieronKg, setEmpanadoSalieronKg] = useState('');
  const [empanadoTipo, setEmpanadoTipo]             = useState<'carne'|'pollo'>('carne');
  const [empanadoCorteStock, setEmpanadoCorteStock] = useState(''); // ej: "Milanesa - Tapa de Nalga"
  const [empanadoStocks, setEmpanadoStocks]         = useState<{producto: string; cantidad: number}[]>([]);

  const activeRecipeId = finishingProd?.recipeId ?? selectedProduct?.id ?? '';
  const activeRecipeName = finishingProd?.recipeName ?? '';
  const isFraccion       = (selectedProduct as any)?.recipeType === 'fraccion';
  const isVerduraRecipe  = activeRecipeId.startsWith('verdura_');
  const isFiambreRecipe  = activeRecipeId.startsWith('fiambre_');
  const isEmpanadoRecipe = activeRecipeId.startsWith('empanado_');
  const isPanRecipe      = activeRecipeId.startsWith('pan_');
  const isMilanesaRecipe = activeRecipeName.toLowerCase().includes('menjunje') ||
    recipesDB.find((r: any) => r.name === activeRecipeName)?.category === 'Milanesas';
  const isSalsaRecipe    = !isFraccion && !isPanRecipe && !isMilanesaRecipe && !isVerduraRecipe && !isFiambreRecipe && !isEmpanadoRecipe &&
    recipesDB.find((r: any) => r.name === activeRecipeName)?.category === 'Salsas';
  const menjunjeTipo = activeRecipeName.toLowerCase().includes('pollo') ? 'Pollo' : 'Carne';

  const handleFinish = async () => {
    const prod = finishingProd;
    if (!prod) return;
    if (isFraccion && !showFraccionModal) { setShowFraccionModal(true); return; }
    setShowFraccionModal(false);
    // Pan: pedir unidades
    if (isPanRecipe && !showPanModal) { setShowPanModal(true); return; }
    setShowPanModal(false);
    // Menjunje milanesa
    if (isMilanesaRecipe && !showMenjunjeModal) { setShowMenjunjeModal(true); return; }
    setShowMenjunjeModal(false);
    // Empanado: pedir kg menjunje y kg salidos
    if (isEmpanadoRecipe && !showEmpanadoModal) {
      const { data } = await supabase.from('stock_produccion')
        .select('producto, cantidad')
        .eq('categoria', 'milanesa')
        .gt('cantidad', 0)
        .order('producto');
      const filtered = (data ?? [])
        .filter((s: any) => !s.producto.toLowerCase().includes('jugo') && !s.producto.toLowerCase().includes('empanada'))
        .map((s: any) => ({
          ...s,
          producto: s.producto.toLowerCase().includes('nalga feteada') ? 'Milanesa - Nalga' : s.producto,
        }));
      setEmpanadoStocks(filtered);
      setEmpanadoCorteStock('');
      setShowEmpanadoModal(true);
      return;
    }
    setShowEmpanadoModal(false);
    // Salsa: pedir kg producidos
    if (isSalsaRecipe && !showSalsaModal) { setShowSalsaModal(true); return; }
    setShowSalsaModal(false);

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

      // Registrar milanesas producidas en stock_produccion
      const kgSalieron = parseFloat(milanesaKgSalieron) || 0;
      const unidades   = parseInt(milanesaUnidades) || 0;
      if (kgSalieron > 0 && unidades > 0) {
        const grPorU = Math.round((kgSalieron / unidades) * 1000);
        const tipoMila = corteKey.toLowerCase().includes('pollo') ? 'Suprema de Pollo' : 
                         activeRecipeName.toLowerCase().includes('suprema') ? 'Suprema' : 'Milanesa';
        const productoNombre = `${tipoMila} - ${corteKey}`;
        
        // Upsert en stock_produccion
        const { data: existente } = await supabase.from('stock_produccion')
          .select('id, cantidad').eq('producto', productoNombre).maybeSingle();
        if (existente) {
          await supabase.from('stock_produccion')
            .update({ cantidad: parseFloat((existente.cantidad + unidades).toFixed(0)), ultima_prod: new Date().toISOString() })
            .eq('id', existente.id);
        } else {
          await supabase.from('stock_produccion')
            .insert({ producto: productoNombre, categoria: 'milanesa', cantidad: unidades, unidad: 'u', ultima_prod: new Date().toISOString() });
        }

        // Notificar al admin
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `✅ Menjunje finalizado · \${operador}`,
            body: `\${unidades} \${tipoMila} (\${kgSalieron}kg · \${grPorU}g/u) — \${corteKey}`,
            tag: 'menjunje-fin', url: '/admin',
          }),
        });

        // Guardar rendimiento en produccion_eventos
        await supabase.from('produccion_eventos').insert({
          tipo: 'fin_cocina', kind: 'milanesa', corte: productoNombre,
          peso_kg: kgSalieron, waste_kg: parseFloat(menjunjeKg) - kgSalieron,
          operador, detalle: `\${unidades}u · \${grPorU}g/u · de \${menjunjeKg}kg carne`,
          fecha: new Date().toISOString(),
        });
      }
    }

    // Registrar preparación de fiambres
    if (isFiambreRecipe) {
      const kg = prod.baseKg ?? prod.targetUnits;
      if (kg > 0) await deductStockForFiambre(prod.recipeId ?? '', kg, operador);
    }

    // Registrar empanado de milanesa
    if (isEmpanadoRecipe && empanadoMenjunjeKg && empanadoSalieronKg) {
      const mKg  = parseFloat(empanadoMenjunjeKg);
      const sKg  = parseFloat(empanadoSalieronKg);
      const tipo = empanadoTipo === 'pollo' ? 'Pollo' : 'Carne';
      // Nombre específico por corte si eligieron uno, sino genérico
      const corteLabel = empanadoCorteStock
        ? empanadoCorteStock.replace('Milanesa - ', '')
        : tipo;
      const prodNombre = `Milanesa de ${tipo} Empanada - ${corteLabel}`;
      // Descontar menjunje — buscar por el stock específico seleccionado o por tipo genérico
      const menjNombre = empanadoCorteStock || (empanadoTipo === 'pollo' ? 'Menjunje Milanesa Pollo' : 'Menjunje Milanesa Carne');
      const { data: menjData } = await supabase.from('stock_produccion')
        .select('id, cantidad').ilike('producto', menjNombre).maybeSingle();
      if (menjData) {
        const newQty = parseFloat((Number(menjData.cantidad) - mKg).toFixed(3));
        await supabase.from('stock_produccion')
          .update({ cantidad: newQty }).eq('id', menjData.id);
      }
      // Descontar pan rallado y huevo del stock (proporcional: 1kg menjunje = 0.15kg pan rallado, 1 huevo)
      const panRalladoKg = parseFloat((mKg * 0.15).toFixed(3));
      const huevos = Math.ceil(mKg * 1);
      for (const [nom, qty, u] of [['PAN RALLADO', panRalladoKg, 'kg'], ['HUEVO', huevos, 'u']] as [string,number,string][]) {
        const { data: sd } = await supabase.from('stock').select('id, cantidad').eq('nombre', nom).maybeSingle();
        if (sd) {
          const nq = parseFloat((Number(sd.cantidad) - qty).toFixed(3));
          await supabase.from('stock').update({ cantidad: nq, fecha_actualizacion: new Date().toISOString().slice(0,10) }).eq('id', sd.id);
          await supabase.from('stock_movements').insert({ nombre: nom, categoria: 'SECOS', tipo: 'egreso', cantidad: qty, unidad: u, motivo: `Empanado ${tipo}`, operador, fecha: new Date().toISOString() });
        }
      }
      // Agregar milanesa empanada
      if (sKg > 0) {
        const { data: epd } = await supabase.from('stock_produccion').select('id, cantidad').ilike('producto', prodNombre).maybeSingle();
        if (epd) {
          await supabase.from('stock_produccion').update({ cantidad: parseFloat((Number(epd.cantidad)+sKg).toFixed(3)), ultima_prod: new Date().toISOString() }).eq('id', epd.id);
        } else {
          await supabase.from('stock_produccion').insert({ producto: prodNombre, categoria: 'milanesa', cantidad: sKg, unidad: 'kg', ultima_prod: new Date().toISOString() });
        }
      }
      await supabase.from('produccion_eventos').insert({ tipo: 'fin_cocina', kind: 'milanesa', corte: prodNombre, peso_kg: sKg, waste_kg: parseFloat((mKg - sKg).toFixed(3)), operador, detalle: `${mKg}kg menjunje → ${sKg}kg empanada`, fecha: new Date().toISOString() });
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `✅ Empanado ${tipo} · ${operador}`, body: `${sKg}kg milanesa empanada de ${mKg}kg menjunje`, tag: 'empanado-fin', url: '/admin' }) });
    }

    // Registrar salsa producida
    if (isSalsaRecipe && salsaKgProducidos) {
      const kg = parseFloat(salsaKgProducidos);
      const prodNombre = prod.recipeName; // ej: "Salsa Club"
      if (kg > 0) await addSalsaToStock(prodNombre, kg, operador);
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `🫙 ${prodNombre} · ${operador}`, body: `${kg}kg producidos`, tag: 'salsa-fin', url: '/admin' }) });
    }

    // Registrar pan producido en stock_produccion
    if (isPanRecipe && panUnidades && parseInt(panUnidades) > 0) {
      const unidadesPan = parseInt(panUnidades);
      const nombrePan = prod.recipeName; // "Pan de Lomito" o "Pan Sanguchero"
      const { data: existePan } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', nombrePan).maybeSingle();
      if (existePan) {
        await supabase.from('stock_produccion')
          .update({ cantidad: existePan.cantidad + unidadesPan, ultima_prod: new Date().toISOString() })
          .eq('id', existePan.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: nombrePan, categoria: 'pan', cantidad: unidadesPan, unidad: 'u', ultima_prod: new Date().toISOString() });
      }
      // Notificar
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `🍞 ${nombrePan} finalizado · ${operador}`,
          body: `${unidadesPan} unidades producidas`,
          tag: 'pan-producido', url: '/admin',
        }),
      });
      // Log evento
      await supabase.from('produccion_eventos').insert({
        tipo: 'fin_cocina', kind: 'pan', corte: nombrePan,
        peso_kg: prod.baseKg ?? 0, operador,
        detalle: `${unidadesPan}u producidas`,
        fecha: new Date().toISOString(),
      });
    }

    // Descuento stock verduras producidas
    if (isVerduraRecipe && selectedProduct) {
      const bruto = parseFloat(verduraBrutoKg) || baseKg;
      const desperdicio = parseFloat(verduraDesperdicioKg) || 0;
      await deductStockForVerdura(selectedProduct.id, bruto, desperdicio);
      setVerduraBrutoKg('');
      setVerduraDesperdicioKg('');
    }

    // Fraccionado de salsas en potes
    if (isFraccion && fraccionPote && fraccionCantidad) {
      const potes = (selectedProduct as any)?.potes ?? [];
      const ps = potes.find((p: any) => p.id === fraccionPote);
      if (ps) {
        const cant = parseInt(fraccionCantidad);
        const kg = parseFloat((cant * ps.capacidadKg).toFixed(3));
        await deductStockForFraccion((selectedProduct as any).stockNombre, (selectedProduct as any).stockOrigen ?? 'stock', kg, cant, ps.label, operador);
        await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `🫙 Fraccionado · ${operador}`, body: `${cant} potes ${ps.label} de ${(selectedProduct as any).stockNombre} (${kg}kg)`, tag: 'fraccion-salsa', url: '/admin' }) });
      }
    }

    // Limpiar Supabase y notificar al admin
    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    const remaining = activeProductions.filter(p => p.id !== prod.id);
    setActiveProductions(remaining);
    setFinishingProd(null);

    // Si no quedan producciones activas → resumen de turno a admins
    if (remaining.length === 0) {
      const { data: stockProdData } = await supabase
        .from('stock_produccion')
        .select('producto, cantidad, unidad, categoria')
        .order('categoria')
        .order('ultima_prod', { ascending: false });
      
      // Agrupar por categoría para el resumen
      const stockResumen = (stockProdData ?? []).map((s: any) => ({
        producto: s.producto,
        cantidad: s.cantidad,
        unidad: s.unidad,
      }));
      
      await sendResumenTurno(
        [{ recipeName: prod.recipeName, operador, cantidad: prod.targetUnits, unidad: prod.unit }],
        stockResumen as { producto: string; cantidad: number; unidad: string }[]
      );
    }

    setFinishingProd(null);
    setMenjunjeCorte('');
    setMenjunjeKg('');
    setMilanesaKgSalieron('');
    setMilanesaUnidades('');
    setPanUnidades('');
    setShowPanModal(false);
    setFraccionPote('');
    setFraccionCantidad('');
    setShowFraccionModal(false);
    setShowSalsaModal(false);
    setSalsaKgProducidos('');
    setShowEmpanadoModal(false);
    setEmpanadoMenjunjeKg('');
    setEmpanadoSalieronKg('');
    setEmpanadoCorteStock('');
    setSelectedMenjunjeStock('');
    onClose();
  };

  const elapsedTime = finishingProd ? currentTime - finishingProd.startTime : 0;

  // ── Modal salsa kg producidos ────────────────────────────────────────────
  const SalsaModal = () => showSalsaModal && finishingProd ? (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:'20px'}}
      onClick={e => e.stopPropagation()}>
      <div style={{background:'white',borderRadius:'20px',width:'100%',maxWidth:'360px',padding:'24px',boxShadow:'0 25px 50px rgba(0,0,0,0.3)'}}
        onClick={e => e.stopPropagation()}>
        
        <h3 className="font-black text-lg text-slate-800">🫙 {finishingProd.recipeName}</h3>
        <p className="text-slate-500 text-sm">¿Cuántos kg salieron de esta tanda?</p>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={salsaKgProducidos}
            onChange={e => setSalsaKgProducidos(e.target.value)}
            placeholder="0"
            onClick={e => e.stopPropagation()}
           
            style={{width:'100%',padding:'16px',border:'2px solid #fecaca',borderRadius:'12px',fontSize:'30px',fontWeight:'900',textAlign:'center',outline:'none',background:'#fff',color:'#dc2626',boxSizing:'border-box'}}
          />
          <span style={{position:'absolute',right:'16px',top:'50%',transform:'translateY(-50%)',fontSize:'14px',fontWeight:'700',color:'#94a3b8'}}>KG</span>
        </div>
        <div className="flex gap-3">
          <button onClick={e => { e.stopPropagation(); setShowSalsaModal(false); }}
            className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancelar</button>
          <button onClick={e => { e.stopPropagation(); handleFinish(); }}
            disabled={!salsaKgProducidos || parseFloat(salsaKgProducidos) <= 0}
            className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl disabled:opacity-40 disabled:cursor-not-allowed">
            Guardar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Modal empanado milanesa ───────────────────────────────────────────────
  const EmpanadoModal = () => showEmpanadoModal && finishingProd ? (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:'20px'}}
      onClick={e => e.stopPropagation()}>
      <div style={{background:'white',borderRadius:'20px',width:'100%',maxWidth:'360px',padding:'24px',boxShadow:'0 25px 50px rgba(0,0,0,0.3)'}}
        onClick={e => e.stopPropagation()}>
        
        <h3 className="font-black text-lg text-slate-800">🥩 Empanado de Milanesa</h3>

        {/* Stock selector — muestra el menjunje disponible por corte */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase mb-2">¿De qué menjunje empanaste?</p>
          {empanadoStocks.length > 0 ? (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {empanadoStocks.map(s => (
                <button key={s.producto}
                  onClick={() => {
                    setEmpanadoCorteStock(s.producto);
                    setEmpanadoTipo(s.producto.toLowerCase().includes('pollo') ? 'pollo' : 'carne');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-all border
                    ${empanadoCorteStock === s.producto
                      ? 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-rose-300'}`}>
                  <span>{s.producto}</span>
                  <span className="float-right text-xs opacity-60 font-normal">{s.cantidad.toFixed(2)} kg disp.</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-rose-500 bg-rose-50 rounded-lg px-3 py-2 border border-rose-200">
              ⚠️ Sin menjunje disponible. Hacé menjunje primero.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-black text-slate-400 uppercase mb-2">Kg de menjunje usados</p>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.5" value={empanadoMenjunjeKg}
              onChange={e => setEmpanadoMenjunjeKg(e.target.value)} placeholder="0"
              onClick={e => e.stopPropagation()}
              style={{width:'100%',padding:'12px',border:'2px solid #fecdd3',borderRadius:'12px',fontSize:'24px',fontWeight:'900',textAlign:'center',outline:'none',background:'#fff',color:'#e11d48',boxSizing:'border-box'}} />
            <span className="absolute right-3 top-4 text-xs font-bold text-slate-300">KG</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase mb-2">Kg de milanesa empanada que salieron</p>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.5" value={empanadoSalieronKg}
              onChange={e => setEmpanadoSalieronKg(e.target.value)} placeholder="0"
              onClick={e => e.stopPropagation()}
              style={{width:'100%',padding:'12px',border:'2px solid #fde68a',borderRadius:'12px',fontSize:'24px',fontWeight:'900',textAlign:'center',outline:'none',background:'#fff',color:'#d97706',boxSizing:'border-box'}} />
            <span className="absolute right-3 top-4 text-xs font-bold text-slate-300">KG</span>
          </div>
          {empanadoCorteStock && empanadoMenjunjeKg && empanadoSalieronKg && (
            <p className="text-xs text-slate-400 mt-1.5">
              → Guardará como <span className="font-black text-rose-600">Milanesa de {empanadoTipo === 'pollo' ? 'Pollo' : 'Carne'} Empanada — {empanadoCorteStock.replace('Milanesa - ','')}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={e => { e.stopPropagation(); setShowEmpanadoModal(false); }} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500">Cancelar</button>
          <button onClick={e => { e.stopPropagation(); handleFinish(); }} disabled={!empanadoMenjunjeKg || !empanadoSalieronKg || !empanadoCorteStock}
            className="flex-1 py-3 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed">
            Guardar
          </button>
        </div>
      </div>
    </div>
  ) : null;


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

                        {isFraccion && showFraccionModal && (() => {
                          const potes = (selectedProduct as any)?.potes ?? [];
                          const ps = potes.find((p: any) => p.id === fraccionPote);
                          const kgTotal = ps && fraccionCantidad ? parseFloat((parseInt(fraccionCantidad) * ps.capacidadKg).toFixed(3)) : 0;
                          return (
                            <div className="bg-purple-950/50 border border-purple-500/30 rounded-xl p-4 space-y-3">
                              <p className="text-purple-300 font-black text-sm uppercase">🫙 Fraccionar {(selectedProduct as any)?.stockNombre} — Elegí el pote</p>
                              <div className="grid grid-cols-2 gap-2">
                                {potes.map((p: any) => (
                                  <button key={p.id} onClick={() => setFraccionPote(p.id)}
                                    className={`rounded-xl border-2 p-3 text-left transition-all ${fraccionPote === p.id ? 'border-purple-500 bg-purple-500/20' : 'border-slate-700 bg-slate-800'}`}>
                                    <p className={`font-black text-sm ${fraccionPote === p.id ? 'text-purple-300' : 'text-slate-300'}`}>{p.label}</p>
                                    <p className="text-xs text-slate-500">{p.capacidadKg} kg / pote</p>
                                  </button>
                                ))}
                              </div>
                              {fraccionPote && (
                                <div>
                                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">¿Cuántos potes llenaste?</label>
                                  <input type="number" min="1" value={fraccionCantidad} onChange={e => setFraccionCantidad(e.target.value)}
                                    placeholder="0" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xl font-black text-center outline-none focus:border-purple-500" />
                                </div>
                              )}
                              {kgTotal > 0 && (
                                <div className="bg-slate-800/50 rounded-xl p-3 space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-slate-400">Kg a descontar:</span><span className="font-black text-red-400">−{kgTotal} kg</span></div>
                                  <div className="flex justify-between"><span className="text-slate-400">Origen:</span><span className="font-black text-slate-300">{(selectedProduct as any)?.stockOrigen === 'stock_produccion' ? '📦 Producido' : '🏪 Materias primas'}</span></div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {isPanRecipe && showPanModal && (
                          <div className="bg-amber-950/50 border border-amber-500/30 rounded-xl p-4 space-y-3">
                            <p className="text-amber-300 font-black text-sm uppercase">🍞 {prod.recipeName} — ¿Cuántas unidades salieron?</p>
                            <div>
                              <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Unidades producidas</label>
                              <input type="number" value={panUnidades} onChange={e => setPanUnidades(e.target.value)}
                                placeholder="140"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xl font-black text-center outline-none focus:border-amber-500" />
                            </div>
                            {panUnidades && parseInt(panUnidades) > 0 && prod.baseKg && prod.baseKg > 0 && (
                              <p className="text-xs text-green-400 font-black">
                                → {Math.round(prod.baseKg * 1000 / parseInt(panUnidades))}g de harina por unidad
                              </p>
                            )}
                          </div>
                        )}

                        {isMilanesaRecipe && showMenjunjeModal && (
                          <div className="bg-rose-950/50 border border-rose-500/30 rounded-xl p-4 space-y-3">
                            <p className="text-rose-300 font-black text-sm uppercase">🥩 Menjunje {menjunjeTipo} — Ingresá los kg usados</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Stock de carne</label>
                                {menjunjeStocks.length > 0 ? (
                                  <div className="space-y-1 max-h-36 overflow-y-auto">
                                    {menjunjeStocks.map(s => (
                                      <button key={s.producto}
                                        onClick={() => setMenjunjeCorte(s.producto.replace('Milanesa - ', ''))}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-all border
                                          ${menjunjeCorte === s.producto.replace('Milanesa - ', '')
                                            ? 'bg-rose-600 text-white border-rose-500'
                                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-rose-500'}`}>
                                        <span>{s.producto}</span>
                                        <span className="float-right text-xs opacity-60">{s.cantidad.toFixed(2)} kg</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-500 italic">
                                    No hay stock de milanesa cruda. Producí primero en Carnicería.
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg carne usados</label>
                                <input type="number" value={menjunjeKg} onChange={e => setMenjunjeKg(e.target.value)}
                                  placeholder="5.000"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
                              </div>
                            </div>
                            {/* Rendimiento — kg y unidades que salieron */}
                            <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                              <p className="text-xs text-amber-400 font-black uppercase">📦 ¿Cuánto salió?</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg totales</label>
                                  <input type="number" value={milanesaKgSalieron} onChange={e => setMilanesaKgSalieron(e.target.value)}
                                    placeholder="4.200"
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Unidades</label>
                                  <input type="number" value={milanesaUnidades} onChange={e => setMilanesaUnidades(e.target.value)}
                                    placeholder="20"
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-500" />
                                </div>
                              </div>
                              {milanesaKgSalieron && milanesaUnidades && parseFloat(milanesaKgSalieron) > 0 && parseInt(milanesaUnidades) > 0 && (
                                <p className="text-xs text-green-400 font-black">
                                  → {Math.round(parseFloat(milanesaKgSalieron) / parseInt(milanesaUnidades) * 1000)}g por unidad
                                </p>
                              )}
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
            <div className="flex flex-col md:flex-row gap-4 md:gap-8 h-full">
              {/* LEFT: Planificación */}
              <div className="w-full md:w-1/3 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 flex flex-col shadow-sm shrink-0">
                <h3 className="font-bold text-slate-400 uppercase text-xs mb-6 tracking-wider">Planificación</h3>

                {(isVerdura || isFiambre) ? (
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-600 mb-1">{isFiambre ? 'Kg a preparar/fetetar' : 'Peso bruto a trabajar'}</label>
                    <p className="text-xs text-slate-400 mb-3">{isFiambre ? 'Cuántos kg vas a procesar' : 'Ingresá los kg que vas a preparar'}</p>
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
              <div className="w-full md:w-2/3 flex flex-col min-h-0">
                {(isVerdura || isFiambre) ? (
                  <div className="bg-white rounded-2xl border border-green-200 flex-1 flex items-center justify-center shadow-sm p-6">
                    <div className="text-center text-slate-400">
                      <p className="font-bold">{isFiambre ? 'Ingresá los kg a preparar/fetetar' : 'Ingresá el peso bruto e iniciá la producción'}</p>
                    </div>
                  </div>
                ) : (
                <div className="bg-white rounded-2xl border border-slate-200 flex-1 flex flex-col overflow-hidden shadow-sm">
                  {/* Categorías */}
                  {view === 'category' && !selectedProduct && (
                    <div className="grid grid-cols-2 gap-3 p-4">
                      {KITCHEN_CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setView('product'); }}
                          className={`bg-white p-4 md:p-8 rounded-2xl border-2 ${cat.border} ${cat.hover} flex flex-col items-center transition-all active:scale-95`}>
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
                            // Special: menjunje first ingredient = dynamic milanesa stock selector
                            const isMenjunjeStockIngredient = idx === 0 && selectedProduct.id.startsWith('menjunje_');
                            if (isMenjunjeStockIngredient) {
                              return (
                                <tr key={idx} className="border-b border-slate-100">
                                  <td className="py-3 pl-6">
                                    {selectedMenjunjeStock
                                      ? <CheckSquare className="text-green-500" size={20} />
                                      : <Square className="text-slate-300" size={20} />}
                                  </td>
                                  <td colSpan={2} className="py-3 pr-4">
                                    <p className="text-xs font-black text-slate-400 uppercase mb-2">Elegí el stock de carne cruda</p>
                                    {menjunjeStocks.length > 0 ? (
                                      <div className="space-y-1">
                                        {menjunjeStocks.map(s => (
                                          <button key={s.producto}
                                            onClick={() => {
                                              setSelectedMenjunjeStock(s.producto);
                                              // auto-check this ingredient
                                              setCheckedIngredients(prev => { const n = new Set(prev); n.add(0); return n; });
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-all border
                                              ${selectedMenjunjeStock === s.producto
                                                ? 'bg-rose-50 border-rose-400 text-rose-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-rose-300'}`}>
                                            <span>{s.producto}</span>
                                            <span className="float-right text-xs opacity-60 font-normal">{s.cantidad.toFixed(2)} kg disp.</span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-rose-500 font-bold bg-rose-50 rounded-lg px-3 py-2 border border-rose-200">
                                        ⚠️ Sin stock de milanesa. Producí primero en Carnicería.
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              );
                            }
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
      <SalsaModal />
      <EmpanadoModal />
    </div>
  );
}