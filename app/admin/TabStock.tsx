"use client";
import React, { useState } from 'react';
import { Search, RefreshCw, Package, X, TrendingUp, TrendingDown, User } from 'lucide-react';
import { Movement, formatFecha } from './types';
import { supabase } from '../supabase';

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
  const [facturaQty, setFacturaQty]           = useState('');
  const [facturaProveedor, setFacturaProveedor] = useState('');
  const [savingFactura, setSavingFactura]     = useState(false);
  const [editingUmbrales, setEditingUmbrales]       = useState(false);
  const [umbralMinimo, setUmbralMinimo]             = useState('');
  const [umbralMedio, setUmbralMedio]               = useState('');
  const [umbralCritico, setUmbralCritico]           = useState('');
  const [savingUmbrales, setSavingUmbrales]         = useState(false);
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
                          const negativo = item.cantidad < 0;
                          const zero    = item.cantidad === 0;
                          const critico = item.stock_critico ?? 10;
                          const medio   = item.stock_medio   ?? 20;
                          const low     = !zero && !negativo && item.cantidad <= critico;
                          const warn    = !zero && !negativo && !low && item.cantidad <= medio;
                          return (
                            <div key={item.id} onClick={() => setSelectedStockItem(item)} className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-opacity ${negativo ? 'border-red-600/60 bg-red-600/10' : zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
                              <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.nombre}</p>
                              <p className={`text-2xl font-black ${negativo ? 'text-red-500' : zero ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'}`}>
                                {item.unidad === 'kg' || item.unidad === 'lt'
                                  ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                  : Number.isInteger(item.cantidad) ? item.cantidad : item.cantidad.toFixed(1)} {item.unidad}
                              </p>
                              {negativo && <p className="text-xs text-red-500 font-black mt-1">⚠️ STOCK NEGATIVO</p>}
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
                          {total % 1 === 0 ? total : total.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')}
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
                              {item.unidad === 'kg' || item.unidad === 'lt' ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') : item.cantidad}
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


          {/* ── MODAL HISTORIAL + UMBRALES DE STOCK ── */}
          {selectedStockItem && (() => {
            const itemMovements = movements
              .filter(m => m.nombre === selectedStockItem.nombre)
              .slice(0, 30);

            const handleSaveUmbrales = async () => {
              setSavingUmbrales(true);
              await supabase.from('stock').update({
                stock_minimo:  parseFloat(umbralMinimo)  || 0,
                stock_medio:   parseFloat(umbralMedio)   || 0,
                stock_critico: parseFloat(umbralCritico) || 0,
              }).eq('id', selectedStockItem.id);
              await fetchMovements();
              setSavingUmbrales(false);
              setEditingUmbrales(false);
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                onClick={() => { setSelectedStockItem(null); setEditingUmbrales(false); }}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl"
                  onClick={e => e.stopPropagation()}>

                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="font-black text-white text-lg">{selectedStockItem.nombre}</h2>
                      <p className="text-slate-400 text-xs">{selectedStockItem.categoria} · {selectedStockItem.unidad}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">
                          {selectedStockItem.unidad === 'kg' || selectedStockItem.unidad === 'lt'
                            ? selectedStockItem.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                            : selectedStockItem.cantidad}
                        </p>
                        <p className="text-xs text-slate-500">{selectedStockItem.unidad} en stock</p>
                      </div>
                      <button onClick={() => { setSelectedStockItem(null); setEditingUmbrales(false); }}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Umbrales */}
                    <div className="bg-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-400 uppercase">⚠️ Alertas de stock</p>
                        <button onClick={() => {
                          setEditingUmbrales(!editingUmbrales);
                          setUmbralCritico(String(selectedStockItem.stock_critico ?? ''));
                          setUmbralMedio(String(selectedStockItem.stock_medio ?? ''));
                          setUmbralMinimo(String(selectedStockItem.stock_minimo ?? ''));
                        }} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
                          {editingUmbrales ? 'Cancelar' : '✏️ Editar'}
                        </button>
                      </div>

                      {editingUmbrales ? (
                        <div className="space-y-3">
                          {[
                            { label: '🚨 Crítico (comprar YA)', key: 'critico', val: umbralCritico, set: setUmbralCritico },
                            { label: '⚠️ Medio (comprar pronto)', key: 'medio', val: umbralMedio, set: setUmbralMedio },
                            { label: '📦 Mínimo (stock saludable)', key: 'minimo', val: umbralMinimo, set: setUmbralMinimo },
                          ].map(({ label, key, val, set }) => (
                            <div key={key} className="flex items-center gap-3">
                              <label className="text-xs text-slate-400 w-44 shrink-0">{label}</label>
                              <input type="number" value={val} onChange={e => set(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                              <span className="text-xs text-slate-500">{selectedStockItem.unidad}</span>
                            </div>
                          ))}
                          <button onClick={handleSaveUmbrales} disabled={savingUmbrales}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50 mt-2">
                            {savingUmbrales ? 'Guardando...' : '✓ Guardar umbrales'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: '🚨 Crítico', val: selectedStockItem.stock_critico ?? '—', color: 'text-red-400' },
                            { label: '⚠️ Medio',   val: selectedStockItem.stock_medio   ?? '—', color: 'text-amber-400' },
                            { label: '📦 Mínimo',  val: selectedStockItem.stock_minimo  ?? '—', color: 'text-green-400' },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="bg-slate-700/50 rounded-xl p-3">
                              <p className={`text-lg font-black ${color}`}>{val} <span className="text-xs text-slate-500">{typeof val === 'number' ? selectedStockItem.unidad : ''}</span></p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cargar Factura */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
                      <p className="text-xs font-black text-green-400 uppercase mb-3">📦 Cargar factura / ingreso</p>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad</label>
                          <input
                            type="number" step="0.001" min="0"
                            value={facturaQty}
                            onChange={e => setFacturaQty(e.target.value)}
                            placeholder="0.000"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <span className="text-slate-400 font-bold pb-2.5">{selectedStockItem.unidad}</span>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor (opcional)</label>
                          <input
                            type="text"
                            value={facturaProveedor}
                            onChange={e => setFacturaProveedor(e.target.value)}
                            placeholder="Nombre proveedor"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500"
                          />
                        </div>
                      </div>
                      {selectedStockItem.cantidad < 0 && facturaQty && parseFloat(facturaQty) > 0 && (
                        <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Stock negativo:</span>
                            <span className="font-black text-red-400">{selectedStockItem.cantidad.toFixed(3)} {selectedStockItem.unidad}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Factura ingresa:</span>
                            <span className="font-black text-green-400">+{parseFloat(facturaQty).toFixed(3)} {selectedStockItem.unidad}</span>
                          </div>
                          <div className="flex justify-between border-t border-amber-500/20 pt-1 mt-1">
                            <span className="font-black text-slate-300">Stock final:</span>
                            <span className={`font-black ${selectedStockItem.cantidad + parseFloat(facturaQty) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(selectedStockItem.cantidad + parseFloat(facturaQty)).toFixed(3)} {selectedStockItem.unidad}
                            </span>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={async () => {
                          const qty = parseFloat(facturaQty);
                          if (!qty || qty <= 0) return;
                          setSavingFactura(true);
                          const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) + qty).toFixed(3));
                          await supabase.from('stock').update({
                            cantidad: newQty,
                            fecha_actualizacion: new Date().toISOString().slice(0, 10),
                          }).eq('id', selectedStockItem.id);
                          await supabase.from('stock_movements').insert({
                            stock_id: selectedStockItem.id,
                            nombre: selectedStockItem.nombre,
                            categoria: selectedStockItem.categoria,
                            tipo: 'ingreso',
                            cantidad: qty,
                            unidad: selectedStockItem.unidad,
                            motivo: `Factura${facturaProveedor ? ' - ' + facturaProveedor : ''}`,
                            operador: 'Admin',
                            fecha: new Date().toISOString(),
                          });
                          setFacturaQty('');
                          setFacturaProveedor('');
                          setSavingFactura(false);
                          await fetchMovements();
                          setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                        }}
                        disabled={!facturaQty || parseFloat(facturaQty) <= 0 || savingFactura}
                        className="mt-3 w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
                      >
                        {savingFactura ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Confirmar ingreso
                      </button>
                    </div>

                    {/* Historial de movimientos */}
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase mb-3">
                        Historial de movimientos — {itemMovements.length} registros
                      </p>
                      {itemMovements.length === 0 ? (
                        <div className="text-center py-8 text-slate-600">
                          <p className="font-bold">Sin movimientos registrados</p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                            <tr>
                              <th className="px-4 py-2.5 text-left">Fecha</th>
                              <th className="px-4 py-2.5 text-left">Tipo</th>
                              <th className="px-4 py-2.5 text-left">Motivo</th>
                              <th className="px-4 py-2.5 text-right">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {itemMovements.map(m => (
                              <tr key={m.id} className="hover:bg-slate-800/40">
                                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{formatFecha(m.fecha)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {m.tipo}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 text-xs truncate max-w-[140px]">{m.motivo ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right font-black text-white">
                                  {m.tipo === 'egreso' ? '-' : '+'}{m.cantidad} {m.unidad}
                                </td>
                              </tr>
                            ))}
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