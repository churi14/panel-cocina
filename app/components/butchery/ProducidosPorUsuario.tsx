"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { RefreshCw, X, Clock, ChevronDown } from 'lucide-react';

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];

type Evento = {
  id: number;
  tipo: string;
  kind: string;
  corte: string;
  peso_kg: number | string;
  waste_kg: number | string;
  operador: string;
  detalle: string;
  fecha: string;
};

const KIND_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  lomito:   { label: 'Lomito',   color: 'text-rose-700',   bg: 'bg-rose-100',   emoji: '🥩' },
  burger:   { label: 'Burger',   color: 'text-blue-700',   bg: 'bg-blue-100',   emoji: '🍔' },
  milanesa: { label: 'Milanesa', color: 'text-amber-700',  bg: 'bg-amber-100',  emoji: '🥪' },
  limpieza: { label: 'Limpieza', color: 'text-slate-700',  bg: 'bg-slate-100',  emoji: '🔪' },
  cocina:   { label: 'Cocina',   color: 'text-green-700',  bg: 'bg-green-100',  emoji: '🍳' },
  salsa:    { label: 'Salsa',    color: 'text-purple-700', bg: 'bg-purple-100', emoji: '🫙' },
  pan:      { label: 'Pan',      color: 'text-orange-700', bg: 'bg-orange-100', emoji: '🍞' },
};

function parseNum(v: any): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

type Props = {
  operadorActual: string;
  onClose: () => void;
};

export default function ProducidosPorUsuario({ operadorActual, onClose }: Props) {
  const [eventos, setEventos]     = useState<Evento[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rango, setRango]         = useState<'hoy' | 'semana' | 'todo'>('hoy');
  const [operador, setOperador]   = useState(operadorActual);
  const [kindFiltro, setKindFiltro] = useState<string>('todos');

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    const d = new Date();
    let desde: string | null = null;
    if (rango === 'hoy') { d.setHours(0,0,0,0); desde = d.toISOString(); }
    else if (rango === 'semana') { d.setDate(d.getDate()-7); d.setHours(0,0,0,0); desde = d.toISOString(); }

    let query = supabase
      .from('produccion_eventos')
      .select('*')
      .in('tipo', ['fin_paso2', 'fin_cocina'])
      .order('fecha', { ascending: false })
      .limit(200);

    if (operador !== 'todos') query = query.eq('operador', operador);
    if (desde) query = query.gte('fecha', desde);

    const { data } = await query;
    setEventos(data ?? []);
    setLoading(false);
  }, [operador, rango]);

  useEffect(() => { fetchEventos(); }, [fetchEventos]);

  // Filtrar por kind
  const eventosFiltrados = kindFiltro === 'todos'
    ? eventos
    : eventos.filter(e => e.kind === kindFiltro);

  // Agrupar por fecha
  const grupos: Record<string, Evento[]> = {};
  for (const e of eventosFiltrados) {
    const key = formatFecha(e.fecha);
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  }

  // Totales (solo datos válidos)
  const totalKg = eventosFiltrados.reduce((s, e) => s + parseNum(e.peso_kg), 0);
  const totalWaste = eventosFiltrados.reduce((s, e) => {
    const w = parseNum(e.waste_kg);
    const p = parseNum(e.peso_kg);
    return s + (w > 0 && w <= p ? w : 0); // solo sumar si el dato es válido
  }, 0);

  // Kinds disponibles en los datos
  const kindsDisponibles = [...new Set(eventos.map(e => e.kind))].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900">Producidos</h2>
            <p className="text-sm text-slate-500 mt-0.5">{eventosFiltrados.length} registros</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-slate-100 space-y-3">
          {/* Operador selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500 uppercase w-20 shrink-0">Operador</span>
            <div className="flex gap-1.5 flex-wrap flex-1">
              <button onClick={() => setOperador('todos')}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                  ${operador === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                Todos
              </button>
              {OPERADORES.map(op => (
                <button key={op} onClick={() => setOperador(op)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                    ${operador === op ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* Rango + Kind */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {([
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: 'Semana' },
                { id: 'todo', label: 'Todo' },
              ] as const).map(r => (
                <button key={r.id} onClick={() => setRango(r.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                    ${rango === r.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {/* Kind filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setKindFiltro('todos')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all
                  ${kindFiltro === 'todos' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                Todos
              </button>
              {kindsDisponibles.map(k => {
                const cfg = KIND_CONFIG[k] ?? { label: k, emoji: '📦', bg: 'bg-slate-100', color: 'text-slate-600' };
                return (
                  <button key={k} onClick={() => setKindFiltro(k)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all
                      ${kindFiltro === k ? `${cfg.bg} ${cfg.color}` : 'bg-slate-100 text-slate-400'}`}>
                    {cfg.emoji} {cfg.label}
                  </button>
                );
              })}
            </div>
            <button onClick={fetchEventos} className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-bold text-sm">Sin producción en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {Object.entries(grupos).map(([fecha, items]) => (
                <div key={fecha}>
                  <div className="px-6 py-2 bg-slate-50 flex items-center justify-between sticky top-0">
                    <span className="text-xs font-black text-slate-500 uppercase">{fecha}</span>
                    <span className="text-xs text-slate-400">{items.length} producción{items.length !== 1 ? 'es' : ''}</span>
                  </div>

                  {items.map(e => {
                    const cfg = KIND_CONFIG[e.kind] ?? { label: e.kind ?? '?', color: 'text-slate-600', bg: 'bg-slate-100', emoji: '📦' };
                    const pesoKg  = parseNum(e.peso_kg);
                    const wasteKg = parseNum(e.waste_kg);

                    // Solo mostrar desperdicio si el dato es válido (no mayor al bruto)
                    const wasteValido = wasteKg > 0 && wasteKg <= pesoKg;
                    const rend = wasteValido && pesoKg > 0
                      ? Math.max(0, Math.min(100, ((pesoKg - wasteKg) / pesoKg * 100))).toFixed(0) + '%'
                      : null;

                    return (
                      <div key={e.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${cfg.bg}`}>
                            {cfg.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="font-bold text-slate-800 text-sm">{e.corte}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              {operador === 'todos' && (
                                <span className="text-[10px] text-slate-400 font-bold">{e.operador}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock size={10} /> {formatHora(e.fecha)}
                              </span>
                              {pesoKg > 0 && (
                                <span className="text-xs font-bold text-slate-700">{pesoKg.toFixed(3)} kg bruto</span>
                              )}
                              {wasteValido && (
                                <span className="text-xs text-red-400 font-bold">
                                  -{wasteKg.toFixed(3)} kg desp.
                                </span>
                              )}
                              {rend && (
                                <span className={`text-xs font-black ${parseFloat(rend) >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
                                  {rend} rend.
                                </span>
                              )}
                            </div>

                            {e.detalle && (
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{e.detalle}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales */}
        {eventosFiltrados.length > 0 && !loading && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 grid grid-cols-3 gap-3 text-center rounded-b-3xl">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
              <p className="text-xl font-black text-slate-800">{eventosFiltrados.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Kg bruto</p>
              <p className="text-xl font-black text-slate-800">{totalKg.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Desperdicio</p>
              <p className="text-xl font-black text-red-500">{totalWaste.toFixed(1)} kg</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}