"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../supabase';
import { INITIAL_RECIPES } from '../data/recipes';
import type { Recipe } from '../types';
import { matchStock, convertir, norm, type StockRow } from '../components/kitchenHelpers';
import { parseNumero } from '../components/stockNames';
import { formatNumero, formatPlata, formatCantidad } from './format';
import HopeSwitch from './HopeSwitch';

// ─────────────────────────────────────────────────────────────────────────────
// Calculador de costos — v1
//  · elegís una receta y cuánto querés producir
//  · calcula cuánto lleva de cada insumo y cuánto cuesta (según los precios cargados)
//  · los precios se guardan en la tabla `costos_insumos` (sql/20261104_costos_insumos.sql);
//    mientras no exista, quedan en este navegador.
// ─────────────────────────────────────────────────────────────────────────────

type Precio = { precio: number; unidad: string; nombre: string };
type Modo = 'cargando' | 'nube' | 'local';

function usePrecios() {
  const [precios, setPrecios] = useState<Record<string, Precio>>({});
  const [modo, setModo] = useState<Modo>('cargando');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('costos_insumos').select('clave, nombre, precio, unidad');
      if (!error && data) {
        setPrecios(Object.fromEntries(data.map((r: any) => [r.clave, { precio: Number(r.precio), unidad: r.unidad, nombre: r.nombre }])));
        setModo('nube');
        return;
      }
      try {
        const raw = localStorage.getItem('costos_insumos');
        if (raw) setPrecios(JSON.parse(raw));
      } catch { /* sin localStorage */ }
      setModo('local');
    })();
  }, []);

  const guardar = async (clave: string, nombre: string, precio: number | null, unidad: string) => {
    setPrecios(prev => {
      const next = { ...prev };
      if (precio === null) delete next[clave]; else next[clave] = { precio, unidad, nombre };
      if (modo === 'local') { try { localStorage.setItem('costos_insumos', JSON.stringify(next)); } catch { /* ignorar */ } }
      return next;
    });
    if (modo === 'nube') {
      if (precio === null) await supabase.from('costos_insumos').delete().eq('clave', clave);
      else await supabase.from('costos_insumos').upsert({ clave, nombre, precio, unidad, updated_at: new Date().toISOString() }, { onConflict: 'clave' });
    }
  };
  return { precios, modo, guardar };
}

/** Campo de precio: se guarda al salir del campo o con Enter. */
function PrecioInput({ valor, onCommit }: { valor: number | null; onCommit: (v: number | null) => void }) {
  const [txt, setTxt] = useState(valor === null ? '' : String(valor).replace('.', ','));
  useEffect(() => { setTxt(valor === null ? '' : String(valor).replace('.', ',')); }, [valor]);
  const commit = () => {
    const n = parseNumero(txt);
    if (txt.trim() === '') { if (valor !== null) onCommit(null); return; }
    if (!isNaN(n) && n >= 0 && n !== valor) onCommit(n);
    else setTxt(valor === null ? '' : String(valor).replace('.', ','));
  };
  return (
    <input type="text" inputMode="decimal" value={txt} placeholder="0"
      onChange={e => setTxt(e.target.value.replace(/[^0-9.,]/g, ''))}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-28 text-right bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none focus:border-blue-500" />
  );
}

const unidadPrecio = (u: string) => (u === 'g' || u === 'gr' ? 'kg' : u === 'ml' ? 'lt' : u);

/** Cantidad legible: 1500 g → "1,5 kg", 250 g → "250 g". */
function fmtQty(qty: number, unit: string): string {
  if (unit === 'g' || unit === 'gr') { const f = formatCantidad(qty / 1000, 'kg'); return `${f.num} ${f.unit}`; }
  if (unit === 'kg' || unit === 'lt') { const f = formatCantidad(qty, unit); return `${f.num} ${f.unit}`; }
  return `${formatNumero(qty, Number.isInteger(qty) ? 0 : 2)} ${unit}`;
}

