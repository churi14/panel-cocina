"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { ReceiptText, HelpCircle, Plus, Trash2, Search, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { norm } from '../components/kitchenHelpers';
import { formatNumero, formatPlata } from './format';
import HopeSwitch from './HopeSwitch';
import { PrecioInput, usePrecios } from './costos/shared';
import { FACTURAS_SEED, type Factura, type ItemFactura } from './facturas/seed';

// ─────────────────────────────────────────────────────────────────────────────
// Registro de facturas: lo que se compró, a qué proveedor y a qué precio.
//  Facturas   → cada factura con sus renglones, todo editable
//  Por insumo → el precio por kg / lt / u de cada insumo, comparando compras
// Se guarda en la tabla `facturas_registro` (sql/20261106_facturas_registro.sql); sin la tabla, en este navegador. "Pasar a Costos" manda el precio a Costos.
// ─────────────────────────────────────────────────────────────────────────────

const LS = 'registro_facturas_v1';
type Vista = 'facturas' | 'insumos';
const UC: ItemFactura['uc'][] = ['kg', 'lt', 'u'];

const fecha = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso; };
const ppu = (i: ItemFactura) => (i.precio !== null && i.cont ? i.precio / i.cont : null);
const totalItem = (i: ItemFactura) => (i.precio !== null ? i.cant * i.precio : 0);
const totalFactura = (f: Factura) => f.items.reduce((s, i) => s + totalItem(i), 0);
const duda = (i: ItemFactura) => !!i.duda || i.precio === null || !i.cont;
const nuevoId = () => `f${Date.now().toString(36)}`;

const inputCls = 'bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none focus:border-blue-500';

