"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, ChevronDown, ChevronUp, FileText,
  Building2, ShoppingCart, CalendarDays, Plus, RefreshCw,
  ArrowLeft, Upload, Camera, FileImage, AlertTriangle,
  CheckCircle2, Trash2, Search, X,
} from 'lucide-react';
import { supabase } from '../supabase';
import type { FacturaData, FacturaItem } from '../api/factura/route';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface StockProduct { id: number; nombre: string; unidad: string; cantidad: number; categoria: string; }

interface ItemEditable extends FacturaItem {
  _id: number;
  seleccionado: boolean;
  stockMatch: StockProduct | null;
  matchScore: number;
  pesoRealKg: string; // kg reales pesados (override de cantidad+unidad para stock)
}

interface FacturaHist {
  id: number;
  proveedor: string | null;
  numero_factura: string | null;
  fecha_factura: string | null;
  fecha_carga: string;
  operador: string | null;
  items: { nombre: string; cantidad: number; unidad: string; stockMatch: string | null }[];
  total_items: number;
  imagen_nombre: string | null;
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────
const STOP_WORDS = new Set(['de','del','la','el','los','las','un','una','a','y','o','en','por','con','sin','al','lo','su','se']);

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').trim();
}

function matchScore(facturaName: string, stockName: string): number {
  const aWords = normalize(facturaName).split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const bWords = normalize(stockName).split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  if (!aWords.length || !bWords.length) return 0;
  let hits = 0;
  for (const wa of aWords) {
    if (bWords.some(wb => {
      if (wa === wb) return true;
      if (wa.length >= 4 && wb.length >= 4) return wb.includes(wa) || wa.includes(wb);
      return false;
    })) hits++;
  }
  return Math.round((hits / Math.max(aWords.length, bWords.length)) * 100);
}

function bestMatch(item: FacturaItem, stock: StockProduct[]): { product: StockProduct | null; score: number } {
  let best: StockProduct | null = null, bestScr = 0;
  for (const s of stock) {
    const sc = matchScore(item.nombre_limpio || item.nombre, s.nombre);
    if (sc > bestScr) { bestScr = sc; best = s; }
  }
  return { product: bestScr >= 40 ? best : null, score: bestScr };
}

// ── Stock Picker ──────────────────────────────────────────────────────────────
const CAT_CFG: Record<string,{emoji:string;color:string;bg:string}> = {
  carne:      {emoji:'🥩',color:'text-red-400',   bg:'bg-red-500/20'},
  verdura:    {emoji:'🥦',color:'text-green-400', bg:'bg-green-500/20'},
  verduras:   {emoji:'🥦',color:'text-green-400', bg:'bg-green-500/20'},
  lacteo:     {emoji:'🧀',color:'text-yellow-400',bg:'bg-yellow-500/20'},
  lacteos:    {emoji:'🧀',color:'text-yellow-400',bg:'bg-yellow-500/20'},
  fiambre:    {emoji:'🍖',color:'text-orange-400',bg:'bg-orange-500/20'},
  fiambres:   {emoji:'🍖',color:'text-orange-400',bg:'bg-orange-500/20'},
  pan:        {emoji:'🍞',color:'text-amber-400', bg:'bg-amber-500/20'},
  bebida:     {emoji:'🥤',color:'text-blue-400',  bg:'bg-blue-500/20'},
  bebidas:    {emoji:'🥤',color:'text-blue-400',  bg:'bg-blue-500/20'},
  salsa:      {emoji:'🫙',color:'text-purple-400',bg:'bg-purple-500/20'},
  salsas:     {emoji:'🫙',color:'text-purple-400',bg:'bg-purple-500/20'},
  limpieza:   {emoji:'🧹',color:'text-cyan-400',  bg:'bg-cyan-500/20'},
  descartable:{emoji:'📦',color:'text-slate-400', bg:'bg-slate-500/20'},
  descartables:{emoji:'📦',color:'text-slate-400',bg:'bg-slate-500/20'},
  condimento: {emoji:'🧂',color:'text-pink-400',  bg:'bg-pink-500/20'},
  condimentos:{emoji:'🧂',color:'text-pink-400',  bg:'bg-pink-500/20'},
  aceite:     {emoji:'🫒',color:'text-lime-400',  bg:'bg-lime-500/20'},
};

