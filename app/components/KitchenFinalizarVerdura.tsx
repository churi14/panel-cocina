"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { clearCocinaProduccion, checkAndNotifyStock, VERDURA_STOCK_MAP, VERDURA_PROD_MAP } from './kitchenHelpers';

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

async function deductStockForVerdura(recipeId: string, brutoPesoKg: number, desperdicioKg: number) {
  const stockNombre = VERDURA_STOCK_MAP[recipeId];
  const prodNombre  = VERDURA_PROD_MAP[recipeId];
  if (!stockNombre || brutoPesoKg <= 0) return;
  const netoKg = Math.max(0, brutoPesoKg - desperdicioKg);
  try {
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = parseFloat((Number(data.cantidad) - brutoPesoKg).toFixed(3));
      await supabase.from('stock')
        .update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'verduras', tipo: 'egreso',
        cantidad: parseFloat(brutoPesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Producción ${prodNombre}`, operador: 'Cocina', fecha: new Date().toISOString(),
      });
      await supabase.from('produccion_eventos').insert({
        tipo: 'fin_cocina', kind: 'cocina', corte: prodNombre,
        peso_kg: brutoPesoKg, waste_kg: desperdicioKg,
        operador: 'Cocina',
        detalle: `Bruto: ${brutoPesoKg}kg | Desperdicio: ${desperdicioKg}kg | Neto: ${netoKg}kg`,
        fecha: new Date().toISOString(),
      });
    }
    if (netoKg > 0) {
      const { data: pd } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', prodNombre).maybeSingle();
      if (pd) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(pd.cantidad) + netoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', pd.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'verduras', cantidad: parseFloat(netoKg.toFixed(3)), unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) { console.error('Error deductStockForVerdura:', e); }
}

function sugerirDecimal(valor: number, limite: number): number | null {
  if (valor <= limite) return null;
  const str = String(Math.round(valor));
  for (let i = 1; i < str.length; i++) {
    const c = parseFloat(str.slice(0, i) + '.' + str.slice(i));
    if (c > 0 && c <= limite) return c;
  }
  return null;
}

export default function KitchenFinalizarVerdura({ prod, operador, onFinalizado, onCancelar }: Props) {
  const baseKg = prod.baseKg ?? prod.targetUnits;
  const [brutoKg, setBrutoKg]         = useState('');
  useEffect(() => { setBrutoKg(String(baseKg)); }, [baseKg]);
  const [desperdicioKg, setDesperdicioKg] = useState('0');
  const [guardando, setGuardando]     = useState(false);
  const [confirmData, setConfirmData] = useState<{ bruto: number; stockActual: number; nombre: string } | null>(null);
  const guardandoRef = useRef(false);

  const brutoNum = parseFloat(brutoKg) || 0;
  const despNum  = parseFloat(desperdicioKg) || 0;
  const netoNum  = Math.max(0, brutoNum - despNum);
  const sugBruto = (() => {
    if (brutoNum <= 20) return null;
    const div10 = brutoNum / 10;
    if (div10 > 0 && div10 <= 20) return parseFloat(div10.toFixed(2));
    return sugerirDecimal(brutoNum, 20);
  })();

  const stockNombre = VERDURA_STOCK_MAP[prod.recipeId] ?? '';
  const prodNombre  = VERDURA_PROD_MAP[prod.recipeId] ?? prod.recipeName;

  const ejecutarDescuento = async (bruto: number, desperdicio: number) => {
    await deductStockForVerdura(prod.recipeId, bruto, desperdicio);
    await clearCocinaProduccion(prod.id, prod.recipeName, baseKg, operador);
    guardandoRef.current = false;
    setGuardando(false);
    onFinalizado();
  };

  const handleGuardar = async () => {
    if (!brutoKg || brutoNum <= 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);

    // Validar contra stock actual
    if (stockNombre) {
      const { data: sc } = await supabase.from('stock')
        .select('cantidad').eq('nombre', stockNombre).maybeSingle();
      const stockActual = sc ? Number(sc.cantidad) : 0;
      if (brutoNum > Math.max(20, stockActual * 2) && stockActual > 0) {
        setConfirmData({ bruto: brutoNum, stockActual, nombre: stockNombre });
        guardandoRef.current = false;
        setGuardando(false);
        return;
      }
    }

    await ejecutarDescuento(brutoNum, despNum);
  };

  // Pantalla de confirmación para cantidades sospechosas
  if (confirmData) {
    const { bruto, stockActual, nombre } = confirmData;
    const sug = sugerirDecimal(bruto, stockActual * 1.5);
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-red-500">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-black text-red-600 mb-2">¿Estás seguro?</h2>
          <p className="text-slate-600 mb-1">Vas a descontar <span className="font-black text-red-600">{bruto} kg</span> de {nombre}</p>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <p className="text-sm text-slate-600">Stock disponible: <span className="font-black">{stockActual.toFixed(3)} kg</span></p>
            <p className="text-xs text-red-500 font-bold mt-1">
              Vas a descontar el {((bruto / stockActual) * 100).toFixed(0)}% del stock
            </p>
          </div>
          {sug && (
            <button onClick={() => { setBrutoKg(String(sug)); setConfirmData(null); }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl mb-2 text-sm">
              ✏️ Corregir a {sug} kg
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={() => setConfirmData(null)}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-2xl text-sm">
              Cancelar
            </button>
            <button onClick={() => { setConfirmData(null); ejecutarDescuento(bruto, despNum); }}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl text-sm">
              Confirmar igual
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-950/40 border border-green-500/30 rounded-xl p-4 space-y-3">
      <p className="text-green-300 font-black text-sm uppercase">🥦 {prodNombre}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">⭐ Kg bruto entrada</label>
          <input type="number" value={brutoKg} onChange={e => setBrutoKg(e.target.value)}
            className="w-full bg-slate-800 border-2 border-green-500 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-green-400" />
          {sugBruto && (
            <button onClick={() => setBrutoKg(String(sugBruto))}
              className="mt-1 w-full text-xs text-blue-400 font-black bg-blue-900/30 rounded-lg py-1">
              ¿Quisiste decir {sugBruto} kg? → Corregir
            </button>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Desperdicio / merma</label>
          <input type="number" value={desperdicioKg} onChange={e => setDesperdicioKg(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-lg font-black text-center outline-none focus:border-red-500" />
        </div>
      </div>

      {brutoNum > 0 && (
        <div className="bg-green-900/30 rounded-xl px-4 py-2.5 flex justify-between text-sm">
          <span className="text-slate-400">Neto a stock de producción:</span>
          <span className="font-black text-green-400">{netoNum.toFixed(3)} kg</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onCancelar}
          className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">
          Cancelar
        </button>
        <button onClick={handleGuardar}
          disabled={!brutoKg || brutoNum <= 0 || guardando}
          className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
          {guardando ? 'Guardando...' : '✓ Confirmar'}
        </button>
      </div>
    </div>
  );
}