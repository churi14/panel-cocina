"use client";
import React, { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle,
  Trash2, RefreshCw, Camera, FileImage,
} from 'lucide-react';
import { supabase } from '../supabase';
import type { FacturaData, FacturaItem } from '../api/factura/route';

interface ItemEditable extends FacturaItem {
  _id: number;
  seleccionado: boolean;
  stock_id?: number | null;
}

interface Props {
  onClose: () => void;
  onConfirm: () => void; // para refrescar movimientos
  operador?: string;
}

export default function FacturaModal({ onClose, onConfirm, operador }: Props) {
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [imagen, setImagen]   = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [factura, setFactura] = useState<FacturaData | null>(null);
  const [items, setItems]     = useState<ItemEditable[]>([]);
  const [drag, setDrag]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef   = useRef<HTMLInputElement>(null);

  // ── Manejo de imagen ────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { setError('Debe ser una imagen (JPG, PNG, WEBP) o PDF'); return; }
    setImagen(file);
    setError('');
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Llamar a la API ──────────────────────────────────────────────────────────
  const analizar = async () => {
    if (!imagen) return;
    setLoading(true); setError('');
    try {
      const form = new FormData();
      form.append('imagen', imagen);
      const res = await fetch('/api/factura', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      setFactura(data as FacturaData);
      setItems((data.items ?? []).map((item: FacturaItem, i: number) => ({
        ...item,
        _id: i,
        seleccionado: true,
      })));
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // ── Editar item ──────────────────────────────────────────────────────────────
  const updateItem = (id: number, field: keyof ItemEditable, value: any) => {
    setItems(prev => prev.map(it => it._id === id ? { ...it, [field]: value } : it));
  };
  const removeItem = (id: number) => setItems(prev => prev.filter(it => it._id !== id));

  // ── Confirmar y cargar al stock ──────────────────────────────────────────────
  const confirmar = async () => {
    const seleccionados = items.filter(it => it.seleccionado);
    if (!seleccionados.length) return;
    setSaving(true); setError('');

    let ok = 0;
    const motivo = `Factura ${factura?.proveedor ?? 'proveedor'} · ${factura?.numero_factura ?? factura?.fecha ?? 'sin nro'}`;
    const op     = operador ?? `Factura · ${factura?.proveedor ?? 'proveedor'}`;

    for (const item of seleccionados) {
      try {
        // 1. Insertar movimiento
        await supabase.from('stock_movements').insert({
          nombre:    item.nombre,
          categoria: 'ingreso-proveedor',
          tipo:      'ingreso',
          cantidad:  item.cantidad,
          unidad:    item.unidad,
          motivo,
          operador:  op,
          fecha:     new Date().toISOString(),
        });

        // 2. Actualizar stock (busca por nombre, ilike)
        const { data: stockRow } = await supabase
          .from('stock')
          .select('id, cantidad')
          .ilike('nombre', item.nombre)
          .maybeSingle();

        if (stockRow) {
          await supabase.from('stock').update({
            cantidad:          parseFloat((Number(stockRow.cantidad) + item.cantidad).toFixed(3)),
            fecha_actualizacion: new Date().toISOString().slice(0, 10),
          }).eq('id', stockRow.id);
        }
        ok++;
      } catch (e: any) {
        console.error('[factura confirm]', item.nombre, e.message);
      }
    }

    setSavedCount(ok);
    setSaving(false);
    setStep('done');
    onConfirm();
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-white text-lg">📄 Cargar factura de proveedor</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {step === 'upload'  ? 'Subí la foto y la IA extrae los productos automáticamente'  : ''}
              {step === 'preview' ? `${factura?.proveedor ?? 'Proveedor'} · revisá los items antes de confirmar` : ''}
              {step === 'done'    ? `${savedCount} producto${savedCount !== 1 ? 's' : ''} cargado${savedCount !== 1 ? 's' : ''} al stock` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => !imagen && inputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl transition-all
                  ${imagen
                    ? 'border-green-500/50 bg-green-500/5 cursor-default'
                    : drag
                    ? 'border-blue-400 bg-blue-500/10 cursor-copy'
                    : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer'
                  }`}>

                <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

                {imagen && preview ? (
                  <div className="p-4 flex gap-4 items-center">
                    <img src={preview} alt="factura" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-400 text-sm truncate">{imagen.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{(imagen.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setImagen(null); setPreview(null); }}
                      className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-300">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="p-10 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                      <FileImage size={22} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-white text-sm">Arrastrá la foto acá</p>
                      <p className="text-slate-500 text-xs mt-0.5">o hacé click · JPG, PNG, WEBP, PDF</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón cámara para móvil */}
              <button
                onClick={() => camRef.current?.click()}
                className="w-full py-2.5 border border-slate-700 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <Camera size={16} /> Sacar foto con la cámara
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={analizar}
                disabled={!imagen || loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> Analizando con IA...</>
                  : '🔍 Analizar factura'}
              </button>
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {/* Info de la factura */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase font-bold mb-0.5">Proveedor</p>
                  <p className="text-white font-bold">{factura?.proveedor ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase font-bold mb-0.5">Fecha</p>
                  <p className="text-white font-bold">{factura?.fecha ?? '—'}</p>
                </div>
                {factura?.numero_factura && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs uppercase font-bold mb-0.5">Nro. factura</p>
                    <p className="text-white font-mono text-xs">{factura.numero_factura}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase">
                  {items.filter(i => i.seleccionado).length} de {items.length} items seleccionados
                </p>
                <button
                  onClick={() => { setImagen(null); setPreview(null); setStep('upload'); }}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                  <RefreshCw size={12} /> Volver a escanear
                </button>
              </div>

              {/* Tabla editable */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">✓</th>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-center w-20">Cantidad</th>
                      <th className="px-3 py-2 text-center w-16">Unidad</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map(item => (
                      <tr key={item._id} className={`transition-colors ${item.seleccionado ? '' : 'opacity-40'}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={item.seleccionado}
                            onChange={e => updateItem(item._id, 'seleccionado', e.target.checked)}
                            className="accent-blue-500 w-4 h-4 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={item.nombre}
                            onChange={e => updateItem(item._id, 'nombre', e.target.value)}
                            className="w-full bg-slate-800/60 border border-transparent hover:border-slate-600 focus:border-blue-500 rounded-lg px-2 py-1 text-white text-xs outline-none transition-colors" />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.001" min="0"
                            value={item.cantidad}
                            onChange={e => updateItem(item._id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800/60 border border-transparent hover:border-slate-600 focus:border-blue-500 rounded-lg px-2 py-1 text-white text-xs outline-none text-center transition-colors" />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.unidad}
                            onChange={e => updateItem(item._id, 'unidad', e.target.value)}
                            className="w-full bg-slate-800/60 border border-transparent hover:border-slate-600 focus:border-blue-500 rounded-lg px-2 py-1 text-white text-xs outline-none transition-colors">
                            <option value="kg">kg</option>
                            <option value="u">u</option>
                            <option value="lt">lt</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeItem(item._id)}
                            className="p-1 hover:bg-red-500/15 rounded-lg text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600 text-xs">Sin items detectados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                💡 Revisá los nombres — tienen que coincidir con los productos en stock para que se actualice la cantidad automáticamente.
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={confirmar}
                disabled={saving || items.filter(i => i.seleccionado).length === 0}
                className="w-full py-3.5 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                {saving
                  ? <><Loader2 size={18} className="animate-spin" /> Cargando al stock...</>
                  : `✅ Confirmar y cargar ${items.filter(i => i.seleccionado).length} productos al stock`}
              </button>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={30} className="text-green-400" />
              </div>
              <div>
                <h4 className="font-black text-white text-xl">¡Listo!</h4>
                <p className="text-slate-400 text-sm mt-1">
                  Se cargaron <span className="font-black text-green-400">{savedCount} productos</span> al stock como ingreso de {factura?.proveedor ?? 'proveedor'}.
                </p>
              </div>
              <button onClick={onClose}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
