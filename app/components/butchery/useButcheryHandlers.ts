import { ButcheryProduction, ButcheryProductionType, ButcheryRecord } from '../../types';
import { getCutLabel, CUTS, ProductionKind, getCarneLinpiaName } from './cuts';
import { supabase } from '../../supabase';
import { PushEvents, checkAndNotifyStock } from '../pushEvents';
import { addToStockProduccion } from './stockProduccion';
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

const CORTE_STOCK_MAP: Record<string, string> = {
  'Lomo': 'LOMO', 'Roast Beef': 'AGUJA', 'Tapa de Asado': 'TAPA DE ASADO',
  'Tapa de Nalga': 'NALGA', 'Bife de Chorizo': 'BIFE ANGOSTO', 'Vacío': 'VACIO',
  'Picaña': 'CUADRIL', 'Ojo de Bife': 'CUADRADA', 'Grasa de Pella': 'GRASA',
  'Pollo': 'POLLO', 'Cuadril': 'CUADRIL', 'Cuadrada': 'CUADRADA', 'Not Burger': 'NOT',
};

export async function deductStockByName(nombreCorte: string, kgToDeduct: number, kind?: string) {
  if (!kgToDeduct || kgToDeduct <= 0) return { ok: true, stockActual: 0, nombre: nombreCorte };
  const nombre = CORTE_STOCK_MAP[nombreCorte];
  if (!nombre) return { ok: true, stockActual: 0, nombre: nombreCorte };
  const { data } = await supabase.from('stock')
    .select('id, cantidad, stock_critico, stock_medio')
    .eq('nombre', nombre).eq('categoria', 'CARNES').single();
  if (!data) return { ok: true, stockActual: 0, nombre };
  // Permitir stock negativo — se cubrirá con la próxima factura
  const newQty = parseFloat((data.cantidad - kgToDeduct).toFixed(3));
  await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) }).eq('id', data.id);
  await supabase.from('stock_movements').insert({
    stock_id: data.id, nombre, categoria: 'CARNES', tipo: 'egreso',
    cantidad: kgToDeduct, unidad: 'kg',
    motivo: `Produccion${kind ? ' - ' + kind : ''} (${nombreCorte})`,
    operador: 'Sistema', fecha: new Date().toISOString(),
  });
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

  const handleStartProductions = async (entries: { type: ButcheryProductionType; weight: number }[], kind: ProductionKind) => {
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
    const newProds: ButcheryProduction[] = entries.map((e, i) => ({
      id: now + i, batchId: now, type: e.type, typeName: getCutLabel(e.type),
      cut: getCutLabel(e.type), weightKg: e.weight, kind,
      startTime: now, status: 'step1_running' as const, date: new Date().toLocaleDateString(),
      startTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    s.setButcheryProductions(prev => [...prev, ...newProds]);
    s.setView('list');
    saveProduccionesMany(newProds);
    entries.forEach(e => {
      logProduccionEvento('inicio_paso1', kind, getCutLabel(e.type), e.weight,
        `Inicio paso 1 - ${getCutLabel(e.type)} ${e.weight}kg - ${operador}`, operador);
      PushEvents.inicioProduccion(kind, getCutLabel(e.type), e.weight, operador);
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
    await deductStockByName(prod.typeName, prod.weightKg, prod.kind ?? 'lomito');
    // Normalizar: Tapa de Nalga y Nalga Feteada → Nalga
    const corteNorm = (prod.typeName ?? '').toLowerCase().includes('nalga') ? 'Nalga' : prod.typeName;
    await logProduccionEvento('fin_paso2', prod.kind ?? 'lomito', corteNorm, prod.weightKg,
      `Finalizo paso 2 - ${quantity} ${unit} de ${corteNorm} - ${operador}`, operador, wasteKg);
    await PushEvents.finProduccion(prod.kind ?? 'lomito', corteNorm, quantity, unit, operador);
    const kindLabel = prod.kind ?? 'lomito';
    if (kindLabel === 'lomito') await addToStockProduccion({ producto: `Lomito - ${corteNorm}`, categoria: 'lomito', cantidad: quantity, unidad: 'u' });
    else if (kindLabel === 'milanesa') await addToStockProduccion({ producto: `Milanesa - ${corteNorm}`, categoria: 'milanesa', cantidad: parseFloat((prod.weightKg - wasteKg).toFixed(3)), unidad: 'kg' });
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
    for (const prod of step2Queue) await deductStockByName(prod.typeName, prod.weightKg, batchKind);
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
    grasaKg: number;
    desperdicioKg: number;
    destino: 'burger' | 'carne_limpia';
  }) => {
    const corteNorm = prod.typeName.toLowerCase().includes('nalga') ? 'Nalga' : prod.typeName;

    // 1. Descontar carne cruda del stock materias primas
    await deductStockByName(corteNorm, prod.weightKg, 'limpieza');

    // 2. Agregar carne limpia a stock_produccion
    const productoCarne = getCarneLinpiaName(corteNorm, params.destino);
    if (params.carneLinpiaKg > 0) {
      await addToStockProduccion({ producto: productoCarne, categoria: 'lomito', cantidad: params.carneLinpiaKg, unidad: 'kg' });
    }

    // 3. Grasa → stock_produccion
    if (params.grasaKg > 0) {
      await addToStockProduccion({ producto: 'Grasa de Pella', categoria: 'lomito', cantidad: params.grasaKg, unidad: 'kg' });
    }

    // 4. Log + push
    await logProduccionEvento('fin_paso2', 'limpieza', corteNorm, prod.weightKg,
      `Limpieza ${corteNorm}: ${params.carneLinpiaKg}kg → ${productoCarne} | ${params.grasaKg}kg grasa | ${params.desperdicioKg}kg desperdicio`,
      operador, params.desperdicioKg);
    await fetch('/api/push', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title:`🔪 Limpieza · ${operador}`, body:`${corteNorm}: ${params.carneLinpiaKg}kg → ${productoCarne}`, tag:'limpieza-fin', url:'/admin' }) });

    markProduccionDone(prod.id);

    s.setButcheryProductions(prev => prev.map(p =>
      p.id === prod.id ? { ...p, status: 'step2_done' as const } : p
    ));
  };

  return { handleStartProductions, handleFinishBatchStep1, handleGoToBatchStep2, handleFinishStep2, handleFinishBurgerBlend, handleBackFromStep2, handleFinishLimpieza };
}