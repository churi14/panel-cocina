"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Truck, Info, Plus, X, Search, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { adjustStock, norm } from '../components/kitchenHelpers';
import { parseNumero } from '../components/stockNames';
import { formatCantidad, formatPlata } from './format';
import HopeSwitch from './HopeSwitch';
import {
  useCompras, hoyISO, sumarDias, diasHasta, fmtFecha,
  type Compra, type ItemCompra,
} from './compras/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Compras: pedidos a proveedores y lo que está en viaje.
//  En viaje   → lista de pedidos; "Recibido" confirma los kilos reales y suma al stock
//  Nuevo pedido → cargar proveedor, fecha de llegada y productos con kilos
//  Historial  → pedidos ya recibidos o cancelados
// ─────────────────────────────────────────────────────────────────────────────

type StockRow = { id: number; nombre: string; categoria: string; unidad: string };
type Vista = 'viaje' | 'nuevo' | 'historial';

const kg = (n: number, u: string) => { const f = formatCantidad(n, u); return `${f.num} ${f.unit}`; };

/** Buscador de producto del stock (la carne primero). */
function ProductoPicker({ rows, onPick }: { rows: StockRow[]; onPick: (r: StockRow) => void }) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const lista = useMemo(() => {
    const t = norm(q);
    return rows
      .filter(r => !t || norm(r.nombre).includes(t))
      .sort((a, b) => (a.categoria === 'CARNES' ? 0 : 1) - (b.categoria === 'CARNES' ? 0 : 1) || a.nombre.localeCompare(b.nombre))
      .slice(0, 8);
  }, [rows, q]);
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input value={q} onFocus={() => setAbierto(true)} onChange={e => { setQ(e.target.value); setAbierto(true); }}
        onBlur={() => setTimeout(() => setAbierto(false), 150)} placeholder="Buscar producto (nalga, lomo…)"
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white outline-none focus:border-blue-500" />
      {abierto && lista.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {lista.map(r => (
            <button key={r.id} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onPick(r); setQ(''); setAbierto(false); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-700">
              <span className="font-bold text-white">{r.nombre}</span>
              <span className="text-[11px] text-slate-400">{r.categoria} · {r.unidad}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ItemForm = { row: StockRow; cantidad: string; precio: string };

export default function TabCompras() {
  const { compras, modo, crear, actualizar } = useCompras();
  const [vista, setVista] = useState<Vista>('viaje');
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  // nuevo pedido
  const [proveedor, setProveedor] = useState('');
  const [fechaPedido, setFechaPedido] = useState(hoyISO());
  const [fechaLlegada, setFechaLlegada] = useState(sumarDias(hoyISO(), 10));
  const [items, setItems] = useState<ItemForm[]>([]);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  // recibir
  const [recibiendo, setRecibiendo] = useState<Compra | null>(null);
  const [llegaron, setLlegaron] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    supabase.from('stock').select('id, nombre, categoria, unidad').order('nombre')
      .then(({ data }) => { if (data) setStockRows(data as StockRow[]); });
  }, []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(null), 4000); return () => clearTimeout(t); }, [aviso]);

  const enViaje = compras.filter(c => c.estado === 'en_viaje').sort((a, b) => a.fecha_llegada.localeCompare(b.fecha_llegada));
  const historial = compras.filter(c => c.estado !== 'en_viaje').sort((a, b) => b.fecha_llegada.localeCompare(a.fecha_llegada));
  const proveedores = useMemo(() => [...new Set(compras.map(c => c.proveedor).filter(Boolean))], [compras]);

  // total en viaje por producto
  const porProducto = useMemo(() => {
    const m = new Map<string, { nombre: string; cantidad: number; unidad: string }>();
    enViaje.forEach(c => c.items.forEach(i => {
      const k = norm(i.nombre); const p = m.get(k);
      m.set(k, { nombre: i.nombre, unidad: i.unidad, cantidad: (p?.cantidad ?? 0) + i.cantidad });
    }));
    return [...m.values()].sort((a, b) => b.cantidad - a.cantidad);
  }, [enViaje]);

  // ── Nuevo pedido ──
  const agregarItem = (row: StockRow) => {
    if (items.some(i => i.row.id === row.id)) return;
    setItems(prev => [...prev, { row, cantidad: '', precio: '' }]);
  };
  const itemsValidos = items.filter(i => parseNumero(i.cantidad) > 0);
  const puedeGuardar = itemsValidos.length > 0 && !!fechaLlegada && !guardando;

  const guardarPedido = async () => {
    if (!puedeGuardar) return;
    const grande = itemsValidos.find(i => (i.row.unidad === 'kg' || i.row.unidad === 'lt') && parseNumero(i.cantidad) >= 1000);
    if (grande && !window.confirm(`${grande.row.nombre}: ${grande.cantidad} ${grande.row.unidad} es muchísimo. ¿Pusiste gramos en vez de kilos?

Aceptar = guardar igual · Cancelar = corregir`)) return;
    setGuardando(true);
    const ok = await crear({
      proveedor: proveedor.trim(), fecha_pedido: fechaPedido, fecha_llegada: fechaLlegada, estado: 'en_viaje', notas: notas.trim() || null,
      items: itemsValidos.map(i => ({
        stock_id: i.row.id, nombre: i.row.nombre, cantidad: parseNumero(i.cantidad), unidad: i.row.unidad,
        precio_kg: parseNumero(i.precio) > 0 ? parseNumero(i.precio) : null,
      })),
    });
    setGuardando(false);
    if (!ok) { setAviso('⚠️ No se pudo guardar el pedido. Probá de nuevo.'); return; }
    setItems([]); setNotas(''); setProveedor(''); setFechaPedido(hoyISO()); setFechaLlegada(sumarDias(hoyISO(), 10));
    setVista('viaje'); setAviso('✓ Pedido cargado: quedó en viaje');
  };

  // ── Recibir ──
  const abrirRecibir = (c: Compra) => { setRecibiendo(c); setLlegaron(c.items.map(i => String(i.cantidad).replace('.', ','))); };
  const confirmarRecepcion = async () => {
    if (!recibiendo || procesando) return;
    setProcesando(true);
    const final: ItemCompra[] = [];
    let falloAlgo = false;
    for (let idx = 0; idx < recibiendo.items.length; idx++) {
      const it = recibiendo.items[idx];
      const real = Math.max(0, parseNumero(llegaron[idx]) || 0);
      final.push({ ...it, recibido: real });
      if (real <= 0 || it.stock_id == null) continue;
      const nueva = await adjustStock('stock', it.stock_id, real, { piso: false });
      if (nueva === null) { falloAlgo = true; continue; }
      await supabase.from('stock').update({ fecha_actualizacion: hoyISO() }).eq('id', it.stock_id);
      await supabase.from('stock_movements').insert({
        stock_id: it.stock_id, nombre: it.nombre, categoria: stockRows.find(r => r.id === it.stock_id)?.categoria ?? null,
        tipo: 'ingreso', cantidad: real, unidad: it.unidad,
        motivo: `Compra${recibiendo.proveedor ? ' - ' + recibiendo.proveedor : ''} (llegó ${fmtFecha(hoyISO())}, pedida ${fmtFecha(recibiendo.fecha_pedido)})`,
        operador: 'Admin', fecha: new Date().toISOString(),
      });
      // si se cargó precio, queda como precio del insumo para el costeo
      if (it.precio_kg && it.precio_kg > 0) {
        await supabase.from('costos_insumos').upsert(
          { clave: norm(it.nombre), nombre: it.nombre, precio: it.precio_kg, unidad: it.unidad, updated_at: new Date().toISOString() },
          { onConflict: 'clave' });
      }
    }
    if (falloAlgo) {
      setProcesando(false);
      setAviso('⚠️ No se pudo sumar al stock alguno de los productos. Revisá el stock antes de reintentar.');
      return;
    }
    await actualizar(recibiendo.id, { estado: 'recibido', items: final, recibido_at: new Date().toISOString() });
    setProcesando(false); setRecibiendo(null);
    setAviso('✓ Pedido recibido: el stock ya subió');
  };

  const cancelarPedido = async (c: Compra) => {
    if (!window.confirm(`¿Cancelar el pedido${c.proveedor ? ' de ' + c.proveedor : ''} del ${fmtFecha(c.fecha_pedido)}? No toca el stock.`)) return;
    await actualizar(c.id, { estado: 'cancelado' });
  };

  const chipLlegada = (c: Compra) => {
    const d = diasHasta(c.fecha_llegada);
    if (d < 0) return { txt: `Atrasado ${-d} día${d < -1 ? 's' : ''}`, cls: 'bg-red-500/15 text-red-400' };
    if (d === 0) return { txt: 'Llega hoy', cls: 'bg-green-500/15 text-green-400' };
    if (d <= 2) return { txt: `Llega en ${d} día${d > 1 ? 's' : ''}`, cls: 'bg-amber-500/15 text-amber-400' };
    return { txt: `Llega en ${d} días`, cls: 'bg-blue-500/15 text-blue-400' };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center"><Truck size={22} /></div>
          <div>
            <h2 className="text-xl font-black text-white">Compras</h2>
            <p className="text-xs text-slate-400">Lo que pediste y todavía no llegó. Al recibirlo, el stock sube solo.</p>
          </div>
        </div>
        <HopeSwitch fit name="compras-vista"
          options={[
            { id: 'viaje',     label: <span>🚚 En viaje{enViaje.length ? ` (${enViaje.length})` : ''}</span> },
            { id: 'nuevo',     label: '➕ Nuevo pedido' },
            { id: 'historial', label: '🕘 Historial' },
          ]}
          value={vista} onChange={setVista} />
      </div>

      {modo === 'local' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300">
            Los pedidos se guardan <strong>solo en este navegador</strong>. Para compartirlos, corré el SQL
            <code className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-amber-200 text-xs">sql/20261105_compras.sql</code>
            en Supabase. (Al recibir un pedido, el stock sí se actualiza en la base.)
          </p>
        </div>
      )}
      {aviso && <div className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-bold text-white">{aviso}</div>}

      {/* ───────── EN VIAJE ───────── */}
      {vista === 'viaje' && (
        <div className="space-y-5">
          {porProducto.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Total en viaje</p>
              <div className="flex flex-wrap gap-2">
                {porProducto.map(p => (
                  <span key={p.nombre} className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm">
                    <span className="font-bold text-white">{p.nombre}</span> <span className="font-black text-blue-400">{kg(p.cantidad, p.unidad)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {enViaje.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Truck size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-bold">No hay pedidos en viaje</p>
              <button onClick={() => setVista('nuevo')} className="hp-glass mt-4 px-4 py-2.5 text-sm font-black">➕ Cargar un pedido</button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {enViaje.map(c => {
                const chip = chipLlegada(c);
                return (
                  <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black text-white truncate">{c.proveedor || 'Pedido sin proveedor'}</h3>
                        <p className="text-xs text-slate-500">Pedido el {fmtFecha(c.fecha_pedido)} · llega el {fmtFecha(c.fecha_llegada)}</p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full ${chip.cls}`}>{chip.txt}</span>
                    </div>
                    <div className="divide-y divide-slate-800 rounded-xl bg-slate-800/40 px-4">
                      {c.items.map((i, k) => (
                        <div key={k} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-white">{i.nombre}</span>
                          <span className="font-black text-blue-400 whitespace-nowrap">{kg(i.cantidad, i.unidad)}</span>
                        </div>
                      ))}
                    </div>
                    {c.notas && <p className="text-xs text-slate-400">📝 {c.notas}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => abrirRecibir(c)}
                        className="flex-1 min-w-32 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2">
                        <Check size={16} /> Recibido
                      </button>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                        Nueva fecha
                        <input type="date" value={c.fecha_llegada} onChange={e => e.target.value && actualizar(c.id, { fecha_llegada: e.target.value })}
                          className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                      </label>
                      <button onClick={() => cancelarPedido(c)} className="px-3 py-2 text-xs font-black text-slate-400 hover:text-red-400 rounded-lg">Cancelar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────── NUEVO PEDIDO ───────── */}
      {vista === 'nuevo' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor</span>
              <input list="proveedores" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500" />
              <datalist id="proveedores">{proveedores.map(p => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Fecha del pedido</span>
              <input type="date" value={fechaPedido} onChange={e => setFechaPedido(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500" />
            </label>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Llega el</span>
              <input type="date" value={fechaLlegada} onChange={e => setFechaLlegada(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-blue-500" />
              <div className="flex gap-2 mt-2">
                {[7, 10, 12].map(n => (
                  <button key={n} type="button" onClick={() => setFechaLlegada(sumarDias(fechaPedido || hoyISO(), n))}
                    className="hp-glass px-3 py-1.5 text-xs font-black">+{n} días</button>
                ))}
              </div>
              {fechaLlegada && <p className="text-[11px] text-slate-500 mt-1.5">Llega en {Math.max(0, diasHasta(fechaLlegada))} días desde hoy.</p>}
            </div>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Nota (opcional)</span>
              <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: despachan el martes"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            </label>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Agregar producto</span>
              <ProductoPicker rows={stockRows} onPick={agregarItem} />
            </div>

            {items.length === 0 ? (
              <p className="text-center text-slate-500 text-sm font-bold py-10">Buscá un producto para empezar el pedido</p>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const esPeso = it.row.unidad === 'kg' || it.row.unidad === 'lt';
                  const cant = parseNumero(it.cantidad);
                  const precio = parseNumero(it.precio);
                  return (
                    <div key={it.row.id} className="bg-slate-800/50 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="font-black text-white">{it.row.nombre}</p>
                          <p className="text-[11px] text-slate-500">{it.row.categoria}</p>
                        </div>
                        <button onClick={() => setItems(prev => prev.filter((_, k) => k !== idx))} aria-label="Quitar"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800"><X size={16} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad ({it.row.unidad})</span>
                          <input type="text" inputMode="decimal" value={it.cantidad} placeholder="0"
                            onChange={e => setItems(prev => prev.map((x, k) => k === idx ? { ...x, cantidad: e.target.value.replace(/[^0-9.,]/g, '') } : x))}
                            className="w-full bg-slate-800 border-2 border-slate-700 text-white rounded-xl px-3 py-2.5 text-xl font-black text-center outline-none focus:border-blue-500" />
                        </label>
                        <label className="block">
                          <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Precio por {it.row.unidad} (opcional)</span>
                          <input type="text" inputMode="decimal" value={it.precio} placeholder="0"
                            onChange={e => setItems(prev => prev.map((x, k) => k === idx ? { ...x, precio: e.target.value.replace(/[^0-9.,]/g, '') } : x))}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-bold text-center outline-none focus:border-blue-500" />
                        </label>
                      </div>
                      {esPeso && cant >= 1000 && <p className="text-xs text-red-400 font-bold mt-2">⚠️ {cant} {it.row.unidad} es muchísimo: ¿pusiste gramos en vez de kilos?</p>}
                      {cant > 0 && precio > 0 && <p className="text-xs text-slate-400 mt-2">Total de este producto: <span className="font-black text-white">{formatPlata(cant * precio)}</span></p>}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={guardarPedido} disabled={!puedeGuardar}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              <Plus size={18} /> {guardando ? 'Guardando…' : itemsValidos.length ? `Guardar pedido (${itemsValidos.length} producto${itemsValidos.length > 1 ? 's' : ''}) · en viaje` : 'Guardar pedido'}
            </button>
          </div>
        </div>
      )}

      {/* ───────── HISTORIAL ───────── */}
      {vista === 'historial' && (
        historial.length === 0 ? (
          <p className="text-center text-slate-500 font-bold py-16">Todavía no hay pedidos recibidos ni cancelados</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {historial.map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">{c.proveedor || 'Pedido sin proveedor'}</h3>
                    <p className="text-xs text-slate-500">Pedido el {fmtFecha(c.fecha_pedido)}{c.recibido_at ? ` · recibido el ${fmtFecha(c.recibido_at.slice(0, 10))}` : ''}</p>
                  </div>
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${c.estado === 'recibido' ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {c.estado === 'recibido' ? 'Recibido' : 'Cancelado'}
                  </span>
                </div>
                <div className="divide-y divide-slate-800 rounded-xl bg-slate-800/40 px-4">
                  {c.items.map((i, k) => {
                    const dif = c.estado === 'recibido' && i.recibido != null ? i.recibido - i.cantidad : 0;
                    return (
                      <div key={k} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-white">{i.nombre}</span>
                        <span className="text-right whitespace-nowrap">
                          <span className="font-black text-white">{kg(c.estado === 'recibido' && i.recibido != null ? i.recibido : i.cantidad, i.unidad)}</span>
                          {Math.abs(dif) > 0.0005 && <span className={`ml-2 text-[11px] font-black ${dif < 0 ? 'text-red-400' : 'text-green-400'}`}>{dif > 0 ? '+' : ''}{kg(dif, i.unidad)} vs pedido</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ───────── RECIBIR ───────── */}
      {recibiendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 max-md:p-0" onClick={() => !procesando && setRecibiendo(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl max-md:max-w-none max-md:max-h-none max-md:h-full max-md:rounded-none">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="font-black text-white text-lg">Recibir pedido</h3>
                <p className="text-xs text-slate-400">{recibiendo.proveedor || 'Sin proveedor'} · confirmá cuánto llegó de cada producto</p>
              </div>
              <button onClick={() => setRecibiendo(null)} disabled={procesando} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {recibiendo.items.map((it, idx) => {
                const real = parseNumero(llegaron[idx]) || 0;
                const dif = real - it.cantidad;
                return (
                  <div key={idx} className="bg-slate-800/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-black text-white">{it.nombre}</span>
                      <span className="text-xs text-slate-500">Pedido: <span className="font-black text-slate-300">{kg(it.cantidad, it.unidad)}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="decimal" value={llegaron[idx] ?? ''}
                        onChange={e => setLlegaron(prev => prev.map((v, k) => k === idx ? e.target.value.replace(/[^0-9.,]/g, '') : v))}
                        className="flex-1 min-w-0 bg-slate-800 border-2 border-slate-700 text-white rounded-xl px-3 py-2.5 text-xl font-black text-center outline-none focus:border-green-500" />
                      <span className="text-slate-400 font-black">{it.unidad}</span>
                    </div>
                    {Math.abs(dif) > 0.0005 && (
                      <p className={`text-xs font-bold mt-2 ${dif < 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {dif < 0 ? `Faltan ${kg(-dif, it.unidad)} respecto del pedido` : `Llegaron ${kg(dif, it.unidad)} de más`}
                      </p>
                    )}
                    {(it.unidad === 'kg' || it.unidad === 'lt') && real >= 1000 && <p className="text-xs text-red-400 font-bold mt-2">⚠️ {real} {it.unidad} es muchísimo: ¿gramos en vez de kilos?</p>}
                  </div>
                );
              })}
              <p className="text-xs text-slate-500">Al confirmar, estos kilos se <strong className="text-slate-300">suman al stock</strong> y el pedido pasa al historial.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-2 shrink-0">
              <button onClick={() => setRecibiendo(null)} disabled={procesando} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
              <button onClick={confirmarRecepcion} disabled={procesando}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl text-sm disabled:opacity-50">
                {procesando ? 'Cargando al stock…' : '✓ Confirmar y cargar al stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
