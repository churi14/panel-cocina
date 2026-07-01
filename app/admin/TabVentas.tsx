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
              nombre: d.producto, tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
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
              nombre: d.producto, tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
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

// Sub-tab: Tiempo Real
function TiempoReal() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastAuto, setLastAuto] = useState<SyncLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fudo_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    const all      = (data ?? []) as SyncLog[];
    const autoLogs = all.filter(l => !l.tipo || l.tipo === 'auto');
    const logs     = autoLogs.length > 0 ? autoLogs : all;
    setSyncLogs(logs);
    setLastAuto(logs[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const tiempoRelativo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)  return 'hace menos de 1 min';
    if (min < 60) return `hace ${min} min`;
    const hs = Math.floor(min / 60);
    return `hace ${hs}h ${min % 60}min`;
  };

  const descuentosCount = (log: SyncLog) => {
    if (!log.descuentos) return 0;
    if (Array.isArray(log.descuentos)) return log.descuentos.length;
    try { return JSON.parse(log.descuentos).length; } catch { return 0; }
  };

  return (
    <div className="space-y-6">

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <p className="font-black text-white">Auto-sync ACTIVO</p>
          </div>
          <button onClick={loadLogs} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={15} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">Frecuencia</p>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-blue-400" />
              <p className="font-bold text-white text-sm">Cada 10 minutos</p>
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">Ultima sync</p>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-green-400" />
              <p className="font-bold text-white text-sm">
                {lastAuto ? tiempoRelativo(lastAuto.created_at) : loading ? '...' : 'Sin datos aun'}
              </p>
            </div>
          </div>
        </div>
        {lastAuto && (
          <p className="text-xs text-slate-600 mt-3">
            {new Date(lastAuto.created_at).toLocaleDateString('es-AR')}{' '}
            {new Date(lastAuto.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {' | '}{lastAuto.ventas ?? 0} ventas{' | '}{descuentosCount(lastAuto)} descuentos
          </p>
        )}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-blue-300 font-black text-sm mb-1">Como funciona</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Vercel ejecuta el cron automaticamente cada 10 minutos. Trae las ventas de Fudo,
              descuenta del stock los ingredientes segun las recetas en Supabase, y evita
              procesar la misma venta dos veces. Cada ciclo queda registrado abajo.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <p className="font-black text-xs text-slate-400 uppercase">Historial de syncs</p>
          {syncLogs.length > 0 && <span className="text-xs text-slate-600">{syncLogs.length} registros</span>}
        </div>

        {loading && (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-500 text-sm">Cargando historial...</p>
          </div>
        )}

        {!loading && syncLogs.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-slate-500 text-sm">Sin syncs automaticas aun.</p>
            <p className="text-slate-600 text-xs mt-1">El primer ciclo se ejecutara en los proximos 10 minutos.</p>
          </div>
        )}

        {!loading && syncLogs.length > 0 && (
          <div className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
            {syncLogs.map((log, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/20">
                <div>
                  <p className="text-sm font-bold text-white">
                    {log.ventas ?? 0} venta{(log.ventas ?? 0) !== 1 ? 's' : ''} nuevas
                    <span className="text-slate-500 font-normal"> | {descuentosCount(log)} descuentos</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(log.created_at).toLocaleDateString('es-AR')}{' '}
                    {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    {log.tipo === 'auto'   && <span className="ml-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold">AUTO</span>}
                    {log.tipo === 'manual' && <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">MANUAL</span>}
                  </p>
                </div>
                <p className="text-xs text-slate-500 font-mono">{tiempoRelativo(log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// Componente principal
export default function TabVentas() {
  const [subTab, setSubTab]         = useState<'manual' | 'realtime'>('manual');
  const [recetasMap, setRecetasMap] = useState<RecetasMap>({});
  const [mapLoaded, setMapLoaded]   = useState(false);

  useEffect(() => {
    supabase.from('recetas_fudo').select('producto_fudo,ingrediente,cantidad,unidad,tabla_origen')
      .then(({ data }) => {
        const mapa: RecetasMap = {};
        for (const row of (data ?? []) as RecetaRow[]) {
          const key = normalizar(row.producto_fudo);
          if (!mapa[key]) mapa[key] = [];
          mapa[key].push({ producto: row.ingrediente, cantidad: Number(row.cantidad), unidad: row.unidad, tabla: row.tabla_origen });
        }
        setRecetasMap(mapa);
        setMapLoaded(true);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Ventas Fudo</h2>
        <p className="text-xs text-slate-500 mt-0.5">Integracion con Fudo POS descuento de stock</p>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1">
        <button
          onClick={() => setSubTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all
            ${subTab === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <RefreshCw size={15} />
          Sync Manual
        </button>
        <button
          onClick={() => setSubTab('realtime')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all
            ${subTab === 'realtime' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <div className={`w-2 h-2 rounded-full bg-green-500 ${subTab !== 'realtime' ? 'animate-pulse' : ''}`} />
          Tiempo Real
        </button>
      </div>

      {subTab === 'manual'   && <SyncManual recetasMap={recetasMap} mapLoaded={mapLoaded} />}
      {subTab === 'realtime' && <TiempoReal />}
    </div>
  );
}
