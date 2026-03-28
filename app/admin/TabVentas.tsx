"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  Upload, CheckCircle2, AlertTriangle, RefreshCw, X,
  TrendingUp, ShoppingBag, Truck, CreditCard, Banknote,
  BarChart3, Package, ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type VentaProducto = {
  fecha: string;
  categoria: string;
  producto: string;
  cantidad: number;
  monto_total: number;
};

type VentaOrden = {
  id: number;
  fecha: string | null;
  creacion: string | null;
  cerrada: string | null;
  cliente: string | null;
  medio_pago: string | null;
  total: number;
  fiscal: boolean;
  tipo_venta: string | null;
  origen: string | null;
  comentario: string | null;
};

type ParseResult = {
  productos: VentaProducto[];
  ordenes: VentaOrden[];
  fechaDesde: string;
  fechaHasta: string;
  errorProductos?: string;
  errorOrdenes?: string;
};

// ─── Parser de Reporte-Productos.xlsx ────────────────────────────────────────
function parseProductos(wb: XLSX.WorkBook): { data: VentaProducto[]; error?: string } {
  try {
    const ws = wb.Sheets['Detalle'] ?? wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // Row 0 = headers: Fecha, Categoría, Sub categoría, Producto, Cantidades vendidas, Monto total
    const data: VentaProducto[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[3]) continue; // sin producto
      const rawFecha = r[0];
      let fecha = '';
      if (rawFecha instanceof Date) {
        fecha = rawFecha.toISOString().slice(0, 10);
      } else if (typeof rawFecha === 'number') {
        // Excel serial date
        const d = new Date((rawFecha - 25569) * 86400 * 1000);
        fecha = d.toISOString().slice(0, 10);
      } else if (typeof rawFecha === 'string') {
        fecha = rawFecha.slice(0, 10);
      }
      data.push({
        fecha,
        categoria: String(r[1] ?? '').toUpperCase(),
        producto:  String(r[3] ?? '').toUpperCase(),
        cantidad:  Number(r[4]) || 0,
        monto_total: Number(r[5]) || 0,
      });
    }
    return { data };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

// ─── Parser de ventas.xls ────────────────────────────────────────────────────
function parseOrdenes(wb: XLSX.WorkBook): { data: VentaOrden[]; error?: string } {
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // Find the real header row (contains 'Id')
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
      const totalRaw = Number(r[col('Total')]) || 0;
      const fiscalRaw = String(r[col('Fiscal')] ?? '').toLowerCase();
      data.push({
        id,
        fecha:      toDate(r[col('Fecha')])?.slice(0, 10) ?? null,
        creacion:   toDate(r[col('Creación')]),
        cerrada:    toDate(r[col('Cerrada')]),
        cliente:    r[col('Cliente')] ? String(r[col('Cliente')]) : null,
        medio_pago: r[col('Medio de Pago')] ? String(r[col('Medio de Pago')]) : null,
        total:      totalRaw,
        fiscal:     fiscalRaw === 'si' || fiscalRaw === 'sí' || fiscalRaw === 'true',
        tipo_venta: r[col('Tipo de Venta')] ? String(r[col('Tipo de Venta')]) : null,
        origen:     r[col('Origen')] ? String(r[col('Origen')]) : null,
        comentario: r[col('Comentario')] ? String(r[col('Comentario')]) : null,
      });
    }
    return { data };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

// ─── Leer archivo como workbook ───────────────────────────────────────────────
function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        resolve(wb);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0 });

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-AR');
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TabVentas() {
  // Upload state
  const [fileProductos, setFileProductos] = useState<File | null>(null);
  const [fileOrdenes, setFileOrdenes]     = useState<File | null>(null);
  const [parsed, setParsed]               = useState<ParseResult | null>(null);
  const [parsing, setParsing]             = useState(false);
  const [importing, setImporting]         = useState(false);
  const [importDone, setImportDone]       = useState(false);
  const [importError, setImportError]     = useState('');

  // Analytics state
  const [ventas, setVentas]     = useState<VentaProducto[]>([]);
  const [ordenes, setOrdenes]   = useState<VentaOrden[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showUpload, setShowUpload]   = useState(false);
  const [expandTop, setExpandTop]     = useState(false);

  // Cargar datos de Supabase
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

  // Parsear cuando ambos archivos están cargados
  useEffect(() => {
    if (!fileProductos || !fileOrdenes) return;
    (async () => {
      setParsing(true);
      setParsed(null);
      try {
        const [wb1, wb2] = await Promise.all([
          readWorkbook(fileProductos),
          readWorkbook(fileOrdenes),
        ]);
        const { data: prods, error: e1 } = parseProductos(wb1);
        const { data: ords,  error: e2 } = parseOrdenes(wb2);

        const fechas = prods.map(p => p.fecha).filter(Boolean).sort();
        const fechasOrd = ords.map(o => o.fecha).filter(Boolean).sort() as string[];
        const allFechas = [...fechas, ...fechasOrd].sort();

        setParsed({
          productos: prods,
          ordenes: ords,
          fechaDesde: allFechas[0] ?? '',
          fechaHasta: allFechas[allFechas.length - 1] ?? '',
          errorProductos: e1,
          errorOrdenes: e2,
        });
      } catch (e: any) {
        setImportError('Error al leer los archivos: ' + e.message);
      }
      setParsing(false);
    })();
  }, [fileProductos, fileOrdenes]);

  // Importar a Supabase
  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setImportError('');
    try {
      // Upsert productos (por fecha+producto para evitar duplicados)
      if (parsed.productos.length > 0) {
        const { error } = await supabase.from('ventas').upsert(
          parsed.productos.map(p => ({ ...p })),
          { onConflict: 'fecha,producto' }
        );
        if (error) throw new Error('Productos: ' + error.message);
      }
      // Upsert órdenes (por id)
      if (parsed.ordenes.length > 0) {
        const { error } = await supabase.from('ventas_ordenes').upsert(
          parsed.ordenes,
          { onConflict: 'id' }
        );
        if (error) throw new Error('Órdenes: ' + error.message);
      }
      setImportDone(true);
      setShowUpload(false);
      setFileProductos(null);
      setFileOrdenes(null);
      setParsed(null);
      await fetchVentas();
      setTimeout(() => setImportDone(false), 3000);
    } catch (e: any) {
      setImportError(e.message);
    }
    setImporting(false);
  };

  // Drag & drop
  const onDrop = useCallback((e: React.DragEvent, type: 'productos' | 'ordenes') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (type === 'productos') setFileProductos(file);
    else setFileOrdenes(file);
  }, []);

  // ── Analytics calculadas desde Supabase ────────────────────────────────────
  const totalFacturado   = ordenes.filter(o => o.total > 0).reduce((s, o) => s + o.total, 0);
  const totalOrdenes     = ordenes.filter(o => o.total > 0).length;
  const ticketPromedio   = totalOrdenes > 0 ? totalFacturado / totalOrdenes : 0;
  const delivery         = ordenes.filter(o => o.tipo_venta === 'Delivery' && o.total > 0).length;
  const mostrador        = ordenes.filter(o => o.tipo_venta === 'Mostrador' && o.total > 0).length;
  const mercadoPago      = ordenes.filter(o => o.medio_pago?.toLowerCase().includes('mercado') && o.total > 0).length;
  const efectivo         = ordenes.filter(o => o.medio_pago?.toLowerCase().includes('efectivo') && o.total > 0).length;

  // Por categoría
  const porCategoria: Record<string, { qty: number; monto: number }> = {};
  ventas.forEach(v => {
    if (!porCategoria[v.categoria]) porCategoria[v.categoria] = { qty: 0, monto: 0 };
    porCategoria[v.categoria].qty   += v.cantidad;
    porCategoria[v.categoria].monto += v.monto_total;
  });
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1].monto - a[1].monto);

  // Top productos
  const porProducto: Record<string, { qty: number; monto: number; cat: string }> = {};
  ventas.forEach(v => {
    if (!porProducto[v.producto]) porProducto[v.producto] = { qty: 0, monto: 0, cat: v.categoria };
    porProducto[v.producto].qty   += v.cantidad;
    porProducto[v.producto].monto += v.monto_total;
  });
  const topProductos = Object.entries(porProducto)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, expandTop ? 20 : 8);

  // Por fecha (para timeline)
  const porFecha: Record<string, number> = {};
  ordenes.filter(o => o.total > 0).forEach(o => {
    if (!o.fecha) return;
    porFecha[o.fecha] = (porFecha[o.fecha] ?? 0) + o.total;
  });
  const fechasOrdenadas = Object.entries(porFecha).sort((a, b) => a[0].localeCompare(b[0]));
  const maxVenta = Math.max(...fechasOrdenadas.map(([, v]) => v), 1);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header con botón cargar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl">Ventas</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {ventas.length > 0
              ? `${ventas.length} productos · ${ordenes.length} órdenes registradas`
              : 'Sin datos aún — cargá un reporte para comenzar'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {importDone && (
            <span className="flex items-center gap-1 text-green-400 text-sm font-bold">
              <CheckCircle2 size={16} /> Importado
            </span>
          )}
          <button onClick={fetchVentas} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={16} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowUpload(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-black text-sm rounded-xl hover:bg-slate-100 transition-colors">
            <Upload size={16} /> Cargar reporte
          </button>
        </div>
      </div>

      {/* ── PANEL UPLOAD ── */}
      {showUpload && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
          <h3 className="font-black text-white flex items-center gap-2">
            <Upload size={18} /> Importar reportes del día
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reporte-Productos.xlsx */}
            <div
              onDrop={e => onDrop(e, 'productos')}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileProductos ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-productos')?.click()}>
              <input id="file-productos" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileProductos(e.target.files?.[0] ?? null)} />
              {fileProductos ? (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle2 size={20} />
                  <span className="font-bold text-sm">{fileProductos.name}</span>
                </div>
              ) : (
                <>
                  <ShoppingBag size={32} className="text-slate-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-300 text-sm">Reporte-Productos.xlsx</p>
                  <p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p>
                </>
              )}
            </div>

            {/* ventas.xls */}
            <div
              onDrop={e => onDrop(e, 'ordenes')}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
                ${fileOrdenes ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-400'}`}
              onClick={() => document.getElementById('file-ordenes')?.click()}>
              <input id="file-ordenes" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => setFileOrdenes(e.target.files?.[0] ?? null)} />
              {fileOrdenes ? (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle2 size={20} />
                  <span className="font-bold text-sm">{fileOrdenes.name}</span>
                </div>
              ) : (
                <>
                  <BarChart3 size={32} className="text-slate-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-300 text-sm">ventas.xls</p>
                  <p className="text-slate-500 text-xs mt-1">Arrastrá o hacé click</p>
                </>
              )}
            </div>
          </div>

          {/* Parsing spinner */}
          {parsing && (
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin" />
              Leyendo archivos...
            </div>
          )}

          {/* Preview */}
          {parsed && !parsing && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Preview</p>

                {parsed.errorProductos && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle size={14} /> Error productos: {parsed.errorProductos}
                  </p>
                )}
                {parsed.errorOrdenes && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle size={14} /> Error órdenes: {parsed.errorOrdenes}
                  </p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-700 rounded-xl p-3">
                    <p className="text-2xl font-black text-white">{parsed.productos.length}</p>
                    <p className="text-xs text-slate-400">productos distintos</p>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-3">
                    <p className="text-2xl font-black text-white">{parsed.ordenes.length}</p>
                    <p className="text-xs text-slate-400">órdenes</p>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-3">
                    <p className="text-lg font-black text-green-400">
                      {fmt$(parsed.ordenes.filter(o => o.total > 0).reduce((s, o) => s + o.total, 0))}
                    </p>
                    <p className="text-xs text-slate-400">facturado</p>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-3">
                    <p className="text-sm font-black text-slate-300">
                      {parsed.fechaDesde ? fmtDate(parsed.fechaDesde) : '—'}
                      {parsed.fechaDesde !== parsed.fechaHasta && parsed.fechaHasta
                        ? ` → ${fmtDate(parsed.fechaHasta)}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">período</p>
                  </div>
                </div>

                {/* Top 5 preview */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-bold uppercase">Top productos del reporte</p>
                  {[...parsed.productos]
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .slice(0, 5)
                    .map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
                        <span className="text-sm text-slate-300 font-bold">{p.producto}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-400">{p.cantidad} u</span>
                          <span className="text-xs font-black text-green-400">{fmt$(p.monto_total)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {importError && (
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {importError}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={handleImport} disabled={importing}
                  className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {importing
                    ? <><RefreshCw size={16} className="animate-spin" /> Importando...</>
                    : <><CheckCircle2 size={16} /> Confirmar importación</>}
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

      {/* ── SIN DATOS ── */}
      {!loadingData && ventas.length === 0 && (
        <div className="text-center py-24 text-slate-600">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-black text-lg">Sin datos de ventas</p>
          <p className="text-sm mt-1">Cargá los reportes diarios con el botón de arriba</p>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {ventas.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total facturado',  value: fmt$(totalFacturado),        icon: <TrendingUp size={20} />,  color: 'text-green-400',  bg: 'bg-green-500/10' },
              { label: 'Órdenes',          value: totalOrdenes,                icon: <ShoppingBag size={20} />, color: 'text-blue-400',   bg: 'bg-blue-500/10' },
              { label: 'Ticket promedio',  value: fmt$(Math.round(ticketPromedio)), icon: <BarChart3 size={20} />,  color: 'text-amber-400',  bg: 'bg-amber-500/10' },
              { label: 'Productos únicos', value: Object.keys(porProducto).length, icon: <Package size={20} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            ].map((k, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
                <p className={`text-2xl font-black ${k.color} mb-1`}>{k.value}</p>
                <p className="text-slate-400 text-xs font-medium">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Delivery vs Mostrador + Medio de pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Tipo de venta</p>
              <div className="space-y-3">
                {[
                  { label: 'Delivery',   value: delivery,   icon: <Truck size={16} />,       color: 'text-blue-400',  bar: 'bg-blue-500' },
                  { label: 'Mostrador',  value: mostrador,  icon: <ShoppingBag size={16} />, color: 'text-amber-400', bar: 'bg-amber-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>
                        {item.icon} {item.label}
                      </span>
                      <span className="text-white font-black">
                        {item.value} <span className="text-slate-500 text-xs font-normal">
                          ({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full transition-all`}
                        style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Medio de pago</p>
              <div className="space-y-3">
                {[
                  { label: 'Mercado Pago', value: mercadoPago, icon: <CreditCard size={16} />, color: 'text-blue-400',  bar: 'bg-blue-500' },
                  { label: 'Efectivo',     value: efectivo,    icon: <Banknote size={16} />,   color: 'text-green-400', bar: 'bg-green-500' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`flex items-center gap-2 text-sm font-bold ${item.color}`}>
                        {item.icon} {item.label}
                      </span>
                      <span className="text-white font-black">
                        {item.value} <span className="text-slate-500 text-xs font-normal">
                          ({totalOrdenes > 0 ? Math.round((item.value / totalOrdenes) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-2">
                      <div className={`${item.bar} h-2 rounded-full transition-all`}
                        style={{ width: `${totalOrdenes > 0 ? (item.value / totalOrdenes) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Facturación por fecha */}
          {fechasOrdenadas.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase mb-4">Facturación por día</p>
              <div className="flex items-end gap-2 h-28">
                {fechasOrdenadas.map(([fecha, total]) => (
                  <div key={fecha} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] font-black px-2 py-0.5 rounded
                      opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {fmt$(total)}
                    </div>
                    <div className="w-full bg-green-500 rounded-t-lg transition-all hover:bg-green-400"
                      style={{ height: `${Math.max(4, (total / maxVenta) * 100)}px` }} />
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Por categoría */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="font-bold text-white">Ventas por categoría</h3>
            </div>
            <div className="divide-y divide-slate-800">
              {categoriasOrdenadas.map(([cat, stats]) => (
                <div key={cat} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-slate-200 text-sm">{cat}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">{stats.qty} u</span>
                        <span className="text-sm font-black text-green-400">{fmt$(stats.monto)}</span>
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-full h-1.5">
                      <div className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${(stats.monto / (categoriasOrdenadas[0]?.[1]?.monto || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top productos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Top productos vendidos</h3>
              <button onClick={() => setExpandTop(v => !v)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
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