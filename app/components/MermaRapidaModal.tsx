"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useOperadores } from '../hooks/useOperadores';

type StockItem = { id: number; nombre: string; categoria: string; cantidad: number; unidad: string };

const RAZONES = [
  { id: 'se_cayo',      label: 'Se cayó / accidente', emoji: '💥' },
  { id: 'consumo',      label: 'Consumo del staff',   emoji: '🍽️' },
  { id: 'descarte',     label: 'Descarte / cocción',  emoji: '🗑️' },
  { id: 'vencio',       label: 'Venció / descomposó', emoji: '🤢' },
  { id: 'otro',         label: 'Otro motivo',          emoji: '📝' },
];

export default function MermaRapidaModal({ onClose, operadorNombre }: { onClose: () => void; operadorNombre: string }) {
  const operadores = useOperadores();
  const [operador, setOperador] = useState(operadorNombre || '');
  const [step, setStep] = useState<'operador' | 'razon' | 'producto' | 'cantidad'>('operador');
  const [razon, setRazon] = useState<typeof RAZONES[0] | null>(null);
  const [search, setSearch] = useState('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockProd, setStockProd]   = useState<any[]>([]);
  const [producto, setProducto] = useState<{ nombre: string; unidad: string; fuente: 'stock' | 'stock_produccion' } | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('stock').select('id,nombre,categoria,cantidad,unidad').order('nombre'),
      supabase.from('stock_produccion').select('id,producto,categoria,cantidad,unidad').order('producto'),
    ]).then(([{ data: s }, { data: p }]) => {
      setStockItems((s ?? []) as StockItem[]);
      setStockProd((p ?? []).map((x: any) => ({ ...x, nombre: x.producto })));
    });
  }, []);

  useEffect(() => {
    if (step === 'producto' || step === 'cantidad') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step]);

  // Si ya tienen operador prefijado, saltar ese step
  useEffect(() => {
    if (operadorNombre) setStep('razon');
  }, []);

  const todosLosProductos = [
    ...stockItems.map(s => ({ nombre: s.nombre, unidad: s.unidad, fuente: 'stock' as const, cantidad: s.cantidad })),
    ...stockProd.map(s => ({ nombre: s.nombre, unidad: s.unidad, fuente: 'stock_produccion' as const, cantidad: s.cantidad })),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const filtrados = search.trim()
    ? todosLosProductos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
    : todosLosProductos;

  const handleGuardar = async () => {
    if (!producto || !razon || !cantidad || parseFloat(cantidad) <= 0) return;
    setSaving(true);
    const motivo = `merma — ${razon.label}${nota ? ' · ' + nota : ''}`;
    await supabase.from('stock_movements').insert({
      nombre:    producto.nombre,
      categoria: 'merma',
      tipo:      'egreso',
      cantidad:  parseFloat(cantidad),
      unidad:    producto.unidad,
      motivo,
      operador:  operador || 'Sistema',
      fecha:     new Date().toISOString(),
    });
    // Descontar del stock correspondiente
    if (producto.fuente === 'stock') {
      const item = stockItems.find(s => s.nombre === producto.nombre);
      if (item) {
        await supabase.from('stock').update({ cantidad: Math.max(0, item.cantidad - parseFloat(cantidad)) }).eq('id', item.id);
      }
    } else {
      const item = stockProd.find(s => s.nombre === producto.nombre);
      if (item) {
        await supabase.from('stock_produccion').update({ cantidad: Math.max(0, item.cantidad - parseFloat(cantidad)) }).eq('id', item.id);
      }
    }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1400);
  };

  if (done) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm mx-4">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-green-600" />
        </div>
        <p className="font-black text-slate-800 text-lg">Merma registrada</p>
        <p className="text-slate-500 text-sm mt-1">{cantidad} {producto?.unidad} de {producto?.nombre}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4"
      onClick={onClose}>
      <div className="bg-white w-full md:max-w-md max-h-[90vh] rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
              <Trash2 size={20} className="text-red-500" /> Registrar Merma
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {step === 'operador' ? 'Paso 1: ¿Quién registra?' :
               step === 'razon'   ? 'Paso 2: ¿Qué pasó?' :
               step === 'producto'? 'Paso 3: ¿Qué producto?' :
                                    'Paso 4: ¿Cuánto?'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>

        {/* Progreso */}
        <div className="flex gap-1 px-6 py-3">
          {(['operador','razon','producto','cantidad'] as const).map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
              step === s ? 'bg-red-500' :
              (['operador','razon','producto','cantidad'].indexOf(step) > i) ? 'bg-red-300' : 'bg-slate-200'
            }`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* STEP 1: Operador */}
          {step === 'operador' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {operadores.filter(o => o !== 'JULIAN P PRUEBAS').map(op => (
                  <button key={op} onClick={() => { setOperador(op); setStep('razon'); }}
                    className="py-4 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-2xl font-black text-slate-700 transition-all active:scale-95">
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Razón */}
          {step === 'razon' && (
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-500 mb-1">
                Registrando como: <span className="font-black text-slate-700">{operador}</span>
                <button onClick={() => setStep('operador')} className="ml-2 text-xs text-blue-500 hover:text-blue-700 font-bold underline">cambiar</button>
              </p>
              {RAZONES.map(r => (
                <button key={r.id} onClick={() => { setRazon(r); setStep('producto'); }}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 rounded-2xl transition-all active:scale-95 text-left">
                  <span className="text-2xl">{r.emoji}</span>
                  <span className="font-black text-slate-700">{r.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* STEP 3: Producto */}
          {step === 'producto' && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Razón: <span className="font-black text-slate-600">{razon?.emoji} {razon?.label}</span></p>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    ref={inputRef}
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 outline-none focus:border-red-400"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filtrados.slice(0, 40).map(p => (
                  <button key={`${p.fuente}-${p.nombre}`}
                    onClick={() => { setProducto({ nombre: p.nombre, unidad: p.unidad, fuente: p.fuente }); setStep('cantidad'); }}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-red-50 transition-colors text-left">
                    <div>
                      <p className="font-black text-slate-700 text-sm">{p.nombre}</p>
                      <p className="text-xs text-slate-400">{p.fuente === 'stock_produccion' ? '🍳 Producción' : '📦 Materias primas'}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-bold">{p.cantidad?.toFixed(1)} {p.unidad}</span>
                  </button>
                ))}
                {filtrados.length === 0 && (
                  <p className="text-center py-8 text-slate-400">Sin resultados para "{search}"</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Cantidad */}
          {step === 'cantidad' && (
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-2xl px-5 py-4">
                <p className="text-xs text-slate-500 uppercase font-black mb-1">Vas a registrar</p>
                <p className="font-black text-slate-800 text-lg">{producto?.nombre}</p>
                <p className="text-slate-400 text-sm">{razon?.emoji} {razon?.label} · {operador}</p>
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">
                  Cantidad ({producto?.unidad})
                </label>
                <input
                  ref={inputRef}
                  type="number" min="0" step="0.1"
                  value={cantidad} onChange={e => setCantidad(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-red-400 rounded-2xl px-5 py-4 text-3xl font-black text-slate-800 outline-none text-center"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase mb-2 block">Nota (opcional)</label>
                <input
                  value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Ej: se cayó la bandeja entera..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-red-400"
                />
              </div>
              <button onClick={handleGuardar} disabled={saving || !cantidad || parseFloat(cantidad) <= 0}
                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg shadow-lg shadow-red-200">
                {saving ? <><RefreshCw size={20} className="animate-spin" /> Guardando...</> : <><Trash2 size={20} /> Registrar merma</>}
              </button>
              <button onClick={() => setStep('producto')} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600">
                ← Cambiar producto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
