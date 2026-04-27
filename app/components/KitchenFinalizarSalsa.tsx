"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { clearCocinaProduccion } from './kitchenHelpers';

type Prod = {
  id: number;
  recipeName: string;
  recipeId: string;
  baseKg?: number;
  targetUnits: number;
  unit: string;
  startTime: number;
};

type Props = {
  prod: Prod;
  operador: string;
  onFinalizado: () => void;
  onCancelar: () => void;
};

async function addSalsaToStock(prodNombre: string, kg: number, operador: string) {
  const { data: pd } = await supabase.from('stock_produccion')
    .select('id, cantidad').ilike('producto', prodNombre).maybeSingle();
  if (pd) {
    await supabase.from('stock_produccion')
      .update({ cantidad: parseFloat((Number(pd.cantidad) + kg).toFixed(3)), ultima_prod: new Date().toISOString() })
      .eq('id', pd.id);
  } else {
    await supabase.from('stock_produccion')
      .insert({ producto: prodNombre, categoria: 'salsa', cantidad: kg, unidad: 'kg', ultima_prod: new Date().toISOString() });
  }
  await supabase.from('produccion_eventos').insert({
    tipo: 'fin_cocina', kind: 'salsa', corte: prodNombre,
    peso_kg: kg, operador,
    detalle: `${kg}kg producidos`,
    fecha: new Date().toISOString(),
  });
}

export default function KitchenFinalizarSalsa({ prod, operador, onFinalizado, onCancelar }: Props) {
  const [kgSalieron, setKgSalieron] = useState('');
  const [guardando, setGuardando]   = useState(false);
  const guardandoRef = useRef(false);

  const baseKg = prod.baseKg ?? prod.targetUnits;

  // Detección de error decimal
  const val = parseFloat(kgSalieron) || 0;
  const limSalsa = Math.max(baseKg * 1.5, 5);
  let sugerencia: number | null = null;
  if (val > limSalsa) {
    const div10 = val / 10;
    if (div10 > 0 && div10 <= limSalsa) { sugerencia = parseFloat(div10.toFixed(2)); }
    else {
      const str = String(Math.round(val));
      for (let i = 1; i < str.length; i++) {
        const c = parseFloat(str.slice(0, i) + '.' + str.slice(i));
        if (c > 0 && c <= limSalsa) { sugerencia = c; break; }
      }
    }
  }

  const handleGuardar = async () => {
    const kg = parseFloat(kgSalieron);
    if (!kg || kg <= 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    await addSalsaToStock(prod.recipeName, kg, operador);
    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);

    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `🫙 ${prod.recipeName} · ${operador}`,
        body: `${kg}kg producidos`,
        tag: 'salsa-fin', url: '/admin',
      }),
    });

    guardandoRef.current = false;
    setGuardando(false);
    onFinalizado();
  };

  return (
    <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 space-y-3">
      <p className="text-red-300 font-black text-sm uppercase">🫙 {prod.recipeName} — ¿Cuánto salió?</p>

      <div>
        <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg producidos</label>
        <input
          type="number" inputMode="decimal" step="0.1"
          value={kgSalieron} onChange={e => setKgSalieron(e.target.value)}
          placeholder="0.000"
          className="w-full bg-slate-800 border-2 border-red-500 text-white rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-red-400"
        />
        {sugerencia && (
          <div className="mt-1 bg-amber-900/40 border border-amber-500/40 rounded-xl px-3 py-2">
            <p className="text-xs text-amber-400 font-bold">⚠️ {val} kg parece mucho. ¿Quisiste decir {sugerencia} kg?</p>
            <button onClick={() => setKgSalieron(String(sugerencia))}
              className="mt-1.5 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg">
              Corregir a {sugerencia} kg
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">
          Cancelar
        </button>
        <button onClick={handleGuardar}
          disabled={!kgSalieron || parseFloat(kgSalieron) <= 0 || guardando}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
          {guardando ? 'Guardando...' : '✓ Confirmar'}
        </button>
      </div>
    </div>
  );
}