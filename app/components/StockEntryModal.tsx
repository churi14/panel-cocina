"use client";

import React, { useState, useEffect } from 'react';
import { X, Truck, Check, ChevronLeft, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

type StockItem = { id: number; nombre: string; categoria: string; cantidad: number; unidad: string; };

const CATEGORIES = [
  { id: 'CARNES',       label: 'Carnicería',   emoji: '🥩', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { id: 'SECOS',        label: 'Insumos/Secos', emoji: '🧂', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'VERDURA',      label: 'Verduras',     emoji: '🥗', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
  { id: 'FIAMBRE',      label: 'Fiambres',     emoji: '🧀', color: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
  { id: 'BEBIDAS',      label: 'Bebidas',      emoji: '🥤', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'LIMPIEZA',     label: 'Limpieza',     emoji: '🧴', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'BROLAS',       label: 'Brolas',       emoji: '🍫', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { id: 'DESCARTABLES', label: 'Descartables', emoji: '📦', color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
];

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];

// ─── Configuración de aderezos ────────────────────────────────────────────────
const ADEREZOS = ['KETCHUP', 'BARBACOA', 'MAYONESA', 'SAVORA'];

const ADEREZO_FORMATOS: Record<string, { label: string; kg: number }[]> = {
  MAYONESA: [
    { label: '237g',   kg: 0.237 },
    { label: '475g',   kg: 0.475 },
    { label: '950g',   kg: 0.950 },
    { label: '2.9 kg', kg: 2.900 },
  ],
  KETCHUP:  [
    { label: '237g',  kg: 0.237 },
    { label: '475g',  kg: 0.475 },
    { label: '950g',  kg: 0.950 },
    { label: '3 kg',  kg: 3.000 },
  ],
  BARBACOA: [
    { label: '237g',  kg: 0.237 },
    { label: '475g',  kg: 0.475 },
    { label: '950g',  kg: 0.950 },
    { label: '3 kg',  kg: 3.000 },
  ],
  SAVORA:   [
    { label: '237g',  kg: 0.237 },
    { label: '475g',  kg: 0.475 },
    { label: '950g',  kg: 0.950 },
    { label: '3 kg',  kg: 3.000 },
  ],
};



export default function StockEntryModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'cat' | 'product' | 'form' | 'operador'>('operador');
  const [operador, setOperador] = useState('');
  const [selectedCat, setSelectedCat] = useState<typeof CATEGORIES[0] | null>(null);
  const [products, setProducts] = useState<StockItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [cantidad, setCantidad] = useState('');
  // Estado para conteo de formatos de aderezos
  const [aderezoCounts, setAderezoCounts] = useState<Record<string, number>>({});        // peso real (va al stock)
  const [pesoFactura, setPesoFactura] = useState('');   // solo informativo
  const [comentario, setComentario] = useState('');     // diferencia / faltante
  const [unidad, setUnidad] = useState<'kg' | 'u' | 'lt'>('kg');
  const [lote, setLote] = useState('');
  const [hasVenc, setHasVenc] = useState(false);
  const [fechaVenc, setFechaVenc] = useState('');

  const fetchProducts = async (catId: string) => {
    setLoadingProducts(true);
    const { data } = await supabase
      .from('stock')
      .select('*')
      .eq('categoria', catId)
      .order('nombre');
    setProducts(data ?? []);
    setLoadingProducts(false);
  };

  const handleSelectCat = (cat: typeof CATEGORIES[0]) => {
    setSelectedCat(cat);
    setSearch('');
    fetchProducts(cat.id);
    setStep('product');
  };

  const handleSelectProduct = (product: StockItem) => {
    setSelectedProduct(product);
    setUnidad(product.unidad as 'kg' | 'u' | 'lt');
    setAderezoCounts({});
    setStep('form');
  };

  const handleConfirm = async () => {
    if (!selectedProduct) return;
    // Para aderezos, validar que hayan ingresado algo
    if (isAderezo && totalKgAderezo <= 0) return;
    if (!isAderezo && !cantidad) return;
    const cantidadFinal = isAderezo ? totalKgAderezo : parseFloat(cantidad.replace(',', '.'));
    setSaving(true);
    const newQty = selectedProduct.cantidad + cantidadFinal;
    const update: any = {
      cantidad: newQty,
      fecha_actualizacion: new Date().toISOString().slice(0, 10),
    };
    if (hasVenc && fechaVenc) update.fecha_vencimiento = fechaVenc;

    await supabase.from('stock').update(update).eq('id', selectedProduct.id);

    await supabase.from('stock_movements').insert({
      stock_id: selectedProduct.id,
      nombre: selectedProduct.nombre,
      categoria: selectedProduct.categoria,
      tipo: 'ingreso',
      cantidad: cantidadFinal,
      unidad,
      motivo: lote ? `Remito/Lote: ${lote}` : 'Ingreso de mercadería',
      lote,
      operador,
      peso_factura: pesoFactura ? parseFloat(pesoFactura.replace(',', '.')) : null,
      comentario: comentario || null,
      fecha: new Date().toISOString(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  // Aderezo helpers
  const isAderezo = selectedProduct ? ADEREZOS.includes(selectedProduct.nombre) : false;
  const formatos  = selectedProduct ? (ADEREZO_FORMATOS[selectedProduct.nombre] ?? []) : [];
  const totalKgAderezo = formatos.reduce((sum, f) => sum + f.kg * (aderezoCounts[f.label] ?? 0), 0);

  const filteredProducts = products.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const catConfig = selectedCat ?? CATEGORIES[0];

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
                <Truck className="text-blue-600" size={20} /> Cargar Stock / Facturas
              </h2>
              <p className="text-slate-400 text-xs">
                {step === 'cat' ? 'Elegí la categoría' :
                 step === 'product' ? `${catConfig.emoji} ${catConfig.label} — Elegí el producto` :
                 `${catConfig.emoji} ${selectedProduct?.nombre}`}
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
                    className="flex items-center justify-center gap-2 p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-95 font-black text-lg text-slate-700 hover:text-blue-700">
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
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
                />
              </div>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={28} className="text-slate-300 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <button key={product.id} onClick={() => handleSelectProduct(product)}
                      className="text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-95 group">
                      <p className="font-black text-slate-800 text-sm leading-tight mb-1 group-hover:text-blue-700">{product.nombre}</p>
                      <p className="text-xs text-slate-400 font-medium">
                        Stock actual: <span className="font-bold text-slate-600">
                          {product.cantidad > 0 ? `${product.unidad === 'kg' || product.unidad === 'lt' ? product.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') : product.cantidad} ${product.unidad}` : 'Sin stock'}
                        </span>
                      </p>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-3 text-center py-8 text-slate-400">No se encontraron productos</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: FORMULARIO */}
          {step === 'form' && selectedProduct && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Izquierda: cantidad */}
              <div className="space-y-6">
                {/* Stock actual */}
                <div className={`px-5 py-4 rounded-2xl border-2 ${selectedProduct.cantidad < 0 ? 'border-red-300 bg-red-50' : catConfig.color}`}>
                  <p className="text-xs font-black uppercase mb-1 opacity-70">Stock actual</p>
                  <p className={`text-3xl font-black ${selectedProduct.cantidad < 0 ? 'text-red-600' : ''}`}>
                    {selectedProduct.unidad === 'kg' || selectedProduct.unidad === 'lt'
                      ? selectedProduct.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                      : selectedProduct.cantidad} {selectedProduct.unidad}
                  </p>
                  {selectedProduct.cantidad < 0 && (
                    <p className="text-xs text-red-500 font-bold mt-1">
                      ⚠️ Stock negativo — pendiente de factura
                    </p>
                  )}
                </div>

                {/* Cobertura de stock negativo */}
                {selectedProduct.cantidad < 0 && cantidad && parseFloat(cantidad) > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4">
                    <p className="text-xs font-black uppercase mb-2 text-amber-700">📋 Esta factura cubre</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Stock negativo:</span>
                        <span className="font-black text-red-600">{selectedProduct.cantidad.toFixed(3).replace('.', ',')} {selectedProduct.unidad}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Factura ingresa:</span>
                        <span className="font-black text-green-600">+{parseFloat(cantidad).toFixed(3).replace('.', ',')} {selectedProduct.unidad}</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                        <span className="font-black text-slate-700">Stock final:</span>
                        <span className={`font-black ${(selectedProduct.cantidad + parseFloat(cantidad)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(selectedProduct.cantidad + parseFloat(cantidad)).toFixed(3).replace('.', ',')} {selectedProduct.unidad}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SELECTOR ESPECIAL PARA ADEREZOS */}
                {isAderezo && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase">¿Cuántas unidades de cada formato?</p>
                    {formatos.map(f => (
                      <div key={f.label} className="flex items-center gap-4 bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3">
                        <span className="font-black text-slate-700 w-20 shrink-0">{f.label}</span>
                        <span className="text-xs text-slate-400 flex-1">{f.kg} kg c/u</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAderezoCounts(prev => ({ ...prev, [f.label]: Math.max(0, (prev[f.label] ?? 0) - 1) }))}
                            className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-600 font-black text-lg transition-colors">−</button>
                          <span className="w-10 text-center font-black text-xl text-slate-800">{aderezoCounts[f.label] ?? 0}</span>
                          <button onClick={() => setAderezoCounts(prev => ({ ...prev, [f.label]: (prev[f.label] ?? 0) + 1 }))}
                            className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-green-100 text-slate-600 hover:text-green-600 font-black text-lg transition-colors">+</button>
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right font-bold">
                          {((aderezoCounts[f.label] ?? 0) * f.kg).toFixed(3).replace(/\.?0+$/, '')} kg
                        </span>
                      </div>
                    ))}

                    {/* Total */}
                    <div className={`px-5 py-4 rounded-2xl border-2 text-center transition-all ${totalKgAderezo > 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                      <p className="text-xs font-black uppercase text-slate-500 mb-1">Total a ingresar</p>
                      <p className={`text-4xl font-black ${totalKgAderezo > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                        {totalKgAderezo > 0 ? totalKgAderezo.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') : '0'} kg
                      </p>
                      {totalKgAderezo > 0 && (
                        <p className="text-xs text-slate-400 mt-1">
                          Stock final: {(selectedProduct.cantidad + totalKgAderezo).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')} kg
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Peso Factura - solo informativo, solo para kg */}
                {!isAderezo && (unidad === 'kg' || unidad === 'lt') && (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">
                      Peso según factura <span className="text-slate-300 font-normal normal-case">(informativo)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number" inputMode="decimal" step="0.01"
                        placeholder="0,00"
                        value={pesoFactura}
                        onChange={e => setPesoFactura(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-3xl font-black text-center text-slate-400 outline-none focus:border-slate-300 focus:bg-white transition-all"
                      />
                      <span className="absolute right-4 top-5 text-sm font-bold text-slate-300 uppercase">{unidad}</span>
                    </div>
                  </div>
                )}

                {/* Peso Real - OBLIGATORIO para kg/lt */}
                {!isAderezo && <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">
                    {(unidad === 'kg' || unidad === 'lt') ? (
                      <span className="flex items-center gap-2">
                        Peso real pesado ⚖️
                        <span className="text-red-500">*</span>
                      </span>
                    ) : 'Cantidad a agregar'}
                  </label>
                  <div className="relative">
                    <input
                      type="number" inputMode="decimal" step="0.01"
                      placeholder="0,00"
                      value={cantidad}
                      onChange={e => setCantidad(e.target.value)}
                      autoFocus
                      className={`w-full p-5 bg-slate-50 border-2 rounded-2xl text-5xl font-black text-center outline-none transition-all
                        ${cantidad ? 'border-blue-400 bg-white text-blue-600' : 'border-red-200 text-blue-600 focus:border-blue-400 focus:bg-white'}`}
                    />
                    <span className="absolute right-4 top-6 text-sm font-bold text-slate-300 uppercase">{unidad}</span>
                  </div>
                  {(unidad === 'kg' || unidad === 'lt') && !cantidad && (
                    <p className="text-red-500 text-xs font-bold mt-1">⚠️ Obligatorio — pesá antes de confirmar</p>
                  )}
                </div>}

                {/* Diferencia automática */}
                {!isAderezo && (unidad === 'kg' || unidad === 'lt') && pesoFactura && cantidad && (
                  <div className={`px-4 py-3 rounded-xl border-2 text-center ${
                    Math.abs(parseFloat(cantidad) - parseFloat(pesoFactura)) > 0.1
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-green-200 bg-green-50'
                  }`}>
                    <p className="text-xs font-black uppercase mb-1 text-slate-500">Diferencia</p>
                    <p className={`text-2xl font-black ${Math.abs(parseFloat(cantidad) - parseFloat(pesoFactura)) > 0.1 ? 'text-amber-600' : 'text-green-600'}`}>
                      {(parseFloat(cantidad) - parseFloat(pesoFactura)).toFixed(2)} {unidad}
                    </p>
                  </div>
                )}

                {/* Unidad */}
                {!isAderezo && <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-2">Unidad</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {(['kg', 'u', 'lt'] as const).map(u => (
                      <button key={u} onClick={() => setUnidad(u)}
                        className={`flex-1 py-3 rounded-lg text-sm font-black uppercase transition-all
                          ${unidad === u ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>}
              </div>

              {/* Derecha: trazabilidad */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5">
                <h3 className="font-black text-slate-700 text-xs uppercase tracking-wider">Trazabilidad</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lote / Remito</label>
                  <input
                    type="text"
                    value={lote}
                    onChange={e => setLote(e.target.value)}
                    placeholder="Ej: R-12345"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Comentario / Faltante</label>
                  <textarea
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="Ej: Faltaron 2kg en la entrega, se reclamó al proveedor..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors resize-none"
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-bold text-slate-700 text-sm">¿Tiene vencimiento?</label>
                    <button onClick={() => setHasVenc(!hasVenc)}
                      className={`w-12 h-6 rounded-full transition-all ${hasVenc ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${hasVenc ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {hasVenc && (
                    <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)}
                      className="w-full p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold text-sm outline-none" />
                  )}
                </div>

                {/* Preview nuevo stock */}
                {cantidad && parseFloat(cantidad) > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-black text-green-600 uppercase mb-1">Nuevo stock</p>
                    <p className="text-3xl font-black text-green-700">
                      {(selectedProduct.cantidad + parseFloat(cantidad.replace(',', '.'))).toFixed(2)} {unidad}
                    </p>
                  </div>
                )}
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
              disabled={(isAderezo ? totalKgAderezo <= 0 : !cantidad || parseFloat(cantidad) <= 0) || saving || saved}
              className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all min-w-36 justify-center
                ${saved ? 'bg-green-500 text-white' :
                  (isAderezo ? totalKgAderezo <= 0 : !cantidad || parseFloat(cantidad) <= 0) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                  'bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95'}`}
            >
              {saved ? <><Check size={18} /> GUARDADO</> :
               saving ? <><RefreshCw size={18} className="animate-spin" /> Guardando...</> :
               <><Check size={18} /> CONFIRMAR</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}