export default function TabCostos() {
  const { precios, modo, guardar } = usePrecios();
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [recetaId, setRecetaId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [modoPct, setModoPct] = useState<'base' | 'final'>('base');
  const [ventaTxt, setVentaTxt] = useState('');

  useEffect(() => {
    supabase.from('stock').select('id, nombre, unidad, categoria').then(({ data }) => { if (data) setStockRows(data as StockRow[]); });
  }, []);

  // Solo recetas con lista de ingredientes (percent o cantidades fijas)
  const recetas = useMemo(() => INITIAL_RECIPES.filter(r =>
    r.ingredients.length > 0 && !['fraccion', 'verdura', 'fiambre', 'empanado'].includes(r.recipeType ?? '')), []);
  const grupos = useMemo(() => {
    const m = new Map<string, Recipe[]>();
    recetas.forEach(r => m.set(r.category, [...(m.get(r.category) ?? []), r]));
    return [...m.entries()];
  }, [recetas]);

  useEffect(() => { if (!recetaId && recetas[0]) elegir(recetas[0].id); }, [recetas]); // eslint-disable-line react-hooks/exhaustive-deps

  const receta = recetas.find(r => r.id === recetaId) ?? null;
  const esPercent = receta?.recipeType === 'percent';

  function elegir(id: string) {
    const r = recetas.find(x => x.id === id);
    setRecetaId(id);
    if (!r) return;
    setCantidad(r.recipeType === 'percent' ? '10' : String(r.baseYield || 1).replace('.', ','));
    setModoPct('base');
    setVentaTxt('');
  }

  const cant = parseNumero(cantidad) || 0;

  // ── Cálculo ──
  const calculo = useMemo(() => {
    if (!receta || !(cant > 0)) return null;
    type Fila = { nombre: string; clave: string; unidadPrecio: string; qty: number; unit: string; precio: number | null; costo: number | null; problema: string | null };
    let filas: Fila[] = [];
    let salida = 0;           // cantidad de producto que sale
    let salidaUnidad = 'u';
    const items: { name: string; qty: number; unit: string }[] = [];
    if (esPercent) {
      const ratio = receta.ingredients.reduce((s, i) => s + i.qty / 100, 0);
      const baseKg = modoPct === 'base' ? cant : cant / (ratio || 1);
      salida = baseKg * ratio; salidaUnidad = 'kg';
      receta.ingredients.forEach(i => items.push({ name: i.name, qty: (i.isBase ? 100 : i.qty) / 100 * baseKg * 1000, unit: 'g' }));
    } else {
      const mult = receta.baseYield > 0 ? cant / receta.baseYield : 0;
      salida = cant; salidaUnidad = receta.unit === 'uds' ? 'u' : receta.unit;
      receta.ingredients.forEach(i => items.push({ name: i.name, qty: i.qty * mult, unit: i.unit }));
    }
    filas = items.map(it => {
      const row = matchStock(it.name, stockRows);
      const nombre = row?.nombre ?? it.name;
      const clave = norm(nombre);
      const uPrecio = precios[clave]?.unidad ?? row?.unidad ?? unidadPrecio(it.unit);
      const precio = precios[clave]?.precio ?? null;
      let costo: number | null = null; let problema: string | null = null;
      if (precio !== null) {
        const q = convertir(it.qty, it.unit, uPrecio);
        if (q === null) problema = `unidad ${it.unit} no compatible con ${uPrecio}`;
        else costo = q * precio;
      }
      return { nombre, clave, unidadPrecio: uPrecio, qty: it.qty, unit: it.unit, precio, costo, problema };
    });
    const total = filas.reduce((s, f) => s + (f.costo ?? 0), 0);
    const faltan = filas.filter(f => f.precio === null).length;
    return { filas, total, faltan, salida, salidaUnidad };
  }, [receta, cant, esPercent, modoPct, stockRows, precios]);

  const venta = parseNumero(ventaTxt) || 0;
  const costoUnit = calculo && calculo.salida > 0 ? calculo.total / calculo.salida : 0;
  const margen = venta > 0 ? venta - costoUnit : 0;
  const foodCost = venta > 0 ? (costoUnit / venta) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center"><Calculator size={22} /></div>
        <div>
          <h2 className="text-xl font-black text-white">Calculador de costos</h2>
          <p className="text-xs text-slate-400">Elegí una receta, cuánto querés producir y cargá el precio de cada insumo.</p>
        </div>
      </div>

      {modo === 'local' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300">
            Los precios se guardan <strong>solo en este navegador</strong>. Para guardarlos para todos, corré el SQL
            <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-200 text-xs">sql/20261104_costos_insumos.sql</code>
            en Supabase.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Receta y cantidad */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Receta</label>
            <select value={recetaId} onChange={e => elegir(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500">
              {grupos.map(([cat, rs]) => (
                <optgroup key={cat} label={cat}>
                  {rs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {esPercent && (
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Cantidad que indico</label>
              <HopeSwitch fit name="costos-modo"
                options={[{ id: 'base', label: 'Kg del ingrediente base' }, { id: 'final', label: 'Kg de producto final' }]}
                value={modoPct} onChange={setModoPct} />
            </div>
          )}

          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">
              {esPercent ? (modoPct === 'base' ? 'Kilos del ingrediente base' : 'Kilos de producto final') : `Cantidad a producir (${receta?.unit === 'uds' ? 'u' : receta?.unit})`}
            </label>
            <div className="flex items-center gap-2">
              <input type="text" inputMode="decimal" value={cantidad}
                onChange={e => setCantidad(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0"
                className="flex-1 min-w-0 bg-slate-800 border-2 border-slate-700 text-white rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-blue-500" />
              <span className="text-slate-400 font-black">{esPercent ? 'kg' : (receta?.unit === 'uds' ? 'u' : receta?.unit)}</span>
            </div>
            {receta && !esPercent && receta.baseYield > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">La receta base rinde {receta.baseYield} {receta.unit === 'uds' ? 'u' : receta.unit}.</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">
              Precio de venta por {calculo?.salidaUnidad ?? 'unidad'} (opcional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-black">$</span>
              <input type="text" inputMode="decimal" value={ventaTxt}
                onChange={e => setVentaTxt(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* Resultado */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Costo total</p>
              <p className="text-3xl font-black text-white">{calculo ? formatPlata(calculo.total) : '—'}</p>
              {calculo && calculo.faltan > 0 && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> faltan {calculo.faltan} precio{calculo.faltan > 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Costo por {calculo?.salidaUnidad ?? 'unidad'}</p>
              <p className="text-3xl font-black text-blue-400">{calculo ? formatPlata(costoUnit) : '—'}</p>
              {calculo && <p className="text-xs text-slate-500 mt-1">salen {formatNumero(calculo.salida, 2)} {calculo.salidaUnidad}</p>}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Margen</p>
              {venta > 0 && calculo ? (<>
                <p className={`text-3xl font-black ${margen >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPlata(margen)}</p>
                <p className={`text-xs mt-1 font-bold ${foodCost <= 30 ? 'text-green-400' : foodCost <= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  el insumo es el {formatNumero(foodCost, 0)} % del precio
                </p>
              </>) : <p className="text-sm text-slate-500 mt-2">Cargá un precio de venta para ver el margen.</p>}
            </div>
          </div>

          {/* Detalle por insumo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-sm text-white">Detalle por insumo</h3>
              <span className="text-xs text-slate-500">el precio se guarda al salir del campo</span>
            </div>
            {!calculo ? (
              <p className="px-5 py-10 text-center text-slate-500 font-bold">Indicá una cantidad para calcular.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Insumo</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Precio</th>
                      <th className="px-5 py-3 text-right">Costo</th>
                      <th className="px-5 py-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {calculo.filas.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-white">{f.nombre}</td>
                        <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap">{fmtQty(f.qty, f.unit)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <PrecioInput valor={f.precio} onCommit={v => guardar(f.clave, f.nombre, v, f.unidadPrecio)} />
                            <span className="text-xs text-slate-500">$/{f.unidadPrecio}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-black whitespace-nowrap">
                          {f.costo !== null ? <span className="text-white">{formatPlata(f.costo)}</span>
                            : f.problema ? <span className="text-xs text-red-400">{f.problema}</span>
                            : <span className="text-xs text-amber-400">falta precio</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500 text-xs">
                          {f.costo !== null && calculo.total > 0 ? `${formatNumero((f.costo / calculo.total) * 100, 0)} %` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700">
                      <td className="px-5 py-3 font-black text-white" colSpan={3}>Total</td>
                      <td className="px-5 py-3 text-right font-black text-white">{formatPlata(calculo.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
