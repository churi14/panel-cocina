"use client";
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatNumero, formatPlata } from '../format';
import HopeSwitch from '../HopeSwitch';
import { PrecioConPieza, type DatosCostos } from './shared';
import { RECETAS_CALCULABLES, crearResolver, destinoPrecio, norm, type CostoInfo } from './engine';

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

  const filas = useMemo<Fila[]>(() => {
    const resolver = crearResolver(stockRows, precios);
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
        manual: precios[d.clave]?.precio ?? precios[k]?.precio ?? null, info,
      };
    });
  }, [recetasFudo, stockRows, precios]);

  const conPrecio = filas.filter(f => f.info.precio !== null && !f.info.incompleto).length;
  const pct = filas.length ? Math.round((conPrecio / filas.length) * 100) : 0;

  const visibles = filas
    .filter(f => filtro === 'todos' ? true : filtro === 'sin' ? (f.info.precio === null || f.info.incompleto) : (f.info.precio !== null && !f.info.incompleto))
    .filter(f => !q.trim() || f.nombre.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-5">
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
                      <span className="inline-flex items-center gap-1.5">
                        <PrecioConPieza valor={f.manual} unidad={f.unidad} nombre={f.nombre}
                          placeholder={f.manual === null && f.info.precio !== null ? formatNumero(f.info.precio, 2) : '0'}
                          onCommit={v => guardar(f.clave, f.nombre, v, f.unidad)} />
                        <span className="text-xs text-slate-500">$/{f.unidad}</span>
                      </span>
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
