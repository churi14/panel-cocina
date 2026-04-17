"use client";
import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { ButcheryProduction } from '../../types';

type Destino = 'burger' | 'carne_limpia';

type Props = {
  production: ButcheryProduction;
  onFinish: (params: {
    carneLinpiaKg: number;
    grasaKg: number;
    desperdicioKg: number;
    destino: Destino;
  }) => void;
  onBack: () => void;
};

export default function LimpiezaView({ production, onFinish, onBack }: Props) {
  const [grasaKg, setGrasaKg]             = useState('');
  const [carneLinpiaKg, setCarneLinpiaKg] = useState('');
  const [destino, setDestino]             = useState<Destino | null>(null);

  const grasa       = parseFloat(grasaKg.replace(',', '.'))       || 0;
  const carne       = parseFloat(carneLinpiaKg.replace(',', '.')) || 0;
  const desperdicio = Math.max(0, parseFloat((production.weightKg - grasa - carne).toFixed(3)));
  const canFinish   = carne > 0 && destino !== null;

  const corteNorm = production.typeName;
  const productoDestino = destino === 'burger'
    ? `Carne Limpia Burger - ${corteNorm}`
    : `${corteNorm} Limpia`;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pb-10">
      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-base mb-6 mt-2 px-2 py-2 rounded-xl hover:bg-slate-100 transition-all">
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-black mb-2">
          🔪 LIMPIEZA — {corteNorm}
        </div>
        <p className="text-slate-500 text-sm">Peso bruto: <span className="font-black text-slate-800">{production.weightKg} kg</span></p>
      </div>

      <div className="space-y-4">

        {/* Grasa usable */}
        <div className="bg-white border-2 border-orange-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🫙</span>
            <div>
              <h4 className="font-black text-slate-800">Grasa usable</h4>
              <p className="text-xs text-slate-400">La que se puede reutilizar</p>
            </div>
          </div>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
              value={grasaKg} onChange={e => setGrasaKg(e.target.value)}
              className="w-full p-4 text-4xl font-black text-center border-2 border-orange-200 rounded-2xl outline-none text-orange-600 bg-orange-50 focus:border-orange-400 focus:bg-white transition-all" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-orange-300">KG</span>
          </div>
        </div>

        {/* Carne limpia */}
        <div className="bg-white border-2 border-green-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="font-black text-slate-800">Carne limpia</h4>
              <p className="text-xs text-slate-400">Lista para procesar</p>
            </div>
          </div>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0,00"
              value={carneLinpiaKg} onChange={e => setCarneLinpiaKg(e.target.value)}
              className="w-full p-4 text-4xl font-black text-center border-2 border-green-200 rounded-2xl outline-none text-green-700 bg-green-50 focus:border-green-400 focus:bg-white transition-all" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-green-300">KG</span>
          </div>
        </div>

        {/* Desperdicios auto */}
        <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗑️</span>
            <div>
              <p className="font-black text-slate-600 text-sm">Desperdicios</p>
              <p className="text-xs text-slate-400">Calculado automático</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-red-500">{desperdicio.toFixed(3).replace('.', ',')} kg</p>
            {(carne > 0 || grasa > 0) && (
              <p className="text-xs text-slate-400">{production.weightKg} − {grasa.toFixed(2)} − {carne.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Destino — solo 2 opciones */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5">
          <h4 className="font-black text-slate-700 mb-3">📍 ¿A dónde va esta carne limpia?</h4>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setDestino('burger')}
              className={`py-4 rounded-2xl font-black text-base transition-all flex flex-col items-center gap-1
                ${destino === 'burger' ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <span className="text-2xl">🍔</span>
              Burger
            </button>
            <button onClick={() => setDestino('carne_limpia')}
              className={`py-4 rounded-2xl font-black text-base transition-all flex flex-col items-center gap-1
                ${destino === 'carne_limpia' ? 'bg-green-600 text-white shadow-lg scale-[1.02]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <span className="text-2xl">🥩</span>
              Carne Limpia
            </button>
          </div>
          {destino && (
            <p className="text-xs text-center text-slate-400 mt-2">
              → Va a: <span className="font-black text-slate-700">{productoDestino}</span>
            </p>
          )}
        </div>

        {/* Resumen */}
        {canFinish && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Carne limpia</span>
              <span className="font-black text-green-700">+{carne.toFixed(3)} kg → {productoDestino}</span>
            </div>
            {grasa > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Grasa</span>
                <span className="font-black text-orange-600">+{grasa.toFixed(3)} kg → Grasa de Pella</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Desperdicio</span>
              <span className="font-black text-red-500">{desperdicio.toFixed(3)} kg</span>
            </div>
          </div>
        )}

        <button
          onClick={() => destino && onFinish({ carneLinpiaKg: carne, grasaKg: grasa, desperdicioKg: desperdicio, destino })}
          disabled={!canFinish}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3
            ${canFinish ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          <CheckCircle2 size={24} /> Confirmar limpieza
        </button>
      </div>
    </div>
  );
}