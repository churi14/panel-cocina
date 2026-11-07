"use client";
import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, AlertTriangle, Pencil } from 'lucide-react';
import { parseNumero } from '../../components/stockNames';
import { formatNumero, formatPlata } from '../format';
import HopeSwitch from '../HopeSwitch';
import { PrecioInput, PrecioConPieza, ModalConfirmar, fmtQty, type DatosCostos } from './shared';
import {
  CLAVE_VENTA, categoriaProducto, costoProducto, crearResolver, destinoPrecio, precioCargado, norm,
  type RecetaFudoRow, type ResultadoProducto,
} from './engine';

// ─────────────────────────────────────────────────────────────────────────────
// Costos por producto: para cada producto que se vende (con su receta ya cargada)
// calcula cuánto cuesta hacerlo. El precio de venta se carga a mano por ahora;
// ─────────────────────────────────────────────────────────────────────────────

const bonito = (n: string) => n.replace(/\.$/, '').replace(/\b\p{L}/gu, c => c.toUpperCase());
type CatFiltro = 'Lomitos' | 'Burgers' | 'Milanesas' | 'Sánguches' | 'Promos';

export default function CostosProductos({ datos, irAPrecios }: { datos: DatosCostos; irAPrecios: () => void }) {
  const { precios, guardar, stockRows, recetasFudo, cargado } = datos;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CatFiltro>('Lomitos');
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [abierto, setAbiertoRaw] = useState<string | null>(null);

  // Edición de precios de una receta, con candado: aviso antes de empezar y antes de guardar.
  type Cambio = { nombre: string; precio: number | null; unidad: string; antes: number | null };
  const [editando, setEditando] = useState<string | null>(null);              // producto en edición
  const [aviso, setAviso] = useState<null | { paso: 'empezar' | 'guardar'; producto: string }>(null);
  const [borrador, setBorrador] = useState<Record<string, Cambio>>({});       // clave → cambio pendiente
  const setAbierto = (v: string | null) => { setAbiertoRaw(v); setEditando(null); setBorrador({}); };
  const cambios = Object.entries(borrador);
  const guardarCambios = async () => {
    for (const [clave, c] of cambios) await guardar(clave, c.nombre, c.precio, c.unidad);
    setEditando(null); setBorrador({}); setAviso(null);
  };

  const productos = useMemo(() => {
    const resolver = crearResolver(stockRows, precios, datos.manoObra.vigente);
    const porProducto = new Map<string, RecetaFudoRow[]>();
    recetasFudo.forEach(r => porProducto.set(r.producto_fudo, [...(porProducto.get(r.producto_fudo) ?? []), r]));
    return [...porProducto.entries()].map(([nombre, rows]) => {
      const res: ResultadoProducto = costoProducto(rows, resolver);
      const venta = precios[CLAVE_VENTA + norm(nombre)]?.precio ?? null;
      return { nombre, categoria: categoriaProducto(nombre), res, venta };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [recetasFudo, stockRows, precios, datos.manoObra.vigente]);

  const completos = productos.filter(p => !p.res.incompleto).length;
  const visibles = productos
    .filter(p => p.categoria === cat)
    .filter(p => !soloFaltan || p.res.incompleto)
    .filter(p => !q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase()));

  if (!cargado) return <p className="text-center text-slate-500 font-bold py-16">Cargando recetas…</p>;
  if (productos.length === 0) {
    return <p className="text-center text-slate-500 font-bold py-16">Todavía no hay recetas de productos cargadas.</p>;
  }

  return (
    <div className="space-y-5">
      {aviso?.paso === 'empezar' && (
        <ModalConfirmar titulo={`Editar precios de ${bonito(aviso.producto)}`} textoOk="Entendido, quiero editar"
          onCancelar={() => setAviso(null)} onOk={() => { setEditando(aviso.producto); setBorrador({}); setAviso(null); }}>
          <p>Estos precios salen de las <strong className="text-white">facturas de materias primas</strong>.</p>
          <p>Si los cambiás acá, el precio queda cambiado en <strong className="text-white">todos los productos que usan ese insumo</strong>, no solo en este.</p>
          <p className="text-amber-300">Después tenés que actualizar el precio también en la factura (sección Registro), para que no queden distintos.</p>
        </ModalConfirmar>
      )}
      {aviso?.paso === 'guardar' && (
        <ModalConfirmar titulo="¿Guardar los cambios de precio?" textoOk="Guardar" textoCancelar="Volver" onCancelar={() => setAviso(null)} onOk={guardarCambios}>
          <ul className="rounded-xl bg-slate-800 px-4 py-3 space-y-1.5">
            {cambios.map(([clave, c]) => (
              <li key={clave} className="flex items-center justify-between gap-3">
                <span className="font-bold text-white">{c.nombre}</span>
                <span className="text-slate-300 whitespace-nowrap">
                  {c.antes !== null ? formatNumero(c.antes, 2) : 'sin precio'} → <strong className="text-white">{c.precio !== null ? formatNumero(c.precio, 2) : 'sin precio'}</strong> $/{c.unidad}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-amber-300">Acordate: estos precios también tienen que actualizarse en la <strong>factura de materias primas</strong> (Registro). Si no, la próxima vez que se pase una factura a Costos, se pisan.</p>
        </ModalConfirmar>
      )}
      {/* Resumen */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Productos con receta</p>
          <p className="text-3xl font-black text-white">{productos.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Con costo completo</p>
          <p className="text-3xl font-black text-green-400">{completos}</p>
          <p className="text-xs text-slate-500 mt-1">{productos.length - completos} esperan precios</p>
        </div>
        <button onClick={irAPrecios}
          className="hp-glass text-left p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Siguiente paso</p>
          <p className="text-lg font-black">Cargar precios de insumos →</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <HopeSwitch fit name="productos-cat"
          options={(['Lomitos', 'Burgers', 'Milanesas', 'Sánguches', 'Promos'] as CatFiltro[]).map(c => ({ id: c, label: c }))}
          value={cat} onChange={setCat} />
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white outline-none focus:border-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={soloFaltan} onChange={e => setSoloFaltan(e.target.checked)} className="accent-blue-500" />
          Solo con datos faltantes
        </label>
      </div>

      {/* Lista de productos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_7rem_8.5rem_7rem_6rem] gap-3 px-5 py-3 bg-slate-800/50 text-slate-500 text-xs uppercase font-bold">
          <span>Producto</span><span className="text-right">Costo</span><span className="text-right">Precio de venta</span>
          <span className="text-right">Margen</span><span className="text-right">Costo / venta</span>
        </div>
        {visibles.length === 0 && <p className="px-5 py-12 text-center text-slate-500 font-bold">Nada para mostrar</p>}
        <div className="divide-y divide-slate-800">
          {visibles.map(p => {
            const margen = p.venta !== null && !p.res.incompleto ? p.venta - p.res.total : null;
            const fc = p.venta && !p.res.incompleto ? (p.res.total / p.venta) * 100 : null;
            const open = abierto === p.nombre;
            return (
              <div key={p.nombre}>
                <div className="grid md:grid-cols-[1fr_7rem_8.5rem_7rem_6rem] gap-x-3 gap-y-1 items-center px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <button onClick={() => setAbierto(open ? null : p.nombre)} className="flex items-center gap-2 text-left min-w-0">
                    <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                    <span className="min-w-0">
                      <span className="block font-bold text-white truncate">{bonito(p.nombre)}</span>
                      <span className="block text-[11px] text-slate-500">{p.categoria}</span>
                    </span>
                  </button>
                  <div className="md:text-right">
                    <span className={`font-black ${p.res.incompleto ? 'text-slate-400' : 'text-white'}`} title={p.res.incompleto ? 'Costo parcial: faltan precios' : undefined}>
                      {p.res.total > 0 ? `${p.res.incompleto ? '≥ ' : ''}${formatPlata(p.res.total)}` : '—'}
                    </span>
                    {p.res.incompleto && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-black text-amber-400"><AlertTriangle size={11} />faltan {p.res.faltan}</span>
                    )}
                  </div>
                  <div className="md:text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">$</span>
                      <PrecioInput valor={p.venta} ancho="w-24"
                        onCommit={v => guardar(CLAVE_VENTA + norm(p.nombre), p.nombre, v, 'venta')} />
                    </span>
                  </div>
                  <div className={`md:text-right font-black ${margen === null ? 'text-slate-600' : margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {margen !== null ? formatPlata(margen) : '—'}
                  </div>
                  <div className={`md:text-right font-black ${fc === null ? 'text-slate-600' : fc <= 30 ? 'text-green-400' : fc <= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {fc !== null ? `${formatNumero(fc, 0)} %` : '—'}
                  </div>
                </div>

                {open && (
                  <div className="bg-slate-800/30 px-5 py-4 border-t border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-xs text-slate-400">
                        {editando === p.nombre ? 'Editando precios: tocá un precio para cambiarlo y después guardá.' : 'Receta y precio de cada insumo.'}
                      </p>
                      {editando === p.nombre ? (
                        <span className="inline-flex items-center gap-2">
                          <button type="button" onClick={() => { setEditando(null); setBorrador({}); }}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg text-xs">Cancelar</button>
                          <button type="button" disabled={cambios.length === 0} onClick={() => setAviso({ paso: 'guardar', producto: p.nombre })}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg text-xs disabled:opacity-40">
                            Guardar cambios{cambios.length ? ` (${cambios.length})` : ''}
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setAviso({ paso: 'empezar', producto: p.nombre })} title="Editar los precios de esta receta"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 hp-glass font-black text-xs"><Pencil size={13} />Editar precios</button>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-slate-500 text-[11px] uppercase">
                        <tr>
                          <th className="py-1.5 text-left">Ingrediente</th>
                          <th className="py-1.5 text-right">Cantidad</th>
                          <th className="py-1.5 text-right">Precio</th>
                          <th className="py-1.5 text-right">Costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {p.res.lineas.map((l, i) => {
                          const d = destinoPrecio(l.ingrediente, stockRows, l.unidad);
                          const manual = precioCargado(precios, d.clave, norm(l.ingrediente))?.precio ?? null;
                          return (
                            <tr key={i}>
                              <td className="py-2 pr-2">
                                <p className="font-bold text-white">{l.ingrediente}</p>
                                <p className="text-[11px] text-slate-500">
                                  {(l.info.faltantes?.length ?? 0) > 0 ? `falta cargar: ${l.info.faltantes!.join(', ')}` : l.info.fuente === 'receta' ? `auto · ${l.info.detalle ?? 'receta'}` : l.info.fuente === 'crudo' ? `auto · ${l.info.detalle}` : l.info.fuente === 'manual' ? 'cargado' : 'falta precio'}
                                </p>
                              </td>
                              <td className="py-2 text-right text-slate-300 whitespace-nowrap">{fmtQty(l.cantidad, l.unidad)}</td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {editando === p.nombre ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <PrecioConPieza valor={d.clave in borrador ? borrador[d.clave].precio : manual} ancho="w-24" nombre={l.ingrediente}
                                      unidad={l.info.fuente === 'falta' ? d.unidad : l.info.unidad}
                                      placeholder={manual === null && l.info.precio !== null ? formatNumero(l.info.precio, 2) : '0'}
                                      onCommit={v => setBorrador(b => {
                                        const n = { ...b };
                                        if (v === manual) delete n[d.clave]; else n[d.clave] = { nombre: l.ingrediente, precio: v, unidad: d.unidad, antes: manual };
                                        return n;
                                      })} />
                                    <span className="text-[11px] text-slate-500">$/{l.info.fuente === 'falta' ? d.unidad : l.info.unidad}</span>
                                    {d.clave in borrador && <span className="text-[10px] font-black text-amber-400">cambiado</span>}
                                  </span>
                                ) : (
                                  <span className="text-white font-bold">
                                    {l.info.precio !== null ? formatNumero(l.info.precio, 2) : <span className="text-slate-500">—</span>}
                                    <span className="text-[11px] text-slate-500 font-normal"> $/{l.info.fuente === 'falta' ? d.unidad : l.info.unidad}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pl-3 text-right font-black whitespace-nowrap">
                                {l.costo !== null ? <span className="text-white">{formatPlata(l.costo)}</span>
                                  : l.problema ? <span className="text-xs text-red-400">{l.problema}</span>
                                  : <span className="text-xs text-amber-400">falta precio</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-700">
                          <td className="pt-2 font-black text-white" colSpan={3}>Costo total</td>
                          <td className="pt-2 text-right font-black text-white">{formatPlata(p.res.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
