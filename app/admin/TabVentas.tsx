"use client";
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ShoppingCart, Package, History, TrendingUp } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ── Types ─────────────────────────────────────────────────────────────────────
type RecetaRow       = { producto_fudo: string; ingrediente: string; cantidad: number; unidad: string; tabla_origen: string };
type StockDescuento  = { producto: string; cantidad: number; unidad: string; tabla: string };
type RecetasMap      = Record<string, StockDescuento[]>;
type SaleItem        = { name?: string; nombre?: string; productName?: string; quantity?: number; cantidad?: number };
type Sale            = { id: string | number; fecha?: string; date?: string; created_at?: string; total?: number; items?: SaleItem[]; subitems?: SaleItem[] };
type DescuentoEdit   = { producto: string; unidad: string; tabla: string; cantidadOriginal: number; cantidad: string; incluir: boolean; stockActual: number | null };
type CierreLog       = { id?: number; created_at: string; desde?: string; hasta?: string; ventas: number; descuentos: any };

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function buscarEnMapa(nombre: string, mapa: RecetasMap): StockDescuento[] | null {
  const norm = normalizar(nombre);
  if (mapa[norm]) return mapa[norm];
  for (const [key, val] of Object.entries(mapa)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });
}

// ── Modal historial ───────────────────────────────────────────────────────────
function HistorialModal({ log, onClose }: { log: CierreLog; onClose: () => void }) {
  const desc: any[] = Array.isArray(log.descuentos) ? log.descuentos
    : (() => { try { return JSON.parse(log.descuentos); } catch { return []; } })();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-black text-white">{log.ventas} ventas — {log.desde && fmtFecha(log.desde + 'T12:00:00')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleDateString('es-AR', { day:'numeric', month:'short' })} · {new Date(log.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
        <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-1.5">
          {desc.length === 0
            ? <p className="text-slate-500 text-sm text-center py-4">Sin descuentos registrados</p>
            : desc.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2">
                <span className="font-bold text-white text-sm">{d.producto}</span>
                <span className="text-red-400 font-black text-sm">−{d.total} {d.unidad}</span>
              </div>
            ))
          }
        </div>
        <div className="px-5 py-3 border-t border-slate-800">
          <button onClick={onClose} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TabVentas() {
  const hoyStr  = new Date().toISOString().slice(0, 10);
  const ayerStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Recetas
  const [recetasMap, setRecetasMap] = useState<RecetasMap>({});
  const [mapLoaded,  setMapLoaded]  = useState(false);

  // Fecha seleccionada
  const [desde, setDesde] = useState(ayerStr);
  const [hasta, setHasta] = useState(ayerStr);

  // Datos
  const [loading,   setLoading]   = useState(false);
  const [sales,     setSales]     = useState<Sale[]>([]);
  const [editables, setEditables] = useState<DescuentoEdit[]>([]);
  const [noMapeados, setNoMapeados] = useState<string[]>([]);
  const [error,     setError]     = useState('');
  const [applied,   setApplied]   = useState(false);
  const [syncing,   setSyncing]   = useState(false);

  // Historial
  const [historial,    setHistorial]    = useState<CierreLog[]>([]);
  const [selectedLog,  setSelectedLog]  = useState<CierreLog | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);

  useEffect(() => {
    // Cargar recetas
    supabase.from('recetas_fudo').select('*').then(({ data }) => {
      const m: RecetasMap = {};
      for (const row of (data ?? []) as RecetaRow[]) {
        const key = normalizar(row.producto_fudo);
        if (!m[key]) m[key] = [];
        m[key].push({ producto: row.ingrediente, cantidad: Number(row.cantidad), unidad: row.unidad, tabla: row.tabla_origen });
      }
      setRecetasMap(m);
      setMapLoaded(true);
    });
    // Cargar historial (solo registros con ventas > 0)
    loadHistorial();
  }, []);

  const loadHistorial = async () => {
    const { data } = await supabase.from('fudo_sync_log').select('*').gt('ventas', 0).order('created_at', { ascending: false }).limit(20);
    setHistorial((data ?? []) as CierreLog[]);
  };

  // ── Setear rango rápido ───────────────────────────────────────────────────
  const setRango = (d: string, h: string) => {
    setDesde(d); setHasta(h);
    setSales([]); setEditables([]); setNoMapeados([]); setApplied(false); setError('');
  };

  // ── Traer ventas de Fudo ──────────────────────────────────────────────────
  const fetchSales = async () => {
    if (!mapLoaded) return;
    setLoading(true); setError(''); setSales([]); setEditables([]); setNoMapeados([]); setApplied(false);
    try {
      const res  = await fetch(`/api/fudo?action=sales&desde=${desde}&hasta=${hasta}`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Error del servidor: ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(data.error ?? 'Error al traer ventas de Fudo');

      const fetchedSales: Sale[] = data.sales ?? [];
      setSales(fetchedSales);

      // Calcular descuentos usando recetas
      const descMap: Record<string, { total: number; unidad: string; tabla: string }> = {};
      const noRec = new Set<string>();

      for (const sale of fetchedSales) {
        for (const item of (sale.items ?? sale.subitems ?? [])) {
          const nombre = item.name ?? item.nombre ?? item.productName ?? '';
          const qty    = item.quantity ?? item.cantidad ?? 1;
          const descs  = buscarEnMapa(nombre, recetasMap);
          if (descs) {
            for (const d of descs) {
              const key = `${d.tabla}::${d.producto}`;
              if (!descMap[key]) descMap[key] = { total: 0, unidad: d.unidad, tabla: d.tabla };
              descMap[key].total += d.cantidad * qty;
            }
          } else if (nombre.trim()) {
            noRec.add(nombre);
          }
        }
      }
      setNoMapeados(Array.from(noRec));

      const descuentos = Object.entries(descMap).map(([key, v]) => ({
        producto: key.split('::')[1], total: parseFloat(v.total.toFixed(3)), unidad: v.unidad, tabla: v.tabla,
      }));

      // Buscar stock actual para cada ítem
      const actuals = await Promise.all(descuentos.map(async d => {
        const tabla = d.tabla === 'stock_produccion' ? 'stock_produccion' : 'stock';
        const col   = tabla === 'stock_produccion' ? 'producto' : 'nombre';
        const { data: row } = await supabase.from(tabla).select('cantidad').ilike(col, d.producto).maybeSingle();
        return row ? Number(row.cantidad) : null;
      }));

      setEditables(descuentos.map((d, i) => ({
        producto: d.producto, unidad: d.unidad, tabla: d.tabla,
        cantidadOriginal: d.total, cantidad: String(d.total),
        incluir: true, stockActual: actuals[i],
      })));
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const setEdit = (i: number, patch: Partial<DescuentoEdit>) =>
    setEditables(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  // ── Confirmar descuento ───────────────────────────────────────────────────
  const aplicar = async () => {
    setSyncing(true);
    const activos = editables.filter(e => e.incluir && parseFloat(e.cantidad) > 0);
    try {
      for (const d of activos) {
        const cant  = parseFloat(d.cantidad);
        const tabla = d.tabla === 'stock_produccion' ? 'stock_produccion' : 'stock';
        const col   = tabla === 'stock_produccion' ? 'producto' : 'nombre';
        const upCol = tabla === 'stock_produccion' ? 'producto' : 'nombre';
        const { data: row } = await supabase.from(tabla).select('id, cantidad').ilike(col, d.producto).maybeSingle();
        if (row) {
          const patch: any = { cantidad: parseFloat((Number(row.cantidad) - cant).toFixed(3)) };
          if (tabla === 'stock_produccion') patch.ultima_prod = new Date().toISOString();
          await supabase.from(tabla).update(patch).eq('id', row.id);
        }
        await supabase.from('stock_movements').insert({
          nombre: d.producto, categoria: 'FUDO', tipo: 'egreso', cantidad: cant, unidad: d.unidad,
          motivo: `Ventas Fudo ${desde}${desde !== hasta ? ' → ' + hasta : ''}`,
          operador: 'Fudo API', fecha: new Date().toISOString(),
        });
      }
      const logDescuentos = activos.map(e => ({ producto: e.producto, total: parseFloat(e.cantidad), unidad: e.unidad, tabla: e.tabla }));
      await supabase.from('fudo_sync_log').insert({ desde, hasta, ventas: sales.length, descuentos: logDescuentos, tipo: 'manual' });
      // Marcar fechas como procesadas
      const fechas: string[] = [];
      for (let d = new Date(desde); d <= new Date(hasta); d.setDate(d.getDate() + 1))
        fechas.push(d.toISOString().slice(0, 10));
      await supabase.from('fudo_cierre_diario').upsert(
        fechas.map(f => ({ fecha: f, status: 'procesado', procesado_por: 'admin', procesado_at: new Date().toISOString() })),
        { onConflict: 'fecha' }
      );
      setApplied(true);
      loadHistorial();
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  // ── Ranking productos ─────────────────────────────────────────────────────
  const rankMap: Record<string, number> = {};
  for (const s of sales) {
    for (const item of (s.items ?? s.subitems ?? [])) {
      const nombre = item.name ?? item.nombre ?? item.productName ?? '';
      if (!nombre.trim()) continue;
      rankMap[nombre] = (rankMap[nombre] ?? 0) + (item.quantity ?? item.cantidad ?? 1);
    }
  }
  const ranking = Object.entries(rankMap).sort((a, b) => b[1] - a[1]);
  const maxQ    = ranking[0]?.[1] ?? 1;

  const totalActivos = editables.filter(e => e.incluir).length;
  const hayNegativos = editables.some(e => e.incluir && e.stockActual !== null && (e.stockActual - parseFloat(e.cantidad || '0')) < 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Selector de fecha ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-black text-slate-400 uppercase mb-4">¿Qué período querés revisar?</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'Hoy',    d: hoyStr,  h: hoyStr  },
            { label: 'Ayer',   d: ayerStr, h: ayerStr },
            { label: '7 días', d: new Date(Date.now()-6*86400000).toISOString().slice(0,10), h: hoyStr },
          ].map(r => (
            <button key={r.label}
              onClick={() => setRango(r.d, r.h)}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all border
                ${desde === r.d && hasta === r.h
                  ? 'bg-white text-black border-white'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'}`}>
              {r.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setSales([]); setEditables([]); setApplied(false); }}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500" />
            <span className="text-slate-600 text-sm">→</span>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setSales([]); setEditables([]); setApplied(false); }}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500" />
          </div>
        </div>
        <button onClick={fetchSales} disabled={loading || !mapLoaded}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Cargando ventas...' : !mapLoaded ? 'Cargando recetas...' : 'Traer ventas de Fudo'}
        </button>
        {mapLoaded && <p className="text-[10px] text-slate-600 mt-2 text-center">{Object.keys(recetasMap).length} productos mapeados</p>}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Confirmación aplicada */}
      {applied && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-center gap-4">
          <CheckCircle2 size={28} className="text-green-400 shrink-0" />
          <div>
            <p className="text-green-400 font-black text-base">Descuentos aplicados correctamente</p>
            <p className="text-green-600 text-sm">{totalActivos} productos descontados del stock</p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {sales.length > 0 && (
        <>
          {/* KPIs rápidos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Tickets</p>
              <p className="text-2xl font-black text-white">{sales.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Productos vendidos</p>
              <p className="text-2xl font-black text-green-400">{ranking.length}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Sin mapeo</p>
              <p className={`text-2xl font-black ${noMapeados.length > 0 ? 'text-amber-400' : 'text-slate-600'}`}>{noMapeados.length}</p>
            </div>
          </div>

          {/* Ranking productos */}
          {ranking.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="font-black text-white text-sm flex items-center gap-2"><TrendingUp size={16} className="text-blue-400" /> Qué se vendió</p>
              </div>
              <div className="divide-y divide-slate-800/50 max-h-64 overflow-y-auto">
                {ranking.map(([nombre, qty], i) => (
                  <div key={nombre} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-slate-700 font-black text-xs w-5 shrink-0">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{nombre}</p>
                      <div className="mt-1 h-1 bg-slate-800 rounded-full">
                        <div className="h-1 bg-blue-500 rounded-full" style={{ width:`${Math.round(qty/maxQ*100)}%` }} />
                      </div>
                    </div>
                    <span className="font-black text-white text-sm shrink-0">{qty} u</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin mapeo */}
          {noMapeados.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-400 uppercase mb-2">Sin mapeo de receta (no se descontarán):</p>
              <div className="flex flex-wrap gap-2">
                {noMapeados.map((n, i) => <span key={i} className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg">{n}</span>)}
              </div>
            </div>
          )}

          {/* Tabla editable de descuentos */}
          {editables.length > 0 && !applied && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="font-black text-white text-sm">Revisá y ajustá antes de confirmar</p>
                <div className="flex gap-3">
                  <button onClick={() => setEditables(p => p.map(e => ({ ...e, incluir: true })))} className="text-xs text-green-400 font-bold hover:text-green-300">Todos ✓</button>
                  <button onClick={() => setEditables(p => p.map(e => ({ ...e, incluir: false })))} className="text-xs text-slate-500 font-bold hover:text-slate-400">Ninguno</button>
                </div>
              </div>

              {/* Encabezado */}
              <div className="grid grid-cols-[auto_1fr_130px_110px] px-5 py-2 border-b border-slate-800 text-[10px] font-black text-slate-600 uppercase">
                <div className="w-8" /><div>Producto</div><div className="text-center">Stock → quedaría</div><div className="text-right pr-6">Cantidad</div>
              </div>

              <div className="divide-y divide-slate-800/50">
                {editables.map((e, i) => {
                  const cant     = parseFloat(e.cantidad) || 0;
                  const restante = e.stockActual !== null ? e.stockActual - cant : null;
                  const negativo = restante !== null && restante < 0;
                  const editado  = cant !== e.cantidadOriginal;
                  return (
                    <div key={i} className={`grid grid-cols-[auto_1fr_130px_110px] items-center px-5 py-3 transition-colors
                      ${!e.incluir ? 'opacity-40' : ''} ${negativo && e.incluir ? 'bg-red-500/5' : ''}`}>
                      <div className="w-8">
                        <input type="checkbox" checked={e.incluir} onChange={ev => setEdit(i, { incluir: ev.target.checked })}
                          className="w-4 h-4 accent-green-500 cursor-pointer" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{e.producto}</p>
                        <p className="text-[10px] text-slate-600">{e.tabla === 'stock_produccion' ? 'producción' : 'materias primas'}</p>
                      </div>
                      <div className="text-center">
                        {e.stockActual !== null
                          ? <p className={`text-xs font-black ${negativo && e.incluir ? 'text-red-400' : 'text-slate-400'}`}>
                              {e.stockActual.toFixed(1)} → {(e.stockActual - cant).toFixed(1)} {e.unidad}
                              {negativo && e.incluir && ' ⚠️'}
                            </p>
                          : <p className="text-xs text-slate-700">—</p>
                        }
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        {editado && <span className="text-[9px] text-blue-400 font-black">editado</span>}
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400 text-xs font-black">−</span>
                          <input type="number" min="0" step="0.1" value={e.cantidad}
                            onChange={ev => setEdit(i, { cantidad: ev.target.value })}
                            className="w-20 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white font-black text-sm rounded-lg pl-5 pr-1 py-1.5 outline-none text-right" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {totalActivos}/{editables.length} ítems incluidos
                  {hayNegativos && <span className="text-red-400 ml-2 font-bold">⚠️ algunos quedarían negativos</span>}
                </p>
                {editables.some(e => parseFloat(e.cantidad) !== e.cantidadOriginal) && (
                  <button onClick={() => setEditables(p => p.map(e => ({ ...e, cantidad: String(e.cantidadOriginal) })))}
                    className="text-xs text-slate-500 hover:text-white font-bold">↩ restaurar</button>
                )}
              </div>
            </div>
          )}

          {/* Botón confirmar */}
          {totalActivos > 0 && !applied && (
            <button onClick={aplicar} disabled={syncing}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-lg rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-red-900/30">
              <ShoppingCart size={22} />
              {syncing ? 'Aplicando...' : `Confirmar y descontar ${totalActivos} ítem${totalActivos !== 1 ? 's' : ''}`}
            </button>
          )}
        </>
      )}

      {/* ── Historial de cierres ── */}
      {historial.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4"
            onClick={() => setShowHistorial(v => !v)}>
            <p className="font-black text-white text-sm flex items-center gap-2">
              <History size={16} className="text-slate-400" /> Historial de cierres
            </p>
            <span className="text-slate-500 text-xs">{showHistorial ? '▲' : '▼'} {historial.length} registros</span>
          </button>
          {showHistorial && (
            <div className="border-t border-slate-800 divide-y divide-slate-800/50">
              {historial.map((log, i) => {
                const desc: any[] = Array.isArray(log.descuentos) ? log.descuentos
                  : (() => { try { return JSON.parse(log.descuentos); } catch { return []; } })();
                return (
                  <button key={i} onClick={() => setSelectedLog(log)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white text-sm">{log.ventas} ventas · {log.desde && fmtFecha(log.desde + 'T12:00:00')}</p>
                        <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</p>
                      </div>
                    </div>
                    {desc.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs font-black">−{desc.length} items</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedLog && <HistorialModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
