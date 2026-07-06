"use client";
import React, { useState, useRef, useCallback } from 'react';
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle,
  Trash2, RefreshCw, Camera, FileImage, Search, ChevronDown,
} from 'lucide-react';
import { supabase } from '../supabase';
import type { FacturaData, FacturaItem } from '../api/factura/route';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface StockProduct { id: number; nombre: string; unidad: string; cantidad: number; categoria: string; }

interface ItemEditable extends FacturaItem {
  _id: number;
  seleccionado: boolean;
  stockMatch: StockProduct | null;   // producto del stock vinculado
  matchScore: number;                // 0-100
}

interface Props {
  onClose: () => void;
  onConfirm: () => void;
  operador?: string;
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────
const STOP_WORDS = new Set(['de','del','la','el','los','las','un','una','a','y','o','en','por','con','sin','al','lo','su','se']);

function normalize(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function matchScore(facturaName: string, stockName: string): number {
  const aWords = normalize(facturaName).split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const bWords = normalize(stockName).split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  if (!aWords.length || !bWords.length) return 0;
  let hits = 0;
  for (const wa of aWords) {
    if (bWords.some(wb => {
      if (wa === wb) return true;                          // exact match
      if (wa.length >= 4 && wb.length >= 4)               // substring solo si ambos ≥ 4 chars
        return wb.includes(wa) || wa.includes(wb);
      return false;
    })) hits++;
  }
  return Math.round((hits / Math.max(aWords.length, bWords.length)) * 100);
}

function bestMatch(item: FacturaItem, stock: StockProduct[]): { product: StockProduct | null; score: number } {
  let best: StockProduct | null = null;
  let bestScr = 0;
  for (const s of stock) {
    const sc = matchScore(item.nombre, s.nombre);
    if (sc > bestScr) { bestScr = sc; best = s; }
  }
  return { product: bestScr >= 40 ? best : null, score: bestScr };
}

// ── Config de categorías ──────────────────────────────────────────────────────
const CAT_CFG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  carne:     { emoji: '🥩', label: 'Carnes',       color: 'text-red-400',    bg: 'bg-red-500/20'    },
  verdura:   { emoji: '🥦', label: 'Verduras',      color: 'text-green-400',  bg: 'bg-green-500/20'  },
  verduras:  { emoji: '🥦', label: 'Verduras',      color: 'text-green-400',  bg: 'bg-green-500/20'  },
  lacteo:    { emoji: '🧀', label: 'Lácteos',       color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  lacteos:   { emoji: '🧀', label: 'Lácteos',       color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  fiambre:   { emoji: '🍖', label: 'Fiambres',      color: 'text-orange-400', bg: 'bg-orange-500/20' },
  fiambres:  { emoji: '🍖', label: 'Fiambres',      color: 'text-orange-400', bg: 'bg-orange-500/20' },
  pan:       { emoji: '🍞', label: 'Panadería',     color: 'text-amber-400',  bg: 'bg-amber-500/20'  },
  bebida:    { emoji: '🥤', label: 'Bebidas',       color: 'text-blue-400',   bg: 'bg-blue-500/20'   },
  bebidas:   { emoji: '🥤', label: 'Bebidas',       color: 'text-blue-400',   bg: 'bg-blue-500/20'   },
  salsa:     { emoji: '🫙', label: 'Salsas',        color: 'text-purple-400', bg: 'bg-purple-500/20' },
  salsas:    { emoji: '🫙', label: 'Salsas',        color: 'text-purple-400', bg: 'bg-purple-500/20' },
  limpieza:  { emoji: '🧹', label: 'Limpieza',      color: 'text-cyan-400',   bg: 'bg-cyan-500/20'   },
  descartable:{ emoji:'📦', label: 'Descartables',  color: 'text-slate-400',  bg: 'bg-slate-500/20'  },
  descartables:{ emoji:'📦',label: 'Descartables',  color: 'text-slate-400',  bg: 'bg-slate-500/20'  },
  condimento: { emoji: '🧂', label: 'Condimentos',  color: 'text-pink-400',   bg: 'bg-pink-500/20'   },
  condimentos:{ emoji: '🧂', label: 'Condimentos',  color: 'text-pink-400',   bg: 'bg-pink-500/20'   },
  aceite:    { emoji: '🫒', label: 'Aceites',       color: 'text-lime-400',   bg: 'bg-lime-500/20'   },
};
const DEFAULT_CAT = { emoji: '📋', label: 'Otros', color: 'text-slate-400', bg: 'bg-slate-500/20' };

// ── Stock Picker Popup ────────────────────────────────────────────────────────
function StockPickerPopup({ stock, current, onSelect, onClose }: {
  stock: StockProduct[];
  current: StockProduct | null;
  onSelect: (p: StockProduct | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const isSearching = q.trim().length > 0;

  const filtered = isSearching
    ? stock.filter(s => normalize(s.nombre).includes(normalize(q)) || normalize(s.categoria).includes(normalize(q)))
    : stock;

  // Agrupar por categoría
  const grouped: Record<string, StockProduct[]> = {};
  for (const s of filtered) {
    const cat = s.categoria ?? 'otros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }
  const cats = Object.keys(grouped).sort();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <p className="font-black text-white text-base">Vincular a stock</p>
            <p className="text-slate-500 text-xs mt-0.5">Buscá o elegí por categoría</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nombre o categoría..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600" />
            {q && (
              <button onClick={() => setQ('')} className="text-slate-600 hover:text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {/* No vincular */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => { onSelect(null); onClose(); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors flex items-center gap-3 border
                ${!current
                  ? 'border-slate-600 bg-slate-800 text-white'
                  : 'border-slate-800 hover:bg-slate-800/60 text-slate-400 hover:text-white'}`}>
              <span className="text-xl">🚫</span>
              <div>
                <p className="font-black text-sm">No vincular</p>
                <p className="text-xs text-slate-500 font-normal">Se guarda el movimiento pero no actualiza stock</p>
              </div>
            </button>
          </div>

          {/* Por categorías o búsqueda plana */}
          {cats.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-10">Sin resultados para "{q}"</p>
          ) : (
            <div className="px-3 pb-3 space-y-3 mt-2">
              {cats.map(cat => {
                const cfg = CAT_CFG[cat.toLowerCase()] ?? DEFAULT_CAT;
                return (
                  <div key={cat}>
                    {/* Header categoría */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-1 ${cfg.bg}`}>
                      <span className="text-base">{cfg.emoji}</span>
                      <span className={`text-xs font-black uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                      <span className="ml-auto text-xs text-slate-600">{grouped[cat].length}</span>
                    </div>
                    {/* Productos de la categoría */}
                    <div className="space-y-0.5">
                      {grouped[cat].map(s => (
                        <button key={s.id}
                          onClick={() => { onSelect(s); onClose(); }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between gap-3
                            ${current?.id === s.id
                              ? 'bg-blue-600/25 text-blue-300 font-black'
                              : 'hover:bg-slate-800 text-white font-bold'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {current?.id === s.id && <span className="text-blue-400 shrink-0">✓</span>}
                            <span className="truncate">{s.nombre}</span>
                          </div>
                          <span className={`text-xs shrink-0 font-normal ${Number(s.cantidad) > 0 ? 'text-slate-400' : 'text-red-400'}`}>
                            {Number(s.cantidad).toFixed(2)} {s.unidad}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tipos historial ───────────────────────────────────────────────────────────
interface FacturaHistorial {
  id: number;
  proveedor: string | null;
  numero_factura: string | null;
  fecha_factura: string | null;
  fecha_carga: string;
  operador: string | null;
  items: FacturaItem[];
  total_items: number;
  imagen_nombre: string | null;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FacturaModal({ onClose, onConfirm, operador }: Props) {
  const [tab, setTab]         = useState<'cargar' | 'historial'>('cargar');
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [imagen, setImagen]   = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [factura, setFactura] = useState<FacturaData | null>(null);
  const [items, setItems]     = useState<ItemEditable[]>([]);
  const [stockAll, setStockAll] = useState<StockProduct[]>([]);
  const [drag, setDrag]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [historial, setHistorial] = useState<FacturaHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef   = useRef<HTMLInputElement>(null);

  const fetchHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    const { data } = await supabase
      .from('facturas_historial')
      .select('*')
      .order('fecha_carga', { ascending: false })
      .limit(50);
    setHistorial((data ?? []) as FacturaHistorial[]);
    setLoadingHistorial(false);
  }, []);

  // ── Manejo de archivo ────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Debe ser una imagen (JPG, PNG, WEBP) o PDF'); return;
    }
    setImagen(file); setError('');
    setPreview(file.type === 'application/pdf' ? null : URL.createObjectURL(file));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  // ── Analizar factura ─────────────────────────────────────────────────────────
  const analizar = async () => {
    if (!imagen) return;
    setLoading(true); setError('');
    try {
      // 1. Llamar a la API de análisis
      const form = new FormData();
      form.append('imagen', imagen);
      const res  = await fetch('/api/factura', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      // 2. Traer todo el stock
      const { data: stockData } = await supabase
        .from('stock')
        .select('id, nombre, unidad, cantidad, categoria')
        .order('categoria').order('nombre');
      const stock: StockProduct[] = (stockData ?? []).map((r: any) => ({
        id: r.id, nombre: r.nombre, unidad: r.unidad, cantidad: Number(r.cantidad), categoria: r.categoria ?? 'otros',
      }));
      setStockAll(stock);

      // 3. Auto-matchear items — usa nombre_limpio para matching si existe
      setFactura(data as FacturaData);
      setItems((data.items ?? []).map((item: FacturaItem, i: number) => {
        const itemParaMatch = { ...item, nombre: item.nombre_limpio || item.nombre };
        const { product, score } = bestMatch(itemParaMatch, stock);
        return { ...item, _id: i, seleccionado: true, stockMatch: product, matchScore: score };
      }));
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // ── Editar item ──────────────────────────────────────────────────────────────
  const updateItem = (id: number, field: keyof ItemEditable, value: any) =>
    setItems(prev => prev.map(it => it._id === id ? { ...it, [field]: value } : it));

  const removeItem = (id: number) => setItems(prev => prev.filter(it => it._id !== id));

  const setMatch = (itemId: number, product: StockProduct | null) =>
    setItems(prev => prev.map(it => it._id === itemId
      ? { ...it, stockMatch: product, matchScore: product ? 100 : 0 }
      : it));

  // ── Confirmar ────────────────────────────────────────────────────────────────
  const confirmar = async () => {
    const seleccionados = items.filter(it => it.seleccionado);
    if (!seleccionados.length) return;
    setSaving(true); setError('');

    let ok = 0;
    const motivo = `Factura ${factura?.proveedor ?? 'proveedor'} · ${factura?.numero_factura ?? factura?.fecha ?? 'sin nro'}`;
    const op     = operador ?? `Factura · ${factura?.proveedor ?? 'proveedor'}`;

    for (const item of seleccionados) {
      try {
        await supabase.from('stock_movements').insert({
          nombre:    item.stockMatch?.nombre ?? item.nombre,
          categoria: 'ingreso-proveedor',
          tipo:      'ingreso',
          cantidad:  item.cantidad,
          unidad:    item.unidad,
          motivo,
          operador:  op,
          fecha:     new Date().toISOString(),
        });

        if (item.stockMatch) {
          const s = item.stockMatch;
          await supabase.from('stock').update({
            cantidad: parseFloat((Number(s.cantidad) + item.cantidad).toFixed(3)),
            fecha_actualizacion: new Date().toISOString().slice(0, 10),
          }).eq('id', s.id);
        }
        ok++;
      } catch (e: any) {
        console.error('[factura confirm]', item.nombre, e.message);
      }
    }

    // Guardar en historial
    try {
      await supabase.from('facturas_historial').insert({
        proveedor:      factura?.proveedor ?? null,
        numero_factura: factura?.numero_factura ?? null,
        fecha_factura:  factura?.fecha ?? null,
        operador:       op,
        items:          seleccionados.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, unidad: i.unidad, stockMatch: i.stockMatch?.nombre ?? null })),
        total_items:    seleccionados.length,
        imagen_nombre:  imagen?.name ?? null,
      });
    } catch (e) { console.error('[factura historial]', e); }

    setSavedCount(ok);
    setSaving(false);
    setStep('done');
    onConfirm();
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  const itemForPicker = pickerFor !== null ? items.find(i => i._id === pickerFor) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Stock picker popup */}
        {pickerFor !== null && itemForPicker && (
          <StockPickerPopup
            stock={stockAll}
            current={itemForPicker.stockMatch}
            onSelect={p => setMatch(pickerFor, p)}
            onClose={() => setPickerFor(null)}
          />
        )}

        {/* Header */}
        <div className="px-6 pt-4 pb-0 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-black text-white text-lg">📄 Facturas de proveedor</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {tab === 'historial' && 'Facturas cargadas anteriormente'}
                {tab === 'cargar' && step === 'upload'  && 'Subí la foto y la IA extrae los productos'}
                {tab === 'cargar' && step === 'preview' && `${factura?.proveedor ?? 'Proveedor'} · revisá antes de confirmar`}
                {tab === 'cargar' && step === 'done'    && `${savedCount} producto${savedCount !== 1 ? 's' : ''} cargados al stock`}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400">
              <X size={18} />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setTab('cargar')}
              className={`px-4 py-2 text-sm font-black rounded-t-xl border-b-2 transition-colors
                ${tab === 'cargar' ? 'text-blue-400 border-blue-500 bg-blue-500/5' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              📄 Cargar
            </button>
            <button
              onClick={() => { setTab('historial'); fetchHistorial(); }}
              className={`px-4 py-2 text-sm font-black rounded-t-xl border-b-2 transition-colors
                ${tab === 'historial' ? 'text-blue-400 border-blue-500 bg-blue-500/5' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              📋 Historial
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── TAB: historial ── */}
          {tab === 'historial' && (
            <div className="p-5">
              {loadingHistorial ? (
                <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
                  <Loader2 size={18} className="animate-spin" /> Cargando historial...
                </div>
              ) : historial.length === 0 ? (
                <div className="text-center py-16 text-slate-600">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="font-bold">Sin facturas cargadas aún</p>
                  <p className="text-xs mt-1">Las facturas confirmadas aparecen acá</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historial.map(f => (
                    <div key={f.id} className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800 transition-colors">
                        <div className="text-left min-w-0">
                          <p className="font-black text-white text-sm truncate">{f.proveedor ?? 'Sin proveedor'}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {f.numero_factura && <span className="font-mono mr-2">{f.numero_factura}</span>}
                            {f.fecha_factura && <span>{f.fecha_factura} · </span>}
                            <span>{f.total_items} producto{f.total_items !== 1 ? 's' : ''}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-500">
                            {new Date(f.fecha_carga).toLocaleDateString('es-AR')}
                          </p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{f.operador}</p>
                        </div>
                      </button>
                      {expandedId === f.id && (
                        <div className="border-t border-slate-700 px-4 py-3 space-y-1.5">
                          {(f.items ?? []).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs gap-2">
                              <span className="text-slate-300 truncate">{item.nombre}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-slate-400 font-mono">{item.cantidad} {item.unidad}</span>
                                {item.stockMatch
                                  ? <span className="text-green-400 font-black">→ {item.stockMatch}</span>
                                  : <span className="text-red-400">sin vincular</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: cargar ── */}
          {tab === 'cargar' && <>

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => !imagen && inputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl transition-all
                  ${imagen ? 'border-green-500/50 bg-green-500/5 cursor-default'
                  : drag   ? 'border-blue-400 bg-blue-500/10 cursor-copy'
                           : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer'}`}>
                <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                {imagen ? (
                  <div className="p-4 flex gap-4 items-center">
                    {preview
                      ? <img src={preview} alt="factura" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
                      : <div className="w-24 h-24 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center text-3xl">📄</div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-400 text-sm truncate">{imagen.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{(imagen.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setImagen(null); setPreview(null); }}
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

              <button onClick={() => camRef.current?.click()}
                className="w-full py-2.5 border border-slate-700 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <Camera size={16} /> Sacar foto con la cámara
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button onClick={analizar} disabled={!imagen || loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={18} className="animate-spin" /> Analizando con IA...</> : '🔍 Analizar factura'}
              </button>
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && (
            <div className="p-5 space-y-4">
              {/* Info factura */}
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

              {/* Leyenda de estado */}
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Vinculado</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Parcial</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Sin match — tocá para vincular</span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-400 uppercase">
                  {items.filter(i => i.seleccionado).length} de {items.length} items seleccionados
                </p>
                <button onClick={() => { setImagen(null); setPreview(null); setStep('upload'); }}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                  <RefreshCw size={12} /> Volver a escanear
                </button>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {items.map(item => {
                  const matched  = !!item.stockMatch;
                  const partial  = !matched && item.matchScore >= 20;
                  const dotColor = matched ? 'bg-green-500' : partial ? 'bg-amber-400' : 'bg-red-500';
                  return (
                    <div key={item._id}
                      className={`rounded-xl border transition-all ${item.seleccionado ? 'border-slate-700 bg-slate-800/40' : 'border-slate-800 bg-slate-900 opacity-50'}`}>

                      {/* Nombre original de la factura (referencia, no editable) */}
                      <div className="flex items-start gap-3 px-3 pt-3 pb-2 border-b border-slate-700/50">
                        <input type="checkbox" checked={item.seleccionado}
                          onChange={e => updateItem(item._id, 'seleccionado', e.target.checked)}
                          className="accent-blue-500 w-4 h-4 cursor-pointer shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 text-sm font-mono leading-tight truncate" title={item.nombre}>
                            {item.nombre}
                          </p>
                          <p className="text-slate-600 text-[10px] mt-0.5">📄 Nombre en factura</p>
                        </div>
                        {item.precio_unitario && (
                          <span className="text-slate-500 text-xs font-mono shrink-0">
                            ${item.precio_unitario.toLocaleString('es-AR')}
                          </span>
                        )}
                        <button onClick={() => removeItem(item._id)}
                          className="p-1 hover:bg-red-500/15 rounded-lg text-slate-700 hover:text-red-400 transition-colors shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Cantidad + unidad + match al stock */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Cantidad */}
                        <input type="number" step="0.001" min="0"
                          value={item.cantidad}
                          onChange={e => updateItem(item._id, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-900 border border-slate-700 hover:border-slate-500 focus:border-blue-500 rounded-lg px-2 py-1.5 text-white text-xs outline-none text-center transition-colors" />
                        {/* Unidad */}
                        <select value={item.unidad}
                          onChange={e => updateItem(item._id, 'unidad', e.target.value)}
                          className="bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg px-2 py-1.5 text-white text-xs outline-none transition-colors">
                          <option value="kg">kg</option>
                          <option value="u">u</option>
                          <option value="lt">lt</option>
                        </select>

                        {/* Vínculo stock */}
                        <button
                          onClick={() => setPickerFor(item._id)}
                          className={`flex-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
                            ${matched
                              ? 'border-green-600/40 bg-green-600/10 text-green-400 hover:bg-green-600/20'
                              : partial
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                              : 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                            <span className="truncate">
                              {item.stockMatch ? item.stockMatch.nombre : '— Sin vincular · tocá para elegir'}
                            </span>
                          </div>
                          <ChevronDown size={12} className="shrink-0 opacity-60" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-center text-slate-600 text-xs py-8">Sin items detectados</p>
                )}
              </div>

              {/* Resumen de match */}
              {items.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-xs flex items-center justify-between flex-wrap gap-2">
                  <span className="text-slate-400">
                    <span className="text-green-400 font-black">{items.filter(i => i.stockMatch).length}</span> vinculados ·{' '}
                    <span className="text-red-400 font-black">{items.filter(i => !i.stockMatch).length}</span> sin vincular
                  </span>
                  <span className="text-slate-600">Los sin vincular se registran pero no actualizan stock</span>
                </div>
              )}

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
              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setImagen(null); setPreview(null); setFactura(null); setItems([]); }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm">
                  📄 Cargar otra
                </button>
                <button onClick={() => { setTab('historial'); fetchHistorial(); }}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm">
                  📋 Ver historial
                </button>
              </div>
            </div>
          )}

          </> /* fin tab cargar */}
        </div>
      </div>
    </div>
  );
}
