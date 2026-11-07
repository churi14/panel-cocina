"use client";
import React, { useMemo, useState } from 'react';
import { Search, Pencil } from 'lucide-react';
import { formatNumero, formatPlata } from '../format';
import HopeSwitch from '../HopeSwitch';
import { PrecioConPieza, ModalConfirmar, type DatosCostos } from './shared';
import { RECETAS_CALCULABLES, crearResolver, destinoPrecio, precioCargado, norm, type CostoInfo } from './engine';

// ─────────────────────────────────────────────────────────────────────────────
// Precios de insumos: la lista de todo lo que usan los productos, ordenada para ir
// cargando primero lo que más se usa. Los elaborados (pan, salsas) se calculan solos
// con su receta; si cargás un precio a mano, ese manda.
// ─────────────────────────────────────────────────────────────────────────────

type Fila = {
  nombre: string; clave: string; unidad: string; usos: number; tipo: 'Elaborado' | 'Materia prima';
  manual: number | null; info: CostoInfo;
};

export default function CostosPrecios({ datos }: { datos: DatosCostos }) {
  const { precios, guardar, stockRows, recetasFudo } = datos;
  const [filtro, setFiltro] = useState<'todos' | 'sin' | 'con'>('sin');
  const [q, setQ] = useState('');

  // Edición con candado: aviso antes de empezar y antes de guardar.
  type Cambio = { nombre: string; precio: number | null; unidad: string; antes: number | null };
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<null | 'empezar' | 'guardar'>(null);
  const [borrador, setBorrador] = useState<Record<string, Cambio>>({});
  const cambios = Object.entries(borrador);
  const guardarCambios = async () => {
    for (const [clave, c] of cambios) await guardar(clave, c.nombre, c.precio, c.unidad);
    setEditando(false); setBorrador({}); setAviso(null);
  };

  const filas = useMemo<Fila[]>(() => {
    const resolver = crearResolver(stockRows, precios, datos.manoObra.vigente);
    const mapa = new Map<string, { nombre: string; unidadUso: string; tabla: string; productos: Set<string> }>();
    // 1) ingredientes de los productos que se venden
    recetasFudo.forEach(r => {
      const k = norm(r.ingrediente);
      const e = mapa.get(k) ?? { nombre: r.ingrediente, unidadUso: r.unidad, tabla: r.tabla_origen, productos: new Set<string>() };
      e.productos.add(r.producto_fudo); mapa.set(k, e);
    });
    // 2) insumos de las recetas de cocina que se usan para calcular elaborados
    const elaborados = new Set(RECETAS_CALCULABLES.map(r => norm(r.name)));
    const usados = [...mapa.keys()].filter(k => elaborados.has(k));
    RECETAS_CALCULABLES.filter(r => usados.includes(norm(r.name))).forEach(r => {
      r.ingredients.forEach(i => {
        const k = norm(i.name);
        if (!mapa.has(k)) mapa.set(k, { nombre: i.name, unidadUso: i.unit === 'g' ? 'kg' : i.unit, tabla: 'stock', productos: new Set<string>() });
      });
    });
    return [...mapa.entries()].map(([k, e]) => {
      const d = destinoPrecio(e.nombre, stockRows, e.unidadUso);
      const info = resolver(e.nombre);
      return {
        nombre: e.nombre, clave: d.clave, unidad: d.unidad, usos: e.productos.size,
        tipo: (e.tabla === 'stock_produccion' || elaborados.has(k)) ? 'Elaborado' as const : 'Materia prima' as const,
        manual: precioCargado(precios, d.clave, k)?.precio ?? null, info,
      };
    });
  }, [recetasFudo, stockRows, precios, datos.manoObra.vigente]);

  const conPrecio = filas.filter(f => f.info.precio !== null && !f.info.incompleto).length;
  const pct = filas.length ? Math.round((conPrecio / filas.length) * 100) : 0;

  const visibles = filas
    .filter(f => filtro === 'todos' ? true : filtro === 'sin' ? (f.info.precio === null || f.info.incompleto) : (f.info.precio !== null && !f.info.incompleto))
    .filter(f => !q.trim() || f.nombre.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-5">
      {aviso === 'empezar' && (
        <ModalConfirmar titulo="Editar precios de insumos" textoOk="Entendido, quiero editar"
          onCancelar={() => setAviso(null)} onOk={() => { setEditando(true); setBorrador({}); setAviso(null); }}>
          <p>Estos precios salen de las <strong className="text-white">facturas de materias primas</strong>.</p>
          <p>Si los cambiás acá, el precio cambia en <strong className="text-white">todos los productos que usan ese insumo</strong>.</p>
          <p className="text-amber-300">Después tenés que actualizar el precio también en la factura (sección Registro), para que no queden distintos.</p>
        </ModalConfirmar>
      )}
      {aviso === 'guardar' && (
        <ModalConfirmar titulo="¿Guardar los cambios de precio?" textoOk="Guardar" textoCancelar="Volver" onCancelar={() => setAviso(null)} onOk={guardarCambios}>
          <ul className="rounded-xl bg-slate-800 px-4 py-3 space-y-1.5 max-h-60 overflow-y-auto">
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
      {/* Avance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Precios cargados</p>
            <p className="text-3xl font-black text-white">{conPrecio} <span className="text-lg text-slate-500">de {filas.length} insumos</span></p>
          </div>
          <p className="text-2xl font-black text-blue-400">{pct} %</p>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Empezá por los de arriba: son los que más productos usan. Lo que dice <strong className="text-green-400">auto</strong> se calcula solo.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <HopeSwitch fit name="precios-filtro"
          options={[
            { id: 'sin', label: `Sin precio (${filas.length - conPrecio})` },
            { id: 'con', label: `Con precio (${conPrecio})` },
            { id: 'todos', label: 'Todos' },
          ]}
          value={filtro} onChange={setFiltro} />
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar insumo…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white outline-none focus:border-blue-500" />
        </div>
        {editando ? (
          <span className="inline-flex items-center gap-2">
            <button type="button" onClick={() => { setEditando(false); setBorrador({}); }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
            <button type="button" disabled={cambios.length === 0} onClick={() => setAviso('guardar')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
              Guardar cambios{cambios.length ? ` (${cambios.length})` : ''}
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setAviso('empezar')} title="Editar los precios"
            className="inline-flex items-center gap-1.5 px-3 py-2 hp-glass font-black text-sm"><Pencil size={14} />Editar precios</button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {visibles.length === 0 ? (
          <p className="px-5 py-12 text-center text-slate-500 font-bold">{filtro === 'sin' && !q ? '🎉 Todos los insumos tienen precio' : 'Nada para mostrar'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-right">Usado en</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-5 py-3 text-left">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibles.map(f => (
                  <tr key={f.clave + f.nombre} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-bold text-white">{f.nombre}</p>
                      <p className="text-[11px] text-slate-500">{f.tipo}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">{f.usos ? `${f.usos} producto${f.usos > 1 ? 's' : ''}` : 'receta de cocina'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {editando ? (
                        <span className="inline-flex items-center gap-1.5">
                          <PrecioConPieza valor={f.clave in borrador ? borrador[f.clave].precio : f.manual} unidad={f.unidad} nombre={f.nombre}
                            placeholder={f.manual === null && f.info.precio !== null ? formatNumero(f.info.precio, 2) : '0'}
                            onCommit={v => setBorrador(b => {
                              const n = { ...b };
                              if (v === f.manual) delete n[f.clave]; else n[f.clave] = { nombre: f.nombre, precio: v, unidad: f.unidad, antes: f.manual };
                              return n;
                            })} />
                          <span className="text-xs text-slate-500">$/{f.unidad}</span>
                          {f.clave in borrador && <span className="text-[10px] font-black text-amber-400">cambiado</span>}
                        </span>
                      ) : (
                        <span className="text-white font-bold">
                          {f.info.precio !== null ? formatNumero(f.info.precio, 2) : <span className="text-slate-500">—</span>}
                          <span className="text-xs text-slate-500 font-normal"> $/{f.unidad}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      {f.manual !== null ? <span className="text-xs font-black text-blue-400">cargado</span>
                        : (f.info.faltantes?.length ?? 0) > 0 ? (
                          <span className="text-xs font-black text-amber-400">
                            falta cargar:{' '}
                            {f.info.faltantes!.map((n, i) => (
                              <button key={n} onClick={() => { setQ(n); setFiltro('sin'); }}
                                className="underline decoration-dotted underline-offset-2 hover:text-amber-300 mr-1" title="Ver este insumo">
                                {n}{i < f.info.faltantes!.length - 1 ? ',' : ''}
                              </button>
                            ))}
                          </span>
                        )
                        : f.info.fuente === 'receta' ? <span className="text-xs font-black text-green-400">auto · {formatPlata(f.info.precio ?? 0)} por {f.info.unidad}</span>
                        : f.info.fuente === 'crudo' ? <span className="text-xs font-black text-green-400">auto · {f.info.detalle}</span>
                        : <span className="text-xs font-black text-amber-400">falta precio</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
