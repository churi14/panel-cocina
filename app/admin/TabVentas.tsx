"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  Upload, CheckCircle2, AlertTriangle, RefreshCw, X,
  TrendingUp, ShoppingBag, Truck, CreditCard, Banknote,
  BarChart3, Package, ChevronDown, ChevronUp, Store
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Config de locales ────────────────────────────────────────────────────────
const LOCALES = [
  { id: 'burger',   label: '🍔 Burger',         color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  bar: 'bg-blue-500',  hex: '#3b82f6' },
  { id: 'lomito',   label: '🥩 Club del Lomito', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  bar: 'bg-rose-500',  hex: '#f43f5e' },
  { id: 'milanesa', label: '🥪 Milanesa',        color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500', hex: '#f59e0b' },
] as const;
type LocalId = 'burger' | 'lomito' | 'milanesa';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type VentaProducto = {
  fecha: string; categoria: string; producto: string;
  cantidad: number; monto_total: number; local: LocalId;
};
type VentaOrden = {
  id: number; fecha: string | null; creacion: string | null; cerrada: string | null;
  cliente: string | null; medio_pago: string | null; total: number; fiscal: boolean;
  tipo_venta: string | null; origen: string | null; comentario: string | null;
  local: LocalId;
};
type ParseResult = {
  productos: VentaProducto[]; ordenes: VentaOrden[];
  fechaDesde: string; fechaHasta: string;
  errorProductos?: string; errorOrdenes?: string;
};

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseProductos(wb: XLSX.WorkBook, local: LocalId): { data: VentaProducto[]; error?: string } {
  try {
    const ws = wb.Sheets['Detalle'] ?? wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const data: VentaProducto[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[3]) continue;
      const rawFecha = r[0];
      let fecha = '';
      if (rawFecha instanceof Date)        fecha = rawFecha.toISOString().slice(0, 10);
      else if (typeof rawFecha === 'number') fecha = new Date((rawFecha - 25569) * 86400 * 1000).toISOString().slice(0, 10);
      else if (typeof rawFecha === 'string') fecha = rawFecha.slice(0, 10);
      data.push({
        fecha, local,
        categoria:   String(r[1] ?? '').toUpperCase(),
        producto:    String(r[3] ?? '').toUpperCase(),
        cantidad:    Number(r[4]) || 0,
        monto_total: Number(r[5]) || 0,
      });
    }
    return { data };
  } catch (e: any) { return { data: [], error: e.message }; }
}

function parseOrdenes(wb: XLSX.WorkBook, local: LocalId): { data: VentaOrden[]; error?: string } {
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    let headerIdx = rows.findIndex(r => r.includes('Id'));
    if (headerIdx === -1) headerIdx = 2;
    const headers: string[] = rows[headerIdx].map((h: any) => String(h ?? ''));
    const col = (name: string) => headers.indexOf(name);
    const toDate = (val: any): string | null => {
      if (!val) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000).toISOString();
      if (typeof val === 'string' && val.includes('-')) return new Date(val).toISOString();
      return null;
    };
    const data: VentaOrden[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const id = Number(r[col('Id')]);
      if (!id || isNaN(id)) continue;
      const fiscalRaw = String(r[col('Fiscal')] ?? '').toLowerCase();
      data.push({
        id, local,
        fecha:      toDate(r[col('Fecha')])?.slice(0, 10) ?? null,
        creacion:   toDate(r[col('Creación')]),
        cerrada:    toDate(r[col('Cerrada')]),
        cliente:    r[col('Cliente')] ? String(r[col('Cliente')]) : null,
        medio_pago: r[col('Medio de Pago')] ? String(r[col('Medio de Pago')]) : null,
        total:      Number(r[col('Total')]) || 0,
        fiscal:     fiscalRaw === 'si' || fiscalRaw === 'sí',
        tipo_venta: r[col('Tipo de Venta')] ? String(r[col('Tipo de Venta')]) : null,
        origen:     r[col('Origen')] ? String(r[col('Origen')]) : null,
        comentario: r[col('Comentario')] ? String(r[col('Comentario')]) : null,
      });
    }
    return { data };
  } catch (e: any) { return { data: [], error: e.message }; }
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { resolve(XLSX.read(e.target?.result, { type: 'binary', cellDates: true })); }
      catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) => '$' + Math.round(n).toLocaleString('es-AR');
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('es-AR') : '—';