function StockPicker({ stock, current, onSelect, onClose }: {
  stock: StockProduct[]; current: StockProduct | null;
  onSelect: (p: StockProduct | null) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? stock.filter(s => normalize(s.nombre).includes(normalize(q)) || normalize(s.categoria).includes(normalize(q)))
    : stock;
  const grouped: Record<string, StockProduct[]> = {};
  for (const s of filtered) {
    const cat = s.categoria ?? 'otros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <p className="font-black text-white">Vincular a stock</p>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white"><X size={18}/></button>
        </div>
        <div className="px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-500 shrink-0"/>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600"/>
            {q && <button onClick={()=>setQ('')} className="text-slate-600 hover:text-slate-400"><X size={14}/></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <button onClick={()=>{onSelect(null);onClose();}}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 border transition-colors ${!current?'border-slate-600 bg-slate-800 text-white':'border-slate-800 hover:bg-slate-800/60 text-slate-400'}`}>
            <span className="text-xl">🚫</span>
            <div><p className="font-black">No vincular</p><p className="text-xs text-slate-500">Se guarda pero no actualiza stock</p></div>
          </button>
          {Object.keys(grouped).sort().map(cat => {
            const cfg = CAT_CFG[cat.toLowerCase()] ?? {emoji:'📋',color:'text-slate-400',bg:'bg-slate-500/20'};
            return (
              <div key={cat}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-1 ${cfg.bg}`}>
                  <span>{cfg.emoji}</span>
                  <span className={`text-xs font-black uppercase ${cfg.color}`}>{cat}</span>
                  <span className="ml-auto text-xs text-slate-600">{grouped[cat].length}</span>
                </div>
                {grouped[cat].map(s => (
                  <button key={s.id} onClick={()=>{onSelect(s);onClose();}}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3 transition-colors
                      ${current?.id===s.id?'bg-blue-600/25 text-blue-300 font-black':'hover:bg-slate-800 text-white font-bold'}`}>
                    <span className="truncate">{current?.id===s.id&&'✓ '}{s.nombre}</span>
                    <span className={`text-xs shrink-0 ${Number(s.cantidad)>0?'text-slate-400':'text-red-400'}`}>
                      {Number(s.cantidad).toFixed(2)} {s.unidad}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string|number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-white mt-0.5">{value}</p>
        {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────
export default function TabFactura() {
  const [view, setView] = useState<'dashboard'|'nueva'>('dashboard');

  // ── Estado dashboard ──────────────────────────────────────────────────────
  const [facturas, setFacturas]   = useState<FacturaHist[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [expandedId, setExpandedId]   = useState<number|null>(null);
  const [filterProv, setFilterProv]   = useState('');

  const fetchFacturas = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await supabase.from('facturas_historial').select('*').order('fecha_carga',{ascending:false}).limit(200);
    setFacturas((data??[]) as FacturaHist[]);
    setLoadingHist(false);
  }, []);

  useEffect(()=>{ fetchFacturas(); },[fetchFacturas]);

  // Stats
  const thisMonth = new Date().toISOString().slice(0,7);
  const facturasEsteMes   = facturas.filter(f=>f.fecha_carga?.startsWith(thisMonth)).length;
  const proveedoresUnicos = new Set(facturas.map(f=>f.proveedor).filter(Boolean)).size;
  const totalItems        = facturas.reduce((s,f)=>s+(f.total_items||0),0);

  // Resumen por proveedor
  const byProv: Record<string,{facturas:number;items:number;ultima:string}> = {};
  facturas.forEach(f=>{
    const p=f.proveedor??'Sin proveedor';
    if(!byProv[p]) byProv[p]={facturas:0,items:0,ultima:''};
    byProv[p].facturas++;
    byProv[p].items+=f.total_items||0;
    if(!byProv[p].ultima||f.fecha_carga>byProv[p].ultima) byProv[p].ultima=f.fecha_carga;
  });
  const provList=Object.entries(byProv).sort((a,b)=>b[1].facturas-a[1].facturas);
  const filtered=filterProv?facturas.filter(f=>(f.proveedor??'').toLowerCase().includes(filterProv.toLowerCase())):facturas;

  // ── Estado carga inline ───────────────────────────────────────────────────
  const [step, setStep]       = useState<'upload'|'preview'|'done'>('upload');
  const [imagen, setImagen]   = useState<File|null>(null);
  const [imgPreview, setImgPreview] = useState<string|null>(null);
  const [drag, setDrag]       = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [factura, setFactura] = useState<FacturaData|null>(null);
  const [items, setItems]     = useState<ItemEditable[]>([]);
  const [stockAll, setStockAll] = useState<StockProduct[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [pickerFor, setPickerFor]   = useState<number|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef   = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setStep('upload'); setImagen(null); setImgPreview(null);
    setError(''); setFactura(null); setItems([]); setSavedCount(0);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/') && file.type!=='application/pdf') {
      setError('Debe ser una imagen (JPG, PNG, WEBP) o PDF'); return;
    }
    setImagen(file); setError('');
    setImgPreview(file.type==='application/pdf' ? null : URL.createObjectURL(file));
  };

  const analizar = async () => {
    if (!imagen) return;
    setAnalyzing(true); setError('');
    try {
      const form = new FormData();
      form.append('imagen', imagen);
      const res  = await fetch('/api/factura',{method:'POST',body:form});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error??`Error ${res.status}`);

      const { data: stockData } = await supabase.from('stock').select('id,nombre,unidad,cantidad,categoria').order('categoria').order('nombre');
      const stock: StockProduct[] = (stockData??[]).map((r:any)=>({id:r.id,nombre:r.nombre,unidad:r.unidad,cantidad:Number(r.cantidad),categoria:r.categoria??'otros'}));
      setStockAll(stock);
      setFactura(data as FacturaData);
      setItems((data.items??[]).map((item:FacturaItem,i:number)=>{
        const {product,score}=bestMatch(item,stock);
        return {...item,_id:i,seleccionado:true,stockMatch:product,matchScore:score,pesoRealKg:''};
      }));
      setStep('preview');
    } catch(e:any) { setError(e.message); }
    setAnalyzing(false);
  };

  const updateItem = (id:number,field:keyof ItemEditable,value:any) =>
    setItems(prev=>prev.map(it=>it._id===id?{...it,[field]:value}:it));

  const setMatch = (itemId:number,product:StockProduct|null) =>
    setItems(prev=>prev.map(it=>it._id===itemId?{...it,stockMatch:product,matchScore:product?100:0}:it));

  const confirmar = async () => {
    const sel=items.filter(it=>it.seleccionado);
    if(!sel.length) return;
    setSaving(true); setError('');
    const motivo=`Factura ${factura?.proveedor??'proveedor'} · ${factura?.numero_factura??factura?.fecha??'sin nro'}`;
    const op=`Factura · ${factura?.proveedor??'proveedor'}`;
    let ok=0;
    for(const item of sel){
      try{
        // Si el operador ingresó peso real en kg, usarlo; si no, usar cantidad+unidad de la factura
        const kgReal = item.pesoRealKg ? parseFloat(item.pesoRealKg) : null;
        const cantStock = kgReal ?? item.cantidad;
        const unidStock = kgReal ? 'kg' : item.unidad;
        const motivoItem = kgReal
          ? `${motivo} (${item.cantidad} ${item.unidad} → ${kgReal} kg pesados)`
          : motivo;
        await supabase.from('stock_movements').insert({nombre:item.stockMatch?.nombre??item.nombre,categoria:'ingreso-proveedor',tipo:'ingreso',cantidad:cantStock,unidad:unidStock,motivo:motivoItem,operador:op,fecha:new Date().toISOString()});
        if(item.stockMatch){
          const s=item.stockMatch;
          await supabase.from('stock').update({cantidad:parseFloat((Number(s.cantidad)+cantStock).toFixed(3)),fecha_actualizacion:new Date().toISOString().slice(0,10)}).eq('id',s.id);
        }
        ok++;
      }catch(e:any){console.error('[factura confirm]',item.nombre,e.message);}
    }
    try{
      await supabase.from('facturas_historial').insert({proveedor:factura?.proveedor??null,numero_factura:factura?.numero_factura??null,fecha_factura:factura?.fecha??null,operador:op,items:sel.map(i=>{const kg=i.pesoRealKg?parseFloat(i.pesoRealKg):null;return{nombre:i.nombre,cantidad:kg??i.cantidad,unidad:kg?'kg':i.unidad,cantidadFactura:i.cantidad,unidadFactura:i.unidad,stockMatch:i.stockMatch?.nombre??null};}),total_items:sel.length,imagen_nombre:imagen?.name??null});
    }catch(e){console.error('[factura historial]',e);}
    setSavedCount(ok);
    setSaving(false);
    setStep('done');
    fetchFacturas(); // refrescar dashboard en background
  };

  const itemForPicker=pickerFor!==null?items.find(i=>i._id===pickerFor)??null:null;

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: NUEVA FACTURA (inline)
  // ════════════════════════════════════════════════════════════════════════════
  if (view==='nueva') return (
    <div className="max-w-2xl mx-auto space-y-6">
      {pickerFor!==null && itemForPicker && (
        <StockPicker stock={stockAll} current={itemForPicker.stockMatch} onSelect={p=>setMatch(pickerFor,p)} onClose={()=>setPickerFor(null)}/>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={()=>{resetForm();setView('dashboard');}}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors">
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white">📄 Nueva factura</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {step==='upload'  && 'Subí la foto y la IA extrae los productos'}
            {step==='preview' && `${factura?.proveedor??'Proveedor'} · revisá antes de confirmar`}
            {step==='done'    && `${savedCount} producto${savedCount!==1?'s':''} cargados al stock`}
          </p>
        </div>
      </div>

      {/* ── STEP: upload ── */}
      {step==='upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            onClick={()=>!imagen&&inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl transition-all
              ${imagen?'border-green-500/50 bg-green-500/5 cursor-default'
              :drag  ?'border-blue-400 bg-blue-500/10 cursor-copy'
                     :'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 cursor-pointer'}`}>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value='';}}/>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value='';}}/>
            {imagen ? (
              <div className="p-6 flex gap-5 items-center">
                {imgPreview
                  ? <img src={imgPreview} alt="factura" className="w-28 h-28 object-cover rounded-xl border border-slate-700"/>
                  : <div className="w-28 h-28 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center text-4xl">📄</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-green-400 truncate">{imagen.name}</p>
                  <p className="text-slate-500 text-sm mt-1">{(imagen.size/1024).toFixed(0)} KB</p>
                </div>
                <button onClick={e=>{e.stopPropagation();setImagen(null);setImgPreview(null);}}
                  className="p-2 hover:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-300">
                  <X size={16}/>
                </button>
              </div>
            ):(
              <div className="p-16 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <FileImage size={28} className="text-slate-400"/>
                </div>
                <div className="text-center">
                  <p className="font-bold text-white">Arrastrá la foto acá</p>
                  <p className="text-slate-500 text-sm mt-1">o hacé click · JPG, PNG, WEBP, PDF</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={()=>camRef.current?.click()}
            className="w-full py-3 border border-slate-700 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white font-bold flex items-center justify-center gap-2 transition-colors">
            <Camera size={16}/> Sacar foto con la cámara
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5"/>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button onClick={analizar} disabled={!imagen||analyzing}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-base">
            {analyzing?<><Loader2 size={20} className="animate-spin"/> Analizando con IA...</>:'🔍 Analizar factura'}
          </button>
        </div>
      )}

      {/* ── STEP: preview ── */}
      {step==='preview' && (
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-500 text-xs uppercase font-bold mb-1">Proveedor</p>
              <p className="text-white font-black">{factura?.proveedor??'—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase font-bold mb-1">Fecha</p>
              <p className="text-white font-black">{factura?.fecha??'—'}</p>
            </div>
            {factura?.numero_factura && (
              <div className="col-span-2">
                <p className="text-slate-500 text-xs uppercase font-bold mb-1">Nro. factura</p>
                <p className="text-white font-mono text-sm">{factura.numero_factura}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> Vinculado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> Sin match</span>
            </div>
            <button onClick={()=>{setImagen(null);setImgPreview(null);setStep('upload');}}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <RefreshCw size={12}/> Volver a escanear
            </button>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {items.map(item=>{
              const matched=!!item.stockMatch;
              const partial=!matched&&item.matchScore>=20;
              const dotColor=matched?'bg-green-500':partial?'bg-amber-400':'bg-red-500';
              return (
                <div key={item._id} className={`rounded-xl border transition-all ${item.seleccionado?'border-slate-700 bg-slate-800/40':'border-slate-800 bg-slate-900 opacity-50'}`}>
                  <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-slate-700/50">
                    <input type="checkbox" checked={item.seleccionado} onChange={e=>updateItem(item._id,'seleccionado',e.target.checked)}
                      className="accent-blue-500 w-4 h-4 cursor-pointer shrink-0 mt-0.5"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm font-mono leading-tight truncate">{item.nombre}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">📄 Nombre en factura</p>
                    </div>
                    {item.precio_unitario && (
                      <span className="text-slate-500 text-xs font-mono shrink-0">${item.precio_unitario.toLocaleString('es-AR')}</span>
                    )}
                    <button onClick={()=>setItems(prev=>prev.filter(it=>it._id!==item._id))}
                      className="p-1 hover:bg-red-500/15 rounded-lg text-slate-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <input type="number" step="0.001" min="0" value={item.cantidad}
                      onChange={e=>updateItem(item._id,'cantidad',parseFloat(e.target.value)||0)}
                      className="w-20 bg-slate-900 border border-slate-700 hover:border-slate-500 focus:border-blue-500 rounded-lg px-2 py-1.5 text-white text-xs outline-none text-center"/>
                    <select value={item.unidad} onChange={e=>updateItem(item._id,'unidad',e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none">
                      <option value="kg">kg</option>
                      <option value="u">u</option>
                      <option value="lt">lt</option>
                    </select>
                    <button onClick={()=>setPickerFor(item._id)}
                      className={`flex-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all
                        ${matched?'border-green-600/40 bg-green-600/10 text-green-400 hover:bg-green-600/20'
                        :partial?'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                :'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}/>
                        <span className="truncate">{item.stockMatch?item.stockMatch.nombre:'— Sin vincular · tocá para elegir'}</span>
                      </div>
                      <ChevronDown size={12} className="shrink-0 opacity-60"/>
                    </button>
                  </div>

                  {/* Campo peso real — obligatorio si la unidad de factura ≠ unidad del stock vinculado */}
                  {(() => {
                    const stockUnidad = item.stockMatch?.unidad;
                    const necesitaPeso = item.seleccionado && item.stockMatch && item.unidad !== stockUnidad;
                    const esPesable = item.unidad === 'u' && (!stockUnidad || stockUnidad === 'kg' || stockUnidad === 'lt');
                    if (!necesitaPeso && !esPesable) return null;
                    const obligatorio = !!necesitaPeso;
                    const falta = obligatorio && (!item.pesoRealKg || parseFloat(item.pesoRealKg) <= 0);
                    return (
                      <div className={`mx-4 mb-3 rounded-xl border px-3 py-2.5 transition-all
                        ${falta ? 'border-red-500/60 bg-red-500/5'
                        : item.pesoRealKg ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-slate-700/50 bg-slate-800/30'}`}>
                        <p className={`text-[10px] font-black uppercase mb-1.5 ${falta ? 'text-red-400' : 'text-slate-500'}`}>
                          ⚖️ Peso real al recepcionar
                          {obligatorio
                            ? <span className="text-red-400 ml-1">— REQUERIDO (factura en {item.unidad}, stock en {stockUnidad})</span>
                            : <span className="text-slate-600 font-normal normal-case ml-1">(opcional — si pesaste los cajones)</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" step="0.001" min="0"
                            value={item.pesoRealKg}
                            onChange={e=>updateItem(item._id,'pesoRealKg',e.target.value)}
                            placeholder="0.000"
                            className={`flex-1 bg-slate-900 border rounded-lg px-3 py-1.5 text-white text-sm font-black outline-none text-center placeholder-slate-700
                              ${falta ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-amber-500'}`}/>
                          <span className={`font-black text-sm ${falta ? 'text-red-400' : 'text-amber-400'}`}>
                            {stockUnidad ?? 'kg'}
                          </span>
                          {item.pesoRealKg && (
                            <button onClick={()=>updateItem(item._id,'pesoRealKg','')}
                              className="text-slate-600 hover:text-slate-400 transition-colors">
                              <X size={13}/>
                            </button>
                          )}
                        </div>
                        {item.pesoRealKg && parseFloat(item.pesoRealKg) > 0 && (
                          <p className="text-[10px] text-amber-400 font-black mt-1.5">
                            ✓ Se cargará {parseFloat(item.pesoRealKg)} {stockUnidad ?? 'kg'} al stock (en lugar de {item.cantidad} {item.unidad})
                          </p>
                        )}
                        {falta && (
                          <p className="text-[10px] text-red-400 font-black mt-1.5">
                            ⛔ No se puede confirmar sin el peso real — las unidades no son compatibles con el stock
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {items.length>0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-xs flex items-center justify-between flex-wrap gap-2">
              <span className="text-slate-400">
                <span className="text-green-400 font-black">{items.filter(i=>i.stockMatch).length}</span> vinculados ·{' '}
                <span className="text-red-400 font-black">{items.filter(i=>!i.stockMatch).length}</span> sin vincular
              </span>
              <span className="text-slate-600">Los sin vincular se registran pero no actualizan stock</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5"/>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {(() => {
            const sel = items.filter(i=>i.seleccionado);
            const incompatibles = sel.filter(i=>
              i.stockMatch && i.unidad !== i.stockMatch.unidad &&
              (!i.pesoRealKg || parseFloat(i.pesoRealKg) <= 0)
            );
            const bloqueado = saving || sel.length === 0 || incompatibles.length > 0;
            return (
              <>
                {incompatibles.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex gap-2">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5"/>
                    <p className="text-red-400 text-sm font-bold">
                      {incompatibles.length} ítem{incompatibles.length>1?'s':''} con unidades incompatibles —
                      completá el peso real en {incompatibles.map(i=>i.stockMatch?.unidad??'kg').filter((v,i,a)=>a.indexOf(v)===i).join('/')} para continuar.
                    </p>
                  </div>
                )}
                <button onClick={confirmar} disabled={bloqueado}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-base">
                  {saving?<><Loader2 size={20} className="animate-spin"/> Cargando al stock...</>
                    :`✅ Confirmar y cargar ${sel.length} productos al stock`}
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* ── STEP: done ── */}
      {step==='done' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 bg-green-500/15 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={36} className="text-green-400"/>
          </div>
          <div>
            <h4 className="font-black text-white text-2xl">¡Listo!</h4>
            <p className="text-slate-400 mt-2">
              Se cargaron <span className="font-black text-green-400">{savedCount} productos</span> al stock como ingreso de {factura?.proveedor??'proveedor'}.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{resetForm();}}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">
              📄 Cargar otra
            </button>
            <button onClick={()=>{resetForm();setView('dashboard');}}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">
              ← Volver al historial
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-white">📄 Facturas de proveedor</h2>
          <p className="text-slate-500 text-sm mt-0.5">Historial de compras e ingresos de stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchFacturas}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors">
            <RefreshCw size={16} className={loadingHist?'animate-spin':''}/>
          </button>
          <button onClick={()=>{resetForm();setView('nueva');}}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/30">
            <Plus size={16}/> Nueva factura IA
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<FileText size={20} className="text-indigo-400"/>} label="Total facturas" value={facturas.length} sub="desde el inicio" color="bg-indigo-500/15"/>
        <StatCard icon={<CalendarDays size={20} className="text-blue-400"/>} label="Este mes" value={facturasEsteMes} sub={new Date().toLocaleString('es-AR',{month:'long',year:'numeric'})} color="bg-blue-500/15"/>
        <StatCard icon={<Building2 size={20} className="text-green-400"/>} label="Proveedores" value={proveedoresUnicos} sub="distintos registrados" color="bg-green-500/15"/>
        <StatCard icon={<ShoppingCart size={20} className="text-amber-400"/>} label="Items cargados" value={totalItems} sub="productos ingresados al stock" color="bg-amber-500/15"/>
      </div>

      {/* Resumen por proveedor */}
      {provList.length>0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wide">🏢 Por proveedor</h3>
            <span className="text-xs text-slate-500">{provList.length} proveedores</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-slate-800">
            {provList.map(([prov,stats])=>(
              <div key={prov} className="bg-slate-900 px-5 py-4">
                <p className="font-black text-white text-sm truncate">{prov}</p>
                <div className="flex gap-4 mt-2">
                  <div><p className="text-[10px] text-slate-500 uppercase font-bold">Facturas</p><p className="font-black text-indigo-400 text-lg">{stats.facturas}</p></div>
                  <div><p className="text-[10px] text-slate-500 uppercase font-bold">Items</p><p className="font-black text-amber-400 text-lg">{stats.items}</p></div>
                  <div className="ml-auto text-right"><p className="text-[10px] text-slate-500 uppercase font-bold">Última</p><p className="text-slate-400 text-xs font-bold">{new Date(stats.ultima).toLocaleDateString('es-AR')}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-black text-white text-sm uppercase tracking-wide">📋 Historial de facturas</h3>
          <input value={filterProv} onChange={e=>setFilterProv(e.target.value)} placeholder="Filtrar por proveedor..."
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500 w-52 placeholder-slate-600"/>
        </div>
        {loadingHist ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 size={20} className="animate-spin"/> Cargando facturas...
          </div>
        ) : filtered.length===0 ? (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-lg">Sin facturas todavía</p>
            <p className="text-sm mt-1">
              <button onClick={()=>{resetForm();setView('nueva');}} className="text-indigo-400 hover:underline">Cargá la primera factura</button>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(f=>{
              const isOpen=expandedId===f.id;
              const vinculados=(f.items??[]).filter(i=>i.stockMatch).length;
              return (
                <div key={f.id}>
                  <button onClick={()=>setExpandedId(isOpen?null:f.id)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-800/40 transition-colors text-left">
                    <div className="shrink-0 w-16 text-center">
                      <p className="text-xs text-slate-500 font-bold">
                        {f.fecha_factura?new Date(f.fecha_factura+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}):'—'}
                      </p>
                      <p className="text-[10px] text-slate-600">
                        {f.fecha_factura?new Date(f.fecha_factura+'T00:00:00').getFullYear():''}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white text-sm truncate">{f.proveedor??'Sin proveedor'}</p>
                      <p className="text-slate-500 text-xs mt-0.5 font-mono">{f.numero_factura??'—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">{f.total_items} items</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border
                        ${vinculados===f.total_items?'text-green-400 bg-green-500/10 border-green-500/20'
                        :vinculados>0?'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                   :'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                        {vinculados}/{f.total_items} vinc.
                      </span>
                    </div>
                    <div className="hidden md:block text-right shrink-0 w-32">
                      <p className="text-xs text-slate-500">{f.operador?.split('·')[0]?.trim()}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(f.fecha_carga).toLocaleDateString('es-AR')} {new Date(f.fecha_carga).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                    {isOpen?<ChevronUp size={15} className="text-slate-500 shrink-0"/>:<ChevronDown size={15} className="text-slate-500 shrink-0"/>}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 bg-slate-800/20">
                      <div className="rounded-xl overflow-hidden border border-slate-700">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
                              <th className="px-4 py-2 text-left">Nombre en factura</th>
                              <th className="px-3 py-2 text-center">Cantidad</th>
                              <th className="px-4 py-2 text-left">Vinculado a stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {(f.items??[]).map((item,i)=>(
                              <tr key={i} className="hover:bg-slate-800/30">
                                <td className="px-4 py-2.5 font-mono text-slate-300">{item.nombre}</td>
                                <td className="px-3 py-2.5 text-center text-slate-400 font-black">{item.cantidad} {item.unidad}</td>
                                <td className="px-4 py-2.5">
                                  {item.stockMatch?<span className="text-green-400 font-black">✓ {item.stockMatch}</span>:<span className="text-red-400/60">— sin vincular</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
