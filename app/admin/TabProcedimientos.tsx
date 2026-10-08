"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, ArrowLeft, Plus } from 'lucide-react';

/* ── Tipos ───────────────────────────────────────────────────────────────── */
type Paso = {
  titulo: string;
  contenido: string;
  alerta?: string;
  highlight?: string;
};

type Procedimiento = {
  id: string;
  icono: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  aviso?: string;
  pasos: Paso[];
};

/* ── Datos ───────────────────────────────────────────────────────────────── */
const PROCEDIMIENTOS: Procedimiento[] = [
  {
    id: 'panceta',
    icono: '🥓',
    nombre: 'Panceta',
    descripcion: 'Corte, cocción y guardado',
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

/* ── Detalle de procedimiento ─────────────────────────────────────────────── */
function DetalleProcedimiento({ proc, onVolver }: { proc: Procedimiento; onVolver: () => void }) {
  const [pasoAbierto, setPasoAbierto] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {/* Header detalle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onVolver}
          className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 transition-colors shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl shrink-0">
          {proc.icono}
        </div>
        <div>
          <h3 className="font-black text-white text-lg leading-tight">{proc.nombre}</h3>
          <p className="text-xs text-slate-500 font-bold uppercase">{proc.categoria} · {proc.pasos.length} pasos</p>
        </div>
      </div>

      {/* Aviso */}
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
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors">
              <span className="font-black text-slate-200">{paso.titulo}</span>
              {pasoAbierto === i
                ? <ChevronUp size={16} className="text-slate-500" />
                : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {pasoAbierto === i && (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-800 pt-4 bg-slate-900/40">
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
  );
}

/* ── Tab principal ───────────────────────────────────────────────────────── */
export default function TabProcedimientos() {
  const [vista, setVista] = useState<'list' | 'detail'>('list');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const proc = PROCEDIMIENTOS.find(p => p.id === seleccionado) ?? null;

  const categorias = [...new Set(PROCEDIMIENTOS.map(p => p.categoria))];

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Vista: Lista de cards */}
      {vista === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Procedimientos</h2>
              <p className="text-slate-400 text-sm mt-1">
                Estándares operativos del equipo · {PROCEDIMIENTOS.length} procedimiento{PROCEDIMIENTOS.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl text-amber-400 font-bold text-sm transition-colors"
              title="Próximamente: agregar procedimientos desde admin">
              <Plus size={16} /> Agregar
            </button>
          </div>

          {categorias.map(cat => (
            <div key={cat} className="space-y-3">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{cat}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {PROCEDIMIENTOS.filter(p => p.categoria === cat).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSeleccionado(p.id); setVista('detail'); }}
                    className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 flex flex-col items-center gap-3 transition-all active:scale-95 group text-left">
                    <div className="w-14 h-14 bg-slate-800 group-hover:bg-amber-500/15 rounded-2xl flex items-center justify-center text-3xl transition-colors">
                      {p.icono}
                    </div>
                    <div className="text-center w-full">
                      <p className="font-black text-white text-sm">{p.nombre}</p>
                      <p className="text-slate-500 text-xs mt-0.5 leading-tight">{p.descripcion}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">{p.pasos.length} pasos</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Vista: Detalle */}
      {vista === 'detail' && proc && (
        <DetalleProcedimiento
          proc={proc}
          onVolver={() => { setVista('list'); setSeleccionado(null); }}
        />
      )}

    </div>
  );
}
