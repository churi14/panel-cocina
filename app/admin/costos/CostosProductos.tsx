"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, AlertTriangle, Check } from 'lucide-react';
import { formatNumero, formatPlata } from '../format';
import HopeSwitch from '../HopeSwitch';
import { PrecioInput, fmtQty, type DatosCostos } from './shared';
import {
  CLAVE_VENTA, categoriaProducto, costoProducto, crearResolver, destinoPrecio, norm,
  type RecetaFudoRow, type ResultadoProducto,
} from './engine';

// ─────────────────────────────────────────────────────────────────────────────
// Costos por producto (lomitos, burgers, milanesas…): una tarjeta por producto de Fudo
// con su costo, el precio de venta y el margen. Las recetas se leen de recetas_fudo;
// no se escribe nada en Fudo.
// ─────────────────────────────────────────────────────────────────────────────

const nombreLindo = (n: string) => n.replace(/\b\p{L}/gu, c => c.toUpperCase());
type Categoria = 'Lomitos' | 'Burgers' | 'Milanesas' | 'Sánguches' | 'Promos';
const CATEGORIAS: Categoria[] = ['Lomitos', 'Burgers', 'Milanesas', 'Sánguches', 'Promos'];

type Producto = { nombre: string; categoria: Categoria; res: ResultadoProducto; venta: number | null };

/** Color según qué parte del precio es costo: hasta 30 % bien, hasta 40 % atención, más es caro. */
const tonoCosto = (fc: number) => fc <= 30 ? 'green' : fc <= 40 ? 'amber' : 'red';
const TONOS = {
  green: { txt: 'text-green-400', barra: 'bg-green-500', pill: 'bg-green-500/15 text-green-400' },
  amber: { txt: 'text-amber-400', barra: 'bg-amber-500', pill: 'bg-amber-500/15 text-amber-400' },
  red:   { txt: 'text-red-400',   barra: 'bg-red-500',   pill: 'bg-red-500/15 text-red-400' },
};

