"use client";

import React, { useState, useEffect } from 'react';
import { X, Search, RefreshCw, TrendingDown, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';

type StockItem = {
  id: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
  fecha_vencimiento: string | null;
};

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  CARNES:        { emoji: '🥩', color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  VERDURA:       { emoji: '🥗', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  FIAMBRE:       { emoji: '🧀', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  SECOS:         { emoji: '🧂', color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  BEBIDAS:       { emoji: '🥤', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  LIMPIEZA:      { emoji: '🧴', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  BROLAS:        { emoji: '🍫', color: 'text-pink-700',   bg: 'bg-pink-50',   border: 'border-pink-200' },
  DESCARTABLES:  { emoji: '📦', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

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

export default function StockViewModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('categoria')
        .order('nombre');
      if (error) throw error;
      setItems(data ?? []);
      setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) {
      setError('No se pudo conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStock(); }, []);

  const categories = [...new Set(items.map(i => i.categoria))].sort();

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

  const alertCount = items.filter(i => isLow(i.cantidad, i.categoria) || isExpiringSoon(i.fecha_vencimiento)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              📦 Stock Actual
            </h2>
            <p className="text-xs text-slate-400">
              {items.length} productos · actualizado {lastUpdate}
              {alertCount > 0 && (
                <span className="ml-2 text-amber-600 font-bold">· ⚠️ {alertCount} alertas</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchStock} className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all text-sm font-bold">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="px-8 py-4 border-b border-slate-100 flex items-center gap-4 shrink-0 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!selectedCat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              TODOS
            </button>
            {categories.map(cat => {
              const cfg = CATEGORY_CONFIG[cat] ?? { emoji: '📦', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1
                    ${selectedCat === cat ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cfg.emoji} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw size={40} className="text-slate-300 animate-spin mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Cargando stock...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
                <p className="text-red-500 font-bold mb-2">Error de conexión</p>
                <p className="text-slate-400 text-sm mb-4">{error}</p>
                <button onClick={fetchStock} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm">
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-6">
              {Object.entries(grouped).map(([cat, catItems]) => {
                const cfg = CATEGORY_CONFIG[cat] ?? { emoji: '📦', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
                const totalKg = catItems.filter(i => i.unidad === 'kg').reduce((s, i) => s + i.cantidad, 0);
                return (
                  <div key={cat}>
                    {/* Encabezado categoría */}
                    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 ${cfg.bg} border ${cfg.border}`}>
                      <span className={`font-black text-sm uppercase flex items-center gap-2 ${cfg.color}`}>
                        {cfg.emoji} {cat}
                      </span>
                      <div className="flex items-center gap-3">
                        {totalKg > 0 && (
                          <span className={`text-xs font-bold ${cfg.color} opacity-70`}>
                            Total: {totalKg.toFixed(2).replace('.', ',')} kg
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-400">{catItems.length} items</span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {catItems.map(item => {
                        const low = isLow(item.cantidad, item.categoria);
                        const expiring = isExpiringSoon(item.fecha_vencimiento);
                        const zero = item.cantidad === 0;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border-2 p-4 transition-all
                              ${zero ? 'border-red-200 bg-red-50' :
                                low ? 'border-amber-200 bg-amber-50' :
                                expiring ? 'border-amber-200 bg-amber-50' :
                                `${cfg.border} bg-white`}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="font-bold text-slate-800 text-sm leading-tight">{item.nombre}</p>
                              {(low || zero) && <TrendingDown size={14} className={zero ? 'text-red-500 shrink-0 ml-1' : 'text-amber-500 shrink-0 ml-1'} />}
                              {expiring && !zero && <AlertTriangle size={14} className="text-amber-500 shrink-0 ml-1" />}
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
                <div className="text-center py-16">
                  <p className="text-slate-400 text-lg font-medium">No se encontraron productos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}