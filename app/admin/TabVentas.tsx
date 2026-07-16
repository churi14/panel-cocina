"use client";
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ShoppingCart, Package, Clock, Zap, Activity } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Types
type RecetaRow      = { producto_fudo: string; ingrediente: string; cantidad: number; unidad: string; tabla_origen: string; };
type StockDescuento = { producto: string; cantidad: number; unidad: string; tabla: string; };
type RecetasMap     = Record<string, StockDescuento[]>;
type SaleItem       = { name?: string; nombre?: string; productName?: string; quantity?: number; cantidad?: number; };
type Sale           = { id: string | number; fecha?: string; date?: string; created_at?: string; total?: number; items?: SaleItem[]; subitems?: SaleItem[]; };
type SyncResumen    = { ventas: number; itemsReconocidos: number; itemsNoReconocidos: string[]; descuentos: { producto: string; total: number; unidad: string; tabla: string }[]; };
type SyncLog        = { id?: number; created_at: string; ventas: number; descuentos: any; desde?: string; hasta?: string; tipo?: string; };

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function buscarEnMapa(nombreFudo: string, mapa: RecetasMap): StockDescuento[] | null {
  const norm = normalizar(nombreFudo);
  if (mapa[norm]) return mapa[norm];
  for (const [key, val] of Object.entries(mapa)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
}

// Sub-tab: Sync Manual
function SyncManual({ recetasMap, mapLoaded }: { recetasMap: RecetasMap; mapLoaded: boolean }) {
  const [desde, setDesde]       = useState(() => new Date().toISOString().slice(0, 10));
  const [hasta, setHasta]       = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [resumen, setResumen]   = useState<SyncResumen | null>(null);
  const [salesRaw, setSalesRaw] = useState<Sale[]>([]);
  const [error, setError]       = useState('');
  const [applied, setApplied]   = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('fudo_sync_log').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }: { data: any[] | null }) => { if (data?.[0]) setLastSync(data[0].created_at); });
  }, []);

  const fetchSales = async () => {
    setLoading(true); setError(''); setResumen(null); setSalesRaw([]); setApplied(false);
    try {
      const res  = await fetch(`/api/fudo?action=sales&desde=${desde}&hasta=${hasta}`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 300)}`); }
      if (!res.ok) throw new Error(data.error ?? 'Error al traer ventas de Fudo');

      const sales: Sale[] = data.sales ?? [];
      setSalesRaw(sales);

      const descuentoMap: Record<string, { total: number; unidad: string; tabla: string }> = {};
      const noReconocidos = new Set<string>();
      let itemsReconocidos = 0;

      for (const sale of sales) {
        const items: SaleItem[] = sale.items ?? sale.subitems ?? [];
        for (const item of items) {
          const nombre     = item.name ?? item.nombre ?? item.productName ?? '';
          const qty        = item.quantity ?? item.cantidad ?? 1;
          const descuentos = buscarEnMapa(nombre, recetasMap);
          if (descuentos) {
            itemsReconocidos++;
            for (const d of descuentos) {
              const key = `${d.tabla}::${d.producto}`;
              if (!descuentoMap[key]) descuentoMap[key] = { total: 0, unidad: d.unidad, tabla: d.tabla };
              descuentoMap[key].total += d.cantidad * qty;
            }
          } else if (nombre.trim()) {
            noReconocidos.add(nombre);
          }
        }
      }

      setResumen({
        ventas: sales.length,
        itemsReconocidos,
        itemsNoReconocidos: Array.from(noReconocidos),
        descuentos: Object.entries(descuentoMap).map(([key, v]) => ({
          producto: key.split('::')[1], total: parseFloat(v.total.toFixed(3)), unidad: v.unidad, tabla: v.tabla,
        })),
      });
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const aplicarDescuentos = async () => {
    if (!resumen) return;
    setSyncing(true);
    try {
      for (const d of resumen.descuentos) {
        if (d.tabla === 'stock_produccion') {
          const { data: sp } = await supabase.from('stock_produccion')
            .select('id, cantidad').ilike('producto', d.producto).maybeSingle();
          if (sp) {
            await supabase.from('stock_produccion').update({
              cantidad:    parseFloat((Number(sp.cantidad) - d.total).toFixed(3)),
              ultima_prod: new Date().toISOString(),
            }).eq('id', sp.id);
            await supabase.from('stock_movements').insert({
              nombre: d.producto, categoria: 'FUDO', tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
              motivo: `Ventas Fudo ${desde}${desde !== hasta ? ' -> ' + hasta : ''}`,
              operador: 'Fudo API', fecha: new Date().toISOString(),
            });
          }
        } else if (d.tabla === 'stock') {
          const { data: sm } = await supabase.from('stock')
            .select('id, cantidad').ilike('nombre', d.producto).maybeSingle();
          if (sm) {
            await supabase.from('stock').update({
              cantidad: parseFloat((Number(sm.cantidad) - d.total).toFixed(3)),
            }).eq('id', sm.id);
            await supabase.from('stock_movements').insert({
              nombre: d.producto, categoria: 'FUDO', tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
              motivo: `Ventas Fudo ${desde}${desde !== hasta ? ' -> ' + hasta : ''}`,
              operador: 'Fudo API', fecha: new Date().toISOString(),
            });
          }
        }
      }
      await supabase.from('fudo_sync_log').insert({ desde, hasta, ventas: resumen.ventas, descuentos: resumen.descuentos });
      setLastSync(new Date().toISOString());
      setApplied(true);
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  return (
    <div className="space-y-6">
      {lastSync && (
        <p className="text-xs text-slate-500">
          Ultima sync: {new Date(lastSync).toLocaleDateString('es-AR')} {new Date(lastSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {!mapLoaded && <p className="text-xs text-amber-400">Cargando recetas...</p>}
      {mapLoaded && <p className="text-xs text-green-500">{Object.keys(recetasMap).length} productos mapeados desde Supabase</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-black text-slate-400 uppercase mb-4">Rango de fechas</p>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
          </div>
          <button onClick={fetchSales} disabled={loading || !mapLoaded}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-40 flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Cargando...' : 'Traer ventas'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-bold">{error}</p>
        </div>
      )}

      {applied && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex gap-3">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <p className="text-green-400 font-black text-sm">Descuentos aplicados correctamente al stock.</p>
        </div>
      )}

      {resumen && !applied && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Ventas totales',    value: resumen.ventas,                    color: 'text-white' },
              { label: 'Items reconocidos', value: resumen.itemsReconocidos,          color: 'text-green-400' },
              { label: 'Sin mapeo',         value: resumen.itemsNoReconocidos.length, color: 'text-amber-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500 uppercase mb-1">{c.label}</p>
                <p className={`text-3xl font-black ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {resumen.descuentos.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="font-black text-sm text-slate-300 uppercase">Se va a descontar del stock:</p>
              </div>
              {resumen.descuentos.map((d, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between border-b border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <Package size={15} className="text-slate-500" />
                    <span className="font-bold text-white text-sm">{d.producto}</span>
                    <span className="text-xs text-slate-600">{d.tabla}</span>
                  </div>
                  <span className="font-black text-red-400">-{d.total} {d.unidad}</span>
                </div>
              ))}
            </div>
          )}

          {resumen.itemsNoReconocidos.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-400 uppercase mb-2">Productos de Fudo sin mapeo (no se descuentan):</p>
              <div className="flex flex-wrap gap-2">
                {resumen.itemsNoReconocidos.map((n, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg">{n}</span>
                ))}
              </div>
            </div>
          )}

          {resumen.descuentos.length > 0 && (
            <button onClick={aplicarDescuentos} disabled={syncing}
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-2xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-3">
              <ShoppingCart size={22} />
              {syncing ? 'Aplicando...' : `Confirmar y descontar stock (${resumen.ventas} ventas)`}
            </button>
          )}
        </>
      )}

      {salesRaw.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <p className="font-black text-xs text-slate-400 uppercase">{salesRaw.length} ventas del periodo</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/50">
            {salesRaw.slice(0, 100).map((s, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center justify-between hover:bg-slate-800/30">
                <div>
                  <p className="text-xs text-slate-400 font-mono">{(s.fecha ?? s.date ?? s.created_at ?? '').slice(0, 16).replace('T', ' ')}</p>
                  <p className="text-xs text-slate-500">{(s.items ?? s.subitems ?? []).length} items</p>
                </div>
                {s.total != null && <p className="font-bold text-white text-sm">${s.total}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Modal de detalle de sync
function SyncDetailModal({ log, onClose }: { log: SyncLog; onClose: () => void }) {
  const desc: any[] = Array.isArray(log.descuentos) ? log.descuentos
    : (() => { try { return JSON.parse(log.descuentos); } catch { return []; } })();

  const prodItems  = desc.filter((d: any) => d.tabla === 'stock_produccion');
  const stockItems = desc.filter((d: any) => d.tabla !== 'stock_produccion');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-black text-white text-base">
                {log.ventas ?? 0} venta{(log.ventas ?? 0) !== 1 ? 's' : ''} nuevas
              </p>
              {log.tipo === 'auto'   && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-black">AUTO</span>}
              {log.tipo === 'manual' && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-black">MANUAL</span>}
            </div>
            <p className="text-xs text-slate-500">
              {new Date(log.created_at).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {(log.desde || log.hasta) && (
              <p className="text-xs text-slate-600 mt-0.5">Periodo: {log.desde} → {log.hasta}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {desc.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Sin descuentos en esta sync.</p>
          ) : (
            <div className="space-y-4">
              {prodItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Stock Producción</p>
                  <div className="space-y-1.5">
                    {prodItems.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2">
                        <span className="text-sm font-bold text-white">{d.producto}</span>
                        <span className="text-red-400 font-black text-sm">−{d.total} {d.unidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stockItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Stock Materias Primas</p>
                  <div className="space-y-1.5">
                    {stockItems.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2">
                        <span className="text-sm font-bold text-white">{d.producto}</span>
                        <span className="text-red-400 font-black text-sm">−{d.total} {d.unidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800">
          <button onClick={onClose} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-tab: Dashboard de ventas
function Dashboard() {
  const hoy  = new Date().toISOString().slice(0, 10);
  const hace7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const [desde,   setDesde]   = useState(hace7);
  const [hasta,   setHasta]   = useState(hoy);
  const [loading, setLoading] = useState(false);
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [error,   setError]   = useState('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);

  const fetchData = async (d = desde, h = hasta) => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/fudo?action=sales&desde=${d}&hasta=${h}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al traer ventas');
      setSales(data.sales ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const setRango = (dias: number) => {
    const h = new Date().toISOString().slice(0, 10);
    const d = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);
    setDesde(d); setHasta(h); fetchData(d, h);
  };

  const getSaleTs  = (s: Sale) => s.fecha ?? s.date ?? s.created_at ?? '';
  // Fudo devuelve timestamps en UTC. Argentina = UTC-3, entonces restamos 3h.
  const toART = (ts: string) => new Date(new Date(ts).getTime() - 3 * 3600 * 1000);
  const getSaleDate = (s: Sale) => {
    const ts = getSaleTs(s);
    if (!ts) return '';
    return toART(ts).toISOString().slice(0, 10);
  };
  const getSaleHour = (s: Sale) => {
    const ts = getSaleTs(s);
    if (!ts) return 0;
    return toART(ts).getUTCHours();
  };
  const getTurno    = (h: number): 'mediodia' | 'noche' | 'otro' => {
    if (h >= 12 && h < 16) return 'mediodia';
    if (h >= 20 || h < 2)  return 'noche';
    return 'otro';
  };

  // Construir mapa de fechas del rango (aunque no haya ventas)
  type DayData = { mediodia: number; noche: number; otro: number; total: number };
  const byDate: Record<string, DayData> = {};
  for (let d = new Date(desde); d <= new Date(hasta + 'T23:59:59'); d.setDate(d.getDate() + 1)) {
    byDate[d.toISOString().slice(0, 10)] = { mediodia: 0, noche: 0, otro: 0, total: 0 };
  }
  for (const s of sales) {
    const key = getSaleDate(s);
    if (!byDate[key]) byDate[key] = { mediodia: 0, noche: 0, otro: 0, total: 0 };
    const t = getTurno(getSaleHour(s));
    byDate[key][t]++; byDate[key].total++;
  }
  const dates  = Object.keys(byDate).sort();
  const maxVal = Math.max(...dates.map(d => byDate[d].total), 1);

  const totalMed   = dates.reduce((s, d) => s + byDate[d].mediodia, 0);
  const totalNoche = dates.reduce((s, d) => s + byDate[d].noche, 0);
  const totalOtro  = dates.reduce((s, d) => s + byDate[d].otro, 0);
  const totalAll   = sales.length;

  // SVG chart dimensions
  const svgH   = 160;
  const padL   = 32;
  const padB   = 28;
  const padT   = 10;
  const chartW = Math.max(dates.length * 52, 300);
  const chartH = svgH - padB - padT;
  const barW   = 18;
  const gap    = dates.length > 0 ? (chartW - padL) / dates.length : 52;

  const formatDate = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${parseInt(d)}/${parseInt(m)}`;
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          <div className="flex gap-3 items-end">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold">DESDE</p>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold">HASTA</p>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500" />
            </div>
            <button onClick={() => fetchData()} disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-40">
              {loading ? '...' : 'Ver'}
            </button>
          </div>
          <div className="flex gap-2">
            {[['Hoy', 1], ['7 días', 7], ['14 días', 14], ['30 días', 30]].map(([label, dias]) => (
              <button key={label} onClick={() => setRango(Number(dias))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total ventas', value: totalAll,   color: 'text-white' },
          { label: 'Mediodia',  value: totalMed,   color: 'text-amber-400' },
          { label: 'Noche',     value: totalNoche, color: 'text-blue-400' },
          { label: 'Sin turno',    value: totalOtro,  color: 'text-slate-500' },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500 font-bold mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico SVG */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-black text-slate-400 uppercase mb-4">Ventas por dia</p>
        <div className="overflow-x-auto">
          <svg width={chartW + padL} height={svgH} className="block">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = padT + chartH * (1 - f);
              const val = Math.round(maxVal * f);
              return (
                <g key={f}>
                  <line x1={padL} x2={chartW + padL} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" />
                  {val > 0 && <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#475569">{val}</text>}
                </g>
              );
            })}
            {/* Bars */}
            {dates.map((date, i) => {
              const d   = byDate[date];
              const cx  = padL + gap * i + gap / 2;
              const med   = (d.mediodia / maxVal) * chartH;
              const noch  = (d.noche    / maxVal) * chartH;
              const otro  = (d.otro     / maxVal) * chartH;
              const total = (d.total    / maxVal) * chartH;
              return (
                <g key={date}
                  onMouseEnter={e => setTooltip({ x: cx, y: padT, label: `${formatDate(date)} | Med: ${d.mediodia} | Noche: ${d.noche} | Total: ${d.total}` })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}>
                  {/* Barra noche (base) */}
                  {d.noche > 0 && <rect x={cx - barW / 2} y={padT + chartH - noch} width={barW} height={noch} rx="3" fill="#3b82f6" opacity="0.85" />}
                  {/* Barra mediodía (encima) */}
                  {d.mediodia > 0 && <rect x={cx - barW / 2} y={padT + chartH - noch - med} width={barW} height={med} rx="3" fill="#f59e0b" opacity="0.85" />}
                  {/* Barra otro */}
                  {d.otro > 0 && <rect x={cx - barW / 2} y={padT + chartH - noch - med - otro} width={barW} height={otro} rx="3" fill="#475569" opacity="0.7" />}
                  {/* Label fecha */}
                  <text x={cx} y={svgH - 4} textAnchor="middle" fontSize="10" fill={d.total > 0 ? '#94a3b8' : '#334155'}>{formatDate(date)}</text>
                  {/* Total encima de barra */}
                  {d.total > 0 && <text x={cx} y={padT + chartH - total - 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#e2e8f0">{d.total}</text>}
                </g>
              );
            })}
            {/* Tooltip */}
            {tooltip && tooltip.label.split('\n').map((line, i) => (
              <text key={i} x={tooltip.x} y={tooltip.y - 10 + i * 13} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">{line}</text>
            ))}
          </svg>
        </div>
        {/* Leyenda */}
        <div className="flex gap-4 mt-3 justify-center">
          {[['#f59e0b', 'Mediodia (12-15hs)'], ['#3b82f6', 'Noche (20-00hs)'], ['#475569', 'Otros']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
              <span className="text-xs text-slate-400">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla por turno */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-xs font-black text-slate-400 uppercase">Detalle por día y turno</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                <th className="px-5 py-3 text-left font-bold">Fecha</th>
                <th className="px-4 py-3 text-center font-bold text-amber-400">Mediodia (12-15hs)</th>
                <th className="px-4 py-3 text-center font-bold text-blue-400">Noche (20-00hs)</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500">Sin turno</th>
                <th className="px-4 py-3 text-center font-bold text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const d = byDate[date];
                return (
                  <tr key={date} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${d.total === 0 ? 'opacity-30' : ''}`}>
                    <td className="px-5 py-3 font-bold text-slate-300">
                      {new Date(date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-amber-400">{d.mediodia || '—'}</td>
                    <td className="px-4 py-3 text-center font-black text-blue-400">{d.noche || '—'}</td>
                    <td className="px-4 py-3 text-center font-black text-slate-500">{d.otro || '—'}</td>
                    <td className="px-4 py-3 text-center font-black text-white">{d.total || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800/50 border-t border-slate-700">
                <td className="px-5 py-3 font-black text-slate-300 text-xs uppercase">TOTAL</td>
                <td className="px-4 py-3 text-center font-black text-amber-400 text-lg">{totalMed}</td>
                <td className="px-4 py-3 text-center font-black text-blue-400 text-lg">{totalNoche}</td>
                <td className="px-4 py-3 text-center font-black text-slate-500">{totalOtro}</td>
                <td className="px-4 py-3 text-center font-black text-white text-lg">{totalAll}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-tab: Tiempo Real (sync logs)
function TiempoReal() {
  const [logs,       setLogs]       = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [recetasMap,  setRecetasMap]  = useState<RecetasMap>({});
  const [mapLoaded,   setMapLoaded]   = useState(false);

  useEffect(() => {
    async function loadRecetas() {
      const { data } = await supabase.from('recetas_fudo').select('*');
      const m: RecetasMap = {};
      for (const row of (data ?? []) as RecetaRow[]) {
        const key = normalizar(row.producto_fudo);
        if (!m[key]) m[key] = [];
        m[key].push({ producto: row.ingrediente, cantidad: Number(row.cantidad), unidad: row.unidad, tabla: row.tabla_origen });
      }
      setRecetasMap(m);
      setMapLoaded(true);
    }
    loadRecetas();
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('fudo_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setLogs((data ?? []) as SyncLog[]);
    setLoadingLogs(false);
  }

  return (
    <div className="space-y-6">
      {/* Sync manual */}
      <SyncManual recetasMap={recetasMap} mapLoaded={mapLoaded} />

      {/* Historial de syncs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-slate-400" />
            <p className="font-black text-white text-sm">Historial de syncs</p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
        <div className="divide-y divide-slate-800/50">
          {logs.length === 0 && !loadingLogs && (
            <p className="px-5 py-8 text-center text-slate-500 text-sm">Sin syncs registradas</p>
          )}
          {logs.map((log, i) => {
            const desc: any[] = Array.isArray(log.descuentos) ? log.descuentos
              : (() => { try { return JSON.parse(log.descuentos); } catch { return []; } })();
            return (
              <button
                key={i}
                onClick={() => setSelectedLog(log)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {log.ventas > 0
                    ? <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                    : <Clock       size={16} className="text-slate-600 shrink-0" />
                  }
                  <div>
                    <p className="font-bold text-white text-sm">
                      {log.ventas ?? 0} venta{(log.ventas ?? 0) !== 1 ? 's' : ''} nuevas
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' '}
                      {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {desc.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-black">
                      -{desc.length} items
                    </span>
                  )}
                  {log.tipo && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${log.tipo === 'auto' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {log.tipo.toUpperCase()}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedLog && <SyncDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabVentas() {
  const [subTab, setSubTab] = useState<'dashboard' | 'manual' | 'tiemporeal'>('dashboard');

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Sub-tab selector */}
      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
        {([
          { id: 'dashboard',   label: 'Dashboard' },
          { id: 'tiemporeal',  label: 'Tiempo Real' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-black transition-all ${
              subTab === t.id
                ? 'bg-white text-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'dashboard'  && <Dashboard />}
      {subTab === 'tiemporeal' && <TiempoReal />}
    </div>
  );
}