function Texto({ valor, onCommit, placeholder, className = '' }: { valor: string; onCommit: (v: string) => void; placeholder?: string; className?: string }) {
  const [t, setT] = useState(valor);
  useEffect(() => setT(valor), [valor]);
  return (
    <input value={t} placeholder={placeholder} onChange={e => setT(e.target.value)}
      onBlur={() => { if (t !== valor) onCommit(t); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={`${inputCls} ${className}`} />
  );
}

/** Botón (?) que abre una explicación corta. Se cierra al tocar de nuevo o al salir. */
function Ayuda({ children, ancho = 'w-72' }: { children: React.ReactNode; ancho?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" aria-label="Ayuda" onClick={e => { e.preventDefault(); e.stopPropagation(); setAbierto(v => !v); }} onBlur={() => setAbierto(false)}
        className={`ml-1 rounded-full ${abierto ? 'text-blue-400' : 'text-slate-500 hover:text-blue-400'}`}>
        <HelpCircle size={14} />
      </button>
      {abierto && (
        <span role="tooltip" className={`absolute z-30 left-0 top-full mt-1.5 ${ancho} max-w-[80vw] rounded-xl border border-blue-500/40 bg-slate-950 p-3 text-xs font-medium normal-case tracking-normal leading-relaxed text-slate-200 shadow-xl`}>
          {children}
        </span>
      )}
    </span>
  );
}

const rotulo = 'text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center';

/** Lo que el sistema entendió de un renglón, dicho en palabras (o qué falta). */
function resumen(i: ItemFactura): { ok: boolean; texto: string } {
  if (i.precio === null) return { ok: false, texto: 'Falta el precio de la factura.' };
  if (!i.cont) return { ok: false, texto: 'Falta cuánto trae cada unidad (kg, lt o unidades).' };
  if (!i.cant) return { ok: false, texto: 'La cantidad está en 0: poné cuánto se compró.' };
  const tot = i.cant * i.cont;
  const comprado = i.cont === 1 ? `${formatNumero(i.cant)} ${i.uc}` : `${formatNumero(i.cant)} × ${formatNumero(i.cont)} ${i.uc} = ${formatNumero(tot)} ${i.uc}`;
  return { ok: true, texto: `Entendí: compraste ${comprado}, a ${formatPlata(i.precio / i.cont)} el ${i.uc}. Total de la factura: ${formatPlata(i.cant * i.precio)}.` };
}

export default function TabRegistro() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [listo, setListo] = useState(false);
  const [modo, setModo] = useState<'cargando' | 'nube' | 'local'>('cargando');
  const [vista, setVista] = useState<Vista>('facturas');
  const [q, setQ] = useState('');
  const [soloDudas, setSoloDudas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [stockNombres, setStockNombres] = useState<string[]>([]);
  const { precios, guardar } = usePrecios();
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    (async () => {
      let local: Factura[] | null = null;
      try { const raw = localStorage.getItem(LS); if (raw) local = JSON.parse(raw); } catch { /* sin localStorage */ }
      const { data, error } = await supabase.from('facturas_registro').select('id, data');
      if (!error && data) {
        setModo('nube');
        if (data.length > 0) setFacturas(data.map((r: any) => r.data as Factura));
        else {
          // tabla vacía: se sube lo que había en este navegador (o los datos originales)
          const inicial = local ?? FACTURAS_SEED;
          setFacturas(inicial);
          await supabase.from('facturas_registro').upsert(inicial.map(f => ({ id: f.id, data: f, updated_at: new Date().toISOString() })));
        }
      } else {
        setModo('local');
        setFacturas(local ?? FACTURAS_SEED);
      }
      setListo(true);
    })();
    supabase.from('stock').select('nombre').then(({ data }) => { if (data) setStockNombres([...new Set(data.map((r: any) => r.nombre as string))].sort()); });
  }, []);

  const persistir = async (lista: Factura[]) => {
    const antes = new Map(facturas.map(f => [f.id, JSON.stringify(f)]));
    setFacturas(lista);
    try { localStorage.setItem(LS, JSON.stringify(lista)); } catch { /* sin localStorage */ }  // copia de respaldo
    if (modo !== 'nube') return;
    const cambiadas = lista.filter(f => antes.get(f.id) !== JSON.stringify(f));
    const borradas = facturas.filter(f => !lista.some(x => x.id === f.id)).map(f => f.id);
    if (cambiadas.length) await supabase.from('facturas_registro').upsert(cambiadas.map(f => ({ id: f.id, data: f, updated_at: new Date().toISOString() })));
    if (borradas.length) await supabase.from('facturas_registro').delete().in('id', borradas);
  };
  const editarFactura = (id: string, patch: Partial<Factura>) => persistir(facturas.map(f => f.id === id ? { ...f, ...patch } : f));
  const editarItem = (id: string, idx: number, patch: Partial<ItemFactura>) =>
    persistir(facturas.map(f => f.id === id ? { ...f, items: f.items.map((i, k) => k === idx ? { ...i, ...patch } : i) } : f));
  const quitarItem = (id: string, idx: number) =>
    persistir(facturas.map(f => f.id === id ? { ...f, items: f.items.filter((_, k) => k !== idx) } : f));
  const agregarItem = (id: string) =>
    persistir(facturas.map(f => f.id === id ? { ...f, items: [...f.items, { desc: '', insumo: '', cant: 1, precio: null, cont: 1, uc: 'kg' as const }] } : f));
  const nuevaFactura = () => {
    const f: Factura = { id: nuevoId(), proveedor: '', numero: '', fecha: new Date().toLocaleDateString('en-CA'), items: [] };
    persistir([f, ...facturas]); setAbierta(f.id); setVista('facturas');
  };
  const borrarFactura = (f: Factura) => {
    if (window.confirm(`¿Borrar la factura ${f.numero || ''} de ${f.proveedor || 'sin proveedor'}?`)) persistir(facturas.filter(x => x.id !== f.id));
  };
  const restaurar = () => {
    if (window.confirm('Esto borra TODO lo que corregiste y vuelve a los datos leídos de las fotos. ¿Seguro?')) { persistir(FACTURAS_SEED); setAviso('Datos originales restaurados'); }
  };

  const existeEnStock = (n: string) => stockNombres.some(s => norm(s) === norm(n));
  const pasarACostos = async (insumo: string, valor: number, uc: string) => {
    await guardar(norm(insumo), insumo, Math.round(valor * 100) / 100, uc);
    setAviso(`${insumo}: ${formatPlata(valor)} por ${uc} pasado a Costos`);
    setTimeout(() => setAviso(''), 3500);
  };

  const filtradas = useMemo(() => {
    const t = norm(q);
    return [...facturas]
      .filter(f => !soloDudas || f.items.some(duda))
      .filter(f => !t || norm(`${f.proveedor} ${f.numero} ${f.items.map(i => `${i.desc} ${i.insumo}`).join(' ')}`).includes(t))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [facturas, q, soloDudas]);

  // Vista por insumo: la última compra de cada uno y la anterior, para ver cuánto cambió
  const porInsumo = useMemo(() => {
    const m = new Map<string, { insumo: string; uc: string; compras: { fecha: string; proveedor: string; p: number }[]; dudas: number }>();
    facturas.forEach(f => f.items.forEach(i => {
      if (!i.insumo.trim()) return;
      const k = norm(i.insumo);
      const e = m.get(k) ?? { insumo: i.insumo, uc: i.uc, compras: [], dudas: 0 };
      const p = ppu(i);
      if (p !== null) e.compras.push({ fecha: f.fecha, proveedor: f.proveedor, p }); else e.dudas++;
      m.set(k, e);
    }));
    return [...m.values()]
      .map(e => ({ ...e, compras: e.compras.sort((a, b) => b.fecha.localeCompare(a.fecha)) }))
      .filter(e => !norm(q) || norm(e.insumo).includes(norm(q)))
      .sort((a, b) => a.insumo.localeCompare(b.insumo));
  }, [facturas, q]);

  const nDudas = facturas.reduce((s, f) => s + f.items.filter(duda).length, 0);

  if (!listo) return <p className="text-slate-500 font-bold py-16 text-center">Cargando…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ReceiptText className="text-blue-400" size={22} />
          <div>
            <h2 className="text-xl font-black text-white flex items-center">Registro de facturas
              <Ayuda ancho="w-80"><b>¿Cómo cargo una factura nueva?</b><br />1. Tocá <b>+ Factura</b> y completá proveedor, número y fecha.<br />2. Abrí la factura y tocá <b>Agregar renglón</b> por cada producto.<br />3. Completá insumo, cantidad, precio y cuánto trae cada una (tocá el <b>?</b> de cada campo si dudás).<br />4. Mirá la línea gris: dice lo que entendió el sistema. Si está en amarillo, falta algo.<br />5. Si el precio está bien, tocá <b>Pasar a Costos</b>.<br />Los cambios se guardan solos.</Ayuda>
            </h2>
            <p className="text-xs text-slate-500">{facturas.length} facturas · {nDudas} renglones para revisar · {modo === 'nube' ? 'guardado en la base · lo ve todo el equipo' : 'solo en este navegador (falta correr el SQL)'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={restaurar} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white border border-slate-700 rounded-xl flex items-center gap-1.5"><RotateCcw size={14} /> Datos originales</button>
          <button onClick={nuevaFactura} className="px-4 py-2 text-sm font-black bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-1.5"><Plus size={16} /> Factura</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HopeSwitch fit name="registro-vista" value={vista} onChange={setVista}
          options={[{ id: 'facturas', label: <span>🧾 Facturas</span> }, { id: 'insumos', label: <span>💲 Por insumo</span> }]} />
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proveedor, número o insumo"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-700 bg-slate-800 text-white outline-none focus:border-blue-500" />
        </div>
        {vista === 'facturas' && (
          <button onClick={() => setSoloDudas(v => !v)}
            className={`px-3 py-2.5 text-xs font-black rounded-xl border flex items-center gap-1.5 ${soloDudas ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-slate-700 text-slate-400'}`}>
            <AlertTriangle size={14} /> Solo con dudas
          </button>
        )}
      </div>

      {aviso && <p className="text-sm font-bold text-emerald-400">✓ {aviso}</p>}

      <datalist id="insumos-stock">{stockNombres.map(n => <option key={n} value={n} />)}</datalist>

      {/* ───────── FACTURAS ───────── */}
      {vista === 'facturas' && (
        <div className="space-y-3">
          {filtradas.length === 0 && <p className="text-center text-slate-500 font-bold py-16">No hay facturas que coincidan</p>}
          {filtradas.map(f => {
            const abre = abierta === f.id;
            const nd = f.items.filter(duda).length;
            return (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-2xl">
                <button onClick={() => setAbierta(abre ? null : f.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <p className="font-black text-white truncate">{f.proveedor || 'Sin proveedor'} <span className="text-slate-500 font-bold text-xs">· {f.numero || 'sin número'}</span></p>
                    <p className="text-xs text-slate-500 truncate">{fecha(f.fecha)} · {f.items.map(i => i.insumo || i.desc).filter(Boolean).join(', ') || 'sin renglones'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {nd > 0 && <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5">{nd} por revisar</span>}
                    <span className="font-black text-white">{totalFactura(f) ? formatPlata(totalFactura(f)) : '—'}</span>
                    {abre ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                  </div>
                </button>

                {abre && (
                  <div className="border-t border-slate-800 p-4 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="block"><span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor</span>
                        <Texto valor={f.proveedor} onCommit={v => editarFactura(f.id, { proveedor: v })} className="w-full" /></label>
                      <label className="block"><span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Número</span>
                        <Texto valor={f.numero} onCommit={v => editarFactura(f.id, { numero: v })} className="w-full" /></label>
                      <label className="block"><span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Fecha</span>
                        <input type="date" value={f.fecha} onChange={e => e.target.value && editarFactura(f.id, { fecha: e.target.value })} className={`${inputCls} w-full`} /></label>
                    </div>

                    {f.items.map((i, idx) => {
                      const p = ppu(i);
                      const enCostos = precios[norm(i.insumo)];
                      return (
                        <div key={idx} className={`rounded-xl border p-3 space-y-2.5 ${duda(i) ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
                          <div className="flex gap-2">
                            <Texto valor={i.desc} placeholder="Descripción como figura en la factura" onCommit={v => editarItem(f.id, idx, { desc: v })} className="flex-1 min-w-0" />
                            <button onClick={() => quitarItem(f.id, idx)} aria-label="Quitar renglón" className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                          </div>
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="block"><span className={rotulo}>Insumo (Stock / Costos)<Ayuda>El nombre del producto <b>como está en Stock</b>. Elegilo de la lista que aparece al escribir, así el precio llega bien a Costos. Ej: Muzzarella, Harina 000, Lomo.</Ayuda></span>
                              <input list="insumos-stock" defaultValue={i.insumo} key={i.insumo}
                                onBlur={e => e.target.value !== i.insumo && editarItem(f.id, idx, { insumo: e.target.value })}
                                className={`${inputCls} w-52`} placeholder="Ej: Muzzarella" /></label>
                            <label className="block"><span className={rotulo}>Cantidad<Ayuda>Cuánto se compró.<br />• Si se vende <b>por kilo</b> (carne, queso en barra, verdura, fiambre): los <b>kilos totales</b>. Ej: 30,2<br />• Si viene en <b>bolsas, cajas o latas</b>: <b>cuántas</b> bolsas, cajas o latas. Ej: 3<br />Las piezas sueltas no cuentan.</Ayuda></span>
                              <PrecioInput ancho="w-24" valor={i.cant} onCommit={v => editarItem(f.id, idx, { cant: v ?? 0 })} /></label>
                            <label className="block"><span className={rotulo}>Precio c/u ($)<Ayuda>El precio de <b>UNA unidad</b>, como figura en la factura (si hay descuento, el ya descontado).<br />• Por kilo: el precio del kilo.<br />• Por bolsa o caja: el precio de una bolsa o caja.</Ayuda></span>
                              <PrecioInput ancho="w-32" valor={i.precio} onCommit={v => editarItem(f.id, idx, { precio: v })} /></label>
                            <label className="block"><span className={rotulo}>Trae cada una<Ayuda>Cuánto trae <b>cada unidad</b> de la cantidad.<br />• Se vende por kilo → <b>1 kg</b><br />• Bolsa de 25 kg → <b>25 kg</b><br />• Paquete de 500 g → <b>0,5 kg</b><br />• Bidón de 5 litros → <b>5 lt</b><br />• Caja de 48 panes → <b>48 u</b><br />Si no lo sabés, dejalo vacío y escribí la duda en la nota.</Ayuda></span>
                              <span className="flex items-center gap-1.5">
                                <PrecioInput ancho="w-20" valor={i.cont} onCommit={v => editarItem(f.id, idx, { cont: v })} />
                                <select value={i.uc} onChange={e => editarItem(f.id, idx, { uc: e.target.value as ItemFactura['uc'] })} className={`${inputCls} py-1.5`}>
                                  {UC.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </span></label>
                            <div className="ml-auto text-right">
                              <p className="text-[10px] text-slate-500 uppercase font-bold">Precio por {i.uc}</p>
                              <p className="text-lg font-black text-white">{p !== null ? formatPlata(p) : '—'}</p>
                              <p className="text-[11px] text-slate-500">Total {i.precio !== null ? formatPlata(totalItem(i)) : '—'}</p>
                            </div>
                          </div>
                          {(() => { const r = resumen(i); return (
                            <p className={`text-xs font-semibold ${r.ok ? 'text-slate-400' : 'text-amber-400'}`}>{r.ok ? '' : '⚠ '}{r.texto}</p>
                          ); })()}
                          <div className="flex flex-wrap items-center gap-2">
                            <Ayuda ancho="w-72"><b>Nota / duda.</b> Si algo no se lee o no estás seguro (no sabés cuánto trae, no se ve el precio), escribilo acá: el renglón queda marcado en amarillo para que alguien lo revise. Si está todo bien, dejala vacía.</Ayuda>
                            <Texto valor={i.duda ?? ''} placeholder="Nota / duda (se borra si lo dejás vacío)" onCommit={v => editarItem(f.id, idx, { duda: v.trim() || undefined })}
                              className={`flex-1 min-w-[200px] text-xs ${i.duda ? 'text-amber-300' : ''}`} />
                            {i.duda && (
                              <button onClick={() => editarItem(f.id, idx, { duda: undefined })}
                                className="px-3 py-1.5 text-xs font-black rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1.5">
                                <Check size={13} /> Ya lo resolví
                              </button>
                            )}
                            {p !== null && i.insumo.trim() && (
                              <button onClick={() => pasarACostos(i.insumo.trim(), p, i.uc)}
                                className="px-3 py-1.5 text-xs font-black rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 flex items-center gap-1.5">
                                <Check size={13} /> Pasar a Costos{enCostos ? ` (hoy ${formatPlata(enCostos.precio)})` : ''}
                              </button>
                            )}
                            {p !== null && i.insumo.trim() && (
                              <Ayuda ancho="w-72"><b>Pasar a Costos</b> manda este precio por {i.uc} a la pantalla Costos, y las recetas lo usan para calcular cuánto cuesta cada producto. Reemplaza el precio anterior de ese insumo. Si no lo apretás, Costos no cambia.</Ayuda>
                            )}
                            {i.insumo.trim() && !existeEnStock(i.insumo) && stockNombres.length > 0 && (
                              <span className="text-[11px] text-slate-500">no figura en Stock con ese nombre</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between">
                      <button onClick={() => agregarItem(f.id)} className="text-sm font-black text-blue-400 hover:text-blue-300 flex items-center gap-1.5"><Plus size={15} /> Agregar renglón</button>
                      <button onClick={() => borrarFactura(f)} className="text-xs font-bold text-slate-500 hover:text-red-400 flex items-center gap-1.5"><Trash2 size={14} /> Borrar factura</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ───────── POR INSUMO ───────── */}
      {vista === 'insumos' && (
        <div className="grid lg:grid-cols-2 gap-3">
          {porInsumo.length === 0 && <p className="text-center text-slate-500 font-bold py-16 lg:col-span-2">No hay insumos que coincidan</p>}
          {porInsumo.map(e => {
            const ult = e.compras[0], ant = e.compras[1];
            const var_ = ult && ant ? ((ult.p - ant.p) / ant.p) * 100 : null;
            const enCostos = precios[norm(e.insumo)];
            return (
              <div key={e.insumo} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">{e.insumo}</h3>
                    <p className="text-xs text-slate-500">{e.compras.length} compra{e.compras.length === 1 ? '' : 's'}{e.dudas ? ` · ${e.dudas} sin precio por ${e.uc}` : ''}</p>
                  </div>
                  {ult ? (
                    <div className="text-right">
                      <p className="text-xl font-black text-white">{formatPlata(ult.p)}<span className="text-xs text-slate-500 font-bold"> /{e.uc}</span></p>
                      {var_ !== null && Math.abs(var_) >= 0.5 && (
                        <p className={`text-[11px] font-black ${var_ > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{var_ > 0 ? '▲' : '▼'} {formatNumero(Math.abs(var_), 1)}% vs compra anterior</p>
                      )}
                    </div>
                  ) : <span className="text-xs text-amber-400 font-bold">Falta el precio</span>}
                </div>
                {e.compras.slice(0, 3).map((c, k) => (
                  <p key={k} className="text-xs text-slate-400 flex justify-between"><span>{fecha(c.fecha)} · {c.proveedor}</span><span className="font-bold">{formatPlata(c.p)}</span></p>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">{enCostos ? `En Costos hoy: ${formatPlata(enCostos.precio)} /${enCostos.unidad}` : 'Todavía no está en Costos'}</span>
                  {ult && (
                    <button onClick={() => pasarACostos(e.insumo, ult.p, e.uc)}
                      className="px-3 py-1.5 text-xs font-black rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 flex items-center gap-1.5"><Check size={13} /> Pasar a Costos</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
