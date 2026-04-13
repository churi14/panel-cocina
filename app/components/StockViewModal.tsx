"use client";

import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, TrendingDown, AlertTriangle, Edit2, Check, Plus, Minus } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

type StockItem = {
  id: number; nombre: string; categoria: string;
  cantidad: number; unidad: string; fecha_vencimiento: string | null;
};

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  CARNES:       { emoji: '🥩', color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  VERDURA:      { emoji: '🥗', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  FIAMBRE:      { emoji: '🧀', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  SECOS:        { emoji: '🧂', color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  BEBIDAS:      { emoji: '🥤', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  LIMPIEZA:     { emoji: '🧴', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  BROLAS:       { emoji: '🍫', color: 'text-pink-700',   bg: 'bg-pink-50',   border: 'border-pink-200' },
  DESCARTABLES: { emoji: '📦', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const PROD_CONFIG: Record<string, { emoji: string; border: string; bg: string; text: string }> = {
  lomito:   { emoji: '🥩', border: 'border-rose-200',   bg: 'bg-rose-50',    text: 'text-rose-700'   },
  burger:   { emoji: '🍔', border: 'border-blue-200',   bg: 'bg-blue-50',    text: 'text-blue-700'   },
  milanesa: { emoji: '🥪', border: 'border-amber-200',  bg: 'bg-amber-50',   text: 'text-amber-700'  },
  verdura:  { emoji: '🥦', border: 'border-green-200',  bg: 'bg-green-50',   text: 'text-green-700'  },
  fiambre:  { emoji: '🧀', border: 'border-yellow-200', bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  pan:      { emoji: '🍞', border: 'border-orange-200', bg: 'bg-orange-50',  text: 'text-orange-700' },
  salsa:    { emoji: '🫙', border: 'border-purple-200', bg: 'bg-purple-50',  text: 'text-purple-700' },
  dip:      { emoji: '🥄', border: 'border-pink-200',   bg: 'bg-pink-50',    text: 'text-pink-700'   },
  caja:     { emoji: '📦', border: 'border-slate-200',  bg: 'bg-slate-50',   text: 'text-slate-700'  },
};
const DEFAULT_PROD_CFG = { emoji: '📋', border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700' };

function formatQty(qty: number, unit: string): string {
  if (qty === 0) return '—';
  const n = qty % 1 === 0 ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
  return `${n} ${unit}`;
}

function isLow(qty: number, cat: string): boolean {
  if (qty === 0) return true;
  if (cat === 'CARNES' && qty < 5) return true;
  if (cat === 'VERDURA' && qty < 3) return true;
  return false;
}

function isExpiringSoon(fecha: string | null): boolean {
  if (!fecha) return false;
  try {
    const d = new Date(fecha);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  } catch { return false; }
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
type EditTarget = {
  id: number; nombre: string; cantidad: number; unidad: string;
  tabla: 'stock' | 'stock_produccion'; nombreCampo: 'nombre' | 'producto';
};

function EditModal({ item, onClose, onSaved, operador }: {
  item: EditTarget; onClose: () => void; onSaved: () => void; operador: string;
}) {
  const [modo, setModo]       = useState<'agregar' | 'reemplazar'>('agregar');
  const [valor, setValor]     = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving]   = useState(false);

  const step = item.unidad === 'kg' || item.unidad === 'lt' ? 0.5 : 1;
  const valorNum = parseFloat(valor.replace(',', '.')) || 0;
  const nuevaCantidad = modo === 'agregar'
    ? parseFloat((item.cantidad + valorNum).toFixed(3))
    : valorNum;

  const canSave = valorNum > 0 && comentario.trim().length >= 3;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Update stock
      if (item.tabla === 'stock') {
        await supabase.from('stock').update({
          cantidad: nuevaCantidad,
          fecha_actualizacion: new Date().toISOString().slice(0, 10),
        }).eq('id', item.id);
        // Log movement
        await supabase.from('stock_movements').insert({
          nombre: item.nombre,
          categoria: '',
          tipo: modo === 'agregar' ? 'ingreso' : 'ajuste',
          cantidad: valorNum,
          unidad: item.unidad,
          motivo: comentario.trim(),
          operador,
          fecha: new Date().toISOString(),
        });
      } else {
        await supabase.from('stock_produccion').update({
          cantidad: nuevaCantidad,
          ultima_prod: new Date().toISOString(),
        }).eq('id', item.id);
        await supabase.from('stock_movements').insert({
          nombre: item.nombre,
          categoria: 'produccion',
          tipo: modo === 'agregar' ? 'ingreso' : 'ajuste',
          cantidad: valorNum,
          unidad: item.unidad,
          motivo: comentario.trim(),
          operador,
          fecha: new Date().toISOString(),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">Editar stock</p>
            <h3 className="font-black text-slate-800 text-lg leading-tight">{item.nombre}</h3>
            <p className="text-sm text-slate-500">
              Stock actual: <span className="font-black">{item.cantidad} {item.unidad}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Modo */}
        <div className="flex gap-2">
          {([
            { id: 'agregar', label: '➕ Agregar' },
            { id: 'reemplazar', label: '✏️ Reemplazar' },
          ] as const).map(m => (
            <button key={m.id} onClick={() => { setModo(m.id); setValor(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all border
                ${modo === m.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Valor */}
        <div>
          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
            {modo === 'agregar' ? `Cantidad a agregar (${item.unidad})` : `Nuevo valor (${item.unidad})`}
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => setValor(v => String(Math.max(0, parseFloat(v||'0') - step)))}
              className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-lg transition-all">
              <Minus size={16} className="mx-auto" />
            </button>
            <input type="number" step={step} min="0" value={valor}
              onChange={e => setValor(e.target.value)} placeholder="0"
              className="flex-1 px-3 py-2.5 border-2 border-slate-200 rounded-xl text-2xl font-black text-center outline-none focus:border-slate-900" />
            <button onClick={() => setValor(v => String(parseFloat(v||'0') + step))}
              className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-xl font-black text-lg transition-all">
              <Plus size={16} className="mx-auto" />
            </button>
          </div>
          {valorNum > 0 && (
            <p className="text-xs text-slate-400 mt-1.5 text-center">
              {modo === 'agregar'
                ? <>Stock nuevo: <span className="font-black text-green-600">{nuevaCantidad} {item.unidad}</span></>
                : <>Reemplaza {item.cantidad} → <span className="font-black text-blue-600">{nuevaCantidad} {item.unidad}</span></>}
            </p>
          )}
        </div>

        {/* Comentario OBLIGATORIO */}
        <div>
          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
            ¿Por qué? <span className="text-red-500">*obligatorio</span>
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {['Llegó mercadería', 'Corrección de inventario', 'Error de carga', 'Sobrante de turno', 'Ajuste manual'].map(s => (
              <button key={s} onClick={() => setComentario(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all
                  ${comentario === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            placeholder="Escribí un motivo..."
            rows={2}
            className="w-full px-3 py-2 border-2 rounded-xl text-sm outline-none resize-none border-slate-200 focus:border-slate-900" />
        </div>

        {/* Guardar */}
        <button onClick={handleSave} disabled={!canSave || saving}
          className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2
            ${canSave && !saving ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? 'Guardando...' : 'Guardar cambio'}
        </button>
      </div>
    </div>
  );
}

export default function StockViewModal({ onClose, operadorNombre }: { onClose: () => void; operadorNombre?: string }) {
  const { perfil } = useAuth();
  const operador = operadorNombre ?? perfil?.nombre ?? 'Operador';

  const [activeTab, setActiveTab] = useState<'materiales' | 'produccion'>('materiales');
  const [items, setItems] = useState<StockItem[]>([]);
  const [stockProd, setStockProd] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [editItem, setEditItem] = useState<EditTarget | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: mat, error: e1 }, { data: prod }] = await Promise.all([
        supabase.from('stock').select('*').order('categoria').order('nombre'),
        supabase.from('stock_produccion').select('*').order('categoria').order('producto'),
      ]);
      if (e1) throw e1;
      setItems(mat ?? []);
      setStockProd(prod ?? []);
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) {
      setError('No se pudo conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const categories = [...new Set(items.map(i => i.categoria))].sort();
  const alertCount = items.filter(i => isLow(i.cantidad, i.categoria) || isExpiringSoon(i.fecha_vencimiento)).length;

  const filtered = items.filter(item => {
    const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCat || item.categoria === selectedCat;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">📦 Stock</h2>
            <p className="text-xs text-slate-400">
              {items.length} materiales · {stockProd.length} producción · {lastUpdate}
              {alertCount > 0 && <span className="ml-2 text-amber-600 font-bold">· ⚠️ {alertCount} alertas</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-bold">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full"><X size={24} className="text-slate-400" /></button>
          </div>
        </div>

        {/* TABS */}
        <div className="px-8 flex gap-1 border-b border-slate-100 shrink-0">
          {[
            { id: 'materiales', label: '📦 Materiales' },
            { id: 'produccion', label: '🍔 Producción' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all
                ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB MATERIALES ── */}
        {activeTab === 'materiales' && (
          <>
            <div className="px-8 py-4 border-b border-slate-100 flex items-center gap-4 shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar producto..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSelectedCat(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!selectedCat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  TODOS
                </button>
                {categories.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat] ?? { emoji: '📦', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
                  return (
                    <button key={cat} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1
                        ${selectedCat === cat ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {cfg.emoji} {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading && <div className="flex items-center justify-center h-full"><RefreshCw size={40} className="text-slate-300 animate-spin mx-auto mb-4" /></div>}
              {error && (
                <div className="text-center py-16 text-red-500">
                  <AlertTriangle size={40} className="mx-auto mb-4" />
                  <p className="font-bold">{error}</p>
                  <button onClick={fetchAll} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm">Reintentar</button>
                </div>
              )}
              {!loading && !error && (
                <div className="space-y-6">
                  {Object.entries(grouped).map(([cat, catItems]) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? { emoji: '📦', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
                    const totalKg = catItems.filter(i => i.unidad === 'kg').reduce((s, i) => s + i.cantidad, 0);
                    return (
                      <div key={cat}>
                        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 ${cfg.bg} border ${cfg.border}`}>
                          <span className={`font-black text-sm uppercase flex items-center gap-2 ${cfg.color}`}>{cfg.emoji} {cat}</span>
                          <div className="flex items-center gap-3">
                            {totalKg > 0 && <span className={`text-xs font-bold ${cfg.color} opacity-70`}>Total: {totalKg.toFixed(2).replace('.', ',')} kg</span>}
                            <span className="text-xs font-bold text-slate-400">{catItems.length} items</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {catItems.map(item => {
                            const low = isLow(item.cantidad, item.categoria);
                            const expiring = isExpiringSoon(item.fecha_vencimiento);
                            const zero = item.cantidad === 0;
                            return (
                              <div key={item.id}
                                onClick={() => setEditItem({ id: item.id, nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad, tabla: 'stock', nombreCampo: 'nombre' })}
                                className={`rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md active:scale-95 transition-all relative group
                                  ${zero ? 'border-red-200 bg-red-50' : low ? 'border-amber-200 bg-amber-50' : expiring ? 'border-amber-200 bg-amber-50' : `${cfg.border} bg-white`}`}>
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-bold text-slate-800 text-sm leading-tight">{item.nombre}</p>
                                  <div className="flex items-center gap-1 shrink-0 ml-1">
                                    {(low || zero) && <TrendingDown size={14} className={zero ? 'text-red-500' : 'text-amber-500'} />}
                                    {expiring && !zero && <AlertTriangle size={14} className="text-amber-500" />}
                                    <Edit2 size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                                  </div>
                                </div>
                                <p className={`text-2xl font-black ${zero ? 'text-red-500' : low ? 'text-amber-600' : cfg.color}`}>
                                  {formatQty(item.cantidad, item.unidad)}
                                </p>
                                {item.fecha_vencimiento && (
                                  <p className={`text-xs mt-1 font-medium ${expiring ? 'text-amber-600' : 'text-slate-400'}`}>
                                    Vence: {item.fecha_vencimiento}
                                  </p>
                                )}
                                {zero && <p className="text-xs text-red-500 font-bold mt-1">SIN STOCK</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(grouped).length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                      <p className="text-lg font-medium">No se encontraron productos</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB PRODUCCIÓN ── */}
        {activeTab === 'produccion' && (
          <div className="flex-1 overflow-y-auto p-6">
            {(() => {
              const prodCats = [...new Set(stockProd.map((s: any) => s.categoria as string))].sort();
              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    {prodCats.map(cat => {
                      const catItems = stockProd.filter((s: any) => s.categoria === cat);
                      const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                      const cfg = PROD_CONFIG[cat] ?? DEFAULT_PROD_CFG;
                      const units = [...new Set(catItems.map((s: any) => s.unidad as string))];
                      const unit = units.length === 1 ? units[0] : 'u';
                      return (
                        <div key={cat} className={`rounded-2xl border-2 p-4 ${cfg.bg} ${cfg.border}`}>
                          <p className={`text-xs font-black uppercase mb-1 ${cfg.text}`}>{cfg.emoji} {cat}</p>
                          <p className={`text-3xl font-black ${cfg.text}`}>
                            {total % 1 === 0 ? total : total.toFixed(2).replace('.', ',')}
                            <span className="text-sm font-bold opacity-60 ml-1">{unit}</span>
                          </p>
                          <p className={`text-xs mt-1 ${cfg.text} opacity-60`}>{catItems.length} productos</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-6">
                    {prodCats.map(cat => {
                      const catItems = stockProd.filter((s: any) => s.categoria === cat);
                      if (catItems.length === 0) return null;
                      const cfg = PROD_CONFIG[cat] ?? DEFAULT_PROD_CFG;
                      return (
                        <div key={cat}>
                          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 border ${cfg.border} ${cfg.bg}`}>
                            <span className={`font-black text-sm uppercase ${cfg.text}`}>{cfg.emoji} {cat}</span>
                            <span className="text-xs text-slate-400">{catItems.length} items</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {catItems.map((item: any) => (
                              <div key={item.id}
                                onClick={() => setEditItem({ id: item.id, nombre: item.producto, cantidad: item.cantidad, unidad: item.unidad, tabla: 'stock_produccion', nombreCampo: 'producto' })}
                                className={`rounded-2xl border-2 p-4 bg-white cursor-pointer hover:shadow-md active:scale-95 transition-all relative group ${cfg.border}`}>
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-bold text-slate-800 text-sm leading-tight">{item.producto}</p>
                                  <Edit2 size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 ml-1" />
                                </div>
                                <p className={`text-2xl font-black ${item.cantidad === 0 ? 'text-slate-400' : cfg.text}`}>
                                  {item.unidad === 'kg' || item.unidad === 'lt'
                                    ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                    : item.cantidad}
                                  <span className="text-sm font-bold opacity-60 ml-1">{item.unidad}</span>
                                </p>
                                {item.cantidad === 0 && <p className="text-[10px] text-slate-400 font-black mt-1">SIN STOCK</p>}
                                {item.ultima_prod && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {stockProd.length === 0 && (
                      <div className="text-center py-16 text-slate-400">
                        <p className="text-4xl mb-4">🍔</p>
                        <p className="font-bold text-lg">No hay stock de producción todavía</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

      </div>

      {/* Edit Modal */}
      {editItem && (
        <EditModal
          item={editItem}
          operador={operador}
          onClose={() => setEditItem(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}