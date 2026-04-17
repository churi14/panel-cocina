"use client";
import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

type Props = {
  stockProd: any[];
  produccionEventos: any[];
  fetchMovements: () => Promise<void>;
};

const CAT_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string; bar: string }> = {
  lomito:   { emoji: '🥩', color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   headerBg: 'bg-rose-500/20',   bar: 'bg-rose-500'   },
  burger:   { emoji: '🍔', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   headerBg: 'bg-blue-500/20',   bar: 'bg-blue-500'   },
  milanesa: { emoji: '🥪', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  headerBg: 'bg-amber-500/20',  bar: 'bg-amber-500'  },
  verdura:  { emoji: '🥦', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  headerBg: 'bg-green-500/20',  bar: 'bg-green-500'  },
  fiambre:  { emoji: '🧀', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/20', bar: 'bg-yellow-500' },
  pan:      { emoji: '🍞', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', headerBg: 'bg-orange-500/20', bar: 'bg-orange-500' },
  salsa:    { emoji: '🫙', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', headerBg: 'bg-purple-500/20', bar: 'bg-purple-500' },
  dip:      { emoji: '🥄', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   headerBg: 'bg-pink-500/20',   bar: 'bg-pink-500'   },
  caja:     { emoji: '📦', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  headerBg: 'bg-slate-500/20',  bar: 'bg-slate-500'  },
};
const DEFAULT_CFG = { emoji: '📋', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', headerBg: 'bg-slate-500/20', bar: 'bg-slate-500' };

// Orden preferido de categorías
const CAT_ORDER = ['lomito', 'burger', 'milanesa', 'pan', 'salsa', 'dip', 'verdura', 'fiambre', 'caja'];

export default function TabProduccion({ stockProd, produccionEventos, fetchMovements }: Props) {
  const [selectedProdItem, setSelectedProdItem] = useState<any | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  // Todas las categorías presentes, en orden preferido
  const allCats = [
    ...CAT_ORDER.filter(c => stockProd.some((s: any) => s.categoria === c)),
    ...[...new Set(stockProd.map((s: any) => s.categoria as string))].filter(c => !CAT_ORDER.includes(c)).sort(),
  ];

  const visibleCats = filterCat ? [filterCat] : allCats;

  const formatQty = (item: any) => {
    const n = item.cantidad;
    if (item.unidad === 'kg' || item.unidad === 'lt') {
      return n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
    }
    return n % 1 === 0 ? Math.round(n).toString() : n.toFixed(1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Filtro por categoría */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
            ${!filterCat ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
          TODAS
        </button>
        {allCats.map(cat => {
          const cfg = CAT_CFG[cat] ?? DEFAULT_CFG;
          return (
            <button key={cat} onClick={() => setFilterCat(filterCat === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all
                ${filterCat === cat ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {cfg.emoji} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Totales rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {allCats.map(cat => {
          const cfg = CAT_CFG[cat] ?? DEFAULT_CFG;
          const catItems = stockProd.filter((s: any) => s.categoria === cat);
          const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
          const units = [...new Set(catItems.map((s: any) => s.unidad as string))];
          const unit = units.length === 1 ? units[0] : 'u';
          return (
            <div key={cat} onClick={() => setFilterCat(filterCat === cat ? null : cat)}
              className={`rounded-2xl border-2 p-4 cursor-pointer transition-all hover:opacity-80
                ${filterCat === cat ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-offset-slate-950` : `${cfg.bg} ${cfg.border}`}`}>
              <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
              <p className={`text-3xl font-black ${cfg.color}`}>
                {unit === 'kg' || unit === 'lt'
                  ? total.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
                  : Math.round(total)}
                <span className="text-sm font-bold opacity-60 ml-1">{unit}</span>
              </p>
              <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
            </div>
          );
        })}
      </div>

      {/* Detalle por categoría */}
      {visibleCats.map(cat => {
        const cfg = CAT_CFG[cat] ?? DEFAULT_CFG;
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
                  <p className={`text-2xl font-black ${item.cantidad === 0 ? 'text-slate-600' : cfg.color}`}>
                    {formatQty(item)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                  {item.cantidad === 0 && <p className="text-[10px] text-slate-600 font-black mt-1">SIN STOCK</p>}
                  {item.ultima_prod && (
                    <p className="text-xs text-slate-600 mt-2">
                      {new Date(item.ultima_prod).toLocaleDateString("es-AR")} {new Date(item.ultima_prod).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
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

      {/* ── MODAL HISTORIAL POR ITEM ── */}
      {selectedProdItem && (() => {
        const cat = selectedProdItem.categoria as string;
        const cfg = CAT_CFG[cat] ?? DEFAULT_CFG;
        const isKg = selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt';

        const TIPO_LABELS: Record<string, { label: string; color: string }> = {
          inicio_paso1:  { label: '▶ Inicio P1',  color: 'bg-blue-500/20 text-blue-300' },
          fin_paso2:     { label: '✓ Fin P2',     color: 'bg-green-500/20 text-green-300' },
          inicio_cocina: { label: '🍳 Inicio',    color: 'bg-amber-500/20 text-amber-300' },
          fin_cocina:    { label: '✓ Fin',        color: 'bg-green-500/20 text-green-300' },
        };

        // Buscar eventos para este producto (por nombre o por categoría)
        const prodNombre = selectedProdItem.producto?.toLowerCase() ?? '';
        const eventos = produccionEventos.filter(e =>
          (e.corte?.toLowerCase().includes(prodNombre) ||
           e.kind === cat ||
           e.detalle?.toLowerCase().includes(prodNombre))
          && (e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina')
        ).slice(0, 60);

        // Agrupar por día
        const porDia: Record<string, number> = {};
        eventos.forEach(e => {
          const dia = e.fecha?.slice(0, 10) ?? '';
          if (!dia) return;
          porDia[dia] = (porDia[dia] ?? 0) + (e.peso_kg ?? 0);
        });
        const diasOrdenados = Object.entries(porDia).sort((a, b) => a[0].localeCompare(b[0]));
        const maxKg = Math.max(...diasOrdenados.map(([, v]) => v), 1);

        const totalKgIn = eventos.reduce((s, e) => s + (e.peso_kg ?? 0), 0);
        // Parse quantity from detalle: "Finalizo paso 2 - 60 unid de Lomo - op"
        const totalUnidOut = eventos.reduce((s, e) => {
          const m = (e.detalle ?? '').match(/Finalizo paso 2 - (\d+(?:\.\d+)?)\s*(unid|u|kg)/i);
          return s + (m ? parseFloat(m[1]) : 0);
        }, 0);
        const outUnit = eventos.some(e => /unid|u/.test(e.detalle ?? '')) ? 'u' : selectedProdItem.unidad;
        const promDiario = diasOrdenados.length > 0 ? (totalKgIn / diasOrdenados.length).toFixed(1) : '—';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelectedProdItem(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>

              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cfg.emoji}</span>
                  <div>
                    <h2 className={`font-black text-xl ${cfg.color}`}>{selectedProdItem.producto}</h2>
                    <p className="text-slate-400 text-xs">
                      Stock actual: <span className="font-black text-white">
                        {isKg ? selectedProdItem.cantidad.toFixed(2) : Math.round(selectedProdItem.cantidad)} {selectedProdItem.unidad}
                      </span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedProdItem(null)} className="p-2 hover:bg-slate-800 rounded-xl">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Kg procesados (entrada)', value: `${totalKgIn.toFixed(1)} kg` },
                    { label: totalUnidOut > 0 ? 'Unidades producidas (salida)' : 'Total producido', value: totalUnidOut > 0 ? `${Math.round(totalUnidOut)} ${outUnit}` : `${totalKgIn.toFixed(1)} ${selectedProdItem.unidad}` },
                    { label: 'Producciones',    value: `${eventos.length}` },
                    { label: 'Prom. kg/día',    value: `${promDiario} kg` },
                  ].map((k, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-3 text-center">
                      <p className={`text-xl font-black ${cfg.color}`}>{k.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>

                {diasOrdenados.length > 0 && (
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs font-black text-slate-400 uppercase mb-3">Producción por día</p>
                    <div className="flex items-end gap-1.5 h-24">
                      {diasOrdenados.map(([dia, kg]) => (
                        <div key={dia} className="flex-1 flex flex-col items-center gap-1 group relative min-w-0">
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {kg.toFixed(1)} {selectedProdItem.unidad}
                          </div>
                          <div className={`w-full ${cfg.bar} rounded-t`} style={{ height: `${Math.max(4, (kg / maxKg) * 88)}px` }} />
                          <span className="text-[9px] text-slate-600 whitespace-nowrap overflow-hidden w-full text-center">
                            {new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-black text-slate-400 uppercase mb-2">Historial — {eventos.length} registros</p>
                  {eventos.length === 0 ? (
                    <div className="py-10 text-center text-slate-600">
                      <p className="text-2xl mb-2">📋</p>
                      <p className="font-bold text-sm">Sin producciones registradas</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Fecha</th>
                          <th className="px-4 py-2.5 text-left">Tipo</th>
                          <th className="px-4 py-2.5 text-left">Detalle</th>
                          <th className="px-4 py-2.5 text-right">Cant.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {eventos.map((e: any) => {
                          const tl = TIPO_LABELS[e.tipo] ?? { label: e.tipo, color: "bg-slate-500/20 text-slate-400" };
                          return (
                            <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">
                                {new Date(e.fecha).toLocaleDateString("es-AR")} {new Date(e.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${tl.color}`}>{tl.label}</span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-300 text-xs max-w-[180px] truncate">{e.detalle ?? e.corte ?? "—"}</td>
                              <td className="px-4 py-2.5 text-right font-black text-white">{e.peso_kg ?? "—"} {selectedProdItem.unidad}</td>
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