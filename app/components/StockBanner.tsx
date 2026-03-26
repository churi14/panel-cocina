"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

type StockItem = {
  id: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  unidad: string;
};

const CAT_EMOJI: Record<string, string> = {
  CARNES: '🥩', VERDURA: '🥗', FIAMBRE: '🧀', SECOS: '🧂',
  BEBIDAS: '🥤', LIMPIEZA: '🧴', BROLAS: '🍫', DESCARTABLES: '📦',
};

// Umbral de stock bajo por categoría
const LOW_THRESHOLD: Record<string, number> = {
  CARNES: 5, VERDURA: 3, FIAMBRE: 3, SECOS: 2,
  BEBIDAS: 6, LIMPIEZA: 1, BROLAS: 3, DESCARTABLES: 10,
};

export default function StockBanner() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock')
      .select('id, nombre, categoria, cantidad, unidad')
      .order('categoria');
    
    const alerts = (data ?? []).filter(item =>
      item.cantidad === 0 || item.cantidad <= (LOW_THRESHOLD[item.categoria] ?? 2)
    );
    setItems(alerts);
    setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);

    // Suscripción real-time
    const channel = supabase
      .channel('stock_banner')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock' }, fetchAlerts)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const sinStock = items.filter(i => i.cantidad === 0);
  const stockBajo = items.filter(i => i.cantidad > 0);

  if (loading) return null;
  if (items.length === 0) {
    return (
      <div className="bg-slate-900 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-400 text-xs font-bold">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          Stock OK — {lastUpdate}
        </div>
        <button onClick={fetchAlerts} className="text-slate-600 hover:text-slate-400 transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border-b border-slate-800">
      {/* Barra resumen — siempre visible */}
      <div className="px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {sinStock.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-black">{sinStock.length} SIN STOCK</span>
            </div>
          )}
          {stockBajo.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-amber-400 text-xs font-black">{stockBajo.length} STOCK BAJO</span>
            </div>
          )}
          {/* Preview de los primeros items */}
          {!expanded && (
            <div className="flex items-center gap-2 overflow-hidden">
              {items.slice(0, 4).map(item => (
                <span key={item.id}
                  className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap
                    ${item.cantidad === 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {CAT_EMOJI[item.categoria]} {item.nombre}
                </span>
              ))}
              {items.length > 4 && (
                <span className="text-slate-500 text-xs font-bold">+{items.length - 4} más</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-slate-600 text-xs">{lastUpdate}</span>
          <button onClick={fetchAlerts} className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-bold transition-colors">
            {expanded ? <><ChevronUp size={14} /> Cerrar</> : <><ChevronDown size={14} /> Ver todos</>}
          </button>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="px-6 pb-4 border-t border-slate-800 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {sinStock.length > 0 && (
              <>
                <div className="col-span-full text-xs font-black text-red-400 uppercase mb-1">Sin Stock</div>
                {sinStock.map(item => (
                  <div key={item.id} className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <TrendingDown size={14} className="text-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs truncate">{item.nombre}</p>
                      <p className="text-red-400 text-xs font-black">SIN STOCK</p>
                    </div>
                  </div>
                ))}
              </>
            )}
            {stockBajo.length > 0 && (
              <>
                <div className="col-span-full text-xs font-black text-amber-400 uppercase mt-2 mb-1">Stock Bajo</div>
                {stockBajo.map(item => (
                  <div key={item.id} className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-bold text-xs truncate">{item.nombre}</p>
                      <p className="text-amber-400 text-xs font-bold">{item.cantidad} {item.unidad}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}