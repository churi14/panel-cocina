"use client";
import React from 'react';
import { Movement } from './types';

type Props = {
  movements: Movement[];
  produccionEventos: any[];
  prodHistorial: any[];
};

export default function TabAnalytics({ movements, produccionEventos, prodHistorial }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  
            // ── Producciones completadas (step2_done en producciones_activas) ──
            const prodsCompleted = prodHistorial.filter(p => p.status === 'step2_done');
            const prodsHoy       = prodsCompleted.filter(p => p.date === new Date().toLocaleDateString('es-AR'));

            // ── Por kind ──
            const byKind = (kind: string) => prodsCompleted.filter(p => p.kind === kind);

            // ── Tiempos promedio paso 1 (en minutos) ──
            const avgMin = (arr: any[], field: string) => {
              const valid = arr.filter(p => p[field] && p[field] > 0).map(p => p[field] / 60);
              return valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : '—';
            };

            // ── Operadores únicos de stock ──
            const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))] as string[];

            // ── Por operador: movimientos, kg ingresados, kg egresados ──
            const opStats = operadores.map(op => {
              const movs = movements.filter(m => m.operador === op);
              const kgIn  = movs.filter(m => m.tipo === 'ingreso' && m.unidad === 'kg').reduce((s, m) => s + m.cantidad, 0);
              const kgOut = movs.filter(m => m.tipo === 'egreso'  && m.unidad === 'kg').reduce((s, m) => s + m.cantidad, 0);
              const hoy   = movs.filter(m => m.fecha?.slice(0, 10) === today).length;
              return { op, total: movs.length, kgIn, kgOut, hoy };
            }).sort((a, b) => b.total - a.total);

            // ── Uso de stock en producción (desde produccion_eventos fin_paso2) ──
            const stockEnProd = produccionEventos.filter(e => e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina');

            // ── Top productos más movidos ──
            const movByProd: Record<string, number> = {};
            movements.forEach(m => { movByProd[m.nombre] = (movByProd[m.nombre] ?? 0) + m.cantidad; });
            const topProds = Object.entries(movByProd).sort((a, b) => b[1] - a[1]).slice(0, 8);

            // ── Timeline de eventos de hoy ──
            const eventosHoy = produccionEventos.filter(e => e.fecha?.slice(0, 10) === today).slice(0, 20);

            const fmtMin = (seg: number | null) => {
              if (!seg) return '—';
              const m = Math.floor(seg / 60), s = Math.round(seg % 60);
              return `${m}:${s.toString().padStart(2,'0')} min`;
            };

            const KIND_CFG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
              lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30' },
              burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30' },
              milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
              cocina:   { emoji: '🍳', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
            };
  return (
    <div className="max-w-6xl mx-auto space-y-8">

              {/* ── KPIs principales ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Producciones totales', value: prodsCompleted.length, icon: '🏭', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Producciones hoy',     value: prodsHoy.length,       icon: '📅', color: 'text-green-400', bg: 'bg-green-500/10' },
                  { label: 'kg procesados total',  value: prodsCompleted.reduce((s, p) => s + (p.weight_kg || 0), 0).toFixed(1), icon: '⚖️', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Operadores activos',   value: operadores.length,      icon: '👤', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map((k, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3 text-xl`}>{k.icon}</div>
                    <p className={`text-3xl font-black ${k.color} mb-1`}>{k.value}</p>
                    <p className="text-slate-400 text-xs font-medium">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Producciones por tipo + tiempos promedio ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['lomito', 'burger', 'milanesa'] as const).map(kind => {
                  const cfg = KIND_CFG[kind];
                  const prods = byKind(kind);
                  const totalKg = prods.reduce((s, p) => s + (p.weight_kg || 0), 0);
                  const avgP1 = avgMin(prods, 'duration_seconds');
                  const avgP2 = (() => {
                    const valid = prods.filter(p => p.step2_start_time && p.step2_end_time)
                      .map(p => (p.step2_end_time - p.step2_start_time) / 1000 / 60);
                    return valid.length ? (valid.reduce((a,b) => a+b, 0) / valid.length).toFixed(1) : '—';
                  })();
                  return (
                    <div key={kind} className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
                      <p className={`text-xs font-black uppercase mb-3 ${cfg.color}`}>{cfg.emoji} {kind}</p>
                      <p className={`text-4xl font-black ${cfg.color} mb-1`}>{prods.length} <span className="text-lg opacity-60">prods</span></p>
                      <p className="text-slate-400 text-sm mb-3">{totalKg.toFixed(1)} kg procesados</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tiempo prom P1</span>
                          <span className={`font-black ${cfg.color}`}>{avgP1} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tiempo prom P2</span>
                          <span className={`font-black ${cfg.color}`}>{avgP2} min</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Historial completo de producciones ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2">🏭 Historial de producciones</h2>
                  <span className="text-xs text-slate-500">{prodsCompleted.length} completadas</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-5 py-3 text-left">Fecha</th>
                        <th className="px-5 py-3 text-left">Tipo</th>
                        <th className="px-5 py-3 text-left">Corte</th>
                        <th className="px-5 py-3 text-right">Kg</th>
                        <th className="px-5 py-3 text-right">T. Paso 1</th>
                        <th className="px-5 py-3 text-right">T. Paso 2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {prodHistorial.slice(0, 50).map((p: any, i: number) => {
                        const cfg = KIND_CFG[p.kind] ?? KIND_CFG['lomito'];
                        const p2dur = p.step2_start_time && p.step2_end_time
                          ? (p.step2_end_time - p.step2_start_time) / 1000 : null;
                        return (
                          <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{p.date ?? '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${cfg.bg} ${cfg.color}`}>
                                {cfg.emoji} {p.kind ?? '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-bold text-white text-xs">{p.type_name ?? '—'}</td>
                            <td className="px-5 py-3 text-right font-black text-white">{p.weight_kg ? Number(p.weight_kg).toFixed(2) : '—'}</td>
                            <td className="px-5 py-3 text-right text-slate-300 text-xs">{fmtMin(p.duration_seconds)}</td>
                            <td className="px-5 py-3 text-right text-slate-300 text-xs">{fmtMin(p2dur)}</td>
                          </tr>
                        );
                      })}
                      {prodHistorial.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-600">Sin producciones registradas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Operadores + uso de stock ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Operadores */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="font-bold">👤 Actividad por operador</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {opStats.length === 0 && (
                      <p className="text-slate-600 text-sm text-center py-8">Sin datos aún</p>
                    )}
                    {opStats.map(o => (
                      <div key={o.op} className="bg-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-black text-white">
                              {o.op.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-black text-white">{o.op}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">{o.total} mov.</span>
                            {o.hoy > 0 && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black">{o.hoy} hoy</span>}
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-400 font-bold">↑ {o.kgIn.toFixed(1)} kg ingresados</span>
                          <span className="text-red-400 font-bold">↓ {o.kgOut.toFixed(1)} kg egresados</span>
                        </div>
                        {/* Barra proporcional */}
                        <div className="mt-2 bg-slate-700 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (o.total / (opStats[0]?.total || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top productos movidos */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="font-bold">📊 Top productos por volumen</h2>
                  </div>
                  <div className="p-4 space-y-2">
                    {topProds.map(([nombre, qty], i) => (
                      <div key={nombre} className="flex items-center gap-3">
                        <span className="text-slate-600 text-xs font-black w-5 text-right">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-bold text-slate-300 truncate max-w-[180px]">{nombre}</span>
                            <span className="text-xs font-black text-white ml-2">{qty.toFixed(1)}</span>
                          </div>
                          <div className="bg-slate-800 rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (qty / (topProds[0]?.[1] || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {topProds.length === 0 && <p className="text-slate-600 text-sm text-center py-8">Sin datos aún</p>}
                  </div>
                </div>
              </div>

              {/* ── Timeline de hoy ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Timeline de producción — hoy
                  </h2>
                  <span className="text-xs text-slate-500">{eventosHoy.length} eventos</span>
                </div>
                {eventosHoy.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-600">
                    <p className="text-2xl mb-2">📋</p>
                    <p className="font-bold">Sin producciones hoy todavía</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {eventosHoy.map((e: any, i: number) => {
                      const cfg = KIND_CFG[e.kind] ?? { emoji: '🏭', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
                      const hora = e.fecha ? new Date(e.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const LABELS: Record<string, string> = {
                        inicio_paso1: 'Inicio paso 1', fin_paso2: 'Fin paso 2',
                        inicio_cocina: 'Inicio cocina', fin_cocina: 'Fin cocina',
                      };
                      return (
                        <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-800 last:border-0">
                          <span className="text-xs font-mono text-slate-500 w-12 shrink-0">{hora}</span>
                          <span className={`text-lg shrink-0`}>{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{e.detalle || e.corte || '—'}</p>
                            <p className="text-xs text-slate-500">{LABELS[e.tipo] ?? e.tipo} · {e.peso_kg ?? 0} kg</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${cfg.bg} ${cfg.color} shrink-0`}>
                            {e.kind}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
  );
}