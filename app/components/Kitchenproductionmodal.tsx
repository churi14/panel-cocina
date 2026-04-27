"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed, X, ArrowLeft, Play, CheckSquare, Square, Plus,
  CheckCircle2, Clock, Calculator, AlertCircle, Wheat, Droplet, ChefHat, Carrot
} from 'lucide-react';
import type { Recipe, ProductionRecord } from '../types';
import { supabase } from '../supabase';
import { sendResumenTurno } from './pushEvents';
import {
  saveCocinaProduccion, clearCocinaProduccion,
  deductStockForMilanesa, deductStockForFraccion,
  VERDURA_STOCK_MAP, FIAMBRE_STOCK_MAP,
  formatQty,
} from './kitchenHelpers';
import KitchenFinalizarSalsa    from './KitchenFinalizarSalsa';
import KitchenFinalizarPan      from './KitchenFinalizarPan';
import KitchenFinalizarMenjunje from './KitchenFinalizarMenjunje';
import KitchenFinalizarEmpanado from './KitchenFinalizarEmpanado';
import KitchenFinalizarVerdura  from './KitchenFinalizarVerdura';

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
  const [verduraConfirmData, setVerduraConfirmData]     = useState<{bruto: number; stockActual: number; nombre: string} | null>(null);

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

  const handleProductSelect = async (r: Recipe) => {
    setSelectedProduct(r);
    setTargetUnits(r.baseYield || 0);
    setBaseQtyKg('');
    setCheckedIngredients(new Set());
    setSelectedMenjunjeStock('');
    // Si es menjunje, fetch stocks disponibles
    if (r.id.startsWith('menjunje_')) {
      // Buscar carne limpia disponible (no burger)
      const { data } = await supabase.from('stock_produccion')
        .select('producto, cantidad')
        .ilike('producto', '% Limpia')
        .gt('cantidad', 0)
        .order('producto');
      const merged: {producto: string; cantidad: number}[] = [];
      for (const item of (data ?? [])) {
        const norm = item.producto.toLowerCase().includes('nalga') ? 'Nalga Limpia' : item.producto;
        const ex = merged.find(m => m.producto === norm);
        if (ex) ex.cantidad += item.cantidad;
        else merged.push({...item, producto: norm});
      }
      setMenjunjeStocks(merged);
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
  const finishingRef = React.useRef(false);
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
  const [showSalsaModal, setShowSalsaModal]         = useState(false);
  const [salsaKgProducidos, setSalsaKgProducidos]   = useState('');
  const [showEmpanadoModal, setShowEmpanadoModal]   = useState(false);
  const [empanadoMenjunjeKg, setEmpanadoMenjunjeKg] = useState('');
  const [empanadoSalieronKg, setEmpanadoSalieronKg] = useState('');
  const [empanadoTipo, setEmpanadoTipo]             = useState<'carne'|'pollo'>('carne');
  const [empanadoCorteStock, setEmpanadoCorteStock] = useState('');
  const [empanadoStocks, setEmpanadoStocks]         = useState<{producto: string; cantidad: number}[]>([]);
  // Salsa kg modal
  // Empanado modal

  const activeRecipeId = finishingProd?.recipeId ?? selectedProduct?.id ?? '';
  const activeRecipeName = finishingProd?.recipeName ?? '';
  const isFraccion       = (selectedProduct as any)?.recipeType === 'fraccion';
  const isVerduraRecipe  = activeRecipeId.startsWith('verdura_');
  const isFiambreRecipe  = activeRecipeId.startsWith('fiambre_');
  const isEmpanadoRecipe = activeRecipeId.startsWith('empanado_');
  const empanadoTipoActual = activeRecipeId.includes('pollo') ? 'pollo' : 'carne';
  const isPanRecipe      = activeRecipeId.startsWith('pan_');
  const isMilanesaRecipe = !activeRecipeId.startsWith('empanado_') && (
    activeRecipeName.toLowerCase().includes('menjunje') ||
    recipesDB.find((r: any) => r.name === activeRecipeName)?.category === 'Milanesas'
  );
  const isSalsaRecipe    = !isFraccion && !isPanRecipe && !isMilanesaRecipe && !isVerduraRecipe && !isFiambreRecipe && !isEmpanadoRecipe &&
    recipesDB.find((r: any) => r.name === activeRecipeName)?.category === 'Salsas';
  const menjunjeTipo = activeRecipeName.toLowerCase().includes('pollo') ? 'Pollo' : 'Carne';


  // Cargar stocks de menjunje cuando hay una producción de empanado en curso
  useEffect(() => {
    if (!finishingProd || !isEmpanadoRecipe) return;
    const load = async () => {
      // Buscar todos los menjunjes (aunque tengan 0 stock)
      const nombres = ['Menjunje Milanesa Carne', 'Menjunje Milanesa Pollo'];
      const stocks: {producto: string; cantidad: number}[] = [];
      for (const nombre of nombres) {
        const { data } = await supabase.from('stock_produccion')
          .select('producto, cantidad')
          .eq('producto', nombre)
          .maybeSingle();
        if (data) {
          stocks.push({ producto: data.producto, cantidad: Number(data.cantidad) });
        } else {
          // Mostrar igual aunque no exista en stock aún
          stocks.push({ producto: nombre, cantidad: 0 });
        }
      }
      setEmpanadoStocks(stocks);
      // Pre-seleccionar el que corresponde al tipo
      const tipoNombre = activeRecipeId.includes('pollo') ? 'Menjunje Milanesa Pollo' : 'Menjunje Milanesa Carne';
      setEmpanadoCorteStock(tipoNombre);
    };
    load();
  }, [finishingProd?.id, isEmpanadoRecipe]);
  // Llamada por los componentes hijo cuando terminan su guardado
  const finalizarProduccion = () => {
    const remaining = activeProductions.filter(p => p.id !== finishingProd?.id);
    setActiveProductions(remaining);
    setFinishingProd(null);
    finishingRef.current = false;
    onClose();
  };

  const handleFinish = async () => {
    const prod = finishingProd;
    if (!prod) return;
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (isFraccion && !showFraccionModal) { setShowFraccionModal(true); return; }
    setShowFraccionModal(false);
    // Pan: pedir unidades
    if (isPanRecipe && !showPanModal) { setShowPanModal(true); return; }
    setShowPanModal(false);
    // Menjunje milanesa
    if (isMilanesaRecipe && !showMenjunjeModal) {
      const rawKg = prod.baseKg ?? prod.targetUnits ?? 0;
      // Sanity check: empanado rarely uses more than 50kg in one batch
      const kgBase = String(rawKg);
      setMenjunjeKg(kgBase);
      setMilanesaKgSalieron(kgBase);
      setShowMenjunjeModal(true);
      return;
    }
    setShowMenjunjeModal(false);
    // Empanado: pedir kg menjunje y kg salidos
    // Empanado: pre-llenar kg si no están cargados aún
    if (isEmpanadoRecipe && !empanadoMenjunjeKg) {
      const rawKg = prod.baseKg ?? prod.targetUnits ?? 0;
      // Sanity check: empanado rarely uses more than 50kg in one batch
      const kgBase = String(rawKg);
      setEmpanadoMenjunjeKg(kgBase);
      setEmpanadoSalieronKg(kgBase);
      setShowEmpanadoModal(false);
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
      const tipo = empanadoTipoActual === 'pollo' ? 'Pollo' : 'Carne';
      // Nombre específico por corte si eligieron uno, sino genérico
      const corteLabel = empanadoCorteStock
        ? empanadoCorteStock.replace('Milanesa - ', '')
        : tipo;
      const prodNombre = `Milanesa de ${tipo} Empanada - ${corteLabel}`;
      // Descontar menjunje — buscar por el stock específico seleccionado o por tipo genérico
      const menjNombre = empanadoCorteStock || (empanadoTipoActual === 'pollo' ? 'Menjunje Milanesa Pollo' : 'Menjunje Milanesa Carne');
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

    // Salsa: manejado por KitchenFinalizarSalsa

    // Empanado: manejado por KitchenFinalizarEmpanado

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
      // Validar contra stock actual
      const stockNombreCheck = VERDURA_STOCK_MAP[selectedProduct.id];
      if (stockNombreCheck && bruto > 0) {
        const { data: stockCheck } = await supabase.from('stock')
          .select('cantidad').eq('nombre', stockNombreCheck).maybeSingle();
        const stockActual = stockCheck ? Number(stockCheck.cantidad) : 0;
        // Si van a descontar más del doble del stock disponible, pedir confirmación
        if (bruto > Math.max(50, stockActual * 2) && stockActual > 0) {
          setVerduraConfirmData({ bruto, stockActual, nombre: stockNombreCheck });
          return; // No continuar — esperar confirmación del usuario
        }
      }
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
  // SalsaModal y EmpanadoModal — reemplazados por KitchenFinalizarSalsa y KitchenFinalizarEmpanado


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
                        {isPanRecipe && showPanModal && finishingProd && (
                          <KitchenFinalizarPan
                            prod={{...finishingProd, recipeId: activeRecipeId}}
                            operador={operador}
                            onFinalizado={() => { setShowPanModal(false); setPanUnidades(''); finalizarProduccion(); }}
                            onCancelar={() => setShowPanModal(false)}
                          />
                        )}
                        {isMilanesaRecipe && showMenjunjeModal && finishingProd && (
                          <KitchenFinalizarMenjunje
                            prod={{...finishingProd, recipeId: activeRecipeId}}
                            operador={operador}
                            menjunjeTipo={menjunjeTipo}
                            corteNombre={selectedMenjunjeStock}
                            onFinalizado={() => { setShowMenjunjeModal(false); finalizarProduccion(); }}
                            onCancelar={() => setShowMenjunjeModal(false)}
                          />
                        )}
                        {isEmpanadoRecipe && finishingProd && (
                          <KitchenFinalizarEmpanado
                            prod={{...finishingProd, recipeId: activeRecipeId}}
                            operador={operador}
                            empanadoTipo={empanadoTipoActual}
                            onFinalizado={() => finalizarProduccion()}
                            onCancelar={() => setFinishingProd(null)}
                          />
                        )}

                        {!showMenjunjeModal && !showPanModal && !isEmpanadoRecipe && !isSalsaRecipe && (
                          <div className="flex gap-3">
                            <button onClick={handleFinish}
                              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2">
                              <CheckCircle2 size={16} /> Confirmar y finalizar
                            </button>
                            <button onClick={() => { finishingRef.current = false; setFinishingProd(null); setShowMenjunjeModal(false); }}
                              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                        {(showMenjunjeModal || showPanModal || isEmpanadoRecipe || isSalsaRecipe) && (
                          <button onClick={() => { finishingRef.current = false; setFinishingProd(null); setShowMenjunjeModal(false); setShowPanModal(false); }}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors text-sm">
                            ✕ Cancelar
                          </button>
                        )}
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
      {/* ── SALSA ── */}
      {showSalsaModal && finishingProd && (
        <KitchenFinalizarSalsa
          prod={{...finishingProd, recipeId: activeRecipeId}}
          operador={operador}
          onFinalizado={() => { setShowSalsaModal(false); finalizarProduccion(); }}
          onCancelar={() => setShowSalsaModal(false)}
        />
      )}

      {/* ── VERDURA — pantalla de confirmación sospechosa ── */}
      {isVerduraRecipe && finishingProd && (
        <KitchenFinalizarVerdura
          prod={{...finishingProd, recipeId: activeRecipeId}}
          operador={operador}
          onFinalizado={() => finalizarProduccion()}
          onCancelar={() => setFinishingProd(null)}
        />
      )}
    </div>
  );
}