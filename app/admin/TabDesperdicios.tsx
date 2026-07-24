"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Trash2, RefreshCw, BarChart3, Calendar, TrendingDown, AlertTriangle } from 'lucide-react';

type EventoWaste = {
  id: number; tipo: string; kind: string; corte: string;
  peso_kg: number; waste_kg: number; operador: string; detalle: string; fecha: string;
};
type Merma = {
  id: number; nombre: string; categoria: string; tipo: string;
  cantidad: number; unidad: string; motivo: string; operador: string; fecha: string;
};

const KIND_EMOJI: Record<string, string> = {
  lomito:'🥩', burger:'🍔', milanesa:'🍗', cocina:'🍳', limpieza:'🔪',
};
const RAZON_EMOJI: Record<string, string> = {
  'se_cayo': '💥', 'consumo': '🍽️', 'descarte': '🗑️', 'vencio': '🤢', 'otro': '📝',
};

function getRazonEmoji(motivo: string) {
  for (const [key, emoji] of Object.entries(RAZON_EMOJI)) {
    if (motivo.toLowerCase().includes(key.replace('_', ' ')) || motivo.toLowerCase().includes(key)) return emoji;
  }
  if (motivo.includes('cayó') || motivo.includes('accidente')) return '💥';
  if (motivo.includes('consumo') || motivo.includes('staff')) return '🍽️';
  if (motivo.includes('descarte') || motivo.includes('cocción')) return '🗑️';
  if (motivo.includes('venció') || motivo.includes('descomposó')) return '🤢';
  return '🗑️';
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}
function diaKey(iso: string) {
  return iso.slice(0, 10);
}

const PERIODOS = [
  { id: '7',   label: '7 días' },
  { id: '30',  label: '30 días' },
  { id: '90',  label: '90 días' },
  { id: 'all', label: 'Todo' },
];

