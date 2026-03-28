"use client";

import React, { useState } from 'react';
import { Beef, X, Plus, ChevronLeft, Download, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { ButcheryProduction, ButcheryProductionType, ButcheryRecord } from '../types';
import { CUTS, getCutLabel, ProductionKind, PRODUCTION_KINDS } from './butchery/cuts';
import { FinishStep1Overlay } from './butchery/Overlays';
import { ProductionCard } from './butchery/ProductionCard';
import { NewProductionWizard } from './butchery/NewProductionWizard';
import { Step2View } from './butchery/Step2View';
import { Step2BurgerView, BurgerBlendResult } from './butchery/Step2BurgerView';
import { supabase } from '../supabase';
import { addToStockProduccion } from './butchery/stockProduccion';
import { saveProduccion, saveProduccionesMany, markProduccionDone } from './butchery/produccionPersistence';

// Registrar evento de producción para notificaciones admin
async function logProduccionEvento(tipo: string, kind: string, corte: string, pesoKg: number, detalle?: string) {
  try {
    await supabase.from('produccion_eventos').insert({
      tipo, kind, corte, peso_kg: pesoKg,
      detalle: detalle ?? '',
      fecha: new Date().toISOString(),
    });
  } catch (e) { console.error('Error logging evento:', e); }
}


// Descuenta kg de la tabla stock en Supabase buscando por nombre de corte
async function deductStockByName(nombreCorte: string, kgToDeduct: number, kind?: string) {
  if (!kgToDeduct || kgToDeduct <= 0) return;
  const CORTE_MAP: Record<string, string> = {
    'Lomo':            'LOMO',
    'Roast Beef':      'AGUJA',
    'Tapa de Asado':   'TAPA DE ASADO',
    'Tapa de Nalga':   'NALGA',
    'Bife de Chorizo': 'BIFE ANGOSTO',
    'Vacío':           'VACIO',
    'Picaña':          'CUADRIL',
    'Ojo de Bife':     'CUADRADA',
    'Grasa de Pella':  'GRASA',
    'Pollo':           'POLLO',
    'Cuadril':         'CUADRIL',
    'Cuadrada':        'CUADRADA',
    'Not Burger':      'NOT',
  };
  const nombre = CORTE_MAP[nombreCorte];
  if (!nombre) return;
  const { data } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('nombre', nombre)
    .eq('categoria', 'CARNES')
    .single();
  if (!data) return;
  const newQty = Math.max(0, data.cantidad - kgToDeduct);
  await supabase.from('stock').update({
    cantidad: newQty,
    fecha_actualizacion: new Date().toISOString().slice(0, 10),
  }).eq('id', data.id);
  // Registrar en stock_movements para que aparezca en Movimientos del admin
  await supabase.from('stock_movements').insert({
    stock_id:  data.id,
    nombre,
    categoria: 'CARNES',
    tipo:      'egreso',
    cantidad:  kgToDeduct,
    unidad:    'kg',
    motivo:    `Producción${kind ? ' - ' + kind : ''} (${nombreCorte})`,
    operador:  'Sistema',
    fecha:     new Date().toISOString(),
  });
}


function groupByBatch(productions: ButcheryProduction[]): Map<number, ButcheryProduction[]> {
  const map = new Map<number, ButcheryProduction[]>();
  for (const p of productions) {
    const group = map.get(p.batchId) ?? [];
    group.push(p);
    map.set(p.batchId, group);
  }
  return map;
}

export default function ButcheryModal({ onClose, butcheryProductions, setButcheryProductions, butcheryRecords, setButcheryRecords }: {
  onClose: () => void;
  butcheryProductions: ButcheryProduction[];
  setButcheryProductions: React.Dispatch<React.SetStateAction<ButcheryProduction[]>>;
  butcheryRecords: ButcheryRecord[];
  setButcheryRecords: React.Dispatch<React.SetStateAction<ButcheryRecord[]>>;
}) {
  const [view, setView] = useState<'list' | 'new' | 'step2'>('list');
  // batchId del lote que está siendo finalizado en paso 1
  const [finishingBatchId, setFinishingBatchId] = useState<number | null>(null);
  const [step2Queue, setStep2Queue] = useState<ButcheryProduction[]>([]);
  const [step2Index, setStep2Index] = useState(0);

  const activeProductions = butcheryProductions.filter(p => p.status !== 'step2_done');
  const activeBatches     = groupByBatch(activeProductions);
  const currentStep2Prod  = step2Queue[step2Index];

  // Las producciones del lote que se quiere finalizar
  const finishingBatch = finishingBatchId
    ? (butcheryProductions.filter(p => p.batchId === finishingBatchId && p.status === 'step1_running'))
    : [];

  const batchAllStep1Done = (batch: ButcheryProduction[]) =>
    batch.every(p => p.status === 'step2_pending' || p.status === 'step2_running' || p.status === 'step2_done');

  const batchAllStep1Running = (batch: ButcheryProduction[]) =>
    batch.some(p => p.status === 'step1_running');

  // Arranca N producciones con el mismo batchId
  const handleStartProductions = (entries: { type: ButcheryProductionType; weight: number }[], kind: ProductionKind) => {
    const now = Date.now();
    setButcheryProductions(prev => [
      ...prev,
      ...entries.map((e, i) => ({
        id: now + i,
        batchId: now,
        type: e.type,
        typeName: getCutLabel(e.type),
        cut: getCutLabel(e.type),
        weightKg: e.weight,
        kind,
        startTime: now,
        status: 'step1_running' as const,
        date: new Date().toLocaleDateString(),
        startTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    ]);
    setView('list');
    // Guardar en Supabase
    const newProds: ButcheryProduction[] = entries.map((e, i) => ({
      id: now + i, batchId: now, type: e.type, typeName: getCutLabel(e.type),
      cut: getCutLabel(e.type), weightKg: e.weight, kind,
      startTime: now, status: 'step1_running' as const, date: new Date().toLocaleDateString(),
      startTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    saveProduccionesMany(newProds);
    // Log inicio de producción
    entries.forEach(e => {
      logProduccionEvento('inicio_paso1', kind, getCutLabel(e.type), e.weight,
        `Inicio paso 1 — ${getCutLabel(e.type)} ${e.weight}kg`);
    });
  };

  // Finaliza solo el paso 1 del lote indicado
  const handleFinishBatchStep1 = () => {
    if (finishingBatchId === null) return;
    const now = Date.now();
    setButcheryProductions(prev => prev.map(p => {
      if (p.batchId !== finishingBatchId || p.status !== 'step1_running') return p;
      return {
        ...p,
        status: 'step2_pending' as const,
        endTime: now,
        durationSeconds: (now - p.startTime) / 1000,
        endTimeFormatted: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }));
    setFinishingBatchId(null);
  };

  const handleGoToBatchStep2 = (batch: ButcheryProduction[]) => {
    const now = Date.now();
    // Solo los pendientes, no los ya completados
    const pendingBatch = batch.filter(p => p.status === 'step2_pending' || p.status === 'step2_running');
    setButcheryProductions(prev => prev.map(p =>
      pendingBatch.find(b => b.id === p.id)
        ? { ...p, status: 'step2_running' as const, step2StartTime: now }
        : p
    ));
    setStep2Queue(pendingBatch);
    setStep2Index(0);
    setView('step2');
    // Actualizar en Supabase
    const now3 = Date.now();
    pendingBatch.forEach(p => saveProduccion({ ...p, status: 'step2_running', step2StartTime: now3 }));
  };

  const handleFinishStep2 = async (quantity: number, unit: 'unid' | 'kg', wasteKg: number, grasaKg: number, stockDestino: string) => {
    const prod = step2Queue[step2Index];
    if (!prod) return;
    // Descontar materia prima
    await deductStockByName(prod.typeName, prod.weightKg, prod.kind ?? 'lomito');

    // Log fin paso 2
    await logProduccionEvento('fin_paso2', prod.kind ?? 'lomito', prod.typeName, prod.weightKg,
      `Finalizó paso 2 — ${quantity} ${unit} de ${prod.typeName}`);

    // Sumar a stock de producción
    const kindLabel = prod.kind ?? 'lomito';
    if (kindLabel === 'lomito') {
      // Lomito: unidades por corte
      await addToStockProduccion({
        producto: `Lomito - ${prod.typeName}`,
        categoria: 'lomito',
        cantidad: quantity,
        unidad: 'u',
      });
    } else if (kindLabel === 'milanesa') {
      // Milanesa: kg netos por corte
      const netKg = prod.weightKg - wasteKg;
      await addToStockProduccion({
        producto: `Milanesa - ${prod.typeName}`,
        categoria: 'milanesa',
        cantidad: parseFloat(netKg.toFixed(3)),
        unidad: 'kg',
      });
    }

    const now = Date.now();
    const netWeight = prod.weightKg - wasteKg;
    const avgGrams  = unit === 'unid' && quantity > 0 ? (netWeight / quantity) * 1000 : 0;

    setButcheryRecords(prev => [...prev, {
      id: now + step2Index, date: prod.date,
      kind: prod.kind,
      type: prod.type, typeName: prod.typeName, cut: prod.cut,
      brutoPesoKg: prod.weightKg, finalProduct: stockDestino,
      quantityProduced: quantity, wasteKg, netWeightKg: netWeight,
      avgWeightPerUnitGr: Math.round(avgGrams),
      step1Start: prod.startTimeFormatted, step1End: prod.endTimeFormatted ?? '',
      step1DurationMin: Math.round((prod.durationSeconds ?? 0) / 60 * 10) / 10,
      step2Start: prod.step2StartTime ? new Date(prod.step2StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      step2End: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);

    setButcheryProductions(prev => prev.map(p =>
      p.id !== prod.id ? p : {
        ...p, status: 'step2_done' as const, step2EndTime: now,
        finalProductName: stockDestino, quantityProduced: quantity,
        wasteKg, netWeightKg: netWeight, avgWeightPerUnit: avgGrams,
      }
    ));
    // Marcar como done en Supabase
    markProduccionDone(prod.id);

    const next = step2Index + 1;
    if (next < step2Queue.length) {
      setStep2Index(next);
    } else {
      setStep2Queue([]); setStep2Index(0); setView('list');
    }
  };


  // Finaliza el blend de burger (un registro por corte + uno general)
  const handleFinishBurgerBlend = async (result: BurgerBlendResult) => {
    const now = Date.now();
    const batchKind = step2Queue[0]?.kind ?? 'burger';

    // Descontar kg de cada corte en Supabase (basado en carne neta real)
    for (const prod of step2Queue) {
      await deductStockByName(prod.typeName, prod.weightKg, batchKind);
    }
    // Un registro por corte (consumo de materia prima)
    step2Queue.forEach((prod, i) => {
      const baseKg = result.carneNetaKg ?? (result.totalBlendKg - result.grasaKg);
      const wasteShare = baseKg > 0 ? (prod.weightKg / baseKg) * result.wasteKg : 0;
      setButcheryRecords(prev => [...prev, {
        id: now + i, date: prod.date,
        kind: batchKind,
        type: prod.type, typeName: prod.typeName, cut: prod.cut,
        brutoPesoKg: prod.weightKg, finalProduct: result.stockDestino,
        quantityProduced: result.units, wasteKg: wasteShare, netWeightKg: prod.weightKg - wasteShare,
        avgWeightPerUnitGr: Math.round((result.totalBlendKg / result.units) * 1000),
        step1Start: prod.startTimeFormatted, step1End: prod.endTimeFormatted ?? '',
        step1DurationMin: Math.round((prod.durationSeconds ?? 0) / 60 * 10) / 10,
        step2Start: prod.step2StartTime ? new Date(prod.step2StartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        step2End: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    });

    setButcheryProductions(prev => prev.map(p =>
      step2Queue.find(q => q.id === p.id) ? {
        ...p, status: 'step2_done' as const, step2EndTime: now,
        finalProductName: result.stockDestino,
        quantityProduced: result.units,
        wasteKg: result.wasteKg,
        netWeightKg: result.totalBlendKg - result.wasteKg,
        avgWeightPerUnit: (result.totalBlendKg / result.units) * 1000,
      } : p
    ));

    // Log fin burger
    await logProduccionEvento('fin_paso2', 'burger', 'Blend', result.totalBlendKg,
      `Finalizó burger — ${result.units} medallones`);

    // Sumar medallones a stock de producción
    await addToStockProduccion({
      producto: 'Medallones Burger',
      categoria: 'burger',
      cantidad: result.units,
      unidad: 'u',
    });

    // Marcar todos como done en Supabase
    step2Queue.forEach(p => markProduccionDone(p.id));

    setStep2Queue([]); setStep2Index(0); setView('list');
  };

  const handleBackFromStep2 = () => {
    setButcheryProductions(prev => prev.map(p => {
      const inQueue = step2Queue.find(q => q.id === p.id);
      // Solo revertir los que NO están terminados
      if (inQueue && p.status !== 'step2_done') return { ...p, status: 'step2_pending' as const };
      return p;
    }));
    setStep2Queue([]); setStep2Index(0); setView('list');
  };

  const exportCSV = () => {
    if (!butcheryRecords.length) return;
    const headers = ["Fecha","Corte","Peso Bruto (kg)","Cantidad","Desperdicio (kg)","Peso Neto (kg)","Peso Prom/u (gr)","Stock Destino","P1 Inicio","P1 Fin","P1 Dur (min)","P2 Inicio","P2 Fin"];
    const rows = butcheryRecords.map(r => [
      r.date, r.typeName, r.brutoPesoKg.toFixed(2), r.quantityProduced,
      r.wasteKg.toFixed(2), r.netWeightKg.toFixed(2), r.avgWeightPerUnitGr,
      CUTS.find(c => c.id === r.type)?.stockDestino ?? '',
      r.step1Start, r.step1End, r.step1DurationMin, r.step2Start, r.step2End,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = `carniceria_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            {(view === 'new' || view === 'step2') && (
              <button
                onClick={() => view === 'step2' ? handleBackFromStep2() : setView('list')}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ChevronLeft size={24} className="text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold flex gap-2 text-rose-600 items-center"><Beef /> Carnicería</h2>
              <p className="text-xs text-slate-400">
                {view === 'list'
                  ? `${activeProductions.length} producción${activeProductions.length !== 1 ? 'es' : ''} activa${activeProductions.length !== 1 ? 's' : ''}`
                  : view === 'new' ? 'Nueva producción'
                  : `Paso 2 — ${currentStep2Prod?.typeName ?? ''} (${step2Index + 1}/${step2Queue.length})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === 'list' && butcheryRecords.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 font-bold text-sm rounded-xl hover:bg-green-200 transition-colors">
                <Download size={16} /> EXPORTAR ({butcheryRecords.length})
              </button>
            )}
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">

          {view === 'list' && (
            <div className="max-w-4xl mx-auto space-y-6">

              {activeProductions.length > 0 ? (
                Array.from(activeBatches.entries()).map(([batchId, batch]) => {
                  const someRunning = batchAllStep1Running(batch);
                  const allReady    = batchAllStep1Done(batch);
                  const runningCount = batch.filter(p => p.status === 'step1_running').length;

                  return (
                    <div key={batchId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {/* Encabezado del lote */}
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {batch[0]?.kind && (
                            <span className={`text-sm font-black text-white px-4 py-1.5 rounded-full uppercase
                              ${batch[0].kind === 'lomito' ? 'bg-rose-500' : batch[0].kind === 'burger' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                              {batch[0].kind === 'lomito' ? '🥩' : batch[0].kind === 'burger' ? '🍔' : '🥪'} {batch[0].kind.toUpperCase()}
                            </span>
                          )}
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                            {batch.length === 1 ? '1 corte' : `${batch.length} cortes`}
                          </span>
                        </div>
                        {someRunning && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-rose-500">{runningCount} en curso</span>
                          </div>
                        )}
                        {allReady && !someRunning && (
                          <span className="text-xs font-bold text-green-600">✓ Listo para paso 2</span>
                        )}
                      </div>

                      {/* Cards del lote */}
                      <div className="p-4 space-y-3">
                        {batch.map(prod => (
                          <ProductionCard key={prod.id} production={prod} />
                        ))}
                      </div>

                      {/* Botones del lote — independientes por lote */}
                      <div className="px-4 pb-4 space-y-2">
                        {someRunning && (
                          <button
                            onClick={() => setFinishingBatchId(batchId)}
                            className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={20} />
                            FINALIZAR PASO 1
                            {batch.length > 1 && ` — ${runningCount} CORTE${runningCount > 1 ? 'S' : ''}`}
                          </button>
                        )}
                        {allReady && (
                          <button
                            onClick={() => handleGoToBatchStep2(batch)}
                            className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          >
                            AVANZAR A PASO 2
                            {batch.length > 1 && ` — ${batch.length} CORTES`}
                            <ChevronRight size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16">
                  <Beef size={80} className="text-slate-200 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-slate-400 mb-2">No hay producciones activas</h3>
                  <p className="text-slate-400">Iniciá una nueva producción para comenzar</p>
                </div>
              )}

              {butcheryRecords.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                      <FileText size={18} className="text-slate-400" /> Últimas producciones
                    </h4>
                    <span className="text-xs font-bold text-slate-400">{butcheryRecords.length} registros</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold sticky top-0">
                        <tr>
                          <th className="p-3 text-left">Fecha</th>
                          <th className="p-3 text-left">Tipo</th>
                          <th className="p-3 text-left">Corte</th>
                          <th className="p-3 text-center">Cant</th>
                          <th className="p-3 text-center">Bruto</th>
                          <th className="p-3 text-center">Desp.</th>
                          <th className="p-3 text-center">Prom/u</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {butcheryRecords.slice().reverse().map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-600">{r.date}</td>
                            <td className="p-3">
                              {r.kind && (
                                <span className={`text-xs font-black text-white px-2 py-0.5 rounded-full
                                  ${r.kind === 'lomito' ? 'bg-rose-500' : r.kind === 'burger' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                                  {r.kind === 'lomito' ? '🥩' : r.kind === 'burger' ? '🍔' : '🥪'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-bold text-slate-800">{r.typeName}</td>
                            <td className="p-3 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{r.quantityProduced} u</span></td>
                            <td className="p-3 text-center font-mono text-slate-600">{r.brutoPesoKg.toFixed(2)} kg</td>
                            <td className="p-3 text-center font-mono text-red-600">{r.wasteKg.toFixed(2)} kg</td>
                            <td className="p-3 text-center font-black text-amber-700">{r.avgWeightPerUnitGr} gr</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button onClick={() => setView('new')} className="w-full py-6 bg-slate-900 text-white font-black text-2xl rounded-2xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3">
                <Plus size={28} /> NUEVA PRODUCCIÓN
              </button>
            </div>
          )}

          {view === 'new' && (
            <NewProductionWizard onStart={handleStartProductions} onCancel={() => setView('list')} />
          )}

          {view === 'step2' && step2Queue.length > 0 && (
            step2Queue[0]?.kind === 'burger' ? (
              <Step2BurgerView
                key={step2Queue.map(p => p.id).join('-')}
                productions={step2Queue}
                step2StartTime={step2Queue[0]?.step2StartTime ?? Date.now()}
                onFinish={handleFinishBurgerBlend}
                onBack={handleBackFromStep2}
              />
            ) : currentStep2Prod ? (
              <Step2View
                key={currentStep2Prod.id}
                production={currentStep2Prod}
                totalInBatch={step2Queue.length}
                currentIndex={step2Index}
                kindLabel={currentStep2Prod.kind}
                onFinish={handleFinishStep2}
                onBack={handleBackFromStep2}
              />
            ) : null
          )}
        </div>
      </div>

      {/* Overlay — solo para el lote específico */}
      {finishingBatchId !== null && finishingBatch.length > 0 && (
        <FinishStep1Overlay
          productions={finishingBatch}
          onConfirm={handleFinishBatchStep1}
          onCancel={() => setFinishingBatchId(null)}
        />
      )}
    </div>
  );
}