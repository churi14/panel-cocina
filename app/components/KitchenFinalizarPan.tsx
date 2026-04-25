"use client";
import React, { useState, useRef } from 'react';
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

export default function KitchenFinalizarPan({ prod, operador, onFinalizado, onCancelar }: Props) {
  const [unidades, setUnidades] = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);

  const baseKg = prod.baseKg ?? prod.targetUnits;
  const unidadesNum = parseInt(unidades) || 0;
  const grPorUnidad = unidadesNum > 0 && baseKg > 0
    ? Math.round(baseKg * 1000 / unidadesNum)
    : null;

  const handleGuardar = async () => {
    if (!unidades || unidadesNum <= 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    // Actualizar stock_produccion
    const { data: existe } = await supabase.from('stock_produccion')
      .select('id, cantidad').eq('producto', prod.recipeName).maybeSingle();
    if (existe) {
      await supabase.from('stock_produccion')
        .update({ cantidad: existe.cantidad + unidadesNum, ultima_prod: new Date().toISOString() })
        .eq('id', existe.id);
    } else {
      await supabase.from('stock_produccion')
        .insert({ producto: prod.recipeName, categoria: 'pan', cantidad: unidadesNum, unidad: 'u', ultima_prod: new Date().toISOString() });
    }

    // Evento
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'pan', corte: prod.recipeName,
      peso_kg: baseKg, operador,
      detalle: `${unidadesNum}u producidas`,
      fecha: new Date().toISOString(),
    });

    // Push
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `🍞 ${prod.recipeName} · ${operador}`,
        body: `${unidadesNum} unidades producidas`,
        tag: 'pan-producido', url: '/admin',
      }),
    });

    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    guardandoRef.current = false;
    setGuardando(false);
    onFinalizado();
  };

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 space-y-3">
      <p className="text-amber-300 font-black text-sm uppercase">🍞 {prod.recipeName} — ¿Cuántas unidades salieron?</p>

      <div>
        <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Unidades producidas</label>
        <input
          type="number" inputMode="numeric" step="1"
          value={unidades} onChange={e => setUnidades(e.target.value)}
          placeholder="ej: 140"
          className="w-full bg-slate-800 border-2 border-amber-500 text-white rounded-xl px-4 py-3 text-2xl font-black text-center outline-none focus:border-amber-400"
        />
        {grPorUnidad && (
          <p className="text-xs text-green-400 font-black mt-1">
            → {grPorUnidad}g de harina por unidad · {baseKg}kg base
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">
          Cancelar
        </button>
        <button onClick={handleGuardar}
          disabled={!unidades || unidadesNum <= 0 || guardando}
          className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl text-sm disabled:opacity-40">
          {guardando ? 'Guardando...' : '✓ Confirmar'}
        </button>
      </div>
    </div>
  );
}