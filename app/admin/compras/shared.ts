"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabase';
import { norm } from '../../components/kitchenHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Compras / pedidos en viaje.
//  · un pedido tiene proveedor, fecha de llegada estimada y una lista de productos con kilos
//  · mientras viaja NO toca el stock: se ve aparte ("en viaje")
//  · al recibirlo se confirman los kilos reales y ahí sube el stock
// Se guarda en la tabla `compras` (sql/20261105_compras.sql); sin la tabla queda en el navegador.
// ─────────────────────────────────────────────────────────────────────────────

export type ItemCompra = {
  stock_id: number | null;
  nombre: string;
  cantidad: number;          // lo pedido
  unidad: string;            // kg | lt | u
  precio_kg?: number | null; // opcional: precio por unidad (kg / lt / u)
  recibido?: number | null;  // lo que llegó realmente
};
export type EstadoCompra = 'en_viaje' | 'recibido' | 'cancelado';
export type Compra = {
  id: number;
  proveedor: string;
  fecha_pedido: string;      // YYYY-MM-DD
  fecha_llegada: string;     // YYYY-MM-DD
  estado: EstadoCompra;
  items: ItemCompra[];
  notas?: string | null;
  recibido_at?: string | null;
};
export type NuevaCompra = Omit<Compra, 'id'>;

// ── Fechas (siempre día local) ──
export const hoyISO = () => new Date().toLocaleDateString('en-CA');
export const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA');
};
export const diasHasta = (iso: string) =>
  Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${hoyISO()}T12:00:00`).getTime()) / 86400000);
export const fmtFecha = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

const LS = 'compras_v1';
export type ModoCompras = 'cargando' | 'nube' | 'local';

const normalizar = (r: any): Compra => ({
  id: Number(r.id),
  proveedor: r.proveedor ?? '',
  fecha_pedido: String(r.fecha_pedido ?? '').slice(0, 10),
  fecha_llegada: String(r.fecha_llegada ?? '').slice(0, 10),
  estado: r.estado,
  items: Array.isArray(r.items) ? r.items : [],
  notas: r.notas ?? null,
  recibido_at: r.recibido_at ?? null,
});

export function useCompras() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [modo, setModo] = useState<ModoCompras>('cargando');

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('compras').select('*').order('fecha_llegada', { ascending: true });
    if (!error && data) { setCompras(data.map(normalizar)); setModo('nube'); return; }
    try { const raw = localStorage.getItem(LS); setCompras(raw ? JSON.parse(raw) : []); } catch { setCompras([]); }
    setModo('local');
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardarLocal = (lista: Compra[]) => {
    setCompras(lista);
    try { localStorage.setItem(LS, JSON.stringify(lista)); } catch { /* sin localStorage */ }
  };

  const crear = async (c: NuevaCompra): Promise<boolean> => {
    if (modo === 'nube') {
      const { error } = await supabase.from('compras').insert(c);
      if (error) { console.error('crear compra', error); return false; }
      await cargar(); return true;
    }
    guardarLocal([...compras, { ...c, id: Date.now() }]);
    return true;
  };

  const actualizar = async (id: number, patch: Partial<Compra>): Promise<boolean> => {
    if (modo === 'nube') {
      const { error } = await supabase.from('compras').update(patch).eq('id', id);
      if (error) { console.error('actualizar compra', error); return false; }
      await cargar(); return true;
    }
    guardarLocal(compras.map(c => c.id === id ? { ...c, ...patch } : c));
    return true;
  };

  return { compras, modo, crear, actualizar, recargar: cargar };
}

/** Lo que viene en camino, por producto (para mostrar "+80 kg en viaje" en Stock). */
export function useEnViaje() {
  const { compras } = useCompras();
  return useMemo(() => {
    const m = new Map<string, { cantidad: number; unidad: string; llega: string }>();
    compras.filter(c => c.estado === 'en_viaje').forEach(c => c.items.forEach(i => {
      const k = norm(i.nombre);
      const prev = m.get(k);
      m.set(k, {
        cantidad: (prev?.cantidad ?? 0) + i.cantidad,
        unidad: i.unidad,
        llega: !prev || c.fecha_llegada < prev.llega ? c.fecha_llegada : prev.llega,
      });
    }));
    return m;
  }, [compras]);
}
