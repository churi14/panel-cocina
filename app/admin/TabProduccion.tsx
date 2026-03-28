"use client";
import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

type Props = {
  stockProd: any[];
  produccionEventos: any[];
  fetchMovements: () => Promise<void>;
};

export default function TabProduccion({ stockProd, produccionEventos, fetchMovements }: Props) {
  const [selectedProdItem, setSelectedProdItem] = useState<any | null>(null);
  const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
              lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  headerBg: 'bg-rose-500/20' },
              burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  headerBg: 'bg-blue-500/20' },
              milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', headerBg: 'bg-amber-500/20' },
            };
  return (
    <div className="max-w-6xl mx-auto space-y-6">

              {/* Totales rápidos */}
              <div className="grid grid-cols-3 gap-4">
                {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                  const cfg = PROD_CFG[cat];
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                  const unit = cat === 'milanesa' ? 'kg' : 'u';
                  return (
                    <div key={cat} className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
                      <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
                      <p className={`text-4xl font-black ${cfg.color}`}>
                        {cat === 'milanesa' ? total.toFixed(2) : Math.round(total)}
                        <span className="text-lg font-bold opacity-60 ml-1">{unit}</span>
                      </p>
                      <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
                    </div>
                  );
                })}
              </div>

              {/* Detalle por categoría — cards clickeables */}
              {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                const cfg = PROD_CFG[cat];
                const catItems = stockProd.filter((s: any) => s.categoria === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                      <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{catItems.length} items · click para ver historial</span>
                        <button onClick={fetchMovements} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                          <RefreshCw size={12} /> Actualizar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                      {catItems.map((item: any) => (
                        <div key={item.id} onClick={() => setSelectedProdItem(item)}
                          className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${cfg.border}`}>
                          <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                          <p className={`text-3xl font-black ${cfg.color}`}>
                            {cat === 'milanesa' ? item.cantidad.toFixed(2) : Math.round(item.cantidad)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                          {item.ultima_prod && (
                            <p className="text-xs text-slate-600 mt-2">
                              {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-wide">Ver historial →</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {stockProd.length === 0 && (
                <div className="text-center py-16 text-slate-600">
                  <p className="text-4xl mb-4">🍔</p>
                  <p className="font-bold text-lg">No hay stock de producción todavía</p>
                  <p className="text-sm mt-1">Aparecerá aquí cuando se confirmen producciones</p>
                </div>
              )}

              {/* ── DASHBOARD DE PRODUCCIÓN POR ITEM ── */}
              {selectedProdItem && (() => {
                const cat = selectedProdItem.categoria as string;
                const TIPO_LABELS: Record<string, { label: string; color: string }> = {
                  inicio_paso1:  { label: '▶ Inicio P1',   color: 'bg-blue-500/20 text-blue-300' },
                  fin_paso2:     { label: '✓ Fin P2',      color: 'bg-green-500/20 text-green-300' },
                  inicio_cocina: { label: '🍳 Inicio',     color: 'bg-amber-500/20 text-amber-300' },
                  fin_cocina:    { label: '✓ Fin cocina',  color: 'bg-green-500/20 text-green-300' },
                };
                const PROD_CFG: Record<string, { emoji: string; color: string; bar: string }> = {
                  lomito:   { emoji: '🥩', color: 'text-rose-400',  bar: 'bg-rose-500' },
                  burger:   { emoji: '🍔', color: 'text-blue-400',  bar: 'bg-blue-500' },
                  milanesa: { emoji: '🥪', color: 'text-amber-400', bar: 'bg-amber-500' },
                };
                const cfg = PROD_CFG[cat] ?? { emoji: '🏭', color: 'text-slate-400', bar: 'bg-slate-500' };
                const isKg = selectedProdItem.unidad === 'kg';

                // Eventos de fin_paso2 de esta categoría = cada producción completada
                const finales = produccionEventos
                  .filter(e => e.tipo === 'fin_paso2' && e.kind === cat)
                  .slice(0, 60);

                // Agrupar por día para el gráfico
                const porDia: Record<string, number> = {};
                finales.forEach(e => {
                  const dia = e.fecha?.slice(0, 10) ?? '';
                  if (!dia) return;
                  porDia[dia] = (porDia[dia] ?? 0) + (e.peso_kg ?? 0);
                });
                const diasOrdenados = Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0]));
                const maxKg = Math.max(...diasOrdenados.map(([, v]) => v), 1);

                // KPIs
                const totalKg      = finales.reduce((s, e) => s + (e.peso_kg ?? 0), 0);
                const totalProdsMes = finales.length;
                const promDiario   = diasOrdenados.length > 0 ? (totalKg / diasOrdenados.length).toFixed(1) : '—';
                const ultimaFecha  = finales[0]?.fecha ? new Date(finales[0].fecha).toLocaleDateString('es-AR') : '—';

                // Tendencia: últimos 3 días vs 3 anteriores
                const dias = diasOrdenados;
                const mitad = Math.floor(dias.length / 2);
                const recientes  = dias.slice(-Math.max(1, mitad)).reduce((s, [, v]) => s + v, 0);
                const anteriores = dias.slice(0, mitad).reduce((s, [, v]) => s + v, 0);
                const tendencia  = anteriores > 0 ? ((recientes - anteriores) / anteriores * 100).toFixed(0) : null;

                const formatFechaCorta = (f: string) => {
                  const d = new Date(f + 'T12:00:00');
                  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                };
                const formatFechaLarga = (f: string) => {
                  if (!f) return '—';
                  const d = new Date(f);
                  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
                };

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setSelectedProdItem(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl"
                      onClick={e => e.stopPropagation()}>

                      {/* Header */}
                      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{cfg.emoji}</span>
                          <div>
                            <h2 className={`font-black text-xl ${cfg.color}`}>{selectedProdItem.producto}</h2>
                            <p className="text-slate-400 text-xs">
                              Stock actual: <span className="font-black text-white">
                                {isKg ? selectedProdItem.cantidad.toFixed(2) : Math.round(selectedProdItem.cantidad)} {selectedProdItem.unidad}
                              </span>
                              {selectedProdItem.ultima_prod && (
                                <> · Última: <span className="text-white font-bold">{new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')}</span></>
                              )}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedProdItem(null)} className="p-2 hover:bg-slate-800 rounded-xl">
                          <X size={20} className="text-slate-400" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-5">

                        {/* KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Total kg procesados', value: `${totalKg.toFixed(1)} kg` },
                            { label: 'Producciones',        value: `${totalProdsMes}` },
                            { label: 'Promedio/día',        value: `${promDiario} kg` },
                            { label: 'Última producción',   value: ultimaFecha },
                          ].map((k, i) => (
                            <div key={i} className="bg-slate-800 rounded-xl p-3 text-center">
                              <p className={`text-xl font-black ${cfg.color}`}>{k.value}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Tendencia */}
                        {tendencia !== null && (
                          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                            Number(tendencia) >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                          }`}>
                            <span className="text-2xl">{Number(tendencia) >= 0 ? '📈' : '📉'}</span>
                            <div>
                              <p className={`font-black text-sm ${Number(tendencia) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {Number(tendencia) >= 0 ? '+' : ''}{tendencia}% vs período anterior
                              </p>
                              <p className="text-xs text-slate-500">Comparando primera y segunda mitad del historial</p>
                            </div>
                          </div>
                        )}

                        {/* Gráfico por día */}
                        {diasOrdenados.length > 0 && (
                          <div className="bg-slate-800 rounded-xl p-4">
                            <p className="text-xs font-black text-slate-400 uppercase mb-3">Kg procesados por día</p>
                            <div className="flex items-end gap-1.5 h-24">
                              {diasOrdenados.map(([dia, kg]) => (
                                <div key={dia} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-black px-2 py-0.5 rounded
                                    opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                    {kg.toFixed(1)} kg
                                  </div>
                                  <div className={`w-full ${cfg.bar} rounded-t transition-all hover:opacity-80`}
                                    style={{ height: `${Math.max(4, (kg / maxKg) * 88)}px` }} />
                                  <span className="text-[9px] text-slate-600 whitespace-nowrap overflow-hidden w-full text-center">
                                    {formatFechaCorta(dia)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Historial de eventos */}
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase mb-2">
                            Historial de producciones — {finales.length} registros
                          </p>
                          {finales.length === 0 ? (
                            <div className="py-10 text-center text-slate-600">
                              <p className="text-2xl mb-2">📋</p>
                              <p className="font-bold text-sm">Sin producciones registradas</p>
                            </div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                                <tr>
                                  <th className="px-4 py-2.5 text-left">Fecha</th>
                                  <th className="px-4 py-2.5 text-left">Evento</th>
                                  <th className="px-4 py-2.5 text-left">Detalle</th>
                                  <th className="px-4 py-2.5 text-right">Kg</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {finales.map((e: any) => {
                                  const tl = TIPO_LABELS[e.tipo] ?? { label: e.tipo, color: 'bg-slate-500/20 text-slate-400' };
                                  return (
                                    <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">{formatFechaLarga(e.fecha)}</td>
                                      <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${tl.color}`}>{tl.label}</span>
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-300 text-xs max-w-[180px] truncate">{e.detalle ?? e.corte ?? '—'}</td>
                                      <td className="px-4 py-2.5 text-right font-black text-white">{e.peso_kg ?? '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          
  );
}