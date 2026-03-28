"use client";
import React, { useState } from 'react';
import { Search, RefreshCw, Package, X, TrendingUp, TrendingDown, User } from 'lucide-react';
import { Movement, formatFecha } from './types';

type Props = {
  stock: any[];
  stockProd: any[];
  movements: Movement[];
  fetchMovements: () => Promise<void>;
};

export default function TabStock({ stock, stockProd, movements, fetchMovements }: Props) {
  const [stockCat, setStockCat]           = useState('all');
  const [stockSearch, setStockSearch]     = useState('');
  const [stockSubTab, setStockSubTab]     = useState<'materiales' | 'produccion'>('materiales');
  const [selectedStockItem, setSelectedStockItem] = useState<any | null>(null);
  const [selectedProdItem, setSelectedProdItem]   = useState<any | null>(null);
  const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
              lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  headerBg: 'bg-rose-500/20' },
              burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  headerBg: 'bg-blue-500/20' },
              milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', headerBg: 'bg-amber-500/20' },
            };
  return (
    <div className="max-w-6xl mx-auto space-y-6">

            {/* Sub-tabs Materiales / Producción */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
              {([
                { id: 'materiales', label: '📦 Materiales' },
                { id: 'produccion', label: '🍔 Producción' },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setStockSubTab(t.id)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all
                    ${stockSubTab === t.id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── SUB-TAB MATERIALES ── */}
            {stockSubTab === 'materiales' && (
              <>
                {/* Filtros */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
                  <div className="relative flex-1 min-w-48">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" placeholder="Buscar producto..." value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 outline-none focus:border-slate-500" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['all', ...new Set(stock.map(s => s.categoria))].map(cat => (
                      <button key={cat} onClick={() => setStockCat(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${stockCat === cat ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                        {cat === 'all' ? 'TODOS' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid por categoría */}
                {[...new Set(stock.filter(s => stockCat === 'all' || s.categoria === stockCat).map(s => s.categoria))].map(cat => {
                  const catItems = stock.filter(s => s.categoria === cat && (stockCat === 'all' || s.categoria === stockCat) && s.nombre.toLowerCase().includes(stockSearch.toLowerCase()));
                  if (catItems.length === 0) return null;
                  const CAT_EMOJI: Record<string,string> = { CARNES:'🥩',VERDURA:'🥗',FIAMBRE:'🧀',SECOS:'🧂',BEBIDAS:'🥤',LIMPIEZA:'🧴',BROLAS:'🍫',DESCARTABLES:'📦' };
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 bg-slate-900 border border-slate-800">
                        <span className="font-black text-sm uppercase text-slate-300">{CAT_EMOJI[cat] ?? '📦'} {cat}</span>
                        <span className="text-xs text-slate-500">{catItems.length} items</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {catItems.map((item: any) => {
                          const zero = item.cantidad === 0;
                          const low = !zero && item.cantidad < 5;
                          return (
                            <div key={item.id} onClick={() => setSelectedStockItem(item)} className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-opacity ${zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
                              <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.nombre}</p>
                              <p className={`text-2xl font-black ${zero ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'}`}>
                                {zero ? '—' : `${item.cantidad} ${item.unidad}`}
                              </p>
                              {zero && <p className="text-xs text-red-400 font-black mt-1">SIN STOCK</p>}
                              {item.fecha_vencimiento && <p className="text-xs text-slate-600 mt-1">Vence: {item.fecha_vencimiento}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── SUB-TAB PRODUCCIÓN ── */}
            {stockSubTab === 'produccion' && (
              <>
                {/* Totales */}
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

                {/* Detalle por categoría */}
                {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                  const cfg = PROD_CFG[cat];
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                      <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                        <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                        <span className="text-xs text-slate-500">{catItems.length} items · click para historial</span>
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
                  </div>
                )}
              </>
            )}

          </div>
  );
}