export default function TabDesperdicios() {
  const [eventos,  setEventos]  = useState<EventoWaste[]>([]);
  const [mermas,   setMermas]   = useState<Merma[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [periodo,  setPeriodo]  = useState('30');
  const [tab,      setTab]      = useState<'diario' | 'produccion' | 'mermas'>('diario');

  const fetchData = async () => {
    setLoading(true);
    const desde = periodo !== 'all'
      ? new Date(Date.now() - parseInt(periodo) * 86400000).toISOString()
      : undefined;

    const [{ data: evs }, { data: mvs }] = await Promise.all([
      (() => {
        let q = supabase.from('produccion_eventos').select('*').gt('waste_kg', 0).order('fecha', { ascending: false });
        if (desde) q = q.gte('fecha', desde);
        return q.limit(500);
      })(),
      (() => {
        let q = supabase.from('stock_movements').select('*').eq('tipo', 'egreso').ilike('motivo', 'merma%').order('fecha', { ascending: false });
        if (desde) q = q.gte('fecha', desde);
        return q.limit(500);
      })(),
    ]);
    setEventos((evs ?? []) as EventoWaste[]);
    setMermas((mvs ?? []) as Merma[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [periodo]);

  // ── Totales ──
  const totalWasteProd = eventos.reduce((s, e) => s + e.waste_kg, 0);
  const totalMermaKg   = mermas.filter(m => m.unidad === 'kg').reduce((s, m) => s + m.cantidad, 0);
  const totalMermaU    = mermas.filter(m => m.unidad !== 'kg').reduce((s, m) => s + m.cantidad, 0);

  // ── Vista diaria combinada ──
  type DiaEntry = { fecha: string; wasteKg: number; mermaKg: number; mermaU: number; items: { label: string; kg: number; u: number; emoji: string; quien: string; hora: string }[] };
  const porDia = new Map<string, DiaEntry>();

  eventos.forEach(e => {
    const k = diaKey(e.fecha);
    if (!porDia.has(k)) porDia.set(k, { fecha: k, wasteKg: 0, mermaKg: 0, mermaU: 0, items: [] });
    const d = porDia.get(k)!;
    d.wasteKg += e.waste_kg;
    d.items.push({ label: e.corte, kg: e.waste_kg, u: 0, emoji: KIND_EMOJI[e.kind] ?? '🔪', quien: e.operador, hora: fmtHora(e.fecha) });
  });

  mermas.forEach(m => {
    const k = diaKey(m.fecha);
    if (!porDia.has(k)) porDia.set(k, { fecha: k, wasteKg: 0, mermaKg: 0, mermaU: 0, items: [] });
    const d = porDia.get(k)!;
    if (m.unidad === 'kg') d.mermaKg += m.cantidad;
    else d.mermaU += m.cantidad;
    d.items.push({
      label: m.nombre,
      kg: m.unidad === 'kg' ? m.cantidad : 0,
      u: m.unidad !== 'kg' ? m.cantidad : 0,
      emoji: getRazonEmoji(m.motivo ?? ''),
      quien: m.operador,
      hora: fmtHora(m.fecha),
    });
  });

  const diasOrd = [...porDia.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ── Ranking por producto (mermas) ──
  const rankingMermas = Object.values(
    mermas.reduce<Record<string, { nombre: string; kg: number; u: number; unidad: string; veces: number }>>((acc, m) => {
      if (!acc[m.nombre]) acc[m.nombre] = { nombre: m.nombre, kg: 0, u: 0, unidad: m.unidad, veces: 0 };
      if (m.unidad === 'kg') acc[m.nombre].kg += m.cantidad;
      else acc[m.nombre].u += m.cantidad;
      acc[m.nombre].veces++;
      return acc;
    }, {})
  ).sort((a, b) => (b.kg + b.u) - (a.kg + a.u));

  const rankingProd = Object.values(
    eventos.reduce<Record<string, { corte: string; kind: string; waste: number; bruto: number; veces: number }>>((acc, e) => {
      const k = `${e.corte}__${e.kind}`;
      if (!acc[k]) acc[k] = { corte: e.corte, kind: e.kind, waste: 0, bruto: 0, veces: 0 };
      acc[k].waste += e.waste_kg;
      acc[k].bruto += e.peso_kg;
      acc[k].veces++;
      return acc;
    }, {})
  ).sort((a, b) => b.waste - a.waste);
  const maxWaste = Math.max(...rankingProd.map(r => r.waste), 1);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" /> Desperdicios y Mermas
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Pérdidas de producción + mermas registradas manualmente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1">
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${periodo===p.id?'bg-white text-slate-900':'text-slate-400 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <RefreshCw size={16} className={loading?'animate-spin':''} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Desp. producción</p>
          <p className="text-2xl font-black text-red-400">{totalWasteProd.toFixed(2)}<span className="text-sm text-slate-500"> kg</span></p>
          <p className="text-[10px] text-slate-600 mt-1">{eventos.length} producciones</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Mermas manuales</p>
          <p className="text-2xl font-black text-amber-400">{totalMermaKg.toFixed(2)}<span className="text-sm text-slate-500"> kg</span></p>
          {totalMermaU > 0 && <p className="text-[10px] text-slate-500 mt-1">+ {totalMermaU.toFixed(0)} u</p>}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Total pérdida</p>
          <p className="text-2xl font-black text-red-300">{(totalWasteProd + totalMermaKg).toFixed(2)}<span className="text-sm text-slate-500"> kg</span></p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Prom. diario</p>
          <p className="text-2xl font-black text-white">{diasOrd.length > 0 ? ((totalWasteProd + totalMermaKg) / diasOrd.length).toFixed(2) : '—'}<span className="text-sm text-slate-500"> kg</span></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1 w-fit">
        {([
          ['diario',    '📅 Vista diaria'],
          ['mermas',    `🗑️ Mermas (${mermas.length})`],
          ['produccion', `🔪 Prod. (${eventos.length})`],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab===id?'bg-white text-slate-900':'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : (

        <>
          {/* ── VISTA DIARIA ── */}
          {tab === 'diario' && (
            <div className="space-y-4">
              {diasOrd.length === 0 ? (
                <div className="text-center py-16 text-slate-600">
                  <Trash2 size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-lg">Sin pérdidas registradas en este período</p>
                </div>
              ) : diasOrd.map(dia => {
                const totalDia = dia.wasteKg + dia.mermaKg;
                return (
                  <div key={dia.fecha} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    {/* Header día */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                      <p className="font-black text-white text-sm">
                        📅 {new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'short', day:'2-digit', month:'short' })}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        {dia.wasteKg > 0 && <span className="text-red-400 font-black">🔪 {dia.wasteKg.toFixed(2)} kg desp.</span>}
                        {dia.mermaKg > 0 && <span className="text-amber-400 font-black">🗑️ {dia.mermaKg.toFixed(2)} kg merma</span>}
                        {dia.mermaU > 0 && <span className="text-amber-400 font-black">🗑️ {dia.mermaU.toFixed(0)} u merma</span>}
                        <span className="text-slate-500 font-bold">Total: {totalDia.toFixed(2)} kg</span>
                      </div>
                    </div>
                    {/* Items del día */}
                    <div className="divide-y divide-slate-800">
                      {dia.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          <p className="flex-1 font-bold text-slate-300 text-sm">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.quien}</p>
                          <p className="text-xs text-slate-600 font-mono">{item.hora}</p>
                          <p className={`text-sm font-black shrink-0 ${item.kg > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                            {item.kg > 0 ? `-${item.kg.toFixed(2)} kg` : `-${item.u.toFixed(0)} u`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MERMAS REGISTRADAS ── */}
          {tab === 'mermas' && (
            <div className="space-y-4">
              {/* Ranking */}
              {rankingMermas.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800">
                    <p className="font-black text-white text-sm">🏆 Ranking productos con más merma</p>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {rankingMermas.slice(0, 10).map((r, i) => (
                      <div key={r.nombre} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-slate-600 font-black text-xs w-5">{i+1}</span>
                        <p className="flex-1 font-black text-white text-sm">{r.nombre}</p>
                        <span className="text-xs text-slate-500">{r.veces}x</span>
                        <span className="font-black text-amber-400 text-sm">
                          {r.kg > 0 ? `${r.kg.toFixed(2)} kg` : `${r.u.toFixed(0)} ${r.unidad}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla detalle */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800">
                  <p className="font-black text-white text-sm">📋 Historial de mermas</p>
                </div>
                {mermas.length === 0 ? (
                  <p className="text-center py-10 text-slate-600">Sin mermas registradas — usá el botón "Registrar Merma" en la cocina</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {mermas.map(m => (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xl shrink-0">{getRazonEmoji(m.motivo ?? '')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-sm">{m.nombre}</p>
                          <p className="text-xs text-slate-500 truncate">{m.motivo?.replace('merma — ', '')}</p>
                        </div>
                        <p className="text-xs text-slate-500">{m.operador}</p>
                        <p className="text-xs text-slate-600 font-mono">{fmtFecha(m.fecha)} {fmtHora(m.fecha)}</p>
                        <p className="font-black text-amber-400 text-sm shrink-0">
                          -{m.cantidad} {m.unidad}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DESPERDICIOS PRODUCCIÓN ── */}
          {tab === 'produccion' && (
            <div className="space-y-4">
              {rankingProd.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800">
                    <p className="font-black text-white text-sm">🏆 Ranking por producto</p>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {rankingProd.map((r, i) => {
                      const pct = r.bruto > 0 ? (r.waste / r.bruto * 100) : 0;
                      const barPct = Math.round(r.waste / maxWaste * 100);
                      return (
                        <div key={`${r.corte}-${r.kind}`} className="px-5 py-4 flex items-center gap-4">
                          <span className="text-slate-600 font-black text-xs w-5">{i+1}</span>
                          <span className="text-base">{KIND_EMOJI[r.kind] ?? '🔪'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-black text-white text-sm">{r.corte}</p>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <span className={`text-xs font-black ${pct>20?'text-red-400':pct>10?'text-amber-400':'text-green-400'}`}>{pct.toFixed(1)}%</span>
                                <span className="font-black text-red-400 text-sm">{r.waste.toFixed(2)} kg</span>
                                <span className="text-[10px] text-slate-500">{r.veces}x</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-red-500" style={{ width:`${barPct}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-600">de {r.bruto.toFixed(1)} kg</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {eventos.length === 0 && (
                <div className="text-center py-16 text-slate-600">
                  <Trash2 size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold text-lg">Sin desperdicios de producción registrados</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
