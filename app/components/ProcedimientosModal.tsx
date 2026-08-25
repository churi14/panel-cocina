"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

type Paso = {
  titulo: string;
  contenido: string;
  alerta?: string;
  highlight?: string;
};

type Procedimiento = {
  id: string;
  nombre: string;
  pasos: Paso[];
  aviso?: string;
};

const PROCEDIMIENTOS: Procedimiento[] = [
  {
    id: 'panceta',
    nombre: '🥓 Panceta',
    aviso: 'Todos hacemos el mismo procedimiento para mantener gramaje, cocción y textura.',
    pasos: [
      {
        titulo: '1. Corte',
        contenido: 'Máquina chiquita en medida 1.5\nCada feta ≈ 15 g · verificar con balanza',
      },
      {
        titulo: '2. Cocción',
        contenido: 'Panceta estirada en bandeja → horno eléctrico 120 °C',
        highlight: '⏱ 25 MINUTOS EXACTOS — PONER CRONÓMETRO',
      },
      {
        titulo: '3. Enfriado y secado',
        contenido: 'Retirar del horno. Reposar sobre papel absorbente tapada hasta bajar temperatura.',
      },
      {
        titulo: '4. Guardado',
        contenido: 'Sacar el papel → pasar a tupper seco SIN PAPEL.',
        alerta: 'El papel retiene grasa y humedece la panceta. Sin papel en el tupper.',
      },
      {
        titulo: '5. Revivir (solo del día anterior)',
        contenido: 'Solo panceta del día anterior. La del mismo día NO se revive.\n\n• Poner en bandejas\n• Pintar con manteca\n• Horno precalentado 5 min a 100 °C',
        alerta: 'La panceta del mismo día NO se revive.',
      },
    ],
  },
];

export default function ProcedimientosModal({ onClose }: { onClose: () => void }) {
  const [seleccionado, setSeleccionado] = useState<string>(PROCEDIMIENTOS[0].id);
  const [pasoAbierto, setPasoAbierto] = useState<number | null>(0);

  const proc = PROCEDIMIENTOS.find(p => p.id === seleccionado)!;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-slate-950 border border-slate-800 w-full md:max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900/40 to-slate-900 px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <h2 className="font-black text-white text-lg">Procedimientos</h2>
            <p className="text-slate-400 text-xs">Estándares del equipo</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Selector de procedimiento (si hay más de uno) */}
        {PROCEDIMIENTOS.length > 1 && (
          <div className="flex gap-2 px-4 py-3 border-b border-slate-800 overflow-x-auto shrink-0">
            {PROCEDIMIENTOS.map(p => (
              <button key={p.id} onClick={() => { setSeleccionado(p.id); setPasoAbierto(0); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all
                  ${seleccionado === p.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Aviso */}
          {proc.aviso && (
            <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-sm leading-relaxed">{proc.aviso}</p>
            </div>
          )}

          {/* Pasos */}
          {proc.pasos.map((paso, i) => (
            <div key={i} className="border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setPasoAbierto(pasoAbierto === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-800/40 transition-colors">
                <span className="font-black text-white text-sm">{paso.titulo}</span>
                {pasoAbierto === i
                  ? <ChevronUp size={16} className="text-slate-400" />
                  : <ChevronDown size={16} className="text-slate-400" />}
              </button>

              {pasoAbierto === i && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t border-slate-800 bg-slate-900/40">
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">{paso.contenido}</p>
                  {paso.highlight && (
                    <div className="bg-orange-500/15 border border-orange-500/40 rounded-xl px-4 py-3">
                      <p className="text-orange-300 font-black text-sm text-center">{paso.highlight}</p>
                    </div>
                  )}
                  {paso.alerta && (
                    <div className="flex gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                      <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-300 text-xs leading-relaxed">{paso.alerta}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
