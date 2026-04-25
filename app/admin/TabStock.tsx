"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { AlertTriangle, Search, RefreshCw, Package, X, TrendingUp, TrendingDown, User , Trash2 } from 'lucide-react';
import { Movement, formatFecha } from './types';
import { supabase } from '../supabase';
import StockEntryModal from '../components/StockEntryModal';

type Props = {
  stock: any[];
  stockProd: any[];
  movements: Movement[];
  fetchMovements: () => Promise<void>;
};

export default function TabStock({ stock, stockProd, movements, fetchMovements }: Props) {
  const [showEntryModal, setShowEntryModal] = useState(false);
  const { user } = useAuth();
  const [stockCat, setStockCat]           = useState('all');
  const [stockSearch, setStockSearch]     = useState('');
  const [stockSubTab, setStockSubTab]     = useState<'materiales' | 'produccion'>('materiales');
  const [selectedStockItem, setSelectedStockItem] = useState<any | null>(null);
  const [facturaQty, setFacturaQty]           = useState('');
  const [facturaProveedor, setFacturaProveedor] = useState('');
  const [savingFactura, setSavingFactura]     = useState(false);
  const savingFacturaRef = React.useRef(false);
  // Egreso
  const [egresoQty, setEgresoQty]             = useState('');
  const [egresoComentario, setEgresoComentario] = useState('');
  const [savingEgreso, setSavingEgreso]       = useState(false);
  const savingEgresoRef = React.useRef(false);
  // Modo latas
  const [latasCount, setLatasCount]           = useState('');
  const [latasPeso, setLatasPeso]             = useState('');
  const [modoLatas, setModoLatas]             = useState(false);
  // Tab ingreso/egreso en modal
  const [modalTab, setModalTab]               = useState<'ingreso' | 'egreso'>('ingreso');
  const [editingUmbrales, setEditingUmbrales]       = useState(false);
  const [umbralMinimo, setUmbralMinimo]             = useState('');
  const [umbralMedio, setUmbralMedio]               = useState('');
  const [umbralCritico, setUmbralCritico]           = useState('');
  const [savingUmbrales, setSavingUmbrales]         = useState(false);
  // Edición de movimientos
  const [editingMovement, setEditingMovement]       = useState<any | null>(null);
  const [editMovQty, setEditMovQty]                 = useState('');
  const [editMovMotivo, setEditMovMotivo]           = useState('');
  const [savingMovement, setSavingMovement]         = useState(false);
  const [deleteMovConfirm, setDeleteMovConfirm]     = useState<any | null>(null);
  // Umbrales personales (por usuario logueado)
  const [miCritico, setMiCritico]                   = useState('');
  const [miMedio, setMiMedio]                       = useState('');
  const [savingMiAlerta, setSavingMiAlerta]         = useState(false);
  const [miAlertaActual, setMiAlertaActual]         = useState<{critico?:number|null;medio?:number|null}|null>(null);
  const [selectedProdItem, setSelectedProdItem]   = useState<any | null>(null);
  const [alertaUmbral, setAlertaUmbral]           = useState('');
  const [alertaDias, setAlertaDias]               = useState('');
  const [savingAlerta, setSavingAlerta]           = useState(false);
  const [cargaQty, setCargaQty]                   = useState('');
  const [cargaMotivo, setCargaMotivo]             = useState('Producción manual');
  const [savingCarga, setSavingCarga]             = useState(false);
  const [prodTab, setProdTab]                     = useState<'carga' | 'alerta'>('carga');
  const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
    lomito:   { emoji: '🥩', color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   headerBg: 'bg-rose-500/20'   },
    burger:   { emoji: '🍔', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   headerBg: 'bg-blue-500/20'   },
    milanesa: { emoji: '🥪', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  headerBg: 'bg-amber-500/20'  },
    verdura:  { emoji: '🥦', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  headerBg: 'bg-green-500/20'  },
    fiambre:  { emoji: '🧀', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/20' },
    pan:      { emoji: '🍞', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', headerBg: 'bg-orange-500/20' },
    salsa:    { emoji: '🫙', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', headerBg: 'bg-purple-500/20' },
    dip:      { emoji: '🥄', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   headerBg: 'bg-pink-500/20'   },
    caja:     { emoji: '📦', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  headerBg: 'bg-slate-500/20'  },
  };
  const DEFAULT_CFG = { emoji: '📋', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', headerBg: 'bg-slate-500/20' };
  // Categorías dinámicas — lee lo que haya en stockProd
  const prodCats = [...new Set(stockProd.map((s: any) => s.categoria as string))].sort();
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
                  <button
                    onClick={() => setShowEntryModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-xl transition-all active:scale-95 whitespace-nowrap">
                    <Package size={16} /> Cargar Factura
                  </button>
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
                          // Detectar vencimiento
                          const hoyStr = new Date().toISOString().slice(0,10);
                          const vencDate = item.fecha_vencimiento ? (() => {
                            const [d,m,y] = item.fecha_vencimiento.split('/');
                            return y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null;
                          })() : null;
                          const vencido  = vencDate ? vencDate < hoyStr : false;
                          const proxVenc = vencDate ? (vencDate >= hoyStr && vencDate <= new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10)) : false;
                          const tieneAlerta = negativo || vencido || proxVenc;

                          return (
                            <div key={item.id} onClick={() => { setSelectedStockItem(item); setModalTab('ingreso'); setModoLatas(false); setLatasCount(''); setLatasPeso(''); setEgresoQty(''); setEgresoComentario(''); setFacturaQty(''); setFacturaProveedor(''); setFacturaLote(''); setFacturaComentario(''); setFacturaVence(''); }} className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-opacity relative ${negativo ? 'border-red-600/60 bg-red-600/10' : vencido ? 'border-orange-500/60 bg-orange-500/10' : zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
                              
                              {/* Icono de alerta */}
                              {tieneAlerta && (
                                <div className={`absolute top-2 right-2 rounded-full p-1 ${negativo ? 'bg-red-500' : vencido ? 'bg-orange-500' : 'bg-amber-500'}`}
                                  title={negativo ? 'Stock negativo' : vencido ? `Vencido: ${item.fecha_vencimiento}` : `Vence pronto: ${item.fecha_vencimiento}`}>
                                  <AlertTriangle size={12} className="text-white" />
                                </div>
                              )}

                              <p className="font-bold text-slate-300 text-sm leading-tight mb-2 pr-6">{item.nombre}</p>
                              <p className={`text-2xl font-black ${negativo ? 'text-red-500' : vencido ? 'text-orange-400' : zero ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'}`}>
                                {item.unidad === 'kg' || item.unidad === 'lt'
                                  ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                  : Number.isInteger(item.cantidad) ? item.cantidad : item.cantidad.toFixed(1)} {item.unidad}
                              </p>
                              {negativo  && <p className="text-xs text-red-500 font-black mt-1">⚠️ STOCK NEGATIVO</p>}
                              {vencido   && <p className="text-xs text-orange-400 font-black mt-1">⚠️ VENCIDO: {item.fecha_vencimiento}</p>}
                              {proxVenc  && !vencido && <p className="text-xs text-amber-400 font-black mt-1">⏰ Vence: {item.fecha_vencimiento}</p>}
                              {zero && !vencido && <p className="text-xs text-red-400 font-black mt-1">SIN STOCK</p>}
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
                {/* Totales dinámicos */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {prodCats.map(cat => {
                    const cfg = PROD_CFG[cat] ?? DEFAULT_CFG;
                    const catItems = stockProd.filter((s: any) => s.categoria === cat);
                    const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                    const units = [...new Set(catItems.map((s: any) => s.unidad))];
                    const unit = units.length === 1 ? units[0] : 'u';
                    return (
                      <div key={cat} className={`rounded-2xl border-2 p-4 ${cfg.bg} ${cfg.border}`}>
                        <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
                        <p className={`text-3xl font-black ${cfg.color}`}>
                          {total % 1 === 0 ? total : total.toFixed(2).replace('.', ',')}
                          <span className="text-sm font-bold opacity-60 ml-1">{unit}</span>
                        </p>
                        <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
                      </div>
                    );
                  })}
                </div>

                {/* Detalle por categoría — dinámico */}
                {prodCats.map(cat => {
                  const cfg = PROD_CFG[cat] ?? DEFAULT_CFG;
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                      <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                        <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                        <span className="text-xs text-slate-500">{catItems.length} items</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                        {catItems.map((item: any) => (
                          <div key={item.id} onClick={() => { setSelectedProdItem(item); setAlertaUmbral(String(item.alerta_umbral ?? '')); setAlertaDias(String(item.alerta_dias ?? '')); setCargaQty(''); setCargaMotivo('Producción manual'); setProdTab('carga'); }}
                            className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${cfg.border}`}>
                            <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                            <p className={`text-3xl font-black ${item.cantidad === 0 ? 'text-slate-600' : cfg.color}`}>
                              {item.unidad === 'kg' || item.unidad === 'lt'
                                ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                : item.cantidad}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                            {item.alerta_umbral > 0 && (
                              <p className="text-[10px] text-amber-400/70 font-black mt-1">🔔 alerta &lt;{item.alerta_umbral}{item.unidad}</p>
                            )}
                            {item.cantidad === 0 && <p className="text-[10px] text-slate-600 font-black mt-1">SIN STOCK</p>}
                            {item.ultima_prod && (
                              <p className="text-xs text-slate-600 mt-2">
                                {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
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


          {/* ── MODAL ALERTAS DE PRODUCCIÓN ── */}
          {selectedProdItem && (() => {
            const cfg = PROD_CFG[selectedProdItem.categoria] ?? DEFAULT_CFG;

            const handleSaveAlerta = async () => {
              setSavingAlerta(true);
              await supabase.from('stock_produccion').update({
                alerta_umbral: parseFloat(alertaUmbral) || null,
                alerta_dias:   parseInt(alertaDias)     || null,
              }).eq('id', selectedProdItem.id);
              await fetchMovements();
              setSavingAlerta(false);
              setSelectedProdItem(null);
            };

            const tieneAlerta = selectedProdItem.alerta_umbral > 0;

            const handleCargarStock = async () => {
              const qty = parseFloat(cargaQty.replace(',', '.'));
              if (!qty || qty <= 0) return;
              setSavingCarga(true);
              const newQty = parseFloat((Number(selectedProdItem.cantidad) + qty).toFixed(3));
              await supabase.from('stock_produccion').update({
                cantidad: newQty,
                ultima_prod: new Date().toISOString(),
              }).eq('id', selectedProdItem.id);
              await supabase.from('stock_movements').insert({
                nombre: selectedProdItem.producto,
                categoria: selectedProdItem.categoria,
                tipo: 'ingreso',
                cantidad: qty,
                unidad: selectedProdItem.unidad,
                motivo: cargaMotivo,
                operador: 'Admin',
                fecha: new Date().toISOString(),
              });
              await fetchMovements();
              setSavingCarga(false);
              setSelectedProdItem(null);
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                onClick={() => setSelectedProdItem(null)}>
                <div className={`bg-slate-900 border-2 ${cfg.border} rounded-2xl w-full max-w-md shadow-2xl`}
                  onClick={e => e.stopPropagation()}>

                  {/* Header */}
                  <div className={`px-6 py-4 rounded-t-2xl border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                    <div>
                      <p className={`text-xs font-black uppercase ${cfg.color}`}>{cfg.emoji} {selectedProdItem.categoria}</p>
                      <h2 className="font-black text-white text-lg leading-tight">{selectedProdItem.producto}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-2xl font-black ${cfg.color}`}>
                          {selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt'
                            ? selectedProdItem.cantidad.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
                            : selectedProdItem.cantidad}
                        </p>
                        <p className="text-xs text-slate-500">{selectedProdItem.unidad} en stock</p>
                      </div>
                      <button onClick={() => setSelectedProdItem(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-800">
                    {([
                      { id: 'carga', label: '📦 Cargar Stock' },
                      { id: 'alerta', label: '🔔 Alerta' },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setProdTab(t.id)}
                        className={`flex-1 py-3 text-sm font-black transition-all
                          ${prodTab === t.id ? 'text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-5">

                    {/* ── TAB CARGA ── */}
                    {prodTab === 'carga' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                            Cantidad a agregar ({selectedProdItem.unidad})
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCargaQty(v => String(Math.max(0, parseFloat(v||'0') - (selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? 0.5 : 1))))}
                              className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-black text-lg transition-all">−</button>
                            <input
                              type="number" min="0" step={selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '0.5' : '1'}
                              value={cargaQty}
                              onChange={e => setCargaQty(e.target.value)}
                              placeholder="0"
                              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg font-black text-center outline-none focus:border-white/40"
                            />
                            <button onClick={() => setCargaQty(v => String(parseFloat(v||'0') + (selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? 0.5 : 1)))}
                              className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-black text-lg transition-all">+</button>
                            <span className="text-slate-400 text-sm font-bold w-8">{selectedProdItem.unidad}</span>
                          </div>
                          {cargaQty && parseFloat(cargaQty) > 0 && (
                            <p className="text-xs text-slate-500 mt-1.5">
                              Stock actual: <span className="text-white font-bold">{selectedProdItem.cantidad}</span> → nuevo: <span className={`font-black ${cfg.color}`}>{parseFloat((Number(selectedProdItem.cantidad) + parseFloat(cargaQty.replace(',','.'))).toFixed(3))} {selectedProdItem.unidad}</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Motivo</label>
                          <div className="flex flex-wrap gap-2">
                            {['Producción manual', 'Corrección de stock', 'Ingreso externo', 'Sobrante de turno'].map(m => (
                              <button key={m} onClick={() => setCargaMotivo(m)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                                  ${cargaMotivo === m ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleCargarStock}
                          disabled={savingCarga || !cargaQty || parseFloat(cargaQty) <= 0}
                          className={`w-full py-3 rounded-xl font-black text-sm transition-all
                            ${savingCarga || !cargaQty || parseFloat(cargaQty) <= 0
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              : `${cfg.bg} border ${cfg.border} ${cfg.color} hover:opacity-80`}`}>
                          {savingCarga ? 'Guardando...' : `📦 Cargar ${cargaQty || '0'} ${selectedProdItem.unidad}`}
                        </button>

                        {selectedProdItem.ultima_prod && (
                          <p className="text-center text-xs text-slate-600">
                            Última producción: {new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')} a las {new Date(selectedProdItem.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── TAB ALERTA ── */}
                    {prodTab === 'alerta' && <>

                    {/* Estado actual de la alerta */}
                    {tieneAlerta ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xl">🔔</span>
                        <div>
                          <p className="text-amber-400 font-black text-sm">Alerta activa</p>
                          <p className="text-slate-400 text-xs">
                            Avisa cuando quedan menos de <span className="text-white font-bold">{selectedProdItem.alerta_umbral} {selectedProdItem.unidad}</span>
                            {selectedProdItem.alerta_dias > 0 && (
                              <> · con <span className="text-white font-bold">{selectedProdItem.alerta_dias} día{selectedProdItem.alerta_dias !== 1 ? 's' : ''}</span> de anticipación</>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xl">🔕</span>
                        <p className="text-slate-500 text-sm">Sin alerta configurada — completá los campos para activarla</p>
                      </div>
                    )}

                    {/* Campos editables */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                          Avisar cuando quedan menos de ({selectedProdItem.unidad})
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={alertaUmbral}
                            onChange={e => setAlertaUmbral(e.target.value)}
                            placeholder={`ej: ${selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '2' : '10'}`}
                            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500/60"
                          />
                          <span className="text-slate-400 text-sm font-bold">{selectedProdItem.unidad}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">
                          Cuando el stock baje de este número, te mandamos una push
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                          Días de anticipación en el aviso
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="7"
                            step="1"
                            value={alertaDias}
                            onChange={e => setAlertaDias(e.target.value)}
                            placeholder="ej: 1"
                            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500/60"
                          />
                          <span className="text-slate-400 text-sm font-bold">días</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">
                          0 = avisar que producís hoy · 1 = mañana · etc.
                        </p>
                      </div>
                    </div>

                    {/* Ejemplos rápidos */}
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase mb-2">Presets rápidos</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Hoy urgente',  umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '1' : '5',  dias: '0' },
                          { label: '1 día antes',  umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '2' : '10', dias: '1' },
                          { label: '2 días antes', umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '3' : '20', dias: '2' },
                        ].map(p => (
                          <button key={p.label}
                            onClick={() => { setAlertaUmbral(p.umbral); setAlertaDias(p.dias); }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-300 font-bold transition-all">
                            {p.label}
                          </button>
                        ))}
                        {tieneAlerta && (
                          <button
                            onClick={() => { setAlertaUmbral('0'); setAlertaDias('0'); }}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-400 font-bold transition-all">
                            🔕 Desactivar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botón guardar */}
                    <button
                      onClick={handleSaveAlerta}
                      disabled={savingAlerta || (!alertaUmbral && !alertaDias)}
                      className={`w-full py-3 rounded-xl font-black text-sm transition-all
                        ${savingAlerta || (!alertaUmbral && !alertaDias)
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}>
                      {savingAlerta ? 'Guardando...' : '🔔 Guardar alerta'}
                    </button>

                    {selectedProdItem.ultima_prod && (
                      <p className="text-center text-xs text-slate-600">
                        Última producción: {new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')} a las {new Date(selectedProdItem.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    </>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── MODAL HISTORIAL + UMBRALES DE STOCK ── */}
          {selectedStockItem && (() => {
            const itemMovements = movements
              .filter(m => m.nombre === selectedStockItem.nombre)
              .slice(0, 30);

            const handleEditMovement = async () => {
              if (!editingMovement) return;
              setSavingMovement(true);
              const newQty = parseFloat(String(editMovQty).replace(',', '.'));
              const diff = newQty - editingMovement.cantidad;
              // Update movement record
              await supabase.from('stock_movements').update({
                cantidad: newQty,
                motivo: (editMovMotivo.trim() || editingMovement.motivo) + ' [editado]',
              }).eq('id', editingMovement.id);
              // Fix stock quantity
              if (diff !== 0) {
                const stockDiff = editingMovement.tipo === 'ingreso' ? diff : -diff;
                const newStockQty = parseFloat((Number(selectedStockItem.cantidad) + stockDiff).toFixed(3));
                await supabase.from('stock').update({
                  cantidad: newStockQty,
                  fecha_actualizacion: new Date().toISOString().slice(0, 10),
                }).eq('id', selectedStockItem.id);
              }
              setSavingMovement(false);
              setEditingMovement(null);
              await fetchMovements();
            };

            const handleDeleteMovement = async (m: any) => {
              setSavingMovement(true);
              // Revertir el efecto en stock
              const revert = m.tipo === 'ingreso' ? -m.cantidad : m.cantidad;
              const newStockQty = parseFloat((Number(selectedStockItem.cantidad) + revert).toFixed(3));
              await supabase.from('stock').update({
                cantidad: newStockQty,
                fecha_actualizacion: new Date().toISOString().slice(0, 10),
              }).eq('id', selectedStockItem.id);
              await supabase.from('stock_movements').delete().eq('id', m.id);
              setSavingMovement(false);
              setDeleteMovConfirm(null);
              await fetchMovements();
            };

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

            const handleSaveMiAlerta = async () => {
              if (!user) return;
              setSavingMiAlerta(true);
              await supabase.from('user_stock_alertas').upsert({
                user_id:  user.id,
                stock_id: selectedStockItem.id,
                critico:  parseFloat(miCritico) || null,
                medio:    parseFloat(miMedio)   || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,stock_id' });
              setMiAlertaActual({ critico: parseFloat(miCritico)||null, medio: parseFloat(miMedio)||null });
              setSavingMiAlerta(false);
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
                      {selectedStockItem.fecha_vencimiento && (() => {
                        const [d,m,y] = selectedStockItem.fecha_vencimiento.split('/');
                        const vd = y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null;
                        const esVencido = vd ? vd < new Date().toISOString().slice(0,10) : false;
                        return (
                          <p className={`text-xs font-black mt-0.5 ${esVencido ? 'text-orange-400' : 'text-slate-500'}`}>
                            {esVencido ? '⚠️ VENCIDO' : '📅 Vence'}: {selectedStockItem.fecha_vencimiento}
                          </p>
                        );
                      })()}
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

                    {/* TABS INGRESO / EGRESO */}
                    <div className="rounded-2xl overflow-hidden border border-slate-700">
                      {/* Tab selector */}
                      <div className="flex">
                        <button onClick={() => { setModalTab('ingreso'); setModoLatas(false); setLatasCount(''); setLatasPeso(''); }}
                          className={`flex-1 py-3 text-sm font-black transition-all flex items-center justify-center gap-2
                            ${modalTab === 'ingreso' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                          📦 Ingreso / Factura
                        </button>
                        <button onClick={() => setModalTab('egreso')}
                          className={`flex-1 py-3 text-sm font-black transition-all flex items-center justify-center gap-2
                            ${modalTab === 'egreso' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                          📤 Egreso / Uso
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* ── INGRESO ── */}
                        {modalTab === 'ingreso' && (<>
                          {/* Toggle modo latas */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase">Modo de carga</span>
                            <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
                              <button onClick={() => setModoLatas(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${!modoLatas ? 'bg-white text-slate-900' : 'text-slate-400'}`}>
                                Peso directo
                              </button>
                              <button onClick={() => setModoLatas(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${modoLatas ? 'bg-white text-slate-900' : 'text-slate-400'}`}>
                                🥫 Por latas/unidades
                              </button>
                            </div>
                          </div>

                          {/* MODO LATAS */}
                          {modoLatas ? (<>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad de latas/unidades</label>
                                <input type="number" min="1" step="1"
                                  value={latasCount} onChange={e => setLatasCount(e.target.value)}
                                  placeholder="ej: 6"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">
                                  Peso por lata ({selectedStockItem.unidad === 'kg' ? 'gr o kg' : selectedStockItem.unidad})
                                </label>
                                <input type="number" min="0" step="0.001"
                                  value={latasPeso} onChange={e => setLatasPeso(e.target.value)}
                                  placeholder={selectedStockItem.unidad === 'kg' ? 'ej: 750 (gr)' : 'ej: 1'}
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500"
                                />
                              </div>
                            </div>
                            {latasCount && latasPeso && parseFloat(latasCount) > 0 && parseFloat(latasPeso) > 0 && (() => {
                              const n = parseFloat(latasCount);
                              const p = parseFloat(latasPeso);
                              // Si el peso ingresado es > 10 y la unidad es kg, asumir que pusieron gramos
                              const pesoKg = selectedStockItem.unidad === 'kg' && p > 10 ? p / 1000 : p;
                              const total = parseFloat((n * pesoKg).toFixed(3));
                              return (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-slate-400">{n} latas × {p}{selectedStockItem.unidad === 'kg' && p > 10 ? ' gr' : ' ' + selectedStockItem.unidad}</span>
                                    <span className="font-black text-green-400">= {total} {selectedStockItem.unidad}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-green-500/20 pt-1 mt-1">
                                    <span className="text-slate-400">Nuevo stock:</span>
                                    <span className="font-black text-white">{parseFloat((selectedStockItem.cantidad + total).toFixed(3))} {selectedStockItem.unidad}</span>
                                  </div>
                                </div>
                              );
                            })()}
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor (opcional)</label>
                              <input type="text" value={facturaProveedor} onChange={e => setFacturaProveedor(e.target.value)}
                                placeholder="Nombre proveedor"
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                            </div>
                            <button
                              onClick={async () => {
                                const n = parseFloat(latasCount);
                                const p = parseFloat(latasPeso);
                                if (!n || !p || n <= 0 || p <= 0) return;
                                const pesoKg = selectedStockItem.unidad === 'kg' && p > 10 ? p / 1000 : p;
                                const qty = parseFloat((n * pesoKg).toFixed(3));
                                if (savingFacturaRef.current) return;
                                savingFacturaRef.current = true;
                                setSavingFactura(true);
                                const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) + qty).toFixed(3));
                                await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0,10) }).eq('id', selectedStockItem.id);
                                await supabase.from('stock_movements').insert({
                                  stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre,
                                  categoria: selectedStockItem.categoria, tipo: 'ingreso',
                                  cantidad: qty, unidad: selectedStockItem.unidad,
                                  motivo: `Factura${facturaProveedor ? ' - ' + facturaProveedor : ''} (${Math.round(n)} latas × ${p}${selectedStockItem.unidad === 'kg' && p > 10 ? 'gr' : selectedStockItem.unidad})`,
                                  operador: 'Admin', fecha: new Date().toISOString(),
                                });
                                setLatasCount(''); setLatasPeso(''); setFacturaProveedor('');
                                setSavingFactura(false); savingFacturaRef.current = false;
                                await fetchMovements();
                                setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                              }}
                              disabled={savingFactura || !latasCount || !latasPeso || parseFloat(latasCount) <= 0 || parseFloat(latasPeso) <= 0}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                              {savingFactura ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Confirmar ingreso por latas
                            </button>
                          </>) : (<>
                          {/* MODO PESO DIRECTO */}
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad</label>
                                <input type="number" step="0.001" min="0"
                                  value={facturaQty} onChange={e => setFacturaQty(e.target.value)}
                                  placeholder="0.000"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500" />
                              </div>
                              <div className="flex items-end">
                                <span className="text-slate-400 font-bold pb-2.5">{selectedStockItem.unidad}</span>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor (opcional)</label>
                                <input type="text" value={facturaProveedor} onChange={e => setFacturaProveedor(e.target.value)}
                                  placeholder="Nombre proveedor"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500" />
                              </div>
                            </div>
                            {selectedStockItem.cantidad < 0 && facturaQty && parseFloat(facturaQty) > 0 && (
                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm space-y-1">
                                <div className="flex justify-between"><span className="text-slate-400">Stock negativo:</span><span className="font-black text-red-400">{selectedStockItem.cantidad.toFixed(3)} {selectedStockItem.unidad}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Factura ingresa:</span><span className="font-black text-green-400">+{parseFloat(facturaQty).toFixed(3)} {selectedStockItem.unidad}</span></div>
                                <div className="flex justify-between border-t border-amber-500/20 pt-1 mt-1">
                                  <span className="font-black text-slate-300">Stock final:</span>
                                  <span className={`font-black ${selectedStockItem.cantidad + parseFloat(facturaQty) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(selectedStockItem.cantidad + parseFloat(facturaQty)).toFixed(3)} {selectedStockItem.unidad}
                                  </span>
                                </div>
                              </div>
                            )}
                            {/* TRAZABILIDAD */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Lote / Remito</label>
                                <input type="text" value={facturaLote} onChange={e => setFacturaLote(e.target.value)}
                                  placeholder="Ej: R-12345"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Vencimiento</label>
                                <input type="date" value={facturaVence} onChange={e => setFacturaVence(e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Comentario / Faltante</label>
                              <input type="text" value={facturaComentario} onChange={e => setFacturaComentario(e.target.value)}
                                placeholder="Ej: Faltaron 2kg en la entrega..."
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                            </div>
                            <button
                              onClick={async () => {
                                const qty = parseFloat(facturaQty);
                                if (!qty || qty <= 0 || savingFacturaRef.current) return;
                                savingFacturaRef.current = true;
                                setSavingFactura(true);
                                const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) + qty).toFixed(3));
                                await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10), ...(facturaVence ? { fecha_vencimiento: new Date(facturaVence).toLocaleDateString('es-AR') } : {}) }).eq('id', selectedStockItem.id);
                                await supabase.from('stock_movements').insert({
                                  stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre,
                                  categoria: selectedStockItem.categoria, tipo: 'ingreso',
                                  cantidad: qty, unidad: selectedStockItem.unidad,
                                  motivo: ['Factura', facturaProveedor, facturaLote, facturaComentario].filter(Boolean).join(' - '),
                                  operador: 'Admin', fecha: new Date().toISOString(),
                                });
                                setFacturaQty(''); setFacturaProveedor(''); setFacturaLote(''); setFacturaComentario(''); setFacturaVence('');
                                setSavingFactura(false); savingFacturaRef.current = false;
                                await fetchMovements();
                                setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                              }}
                              disabled={!facturaQty || parseFloat(facturaQty) <= 0 || savingFactura}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                              {savingFactura ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Confirmar ingreso
                            </button>
                          </>)}
                        </>)}

                        {/* ── EGRESO ── */}
                        {modalTab === 'egreso' && (<>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad a descontar</label>
                            <div className="flex gap-2 items-center">
                              <input type="number" step="0.001" min="0"
                                value={egresoQty} onChange={e => setEgresoQty(e.target.value)}
                                placeholder="0.000"
                                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-red-500" />
                              <span className="text-slate-400 font-bold">{selectedStockItem.unidad}</span>
                            </div>
                            {egresoQty && parseFloat(egresoQty) > 0 && (
                              <p className="text-xs text-slate-500 mt-1.5">
                                Stock actual: <span className="text-white font-bold">{selectedStockItem.cantidad} {selectedStockItem.unidad}</span>
                                {' → '}
                                <span className={`font-black ${selectedStockItem.cantidad - parseFloat(egresoQty) < 0 ? 'text-red-400' : 'text-white'}`}>
                                  {parseFloat((selectedStockItem.cantidad - parseFloat(egresoQty)).toFixed(3))} {selectedStockItem.unidad}
                                </span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] text-red-400 uppercase font-bold mb-1 block">
                              Motivo / Comentario <span className="text-red-500">*</span> (obligatorio)
                            </label>
                            <input type="text"
                              value={egresoComentario} onChange={e => setEgresoComentario(e.target.value)}
                              placeholder="ej: Uso en servicio, merma, corrección..."
                              className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors
                                ${!egresoComentario.trim() && egresoQty ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'}`} />
                            {!egresoComentario.trim() && egresoQty && (
                              <p className="text-xs text-red-400 mt-1">⚠️ El comentario es obligatorio para registrar un egreso</p>
                            )}
                          </div>

                          {/* Presets rápidos */}
                          <div className="flex flex-wrap gap-2">
                            {['Uso en servicio', 'Merma / vencimiento', 'Corrección de stock', 'Rotura / accidente'].map(m => (
                              <button key={m} onClick={() => setEgresoComentario(m)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                                  ${egresoComentario === m ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                {m}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={async () => {
                              const qty = parseFloat(egresoQty);
                              if (!qty || qty <= 0 || !egresoComentario.trim() || savingEgresoRef.current) return;
                              savingEgresoRef.current = true;
                              setSavingEgreso(true);
                              const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) - qty).toFixed(3));
                              await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10), ...(facturaVence ? { fecha_vencimiento: new Date(facturaVence).toLocaleDateString('es-AR') } : {}) }).eq('id', selectedStockItem.id);
                              await supabase.from('stock_movements').insert({
                                stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre,
                                categoria: selectedStockItem.categoria, tipo: 'egreso',
                                cantidad: qty, unidad: selectedStockItem.unidad,
                                motivo: egresoComentario.trim(),
                                operador: 'Admin', fecha: new Date().toISOString(),
                              });
                              setEgresoQty(''); setEgresoComentario('');
                              setSavingEgreso(false); savingEgresoRef.current = false;
                              await fetchMovements();
                              setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                            }}
                            disabled={!egresoQty || parseFloat(egresoQty) <= 0 || !egresoComentario.trim() || savingEgreso}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                            {savingEgreso ? <RefreshCw size={14} className="animate-spin" /> : '📤'} Confirmar egreso
                          </button>
                        </>)}
                      </div>
                    </div>

                    {/* ── MIS ALERTAS PERSONALES ── */}
                    <div className="border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-400 uppercase">🔔 Mis alertas personales</p>
                        {miAlertaActual && (miAlertaActual.critico || miAlertaActual.medio) && (
                          <span className="text-[10px] text-amber-400 font-black bg-amber-500/10 px-2 py-0.5 rounded-full">ACTIVA</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Umbrales propios — solo vos recibís estas notificaciones</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {[
                          { label: '🚨 Crítico personal', val: miCritico, set: setMiCritico, color: 'focus:border-red-500' },
                          { label: '⚠️ Medio personal',   val: miMedio,   set: setMiMedio,   color: 'focus:border-amber-500' },
                        ].map(({ label, val, set, color }) => (
                          <div key={label}>
                            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">{label}</label>
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" step="0.5" value={val}
                                onChange={e => set(e.target.value)}
                                placeholder="—"
                                className={`flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none ${color}`} />
                              <span className="text-slate-500 text-xs">{selectedStockItem.unidad}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveMiAlerta}
                          disabled={savingMiAlerta || (!miCritico && !miMedio)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all
                            ${savingMiAlerta || (!miCritico && !miMedio)
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}>
                          {savingMiAlerta ? 'Guardando...' : '🔔 Guardar mis alertas'}
                        </button>
                        {(miAlertaActual?.critico || miAlertaActual?.medio) && (
                          <button onClick={async () => {
                            if (!user) return;
                            await supabase.from('user_stock_alertas').delete()
                              .eq('user_id', user.id).eq('stock_id', selectedStockItem.id);
                            setMiCritico(''); setMiMedio(''); setMiAlertaActual(null);
                          }} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                            🔕 Quitar
                          </button>
                        )}
                      </div>
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
                              <th className="px-4 py-2.5 text-center w-16"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {itemMovements.map(m => (
                              <tr key={m.id} className="hover:bg-slate-800/40">
                                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {m.tipo}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 text-xs truncate max-w-[120px]">{m.motivo ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right font-black text-white">
                                  {m.tipo === 'egreso' ? '-' : '+'}{m.cantidad} {m.unidad}
                                </td>
                                <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                  <div className="flex gap-1 justify-center">
                                    <button onClick={() => { setEditingMovement(m); setEditMovQty(String(m.cantidad)); setEditMovMotivo(m.motivo ?? ''); }}
                                      className="px-2 py-1 bg-slate-700 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white text-xs font-bold transition-all" title="Editar">
                                      ✏️
                                    </button>
                                    <button onClick={() => setDeleteMovConfirm(m)}
                                      className="px-2 py-1 bg-slate-700 hover:bg-red-600 rounded-lg text-slate-400 hover:text-white transition-all" title="Eliminar y revertir">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
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

      {showEntryModal && (
        <StockEntryModal onClose={() => { setShowEntryModal(false); setSelectedStockItem(null); fetchMovements(); }} />
      )}
    </div>
  );
}