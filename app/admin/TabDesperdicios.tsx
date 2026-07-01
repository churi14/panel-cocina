"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Trash2, RefreshCw, TrendingDown, BarChart3, Calendar } from 'lucide-react';

type EventoConWaste = {
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

type ResumenProducto = {
  corte: string;
  kind: string;
  total_bruto: number;
  total_waste: number;
  veces: number;
  pct_desperdicio: number;
};

const KIND_EMOJI: Record<string, string> = {
  lomito: '🥩', burger: '🍔', milanesa: '🥩', cocina: '🍳',
};

const PERIODOS = [
  { id: '7',   label: '7 días' },
  { id: '30',  label: '30 días' },
  { id: '90',  label: '90 días' },
  { id: 'all', label: 'Todo' },
];

export default function TabDesperdicios() {
  const [eventos, setEventos] = useState<EventoConWaste[]>([]);
  const [loading, setLoading]   = useState(true);
  const [periodo, setPeriodo]   = useState('30');
  const [tab, setTab]           = useState<'resumen' | 'detalle'>('resumen');

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('produccion_eventos')
      .select('*')
      .gt('waste_kg', 0)
      .order('fecha', { ascending: false });

    if (periodo !== 'all') {
      const desde = new Date(Date.now() - parseInt(periodo) * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('fecha', desde);
    }

    const { data } = await query.limit(500);
    setEventos((data ?? []) as EventoConWaste[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [periodo]);

  // Build summary per product
  const resumen: ResumenProducto[] = Object.values(
    eventos.reduce((acc: Record<string, ResumenProducto>, e) => {
      const key = `${e.corte}__${e.kind}`;
      if (!acc[key]) acc[key] = { corte: e.corte, kind: e.kind, total_bruto: 0, total_waste: 0, veces: 0, pct_desperdicio: 0 };
      acc[key].total_bruto += e.peso_kg;
      acc[key].total_waste += e.waste_kg;
      acc[key].veces++;
      return acc;
    }, {})
  ).map(r => ({ ...r, pct_desperdicio: r.total_bruto > 0 ? (r.total_waste / r.total_bruto) * 100 : 0 }))
   .sort((a, b) => b.total_waste - a.total_waste);

  const totalBruto = resumen.reduce((s, r) => s + r.total_bruto, 0);
  const totalWaste = resumen.reduce((s, r) => s + r.total_waste, 0);
  const pctTotal   = totalBruto > 0 ? (totalWaste / totalBruto) * 100 : 0;
  const maxWaste   = Math.max(...resumen.map(r => r.total_waste), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" /> Desperdicios
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {eventos.length} producciones con desperdicio registrado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1">
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${periodo === p.id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total desperdiciado</p>
          <p className="text-2xl font-black text-red-400">{totalWaste.toFixed(2)} <span className="text-sm text-slate-500">kg</span></p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">% sobre bruto</p>
          <p className={`text-2xl font-black ${pctTotal > 15 ? 'text-red-400' : pctTotal > 8 ? 'text-amber-400' : 'text-green-400'}`}>
            {pctTotal.toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Producciones</p>
          <p className="text-2xl font-black text-white">{eventos.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1 w-fit">
        {([['resumen', '📊 Por producto'], ['detalle', '📋 Detalle']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all
              ${tab === id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <Trash2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-bold text-lg">Sin desperdicios registrados</p>
          <p className="text-sm mt-1">Los desperdicios se registran automáticamente al finalizar producciones</p>
        </div>
      ) : (
        <>
          {/* Resumen por producto */}
          {tab === 'resumen' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="font-black text-white flex items-center gap-2">
                  <BarChart3 size={16} /> Ranking por producto
                </h3>
              </div>
              <div className="divide-y divide-slate-800">
                {resumen.map((r, idx) => {
                  const barPct = Math.round(r.total_waste / maxWaste * 100);
                  const alertColor = r.pct_desperdicio > 20 ? 'text-red-400' : r.pct_desperdicio > 10 ? 'text-amber-400' : 'text-green-400';
                  return (
                    <div key={`${r.corte}-${r.kind}`} className="px-5 py-4 flex items-center gap-4">
                      <span className="text-slate-600 font-black text-sm w-5 shrink-0">{idx + 1}</span>
                      <span className="text-lg shrink-0">{KIND_EMOJI[r.kind] ?? '🔪'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-white text-sm truncate">{r.corte}</p>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className={`text-xs font-black ${alertColor}`}>{r.pct_desperdicio.toFixed(1)}%</span>
                            <span className="text-sm font-black text-red-400">{r.total_waste.toFixed(3)} kg</span>
                            <span className="text-xs text-slate-500">{r.veces}x</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${barPct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-600 shrink-0">
                            de {r.total_bruto.toFixed(1)} kg bruto
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detalle */}
          {tab === 'detalle' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="font-black text-white flex items-center gap-2">
                  <Calendar size={16} /> Historial de desperdicios
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3 text-left">Tipo</th>
                    <th className="px-5 py-3 text-left">Producto</th>
                    <th className="px-5 py-3 text-right">Bruto</th>
                    <th className="px-5 py-3 text-right">Desperdicio</th>
                    <th className="px-5 py-3 text-right">%</th>
                    <th className="px-5 py-3 text-left">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {eventos.map(e => {
                    const pct = e.peso_kg > 0 ? (e.waste_kg / e.peso_kg * 100) : 0;
                    return (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                          {new Date(e.fecha).toLocaleDateString('es-AR')} {new Date(e.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-base">{KIND_EMOJI[e.kind] ?? '🔪'}</span>
                        </td>
                        <td className="px-5 py-3 font-black text-white">{e.corte}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-400">{e.peso_kg.toFixed(3)} kg</td>
                        <td className="px-5 py-3 text-right font-black text-red-400">{e.waste_kg.toFixed(3)} kg</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-black ${pct > 20 ? 'text-red-400' : pct > 10 ? 'text-amber-400' : 'text-green-400'}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-sm">{e.operador}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}