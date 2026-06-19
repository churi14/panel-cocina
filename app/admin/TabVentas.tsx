"use client";
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ShoppingCart, Package } from 'lucide-react';
import { supabase } from '../supabase';

// ── MAPEO Fudo → stock_produccion ─────────────────────────────────────────────
type StockDescuento = { producto: string; cantidad: number; unidad: 'u' | 'kg' };

const FUDO_STOCK_MAP: Record<string, StockDescuento[]> = {
  // ── LOMITO (1 bife por sandwich) ─────────────────────────────────────────
  '1 lomo clasico':              [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  '1 lomo provoleta':            [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  '1 lomo criollo':              [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  '1 lomo provoleta.':           [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  'simple tucumano':             [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  'clasico tucumano':            [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  'especial cebolla tucumano':   [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  'lomito clasico':              [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],
  'lomito':                      [{ producto: 'Bifes Lomito_Lomo', cantidad: 1, unidad: 'u' }],

  // ── PROMOS LOMITO ─────────────────────────────────────────────────────────
  'promo clasico x2':            [{ producto: 'Bifes Lomito_Lomo', cantidad: 2, unidad: 'u' }],
  'promo sanguche clasico x2':   [{ producto: 'Bifes Lomito_Lomo', cantidad: 2, unidad: 'u' }],

  // ── BURGER (medallones según cantidad) ────────────────────────────────────
  // Simple = 1, Doble = 2, Triple = 3, Cuádruple = 4
  'cheese simple':               [{ producto: 'Medallones Burger', cantidad: 1, unidad: 'u' }],
  'cheese triple':               [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'cheese cuadruple':            [{ producto: 'Medallones Burger', cantidad: 4, unidad: 'u' }],
  'cheese cuadruple':            [{ producto: 'Medallones Burger', cantidad: 4, unidad: 'u' }],
  'bacon doble':                 [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'bacon triple':                [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'bacon cuadruple':             [{ producto: 'Medallones Burger', cantidad: 4, unidad: 'u' }],
  'bacon jam triple':            [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'bacon jam doble':             [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'bacon crispy doble':          [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'bacon crispy simple':         [{ producto: 'Medallones Burger', cantidad: 1, unidad: 'u' }],
  'animal style doble':          [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'hamburguesa bacon triple':    [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'hamburguesa cheese doble':    [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'hamburguesa bacon doble':     [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'hamburguesa peaky triple':    [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'hamburguesa la club doble':   [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'peaky triple':                [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'la club doble':               [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'la club triple':              [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],
  'burger club':                 [{ producto: 'Medallones Burger', cantidad: 1, unidad: 'u' }],
  'burger simple':               [{ producto: 'Medallones Burger', cantidad: 1, unidad: 'u' }],
  'burger doble':                [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'burger triple':               [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],

  // ── MILANESA (200g por porción aprox) ────────────────────────────────────
  'milanesa de carne':           [{ producto: 'Milanesa de Carne Empanada', cantidad: 0.2, unidad: 'kg' }],
  'milanesa de pollo':           [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.2, unidad: 'kg' }],
  'mila de carne':               [{ producto: 'Milanesa de Carne Empanada', cantidad: 0.2, unidad: 'kg' }],
  'mila de pollo':               [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.2, unidad: 'kg' }],
  'promo mila clasica x2':       [{ producto: 'Milanesa de Carne Empanada', cantidad: 0.4, unidad: 'kg' }],
  'promo suprema clasica x2':    [{ producto: 'Milanesa de Carne Empanada', cantidad: 0.4, unidad: 'kg' }],

  // ── SUPREMA = milanesa de pollo ──────────────────────────────────────────
  'suprema delux':               [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.2, unidad: 'kg' }],
  'suprema delux f':             [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.2, unidad: 'kg' }],
  'suprema portena al plato':    [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.25, unidad: 'kg' }],
  'suprema portena al plato f':  [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.25, unidad: 'kg' }],
  'promo suprema clasica x2':    [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.4, unidad: 'kg' }],
  'suprema':                     [{ producto: 'Milanesa de Pollo Empanada', cantidad: 0.2, unidad: 'kg' }],

  // ── ANIMAL STYLE = burger ─────────────────────────────────────────────────
  'animal style doble':          [{ producto: 'Medallones Burger', cantidad: 2, unidad: 'u' }],
  'animal style triple':         [{ producto: 'Medallones Burger', cantidad: 3, unidad: 'u' }],

  // ── BROLA = helados → no afectan stock de producción ─────────────────────
  // brola kinder, brola de chocotorta → ignorar

  // ── IGNORAR (bebidas, papas, envío, helados) ──────────────────────────────
  // coca cola, sprite, aguarius, papas, costo de envio, producto generico, brola
};

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function buscarEnMapa(nombreFudo: string): StockDescuento[] | null {
  const norm = normalizar(nombreFudo);
  if (FUDO_STOCK_MAP[norm]) return FUDO_STOCK_MAP[norm];
  for (const [key, val] of Object.entries(FUDO_STOCK_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
}

type SaleItem = { name?: string; nombre?: string; productName?: string; quantity?: number; cantidad?: number; };
type Sale     = { id: string | number; fecha?: string; date?: string; created_at?: string; total?: number; items?: SaleItem[]; subitems?: SaleItem[]; };
type SyncResumen = { ventas: number; itemsReconocidos: number; itemsNoReconocidos: string[]; descuentos: { producto: string; total: number; unidad: string }[]; };

export default function TabVentas() {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al traer ventas de Fudo');

      const sales: Sale[] = data.sales ?? [];
      setSalesRaw(sales);

      const descuentoMap: Record<string, { total: number; unidad: string }> = {};
      const noReconocidos = new Set<string>();
      let itemsReconocidos = 0;

      for (const sale of sales) {
        const items: SaleItem[] = sale.items ?? sale.subitems ?? [];
        for (const item of items) {
          const nombre = item.name ?? item.nombre ?? item.productName ?? '';
          const qty    = item.quantity ?? item.cantidad ?? 1;
          const descuentos = buscarEnMapa(nombre);
          if (descuentos) {
            itemsReconocidos++;
            for (const d of descuentos) {
              if (!descuentoMap[d.producto]) descuentoMap[d.producto] = { total: 0, unidad: d.unidad };
              descuentoMap[d.producto].total += d.cantidad * qty;
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
        descuentos: Object.entries(descuentoMap).map(([producto, v]) => ({
          producto, total: parseFloat(v.total.toFixed(3)), unidad: v.unidad,
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
        const { data: sp } = await supabase.from('stock_produccion')
          .select('id, cantidad').ilike('producto', d.producto).maybeSingle();
        if (sp) {
          await supabase.from('stock_produccion').update({
            cantidad: parseFloat((Number(sp.cantidad) - d.total).toFixed(3)),
            ultima_prod: new Date().toISOString(),
          }).eq('id', sp.id);
          await supabase.from('stock_movements').insert({
            nombre: d.producto, tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
            motivo: `Ventas Fudo ${desde}${desde !== hasta ? ' → ' + hasta : ''}`,
            operador: 'Fudo API', fecha: new Date().toISOString(),
          });
        }
      }
      await supabase.from('fudo_sync_log').insert({ desde, hasta, ventas: resumen.ventas, descuentos: resumen.descuentos });
      setLastSync(new Date().toISOString());
      setApplied(true);
    } catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-black text-xl text-white">Ventas Fudo</h2>
        {lastSync && <p className="text-xs text-slate-500 mt-0.5">Última sync: {new Date(lastSync).toLocaleDateString('es-AR')} {new Date(lastSync).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>

      {/* Selector de fechas */}
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
          <button onClick={fetchSales} disabled={loading}
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
          <p className="text-green-400 font-black text-sm">Descuentos aplicados correctamente al stock de producción.</p>
        </div>
      )}

      {resumen && !applied && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Ventas totales',     value: resumen.ventas,              color: 'text-white' },
              { label: 'Items reconocidos',   value: resumen.itemsReconocidos,    color: 'text-green-400' },
              { label: 'Sin mapeo',           value: resumen.itemsNoReconocidos.length, color: 'text-amber-400' },
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
                <p className="font-black text-sm text-slate-300 uppercase">📉 Se va a descontar del stock:</p>
              </div>
              {resumen.descuentos.map((d, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between border-b border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <Package size={15} className="text-slate-500" />
                    <span className="font-bold text-white text-sm">{d.producto}</span>
                  </div>
                  <span className="font-black text-red-400">−{d.total} {d.unidad}</span>
                </div>
              ))}
            </div>
          )}

          {resumen.itemsNoReconocidos.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-black text-amber-400 uppercase mb-2">⚠️ Productos de Fudo sin mapeo (no se descuentan):</p>
              <div className="flex flex-wrap gap-2">
                {resumen.itemsNoReconocidos.map((n, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg">{n}</span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Mandales estos nombres a Julian para agregarlos al mapeo.</p>
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
            <p className="font-black text-xs text-slate-400 uppercase">{salesRaw.length} ventas del período</p>
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