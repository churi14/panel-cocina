import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

// Cache en memoria — se popula una sola vez por sesión
let cached: string[] | null = null;
let pending: Promise<string[]> | null = null;

async function fetchOperadores(): Promise<string[]> {
  if (cached) return cached;
  if (!pending) {
    pending = Promise.resolve(
      supabase
        .from('operadores')
        .select('nombre')
        .eq('activo', true)
        .order('nombre')
    ).then(({ data }) => {
      const lista = (data ?? []).map((p: any) => p.nombre as string);
      // Operador de pruebas — siempre presente
      if (!lista.includes('JULIAN P PRUEBAS')) lista.push('JULIAN P PRUEBAS');
      cached = lista;
      return cached!;
    });
  }
  return pending;
}

/** Invalida el cache — llamar después de crear/editar usuarios */
export function invalidateOperadoresCache() {
  cached = null;
  pending = null;
}

/** Hook que devuelve la lista de operadores activos desde Supabase */
export function useOperadores(): string[] {
  const [operadores, setOperadores] = useState<string[]>(cached ?? []);

  useEffect(() => {
    fetchOperadores().then(setOperadores);
  }, []);

  return operadores;
}
