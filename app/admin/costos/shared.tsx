"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import type { StockRow } from '../../components/kitchenHelpers';
import { parseNumero } from '../../components/stockNames';
import { formatNumero, formatCantidad, formatPlata } from '../format';
import { MANO_OBRA_MEDALLON, type Precios, type RecetaFudoRow } from './engine';

export type Modo = 'cargando' | 'nube' | 'local';

/**
 * Precios guardados en la tabla `costos_insumos` (sql/20261104_costos_insumos.sql).
 * Mientras la tabla no exista, quedan en este navegador (localStorage).
 */
export function usePrecios() {
  const [precios, setPrecios] = useState<Precios>({});
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

/** Un valor de mano de obra por medallón, cargado un día. El vigente es el más reciente y queda fijo hasta cargar otro. */
export type EntradaMO = { fecha: string; jornada: number | null; medallones: number | null; por_medallon: number; nota: string };

export const hoyISO = () => {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Historial de mano de obra por medallón: tabla `costos_mano_obra` (sql/20261106_costos_mano_obra.sql).
 * Mientras la tabla no exista, queda en este navegador (localStorage).
 */
export function useManoObra() {
  const LS = 'costos_mano_obra';
  const [historial, setHistorial] = useState<EntradaMO[]>([]);
  const [modo, setModo] = useState<Modo>('cargando');
  const inicial = (): EntradaMO => ({ fecha: hoyISO(), jornada: null, medallones: null, por_medallon: MANO_OBRA_MEDALLON, nota: 'Valor inicial estimado por cocina' });
  const ordenar = (l: EntradaMO[]) => [...l].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fila = (r: any): EntradaMO => ({
    fecha: r.fecha, jornada: r.jornada === null ? null : Number(r.jornada), medallones: r.medallones === null ? null : Number(r.medallones),
    por_medallon: Number(r.por_medallon), nota: r.nota ?? '',
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('costos_mano_obra').select('fecha, jornada, medallones, por_medallon, nota').order('fecha');
      if (!error && data) {
        if (data.length === 0) {
          const ini = inicial();
          await supabase.from('costos_mano_obra').upsert({ ...ini, updated_at: new Date().toISOString() }, { onConflict: 'fecha' });
          setHistorial([ini]);
        } else setHistorial(data.map(fila));
        setModo('nube');
        return;
      }
      let local: EntradaMO[] = [];
      try { const raw = localStorage.getItem(LS); if (raw) local = JSON.parse(raw); } catch { /* sin localStorage */ }
      setHistorial(local.length ? ordenar(local) : [inicial()]);
      setModo('local');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Guarda (o cambia) el valor de un día. `fechaVieja` si se corrigió la fecha de una carga. */
  const guardar = async (e: EntradaMO, fechaVieja?: string) => {
    const next = ordenar([...historial.filter(h => h.fecha !== e.fecha && h.fecha !== (fechaVieja ?? e.fecha)), e]);
    setHistorial(next);
    if (modo === 'nube') {
      if (fechaVieja && fechaVieja !== e.fecha) await supabase.from('costos_mano_obra').delete().eq('fecha', fechaVieja);
      await supabase.from('costos_mano_obra').upsert({ ...e, updated_at: new Date().toISOString() }, { onConflict: 'fecha' });
    } else { try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* ignorar */ } }
  };

  const borrar = async (fecha: string) => {
    if (historial.length <= 1) return;   // siempre tiene que quedar un valor vigente
    const next = historial.filter(h => h.fecha !== fecha);
    setHistorial(next);
    if (modo === 'nube') await supabase.from('costos_mano_obra').delete().eq('fecha', fecha);
    else { try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* ignorar */ } }
  };

  // vigente = la carga más reciente que ya llegó (una fecha futura espera a su día)
  const hoy = hoyISO();
  const vigenteEntrada = [...historial].reverse().find(h => h.fecha <= hoy) ?? historial[0];
  return { historial, modo, guardar, borrar, vigente: vigenteEntrada?.por_medallon ?? MANO_OBRA_MEDALLON, vigenteEntrada };
}

/** Todo lo que necesitan las pantallas de costos, cargado una sola vez. */
export function useDatosCostos() {
  const p = usePrecios();
  const manoObra = useManoObra();
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [recetasFudo, setRecetasFudo] = useState<RecetaFudoRow[]>([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('stock').select('id, nombre, unidad, categoria'),
      supabase.from('recetas_fudo').select('producto_fudo, ingrediente, cantidad, unidad, tabla_origen').range(0, 4999),
    ]).then(([s, r]) => {
      if (s.data) setStockRows(s.data as StockRow[]);
      if (r.data) setRecetasFudo(r.data as RecetaFudoRow[]);
      setCargado(true);
    });
  }, []);

  return { ...p, manoObra, stockRows, recetasFudo, cargado };
}

export type DatosCostos = ReturnType<typeof useDatosCostos>;

