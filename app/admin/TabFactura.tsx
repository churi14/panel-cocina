"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ChevronDown, ChevronUp, FileText,
  Building2, ShoppingCart, CalendarDays, Plus, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabase';
import FacturaModal from './FacturaModal';

interface FacturaHist {
  id: number;
  proveedor: string | null;
  numero_factura: string | null;
  fecha_factura: string | null;
  fecha_carga: string;
  operador: string | null;
  items: { nombre: string; cantidad: number; unidad: string; stockMatch: string | null }[];
  total_items: number;
  imagen_nombre: string | null;
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start gap-4`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-white mt-0.5">{value}</p>
        {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function TabFactura() {
  const [facturas, setFacturas]         = useState<FacturaHist[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [filterProv, setFilterProv]     = useState('');

  const fetchFacturas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('facturas_historial')
      .select('*')
      .order('fecha_carga', { ascending: false })
      .limit(200);
    setFacturas((data ?? []) as FacturaHist[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFacturas(); }, [fetchFacturas]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const thisMonth = new Date().toISOString().slice(0, 7);
  const facturasEsteMes    = facturas.filter(f => f.fecha_carga?.startsWith(thisMonth)).length;
  const proveedoresUnicos  = new Set(facturas.map(f => f.proveedor).filter(Boolean)).size;
  const totalItemsCargados = facturas.reduce((s, f) => s + (f.total_items || 0), 0);

  // ── Resumen por proveedor ──────────────────────────────────────────────────
  const byProv: Record<string, { facturas: number; items: number; ultima: string }> = {};
  facturas.forEach(f => {
    const p = f.proveedor ?? 'Sin proveedor';
    if (!byProv[p]) byProv[p] = { facturas: 0, items: 0, ultima: '' };
    byProv[p].facturas++;
    byProv[p].items += f.total_items || 0;
    if (!byProv[p].ultima || f.fecha_carga > byProv[p].ultima) byProv[p].ultima = f.fecha_carga;
  });
  const provList = Object.entries(byProv).sort((a, b) => b[1].facturas - a[1].facturas);

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const filtered = filterProv
    ? facturas.filter(f => (f.proveedor ?? '').toLowerCase().includes(filterProv.toLowerCase()))
    : facturas;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {showModal && (
        <FacturaModal
          onClose={() => setShowModal(false)}
          onConfirm={() => { setShowModal(false); fetchFacturas(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">📄 Facturas de proveedor</h2>
          <p className="text-slate-500 text-sm mt-0.5">Historial de compras e ingresos de stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchFacturas}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/30">
            <Plus size={16} /> Nueva factura IA
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FileText size={20} className="text-indigo-400" />}
          label="Total facturas" value={facturas.length}
          sub="desde el inicio"
          color="bg-indigo-500/15" />
        <StatCard icon={<CalendarDays size={20} className="text-blue-400" />}
          label="Este mes" value={facturasEsteMes}
          sub={new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}
          color="bg-blue-500/15" />
        <StatCard icon={<Building2 size={20} className="text-green-400" />}
          label="Proveedores" value={proveedoresUnicos}
          sub="distintos registrados"
          color="bg-green-500/15" />
        <StatCard icon={<ShoppingCart size={20} className="text-amber-400" />}
          label="Items cargados" value={totalItemsCargados}
          sub="productos ingresados al stock"
          color="bg-amber-500/15" />
      </div>

      {/* Resumen por proveedor */}
      {provList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wide">🏢 Por proveedor</h3>
            <span className="text-xs text-slate-500">{provList.length} proveedores</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-slate-800">
            {provList.map(([prov, stats]) => (
              <div key={prov} className="bg-slate-900 px-5 py-4">
                <p className="font-black text-white text-sm truncate">{prov}</p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Facturas</p>
                    <p className="font-black text-indigo-400 text-lg">{stats.facturas}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Items</p>
                    <p className="font-black text-amber-400 text-lg">{stats.items}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Última</p>
                    <p className="text-slate-400 text-xs font-bold">
                      {new Date(stats.ultima).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-black text-white text-sm uppercase tracking-wide">📋 Historial de facturas</h3>
          <input
            value={filterProv}
            onChange={e => setFilterProv(e.target.value)}
            placeholder="Filtrar por proveedor..."
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500 w-52 placeholder-slate-600" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 size={20} className="animate-spin" /> Cargando facturas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-lg">Sin facturas todavía</p>
            <p className="text-sm mt-1">Usá el botón "Nueva factura IA" para empezar</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(f => {
              const isOpen = expandedId === f.id;
              const vinculados = (f.items ?? []).filter(i => i.stockMatch).length;
              return (
                <div key={f.id}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : f.id)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors text-left">
                    {/* Fecha */}
                    <div className="shrink-0 w-16 text-center">
                      <p className="text-xs text-slate-500 font-bold">
                        {f.fecha_factura
                          ? new Date(f.fecha_factura + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                          : '—'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {f.fecha_factura
                          ? new Date(f.fecha_factura + 'T00:00:00').getFullYear()
                          : ''}
                      </p>
                    </div>

                    {/* Proveedor + nro */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">{f.proveedor ?? 'Sin proveedor'}</p>
                      <p className="text-slate-500 text-xs mt-0.5 font-mono">{f.numero_factura ?? '—'}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                        {f.total_items} items
                      </span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border
                        ${vinculados === f.total_items
                          ? 'text-green-400 bg-green-500/10 border-green-500/20'
                          : vinculados > 0
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                        {vinculados}/{f.total_items} vinc.
                      </span>
                    </div>

                    {/* Operador + carga */}
                    <div className="hidden md:block text-right shrink-0 w-32">
                      <p className="text-xs text-slate-500">{f.operador?.split('·')[0]?.trim()}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(f.fecha_carga).toLocaleDateString('es-AR')} {new Date(f.fecha_carga).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {isOpen ? <ChevronUp size={15} className="text-slate-500 shrink-0" /> : <ChevronDown size={15} className="text-slate-500 shrink-0" />}
                  </button>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div className="px-6 pb-4 bg-slate-800/20">
                      <div className="rounded-xl overflow-hidden border border-slate-700">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
                              <th className="px-4 py-2 text-left">Nombre en factura</th>
                              <th className="px-3 py-2 text-center">Cantidad</th>
                              <th className="px-4 py-2 text-left">Vinculado a stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {(f.items ?? []).map((item, i) => (
                              <tr key={i} className="hover:bg-slate-800/30">
                                <td className="px-4 py-2.5 font-mono text-slate-300">{item.nombre}</td>
                                <td className="px-3 py-2.5 text-center text-slate-400 font-black">
                                  {item.cantidad} {item.unidad}
                                </td>
                                <td className="px-4 py-2.5">
                                  {item.stockMatch
                                    ? <span className="text-green-400 font-black">✓ {item.stockMatch}</span>
                                    : <span className="text-red-400/60">— sin vincular</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
