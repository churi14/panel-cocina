"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Clock, AlertTriangle } from 'lucide-react';

/* ── Tipos ───────────────────────────────────────────────────────────────── */
type Paso = {
  titulo: string;
  contenido: string;
  alerta?: string;
  highlight?: string;
};

type Procedimiento = {
  id: string;
  nombre: string;
  categoria: string;
  aviso?: string;
  pasos: Paso[];
};

/* ── Datos ───────────────────────────────────────────────────────────────── */
const PROCEDIMIENTOS: Procedimiento[] = [
  {
    id: 'panceta',
    nombre: 'Preparación de Panceta',
    categoria: 'Cocción',
    aviso: 'Desde ahora todos hacemos exactamente el mismo procedimiento para mantener el mismo gramaje, cocción, textura y calidad.',
    pasos: [
      {
        titulo: '1. Corte',
        contenido: 'Cortar en la máquina chiquita, configurada en la medida 1.5.\nCada feta debe pesar aproximadamente 15 g. Usar la balanza para corroborar.',
      },
      {
        titulo: '2. Cocción',
        contenido: 'Acomodar la panceta estirada en la bandeja y llevar al horno eléctrico a 120 °C.',
        highlight: '⏱ 25 MINUTOS EXACTOS — PONER CRONÓMETRO SIEMPRE.',
      },
      {
        titulo: '3. Enfriado y Secado',
        contenido: 'Una vez cumplidos los 25 minutos, retirar del horno. Dejar reposar sobre papel absorbente y tapada para que absorba la grasa inicial y baje la temperatura.',
      },
      {
        titulo: '4. Guardado y Almacenaje',
        contenido: 'Una vez que la panceta se enfría y seca en el papel, SACAR EL PAPEL y pasar a un tupper completamente seco y SIN NADA DE PAPEL.',
        alerta: 'Esto es fundamental para que la panceta no se humedezca con su propia condensación y mantenga su textura crujiente durante el servicio.',
      },
      {
        titulo: '5. Revivir Panceta (solo del día anterior)',
        contenido: 'Este procedimiento es EXCLUSIVAMENTE para la panceta que quedó del día anterior. La del mismo día NO se revive.\n\n• Poner la panceta en las bandejas.\n• Pintar con manteca.\n• Calentar en horno precalentado durante 5 minutos a 100 °C.',
        alerta: 'La panceta del mismo día NO se revive.',
      },
    ],
  },
];

/* ── Componente tarjeta de procedimiento ─────────────────────────────────── */
function ProcedimientoCard({ proc }: { proc: Procedimiento }) {
  const [open, setOpen] = useState(true);
  const [pasoAbierto, setPasoAbierto] = useState<number | null>(null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-800/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-amber-400" />
          </div>
          <div className="text-left">
            <p className="font-black text-white">{proc.nombre}</p>
            <p className="text-xs text-slate-500 font-bold uppercase">{proc.categoria}</p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-800 px-6 py-5 space-y-4">
          {/* Aviso general */}
          {proc.aviso && (
            <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-sm leading-relaxed">{proc.aviso}</p>
            </div>
          )}

          {/* Pasos */}
          <div className="space-y-2">
            {proc.pasos.map((paso, i) => (
              <div key={i} className="border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setPasoAbierto(pasoAbierto === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors">
                  <span className="font-black text-slate-200 text-sm">{paso.titulo}</span>
                  {pasoAbierto === i
                    ? <ChevronUp size={15} className="text-slate-500" />
                    : <ChevronDown size={15} className="text-slate-500" />}
                </button>

                {pasoAbierto === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{paso.contenido}</p>
                    {paso.highlight && (
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                        <p className="text-orange-300 font-black text-sm text-center">{paso.highlight}</p>
                      </div>
                    )}
                    {paso.alerta && (
                      <div className="flex gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-red-300 text-xs leading-relaxed">{paso.alerta}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab principal ───────────────────────────────────────────────────────── */
export default function TabProcedimientos() {
  const categorias = [...new Set(PROCEDIMIENTOS.map(p => p.categoria))];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">Procedimientos</h2>
        <p className="text-slate-400 text-sm mt-1">Estándares operativos del equipo · {PROCEDIMIENTOS.length} procedimiento{PROCEDIMIENTOS.length !== 1 ? 's' : ''}</p>
      </div>

      {categorias.map(cat => (
        <div key={cat} className="space-y-4">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{cat}</p>
          {PROCEDIMIENTOS.filter(p => p.categoria === cat).map(proc => (
            <ProcedimientoCard key={proc.id} proc={proc} />
          ))}
        </div>
      ))}
    </div>
  );
}