/** Campo de precio: se guarda al salir del campo o con Enter. Vacío = sin precio. */
export function PrecioInput({ valor, onCommit, placeholder = '0', ancho = 'w-28' }: {
  valor: number | null; onCommit: (v: number | null) => void; placeholder?: string; ancho?: string;
}) {
  const [txt, setTxt] = useState(valor === null ? '' : String(valor).replace('.', ','));
  useEffect(() => { setTxt(valor === null ? '' : String(valor).replace('.', ',')); }, [valor]);
  const commit = () => {
    const n = parseNumero(txt);
    if (txt.trim() === '') { if (valor !== null) onCommit(null); return; }
    if (!isNaN(n) && n >= 0 && n !== valor) onCommit(n);
    else setTxt(valor === null ? '' : String(valor).replace('.', ','));
  };
  return (
    <input type="text" inputMode="decimal" value={txt} placeholder={placeholder}
      onChange={e => setTxt(e.target.value.replace(/[^0-9.,]/g, ''))}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={`${ancho} text-right bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none focus:border-blue-500`} />
  );
}

/** Ventana de aviso con dos botones. Se cierra con Escape o tocando afuera (= cancelar). */
export function ModalConfirmar({ titulo, children, textoOk, textoCancelar = 'Cancelar', onOk, onCancelar }: {
  titulo: string; children: React.ReactNode; textoOk: string; textoCancelar?: string; onOk: () => void; onCancelar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-left" onClick={onCancelar}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <h3 className="font-black text-white text-lg">{titulo}</h3>
        <div className="text-sm text-slate-300 space-y-2">{children}</div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancelar} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">{textoCancelar}</button>
          <button type="button" autoFocus onClick={onOk} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm">{textoOk}</button>
        </div>
      </div>
    </div>
  );
}

/** Cantidad legible: 1500 g → "1,5 kg", 250 g → "250 g". */
export function fmtQty(qty: number, unit: string): string {
  if (unit === 'g' || unit === 'gr') { const f = formatCantidad(qty / 1000, 'kg'); return `${f.num} ${f.unit}`; }
  if (unit === 'kg' || unit === 'lt') { const f = formatCantidad(qty, unit); return `${f.num} ${f.unit}`; }
  return `${formatNumero(qty, Number.isInteger(qty) ? 0 : 2)} ${unit}`;
}

/**
 * Precio de un insumo + botón "pieza": para cuando se compra una pieza entera (un jamón, una barra)
 * y se conoce cuánto costó y cuánto pesa. Calcula el precio por kilo y, si se indica el peso de una
 * feta o porción, cuánto cuesta cada una.
 */
export function PrecioConPieza({ valor, unidad, onCommit, ancho = 'w-28', placeholder = '0', nombre }: {
  valor: number | null; unidad: string; onCommit: (v: number | null) => void;
  ancho?: string; placeholder?: string; nombre?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [precioPieza, setPrecioPieza] = useState('');
  const [pesoPieza, setPesoPieza] = useState('');
  const [pesoPorcion, setPesoPorcion] = useState('');
  const esPeso = unidad === 'kg' || unidad === 'lt';
  const uPeso = unidad === 'lt' ? 'litros' : 'kg';

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const pp = parseNumero(precioPieza), kg = parseNumero(pesoPieza), g = parseNumero(pesoPorcion);
  const porKg = pp > 0 && kg > 0 ? pp / kg : null;
  const porPorcion = porKg !== null && g > 0 ? porKg * (g / 1000) : null;
  const solo = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value.replace(/[^0-9.,]/g, ''));

  return (
    <span className="inline-flex items-center gap-1.5">
      <PrecioInput valor={valor} onCommit={onCommit} ancho={ancho} placeholder={placeholder} />
      {esPeso && (
        <button type="button" onClick={() => setAbierto(true)} title="Calcular desde el precio de una pieza entera"
          className="hp-glass px-2 py-1 text-[11px] font-black">pieza</button>
      )}
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 text-left" onClick={() => setAbierto(false)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 whitespace-normal">
            <div>
              <h3 className="font-black text-white">Precio por pieza{nombre ? ` · ${nombre}` : ''}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Cargá lo que costó la pieza entera y cuánto pesa: el sistema calcula el precio por {unidad}.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Precio de la pieza ($)</span>
                <input autoFocus type="text" inputMode="decimal" value={precioPieza} onChange={solo(setPrecioPieza)} placeholder="20000"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-blue-500" />
              </label>
              <label className="block">
                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Pesa ({uPeso})</span>
                <input type="text" inputMode="decimal" value={pesoPieza} onChange={solo(setPesoPieza)} placeholder="4"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-blue-500" />
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Peso de una feta o porción en gramos (opcional)</span>
              <input type="text" inputMode="decimal" value={pesoPorcion} onChange={solo(setPesoPorcion)} placeholder="20"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-bold text-center outline-none focus:border-blue-500" />
            </label>
            <div className="rounded-xl bg-slate-800 px-4 py-3 text-sm space-y-1">
              <p className="flex justify-between"><span className="text-slate-400">Precio por {unidad}</span><span className="font-black text-white">{porKg !== null ? formatPlata(porKg) : '—'}</span></p>
              {g > 0 && <p className="flex justify-between"><span className="text-slate-400">Cada porción de {formatNumero(g, 0)} g</span><span className="font-black text-green-400">{porPorcion !== null ? formatPlata(porPorcion) : '—'}</span></p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAbierto(false)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
              <button type="button" disabled={porKg === null}
                onClick={() => { if (porKg !== null) { onCommit(Math.round(porKg * 100) / 100); setAbierto(false); setPrecioPieza(''); setPesoPieza(''); setPesoPorcion(''); } }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
                Usar {porKg !== null ? formatPlata(porKg) : 'este precio'} por {unidad}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
