"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, TrendingUp, TrendingDown, Clock, Award, ChevronDown, ChevronUp } from 'lucide-react';

type Evento = {
  id: number;
  tipo: string;
  kind: string;
  corte: string;
  peso_kg: number;
  detalle: string | null;
  operador: string | null;
  fecha: string;
};

type OperadorStats = {
  nombre: string;
  userId: string | null;
  totalProducciones: number;
  totalKg: number;
  promedioKgPorProd: number;
  tiempoPromedioMin: number;
  tiempoTotalMin: number;
  porKind: Record<string, { count: number; kg: number }>;
  ultimaProduccion: string | null;
  rendimiento: number; // score 0-100
};

const KIND_EMOJI: Record<string, string> = {
  lomito: '🥩', burger: '🍔', milanesa: '🥩', cocina: '🍳',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400 bg-green-500/20 border-green-500/30'
    : score >= 60 ? 'text-amber-400 bg-amber-500/20 border-amber-500/30'
    : 'text-red-400 bg-red-500/20 border-red-500/30';
  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Regular' : 'Bajo';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-black ${color}`}>
      {label} ({score})
    </span>
  );
}

export default function TabOperadores() {
  const [eventos, setEventos]         = useState<Evento[]>([]);
  const [perfiles, setPerfiles]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedOp, setExpandedOp]   = useState<string | null>(null);
  const [periodo, setPeriodo]         = useState<'semana' | 'mes' | 'todo'>('mes');

  const fetchData = async () => {
    setLoading(true);
    const [{ data: evs }, { data: prfs }] = await Promise.all([
      supabase.from('produccion_eventos').select('*').order('fecha', { ascending: false }).limit(2000),
      supabase.from('perfiles').select('*'),
    ]);
    setEventos((evs ?? []) as Evento[]);
    setPerfiles(prfs ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Filter by period
  const desde = periodo === 'semana'
    ? new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
    : periodo === 'mes'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const eventosFiltrados = desde
    ? eventos.filter(e => e.fecha >= desde)
    : eventos;

  // Build stats per operador
  const stats: OperadorStats[] = perfiles
    .filter(p => p.rol === 'operador' || p.rol === 'admin')
    .map(p => {
      // Match eventos by operador name or user_id
      const evOp = eventosFiltrados.filter(e =>
        e.operador === p.nombre ||
        e.operador === p.id ||
        (!e.operador && false) // eventos sin operador ignorados por ahora
      );

      const finales = evOp.filter(e => e.tipo === 'fin_paso2');
      const totalKg = finales.reduce((s, e) => s + (e.peso_kg ?? 0), 0);

      // Tiempo promedio — parsed from detalle if available
      const tiempos = finales
        .map(e => {
          const m = e.detalle?.match(/(\d+(?:\.\d+)?)\s*min/);
          return m ? parseFloat(m[1]) : null;
        })
        .filter((t): t is number => t !== null);

      const tiempoPromedio = tiempos.length > 0
        ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length
        : 0;

      const porKind: Record<string, { count: number; kg: number }> = {};
      finales.forEach(e => {
        if (!porKind[e.kind]) porKind[e.kind] = { count: 0, kg: 0 };
        porKind[e.kind].count++;
        porKind[e.kind].kg += e.peso_kg ?? 0;
      });

      // Score: basado en kg procesados y cantidad de producciones
      const avgKgProd = finales.length > 0 ? totalKg / finales.length : 0;
      const score = Math.min(100, Math.round(
        (finales.length > 0 ? 40 : 0) +
        Math.min(40, (totalKg / 50) * 40) +
        Math.min(20, (avgKgProd / 10) * 20)
      ));

      return {
        nombre: p.nombre,
        userId: p.id,
        totalProducciones: finales.length,
        totalKg: parseFloat(totalKg.toFixed(3)),
        promedioKgPorProd: parseFloat(avgKgProd.toFixed(2)),
        tiempoPromedioMin: parseFloat(tiempoPromedio.toFixed(1)),
        tiempoTotalMin: parseFloat(tiempos.reduce((a, b) => a + b, 0).toFixed(0)),
        porKind,
        ultimaProduccion: finales[0]?.fecha ?? null,
        rendimiento: score,
      };
    })
    .sort((a, b) => b.totalKg - a.totalKg);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Award size={20} /> Dashboard por Operador
          </h2>
          <p className="text-slate-400 text-sm mt-1">Rendimiento del equipo de cocina</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1">
            {(['semana', 'mes', 'todo'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize
                  ${periodo === p ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                {p === 'todo' ? 'Todo' : p === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
          <button onClick={fetchData}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="font-bold">No hay operadores registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((op, idx) => (
            <div key={op.nombre} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {/* Row principal */}
              <button
                onClick={() => setExpandedOp(expandedOp === op.nombre ? null : op.nombre)}
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors text-left">

                {/* Ranking */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0
                  ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {idx + 1}
                </div>

                {/* Avatar + nombre */}
                <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white shrink-0">
                  {op.nombre.slice(0,1).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-white">{op.nombre}</p>
                    <ScoreBadge score={op.rendimiento} />
                  </div>
                  <p className="text-slate-500 text-xs">
                    {op.totalProducciones} producciones · {op.totalKg.toFixed(1)} kg totales
                  </p>
                </div>

                {/* KPIs rápidos */}
                <div className="hidden md:flex items-center gap-6 text-right shrink-0">
                  <div>
                    <p className="text-xs text-slate-500">Avg kg/prod</p>
                    <p className="font-black text-white">{op.promedioKgPorProd}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tiempo prom</p>
                    <p className="font-black text-white">{op.tiempoPromedioMin > 0 ? `${op.tiempoPromedioMin}min` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Última prod</p>
                    <p className="font-black text-white text-xs">
                      {op.ultimaProduccion ? new Date(op.ultimaProduccion).toLocaleDateString('es-AR') : '—'}
                    </p>
                  </div>
                </div>

                {expandedOp === op.nombre ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
              </button>

              {/* Detalle expandido */}
              {expandedOp === op.nombre && (
                <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total producciones', value: op.totalProducciones, unit: '' },
                      { label: 'Kg procesados', value: op.totalKg.toFixed(1), unit: 'kg' },
                      { label: 'Promedio por prod', value: op.promedioKgPorProd, unit: 'kg' },
                      { label: 'Tiempo total', value: op.tiempoTotalMin > 0 ? op.tiempoTotalMin : '—', unit: op.tiempoTotalMin > 0 ? 'min' : '' },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-2xl font-black text-white">{value} <span className="text-sm text-slate-500">{unit}</span></p>
                      </div>
                    ))}
                  </div>

                  {/* Por tipo de producción */}
                  {Object.keys(op.porKind).length > 0 && (
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase mb-2">Por tipo</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(op.porKind).map(([kind, data]) => (
                          <div key={kind} className="bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
                            <span>{KIND_EMOJI[kind] ?? '🏭'}</span>
                            <div>
                              <p className="text-xs font-black text-white capitalize">{kind}</p>
                              <p className="text-[10px] text-slate-500">{data.count} prods · {data.kg.toFixed(1)} kg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {op.totalProducciones === 0 && (
                    <p className="text-slate-600 text-sm text-center py-4">
                      Sin producciones registradas en este período
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}