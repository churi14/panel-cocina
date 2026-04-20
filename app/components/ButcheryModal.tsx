"use client";

import React, { useState, useRef } from 'react';
import { Beef, X, Plus, ChevronLeft, Download, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { ButcheryProduction, ButcheryRecord } from '../types';
import { CUTS } from './butchery/cuts';
import { FinishStep1Overlay } from './butchery/Overlays';
import { ProductionCard } from './butchery/ProductionCard';
import { NewProductionWizard } from './butchery/NewProductionWizard';
import { Step2View } from './butchery/Step2View';
import { Step2BurgerView } from './butchery/Step2BurgerView';
import LimpiezaView from './butchery/LimpiezaView';
import { groupByBatch, createButcheryHandlers } from './butchery/useButcheryHandlers';

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];

export default function ButcheryModal({ onClose, butcheryProductions, setButcheryProductions, butcheryRecords, setButcheryRecords }: {
  onClose: () => void;
  butcheryProductions: ButcheryProduction[];
  setButcheryProductions: React.Dispatch<React.SetStateAction<ButcheryProduction[]>>;
  butcheryRecords: ButcheryRecord[];
  setButcheryRecords: React.Dispatch<React.SetStateAction<ButcheryRecord[]>>;
}) {
  const [operador, setOperador] = useState('');
  const [view, setView] = useState<'list' | 'new' | 'step2'>('list');
  const [finishingBatchId, setFinishingBatchId] = useState<number | null>(null);
  const [step2Queue, setStep2Queue] = useState<ButcheryProduction[]>([]);
  const [step2Index, setStep2Index] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const activeProductions = butcheryProductions.filter(p => p.status !== 'step2_done');
  const activeBatches = groupByBatch(activeProductions);
  const currentStep2Prod = step2Queue[step2Index];
  const finishingBatch = finishingBatchId
    ? butcheryProductions.filter(p => p.batchId === finishingBatchId && p.status === 'step1_running')
    : [];

  const batchAllStep1Done = (batch: ButcheryProduction[]) =>
    batch.every(p => p.status === 'step2_pending' || p.status === 'step2_running' || p.status === 'step2_done');
  const batchAllStep1Running = (batch: ButcheryProduction[]) =>
    batch.some(p => p.status === 'step1_running');

  const {
    handleStartProductions, handleFinishBatchStep1, handleGoToBatchStep2,
    handleFinishStep2, handleFinishBurgerBlend, handleBackFromStep2, handleFinishLimpieza,
  } = createButcheryHandlers({
    operador, step2Queue, step2Index,
    setButcheryProductions, setButcheryRecords,
    setView, setFinishingBatchId, setStep2Queue, setStep2Index,
  });

  const exportCSV = () => {
    if (!butcheryRecords.length) return;
    const headers = ["Fecha","Corte","Peso Bruto (kg)","Cantidad","Desperdicio (kg)","Peso Neto (kg)","Peso Prom/u (gr)","Stock Destino","P1 Inicio","P1 Fin","P1 Dur (min)","P2 Inicio","P2 Fin"];
    const rows = butcheryRecords.map(r => [
      r.date, r.typeName, r.brutoPesoKg.toFixed(3), r.quantityProduced,
      r.wasteKg.toFixed(3), r.netWeightKg.toFixed(3), r.avgWeightPerUnitGr,
      CUTS.find(c => c.id === r.type)?.stockDestino ?? '',
      r.step1Start, r.step1End, r.step1DurationMin, r.step2Start, r.step2End,
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = encodeURI(csv); a.download = `carniceria_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] md:h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            {(view === 'new' || view === 'step2') && (
              <button onClick={() => view === 'step2' ? handleBackFromStep2() : setView('list')}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <ChevronLeft size={24} className="text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold flex gap-2 text-rose-600 items-center"><Beef /> Carnicería</h2>
              <p className="text-xs text-slate-400">
                {!operador ? 'Seleccioná tu nombre'
                  : view === 'list' ? `${activeProductions.length} producción${activeProductions.length !== 1 ? 'es' : ''} activa${activeProductions.length !== 1 ? 's' : ''} · ${operador}`
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

          {/* Selector operador */}
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
                    className="py-4 rounded-2xl border-2 border-slate-200 hover:border-rose-400 hover:bg-rose-50 transition-all font-black text-slate-700 hover:text-rose-700 active:scale-95">
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vista lista */}
          {!!operador && view === 'list' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {activeProductions.length > 0 ? (
                Array.from(activeBatches.entries()).map(([batchId, batch]) => {
                  const someRunning = batchAllStep1Running(batch);
                  const allReady = batchAllStep1Done(batch);
                  const runningCount = batch.filter(p => p.status === 'step1_running').length;
                  return (
                    <div key={batchId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                        {allReady && !someRunning && <span className="text-xs font-bold text-green-600">✓ Listo para paso 2</span>}
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {batch.map(prod => <ProductionCard key={prod.id} production={prod} />)}
                      </div>
                      <div className="px-4 pb-4 space-y-2">
                        {someRunning && (
                          <button onClick={() => setFinishingBatchId(batchId)}
                            className="w-full py-3 bg-green-600 text-white font-black text-base rounded-xl hover:bg-green-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <CheckCircle2 size={20} /> FINALIZAR PASO 1
                            {batch.length > 1 && ` — ${runningCount} CORTE${runningCount > 1 ? 'S' : ''}`}
                          </button>
                        )}
                        {allReady && (
                          <button onClick={() => handleGoToBatchStep2(batch)}
                            className="w-full py-3 bg-green-600 text-white font-black text-base rounded-xl hover:bg-green-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            {batch[0]?.kind === 'limpieza' ? 'FINALIZAR LIMPIEZA' : 'AVANZAR A PASO 2'}{batch.length > 1 && ` — ${batch.length} CORTES`} <ChevronRight size={20} />
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
                </div>
              )}

              {butcheryRecords.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-slate-400" /> Últimas producciones</h4>
                    <span className="text-xs font-bold text-slate-400">{butcheryRecords.length} registros</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold sticky top-0">
                        <tr>
                          <th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Tipo</th>
                          <th className="p-3 text-left">Corte</th><th className="p-3 text-center">Cant</th>
                          <th className="p-3 text-center">Bruto</th><th className="p-3 text-center">Desp.</th>
                          <th className="p-3 text-center">Prom/u</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {butcheryRecords.slice().reverse().map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-600">{r.date}</td>
                            <td className="p-3">
                              {r.kind && <span className={`text-xs font-black text-white px-2 py-0.5 rounded-full ${r.kind === 'lomito' ? 'bg-rose-500' : r.kind === 'burger' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                                {r.kind === 'lomito' ? '🥩' : r.kind === 'burger' ? '🍔' : '🥪'}
                              </span>}
                            </td>
                            <td className="p-3 font-bold text-slate-800">{r.typeName}</td>
                            <td className="p-3 text-center"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{r.quantityProduced} u</span></td>
                            <td className="p-3 text-center font-mono text-slate-600">{r.brutoPesoKg.toFixed(3)} kg</td>
                            <td className="p-3 text-center font-mono text-red-600">{r.wasteKg.toFixed(3)} kg</td>
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

          {!!operador && view === 'new' && (
            <NewProductionWizard onStart={handleStartProductions} onCancel={() => setView('list')} />
          )}

          {!!operador && view === 'step2' && step2Queue.length > 0 && (
            step2Queue[0]?.kind === 'limpieza' && currentStep2Prod ? (
              <LimpiezaView
                key={currentStep2Prod.id}
                production={currentStep2Prod}
                onFinish={async (params) => {
                  if (submittingRef.current) return;
                  submittingRef.current = true;
                  setSubmitting(true);
                  await handleFinishLimpieza(currentStep2Prod, params);
                  const next = step2Index + 1;
                  if (next < step2Queue.length) { setStep2Index(next); }
                  else { setStep2Queue([]); setStep2Index(0); setView('list'); }
                  setSubmitting(false);
                }}
                onBack={handleBackFromStep2}
              />
            ) : step2Queue[0]?.kind === 'burger' ? (
              <Step2BurgerView
                key={step2Queue.map(p => p.id).join('-')}
                productions={step2Queue}
                step2StartTime={step2Queue[0]?.step2StartTime ?? Date.now()}
                onFinish={async (result) => {
                  if (submittingRef.current) return;
                  submittingRef.current = true;
                  setSubmitting(true);
                  await handleFinishBurgerBlend(result);
                  setSubmitting(false);
                }}
                onBack={handleBackFromStep2}
              />
            ) : currentStep2Prod ? (
              <Step2View
                key={currentStep2Prod.id}
                production={currentStep2Prod}
                totalInBatch={step2Queue.length}
                currentIndex={step2Index}
                kindLabel={currentStep2Prod.kind}
                onFinish={async (...args: Parameters<typeof handleFinishStep2>) => {
                  if (submittingRef.current) return;
                  submittingRef.current = true;
                  setSubmitting(true);
                  await handleFinishStep2(...args);
                  setSubmitting(false);
                }}
                onBack={handleBackFromStep2}
              />
            ) : null
          )}
        </div>
      </div>

      {finishingBatchId !== null && finishingBatch.length > 0 && (
        <FinishStep1Overlay
          productions={finishingBatch}
          onConfirm={async () => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            setSubmitting(true);
            await handleFinishBatchStep1(finishingBatchId);
            setSubmitting(false);
          }}
          onCancel={() => setFinishingBatchId(null)}
        />
      )}
    </div>
  );
}