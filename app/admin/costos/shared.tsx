"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import type { StockRow } from '../../components/kitchenHelpers';
import { parseNumero } from '../../components/stockNames';
import { formatNumero, formatCantidad } from '../format';
import type { Precios, RecetaFudoRow } from './engine';

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

/** Todo lo que necesitan las pantallas de costos, cargado una sola vez. */
export function useDatosCostos() {
  const p = usePrecios();
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

  return { ...p, stockRows, recetasFudo, cargado };
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

/** Cantidad legible: 1500 g → "1,5 kg", 250 g → "250 g". */
export function fmtQty(qty: number, unit: string): string {
  if (unit === 'g' || unit === 'gr') { const f = formatCantidad(qty / 1000, 'kg'); return `${f.num} ${f.unit}`; }
  if (unit === 'kg' || unit === 'lt') { const f = formatCantidad(qty, unit); return `${f.num} ${f.unit}`; }
  return `${formatNumero(qty, Number.isInteger(qty) ? 0 : 2)} ${unit}`;
}
