"use client";

import React, { useState, useEffect } from 'react';
import { validarCantidad, detectarPosibleErrorDecimal, getCategoriaLimite } from './validaciones';
import ConfirmacionCantidad from './ConfirmacionCantidad';
import { ChevronLeft, CheckCircle2, Package, Trash2, Scale, ChevronRight, Flame } from 'lucide-react';
import { supabase } from '../../supabase';
import { ButcheryProduction } from '../../types';
import { getCut, formatWeight, formatGrams } from './cuts';
import { FinishStep2Overlay } from './Overlays';

export function Step2View({ production, totalInBatch, currentIndex, kindLabel, onFinish, onBack }: {
  production: ButcheryProduction;
  totalInBatch: number;
  currentIndex: number;
  kindLabel?: string;
  onFinish: (quantity: number, unit: 'unid' | 'kg', wasteKg: number, grasaKg: number, stockDestino: string, observacion?: string) => void;
  onBack: () => void;
}) {
  // getCut busca por type; si falla (fallback a lomo), intenta por typeName sin '_L'
  const cutByType = getCut(production.type);
  const cut = (cutByType.id === 'lomo' && production.type !== 'lomo')
    ? (getCut(
        production.typeName?.replace('_L','').toLowerCase().replace(' ','_') as any
       ) ?? cutByType)
    : cutByType;
  // Milanesa siempre se maneja por KG
  const defaultUnit: 'unid' | 'kg' = kindLabel === 'milanesa' ? 'kg' : cut.defaultUnit;
  const [unit, setUnit]             = useState<'unid' | 'kg'>(defaultUnit);
  const [quantity, setQuantity]     = useState('');
  const [pesoFinalKg, setPesoFinalKg] = useState('');
  const [wasteKg, setWasteKg]       = useState('');
  const [wasteMode, setWasteMode]   = useState<'por_unidad' | 'peso' | 'desperdicio'>('por_unidad');
  const [pesoporUnidadGr, setPesoporUnidadGr] = useState('');
  const [grasaKg, setGrasaKg]       = useState('');
  const [showGrasa, setShowGrasa]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validacionPendiente, setValidacionPendiente] = useState<{accion: () => void; titulo: string; mensaje: string; detalle: string; sugerencia: string | null} | null>(null);
  const [carnesLimpias, setCarnesLimpias] = useState<{producto: string; cantidad: number}[]>([]);
  const [selectedCarneLinpia, setSelectedCarneLinpia] = useState('');

  // Fetch SOLO el stock del corte seleccionado
  useEffect(() => {
    const fetchCarnesLimpias = async () => {
      const typeName = production.typeName;
      let query = supabase
        .from('stock_produccion')
        .select('producto, cantidad')
        .gt('cantidad', 0)
        .order('producto');

      if (kindLabel === 'burger') {
        query = query.ilike('producto', `Carne Limpia Burger - ${typeName}%`);
      } else {
        query = query.eq('producto', `${typeName} Limpia`);
      }

      const { data } = await query;
      setCarnesLimpias(data ?? []);
      if (data && data.length === 1) {
        setSelectedCarneLinpia(data[0].producto);
      }
    };
    fetchCarnesLimpias();
  }, [kindLabel, production.typeName]);

  const qty              = parseFloat(quantity.replace(',', '.'))          || 0;
  const pesoFinal        = parseFloat(pesoFinalKg.replace(',', '.'))       || 0;
  const pesoporUnidadKg  = (parseFloat(pesoporUnidadGr.replace(',', '.')) || 0) / 1000;

  const wasteAuto =
    unit === 'kg' && qty > 0
      ? Math.max(0, parseFloat((production.weightKg - qty).toFixed(3)))
      : unit === 'unid' && wasteMode === 'por_unidad' && qty > 0 && pesoporUnidadKg > 0
        ? Math.max(0, parseFloat((production.weightKg - qty * pesoporUnidadKg).toFixed(3)))
        : unit === 'unid' && wasteMode === 'peso' && pesoFinal > 0
          ? Math.max(0, parseFloat((production.weightKg - pesoFinal).toFixed(3)))
          : null;

  const waste =
    unit === 'unid' && wasteMode === 'desperdicio'
      ? (parseFloat(wasteKg.replace(',', '.')) || 0)
      : (wasteAuto !== null ? wasteAuto : 0);

  const grasa      = parseFloat(grasaKg.replace(',', '.')) || 0;
  const netWeight  = Math.max(0, production.weightKg - waste);
  const avgGrams   = unit === 'unid' && qty > 0 ? (netWeight / qty) * 1000 : 0;
  const grasaPct   = grasa > 0 ? ((grasa / production.weightKg) * 100).toFixed(1) : null;
  const canFinish  = qty > 0;
  const isLastInBatch = currentIndex === totalInBatch - 1;

  const handleUnitChange = (newUnit: 'unid' | 'kg') => {
    setUnit(newUnit);
    setQuantity('');
    setWasteKg('');
    setPesoFinalKg('');
    setPesoporUnidadGr('');
    setWasteMode('por_unidad');
  };

  const kindDisplay = kindLabel
    ? kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1).toLowerCase()
    : '';

  return (
    <div className="max-w-4xl mx-auto w-full">
      {validacionPendiente && (
        <ConfirmacionCantidad
          titulo={validacionPendiente.titulo}
          mensaje={validacionPendiente.mensaje}
          detalle={validacionPendiente.detalle}
          sugerencia={validacionPendiente.sugerencia}
          onConfirmar={validacionPendiente.accion}
          onCorregir={(val) => {
            if (val !== undefined) setQuantity(String(val));
            setValidacionPendiente(null);
          }}
        />
      )}
      {showConfirm && (
        <FinishStep2Overlay
          data={{ production, quantity: qty, unit, wasteKg: waste, grasaKg: grasa, stockDestino: cut.stockDestino }}
          onConfirm={(stock, obs) => { setShowConfirm(false); onFinish(qty, unit, waste, grasa, stock, obs); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Nav + progreso */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold text-lg px-2 py-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all">
          <ChevronLeft size={24} /> VOLVER
        </button>
        {totalInBatch > 1 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: totalInBatch }).map((_, i) => (
              <div key={i} className={`h-2.5 rounded-full transition-all ${
                i < currentIndex   ? 'w-6 bg-green-500' :
                i === currentIndex ? 'w-8 bg-rose-500'  : 'w-6 bg-slate-200'
              }`} />
            ))}
            <span className="ml-2 text-sm font-black text-slate-500">{currentIndex + 1} / {totalInBatch}</span>
          </div>
        )}
      </div>

      {/* TÍTULO */}
      <div className="text-center mb-8">
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-1">
          PASO 2 — {kindLabel ? kindLabel.toUpperCase() : 'Registrar producción'}
        </p>
        <h2 className="text-5xl font-black text-slate-900 mb-1">{production.typeName || cut.label}</h2>
        {kindLabel && (
          <p className="text-sm font-bold text-slate-400 mb-2">para {kindDisplay}</p>
        )}
        <div className="flex items-center justify-center gap-3 text-base flex-wrap mt-1">
          <span className="text-slate-500">Peso bruto:</span>
          <span className="font-black text-slate-700">{formatWeight(production.weightKg)} kg</span>
          <span className="text-slate-300">·</span>
          <span className="font-bold text-blue-600">{cut.stockDestino}</span>
        </div>
      </div>

      {/* Stock de carne limpia — SOLO el del corte elegido */}
      {carnesLimpias.length > 0 && (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 mb-4">
          <h4 className="font-black text-slate-700 mb-1 text-sm uppercase tracking-wide">
            🥩 Stock de carne limpia a usar
          </h4>
          <p className="text-xs text-slate-400 mb-3">Stock que se va a consumir en esta producción</p>
          <div className="space-y-2">
            {carnesLimpias.map(c => (
              <button key={c.producto}
                onClick={() => setSelectedCarneLinpia(c.producto)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm
                  ${selectedCarneLinpia === c.producto
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                <span>{c.producto}</span>
                <span className={`text-xs font-black ${selectedCarneLinpia === c.producto ? 'text-green-600' : 'text-slate-400'}`}>
                  {typeof c.cantidad === 'number' ? c.cantidad.toFixed(3) : c.cantidad} kg disp.
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INPUTS */}
        <div className="space-y-5">

          {/* CANTIDAD */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Package size={22} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg">Cantidad producida</h4>
                  <p className="text-xs text-slate-400">¿Cuánto salió?</p>
                </div>
              </div>
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button onClick={() => handleUnitChange('unid')} className={`px-4 py-2 rounded-lg font-black text-sm transition-all ${unit === 'unid' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>UNID</button>
                <button onClick={() => handleUnitChange('kg')}   className={`px-4 py-2 rounded-lg font-black text-sm transition-all ${unit === 'kg'   ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>KG</button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number" inputMode="decimal"
                step={unit === 'kg' ? '0.01' : '1'}
                placeholder={unit === 'kg' ? '0,00' : '0'}
                value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full p-5 text-5xl font-black text-center text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-blue-300 uppercase">{unit}</span>
            </div>
          </div>

          {/* DESPERDICIOS */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-slate-800 text-lg">Desperdicios</h4>
                <p className="text-xs text-slate-400">Grasa, packaging, hueso, etc.</p>
              </div>
            </div>

            {unit === 'kg' ? (
              <div className="relative">
                <div className="w-full p-5 text-5xl font-black text-center border-2 rounded-2xl bg-red-50 border-red-200 text-red-600 select-none">
                  {waste > 0 ? waste.toFixed(3).replace('.', ',') : <span className="text-red-300">—</span>}
                </div>
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-red-300">KG</span>
                {qty > 0 && (
                  <p className="text-xs text-slate-400 text-center mt-2">
                    Auto: {production.weightKg} − {qty} kg
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Toggle: por unidad / peso total / desperdicio directo */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => { setWasteMode('por_unidad'); setWasteKg(''); setPesoFinalKg(''); }}
                    className={`flex-1 py-2.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1
                      ${wasteMode === 'por_unidad' ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>
                    ⚖️ Por unidad
                  </button>
                  <button
                    onClick={() => { setWasteMode('peso'); setWasteKg(''); setPesoporUnidadGr(''); }}
                    className={`flex-1 py-2.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1
                      ${wasteMode === 'peso' ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>
                    📦 Peso total
                  </button>
                  <button
                    onClick={() => { setWasteMode('desperdicio'); setPesoFinalKg(''); setPesoporUnidadGr(''); }}
                    className={`flex-1 py-2.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1
                      ${wasteMode === 'desperdicio' ? 'bg-red-500 text-white shadow' : 'text-slate-500'}`}>
                    🗑️ Directo
                  </button>
                </div>

                {wasteMode === 'por_unidad' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-slate-400 uppercase">Peso por unidad (gr)</p>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="1" placeholder="0"
                        value={pesoporUnidadGr} onChange={e => setPesoporUnidadGr(e.target.value)}
                        className="w-full p-4 text-4xl font-black text-center border-2 rounded-2xl outline-none text-red-600 bg-red-50 border-red-200 focus:border-red-500 focus:bg-white transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-red-300">GR</span>
                    </div>
                    {qty > 0 && pesoporUnidadKg > 0 && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-center">
                        <p className="text-2xl font-black text-red-600">{waste.toFixed(3).replace('.', ',')} kg desperdicio</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {production.weightKg} kg − ({qty} × {pesoporUnidadGr} gr) = {waste.toFixed(3)} kg
                        </p>
                      </div>
                    )}
                    {qty > 0 && pesoporUnidadGr === '' && (
                      <p className="text-xs text-center text-slate-400">Ingresá el peso de cada pieza para calcular automáticamente</p>
                    )}
                  </div>
                ) : wasteMode === 'peso' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-slate-400 uppercase">Peso total que salió (kg)</p>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                        value={pesoFinalKg} onChange={e => setPesoFinalKg(e.target.value)}
                        className="w-full p-4 text-4xl font-black text-center border-2 rounded-2xl outline-none text-red-600 bg-red-50 border-red-200 focus:border-red-500 focus:bg-white transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-red-300">KG</span>
                    </div>
                    {pesoFinal > 0 && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-center">
                        <p className="text-2xl font-black text-red-600">{waste.toFixed(3).replace('.', ',')} kg desperdicio</p>
                        <p className="text-xs text-slate-400 mt-0.5">{production.weightKg} − {pesoFinal} = {waste.toFixed(3)} kg</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-slate-400 uppercase">Desperdicio (kg)</p>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                        value={wasteKg} onChange={e => setWasteKg(e.target.value)}
                        className="w-full p-4 text-4xl font-black text-center border-2 rounded-2xl outline-none text-red-600 bg-red-50 border-red-200 focus:border-red-500 focus:bg-white transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-red-300">KG</span>
                    </div>
                    {waste > 0 && (
                      <p className="text-xs text-center text-slate-400">
                        Neto: {(production.weightKg - waste).toFixed(3)} kg
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GRASA — solo burger */}
          {kindLabel === 'burger' && (!showGrasa ? (
            <button onClick={() => setShowGrasa(true)} className="w-full py-3 border-2 border-dashed border-orange-200 rounded-2xl text-orange-400 font-bold text-sm hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
              + Agregar grasa incorporada (opcional)
            </button>
          ) : (
            <div className="bg-white border-2 border-orange-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
                    <Flame size={22} className="text-orange-500" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-lg">Grasa incorporada</h4>
                    <p className="text-xs text-slate-400">Grasa agregada a la mezcla</p>
                  </div>
                </div>
                {grasaPct && <span className="bg-orange-100 text-orange-700 font-black text-lg px-3 py-1 rounded-full">{grasaPct}%</span>}
              </div>
              <div className="relative">
                <input
                  type="number" inputMode="decimal" step="0.01" placeholder="0,00"
                  value={grasaKg} onChange={e => setGrasaKg(e.target.value)}
                  className="w-full p-5 text-5xl font-black text-center text-orange-600 bg-orange-50 border-2 border-orange-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white transition-all"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl font-black text-orange-300">KG</span>
              </div>
              <button onClick={() => { setShowGrasa(false); setGrasaKg(''); }} className="w-full mt-3 py-2 text-slate-400 text-xs font-bold hover:text-red-400 transition-colors">
                quitar campo
              </button>
            </div>
          ))}
        </div>

        {/* RESUMEN */}
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-7 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Scale size={22} className="text-slate-600" />
            </div>
            <h4 className="font-black text-slate-800 text-lg">Resumen</h4>
          </div>
          <div className="space-y-3 flex-1">
            <SRow label="Peso bruto"  value={`${formatWeight(production.weightKg)} kg`} />
            <SRow label="Desperdicio" value={`- ${formatWeight(waste)} kg`} color="text-red-600" bg="bg-red-50" />
            {grasa > 0 && (
              <SRow label={`Grasa (${grasaPct}%)`} value={`+ ${formatWeight(grasa)} kg`} color="text-orange-600" bg="bg-orange-50" />
            )}
            <SRow label="Peso neto"   value={`${formatWeight(netWeight)} kg`} color="text-green-700 text-xl" bg="bg-green-50 border border-green-200" />
            <SRow label={unit === 'unid' ? 'Unidades' : 'Cantidad'} value={qty > 0 ? `${qty} ${unit}` : '—'} color="text-blue-700 text-xl" bg="bg-blue-50" />
            {unit === 'unid' && (
              <div className={`p-5 rounded-2xl border-2 text-center transition-all ${qty > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-black uppercase mb-1 ${qty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Prom / unidad</p>
                <span className={`text-4xl font-black ${qty > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                  {qty > 0 ? formatGrams(avgGrams) : '—'}
                </span>
                {qty > 0 && <span className="text-lg font-bold text-amber-500 ml-1">gr</span>}
              </div>
            )}
            <SRow label="Stock destino" value={cut.stockDestino} color="text-blue-700 text-sm" bg="bg-blue-50 border border-blue-200" />
            <p className="text-xs text-center text-slate-400">Podés cambiar el stock al confirmar</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={() => {
            const categoria = kindLabel === 'lomito' || kindLabel === 'burger' || kindLabel === 'milanesa' ? 'carne' : 'general';
            const val = validarCantidad(qty, categoria);
            const sugerencia = detectarPosibleErrorDecimal(qty);
            if (val.ok) {
              setShowConfirm(true);
            } else if (val.tipo === 'bloqueo') {
              alert('❌ ' + val.mensaje);
            } else {
              setValidacionPendiente({
                accion: () => { setValidacionPendiente(null); setShowConfirm(true); },
                titulo: 'Cantidad inusual',
                mensaje: val.mensaje,
                detalle: val.detalle,
                sugerencia,
              });
            }
          }}
          disabled={!canFinish}
          className={`w-full py-6 rounded-2xl font-black text-2xl transition-all flex items-center justify-center gap-3
            ${canFinish ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          <CheckCircle2 size={28} />
          {isLastInBatch ? 'CONFIRMAR PRODUCCIÓN' : 'CONFIRMAR Y SIGUIENTE'}
          {!isLastInBatch && <ChevronRight size={24} />}
        </button>
      </div>
    </div>
  );
}

function SRow({ label, value, color = 'text-slate-800', bg = 'bg-slate-50' }: {
  label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className={`flex justify-between items-center p-4 rounded-xl ${bg}`}>
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className={`font-black ${color}`}>{value}</span>
    </div>
  );
}