"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type Evento = {
  id: number; tipo: string; kind: string; corte: string;
  peso_kg: number; detalle: string | null; operador: string | null;
  fecha: string; waste_kg?: number;
};

type Sesion = {
  ini: Evento; fin: Evento | null;
  durMin: number | null; iniMs: number;
};

const KIND_EMOJI: Record<string, string> = {
  lomito: '🥩', burger: '🍔', milanesa: '🍗', cocina: '🍳',
  limpieza: '🔪', carnes_limpias: '🔪', salsa: '🫙', verduras: '🥬', fiambre: '🧀',
};

function durLabel(min: number | null) {
  if (min === null) return null;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
function durColor(min: number | null) {
  if (min === null) return 'text-slate-500';
  if (min <= 30) return 'text-green-400';
  if (min <= 60) return 'text-amber-400';
  return 'text-red-400';
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
function weekKey(iso: string) {
  const d = new Date(iso);
  // Lunes de esa semana
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0, 10);
}

function buildSesiones(eventos: Evento[], opNombre: string): Sesion[] {
  const norm = opNombre.toLowerCase().trim();
  const mine = eventos.filter(e => e.operador?.toLowerCase().trim() === norm);
  const inicios = mine.filter(e => e.tipo === 'inicio_paso1');
  const fines   = eventos.filter(e =>
    (e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina') &&
    e.operador?.toLowerCase().trim() === norm
  );
  return inicios.map(ini => {
    const iniMs = new Date(ini.fecha).getTime();
    const fin = fines
      .filter(f =>
        f.corte?.toLowerCase() === ini.corte?.toLowerCase() &&
        f.kind === ini.kind &&
        new Date(f.fecha).getTime() > iniMs
      )
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0] ?? null;
    const durMin = fin
      ? Math.round((new Date(fin.fecha).getTime() - iniMs) / 60000)
      : null;
    return { ini, fin, durMin, iniMs };
  }).sort((a, b) => b.iniMs - a.iniMs);
}

export default function TabOperadores() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [periodo, setPeriodo]   = useState<'hoy' | 'semana' | 'mes'>('semana');
  const [detailTab, setDetailTab] = useState<Record<string, 'sesiones' | 'tendencia'>>({});

  const fetchData = async () => {
    setLoading(true);
    const [{ data: evs }, { data: prfs }] = await Promise.all([
      supabase.from('produccion_eventos').select('*').order('fecha', { ascending: false }).limit(3000),
      supabase.from('operadores').select('*').order('nombre'),
    ]);
    setEventos((evs ?? []) as Evento[]);
    setPerfiles(prfs ?? []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const ahora = Date.now();
  const desde = periodo === 'hoy'
    ? new Date(new Date().setHours(0,0,0,0)).toISOString()
    : periodo === 'semana'
    ? new Date(ahora - 7  * 86400000).toISOString()
    : new Date(ahora - 30 * 86400000).toISOString();

  const eventosPeriodo = eventos.filter(e => e.fecha >= desde);

  const perfilesActivos = perfiles
    .filter(p => p.activo !== false)
    .reduce((acc: any[], p: any) => {
      const key = (p.nombre ?? '').toLowerCase().trim();
      if (key && !acc.find((x: any) => (x.nombre ?? '').toLowerCase().trim() === key)) acc.push(p);
      return acc;
    }, []);

  // Stats por operador
  const operadores = perfilesActivos.map(p => {
    const sesiones = buildSesiones(eventos, p.nombre);
    const sesionesEnPeriodo = sesiones.filter(s => s.ini.fecha >= desde);

    const totalKg = sesionesEnPeriodo.reduce((sum, s) =>
      sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const duraciones = sesionesEnPeriodo
      .map(s => s.durMin)
      .filter((d): d is number => d !== null);
    const durProm = duraciones.length
      ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
      : null;

    // Tendencia: última semana vs anterior
    const ahora2 = Date.now();
    const s1Start = new Date(ahora2 - 7  * 86400000).toISOString();
    const s2Start = new Date(ahora2 - 14 * 86400000).toISOString();
    const semAct  = sesiones.filter(s => s.ini.fecha >= s1Start);
    const semAnt  = sesiones.filter(s => s.ini.fecha >= s2Start && s.ini.fecha < s1Start);
    const kgAct   = semAct.reduce((sum, s) => sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const kgAnt   = semAnt.reduce((sum, s) => sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const durAct  = semAct.filter(s => s.durMin).map(s => s.durMin!);
    const durAnt  = semAnt.filter(s => s.durMin).map(s => s.durMin!);
    const avgDurAct = durAct.length ? Math.round(durAct.reduce((a,b)=>a+b,0)/durAct.length) : null;
    const avgDurAnt = durAnt.length ? Math.round(durAnt.reduce((a,b)=>a+b,0)/durAnt.length) : null;

    // Sesiones agrupadas por semana para tendencia
    const porSemana: Record<string, { count: number; kg: number; durs: number[] }> = {};
    sesiones.slice(0, 200).forEach(s => {
      const wk = weekKey(s.ini.fecha);
      if (!porSemana[wk]) porSemana[wk] = { count: 0, kg: 0, durs: [] };
      porSemana[wk].count++;
      porSemana[wk].kg += s.fin?.peso_kg ?? s.ini.peso_kg ?? 0;
      if (s.durMin !== null) porSemana[wk].durs.push(s.durMin);
    });
    const semanasOrd = Object.entries(porSemana).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

    return {
      nombre: p.nombre,
      sesiones,
      sesionesEnPeriodo,
      totalKg,
      durProm,
      totalProds: sesionesEnPeriodo.length,
      kgAct, kgAnt, avgDurAct, avgDurAnt,
      semanasOrd,
      ultimaFecha: sesiones[0]?.ini.fecha ?? null,
    };
  }).sort((a, b) => b.totalKg - a.totalKg);

  const getDetailTab = (nombre: string) => detailTab[nombre] ?? 'sesiones';
  const setDetailTabFor = (nombre: string, tab: 'sesiones' | 'tendencia') =>
    setDetailTab(prev => ({ ...prev, [nombre]: tab }));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">📊 Productividad del equipo</h2>
          <p className="text-slate-400 text-sm mt-0.5">Sesiones, duración y tendencias por operador</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1">
            {(['hoy', 'semana', 'mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize
                  ${periodo === p ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {operadores.map((op, idx) => {
            const isExpanded = expandedOp === op.nombre;
            const tab = getDetailTab(op.nombre);
            const kgDiff = op.kgAct - op.kgAnt;
            const durDiff = op.avgDurAct !== null && op.avgDurAnt !== null
              ? op.avgDurAct - op.avgDurAnt : null;
            const mejoroTiempo = durDiff !== null && durDiff < 0; // menos tiempo = mejora

            return (
              <div key={op.nombre} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

                {/* ── Fila resumen ── */}
                <button
                  onClick={() => setExpandedOp(isExpanded ? null : op.nombre)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors text-left">

                  {/* Ranking */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0
                    ${idx === 0 ? 'bg-amber-500 text-slate-900' : idx === 1 ? 'bg-slate-400 text-slate-900' : idx === 2 ? 'bg-amber-700/80 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {idx + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white shrink-0 text-sm">
                    {op.nombre.slice(0,1).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white">{op.nombre}</p>
                    <p className="text-slate-500 text-xs">
                      {op.totalProds} sesiones · {op.totalKg.toFixed(1)} kg
                      {op.durProm !== null && ` · prom ${op.durProm} min/sesión`}
                    </p>
                  </div>

                  {/* KPIs */}
                  <div className="hidden md:flex items-center gap-5 shrink-0">
                    {/* Kg esta semana vs anterior */}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase">Kg (sem)</p>
                      <p className="font-black text-white text-sm">{op.kgAct.toFixed(1)}</p>
                      {op.kgAnt > 0 && (
                        <p className={`text-[10px] font-bold ${kgDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {kgDiff >= 0 ? '▲' : '▼'} {Math.abs(kgDiff).toFixed(1)} vs ant.
                        </p>
                      )}
                    </div>
                    {/* Duración promedio */}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase">Dur. prom</p>
                      <p className={`font-black text-sm ${durColor(op.avgDurAct)}`}>
                        {durLabel(op.avgDurAct) ?? '—'}
                      </p>
                      {durDiff !== null && (
                        <p className={`text-[10px] font-bold ${mejoroTiempo ? 'text-green-400' : 'text-red-400'}`}>
                          {mejoroTiempo ? '▼' : '▲'} {Math.abs(durDiff)} min vs ant.
                        </p>
                      )}
                    </div>
                    {/* Última actividad */}
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase">Última</p>
                      <p className="font-black text-white text-xs">
                        {op.ultimaFecha ? fmtFecha(op.ultimaFecha) : '—'}
                      </p>
                      {op.ultimaFecha && (
                        <p className="text-[10px] text-slate-600">{fmtHora(op.ultimaFecha)}</p>
                      )}
                    </div>
                  </div>

                  {isExpanded
                    ? <ChevronUp size={16} className="text-slate-500 shrink-0" />
                    : <ChevronDown size={16} className="text-slate-500 shrink-0" />
                  }
                </button>

                {/* ── Detalle expandido ── */}
                {isExpanded && (
                  <div className="border-t border-slate-800">

                    {/* Sub-tabs detalle */}
                    <div className="flex border-b border-slate-800">
                      {(['sesiones', 'tendencia'] as const).map(t => (
                        <button key={t} onClick={() => setDetailTabFor(op.nombre, t)}
                          className={`flex-1 py-2.5 text-xs font-black transition-all
                            ${tab === t ? 'text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>
                          {t === 'sesiones' ? `📋 Sesiones (${op.sesionesEnPeriodo.length})` : '📈 Tendencia semanal'}
                        </button>
                      ))}
                    </div>

                    {/* ── TAB SESIONES ── */}
                    {tab === 'sesiones' && (
                      <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                        {op.sesionesEnPeriodo.length === 0 ? (
                          <p className="text-center text-slate-600 py-6 text-sm">Sin sesiones en este período</p>
                        ) : op.sesionesEnPeriodo.map((s, i) => (
                          <div key={i} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                            <span className="text-lg shrink-0">{KIND_EMOJI[s.ini.kind] ?? '🔪'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-white text-sm">{s.ini.corte}</p>
                              <p className="text-xs text-slate-500 capitalize">{s.ini.kind}</p>
                            </div>
                            {/* Timeline */}
                            <div className="text-center shrink-0">
                              <p className="text-xs text-slate-400 font-mono">
                                {fmtHora(s.ini.fecha)}
                                {s.fin && ` → ${fmtHora(s.fin.fecha)}`}
                              </p>
                              <p className="text-[10px] text-slate-600">{fmtFecha(s.ini.fecha)}</p>
                            </div>
                            {/* Duración */}
                            <div className="text-center shrink-0 w-16">
                              {s.durMin !== null ? (
                                <p className={`font-black text-sm ${durColor(s.durMin)}`}>
                                  {durLabel(s.durMin)}
                                </p>
                              ) : (
                                <p className="text-amber-400 text-xs font-bold">en curso</p>
                              )}
                            </div>
                            {/* Kg */}
                            <div className="text-right shrink-0 w-16">
                              {(s.fin?.peso_kg ?? s.ini.peso_kg) > 0 && (
                                <>
                                  <p className="font-black text-amber-400 text-sm">
                                    {(s.fin?.peso_kg ?? s.ini.peso_kg).toFixed(1)} kg
                                  </p>
                                  {s.fin?.waste_kg! > 0 && (
                                    <p className="text-[10px] text-red-400">-{s.fin!.waste_kg!.toFixed(1)} desp</p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── TAB TENDENCIA ── */}
                    {tab === 'tendencia' && (
                      <div className="p-4 space-y-4">
                        {op.semanasOrd.length === 0 ? (
                          <p className="text-center text-slate-600 py-6 text-sm">Sin datos históricos</p>
                        ) : (
                          <>
                            {/* Barras de kg por semana */}
                            <div>
                              <p className="text-xs font-black text-slate-500 uppercase mb-3">Kg producidos por semana</p>
                              <div className="flex items-end gap-2 h-24">
                                {(() => {
                                  const maxKg = Math.max(...op.semanasOrd.map(([,v]) => v.kg), 1);
                                  return op.semanasOrd.map(([wk, v], i) => {
                                    const isLast = i === op.semanasOrd.length - 1;
                                    const pct = Math.max(6, (v.kg / maxKg) * 100);
                                    const wkLabel = new Date(wk + 'T12:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
                                    return (
                                      <div key={wk} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                          {v.kg.toFixed(1)} kg · {v.count} ses.
                                        </div>
                                        <div
                                          className={`w-full rounded-t transition-all ${isLast ? 'bg-amber-500' : 'bg-slate-600'}`}
                                          style={{ height: `${pct}%` }}
                                        />
                                        <span className="text-[9px] text-slate-600 whitespace-nowrap">{wkLabel}</span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Tabla semanal */}
                            <div className="bg-slate-800 rounded-xl overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-700">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-slate-400 font-black uppercase">Semana</th>
                                    <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Sesiones</th>
                                    <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Kg</th>
                                    <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Dur. prom</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                  {[...op.semanasOrd].reverse().map(([wk, v], i) => {
                                    const isLast = i === 0;
                                    const avgDur = v.durs.length
                                      ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length)
                                      : null;
                                    const wkLabel = new Date(wk + 'T12:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
                                    // Comparar con semana anterior en la lista
                                    const prev = op.semanasOrd[op.semanasOrd.length - 1 - i - 1];
                                    const prevAvgDur = prev && prev[1].durs.length
                                      ? Math.round(prev[1].durs.reduce((a,b)=>a+b,0)/prev[1].durs.length)
                                      : null;
                                    const mejoro = avgDur !== null && prevAvgDur !== null && avgDur < prevAvgDur;
                                    return (
                                      <tr key={wk} className={isLast ? 'bg-amber-500/5' : ''}>
                                        <td className="px-3 py-2.5 font-bold text-slate-300">
                                          {isLast ? '⭐ ' : ''}{wkLabel}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-white font-black">{v.count}</td>
                                        <td className="px-3 py-2.5 text-right font-black text-amber-400">{v.kg.toFixed(1)} kg</td>
                                        <td className="px-3 py-2.5 text-right">
                                          {avgDur !== null ? (
                                            <span className={`font-black ${durColor(avgDur)}`}>
                                              {avgDur} min
                                              {prevAvgDur !== null && (
                                                <span className={`ml-1 text-[10px] ${mejoro ? 'text-green-400' : 'text-red-400'}`}>
                                                  {mejoro ? `▼${prevAvgDur-avgDur}` : `▲${avgDur-prevAvgDur}`}
                                                </span>
                                              )}
                                            </span>
                                          ) : <span className="text-slate-600">—</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
