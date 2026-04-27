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
  empanadoTipo: 'carne' | 'pollo';
  onFinalizado: () => void;
  onCancelar: () => void;
};

type MenjunjeStock = { producto: string; cantidad: number };

function sugerirDecimal(valor: number, limite: number): number | null {
  if (valor <= limite) return null;
  const str = String(Math.round(valor));
  for (let i = 1; i < str.length; i++) {
    const c = parseFloat(str.slice(0, i) + '.' + str.slice(i));
    if (c > 0 && c <= limite) return c;
  }
  return null;
}

export default function KitchenFinalizarEmpanado({ prod, operador, empanadoTipo, onFinalizado, onCancelar }: Props) {
  const baseKg = prod.baseKg ?? prod.targetUnits;
  const [stocks, setStocks]           = useState<MenjunjeStock[]>([]);
  const [corteSelec, setCorteSelec]   = useState('');
  const [menjunjeKg, setMenjunjeKg]   = useState(String(baseKg));
  const [salieronKg, setSalieronKg]   = useState(String(baseKg));
  const [unidades, setUnidades]       = useState('');
  const [guardando, setGuardando]     = useState(false);
  const guardandoRef = useRef(false);

  const tipo = empanadoTipo === 'pollo' ? 'Pollo' : 'Carne';
  const menjNum  = parseFloat(menjunjeKg) || 0;
  const salioNum = parseFloat(salieronKg) || 0;
  const unidadesNum = parseInt(unidades) || 0;
  const grPorU = unidadesNum > 0 && salioNum > 0 ? Math.round(salioNum / unidadesNum * 1000) : null;
  const sugMenjunje = sugerirDecimal(menjNum, 50);
  const salioSospechoso = menjNum > 0 && salioNum > menjNum * 2;
  const sugSalio = salioSospechoso ? sugerirDecimal(salioNum, menjNum * 2) ?? (salioNum > 10 ? parseFloat((salioNum/10).toFixed(2)) : null) : null;

  // Cargar stocks de menjunje al montar
  useEffect(() => {
    const load = async () => {
      const nombres = ['Menjunje Milanesa Carne', 'Menjunje Milanesa Pollo'];
      const result: MenjunjeStock[] = [];
      for (const nombre of nombres) {
        const { data } = await supabase.from('stock_produccion')
          .select('producto, cantidad').eq('producto', nombre).maybeSingle();
        result.push({ producto: nombre, cantidad: data ? Number(data.cantidad) : 0 });
      }
      setStocks(result);
      // Pre-seleccionar el que corresponde al tipo
      const preselec = `Menjunje Milanesa ${tipo}`;
      setCorteSelec(preselec);
    };
    load();
  }, [tipo]);

  const handleGuardar = async () => {
    if (!menjunjeKg || menjNum <= 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    const menjNombre = corteSelec || `Menjunje Milanesa ${tipo}`;
    const prodNombre = `Milanesa de ${tipo} Empanada`;

    // Descontar menjunje
    const { data: menjData } = await supabase.from('stock_produccion')
      .select('id, cantidad').eq('producto', menjNombre).maybeSingle();
    if (menjData) {
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat((Number(menjData.cantidad) - menjNum).toFixed(3)) })
        .eq('id', menjData.id);
    }

    // Descontar pan rallado y huevo
    const panRalladoKg = parseFloat((menjNum * 0.15).toFixed(3));
    const huevos = Math.ceil(menjNum);
    for (const [nom, qty, u] of [['PAN RALLADO', panRalladoKg, 'kg'], ['HUEVO', huevos, 'u']] as [string, number, string][]) {
      const { data: sd } = await supabase.from('stock').select('id, cantidad').eq('nombre', nom).maybeSingle();
      if (sd) {
        await supabase.from('stock').update({
          cantidad: parseFloat((Number(sd.cantidad) - qty).toFixed(3)),
          fecha_actualizacion: new Date().toISOString().slice(0, 10),
        }).eq('id', sd.id);
        await supabase.from('stock_movements').insert({
          nombre: nom, categoria: 'SECOS', tipo: 'egreso',
          cantidad: qty, unidad: u,
          motivo: `Empanado ${tipo}`, operador, fecha: new Date().toISOString(),
        });
      }
    }

    // Agregar milanesa empanada al stock
    if (salioNum > 0) {
      const { data: epd } = await supabase.from('stock_produccion')
        .select('id, cantidad').ilike('producto', `${prodNombre}%`).maybeSingle();
      if (epd) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(epd.cantidad) + salioNum).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', epd.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'milanesa', cantidad: salioNum, unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }

    // Evento
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'milanesa', corte: prodNombre,
      peso_kg: salioNum, waste_kg: parseFloat((menjNum - salioNum).toFixed(3)),
      operador,
      detalle: `${menjNum}kg menjunje → ${salioNum}kg empanada${unidadesNum ? ` · ${unidadesNum}u` : ''}`,
      fecha: new Date().toISOString(),
    });

    // Push
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `✅ Empanado ${tipo} · ${operador}`,
        body: `${salioNum}kg empanada de ${menjNum}kg menjunje`,
        tag: 'empanado-fin', url: '/admin',
      }),
    });

    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    guardandoRef.current = false;
    setGuardando(false);
    onFinalizado();
  };

  return (
    <div className="bg-rose-950/50 border border-rose-500/30 rounded-xl p-4 space-y-3">
      <p className="text-rose-300 font-black text-sm uppercase">🥩 Empanado {tipo}</p>
      <p className="text-xs text-slate-400">Descuenta del stock de menjunje preparado.</p>

      {/* Selector de menjunje */}
      <div>
        <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">¿De qué menjunje empanaste?</label>
        <div className="space-y-1">
          {stocks.map(s => (
            <button key={s.producto} onClick={() => setCorteSelec(s.producto)}
              className={`w-full flex justify-between px-4 py-2.5 rounded-xl text-sm font-bold border transition-all
                ${corteSelec === s.producto
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-rose-400'}`}>
              <span>{s.producto.replace('Menjunje ', '')}</span>
              <span className="opacity-60 text-xs">{s.cantidad.toFixed(2)} kg disp.</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Kg menjunje usados</label>
          <input type="number" value={menjunjeKg} onChange={e => setMenjunjeKg(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-rose-500" />
          {sugMenjunje && (
            <button onClick={() => { setMenjunjeKg(String(sugMenjunje)); setSalieronKg(String(sugMenjunje)); }}
              className="mt-1 w-full text-xs text-blue-400 font-black bg-blue-900/30 rounded-lg py-1">
              ¿Quisiste decir {sugMenjunje} kg? → Corregir
            </button>
          )}
        </div>
        <div>
          <label className="text-xs text-amber-400 font-bold uppercase mb-1 block">⭐ Kg empanados salidos</label>
          <input type="number" value={salieronKg} onChange={e => setSalieronKg(e.target.value)}
            className="w-full bg-slate-800 border-2 border-amber-500 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-amber-400" />
          {salioSospechoso && (
            <div className="mt-1 bg-amber-900/40 border border-amber-500/40 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-400 font-bold">
                ⚠️ {salioNum} kg para {menjNum} kg de menjunje parece mucho.
                {sugSalio ? ` ¿Quisiste decir ${sugSalio} kg?` : ' ¿Es correcto?'}
              </p>
              {sugSalio && (
                <button onClick={() => setSalieronKg(String(sugSalio))}
                  className="mt-1.5 w-full py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg">
                  Corregir a {sugSalio} kg
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-amber-400 font-bold uppercase mb-1 block">📦 Unidades que salieron *</label>
        <input type="number" value={unidades} onChange={e => setUnidades(e.target.value)}
          placeholder="ej: 20"
          className="w-full bg-slate-700 border-2 border-amber-500 text-white rounded-xl px-3 py-3 text-2xl font-black text-center outline-none focus:border-amber-400" />
        {grPorU && <p className="text-xs text-green-400 font-black mt-1">→ {grPorU}g por unidad</p>}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">
          Cancelar
        </button>
        <button onClick={handleGuardar}
          disabled={!menjunjeKg || menjNum <= 0 || guardando}
          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
          {guardando ? 'Guardando...' : '✓ Confirmar'}
        </button>
      </div>
    </div>
  );
}