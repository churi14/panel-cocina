"use client";

export type Movement = {
  id: number;
  nombre: string;
  categoria: string;
  tipo: 'ingreso' | 'egreso';
  cantidad: number;
  unidad: string;
  motivo: string;
  operador: string;
  lote: string;
  fecha: string;
};

export type Notification = {
  id: number;
  message: string;
  type: 'ingreso' | 'egreso' | 'alert';
  time: string;
};

export const formatFecha = (f: string): string => {
  if (!f) return '—';
  const d = new Date(f);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};