"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { RefreshCw, X, ChevronDown, ChevronUp, Clock, Package } from 'lucide-react';

type Evento = {
  id: number;
  tipo: string;
  kind: string;
  corte: string;
  peso_kg: number;
  waste_kg: number;
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
  operador: string;
  onClose: () => void;
};

export default function ProducidosPorUsuario({ operador, onClose }: Props) {
  const [eventos, setEventos]   = useState<Evento[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rango, setRango]       = useState<'hoy' | 'semana' | 'todo'>('hoy');

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    const d = new Date();

    let desde: string | null = null;
    if (rango === 'hoy') {
      d.setHours(0, 0, 0, 0);
      desde = d.toISOString();
    } else if (rango === 'semana') {
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      desde = d.toISOString();
    }

    let query = supabase
      .from('produccion_eventos')
      .select('*')
      .in('tipo', ['fin_paso2', 'fin_cocina'])
      .eq('operador', operador)
      .order('fecha', { ascending: false })
      .limit(100);

    if (desde) query = query.gte('fecha', desde);

    const { data } = await query;
    setEventos(data ?? []);
    setLoading(false);
  }, [operador, rango]);

  useEffect(() => { fetchEventos(); }, [fetchEventos]);

  // Agrupar por fecha
  const grupos: Record<string, Evento[]> = {};
  for (const e of eventos) {
    const key = formatFecha(e.fecha);
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  }

  const totalHoy = eventos.filter(e => formatFecha(e.fecha) === 'Hoy').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900">Mis producidos</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {operador} · {totalHoy > 0 ? `${totalHoy} hoy` : 'sin producción hoy'}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Filtros rango */}
        <div className="flex gap-2 px-6 py-3 border-b border-slate-50">
          {([
            { id: 'hoy',    label: 'Hoy' },
            { id: 'semana', label: 'Esta semana' },
            { id: 'todo',   label: 'Todo' },
          ] as const).map(r => (
            <button key={r.id} onClick={() => setRango(r.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-black transition-all
                ${rango === r.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
              {r.label}
            </button>
          ))}
          <button onClick={fetchEventos}
            className="ml-auto p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-bold text-sm">Sin producción registrada</p>
              <p className="text-xs mt-1 text-slate-300">en este período</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {Object.entries(grupos).map(([fecha, items]) => (
                <div key={fecha}>
                  {/* Cabecera de grupo */}
                  <div className="px-6 py-2 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500 uppercase">{fecha}</span>
                    <span className="text-xs text-slate-400">{items.length} producción{items.length !== 1 ? 'es' : ''}</span>
                  </div>

                  {items.map(e => {
                    const cfg = KIND_CONFIG[e.kind] ?? { label: e.kind, color: 'text-slate-600', bg: 'bg-slate-100', emoji: '📦' };
                    const pesoKg = parseFloat(e.peso_kg as any) || 0;
                    const wasteKg = parseFloat(e.waste_kg as any) || 0;
                    const rend = pesoKg > 0 && wasteKg > 0
                      ? ((pesoKg - wasteKg) / pesoKg * 100).toFixed(0) + '%'
                      : null;

                    return (
                      <div key={e.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${cfg.bg}`}>
                            {cfg.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm">{e.corte}</span>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            {e.detalle && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{e.detalle}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock size={10} /> {formatHora(e.fecha)}
                              </span>
                              {pesoKg > 0 && (
                                <span className="text-xs font-bold text-slate-600">
                                  {pesoKg.toFixed(3)} kg
                                </span>
                              )}
                              {wasteKg > 0 && (
                                <span className="text-xs text-red-400">
                                  -{wasteKg.toFixed(3)} kg desperdicio
                                </span>
                              )}
                              {rend && (
                                <span className="text-xs font-black text-green-600">
                                  {rend} rendimiento
                                </span>
                              )}
                            </div>
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

        {/* Footer con totales */}
        {eventos.length > 0 && !loading && (
          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 grid grid-cols-3 gap-3 text-center rounded-b-3xl">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
              <p className="text-xl font-black text-slate-800">{eventos.length}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Kg procesados</p>
              <p className="text-xl font-black text-slate-800">
                {eventos.reduce((s, e) => s + (parseFloat(e.peso_kg as any) || 0), 0).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Desperdicio</p>
              <p className="text-xl font-black text-red-500">
                {eventos.reduce((s, e) => s + (parseFloat(e.waste_kg as any) || 0), 0).toFixed(1)} kg
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}