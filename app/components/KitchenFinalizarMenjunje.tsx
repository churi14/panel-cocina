"use client";
import React, { useState, useRef } from 'react';
import { supabase } from '../supabase';
import { clearCocinaProduccion, deductStockForMilanesa } from './kitchenHelpers';

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
  menjunjeTipo: string; // 'Carne' | 'Pollo'
  onFinalizado: () => void;
  onCancelar: () => void;
};

function sugerirDecimal(valor: number, limite: number): number | null {
  if (valor <= limite) return null;
  const str = String(Math.round(valor));
  for (let i = 1; i < str.length; i++) {
    const c = parseFloat(str.slice(0, i) + '.' + str.slice(i));
    if (c > 0 && c <= limite) return c;
  }
  return null;
}

export default function KitchenFinalizarMenjunje({ prod, operador, menjunjeTipo, onFinalizado, onCancelar }: Props) {
  const baseKg = prod.baseKg ?? prod.targetUnits;
  const [carneKg, setCarneKg]         = useState(String(baseKg));
  const [menjunjeKgSalio, setMenjunjeKgSalio] = useState(String(baseKg));
  const [unidades, setUnidades]       = useState('');
  const [guardando, setGuardando]     = useState(false);
  const guardandoRef = useRef(false);

  const carneNum   = parseFloat(carneKg) || 0;
  const menjNum    = parseFloat(menjunjeKgSalio) || 0;
  const unidadesNum = parseInt(unidades) || 0;
  const grPorU = unidadesNum > 0 && menjNum > 0 ? Math.round(menjNum / unidadesNum * 1000) : null;

  const sugCarne = sugerirDecimal(carneNum, 50);
  const sugSalio = menjNum > carneNum * 1.1 ? sugerirDecimal(menjNum, carneNum * 1.1) : null;

  const handleGuardar = async () => {
    if (!carneKg || carneNum <= 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    // Descontar ingredientes del menjunje
    const ingredientes = [
      { nombre: 'HUEVO',   cantidad: Math.ceil(carneNum * 4.2),               unidad: 'u'  },
      { nombre: 'AJO',     cantidad: parseFloat((carneNum * 0.0125).toFixed(3)), unidad: 'kg' },
      { nombre: 'LIMÓN',   cantidad: parseFloat((carneNum * 0.0175).toFixed(3)), unidad: 'u'  },
      { nombre: 'SAL',     cantidad: parseFloat((carneNum * 0.0195).toFixed(3)), unidad: 'kg' },
      { nombre: 'PEREJIL', cantidad: parseFloat((carneNum * 0.015).toFixed(3)),  unidad: 'kg' },
    ];
    await deductStockForMilanesa(menjunjeTipo, carneNum, ingredientes);

    // Registrar menjunje en stock_produccion
    const nombreMenjunje = `Menjunje Milanesa ${menjunjeTipo}`;
    if (menjNum > 0) {
      const { data: existe } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', nombreMenjunje).maybeSingle();
      if (existe) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(existe.cantidad) + menjNum).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', existe.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: nombreMenjunje, categoria: 'milanesa', cantidad: menjNum, unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }

    // Evento
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'milanesa', corte: nombreMenjunje,
      peso_kg: menjNum, waste_kg: parseFloat((carneNum - menjNum).toFixed(3)),
      operador,
      detalle: `${carneNum}kg carne → ${menjNum}kg menjunje${unidadesNum ? ` · ${unidadesNum}u` : ''}`,
      fecha: new Date().toISOString(),
    });

    // Push
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `✅ Menjunje ${menjunjeTipo} · ${operador}`,
        body: `${menjNum}kg menjunje de ${carneNum}kg carne${unidadesNum ? ` · ${unidadesNum}u` : ''}`,
        tag: 'menjunje-fin', url: '/admin',
      }),
    });

    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    guardandoRef.current = false;
    setGuardando(false);
    onFinalizado();
  };

  return (
    <div className="bg-rose-950/50 border border-rose-500/30 rounded-xl p-4 space-y-3">
      <p className="text-rose-300 font-black text-sm uppercase">🥩 Menjunje {menjunjeTipo} — ¿Cuánto salió?</p>
      <p className="text-xs text-slate-400">Va directo al stock de menjunje preparado.</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg de carne usados</label>
          <input type="number" value={carneKg} onChange={e => setCarneKg(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-rose-500" />
          {sugCarne && (
            <button onClick={() => setCarneKg(String(sugCarne))}
              className="mt-1 w-full text-xs text-blue-400 font-black bg-blue-900/30 rounded-lg py-1">
              ¿Quisiste decir {sugCarne} kg? → Corregir
            </button>
          )}
        </div>
        <div>
          <label className="text-xs text-amber-400 font-bold uppercase mb-1 block">⭐ Kg menjunje que salió</label>
          <input type="number" value={menjunjeKgSalio} onChange={e => setMenjunjeKgSalio(e.target.value)}
            className="w-full bg-slate-800 border-2 border-amber-500 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-amber-400" />
          {sugSalio && (
            <button onClick={() => setMenjunjeKgSalio(String(sugSalio))}
              className="mt-1 w-full text-xs text-blue-400 font-black bg-blue-900/30 rounded-lg py-1">
              ¿Quisiste decir {sugSalio} kg? → Corregir
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Unidades (opcional)</label>
        <input type="number" value={unidades} onChange={e => setUnidades(e.target.value)}
          placeholder="ej: 20"
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-xl font-black text-center outline-none focus:border-rose-500" />
        {grPorU && <p className="text-xs text-green-400 font-black mt-1">→ {grPorU}g por unidad</p>}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">
          Cancelar
        </button>
        <button onClick={handleGuardar}
          disabled={!carneKg || carneNum <= 0 || guardando}
          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
          {guardando ? 'Guardando...' : '✓ Confirmar'}
        </button>
      </div>
    </div>
  );
}