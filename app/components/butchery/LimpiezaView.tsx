"use client";
import React, { useState, useRef } from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { ButcheryProduction } from '../../types';
import HelpButton from '../HelpButton';

type Destino = 'carne_limpia';

type Props = {
  production: ButcheryProduction;
  onFinish: (params: {
    carneLinpiaKg: number;
    carneLinpia2?: { kg: number; producto: string };
    grasaKg: number;
    desperdicioKg: number;
    destino: Destino;
  }) => void;
  onBack: () => void;
};

export default function LimpiezaView({ production, onFinish, onBack }: Props) {
  const [grasaKg, setGrasaKg]             = useState('');
  const [carneLinpiaKg, setCarneLinpiaKg] = useState('');
  const [tapaKg, setTapaKg]               = useState('');
  const destino: Destino = 'carne_limpia';
  const [submitting, setSubmitting]       = useState(false);
  const submittingRef                     = useRef(false);

  const isNalgaConTapa = (production.type as string) === 'nalga_con_tapa';

  const grasa       = parseFloat(grasaKg.replace(',', '.'))       || 0;
  const carne       = parseFloat(carneLinpiaKg.replace(',', '.')) || 0;
  const tapa        = isNalgaConTapa ? (parseFloat(tapaKg.replace(',', '.')) || 0) : 0;
  const desperdicio = Math.max(0, parseFloat((production.weightKg - grasa - carne - tapa).toFixed(3)));
  const canFinish   = carne > 0 && (!isNalgaConTapa || tapa > 0);

  const corteNorm     = isNalgaConTapa ? 'Nalga' : (production.typeName ?? '').replace(/_L$/, '').trim();
  const productoDestino = `${corteNorm}_L`;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pb-10">
      <HelpButton
        titulo="Limpieza de carne"
        items={[
          {
            tipo: 'ok',
            pregunta: '¿Qué es "Grasa usable"?',
            respuesta: 'La grasa que sacaste de la carne y SE PUEDE REUTILIZAR (grasa de pella, para burger). Si no sacaste nada de grasa, dejalo en 0.',
          },
          {
            tipo: 'ok',
            pregunta: '¿Qué es "Carne neta limpia"?',
            respuesta: 'Lo que quedó de la carne YA LIMPIA, lista para usar (sin grasa, sin nervios, sin huesos). Es el número más importante — pesalo bien.',
          },
          {
            tipo: 'info',
            pregunta: '¿Y el desperdicio?',
            respuesta: 'NO lo calculás vos. El sistema lo calcula solo: Peso bruto − Grasa − Carne limpia = Desperdicio. Si pusiste bien los dos números de arriba, el desperdicio sale solo.',
          },
          {
            tipo: 'no',
            pregunta: '¿Tengo que elegir a dónde va la carne?',
            respuesta: 'NO. Siempre va a "Carne Limpia" automáticamente. Vos solo poné los kilos.',
          },
          {
            tipo: 'info',
            pregunta: 'Si me equivoco con la unidad (kg vs gramos)',
            respuesta: 'TODO ES EN KILOS. Si pesaste 2,500 gramos, eso es 2,5 kg — escribí "2,5", no "2500". El sistema te va a avisar si el número parece raro.',
          },
        ]}
      />
      <button onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-base mb-6 mt-2 px-2 py-2 rounded-xl hover:bg-slate-100 transition-all">
        <ArrowLeft size={18} /> Volver
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full text-sm font-black mb-2">
          🔪 LIMPIEZA — {isNalgaConTapa ? 'Nalga con Tapa' : corteNorm}
        </div>
        <p className="text-slate-500 text-sm">Peso bruto: <span className="font-black text-slate-800">{production.weightKg} kg</span></p>
        {isNalgaConTapa && (
          <p className="text-xs text-amber-600 font-bold mt-1">⚠️ Ingresá los pesos separados — Nalga y Tapa van a stocks distintos</p>
        )}
      </div>

      <div className="space-y-4">

        {/* Grasa usable */}
        <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🫙</span>
            <div>
              <p className="font-black text-slate-700">Grasa usable</p>
              <p className="text-xs text-slate-400">La que se puede reutilizar</p>
            </div>
          </div>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
              value={grasaKg} onChange={e => setGrasaKg(e.target.value)}
              className="w-full py-4 px-5 text-4xl font-black text-center text-amber-600 bg-white border-2 border-amber-200 rounded-2xl outline-none focus:border-amber-400" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-amber-300">KG</span>
          </div>
        </div>

        {/* Carne limpia (Nalga) */}
        <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <div>
              <p className="font-black text-slate-700">{isNalgaConTapa ? 'Nalga limpia' : 'Carne neta limpia'} <span className="text-red-500">*</span></p>
              <p className="text-xs text-slate-400">{isNalgaConTapa ? 'Solo el peso de la nalga sin la tapa' : 'Peso real de carne limpia pesada'}</p>
            </div>
          </div>
          <div className="relative">
            <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
              value={carneLinpiaKg} onChange={e => setCarneLinpiaKg(e.target.value)}
              className="w-full py-4 px-5 text-4xl font-black text-center text-blue-600 bg-white border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-blue-300">KG</span>
          </div>
          {carne > 0 && carne > production.weightKg * 1.05 && (() => {
            const sug = carne > 50 ? parseFloat((carne / 1000).toFixed(3))
              : carne > production.weightKg * 5 ? parseFloat((carne / 10).toFixed(3))
              : null;
            return (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-amber-700 font-bold">
                  ⚠️ {carne} kg parece más que el bruto ({production.weightKg} kg).
                  {sug ? ` ¿Quisiste decir ${sug} kg?` : ' ¿Es correcto?'}
                </p>
                {sug && (
                  <button onClick={() => setCarneLinpiaKg(String(sug))}
                    className="mt-1.5 w-full py-1.5 bg-blue-600 text-white text-sm font-black rounded-xl">
                    Corregir a {sug} kg
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Tapa de Nalga — solo cuando es nalga_con_tapa */}
        {isNalgaConTapa && (
          <div className="bg-green-50 border-2 border-green-300 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={20} className="text-green-700" />
              <div>
                <p className="font-black text-slate-700">Tapa de Nalga limpia <span className="text-red-500">*</span></p>
                <p className="text-xs text-slate-400">Se guarda en stock de Tapa de Nalga por separado</p>
              </div>
            </div>
            <div className="relative">
              <input type="number" inputMode="decimal" step="0.1" placeholder="0,000"
                value={tapaKg} onChange={e => setTapaKg(e.target.value)}
                className="w-full py-4 px-5 text-4xl font-black text-center text-green-700 bg-white border-2 border-green-300 rounded-2xl outline-none focus:border-green-500" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-green-400">KG</span>
            </div>
          </div>
        )}

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
            {(carne > 0 || grasa > 0 || tapa > 0) && (
              <p className="text-xs text-slate-400">
                {production.weightKg} − {grasa.toFixed(2)} − {carne.toFixed(2)}{isNalgaConTapa ? ` − ${tapa.toFixed(2)}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Destino */}
        <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🥩</span>
            <p className="font-black text-green-800 text-sm">Destino: stock de carne limpia</p>
          </div>
          {isNalgaConTapa ? (
            <div className="space-y-0.5 ml-8">
              <p className="text-xs text-green-600">→ <span className="font-bold">Nalga_L</span> {carne > 0 ? `(${carne.toFixed(3)} kg)` : ''}</p>
              <p className="text-xs text-green-600">→ <span className="font-bold">Tapa_Nalga_L</span> {tapa > 0 ? `(${tapa.toFixed(3)} kg)` : ''}</p>
            </div>
          ) : (
            <p className="text-xs text-green-600 ml-8">→ <span className="font-bold">{productoDestino}</span></p>
          )}
        </div>

        {/* Resumen */}
        {canFinish && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">{isNalgaConTapa ? 'Nalga limpia' : `${corteNorm} limpio`}</span>
              <span className="font-black text-green-700">+{carne.toFixed(3)} kg → {productoDestino}</span>
            </div>
            {isNalgaConTapa && tapa > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tapa de Nalga</span>
                <span className="font-black text-green-700">+{tapa.toFixed(3)} kg → Tapa_Nalga_L</span>
              </div>
            )}
            {grasa > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Grasa</span>
                <span className="font-black text-orange-600">+{grasa.toFixed(3)} kg → Grasa de Pella</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1">
              <span className="text-slate-500">Desperdicio</span>
              <span className="font-black text-red-500">{desperdicio.toFixed(3)} kg</span>
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            setSubmitting(true);
            await onFinish({
              carneLinpiaKg: carne,
              carneLinpia2: isNalgaConTapa && tapa > 0 ? { kg: tapa, producto: 'Tapa_Nalga_L' } : undefined,
              grasaKg: grasa,
              desperdicioKg: desperdicio,
              destino,
            });
          }}
          disabled={!canFinish || submitting}
          className={`w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3
            ${submitting
              ? 'bg-green-600 text-white cursor-not-allowed opacity-80'
              : canFinish
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
          {submitting ? (
            <>
              <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Guardando...
            </>
          ) : (
            <><CheckCircle2 size={24} /> Confirmar limpieza</>
          )}
        </button>
      </div>
    </div>
  );
}