// Turno: mediodía 12-15, noche 20-00
function getTurno(creacion: string | null): 'mediodia' | 'noche' | null {
  if (!creacion) return null;
  const h = new Date(creacion).getHours();
  if (h >= 12 && h < 15) return 'mediodia';
  if (h >= 20 || h < 2)  return 'noche';
  return null;
}

// ─── Mini Pie Chart SVG ───────────────────────────────────────────────────────
function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-slate-600 py-8">Sin datos</div>;

  let startAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const pct   = d.value / total;
    const angle = pct * 2 * Math.PI;
    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    startAngle += angle;
    const x2 = 50 + 40 * Math.cos(startAngle);
    const y2 = 50 + 40 * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, pct, path: `M50,50 L${x1},${y1} A40,40 0 ${large},1 ${x2},${y2} Z` };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#0f172a" strokeWidth="1" />)}
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-slate-300 font-bold">{s.label}</span>
            </span>
            <span className="font-black text-white">{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TabVentas() {
  const [fileProductos, setFileProductos] = useState<File | null>(null);
  const [fileOrdenes, setFileOrdenes]     = useState<File | null>(null);
  const [localSeleccionado, setLocalSeleccionado] = useState<LocalId>('burger');
  const [parsed, setParsed]       = useState<ParseResult | null>(null);
  const [parsing, setParsing]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState('');

  const [ventas, setVentas]   = useState<VentaProducto[]>([]);
  const [ordenes, setOrdenes] = useState<VentaOrden[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showUpload, setShowUpload]   = useState(false);
  const [expandTop, setExpandTop]     = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'dia' | 'mes'>('dia');
  const [filtroLocalVista, setFiltroLocalVista] = useState<LocalId | 'todos'>('todos');

  const fetchVentas = async () => {
    setLoadingData(true);
    const [{ data: v }, { data: o }] = await Promise.all([
      supabase.from('ventas').select('*').order('fecha', { ascending: false }),
      supabase.from('ventas_ordenes').select('*').order('fecha', { ascending: false }),
    ]);
    setVentas((v ?? []) as VentaProducto[]);
    setOrdenes((o ?? []) as VentaOrden[]);
    setLoadingData(false);
  };

  useEffect(() => { fetchVentas(); }, []);

  // Parsear cuando ambos archivos están listos
  useEffect(() => {
    if (!fileProductos || !fileOrdenes) return;
    (async () => {
      setParsing(true); setParsed(null);
      try {
        const [wb1, wb2] = await Promise.all([readWorkbook(fileProductos), readWorkbook(fileOrdenes)]);
        const { data: prods, error: e1 } = parseProductos(wb1, localSeleccionado);
        const { data: ords,  error: e2 } = parseOrdenes(wb2, localSeleccionado);
        const allFechas = [...prods.map(p => p.fecha), ...ords.map(o => o.fecha ?? '')].filter(Boolean).sort();
        setParsed({ productos: prods, ordenes: ords,
          fechaDesde: allFechas[0] ?? '', fechaHasta: allFechas[allFechas.length - 1] ?? '',
          errorProductos: e1, errorOrdenes: e2 });
      } catch (e: any) { setImportError('Error al leer los archivos: ' + e.message); }
      setParsing(false);
    })();
  }, [fileProductos, fileOrdenes, localSeleccionado]);

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true); setImportError('');
    try {
      if (parsed.productos.length > 0) {
        const { error } = await supabase.from('ventas').upsert(
          parsed.productos, { onConflict: 'fecha,producto,local' }
        );
        if (error) throw new Error('Productos: ' + error.message);
      }
      if (parsed.ordenes.length > 0) {
        const { error } = await supabase.from('ventas_ordenes').upsert(
          parsed.ordenes, { onConflict: 'id' }
        );
        if (error) throw new Error('Órdenes: ' + error.message);
      }
      setImportDone(true); setShowUpload(false);
      setFileProductos(null); setFileOrdenes(null); setParsed(null);
      await fetchVentas();
      setTimeout(() => setImportDone(false), 3000);
    } catch (e: any) { setImportError(e.message); }
    setImporting(false);
  };

  const onDrop = useCallback((e: React.DragEvent, type: 'productos' | 'ordenes') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === 'productos') setFileProductos(file);
    else setFileOrdenes(file);
  }, []);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10);

  // Filtro de período (día actual vs histórico mes)
  const ventasFiltradas  = filtroPeriodo === 'dia' ? ventas.filter(v => v.fecha === hoy)  : ventas;
  const ordenesFiltradas = filtroPeriodo === 'dia' ? ordenes.filter(o => o.fecha === hoy) : ordenes;

  // Filtro de local para la vista general
  const ventasVista  = filtroLocalVista === 'todos' ? ventasFiltradas  : ventasFiltradas.filter(v => v.local === filtroLocalVista);
  const ordenesVista = filtroLocalVista === 'todos' ? ordenesFiltradas : ordenesFiltradas.filter(o => o.local === filtroLocalVista);

  // KPIs generales
  const ordenesConTotal = ordenesVista.filter(o => o.total > 0);
  const totalFacturado  = ordenesConTotal.reduce((s, o) => s + o.total, 0);
  const totalOrdenes    = ordenesConTotal.length;
  const ticketPromedio  = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;

  // Por local — para cards y pie
  const statsPorLocal = LOCALES.map(loc => {
    const ords = ordenesFiltradas.filter(o => o.local === loc.id && o.total > 0);
    const vents = ventasFiltradas.filter(v => v.local === loc.id);
    const facturacion = ords.reduce((s, o) => s + o.total, 0);
    const mediodia = ords.filter(o => getTurno(o.creacion) === 'mediodia').reduce((s, o) => s + o.total, 0);
    const noche    = ords.filter(o => getTurno(o.creacion) === 'noche').reduce((s, o) => s + o.total, 0);
    const delivery  = ords.filter(o => o.tipo_venta === 'Delivery').length;
    const mostrador = ords.filter(o => o.tipo_venta === 'Mostrador').length;
    return { ...loc, facturacion, ordenes: ords.length, mediodia, noche, delivery, mostrador, vents };
  });
  const totalFact = statsPorLocal.reduce((s, l) => s + l.facturacion, 0);

  // Pie chart data
  const pieData = statsPorLocal
    .filter(l => l.facturacion > 0)
    .map(l => ({ label: l.label, value: l.facturacion, color: l.hex }));

  // Facturación por fecha (para gráfico)
  const porFecha: Record<string, number> = {};
  ordenesFiltradas.filter(o => o.total > 0).forEach(o => {
    if (!o.fecha) return;
    porFecha[o.fecha] = (porFecha[o.fecha] ?? 0) + o.total;
  });
  const fechasOrdenadas = Object.entries(porFecha).sort((a, b) => a[0].localeCompare(b[0]));
  const maxVenta = Math.max(...fechasOrdenadas.map(([, v]) => v), 1);

  // Facturación por fecha POR LOCAL (para gráfico stacked)
  const porFechaLocal: Record<string, Record<LocalId, number>> = {};
  ordenesFiltradas.filter(o => o.total > 0).forEach(o => {
    if (!o.fecha) return;
    if (!porFechaLocal[o.fecha]) porFechaLocal[o.fecha] = { burger: 0, lomito: 0, milanesa: 0 };
    porFechaLocal[o.fecha][o.local] = (porFechaLocal[o.fecha][o.local] ?? 0) + o.total;
  });

  // Top productos (filtrado)
  const porProducto: Record<string, { qty: number; monto: number; cat: string }> = {};
  ventasVista.forEach(v => {
    if (!porProducto[v.producto]) porProducto[v.producto] = { qty: 0, monto: 0, cat: v.categoria };
    porProducto[v.producto].qty   += v.cantidad;
    porProducto[v.producto].monto += v.monto_total;
  });
  const topProductos = Object.entries(porProducto).sort((a, b) => b[1].qty - a[1].qty).slice(0, expandTop ? 20 : 8);

  // Por categoría (filtrado)
  const porCategoria: Record<string, { qty: number; monto: number }> = {};
  ventasVista.forEach(v => {
    if (!porCategoria[v.categoria]) porCategoria[v.categoria] = { qty: 0, monto: 0 };
    porCategoria[v.categoria].qty   += v.cantidad;
    porCategoria[v.categoria].monto += v.monto_total;
  });
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1].monto - a[1].monto);

  // Medios de pago
  const mercadoPago = ordenesVista.filter(o => o.medio_pago?.toLowerCase().includes('mercado') && o.total > 0).length;
  const efectivo    = ordenesVista.filter(o => o.medio_pago?.toLowerCase().includes('efectivo') && o.total > 0).length;
  const delivery    = ordenesVista.filter(o => o.tipo_venta === 'Delivery' && o.total > 0).length;
  const mostrador   = ordenesVista.filter(o => o.tipo_venta === 'Mostrador' && o.total > 0).length;

  const hayDatos = ventas.length > 0;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl">Ventas</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {hayDatos
              ? `${ventas.length} productos · ${ordenes.length} órdenes · 3 locales`
              : 'Sin datos aún — cargá un reporte para comenzar'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {importDone && <span className="flex items-center gap-1 text-green-400 text-sm font-bold"><CheckCircle2 size={16} /> Importado</span>}
          <button onClick={fetchVentas} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={16} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowUpload(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-black text-sm rounded-xl hover:bg-slate-100 transition-colors">
            <Upload size={16} /> Cargar reporte
          </button>
        </div>
      </div>

      {/* ── PANEL UPLOAD ── */}
      {showUpload && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="font-black text-white flex items-center gap-2"><Upload size={18} /> Importar reporte</h3>

          {/* Selector de local */}
          <div>
            <p className="text-xs text-slate-400 font-black uppercase mb-2">¿De qué local es este reporte?</p>
            <div className="flex gap-2">
              {LOCALES.map(loc => (
                <button key={loc.id} onClick={() => setLocalSeleccionado(loc.id)}
                  className={`flex-1 py-3 rounded-xl font-black text-sm transition-all border-2
                    ${localSeleccionado === loc.id
                      ? `${loc.bg} ${loc.border} ${loc.color}`
                      : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>
                  {loc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reporte-Productos */}
            <div onDrop={e => onDrop(e, 'productos')} onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileProductos ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-productos')?.click()}>
              <input id="file-productos" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileProductos(e.target.files?.[0] ?? null)} />
              {fileProductos
                ? <div className="flex items-center justify-center gap-2 text-green-400"><CheckCircle2 size={20} /><span className="font-bold text-sm">{fileProductos.name}</span></div>
                : <><ShoppingBag size={32} className="text-slate-500 mx-auto mb-2" /><p className="font-bold text-slate-300 text-sm">Reporte-Productos.xlsx</p><p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p></>}
            </div>

            {/* ventas.xls */}
            <div onDrop={e => onDrop(e, 'ordenes')} onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileOrdenes ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-ordenes')?.click()}>
              <input id="file-ordenes" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileOrdenes(e.target.files?.[0] ?? null)} />
              {fileOrdenes
                ? <div className="flex items-center justify-center gap-2 text-green-400"><CheckCircle2 size={20} /><span className="font-bold text-sm">{fileOrdenes.name}</span></div>
                : <><BarChart3 size={32} className="text-slate-500 mx-auto mb-2" /><p className="font-bold text-slate-300 text-sm">ventas.xls</p><p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p></>}
            </div>
          </div>

          {parsing && <div className="flex items-center gap-3 text-slate-400 text-sm"><RefreshCw size={16} className="animate-spin" /> Leyendo archivos...</div>}

          {parsed && !parsing && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-slate-400 uppercase">Preview —</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${LOCALES.find(l => l.id === localSeleccionado)?.bg} ${LOCALES.find(l => l.id === localSeleccionado)?.color}`}>
                    {LOCALES.find(l => l.id === localSeleccionado)?.label}
                  </span>
                </div>
                {parsed.errorProductos && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={14} /> {parsed.errorProductos}</p>}
                {parsed.errorOrdenes   && <p className="text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={14} /> {parsed.errorOrdenes}</p>}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-2xl font-black text-white">{parsed.productos.length}</p><p className="text-xs text-slate-400">productos</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-2xl font-black text-white">{parsed.ordenes.length}</p><p className="text-xs text-slate-400">órdenes</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-lg font-black text-green-400">{fmt$(parsed.ordenes.filter(o => o.total > 0).reduce((s, o) => s + o.total, 0))}</p><p className="text-xs text-slate-400">facturado</p></div>
                  <div className="bg-slate-700 rounded-xl p-3"><p className="text-sm font-black text-slate-300">{fmtDate(parsed.fechaDesde)}</p><p className="text-xs text-slate-400">período</p></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Top 5</p>
                  {[...parsed.productos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5).map((p, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-slate-700 last:border-0">
                      <span className="text-sm text-slate-300 font-bold">{p.producto}</span>
                      <div className="flex gap-4"><span className="text-xs text-slate-400">{p.cantidad} u</span><span className="text-xs font-black text-green-400">{fmt$(p.monto_total)}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {importError && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={16} /> {importError}</p>}
              <div className="flex gap-3">
                <button onClick={handleImport} disabled={importing}
                  className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {importing ? <><RefreshCw size={16} className="animate-spin" /> Importando...</> : <><CheckCircle2 size={16} /> Confirmar importación</>}
                </button>
                <button onClick={() => { setFileProductos(null); setFileOrdenes(null); setParsed(null); setShowUpload(false); }}
                  className="px-4 py-3 bg-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-600 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sin datos */}
      {!loadingData && !hayDatos && (
        <div className="text-center py-24 text-slate-600">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-black text-lg">Sin datos de ventas</p>
          <p className="text-sm mt-1">Cargá los reportes de cada local con el botón de arriba</p>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {hayDatos && (
        <>
          {/* Filtros globales */}
          <div className="flex items-center justify-between">
            {/* Período */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
              {([['dia', 'Hoy'], ['mes', 'Histórico']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFiltroPeriodo(id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${filtroPeriodo === id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* Filtro local */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
              <button onClick={() => setFiltroLocalVista('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtroLocalVista === 'todos' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                Todos
              </button>
              {LOCALES.map(loc => (
                <button key={loc.id} onClick={() => setFiltroLocalVista(loc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                    ${filtroLocalVista === loc.id ? `${loc.bg} ${loc.color}` : 'text-slate-400 hover:text-white'}`}>
                  {loc.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs generales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total facturado',  value: fmt$(totalFacturado),           color: 'text-green-400',  bg: 'bg-green-500/10',  icon: <TrendingUp size={20} /> },
              { label: 'Órdenes',          value: totalOrdenes,                   color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: <ShoppingBag size={20} /> },
              { label: 'Ticket promedio',  value: fmt$(Math.round(ticketPromedio)),color: 'text-amber-400',  bg: 'bg-amber-500/10',  icon: <BarChart3 size={20} /> },
              { label: 'Productos únicos', value: Object.keys(porProducto).length, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: <Package size={20} /> },
            ].map((k, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
                <p className={`text-2xl font-black ${k.color} mb-1`}>{k.value}</p>
                <p className="text-slate-400 text-xs font-medium">{k.label}</p>
              </div>
            ))}
          </div>

          {/* ── CARDS POR LOCAL con turnos ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statsPorLocal.map(loc => (
              <div key={loc.id} className={`bg-slate-900 border-2 ${loc.border} rounded-2xl p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-black text-sm ${loc.color}`}>{loc.label}</h3>
                  <span className="text-xs text-slate-500">{loc.ordenes} órdenes</span>
                </div>
                <div>
                  <p className={`text-3xl font-black ${loc.color}`}>{fmt$(loc.facturacion)}</p>
                  {totalFact > 0 && (
                    <div className="mt-2 bg-slate-800 rounded-full h-1.5">
                      <div className={`${loc.bar} h-1.5 rounded-full`} style={{ width: `${(loc.facturacion / totalFact) * 100}%` }} />
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{totalFact > 0 ? Math.round((loc.facturacion / totalFact) * 100) : 0}% del total</p>
                </div>
                {/* Turnos */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">☀️ Mediodía</p>
                    <p className={`text-sm font-black ${loc.color}`}>{fmt$(loc.mediodia)}</p>
                    <p className="text-[10px] text-slate-600">12hs – 15hs</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">🌙 Noche</p>
                    <p className={`text-sm font-black ${loc.color}`}>{fmt$(loc.noche)}</p>
                    <p className="text-[10px] text-slate-600">20hs – 00hs</p>
                  </div>
                </div>
                {/* Delivery/Mostrador mini */}
                <div className="flex gap-3 text-xs text-slate-400">
                  <span>🛵 {loc.delivery} delivery</span>
                  <span>🏪 {loc.mostrador} mostrador</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Gráfico de torta + barra por día ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Pie */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-400 uppercase">Participación por local</p>
                <span className="text-xs text-slate-600">{filtroPeriodo === 'dia' ? 'Hoy' : 'Histórico'}</span>
              </div>
              <PieChart data={pieData} />
              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                {statsPorLocal.map(loc => (
                  <div key={loc.id}>
                    <p className={`text-xs font-black ${loc.color}`}>{fmt$(loc.facturacion)}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{loc.label.split(' ')[0]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Barra por día */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Facturación por día</p>
              {fechasOrdenadas.length === 0
                ? <div className="text-center py-8 text-slate-600 text-sm">Sin datos para el período</div>
                : (
                  <div className="flex items-end gap-2 h-32">
                    {fechasOrdenadas.map(([fecha]) => {
                      const locData = porFechaLocal[fecha] ?? { burger: 0, lomito: 0, milanesa: 0 };
                      const total   = LOCALES.reduce((s, l) => s + (locData[l.id] ?? 0), 0);
                      return (
                        <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-black px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {fmt$(total)}
                          </div>
                          {/* Stacked bar */}
                          <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(4, (total / maxVenta) * 120)}px` }}>
                            {LOCALES.map(loc => {
                              const h = total > 0 ? ((locData[loc.id] ?? 0) / total) * 100 : 0;
                              return h > 0 ? <div key={loc.id} className={`w-full ${loc.bar}`} style={{ height: `${h}%` }} /> : null;
                            })}
                          </div>
                          <span className="text-[9px] text-slate-500 whitespace-nowrap">
                            {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              {/* Leyenda */}
              <div className="flex gap-4 mt-3 justify-center">
                {LOCALES.map(loc => (
                  <span key={loc.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${loc.bar}`} /> {loc.label.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery/Mostrador + Medios de pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Tipo de venta</p>
              <div className="space-y-3">
                {[{ label: 'Delivery', value: delivery, icon: <Truck size={16} />, color: 'text-blue-400', bar: 'bg-blue-500' },
                  { label: 'Mostrador', value: mostrador, icon: <ShoppingBag size={16} />, color: 'text-amber-400', bar: 'bg-amber-500' }].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>{item.icon} {item.label}</span>
                      <span className="text-white font-black">{item.value} <span className="text-slate-500 text-xs">({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)</span></span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full`} style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Medio de pago</p>
              <div className="space-y-3">
                {[{ label: 'Mercado Pago', value: mercadoPago, icon: <CreditCard size={16} />, color: 'text-blue-400', bar: 'bg-blue-500' },
                  { label: 'Efectivo',     value: efectivo,    icon: <Banknote size={16} />,   color: 'text-green-400', bar: 'bg-green-500' }].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>{item.icon} {item.label}</span>
                      <span className="text-white font-black">{item.value} <span className="text-slate-500 text-xs">({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)</span></span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full`} style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Por categoría */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800"><h3 className="font-bold text-white">Ventas por categoría</h3></div>
            <div className="divide-y divide-slate-800">
              {categoriasOrdenadas.map(([cat, stats]) => (
                <div key={cat} className="px-6 py-4">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-slate-200 text-sm">{cat}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400">{stats.qty} u</span>
                      <span className="text-sm font-black text-green-400">{fmt$(stats.monto)}</span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(stats.monto / (categoriasOrdenadas[0]?.[1]?.monto || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top productos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Top productos vendidos</h3>
              <button onClick={() => setExpandTop(v => !v)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                {expandTop ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver todos</>}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Producto</th>
                  <th className="px-6 py-3 text-left">Categoría</th>
                  <th className="px-6 py-3 text-right">Unidades</th>
                  <th className="px-6 py-3 text-right">Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {topProductos.map(([producto, stats], i) => (
                  <tr key={producto} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 text-slate-600 font-black text-xs">{i + 1}</td>
                    <td className="px-6 py-3 font-bold text-white">{producto}</td>
                    <td className="px-6 py-3 text-slate-400 text-xs">{stats.cat}</td>
                    <td className="px-6 py-3 text-right font-black text-blue-400">{stats.qty}</td>
                    <td className="px-6 py-3 text-right font-black text-green-400">{fmt$(stats.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}