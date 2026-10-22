import { ButcheryProduction, ButcheryProductionType, ButcheryRecord } from '../../types';
import { getCutLabel, CUTS, ProductionKind, getCarneLinpiaName } from './cuts';
import { supabase } from '../../supabase';
import { PushEvents, checkAndNotifyStock } from '../pushEvents';
import { addToStockProduccion } from './stockProduccion';
import { egresoStock, egresoProduccion, notifyError } from '../kitchenHelpers';
import { CORTE_CRUDO, nombreLimpio } from '../stockNames';
import { saveProduccion, saveProduccionesMany, markProduccionDone } from './produccionPersistence';
import { BurgerBlendResult } from './Step2BurgerView';

export async function logProduccionEvento(tipo: string, kind: string, corte: string, pesoKg: number, detalle?: string, op?: string, wasteKg?: number) {
  try {
    await supabase.from('produccion_eventos').insert({
      tipo, kind, corte, peso_kg: pesoKg, operador: op ?? 'Sistema',
      detalle: detalle ?? '', fecha: new Date().toISOString(),
      waste_kg: wasteKg ?? 0,
    });
  } catch (e) { console.error('Error logging evento:', e); }
}

const CORTE_STOCK_MAP = CORTE_CRUDO;

export async function deductStockByName(nombreCorte: string, kgToDeduct: number, kind?: string, fechaInicio?: string, operadorNombre?: string) {
  if (!kgToDeduct || kgToDeduct <= 0) return { ok: true, stockActual: 0, nombre: nombreCorte };
  const nombre = CORTE_STOCK_MAP[nombreCorte];
  if (!nombre) return { ok: true, stockActual: 0, nombre: nombreCorte };
  const { data: rows } = await supabase.from('stock')
    .select('id, nombre, categoria, cantidad, stock_critico, stock_medio')
    .eq('nombre', nombre).eq('categoria', 'CARNES').limit(1);
  const data = rows?.[0];
  if (!data) {
    notifyError(`No existe "${nombre}" en el stock de carnes: no se descontó ${kgToDeduct} kg`);
    return { ok: true, stockActual: 0, nombre };
  }
  // Permitir stock negativo — la carne cruda se carga a mano después y se cubre con la próxima factura.
  // Usar fechaInicio para que el egreso aparezca en el momento en que el operador puso la carne.
  const newQty = await egresoStock(data, kgToDeduct, 'kg',
    `Inicio limpieza${kind && kind !== 'limpieza' ? ' - ' + kind : ''} — ${nombreCorte} · ${kgToDeduct} kg`,
    operadorNombre ?? 'Sistema', { piso: false, fecha: fechaInicio });
  if (newQty === null) { notifyError(`No se pudo descontar ${nombre}`); return { ok: false, stockActual: data.cantidad, nombre }; }
  await checkAndNotifyStock(nombre, newQty, 'kg', data);
  return { ok: data.cantidad >= kgToDeduct, stockActual: data.cantidad, nombre };
}

export function groupByBatch(productions: ButcheryProduction[]): Map<number, ButcheryProduction[]> {
  const map = new Map<number, ButcheryProduction[]>();
  for (const p of productions) { const g = map.get(p.batchId) ?? []; g.push(p); map.set(p.batchId, g); }
  return map;
}

type Setters = {
  operador: string;
  step2Queue: ButcheryProduction[];
  step2Index: number;
  setButcheryProductions: React.Dispatch<React.SetStateAction<ButcheryProduction[]>>;
  setButcheryRecords: React.Dispatch<React.SetStateAction<ButcheryRecord[]>>;
  setView: (v: 'list' | 'new' | 'step2') => void;
  setFinishingBatchId: (id: number | null) => void;
  setStep2Queue: React.Dispatch<React.SetStateAction<ButcheryProduction[]>>;
  setStep2Index: React.Dispatch<React.SetStateAction<number>>;
};

