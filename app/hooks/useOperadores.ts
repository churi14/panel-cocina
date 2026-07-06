import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

let cached: string[] | null = null;
let pending: Promise<string[]> | null = null;

async function fetchOperadores(): Promise<string[]> {
  if (cached) return cached;
  if (!pending) {
    pending = Promise.resolve(
      supabase.from('operadores').select('nombre').eq('activo', true).order('nombre')
    ).then(({ data }) => {
      const lista = (data ?? []).map((p: any) => p.nombre as string);
      if (!lista.includes('JULIAN P PRUEBAS')) lista.push('JULIAN P PRUEBAS');
      cached = lista;
      return cached!;
    });
  }
  return pending;
}

export function invalidateOperadoresCache() { cached = null; pending = null; }

export function useOperadores(): string[] {
  const [operadores, setOperadores] = useState<string[]>(cached ?? []);
  useEffect(() => { fetchOperadores().then(setOperadores); }, []);
  return operadores;
}