export default function CostosProductos({ datos, irAPrecios }: { datos: DatosCostos; irAPrecios: () => void }) {
  const { precios, guardar, stockRows, recetasFudo, cargado } = datos;
  const [cat, setCat] = useState<Categoria>('Lomitos');
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  const productos = useMemo<Producto[]>(() => {
    const resolver = crearResolver(stockRows, precios);
    const porProducto = new Map<string, RecetaFudoRow[]>();
    recetasFudo.forEach(r => porProducto.set(r.producto_fudo, [...(porProducto.get(r.producto_fudo) ?? []), r]));
    return [...porProducto.entries()].map(([nombre, rows]) => ({
      nombre, categoria: categoriaProducto(nombre) as Categoria,
      res: costoProducto(rows, resolver),
      venta: precios[CLAVE_VENTA + norm(nombre)]?.precio ?? null,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [recetasFudo, stockRows, precios]);

  // Esc cierra el detalle
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const guardarVenta = (p: Producto, v: number | null) => guardar(CLAVE_VENTA + norm(p.nombre), p.nombre, v, 'venta');

  if (!cargado) return <p className="text-center text-slate-500 font-bold py-16">Cargando recetas…</p>;
  if (productos.length === 0) return <p className="text-center text-slate-500 font-bold py-16">No hay recetas de Fudo cargadas (tabla recetas_fudo).</p>;

  const completos = productos.filter(p => !p.res.incompleto).length;
  const pct = Math.round((completos / productos.length) * 100);
  const contar = (c: Categoria) => productos.filter(p => p.categoria === c).length;
  const visibles = productos
    .filter(p => p.categoria === cat)
    .filter(p => !q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  const detalle = productos.find(p => p.nombre === abierto) ?? null;

  return (
    <div className="space-y-5">
      {/* Avance general */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex-1 min-w-56">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-sm font-black text-white">{completos} de {productos.length} productos con costo completo</p>
            <p className="text-sm font-black text-blue-400">{pct} %</p>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={irAPrecios} className="hp-glass px-4 py-2.5 text-sm font-black whitespace-nowrap">Cargar precios de insumos →</button>
      </div>

      {/* Categoría (siempre hay una elegida) + búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <HopeSwitch fit name="productos-cat"
          options={CATEGORIAS.map(c => ({ id: c, label: <span>{c} <span className="opacity-60 font-normal">{contar(c)}</span></span> }))}
          value={cat} onChange={setCat} />
        <div className="relative flex-1 min-w-44">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Buscar en ${cat.toLowerCase()}…`}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Tarjetas */}
      {visibles.length === 0 ? (
        <p className="text-center text-slate-500 font-bold py-16">Nada para mostrar</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibles.map(p => {
            const completo = !p.res.incompleto;
            const margen = p.venta !== null && completo ? p.venta - p.res.total : null;
            const fc = p.venta && completo ? (p.res.total / p.venta) * 100 : null;
            const tono = fc !== null ? TONOS[tonoCosto(fc)] : null;
            return (
              <div key={p.nombre} onClick={() => setAbierto(p.nombre)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-white leading-snug">{nombreLindo(p.nombre)}</h3>
                  {completo
                    ? <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-green-500/15 text-green-400"><Check size={11} />completo</span>
                    : <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 whitespace-nowrap"><AlertTriangle size={11} />faltan {p.res.faltan}</span>}
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Costo</p>
                  <p className={`text-3xl font-black ${completo ? 'text-white' : 'text-slate-400'}`} title={completo ? undefined : 'Costo parcial: faltan precios'}>
                    {p.res.total > 0 ? `${completo ? '' : '≥ '}${formatPlata(p.res.total)}` : '—'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
                  <span className="text-xs font-bold text-slate-400">Precio de venta</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">$</span>
                    <PrecioInput valor={p.venta} ancho="w-28" onCommit={v => guardarVenta(p, v)} />
                  </span>
                </div>

                {tono && margen !== null && fc !== null ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-black ${margen >= 0 ? 'text-white' : 'text-red-400'}`}>Margen {formatPlata(margen)}</span>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${tono.pill}`}>costo {formatNumero(fc, 0)} %</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full ${tono.barra}`} style={{ width: `${Math.min(fc, 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{completo ? 'Cargá el precio de venta para ver el margen.' : 'Completá los precios de insumos para ver el margen.'}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detalle del producto */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 max-md:p-0" onClick={() => setAbierto(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl max-md:max-w-none max-md:max-h-none max-md:h-full max-md:rounded-none">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-black text-white text-lg truncate">{nombreLindo(detalle.nombre)}</h3>
                <p className="text-xs text-slate-400">{detalle.categoria} · de qué se compone y cuánto cuesta cada cosa</p>
              </div>
              <button onClick={() => setAbierto(null)} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Costo</p>
                  <p className="text-xl font-black text-white">{detalle.res.total > 0 ? `${detalle.res.incompleto ? '≥ ' : ''}${formatPlata(detalle.res.total)}` : '—'}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Venta</p>
                  <p className="text-xl font-black text-white">{detalle.venta !== null ? formatPlata(detalle.venta) : '—'}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Margen</p>
                  {detalle.venta !== null && !detalle.res.incompleto
                    ? <p className={`text-xl font-black ${detalle.venta - detalle.res.total >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPlata(detalle.venta - detalle.res.total)}</p>
                    : <p className="text-xl font-black text-slate-600">—</p>}
                </div>
              </div>

              <div className="space-y-2">
                {detalle.res.lineas.map((l, i) => {
                  const d = destinoPrecio(l.ingrediente, stockRows, l.unidad);
                  const manual = precios[d.clave]?.precio ?? precios[norm(l.ingrediente)]?.precio ?? null;
                  const origen = l.info.fuente === 'receta' ? `auto · ${l.info.detalle ?? 'receta'}`
                    : l.info.fuente === 'crudo' ? `auto · ${l.info.detalle}` : l.info.fuente === 'manual' ? 'cargado' : 'falta precio';
                  return (
                    <div key={i} className="bg-slate-800/50 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex-1 min-w-40">
                        <p className="font-bold text-white">{l.ingrediente}</p>
                        <p className={`text-[11px] ${l.info.fuente === 'falta' ? 'text-amber-400' : 'text-slate-500'}`}>{fmtQty(l.cantidad, l.unidad)} · {origen}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5">
                        <PrecioInput valor={manual} ancho="w-24"
                          placeholder={manual === null && l.info.precio !== null ? formatNumero(l.info.precio, 2) : '0'}
                          onCommit={v => guardar(d.clave, l.ingrediente, v, d.unidad)} />
                        <span className="text-[11px] text-slate-500">$/{l.info.fuente === 'falta' ? d.unidad : l.info.unidad}</span>
                      </span>
                      <span className="w-24 text-right font-black">
                        {l.costo !== null ? <span className="text-white">{formatPlata(l.costo)}</span>
                          : l.problema ? <span className="text-xs text-red-400">{l.problema}</span>
                          : <span className="text-xs text-amber-400">—</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500 shrink-0">El precio se guarda al salir del campo · Esc para cerrar</div>
          </div>
        </div>
      )}
    </div>
  );
}