export function createButcheryHandlers(s: Setters) {
  const { operador, step2Queue, step2Index } = s;

  const handleStartProductions = async (entries: { type: string; weight: number; carneLinpiaName?: string }[], kind: ProductionKind, isBlend?: boolean) => {
    // Solo notificar si hay stock negativo — no bloquear producción
    for (const e of entries) {
      const corteNombre = getCutLabel(e.type);
      const stockNombre = CORTE_STOCK_MAP[corteNombre];
      if (!stockNombre) continue;
      const { data } = await supabase.from('stock').select('cantidad').eq('nombre', stockNombre).single();
      if (data && data.cantidad < e.weight) {
        // Solo avisa, no bloquea — el stock quedará negativo y se cubre con la próxima factura
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `⚠️ Stock bajo: ${corteNombre}`,
            body: `Disponible: ${data.cantidad.toFixed(3)}kg | Requerido: ${e.weight}kg — cargá la factura`,
            tag: 'stock-bajo-produccion', url: '/admin',
          }),
        });
      }
    }
    const now = Date.now();
    const newProds = entries.map((e, i) => ({
      id: now + i, batchId: now, isBlend: isBlend ?? false, type: e.type,
      operador: operador || undefined,
      typeName: e.carneLinpiaName
        ? e.carneLinpiaName.replace('Carne Limpia Burger - ', '').replace(' Limpia', '').replace(/_L$/, '') + '_L'
        : getCutLabel(e.type),
      cut: e.carneLinpiaName ?? getCutLabel(e.type), weightKg: e.weight, kind,
      startTime: now, status: 'step1_running' as const, date: new Date().toLocaleDateString(),
      startTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    s.setButcheryProductions(prev => [...prev, ...(newProds as any[])]);
    s.setView('list');
    saveProduccionesMany(newProds as any);
    entries.forEach(e => {
      const nombreCorte = e.carneLinpiaName
        ? e.carneLinpiaName.replace('Carne Limpia Burger - ', '').replace(' Limpia', '').replace(/_L$/, '') + '_L'
        : getCutLabel(e.type);
      logProduccionEvento('inicio_paso1', kind, nombreCorte, e.weight,
        `Inicio paso 1 - ${nombreCorte} ${e.weight}kg - ${operador}`, operador);
      PushEvents.inicioProduccion(kind, nombreCorte, e.weight, operador);
    });
  };

  const handleFinishBatchStep1 = (batchId: number) => {
    const now = Date.now();
    const updated: ButcheryProduction[] = [];
    s.setButcheryProductions(prev => prev.map(p => {
      if (p.batchId !== batchId || p.status !== 'step1_running') return p;
      const upd = { ...p, status: 'step2_pending' as const, endTime: now,
        durationSeconds: (now - p.startTime) / 1000,
        endTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      updated.push(upd);
      return upd;
    }));
    // ✅ Persistir en Supabase para que no vuelva al recargar
    if (updated.length > 0) saveProduccionesMany(updated);
    s.setFinishingBatchId(null);
  };

  const handleGoToBatchStep2 = (batch: ButcheryProduction[]) => {
    const now = Date.now();
    const pending = batch.filter(p => p.status === 'step2_pending' || p.status === 'step2_running');
    s.setButcheryProductions(prev => prev.map(p =>
      pending.find(b => b.id === p.id) ? { ...p, status: 'step2_running' as const, step2StartTime: now } : p
    ));
    s.setStep2Queue(pending); s.setStep2Index(0); s.setView('step2');
    pending.forEach(p => saveProduccion({ ...p, status: 'step2_running', step2StartTime: now }));
  };

  const handleFinishStep2 = async (quantity: number, unit: 'unid' | 'kg', wasteKg: number, grasaKg: number, stockDestino: string) => {
    const prod = step2Queue[step2Index];
    if (!prod) return;

    // Normalizar nombre del corte
    const corteNorm    = (prod.typeName ?? '').replace(/_L$/, '').trim();
    const corteDisplay = corteNorm.toLowerCase().includes('nalga') ? 'Nalga' : corteNorm;
    const kindLabel    = prod.kind ?? 'lomito';

    // 1. Descontar de carnes_limpias (stock_produccion) — el corte limpio que se usó
    const carneLinpiaName = `${corteDisplay}_L`;
    const productoDestino = kindLabel === 'lomito' ? `Bifes Lomito_${corteDisplay}`
      : kindLabel === 'milanesa' ? `Milanesa - ${corteDisplay}`
      : stockDestino;
    const cantidadDestinoTxt = kindLabel === 'lomito' ? `${quantity} u`
      : kindLabel === 'milanesa' ? `${parseFloat((prod.weightKg - wasteKg).toFixed(3))} kg`
      : '';

    const desc = await egresoProduccion(carneLinpiaName, prod.weightKg, 'carnes_limpias', 'kg',
      `Paso 2 ${kindLabel} → ${productoDestino}${cantidadDestinoTxt ? ` (${cantidadDestinoTxt})` : ''} — ${operador}`,
      operador || 'Sistema', prod.step2StartTime ? new Date(prod.step2StartTime).toISOString() : undefined);
    // Pollo no pasa por limpieza: no tiene fila de carne limpia, no es un error
    if (!desc.existe && corteDisplay !== 'Pollo') notifyError(`No existe "${carneLinpiaName}" en el stock de carne limpia: no se descontó`);
    else if (desc.existe && !desc.ok) notifyError(`No se pudo descontar ${carneLinpiaName}`);
    await logProduccionEvento('fin_paso2', kindLabel, corteDisplay, prod.weightKg,
      `Finalizo paso 2 - ${quantity} ${unit} de ${corteDisplay} - ${operador}`, operador, wasteKg);
    await PushEvents.finProduccion(kindLabel, corteDisplay, quantity, unit, operador);
    if (kindLabel === 'lomito') await addToStockProduccion({ producto: `Bifes Lomito_${corteDisplay}`, categoria: 'lomito', cantidad: quantity, unidad: 'u', motivo: `Paso 2 ← ${carneLinpiaName} (${prod.weightKg} kg) — ${operador}`, operador });
    else if (kindLabel === 'milanesa') await addToStockProduccion({ producto: `Milanesa - ${corteDisplay}`, categoria: 'milanesa', cantidad: parseFloat((prod.weightKg - wasteKg).toFixed(3)), unidad: 'kg', motivo: `Paso 2 ← ${carneLinpiaName} (${prod.weightKg} kg) — ${operador}`, operador });
    const now = Date.now(); const netWeight = prod.weightKg - wasteKg;
    const avgGrams = unit === 'unid' && quantity > 0 ? (netWeight / quantity) * 1000 : 0;
    s.setButcheryRecords(prev => [...prev, {
      id: now + step2Index, date: prod.date, kind: prod.kind,
      type: prod.type, typeName: prod.typeName, cut: prod.cut,
      brutoPesoKg: prod.weightKg, finalProduct: stockDestino,
      quantityProduced: quantity, wasteKg, netWeightKg: netWeight, avgWeightPerUnitGr: Math.round(avgGrams),
      step1Start: prod.startTimeFormatted, step1End: prod.endTimeFormatted ?? '',
      step1DurationMin: Math.round((prod.durationSeconds ?? 0) / 60 * 10) / 10,
      step2Start: prod.step2StartTime ? new Date(prod.step2StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      step2End: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    s.setButcheryProductions(prev => prev.map(p =>
      p.id !== prod.id ? p : { ...p, status: 'step2_done' as const, step2EndTime: now,
        finalProductName: stockDestino, quantityProduced: quantity, wasteKg, netWeightKg: netWeight, avgWeightPerUnit: avgGrams }
    ));
    markProduccionDone(prod.id);
    const next = step2Index + 1;
    if (next < step2Queue.length) { s.setStep2Index(next); }
    else { s.setStep2Queue([]); s.setStep2Index(0); s.setView('list'); }
  };

  const handleFinishBurgerBlend = async (result: BurgerBlendResult) => {
    const now = Date.now(); const batchKind = step2Queue[0]?.kind ?? 'burger';
    // Burger siempre se hace con blend: se descuenta la carne limpia elegida (prod.cut = nombre
    // exacto de la fila en stock_produccion) y la grasa de pella que salió del stock.
    for (const prod of step2Queue) {
      const r = await egresoProduccion(prod.cut, prod.weightKg, 'carnes_limpias', 'kg',
        `Burger ← ${prod.cut} (${prod.weightKg} kg) — ${operador}`, operador || 'Sistema',
        prod.step2StartTime ? new Date(prod.step2StartTime).toISOString() : undefined);
      if (!r.existe) notifyError(`No existe "${prod.cut}" en el stock: no se descontó del burger`);
      else if (!r.ok) notifyError(`No se pudo descontar ${prod.cut}`);
    }
    if (result.grasaExtraKg > 0) {
      const g = await egresoProduccion('Grasa de Pella', result.grasaExtraKg, 'carnes_limpias', 'kg',
        `Burger — grasa de pella del stock — ${operador}`, operador || 'Sistema');
      if (!g.existe) notifyError('No existe "Grasa de Pella" en el stock: no se descontó la grasa del burger');
      else if (!g.ok) notifyError('No se pudo descontar la Grasa de Pella');
    }
    step2Queue.forEach((prod, i) => {
      const baseKg = result.carneNetaKg ?? (result.totalBlendKg - result.grasaKg);
      const wasteShare = baseKg > 0 ? (prod.weightKg / baseKg) * result.wasteKg : 0;
      s.setButcheryRecords(prev => [...prev, {
        id: now + i, date: prod.date, kind: batchKind, type: prod.type, typeName: prod.typeName, cut: prod.cut,
        brutoPesoKg: prod.weightKg, finalProduct: result.stockDestino,
        quantityProduced: result.units, wasteKg: wasteShare, netWeightKg: prod.weightKg - wasteShare,
        avgWeightPerUnitGr: Math.round((result.totalBlendKg / result.units) * 1000),
        step1Start: prod.startTimeFormatted, step1End: prod.endTimeFormatted ?? '',
        step1DurationMin: Math.round((prod.durationSeconds ?? 0) / 60 * 10) / 10,
        step2Start: prod.step2StartTime ? new Date(prod.step2StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        step2End: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    });
    s.setButcheryProductions(prev => prev.map(p =>
      step2Queue.find(q => q.id === p.id) ? { ...p, status: 'step2_done' as const, step2EndTime: now,
        finalProductName: result.stockDestino, quantityProduced: result.units,
        wasteKg: result.wasteKg, netWeightKg: result.totalBlendKg - result.wasteKg,
        avgWeightPerUnit: (result.totalBlendKg / result.units) * 1000 } : p
    ));
    await logProduccionEvento('fin_paso2', 'burger', 'Blend', result.totalBlendKg,
      `Finalizo burger - ${result.units} medallones - ${operador}`, operador, result.wasteKg);
    await PushEvents.finProduccion('burger', 'Medallones', result.units, 'u', operador);
    await addToStockProduccion({ producto: 'Medallones Burger', categoria: 'burger', cantidad: result.units, unidad: 'u' });
    step2Queue.forEach(p => markProduccionDone(p.id));
    s.setStep2Queue([]); s.setStep2Index(0); s.setView('list');
  };

  const handleBackFromStep2 = () => {
    s.setButcheryProductions(prev => prev.map(p => {
      const inQueue = step2Queue.find(q => q.id === p.id);
      if (inQueue && p.status !== 'step2_done') return { ...p, status: 'step2_pending' as const };
      return p;
    }));
    s.setStep2Queue([]); s.setStep2Index(0); s.setView('list');
  };


  const handleFinishLimpieza = async (prod: ButcheryProduction, params: {
    carneLinpiaKg: number;
    carneLinpia2?: { kg: number; producto: string };
    grasaKg: number;
    desperdicioKg: number;
    destino: 'burger' | 'carne_limpia';
  }) => {
    const isNalgaConTapa = (prod.type as string) === 'nalga_con_tapa';
    const isSinFetear = (prod.type as string) === 'nalga_sin_fetear';
    const corteNorm = (isNalgaConTapa || isSinFetear) ? 'Nalga' : (prod.typeName ?? '').replace(/_L$/, '').trim();
    // Crudo: cada variante de nalga tiene su propia fila en `stock`
    const stockNombre = isNalgaConTapa ? 'Nalga con Tapa' : isSinFetear ? 'Nalga sin fetear' : corteNorm;

    // 1. Descontar carne cruda del stock materias primas
    // Usar startTime del prod para que el egreso quede en el momento de inicio
    const fechaInicioLimpieza = prod.startTime ? new Date(prod.startTime).toISOString() : undefined;
    await deductStockByName(stockNombre, prod.weightKg, 'limpieza', fechaInicioLimpieza, operador);

    // 2. Agregar carne limpia principal (Nalga_L)
    const productoCarne = nombreLimpio(corteNorm);
    if (params.carneLinpiaKg > 0) {
      await addToStockProduccion({ producto: productoCarne, categoria: 'carnes_limpias', cantidad: params.carneLinpiaKg, unidad: 'kg', operador, motivo: `Limpieza ${corteNorm} → ${productoCarne}` });
    }

    // 3. Segundo producto — Tapa_Nalga_L (solo nalga_con_tapa)
    if (params.carneLinpia2 && params.carneLinpia2.kg > 0) {
      await addToStockProduccion({ producto: params.carneLinpia2.producto, categoria: 'carnes_limpias', cantidad: params.carneLinpia2.kg, unidad: 'kg', operador, motivo: `Limpieza ${corteNorm} → ${params.carneLinpia2.producto}` });
    }

    // 4. Grasa → stock_produccion
    if (params.grasaKg > 0) {
      await addToStockProduccion({ producto: 'Grasa de Pella', categoria: 'carnes_limpias', cantidad: params.grasaKg, unidad: 'kg', operador, motivo: `Grasa de limpieza ${corteNorm}` });
    }

    // 5. Log + push
    const detalle = isNalgaConTapa
      ? `Nalga con Tapa: ${params.carneLinpiaKg}kg → Nalga_L | ${params.carneLinpia2?.kg ?? 0}kg → Tapa_Nalga_L | ${params.grasaKg}kg grasa`
      : `Limpieza ${corteNorm}: ${params.carneLinpiaKg}kg → ${productoCarne} | ${params.grasaKg}kg grasa | ${params.desperdicioKg}kg desperdicio`;
    await logProduccionEvento('fin_paso2', 'limpieza', corteNorm, prod.weightKg, detalle, operador, params.desperdicioKg);
    await fetch('/api/push', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title:`🔪 Limpieza · ${operador}`, body:`${corteNorm}: ${params.carneLinpiaKg}kg limpio`, tag:'limpieza-fin', url:'/admin' }) });

    markProduccionDone(prod.id);

    s.setButcheryProductions(prev => prev.map(p =>
      p.id === prod.id ? { ...p, status: 'step2_done' as const } : p
    ));
  };

  return { handleStartProductions, handleFinishBatchStep1, handleGoToBatchStep2, handleFinishStep2, handleFinishBurgerBlend, handleBackFromStep2, handleFinishLimpieza };
}