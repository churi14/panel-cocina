"use client";

import React, { useState, useEffect } from 'react';
import { X, PackageMinus, ChevronLeft, Search, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';
import { PushEvents, isStockBajo, isStockAgotado } from './pushEvents';

type StockItem = { id: number; nombre: string; categoria: string; cantidad: number; unidad: string; };

const CATEGORIES = [
  { id: 'CARNES',       label: 'Carnicería',    emoji: '🥩', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { id: 'SECOS',        label: 'Insumos/Secos', emoji: '🧂', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'VERDURA',      label: 'Verduras',      emoji: '🥗', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { id: 'FIAMBRE',      label: 'Fiambres',      emoji: '🧀', color: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
  { id: 'BEBIDAS',      label: 'Bebidas',       emoji: '🥤', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'LIMPIEZA',     label: 'Limpieza',      emoji: '🧴', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'BROLAS',       label: 'Brolas',        emoji: '🍫', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { id: 'DESCARTABLES', label: 'Descartables',  emoji: '📦', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
];

const MOTIVOS = [
  'Merma / Vencimiento',
  'Uso en producción',
  'Rotura / Accidente',
  'Consumo interno',
  'Error de carga',
  'Otro',
];

const OPERADORES = ['Eri', 'Mati', 'Javi', 'Otro'];

export default function StockExitModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'cat' | 'product' | 'form' | 'operador'>('operador');
  const [operador, setOperador] = useState('');
  const [selectedCat, setSelectedCat] = useState<typeof CATEGORIES[0] | null>(null);
  const [products, setProducts] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [search, setSearch] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = async (catId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('stock')
      .select('*')
      .eq('categoria', catId)
      .gt('cantidad', 0)   // solo los que tienen stock
      .order('nombre');
    setProducts(data ?? []);
    setLoading(false);
  };

  const handleSelectCat = (cat: typeof CATEGORIES[0]) => {
    setSelectedCat(cat);
    setSearch('');
    fetchProducts(cat.id);
    setStep('product');
  };

  const handleSelectProduct = (p: StockItem) => {
    setSelectedProduct(p);
    setCantidad('');
    setMotivo(MOTIVOS[0]);
    setError('');
    setStep('form');
  };

  const handleConfirm = async () => {
    if (!selectedProduct || !cantidad) return;
    const qty = parseFloat(cantidad.replace(',', '.'));
    if (qty <= 0) return;
    if (qty > selectedProduct.cantidad) {
      setError(`No podés descontar más de lo que hay (${selectedProduct.cantidad} ${selectedProduct.unidad})`);
      return;
    }
    setSaving(true);
    const newQty = Math.max(0, selectedProduct.cantidad - qty);

    // Push notifications de stock
    if (isStockAgotado(newQty)) {
      PushEvents.stockAgotado(selectedProduct.nombre);
    } else if (isStockBajo(newQty, selectedProduct.unidad)) {
      PushEvents.stockBajo(selectedProduct.nombre, newQty, selectedProduct.unidad);
    }

    await supabase.from('stock').update({
      cantidad: newQty,
      fecha_actualizacion: new Date().toISOString().slice(0, 10),
    }).eq('id', selectedProduct.id);

    await supabase.from('stock_movements').insert({
      stock_id: selectedProduct.id,
      nombre: selectedProduct.nombre,
      categoria: selectedProduct.categoria,
      tipo: 'egreso',
      cantidad: qty,
      unidad: selectedProduct.unidad,
      motivo,
      operador,
      fecha: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const filteredProducts = products.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const qty = parseFloat(cantidad.replace(',', '.'));
  const newStock = selectedProduct ? Math.max(0, selectedProduct.cantidad - (qty || 0)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'operador' && (
              <button onClick={() => { setStep(step === 'form' ? 'product' : step === 'product' ? 'cat' : 'operador'); setSelectedProduct(null); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ChevronLeft size={20} className="text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <PackageMinus className="text-orange-500" size={20} /> Uso Manual / Mermas
              </h2>
              <p className="text-slate-400 text-xs">
                {step === 'operador' ? '¿Quién está registrando?' :
                 step === 'cat' ? 'Elegí la categoría' :
                 step === 'product' ? `${selectedCat?.emoji} ${selectedCat?.label} — Elegí el producto` :
                 `${selectedCat?.emoji} ${selectedProduct?.nombre}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={22} className="text-slate-500" />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* PASO 0: OPERADOR */}
          {step === 'operador' && (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm text-center mb-6">Seleccioná tu nombre para registrar el movimiento</p>
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                {OPERADORES.map(op => (
                  <button key={op} onClick={() => { setOperador(op); setStep('cat'); }}
                    className="flex items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all active:scale-95 font-black text-lg text-slate-700 hover:text-orange-700">
                    👤 {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 1: CATEGORÍAS */}
          {step === 'cat' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => handleSelectCat(cat)}
                  className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all active:scale-95 hover:shadow-md ${cat.color}`}>
                  <span className="text-4xl mb-3">{cat.emoji}</span>
                  <span className="font-bold text-sm uppercase">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* PASO 2: PRODUCTOS */}
          {step === 'product' && (
            <div>
              <div className="relative mb-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" placeholder="Buscar producto..." value={search}
                  onChange={e => setSearch(e.target.value)} autoFocus
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-400 transition-colors"
                />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={28} className="text-slate-300 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <button key={product.id} onClick={() => handleSelectProduct(product)}
                      className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all active:scale-95 group">
                      <p className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-orange-700">{product.nombre}</p>
                      <p className="text-xs text-slate-400 font-medium">
                        Stock: <span className="font-bold text-slate-600">{product.cantidad} {product.unidad}</span>
                      </p>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-3 text-center py-8 text-slate-400">
                      No hay productos con stock en esta categoría
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: FORMULARIO */}
          {step === 'form' && selectedProduct && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Izquierda */}
              <div className="space-y-5">
                {/* Stock actual */}
                <div className="px-5 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50">
                  <p className="text-xs font-black uppercase text-slate-400 mb-1">Stock actual</p>
                  <p className="text-3xl font-black text-slate-800">
                    {selectedProduct.cantidad} {selectedProduct.unidad}
                  </p>
                </div>

                {/* Cantidad a descontar */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Cantidad a descontar</label>
                  <input
                    type="number" inputMode="decimal" step="0.01"
                    placeholder="0,00"
                    value={cantidad}
                    onChange={e => { setCantidad(e.target.value); setError(''); }}
                    autoFocus
                    className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-5xl font-black text-center text-orange-600 outline-none focus:border-orange-400 focus:bg-white transition-all"
                  />
                  <p className="text-xs text-center text-slate-400 mt-1">{selectedProduct.unidad}</p>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold">
                    <AlertTriangle size={16} /> {error}
                  </div>
                )}

                {/* Preview nuevo stock */}
                {cantidad && qty > 0 && qty <= selectedProduct.cantidad && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-black text-orange-600 uppercase mb-1">Stock resultante</p>
                    <p className="text-3xl font-black text-orange-700">
                      {newStock.toFixed(3).replace(/\.?0+$/, '')} {selectedProduct.unidad}
                    </p>
                  </div>
                )}
              </div>

              {/* Derecha: motivo */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="font-black text-slate-700 text-xs uppercase tracking-wider mb-4">Motivo del descuento</h3>
                <div className="space-y-2">
                  {MOTIVOS.map(m => (
                    <button key={m} onClick={() => setMotivo(m)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all
                        ${motivo === m
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {step === 'form' && (
          <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 shrink-0">
            <button onClick={() => { setStep('product'); setSelectedProduct(null); }}
              className="px-6 py-3 rounded-xl border-2 border-slate-300 font-bold text-slate-600 hover:bg-white transition-all">
              Atrás
            </button>
            <button
              onClick={handleConfirm}
              disabled={!cantidad || qty <= 0 || qty > (selectedProduct?.cantidad ?? 0) || saving || saved}
              className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all min-w-36 justify-center
                ${saved ? 'bg-green-500 text-white' :
                  !cantidad || qty <= 0 || qty > (selectedProduct?.cantidad ?? 0)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg active:scale-95'}`}
            >
              {saved ? <><Check size={18} /> GUARDADO</> :
               saving ? <><RefreshCw size={18} className="animate-spin" /> Guardando...</> :
               <><PackageMinus size={18} /> CONFIRMAR</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}