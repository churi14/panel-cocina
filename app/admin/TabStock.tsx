"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { AlertTriangle, Search, RefreshCw, Package, X, TrendingUp, TrendingDown, User , Trash2 } from 'lucide-react';
import { Movement, formatFecha } from './types';
import { supabase } from '../supabase';
import StockEntryModal from '../components/StockEntryModal';
import FacturaModal from './FacturaModal';

// ── Formatos doypack/paquete por producto ─────────────────────────────────────
const FORMATOS_DOYPACK: Record<string, { label: string; kg: number }[]> = {
  'MAYONESA':        [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'2.9 kg', kg:2.900 }],
  'MAYONESA CLASICA':[{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'2.9 kg', kg:2.900 }],
  'KETCHUP':         [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'MOSTAZA':         [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'SAVORA':          [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'BARBACOA':        [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'CHEDDAR LIQUIDO': [{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'CHEDDAR LÍQUIDO': [{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 },{ label:'3 kg',   kg:3.000 }],
  'SALSA CRIOLLA':   [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 }],
  'CHIMICHURRI':     [{ label:'237g', kg:0.237 },{ label:'475g', kg:0.475 },{ label:'950g', kg:0.950 }],
};
function getFormatosDoypack(nombre: string) {
  const key = Object.keys(FORMATOS_DOYPACK).find(k => nombre?.toUpperCase().includes(k));
  return key ? FORMATOS_DOYPACK[key] : null;
}

type Props = {
  stock: any[];
  stockProd: any[];
  movements: Movement[];
  fetchMovements: () => Promise<void>;
};

// ── Cálculo automático de descuentos de materia prima ────────────────────────
type Descuento = {
  nombre: string;
  tabla: 'stock' | 'stock_produccion';
  cantidad: number;
  unidad: string;
};

function calcularDescuentos(producto: string, cantidad: number): Descuento[] {
  const p = producto.toLowerCase();

  // Medallones Burger — cada medallón ~150g, blend 66% carne / 34% grasa
  if (p.includes('medallones burger')) {
    const kgTotal = cantidad * 0.150;
    return [
      { nombre: 'Carne Limpia (blend)', tabla: 'stock_produccion', cantidad: parseFloat((kgTotal * 0.66).toFixed(3)), unidad: 'kg' },
      { nombre: 'Grasa de Pella',       tabla: 'stock_produccion', cantidad: parseFloat((kgTotal * 0.34).toFixed(3)), unidad: 'kg' },
    ];
  }

  // Bifes Lomito_{Corte} — deducir de carnes_limpias correspondiente
  // Nota: no calculamos kg por bife porque varía — solo referencia informativa
  const bifesMatch = producto.match(/Bifes Lomito_(.+)/);
  if (bifesMatch) {
    // No hay forma de saber exactamente cuánto pesaba cada bife sin el dato original
    // Se muestra como referencia pero no se descuenta automáticamente para evitar errores
    return [];
  }

  // Milanesa de Carne Empanada — menjunje + pan rallado + huevo
  if (p.includes('milanesa de carne empanada')) {
    return [
      { nombre: 'Menjunje Milanesa Carne', tabla: 'stock_produccion', cantidad, unidad: 'kg' },
      { nombre: 'PAN RALLADO', tabla: 'stock', cantidad: parseFloat((cantidad * 0.15).toFixed(3)), unidad: 'kg' },
      { nombre: 'HUEVO',       tabla: 'stock', cantidad: Math.ceil(cantidad), unidad: 'u' },
    ];
  }

  // Milanesa de Pollo Empanada
  if (p.includes('milanesa de pollo empanada')) {
    return [
      { nombre: 'Menjunje Milanesa Pollo', tabla: 'stock_produccion', cantidad, unidad: 'kg' },
      { nombre: 'PAN RALLADO', tabla: 'stock', cantidad: parseFloat((cantidad * 0.15).toFixed(3)), unidad: 'kg' },
      { nombre: 'HUEVO',       tabla: 'stock', cantidad: Math.ceil(cantidad), unidad: 'u' },
    ];
  }

  // Menjunje Milanesa Carne/Pollo
  if (p.includes('menjunje milanesa carne')) {
    return [
      { nombre: 'HUEVO', tabla: 'stock', cantidad: Math.ceil(cantidad * 4.2), unidad: 'u' },
      { nombre: 'SAL',   tabla: 'stock', cantidad: parseFloat((cantidad * 0.0195).toFixed(3)), unidad: 'kg' },
    ];
  }
  if (p.includes('menjunje milanesa pollo')) {
    return [
      { nombre: 'HUEVO', tabla: 'stock', cantidad: Math.ceil(cantidad * 4.2), unidad: 'u' },
      { nombre: 'SAL',   tabla: 'stock', cantidad: parseFloat((cantidad * 0.0195).toFixed(3)), unidad: 'kg' },
    ];
  }

  // Milanesa cruda (sin empanar) — desde carne limpia 1:1
  const milaMatch = producto.match(/Milanesa - (.+)/);
  if (milaMatch) {
    return [{ nombre: `${milaMatch[1]}_L`, tabla: 'stock_produccion', cantidad, unidad: 'kg' }];
  }

  // Fiambres — 1:1 desde stock admin
  if (p.includes('jamón') || p.includes('jamon')) return [{ nombre: 'JAMÓN', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('panceta'))   return [{ nombre: 'PANCETA', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('provoleta')) return [{ nombre: 'PROVOLETA', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('queso muzza') || p.includes('muzza')) return [{ nombre: 'QUESO MUZZA', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('queso tybo') || p.includes('tybo'))   return [{ nombre: 'QUESO TYBO', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('cheddar en feta'))   return [{ nombre: 'CHEDDAR EN FETA', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('cheddar para burg')) return [{ nombre: 'CHEDDAR PARA BURGUER', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('cheddar líquido') || p.includes('cheddar liquido')) return [{ nombre: 'CHEDDAR LIQUIDO', tabla: 'stock', cantidad, unidad: 'kg' }];

  // Salsas base mayonesa
  if (p.includes('salsa club') || p.includes('mayo mila') || p.includes('salsa spread') || p.includes('mayo con ajo') || p.includes('salsa de ajo'))
    return [{ nombre: 'MAYONESA', tabla: 'stock', cantidad: parseFloat((cantidad * 0.97).toFixed(3)), unidad: 'kg' }];
  if (p.includes('salsa crema') || p.includes('crema'))
    return [{ nombre: 'QUESO CREMA', tabla: 'stock', cantidad, unidad: 'kg' }];
  if (p.includes('napolitana'))
    return [{ nombre: 'TOMATE TRITURADO', tabla: 'stock', cantidad: parseFloat((cantidad * 0.97).toFixed(3)), unidad: 'kg' }];
  if (p.includes('criolla'))
    return [{ nombre: 'TOMATE DE CAJON', tabla: 'stock', cantidad: parseFloat((cantidad * 0.50).toFixed(3)), unidad: 'kg' }];

  // Verduras — 1:1 con merma ~20%
  if (p.includes('tomate'))  return [{ nombre: 'TOMATE DE CAJON',  tabla: 'stock', cantidad: parseFloat((cantidad * 1.2).toFixed(3)), unidad: 'kg' }];
  if (p.includes('lechuga')) return [{ nombre: 'LECHUGA', tabla: 'stock', cantidad: parseFloat((cantidad * 1.3).toFixed(3)), unidad: 'kg' }];
  if (p.includes('cebolla')) return [{ nombre: 'CEBOLLA', tabla: 'stock', cantidad: parseFloat((cantidad * 1.2).toFixed(3)), unidad: 'kg' }];
  if (p.includes('morrón') || p.includes('morron')) return [{ nombre: 'MORRON', tabla: 'stock', cantidad: parseFloat((cantidad * 1.2).toFixed(3)), unidad: 'kg' }];

  return [];
}

export default function TabStock({ stock, stockProd, movements, fetchMovements }: Props) {
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showFactura, setShowFactura]       = useState(false);
  const { user } = useAuth();
  const [stockCat, setStockCat]           = useState('all');
  const [stockSearch, setStockSearch]     = useState('');
  const [stockSubTab, setStockSubTab]     = useState<'materiales' | 'produccion' | 'carne_limpia'>('materiales');
  const [selectedStockItem, setSelectedStockItem] = useState<any | null>(null);
  const [facturaQty, setFacturaQty]           = useState('');
  const [facturaProveedor, setFacturaProveedor] = useState('');
  const [facturaLote, setFacturaLote]           = useState('');
  const [facturaComentario, setFacturaComentario] = useState('');
  const [facturaVence, setFacturaVence]         = useState('');
  const [savingFactura, setSavingFactura]     = useState(false);
  const savingFacturaRef = React.useRef(false);
  // Egreso
  const [egresoQty, setEgresoQty]             = useState('');
  const [egresoComentario, setEgresoComentario] = useState('');
  const [savingEgreso, setSavingEgreso]       = useState(false);
  const savingEgresoRef = React.useRef(false);
  // Modo latas
  const [latasCount, setLatasCount]           = useState('');
  const [latasPeso, setLatasPeso]             = useState('');
  const [modoLatas, setModoLatas]             = useState(false);
  const [aderezoCounts, setAderezoCounts]     = useState<Record<string,number>>({});
  // Tab ingreso/egreso en modal
  const [modalTab, setModalTab]               = useState<'ingreso' | 'egreso'>('ingreso');
  const [editingUmbrales, setEditingUmbrales]       = useState(false);
  const [umbralMinimo, setUmbralMinimo]             = useState('');
  const [umbralMedio, setUmbralMedio]               = useState('');
  const [umbralCritico, setUmbralCritico]           = useState('');
  const [savingUmbrales, setSavingUmbrales]         = useState(false);
  // Edición de movimientos
  const [editingMovement, setEditingMovement]       = useState<any | null>(null);
  const [editMovQty, setEditMovQty]                 = useState('');
  const [editMovMotivo, setEditMovMotivo]           = useState('');
  const [savingMovement, setSavingMovement]         = useState(false);
  const [deleteMovConfirm, setDeleteMovConfirm]     = useState<any | null>(null);
  // Umbrales personales (por usuario logueado)
  const [miCritico, setMiCritico]                   = useState('');
  const [miMedio, setMiMedio]                       = useState('');
  const [savingMiAlerta, setSavingMiAlerta]         = useState(false);
  const [miAlertaActual, setMiAlertaActual]         = useState<{critico?:number|null;medio?:number|null}|null>(null);
  const [selectedProdItem, setSelectedProdItem]   = useState<any | null>(null);
  const [alertaUmbral, setAlertaUmbral]           = useState('');
  const [alertaDias, setAlertaDias]               = useState('');
  const [savingAlerta, setSavingAlerta]           = useState(false);
  const [cargaQty, setCargaQty]                   = useState('');
  const [cargaMotivo, setCargaMotivo]             = useState('Producción manual');
  const [savingCarga, setSavingCarga]             = useState(false);
  const [prodTab, setProdTab]                     = useState<'carga' | 'alerta' | 'historial'>('carga');
  const [editandoProdStock, setEditandoProdStock] = useState(false);
  const [prodStockValor, setProdStockValor]       = useState('');
  const [savingProdStock, setSavingProdStock]     = useState(false);
  const savingProdStockRef = React.useRef(false);
  const [editandoMatStock, setEditandoMatStock]   = useState(false);
  const [matStockValor, setMatStockValor]         = useState('');
  const [savingMatStock, setSavingMatStock]       = useState(false);
  const savingMatStockRef = React.useRef(false);
  // Edición de unidad
  const [editandoUnidad, setEditandoUnidad]       = useState(false);
  const [nuevaUnidad, setNuevaUnidad]             = useState('');
  const [nuevaCantidadUnidad, setNuevaCantidadUnidad] = useState('');
  const [responsableUnidad, setResponsableUnidad] = useState('');
  const [savingUnidad, setSavingUnidad]           = useState(false);
  const [showNuevoModal, setShowNuevoModal]       = useState(false);
  const [nuevoCat, setNuevoCat]                   = useState('');
  const [nuevoNombre, setNuevoNombre]             = useState('');
  const [nuevoCantidad, setNuevaCantidad]         = useState('');
  const [nuevoUnidad, setNuevoUnidad]             = useState('kg');
  const [savingNuevo, setSavingNuevo]             = useState(false);
  const [overrideWarn, setOverrideWarn]           = useState(false);
  const [overrideProdWarn, setOverrideProdWarn]   = useState(false);

  // Movimientos directos del producto seleccionado (no depende del límite 200 del dashboard)
  const [itemMovsFetched, setItemMovsFetched]     = useState<Movement[]>([]);
  const [loadingItemMovs, setLoadingItemMovs]     = useState(false);

  const fetchItemMovs = React.useCallback(async (nombre: string) => {
    setLoadingItemMovs(true);
    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('nombre', nombre)
      .order('fecha', { ascending: false })
      .limit(150);
    setItemMovsFetched((data ?? []) as Movement[]);
    setLoadingItemMovs(false);
  }, []);

  useEffect(() => {
    if (selectedStockItem) fetchItemMovs(selectedStockItem.nombre);
    else setItemMovsFetched([]);
  }, [selectedStockItem?.id, fetchItemMovs]);

  const [itemProdMovsFetched, setItemProdMovsFetched] = useState<Movement[]>([]);
  const [loadingProdMovs, setLoadingProdMovs]         = useState(false);

  const fetchProdItemMovs = React.useCallback(async (nombre: string) => {
    setLoadingProdMovs(true);
    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('nombre', nombre)
      .order('fecha', { ascending: false })
      .limit(500);
    setItemProdMovsFetched((data ?? []) as Movement[]);
    setLoadingProdMovs(false);
  }, []);

  useEffect(() => {
    if (selectedProdItem) fetchProdItemMovs(selectedProdItem.producto);
    else setItemProdMovsFetched([]);
  }, [selectedProdItem?.id, fetchProdItemMovs]);

  const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
    carnes_limpias: { emoji: '🔪', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    headerBg: 'bg-red-500/20'    },
    lomito:   { emoji: '🥩', color: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   headerBg: 'bg-rose-500/20'   },
    burger:   { emoji: '🍔', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   headerBg: 'bg-blue-500/20'   },
    milanesa: { emoji: '🥪', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  headerBg: 'bg-amber-500/20'  },
    verdura:  { emoji: '🥦', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  headerBg: 'bg-green-500/20'  },
    verduras: { emoji: '🥦', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  headerBg: 'bg-green-500/20'  },
    fiambre:  { emoji: '🧀', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', headerBg: 'bg-yellow-500/20' },
    pan:      { emoji: '🍞', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', headerBg: 'bg-orange-500/20' },
    salsa:    { emoji: '🫙', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', headerBg: 'bg-purple-500/20' },
    dip:      { emoji: '🥄', color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   headerBg: 'bg-pink-500/20'   },
    caja:     { emoji: '📦', color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  headerBg: 'bg-slate-500/20'  },
  };
  const DEFAULT_CFG = { emoji: '📋', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', headerBg: 'bg-slate-500/20' };
  // Categorías dinámicas — lee lo que haya en stockProd
  const prodCats = [...new Set(stockProd.map((s: any) => s.categoria as string))].sort();
  return (
    <div className="max-w-6xl mx-auto space-y-6">

            {/* Sub-tabs + botón factura en la misma fila */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
                {([
                  { id: 'materiales',   label: '🥩 Carnes y Materiales' },
                  { id: 'carne_limpia', label: '🔪 Carne Limpia' },
                  { id: 'produccion',   label: '🍔 Producción' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setStockSubTab(t.id as any)}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all
                      ${stockSubTab === t.id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowFactura(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition-all active:scale-95 whitespace-nowrap shadow-lg">
                📄 Cargar factura IA
              </button>
            </div>

            {/* ── SUB-TAB MATERIALES ── */}
            {stockSubTab === 'materiales' && (
              <>
                {/* Filtros */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
                  <button
                    onClick={() => setShowEntryModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black text-sm rounded-xl transition-all active:scale-95 whitespace-nowrap">
                    <Package size={16} /> Ingreso manual
                  </button>
                  <div className="relative flex-1 min-w-48">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" placeholder="Buscar producto..." value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 outline-none focus:border-slate-500" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['all', ...new Set(stock.map(s => s.categoria))].map(cat => (
                      <button key={cat} onClick={() => setStockCat(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${stockCat === cat ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                        {cat === 'all' ? 'TODOS' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid por categoría */}
                {[...new Set(stock.filter(s => stockCat === 'all' || s.categoria === stockCat).map(s => s.categoria))].map(cat => {
                  const catItems = stock.filter(s => s.categoria === cat && (stockCat === 'all' || s.categoria === stockCat) && s.nombre.toLowerCase().includes(stockSearch.toLowerCase()));
                  if (catItems.length === 0) return null;
                  const CAT_EMOJI: Record<string,string> = { CARNES:'🥩',VERDURA:'🥗',FIAMBRE:'🧀',SECOS:'🧂',BEBIDAS:'🥤',LIMPIEZA:'🧴',BROLAS:'🍫',DESCARTABLES:'📦' };
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 bg-slate-900 border border-slate-800">
                        <span className="font-black text-sm uppercase text-slate-300">{CAT_EMOJI[cat] ?? '📦'} {cat}</span>
                        <span className="text-xs text-slate-500">{catItems.length} items</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {catItems.map((item: any) => {
                          const negativo = item.cantidad < 0;
                          const zero    = item.cantidad === 0;
                          const critico = item.stock_critico ?? 10;
                          const medio   = item.stock_medio   ?? 20;
                          const low     = !zero && !negativo && item.cantidad <= critico;
                          const warn    = !zero && !negativo && !low && item.cantidad <= medio;
                          // Detectar vencimiento
                          const hoyStr = new Date().toISOString().slice(0,10);
                          const vencDate = item.fecha_vencimiento ? (() => {
                            const [d,m,y] = item.fecha_vencimiento.split('/');
                            return y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null;
                          })() : null;
                          const vencido  = vencDate ? vencDate < hoyStr : false;
                          const proxVenc = vencDate ? (vencDate >= hoyStr && vencDate <= new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10)) : false;
                          const tieneAlerta = negativo || vencido || proxVenc;

                          return (
                            <div key={item.id} onClick={() => { setSelectedStockItem(item); setModalTab('ingreso'); setModoLatas(false); setLatasCount(''); setLatasPeso(''); setEgresoQty(''); setEgresoComentario(''); setFacturaQty(''); setFacturaProveedor(''); }} className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-opacity relative ${negativo ? 'border-red-600/60 bg-red-600/10' : vencido ? 'border-orange-500/60 bg-orange-500/10' : zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
                              
                              {/* Icono de alerta */}
                              {tieneAlerta && (
                                <div className={`absolute top-2 right-2 rounded-full p-1 ${negativo ? 'bg-red-500' : vencido ? 'bg-orange-500' : 'bg-amber-500'}`}
                                  title={negativo ? 'Stock negativo' : vencido ? `Vencido: ${item.fecha_vencimiento}` : `Vence pronto: ${item.fecha_vencimiento}`}>
                                  <AlertTriangle size={12} className="text-white" />
                                </div>
                              )}

                              <p className="font-bold text-slate-300 text-sm leading-tight mb-2 pr-6">{item.nombre}</p>
                              <p className={`text-2xl font-black ${negativo ? 'text-red-500' : vencido ? 'text-orange-400' : zero ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'}`}>
                                {item.unidad === 'kg' || item.unidad === 'lt'
                                  ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                  : Number.isInteger(item.cantidad) ? item.cantidad : item.cantidad.toFixed(1)} {item.unidad}
                              </p>
                              {negativo  && <p className="text-xs text-red-500 font-black mt-1">⚠️ STOCK NEGATIVO</p>}
                              {vencido   && <p className="text-xs text-orange-400 font-black mt-1">⚠️ VENCIDO: {item.fecha_vencimiento}</p>}
                              {proxVenc  && !vencido && <p className="text-xs text-amber-400 font-black mt-1">⏰ Vence: {item.fecha_vencimiento}</p>}
                              {zero && !vencido && <p className="text-xs text-red-400 font-black mt-1">SIN STOCK</p>}
                            </div>
                          );
                        })}
                          {/* ── Tarjeta agregar producto ── */}
                          <div onClick={() => { setNuevoCat(cat as string); setNuevoNombre(''); setNuevaCantidad(''); setNuevoUnidad('kg'); setShowNuevoModal(true); }}
                            className="rounded-2xl border-2 border-dashed border-green-500/50 bg-green-500/5 p-4 cursor-pointer hover:border-green-400 hover:bg-green-500/10 transition-all flex flex-col items-center justify-center gap-2 min-h-[80px] active:scale-95">
                            <span className="text-2xl text-green-500">+</span>
                            <span className="text-xs font-bold text-green-400">Agregar</span>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── SUB-TAB CARNE LIMPIA ── */}
            {stockSubTab === 'carne_limpia' && (() => {
              const cfg = PROD_CFG['carnes_limpias'] ?? DEFAULT_CFG;
              const items = stockProd.filter((s: any) => s.categoria === 'carnes_limpias');
              const total = items.reduce((sum: number, s: any) => sum + (parseFloat(s.cantidad) || 0), 0);
              return (
                <>
                  {/* Totalizador */}
                  <div className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border} flex items-center gap-4`}>
                    <span className="text-4xl">🔪</span>
                    <div>
                      <p className={`text-xs font-black uppercase ${cfg.color}`}>Stock total de carne limpia</p>
                      <p className={`text-4xl font-black ${cfg.color}`}>
                        {total.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')} <span className="text-lg opacity-60">kg</span>
                      </p>
                      <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{items.length} cortes</p>
                    </div>
                  </div>

                  {/* Grid de cortes — separado en individuales y blends */}
                  {(() => {
                    const individuales = items.filter((i: any) => !i.producto.startsWith('Blend'));
                    const blends = items.filter((i: any) => i.producto.startsWith('Blend'));
                    const renderCard = (item: any) => (
                      <div key={item.id}
                        onClick={() => { setSelectedProdItem(item); setAlertaUmbral(String(item.alerta_umbral ?? '')); setAlertaDias(String(item.alerta_dias ?? '')); setCargaQty(''); setCargaMotivo('Producción manual'); setProdTab('historial'); }}
                        className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${item.producto.startsWith('Blend') ? 'border-blue-500/40' : cfg.border}`}>
                        <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                        <p className={`text-3xl font-black ${parseFloat(item.cantidad) === 0 ? 'text-slate-600' : item.producto.startsWith('Blend') ? 'text-blue-400' : cfg.color}`}>
                          {parseFloat(item.cantidad).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">kg</p>
                        {parseFloat(item.cantidad) === 0 && <p className="text-[10px] text-slate-600 font-black mt-1">SIN STOCK</p>}
                        {item.ultima_prod && (
                          <p className="text-xs text-slate-600 mt-2">
                            {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    );
                    return (
                      <>
                        {/* Cortes individuales */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                          <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                            <h2 className={`font-black text-sm uppercase ${cfg.color}`}>🔪 Carne Limpia — por corte</h2>
                            <span className="text-xs text-slate-500">{individuales.length} cortes</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                            {individuales.length === 0 ? (
                              <div className="col-span-4 text-center py-8 text-slate-600">
                                <p className="text-3xl mb-2">🔪</p>
                                <p className="font-bold">Sin carne limpia en stock</p>
                              </div>
                            ) : individuales.map(renderCard)}
                          </div>
                        </div>

                        {/* Blends */}
                        {blends.length > 0 && (
                          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl overflow-hidden">
                            <div className="px-6 py-3 border-b border-blue-500/20 flex items-center justify-between bg-blue-500/10">
                              <h2 className="font-black text-sm uppercase text-blue-400">🍔 Blends</h2>
                              <span className="text-xs text-slate-500">{blends.length} blend{blends.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                              {blends.map(renderCard)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              );
            })()}

            {/* ── SUB-TAB PRODUCCIÓN (sin carne limpia) ── */}
            {stockSubTab === 'produccion' && (
              <>
                {/* Totales dinámicos — excluye carnes_limpias */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {prodCats.filter(cat => cat !== 'carnes_limpias').map(cat => {
                    const cfg = PROD_CFG[cat] ?? DEFAULT_CFG;
                    const catItems = stockProd.filter((s: any) => s.categoria === cat);
                    const total = catItems.reduce((sum: number, s: any) => sum + (parseFloat(s.cantidad) || 0), 0);
                    const units = [...new Set(catItems.map((s: any) => s.unidad))];
                    const unit = units.length === 1 ? units[0] : 'u';
                    return (
                      <div key={cat} onClick={() => document.getElementById(`prodcat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 active:scale-95 transition-all ${cfg.bg} ${cfg.border}`}>
                        <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
                        <p className={`text-3xl font-black ${cfg.color}`}>
                          {total % 1 === 0 ? total : total.toFixed(2).replace('.', ',')}
                          <span className="text-sm font-bold opacity-60 ml-1">{unit}</span>
                        </p>
                        <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
                      </div>
                    );
                  })}
                </div>

                {/* Detalle por categoría — excluye carnes_limpias */}
                {prodCats.filter(cat => cat !== 'carnes_limpias').map(cat => {
                  const cfg = PROD_CFG[cat] ?? DEFAULT_CFG;
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} id={`prodcat-${cat}`} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden scroll-mt-4">
                      <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                        <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                        <span className="text-xs text-slate-500">{catItems.length} items</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                        {catItems.map((item: any) => (
                          <div key={item.id} onClick={() => { setSelectedProdItem(item); setAlertaUmbral(String(item.alerta_umbral ?? '')); setAlertaDias(String(item.alerta_dias ?? '')); setCargaQty(''); setCargaMotivo('Producción manual'); setProdTab('historial'); }}
                            className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${cfg.border}`}>
                            <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                            <p className={`text-3xl font-black ${item.cantidad === 0 ? 'text-slate-600' : cfg.color}`}>
                              {item.unidad === 'kg' || item.unidad === 'lt'
                                ? item.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                                : item.cantidad}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                            {item.alerta_umbral > 0 && (
                              <p className="text-[10px] text-amber-400/70 font-black mt-1">🔔 alerta &lt;{item.alerta_umbral}{item.unidad}</p>
                            )}
                            {item.cantidad === 0 && <p className="text-[10px] text-slate-600 font-black mt-1">SIN STOCK</p>}
                            {item.ultima_prod && (
                              <p className="text-xs text-slate-600 mt-2">
                                {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {stockProd.length === 0 && (
                  <div className="text-center py-16 text-slate-600">
                    <p className="text-4xl mb-4">🍔</p>
                    <p className="font-bold text-lg">No hay stock de producción todavía</p>
                  </div>
                )}
              </>
            )}


          {/* ── MODAL ALERTAS DE PRODUCCIÓN ── */}
          {selectedProdItem && (() => {
            const cfg = PROD_CFG[selectedProdItem.categoria] ?? DEFAULT_CFG;

            const handleSaveAlerta = async () => {
              setSavingAlerta(true);
              await supabase.from('stock_produccion').update({
                alerta_umbral: parseFloat(alertaUmbral) || null,
                alerta_dias:   parseInt(alertaDias)     || null,
              }).eq('id', selectedProdItem.id);
              await fetchMovements();
              setSavingAlerta(false);
              setSelectedProdItem(null);
            };

            const tieneAlerta = selectedProdItem.alerta_umbral > 0;

            const descuentos = parseFloat(cargaQty) > 0
              ? calcularDescuentos(selectedProdItem.producto, parseFloat(cargaQty.replace(',','.')))
              : [];

            const handleCargarStock = async () => {
              const qty = parseFloat(cargaQty.replace(',', '.'));
              if (!qty || qty <= 0) return;
              setSavingCarga(true);
              const newQty = parseFloat((Number(selectedProdItem.cantidad) + qty).toFixed(3));

              // 1. Sumar al stock producción
              await supabase.from('stock_produccion').update({
                cantidad: newQty,
                ultima_prod: new Date().toISOString(),
              }).eq('id', selectedProdItem.id);
              await supabase.from('stock_movements').insert({
                nombre: selectedProdItem.producto,
                categoria: selectedProdItem.categoria,
                tipo: 'ingreso',
                cantidad: qty,
                unidad: selectedProdItem.unidad,
                motivo: cargaMotivo,
                operador: 'Admin',
                fecha: new Date().toISOString(),
              });

              // 2. Descontar materias primas automáticamente
              for (const d of descuentos) {
                if (d.tabla === 'stock_produccion') {
                  const { data: sp } = await supabase.from('stock_produccion')
                    .select('id, cantidad').ilike('producto', d.nombre).maybeSingle();
                  if (sp) {
                    const newCant = parseFloat((Number(sp.cantidad) - d.cantidad).toFixed(3));
                    await supabase.from('stock_produccion').update({ cantidad: newCant, ultima_prod: new Date().toISOString() }).eq('id', sp.id);
                    await supabase.from('stock_movements').insert({
                      nombre: d.nombre, categoria: selectedProdItem.categoria,
                      tipo: 'egreso', cantidad: d.cantidad, unidad: d.unidad,
                      motivo: `Descuento automático por carga manual de ${selectedProdItem.producto}`,
                      operador: 'Admin', fecha: new Date().toISOString(),
                    });
                  }
                } else {
                  const { data: st } = await supabase.from('stock')
                    .select('id, cantidad').ilike('nombre', d.nombre).maybeSingle();
                  if (st) {
                    const newCant = parseFloat((Number(st.cantidad) - d.cantidad).toFixed(3));
                    await supabase.from('stock').update({ cantidad: newCant, fecha_actualizacion: new Date().toISOString().slice(0,10) }).eq('id', st.id);
                    await supabase.from('stock_movements').insert({
                      nombre: d.nombre,
                      tipo: 'egreso', cantidad: d.cantidad, unidad: d.unidad,
                      motivo: `Descuento automático por carga manual de ${selectedProdItem.producto}`,
                      operador: 'Admin', fecha: new Date().toISOString(),
                    });
                  }
                }
              }

              await fetchMovements();
              setSavingCarga(false);
              setSelectedProdItem(null);
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                onClick={() => setSelectedProdItem(null)}>
                <div className={`bg-slate-900 border-2 ${cfg.border} rounded-2xl w-full max-w-md shadow-2xl`}
                  onClick={e => e.stopPropagation()}>

                  {/* Header */}
                  <div className={`px-6 py-4 rounded-t-2xl border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                    <div>
                      <p className={`text-xs font-black uppercase ${cfg.color}`}>{cfg.emoji} {selectedProdItem.categoria}</p>
                      <h2 className="font-black text-white text-lg leading-tight">{selectedProdItem.producto}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-2xl font-black ${cfg.color}`}>
                          {selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt'
                            ? selectedProdItem.cantidad.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
                            : selectedProdItem.cantidad}
                        </p>
                        <p className="text-xs text-slate-500">{selectedProdItem.unidad} en stock</p>
                      </div>
                      <button
                        onClick={() => { setEditandoProdStock(v => !v); setProdStockValor(String(selectedProdItem.cantidad)); }}
                        className="px-3 py-1.5 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all">
                        ✏️ Corregir stock
                      </button>
                      <button onClick={() => { setSelectedProdItem(null); setEditandoProdStock(false); }} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Corrección directa de stock */}
                  {editandoProdStock && (
                    <div className="px-5 py-4 border-b border-amber-500/30 bg-amber-500/10">
                      <p className="text-xs font-black text-amber-400 uppercase mb-2">⚠️ Corregir stock directamente</p>
                      <p className="text-xs text-slate-400 mb-2">
                        Ingresá en <strong className="text-white">{selectedProdItem.unidad}</strong>.
                        {selectedProdItem.unidad === 'kg' ? ' Si tenés 8 kg, escribí 8 (no 8000).' : ''}
                      </p>
                      {(() => {
                        const val = parseFloat(String(prodStockValor).replace(',','.')) || 0;
                        const actual = parseFloat(selectedProdItem.cantidad) || 0;
                        const isKg = selectedProdItem.unidad === 'kg';
                        const warnGramos = isKg && val > 500 && !overrideProdWarn;
                        const sugerirKg = (isKg && val > 500) ? parseFloat((val / 1000).toFixed(3)) : null;
                        const warnMucho = !warnGramos && isKg && val > actual * 10 && actual > 0 && !overrideProdWarn;
                        const guardarProdFn = async () => {
                          const nuevoValor = parseFloat(String(prodStockValor).replace(',', '.'));
                          if (isNaN(nuevoValor) || savingProdStockRef.current) return;
                          savingProdStockRef.current = true;
                          setSavingProdStock(true);
                          const diff = nuevoValor - selectedProdItem.cantidad;
                          await supabase.from('stock_produccion').update({ cantidad: nuevoValor, ultima_prod: new Date().toISOString() }).eq('id', selectedProdItem.id);
                          if (Math.abs(diff) > 0) {
                            await supabase.from('stock_movements').insert({
                              nombre: selectedProdItem.producto, categoria: selectedProdItem.categoria,
                              tipo: diff >= 0 ? 'ingreso' : 'egreso', cantidad: Math.abs(parseFloat(diff.toFixed(3))),
                              unidad: selectedProdItem.unidad,
                              motivo: `Corrección directa (${selectedProdItem.cantidad} → ${nuevoValor})`,
                              operador: 'Admin', fecha: new Date().toISOString(),
                            });
                          }
                          setSavingProdStock(false); savingProdStockRef.current = false;
                          setEditandoProdStock(false); setOverrideProdWarn(false);
                          setSelectedProdItem((prev: any) => prev ? { ...prev, cantidad: nuevoValor } : null);
                          await fetchMovements();
                        };
                        return (<>
                          <div className="flex gap-2 items-center">
                            <input type="number" inputMode="decimal" step="0.001"
                              value={prodStockValor} onChange={e => { setProdStockValor(e.target.value); setOverrideProdWarn(false); }}
                              className={`flex-1 bg-slate-800 border-2 text-white rounded-xl px-4 py-2.5 text-xl font-black text-center outline-none
                                ${warnGramos || warnMucho ? 'border-red-500' : 'border-amber-500'}`} />
                            <span className="text-slate-400 font-bold">{selectedProdItem.unidad}</span>
                            <button
                              onClick={guardarProdFn}
                              disabled={savingProdStock || prodStockValor === '' || warnGramos || warnMucho}
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl text-sm disabled:opacity-50">
                              {savingProdStock ? '...' : '✓'} Guardar
                            </button>
                            <button onClick={() => { setEditandoProdStock(false); setOverrideProdWarn(false); }}
                              className="px-3 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
                          </div>
                          {warnGramos && (
                            <div className="mt-2 bg-red-900/40 border border-red-500 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-black text-red-300">⛔ ¿Pusiste gramos en vez de kg?</p>
                                <p className="text-xs text-red-400">{val} gr = {sugerirKg} kg</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                {sugerirKg && (
                                  <button onClick={() => { setProdStockValor(String(sugerirKg)); setOverrideProdWarn(false); }}
                                    className="px-3 py-1.5 bg-amber-500 text-slate-900 font-black text-xs rounded-lg">
                                    Usar {sugerirKg} kg
                                  </button>
                                )}
                                <button onClick={() => setOverrideProdWarn(true)}
                                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-black text-xs rounded-lg">
                                  Sí, es correcto
                                </button>
                              </div>
                            </div>
                          )}
                          {warnMucho && !warnGramos && (
                            <div className="mt-2 bg-red-900/40 border border-red-500 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-black text-red-300">⚠️ {val} kg es {Math.round(val/actual)}x más que el actual ({actual} kg). ¿Está bien?</p>
                              <button onClick={() => setOverrideProdWarn(true)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xs rounded-lg shrink-0">
                                Sí, guardar igual
                              </button>
                            </div>
                          )}
                          {prodStockValor !== '' && val !== actual && !warnGramos && !warnMucho && (
                            <p className="text-xs text-slate-400 mt-2">
                              Actual: <span className="text-white font-bold">{actual}</span>{' → '}
                              <span className={`font-black ${val > actual ? 'text-green-400' : 'text-red-400'}`}>
                                {prodStockValor} {selectedProdItem.unidad}
                              </span>
                            </p>
                          )}
                        </>);
                      })()}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex border-b border-slate-800">
                    {([
                      { id: 'historial', label: '📋 Historial' },
                      { id: 'carga',     label: '📦 Cargar Stock' },
                      { id: 'alerta',    label: '🔔 Alerta' },
                    ] as const).map(t => (
                      <button key={t.id} onClick={() => setProdTab(t.id)}
                        className={`flex-1 py-3 text-sm font-black transition-all
                          ${prodTab === t.id ? 'text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-5">

                    {/* ── TAB CARGA ── */}
                    {prodTab === 'carga' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                            Cantidad a agregar ({selectedProdItem.unidad})
                          </label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCargaQty(v => String(Math.max(0, parseFloat(v||'0') - (selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? 0.5 : 1))))}
                              className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-black text-lg transition-all">−</button>
                            <input
                              type="number" min="0" step={selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '0.5' : '1'}
                              value={cargaQty}
                              onChange={e => setCargaQty(e.target.value)}
                              placeholder="0"
                              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg font-black text-center outline-none focus:border-white/40"
                            />
                            <button onClick={() => setCargaQty(v => String(parseFloat(v||'0') + (selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? 0.5 : 1)))}
                              className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-black text-lg transition-all">+</button>
                            <span className="text-slate-400 text-sm font-bold w-8">{selectedProdItem.unidad}</span>
                          </div>
                          {cargaQty && parseFloat(cargaQty) > 0 && (
                            <p className="text-xs text-slate-500 mt-1.5">
                              Stock actual: <span className="text-white font-bold">{selectedProdItem.cantidad}</span> → nuevo: <span className={`font-black ${cfg.color}`}>{parseFloat((Number(selectedProdItem.cantidad) + parseFloat(cargaQty.replace(',','.'))).toFixed(3))} {selectedProdItem.unidad}</span>
                            </p>
                          )}
                        </div>

                        {/* Preview de descuentos automáticos */}
                        {descuentos.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 space-y-2">
                            <p className="text-xs font-black text-red-400 uppercase">📉 Se descuenta automáticamente:</p>
                            {descuentos.map((d, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">{d.tabla === 'stock' ? '📦 Admin' : '🍳 Producción'}</span>
                                  <span className="text-sm font-bold text-white">{d.nombre}</span>
                                </div>
                                <span className="text-sm font-black text-red-400">−{d.cantidad} {d.unidad}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {cargaQty && parseFloat(cargaQty) > 0 && descuentos.length === 0 && (
                          <p className="text-xs text-slate-600 italic">Sin descuento automático de materias primas para este producto.</p>
                        )}

                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Motivo</label>
                          <div className="flex flex-wrap gap-2">
                            {['Producción manual', 'Corrección de stock', 'Ingreso externo', 'Sobrante de turno'].map(m => (
                              <button key={m} onClick={() => setCargaMotivo(m)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                                  ${cargaMotivo === m ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleCargarStock}
                          disabled={savingCarga || !cargaQty || parseFloat(cargaQty) <= 0}
                          className={`w-full py-3 rounded-xl font-black text-sm transition-all
                            ${savingCarga || !cargaQty || parseFloat(cargaQty) <= 0
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              : `${cfg.bg} border ${cfg.border} ${cfg.color} hover:opacity-80`}`}>
                          {savingCarga ? 'Guardando...' : `📦 Cargar ${cargaQty || '0'} ${selectedProdItem.unidad}`}
                        </button>

                        {selectedProdItem.ultima_prod && (
                          <p className="text-center text-xs text-slate-600">
                            Última producción: {new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')} a las {new Date(selectedProdItem.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── TAB ALERTA ── */}
                    {prodTab === 'alerta' && <>

                    {/* Estado actual de la alerta */}
                    {tieneAlerta ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xl">🔔</span>
                        <div>
                          <p className="text-amber-400 font-black text-sm">Alerta activa</p>
                          <p className="text-slate-400 text-xs">
                            Avisa cuando quedan menos de <span className="text-white font-bold">{selectedProdItem.alerta_umbral} {selectedProdItem.unidad}</span>
                            {selectedProdItem.alerta_dias > 0 && (
                              <> · con <span className="text-white font-bold">{selectedProdItem.alerta_dias} día{selectedProdItem.alerta_dias !== 1 ? 's' : ''}</span> de anticipación</>
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xl">🔕</span>
                        <p className="text-slate-500 text-sm">Sin alerta configurada — completá los campos para activarla</p>
                      </div>
                    )}

                    {/* Campos editables */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                          Avisar cuando quedan menos de ({selectedProdItem.unidad})
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={alertaUmbral}
                            onChange={e => setAlertaUmbral(e.target.value)}
                            placeholder={`ej: ${selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '2' : '10'}`}
                            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500/60"
                          />
                          <span className="text-slate-400 text-sm font-bold">{selectedProdItem.unidad}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">
                          Cuando el stock baje de este número, te mandamos una push
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
                          Días de anticipación en el aviso
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="7"
                            step="1"
                            value={alertaDias}
                            onChange={e => setAlertaDias(e.target.value)}
                            placeholder="ej: 1"
                            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-amber-500/60"
                          />
                          <span className="text-slate-400 text-sm font-bold">días</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">
                          0 = avisar que producís hoy · 1 = mañana · etc.
                        </p>
                      </div>
                    </div>

                    {/* Ejemplos rápidos */}
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase mb-2">Presets rápidos</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Hoy urgente',  umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '1' : '5',  dias: '0' },
                          { label: '1 día antes',  umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '2' : '10', dias: '1' },
                          { label: '2 días antes', umbral: selectedProdItem.unidad === 'kg' || selectedProdItem.unidad === 'lt' ? '3' : '20', dias: '2' },
                        ].map(p => (
                          <button key={p.label}
                            onClick={() => { setAlertaUmbral(p.umbral); setAlertaDias(p.dias); }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-slate-300 font-bold transition-all">
                            {p.label}
                          </button>
                        ))}
                        {tieneAlerta && (
                          <button
                            onClick={() => { setAlertaUmbral('0'); setAlertaDias('0'); }}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-400 font-bold transition-all">
                            🔕 Desactivar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botón guardar */}
                    <button
                      onClick={handleSaveAlerta}
                      disabled={savingAlerta || (!alertaUmbral && !alertaDias)}
                      className={`w-full py-3 rounded-xl font-black text-sm transition-all
                        ${savingAlerta || (!alertaUmbral && !alertaDias)
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}>
                      {savingAlerta ? 'Guardando...' : '🔔 Guardar alerta'}
                    </button>

                    {selectedProdItem.ultima_prod && (
                      <p className="text-center text-xs text-slate-600">
                        Última producción: {new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')} a las {new Date(selectedProdItem.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    </>}

                    {/* ── TAB HISTORIAL ── */}
                    {prodTab === 'historial' && (() => {
                      const prodMovs = itemProdMovsFetched;
                      const totalIngreso = prodMovs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.cantidad), 0);
                      const totalEgreso  = prodMovs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.cantidad), 0);
                      return (
                        <div className="space-y-4">
                          {/* Resumen */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                              <p className="text-xs text-green-400 font-bold mb-1">↑ Ingresos</p>
                              <p className="text-lg font-black text-green-400">{totalIngreso.toFixed(2)} {selectedProdItem.unidad}</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                              <p className="text-xs text-red-400 font-bold mb-1">↓ Egresos</p>
                              <p className="text-lg font-black text-red-400">{totalEgreso.toFixed(2)} {selectedProdItem.unidad}</p>
                            </div>
                            <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                              <p className="text-xs text-slate-400 font-bold mb-1">Stock actual</p>
                              <p className="text-lg font-black text-white">{parseFloat(selectedProdItem.cantidad).toFixed(2)} {selectedProdItem.unidad}</p>
                            </div>
                          </div>

                          {prodMovs.length === 0 ? (
                            <div className="text-center py-8 text-slate-600">
                              <p className="text-2xl mb-2">📋</p>
                              <p className="font-bold text-sm">Sin movimientos registrados</p>
                              <p className="text-xs mt-1">Los movimientos anteriores al sistema no se muestran aquí</p>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-[280px] overflow-y-auto">
                              {prodMovs.map((m, i) => (
                                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all">
                                  <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0
                                    ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {m.tipo === 'ingreso' ? '↑' : '↓'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300 truncate" title={m.motivo ?? ''}>{m.motivo ?? '—'}</p>
                                    <p className="text-[10px] text-slate-600">{m.operador ?? '—'} · {new Date(m.fecha).toLocaleDateString('es-AR')} {new Date(m.fecha).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}</p>
                                  </div>
                                  <span className={`font-black text-sm shrink-0 ${m.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                                    {m.tipo === 'ingreso' ? '+' : '−'}{Number(m.cantidad).toFixed(m.unidad === 'u' ? 0 : 2)} {m.unidad}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* corrección: usar el botón "Corregir stock" del header */}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── MODAL HISTORIAL + UMBRALES DE STOCK ── */}
          {selectedStockItem && (() => {
            const itemMovements = itemMovsFetched;

            const handleEditMovement = async () => {
              if (!editingMovement) return;
              setSavingMovement(true);
              const newQty = parseFloat(String(editMovQty).replace(',', '.'));
              const diff = newQty - editingMovement.cantidad;
              // Update movement record
              await supabase.from('stock_movements').update({
                cantidad: newQty,
                motivo: (editMovMotivo.trim() || editingMovement.motivo) + ' [editado]',
              }).eq('id', editingMovement.id);
              // Fix stock quantity
              if (diff !== 0) {
                const stockDiff = editingMovement.tipo === 'ingreso' ? diff : -diff;
                const newStockQty = parseFloat((Number(selectedStockItem.cantidad) + stockDiff).toFixed(3));
                await supabase.from('stock').update({
                  cantidad: newStockQty,
                  fecha_actualizacion: new Date().toISOString().slice(0, 10),
                }).eq('id', selectedStockItem.id);
              }
              setSavingMovement(false);
              setEditingMovement(null);
              await Promise.all([fetchMovements(), fetchItemMovs(selectedStockItem.nombre)]);
            };

            const handleDeleteMovement = async (m: any) => {
              setSavingMovement(true);
              // Revertir el efecto en stock
              const revert = m.tipo === 'ingreso' ? -m.cantidad : m.cantidad;
              const newStockQty = parseFloat((Number(selectedStockItem.cantidad) + revert).toFixed(3));
              await supabase.from('stock').update({
                cantidad: newStockQty,
                fecha_actualizacion: new Date().toISOString().slice(0, 10),
              }).eq('id', selectedStockItem.id);
              await supabase.from('stock_movements').delete().eq('id', m.id);
              setSavingMovement(false);
              setDeleteMovConfirm(null);
              await Promise.all([fetchMovements(), fetchItemMovs(selectedStockItem.nombre)]);
            };

            const handleSaveUmbrales = async () => {
              setSavingUmbrales(true);
              await supabase.from('stock').update({
                stock_minimo:  parseFloat(umbralMinimo)  || 0,
                stock_medio:   parseFloat(umbralMedio)   || 0,
                stock_critico: parseFloat(umbralCritico) || 0,
              }).eq('id', selectedStockItem.id);
              await fetchMovements();
              setSavingUmbrales(false);
              setEditingUmbrales(false);
            };

            const handleSaveMiAlerta = async () => {
              if (!user) return;
              setSavingMiAlerta(true);
              await supabase.from('user_stock_alertas').upsert({
                user_id:  user.id,
                stock_id: selectedStockItem.id,
                critico:  parseFloat(miCritico) || null,
                medio:    parseFloat(miMedio)   || null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,stock_id' });
              setMiAlertaActual({ critico: parseFloat(miCritico)||null, medio: parseFloat(miMedio)||null });
              setSavingMiAlerta(false);
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                onClick={() => { setSelectedStockItem(null); setEditingUmbrales(false); }}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl"
                  onClick={e => e.stopPropagation()}>

                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                      <h2 className="font-black text-white text-lg">{selectedStockItem.nombre}</h2>
                      <p className="text-slate-400 text-xs">{selectedStockItem.categoria} · {selectedStockItem.unidad}</p>
                      {selectedStockItem.fecha_vencimiento && (() => {
                        const [d,m,y] = selectedStockItem.fecha_vencimiento.split('/');
                        const vd = y && m && d ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null;
                        const esVencido = vd ? vd < new Date().toISOString().slice(0,10) : false;
                        return (
                          <p className={`text-xs font-black mt-0.5 ${esVencido ? 'text-orange-400' : 'text-slate-500'}`}>
                            {esVencido ? '⚠️ VENCIDO' : '📅 Vence'}: {selectedStockItem.fecha_vencimiento}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">
                          {selectedStockItem.unidad === 'kg' || selectedStockItem.unidad === 'lt'
                            ? selectedStockItem.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
                            : selectedStockItem.cantidad}
                        </p>
                        <p className="text-xs text-slate-500">{selectedStockItem.unidad} en stock</p>
                      </div>
                      <button
                        onClick={() => { setEditandoMatStock(v => !v); setMatStockValor(String(selectedStockItem.cantidad)); setEditandoUnidad(false); }}
                        className="px-3 py-1.5 text-xs font-black bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-all">
                        ✏️ Corregir stock
                      </button>
                      <button
                        onClick={() => { setEditandoUnidad(v => !v); setNuevaUnidad(selectedStockItem.unidad); setNuevaCantidadUnidad(String(selectedStockItem.cantidad)); setResponsableUnidad(''); setEditandoMatStock(false); }}
                        className="px-3 py-1.5 text-xs font-black bg-blue-700 hover:bg-blue-600 text-blue-200 rounded-xl transition-all">
                        📐 Cambiar unidad
                      </button>
                      <button onClick={() => { setSelectedStockItem(null); setEditingUmbrales(false); setEditandoMatStock(false); }}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Panel cambio de unidad */}
                    {editandoUnidad && (
                      <div className="bg-blue-500/10 border-2 border-blue-500/40 rounded-2xl px-5 py-4 space-y-4">
                        <p className="text-xs font-black text-blue-400 uppercase">📐 Cambiar unidad de medida</p>
                        <p className="text-xs text-slate-400">
                          Unidad actual: <span className="font-black text-white">{selectedStockItem.unidad}</span> · Cantidad: <span className="font-black text-white">{selectedStockItem.cantidad}</span>
                        </p>

                        {/* Nueva unidad */}
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Nueva unidad</label>
                          <div className="flex gap-2">
                            {(['kg', 'u', 'lt'] as const).map(u => (
                              <button key={u} onClick={() => setNuevaUnidad(u)}
                                className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all border-2
                                  ${nuevaUnidad === u ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                {u === 'kg' ? '⚖️ kg' : u === 'u' ? '🔢 Unidades' : '💧 lt'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Nueva cantidad */}
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
                            Cantidad en la nueva unidad
                            {nuevaUnidad !== selectedStockItem.unidad && (
                              <span className="text-blue-400 normal-case font-normal ml-2">
                                (ajustá si el número no tiene sentido en {nuevaUnidad})
                              </span>
                            )}
                          </label>
                          <input type="number" inputMode="decimal" step="0.001"
                            value={nuevaCantidadUnidad}
                            onChange={e => setNuevaCantidadUnidad(e.target.value)}
                            className="w-full bg-slate-800 border-2 border-blue-500/50 text-white rounded-xl px-4 py-2.5 text-xl font-black text-center outline-none focus:border-blue-400" />
                        </div>

                        {/* Responsable — obligatorio */}
                        <div>
                          <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
                            Nombre de quien hace el cambio <span className="text-red-400">*</span>
                          </label>
                          <input type="text"
                            value={responsableUnidad}
                            onChange={e => setResponsableUnidad(e.target.value)}
                            placeholder="ej: Julian, Romina..."
                            className={`w-full bg-slate-800 border-2 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition-colors
                              ${!responsableUnidad.trim() ? 'border-red-500/50' : 'border-green-500/50 focus:border-green-400'}`} />
                          {!responsableUnidad.trim() && (
                            <p className="text-xs text-red-400 mt-1">⚠️ El nombre es obligatorio para registrar el cambio</p>
                          )}
                        </div>

                        {/* Preview del cambio */}
                        {nuevaUnidad && nuevaCantidadUnidad && responsableUnidad.trim() && (
                          <div className="bg-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                            <p className="font-black text-slate-300 uppercase">Se va a registrar:</p>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Producto</span>
                              <span className="text-white font-bold">{selectedStockItem.nombre}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Unidad</span>
                              <span className="text-white font-bold">{selectedStockItem.unidad} → <span className="text-blue-400">{nuevaUnidad}</span></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cantidad</span>
                              <span className="text-white font-bold">{selectedStockItem.cantidad} → <span className="text-blue-400">{nuevaCantidadUnidad}</span></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Responsable</span>
                              <span className="text-blue-400 font-bold">{responsableUnidad}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (!responsableUnidad.trim() || savingUnidad) return;
                              const cantNum = parseFloat(nuevaCantidadUnidad.replace(',', '.'));
                              if (isNaN(cantNum)) return;
                              setSavingUnidad(true);
                              // Actualizar en stock
                              await supabase.from('stock').update({
                                unidad: nuevaUnidad,
                                cantidad: cantNum,
                                fecha_actualizacion: new Date().toISOString().slice(0, 10),
                              }).eq('id', selectedStockItem.id);
                              // Registrar en historial
                              await supabase.from('stock_movements').insert({
                                stock_id: selectedStockItem.id,
                                nombre: selectedStockItem.nombre,
                                categoria: selectedStockItem.categoria,
                                tipo: 'ingreso',
                                cantidad: cantNum,
                                unidad: nuevaUnidad,
                                motivo: `CAMBIO DE UNIDAD: ${selectedStockItem.unidad} → ${nuevaUnidad} | Cantidad: ${selectedStockItem.cantidad} → ${cantNum} | Responsable: ${responsableUnidad.trim()}`,
                                operador: responsableUnidad.trim(),
                                fecha: new Date().toISOString(),
                              });
                              setSavingUnidad(false);
                              setEditandoUnidad(false);
                              setSelectedStockItem((prev: any) => prev ? { ...prev, unidad: nuevaUnidad, cantidad: cantNum } : null);
                              await fetchMovements();
                            }}
                            disabled={savingUnidad || !responsableUnidad.trim() || !nuevaCantidadUnidad || nuevaUnidad === selectedStockItem.unidad}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm disabled:opacity-40 transition-colors">
                            {savingUnidad ? 'Guardando...' : '✓ Confirmar cambio'}
                          </button>
                          <button onClick={() => setEditandoUnidad(false)}
                            className="px-4 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {editandoMatStock && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
                        <p className="text-xs font-black text-amber-400 uppercase mb-2">⚠️ Corregir stock directamente</p>
                        <p className="text-xs text-slate-400 mb-2">
                          Ingresá en <strong className="text-white">{selectedStockItem.unidad}</strong>.
                          {selectedStockItem.unidad === 'kg' ? ' Si tenés 8 kg, escribí 8 (no 8000).' : ''}
                        </p>
                        {(() => {
                          const val = parseFloat(String(matStockValor).replace(',','.')) || 0;
                          const actual = parseFloat(selectedStockItem.cantidad) || 0;
                          const isKg = selectedStockItem.unidad === 'kg';
                          const warnGramos = isKg && val > 1000 && !overrideWarn;
                          const sugerirKg = (isKg && val > 1000) ? parseFloat((val / 1000).toFixed(3)) : null;
                          const warnMucho = !warnGramos && isKg && val > actual * 10 && actual > 0 && !overrideWarn;
                          const guardarFn = async () => {
                            const nuevoValor = parseFloat(String(matStockValor).replace(',', '.'));
                            if (isNaN(nuevoValor) || savingMatStockRef.current) return;
                            savingMatStockRef.current = true;
                            setSavingMatStock(true);
                            const diff = nuevoValor - selectedStockItem.cantidad;
                            await supabase.from('stock').update({ cantidad: nuevoValor, fecha_actualizacion: new Date().toISOString().slice(0, 10) }).eq('id', selectedStockItem.id);
                            if (Math.abs(diff) > 0) {
                              await supabase.from('stock_movements').insert({
                                stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre, categoria: selectedStockItem.categoria,
                                tipo: diff >= 0 ? 'ingreso' : 'egreso', cantidad: Math.abs(parseFloat(diff.toFixed(3))),
                                unidad: selectedStockItem.unidad,
                                motivo: `Corrección directa (${selectedStockItem.cantidad} → ${nuevoValor})`,
                                operador: 'Admin', fecha: new Date().toISOString(),
                              });
                            }
                            setSavingMatStock(false); savingMatStockRef.current = false;
                            setEditandoMatStock(false); setOverrideWarn(false);
                            setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: nuevoValor } : null);
                            await fetchMovements();
                          };
                          return (<>
                            <div className="flex gap-2 items-center">
                              <input type="number" inputMode="decimal" step="0.001"
                                value={matStockValor} onChange={e => { setMatStockValor(e.target.value); setOverrideWarn(false); }}
                                className={`flex-1 bg-slate-800 border-2 text-white rounded-xl px-4 py-2.5 text-xl font-black text-center outline-none
                                  ${warnGramos || warnMucho ? 'border-red-500' : 'border-amber-500'}`} />
                              <span className="text-slate-400 font-bold">{selectedStockItem.unidad}</span>
                              <button
                                onClick={guardarFn}
                                disabled={savingMatStock || matStockValor === '' || warnGramos || warnMucho}
                                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl text-sm disabled:opacity-50">
                                {savingMatStock ? '...' : '✓'} Guardar
                              </button>
                              <button onClick={() => { setEditandoMatStock(false); setOverrideWarn(false); }}
                                className="px-3 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
                            </div>
                            {warnGramos && (
                              <div className="mt-2 bg-red-900/40 border border-red-500 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-black text-red-300">⛔ ¿Pusiste gramos en vez de kg?</p>
                                  <p className="text-xs text-red-400">{val} gr = {sugerirKg} kg</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  {sugerirKg && (
                                    <button onClick={() => { setMatStockValor(String(sugerirKg)); setOverrideWarn(false); }}
                                      className="px-3 py-1.5 bg-amber-500 text-slate-900 font-black text-xs rounded-lg">
                                      Usar {sugerirKg} kg
                                    </button>
                                  )}
                                  <button onClick={() => setOverrideWarn(true)}
                                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-black text-xs rounded-lg">
                                    Sí, es correcto
                                  </button>
                                </div>
                              </div>
                            )}
                            {warnMucho && !warnGramos && (
                              <div className="mt-2 bg-red-900/40 border border-red-500 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-black text-red-300">⚠️ {val} kg es {Math.round(val/actual)}x más que el actual ({actual} kg). ¿Está bien?</p>
                                <button onClick={() => setOverrideWarn(true)}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xs rounded-lg shrink-0">
                                  Sí, guardar igual
                                </button>
                              </div>
                            )}
                            {matStockValor !== '' && val !== actual && !warnGramos && !warnMucho && (
                              <p className="text-xs text-slate-400 mt-2">
                                Actual: <span className="text-white font-bold">{actual} {selectedStockItem.unidad}</span>{' → '}
                                <span className={`font-black ${val > actual ? 'text-green-400' : 'text-red-400'}`}>
                                  {matStockValor} {selectedStockItem.unidad}
                                </span>
                              </p>
                            )}
                          </>);
                        })()}
                      </div>
                    )}

                    {/* Umbrales */}
                    <div className="bg-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-400 uppercase">⚠️ Alertas de stock</p>
                        <button onClick={() => {
                          setEditingUmbrales(!editingUmbrales);
                          setUmbralCritico(String(selectedStockItem.stock_critico ?? ''));
                          setUmbralMedio(String(selectedStockItem.stock_medio ?? ''));
                          setUmbralMinimo(String(selectedStockItem.stock_minimo ?? ''));
                        }} className="text-xs text-blue-400 hover:text-blue-300 font-bold">
                          {editingUmbrales ? 'Cancelar' : '✏️ Editar'}
                        </button>
                      </div>

                      {editingUmbrales ? (
                        <div className="space-y-3">
                          {[
                            { label: '🚨 Crítico (comprar YA)', key: 'critico', val: umbralCritico, set: setUmbralCritico },
                            { label: '⚠️ Medio (comprar pronto)', key: 'medio', val: umbralMedio, set: setUmbralMedio },
                            { label: '📦 Mínimo (stock saludable)', key: 'minimo', val: umbralMinimo, set: setUmbralMinimo },
                          ].map(({ label, key, val, set }) => (
                            <div key={key} className="flex items-center gap-3">
                              <label className="text-xs text-slate-400 w-44 shrink-0">{label}</label>
                              <input type="number" value={val} onChange={e => set(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                              <span className="text-xs text-slate-500">{selectedStockItem.unidad}</span>
                            </div>
                          ))}
                          <button onClick={handleSaveUmbrales} disabled={savingUmbrales}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50 mt-2">
                            {savingUmbrales ? 'Guardando...' : '✓ Guardar umbrales'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 text-center">
                          {[
                            { label: '🚨 Crítico', val: selectedStockItem.stock_critico ?? '—', color: 'text-red-400' },
                            { label: '⚠️ Medio',   val: selectedStockItem.stock_medio   ?? '—', color: 'text-amber-400' },
                            { label: '📦 Mínimo',  val: selectedStockItem.stock_minimo  ?? '—', color: 'text-green-400' },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="bg-slate-700/50 rounded-xl p-3">
                              <p className={`text-lg font-black ${color}`}>{val} <span className="text-xs text-slate-500">{typeof val === 'number' ? selectedStockItem.unidad : ''}</span></p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* TABS INGRESO / EGRESO */}
                    <div className="rounded-2xl overflow-hidden border border-slate-700">
                      {/* Tab selector */}
                      <div className="flex">
                        <button onClick={() => { setModalTab('ingreso'); setModoLatas(false); setLatasCount(''); setLatasPeso(''); }}
                          className={`flex-1 py-3 text-sm font-black transition-all flex items-center justify-center gap-2
                            ${modalTab === 'ingreso' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                          📦 Ingreso / Factura
                        </button>
                        <button onClick={() => setModalTab('egreso')}
                          className={`flex-1 py-3 text-sm font-black transition-all flex items-center justify-center gap-2
                            ${modalTab === 'egreso' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                          📤 Egreso / Uso
                        </button>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* ── INGRESO ── */}
                        {modalTab === 'ingreso' && (<>
                          {/* Toggle modo latas */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-400 uppercase">Modo de carga</span>
                            <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
                              <button onClick={() => { setModoLatas(false); setLatasCount(''); setLatasPeso(''); setAderezoCounts({}); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${!modoLatas ? 'bg-white text-slate-900' : 'text-slate-400'}`}>
                                Peso directo
                              </button>
                              <button onClick={() => { setModoLatas(true); setAderezoCounts({}); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-black transition-all ${modoLatas ? 'bg-white text-slate-900' : 'text-slate-400'}`}>
                                📦 Por paquetes/unidades
                              </button>
                            </div>
                          </div>

                          {/* MODO PAQUETES */}
                          {modoLatas && (<div className="space-y-3">
                            {/* Formatos doypack si el producto los tiene */}
                            {getFormatosDoypack(selectedStockItem.nombre) ? (
                              <div className="space-y-2">
                                <p className="text-xs font-black text-slate-400 uppercase">¿Cuántas unidades de cada formato?</p>
                                {getFormatosDoypack(selectedStockItem.nombre)!.map(f => (
                                  <div key={f.label} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
                                    <div>
                                      <span className="text-white font-black text-sm">{f.label}</span>
                                      <span className="text-slate-500 text-xs ml-2">{f.kg} kg c/u</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => setAderezoCounts(p => ({ ...p, [f.label]: Math.max(0, (p[f.label] ?? 0) - 1) }))} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black text-lg flex items-center justify-center">−</button>
                                      <span className="text-white font-black text-lg w-8 text-center">{aderezoCounts[f.label] ?? 0}</span>
                                      <button onClick={() => setAderezoCounts(p => ({ ...p, [f.label]: (p[f.label] ?? 0) + 1 }))} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black text-lg flex items-center justify-center">+</button>
                                      <span className="text-xs text-slate-500 w-12 text-right">{((aderezoCounts[f.label] ?? 0) * f.kg).toFixed(3)} kg</span>
                                    </div>
                                  </div>
                                ))}
                                {parseFloat(getFormatosDoypack(selectedStockItem.nombre)!.reduce((s, f) => s + f.kg * (aderezoCounts[f.label] ?? 0), 0).toFixed(3)) > 0 && (
                                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-slate-400">Total a ingresar</span>
                                      <span className="font-black text-green-400">{getFormatosDoypack(selectedStockItem.nombre)!.reduce((s, f) => s + f.kg * (aderezoCounts[f.label] ?? 0), 0).toFixed(3)} kg</span>
                                    </div>
                                    <div className="flex justify-between border-t border-green-500/20 pt-1 mt-1">
                                      <span className="text-slate-400">Nuevo stock:</span>
                                      <span className="font-black text-white">{parseFloat((selectedStockItem.cantidad + getFormatosDoypack(selectedStockItem.nombre)!.reduce((s, f) => s + f.kg * (aderezoCounts[f.label] ?? 0), 0)).toFixed(3))} {selectedStockItem.unidad}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad de unidades</label>
                                  <input type="number" min="1" step="1" value={latasCount} onChange={e => setLatasCount(e.target.value)} placeholder="ej: 6" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Peso por unidad ({selectedStockItem.unidad === 'kg' ? 'gr o kg' : selectedStockItem.unidad})</label>
                                  <input type="number" min="0" step="0.001" value={latasPeso} onChange={e => setLatasPeso(e.target.value)} placeholder={selectedStockItem.unidad === 'kg' ? 'ej: 750 (gr)' : 'ej: 1'} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500" />
                                </div>
                                {latasCount && latasPeso && parseFloat(latasCount) > 0 && parseFloat(latasPeso) > 0 && (
                                  <div className="col-span-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-slate-400">{latasCount} × {latasPeso}{selectedStockItem.unidad === 'kg' && parseFloat(latasPeso) > 10 ? ' gr' : ' ' + selectedStockItem.unidad}</span>
                                      <span className="font-black text-green-400">= {parseFloat((parseFloat(latasCount) * (selectedStockItem.unidad === 'kg' && parseFloat(latasPeso) > 10 ? parseFloat(latasPeso)/1000 : parseFloat(latasPeso))).toFixed(3))} {selectedStockItem.unidad}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-green-500/20 pt-1 mt-1">
                                      <span className="text-slate-400">Nuevo stock:</span>
                                      <span className="font-black text-white">{parseFloat((selectedStockItem.cantidad + parseFloat(latasCount) * (selectedStockItem.unidad === 'kg' && parseFloat(latasPeso) > 10 ? parseFloat(latasPeso)/1000 : parseFloat(latasPeso))).toFixed(3))} {selectedStockItem.unidad}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor (opcional)</label>
                              <input type="text" value={facturaProveedor} onChange={e => setFacturaProveedor(e.target.value)} placeholder="Nombre proveedor" className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                            </div>
                            <button
                              onClick={async () => {
                                const fmt = getFormatosDoypack(selectedStockItem.nombre);
                                let qty = 0; let motivo = '';
                                if (fmt) {
                                  qty = parseFloat(fmt.reduce((s, f) => s + f.kg * (aderezoCounts[f.label] ?? 0), 0).toFixed(3));
                                  const det = fmt.filter(f => (aderezoCounts[f.label] ?? 0) > 0).map(f => `${aderezoCounts[f.label]}×${f.label}`).join(', ');
                                  motivo = `Factura${facturaProveedor ? ' - ' + facturaProveedor : ''} (${det})`;
                                } else {
                                  const nn = parseFloat(latasCount); const pp = parseFloat(latasPeso);
                                  if (!nn || !pp) return;
                                  const pk = selectedStockItem.unidad === 'kg' && pp > 10 ? pp / 1000 : pp;
                                  qty = parseFloat((nn * pk).toFixed(3));
                                  motivo = `Factura${facturaProveedor ? ' - ' + facturaProveedor : ''} (${Math.round(nn)}u × ${pp}${selectedStockItem.unidad === 'kg' && pp > 10 ? 'gr' : selectedStockItem.unidad})`;
                                }
                                if (!qty || qty <= 0 || savingFacturaRef.current) return;
                                savingFacturaRef.current = true; setSavingFactura(true);
                                const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) + qty).toFixed(3));
                                await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0,10) }).eq('id', selectedStockItem.id);
                                await supabase.from('stock_movements').insert({ stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre, categoria: selectedStockItem.categoria, tipo: 'ingreso', cantidad: qty, unidad: selectedStockItem.unidad, motivo, operador: 'Admin', fecha: new Date().toISOString() });
                                setLatasCount(''); setLatasPeso(''); setFacturaProveedor(''); setAderezoCounts({});
                                setSavingFactura(false); savingFacturaRef.current = false;
                                await fetchMovements();
                                setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                              }}
                              disabled={savingFactura || (() => { const fmt = getFormatosDoypack(selectedStockItem.nombre); return fmt ? fmt.reduce((s,f) => s+(aderezoCounts[f.label]??0),0)===0 : !latasCount||!latasPeso||parseFloat(latasCount)<=0||parseFloat(latasPeso)<=0; })()}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                              {savingFactura ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Confirmar ingreso por paquetes
                            </button>
                          </div>)}
                          {/* MODO PESO DIRECTO */}
                          {!modoLatas && (<>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad</label>
                                <input type="number" step="0.001" min="0"
                                  value={facturaQty} onChange={e => setFacturaQty(e.target.value)}
                                  placeholder="0.000"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-green-500" />
                              </div>
                              <div className="flex items-end">
                                <span className="text-slate-400 font-bold pb-2.5">{selectedStockItem.unidad}</span>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Proveedor (opcional)</label>
                                <input type="text" value={facturaProveedor} onChange={e => setFacturaProveedor(e.target.value)}
                                  placeholder="Nombre proveedor"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500" />
                              </div>
                            </div>
                            {selectedStockItem.cantidad < 0 && facturaQty && parseFloat(facturaQty) > 0 && (
                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm space-y-1">
                                <div className="flex justify-between"><span className="text-slate-400">Stock negativo:</span><span className="font-black text-red-400">{selectedStockItem.cantidad.toFixed(3)} {selectedStockItem.unidad}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Factura ingresa:</span><span className="font-black text-green-400">+{parseFloat(facturaQty).toFixed(3)} {selectedStockItem.unidad}</span></div>
                                <div className="flex justify-between border-t border-amber-500/20 pt-1 mt-1">
                                  <span className="font-black text-slate-300">Stock final:</span>
                                  <span className={`font-black ${selectedStockItem.cantidad + parseFloat(facturaQty) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(selectedStockItem.cantidad + parseFloat(facturaQty)).toFixed(3)} {selectedStockItem.unidad}
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Lote / Remito</label>
                                <input type="text" value={facturaLote} onChange={e => setFacturaLote(e.target.value)}
                                  placeholder="Ej: R-12345"
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Vencimiento</label>
                                <input type="date" value={facturaVence} onChange={e => setFacturaVence(e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Comentario / Faltante</label>
                              <input type="text" value={facturaComentario} onChange={e => setFacturaComentario(e.target.value)}
                                placeholder="Ej: Faltaron 2kg en la entrega..."
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-green-500" />
                            </div>
                            <button
                              onClick={async () => {
                                const qty = parseFloat(facturaQty);
                                if (!qty || qty <= 0 || savingFacturaRef.current) return;
                                savingFacturaRef.current = true;
                                setSavingFactura(true);
                                const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) + qty).toFixed(3));
                                await supabase.from('stock').update({
                                  cantidad: newQty,
                                  fecha_actualizacion: new Date().toISOString().slice(0, 10),
                                  ...(facturaVence ? { fecha_vencimiento: new Date(facturaVence).toLocaleDateString('es-AR') } : {}),
                                }).eq('id', selectedStockItem.id);
                                await supabase.from('stock_movements').insert({
                                  stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre,
                                  categoria: selectedStockItem.categoria, tipo: 'ingreso',
                                  cantidad: qty, unidad: selectedStockItem.unidad,
                                  motivo: ['Factura', facturaProveedor, facturaLote, facturaComentario].filter(Boolean).join(' - '),
                                  operador: 'Admin', fecha: new Date().toISOString(),
                                });
                                setFacturaQty(''); setFacturaProveedor(''); setFacturaLote(''); setFacturaComentario(''); setFacturaVence('');
                                setSavingFactura(false); savingFacturaRef.current = false;
                                await fetchMovements();
                                setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                              }}
                              disabled={!facturaQty || parseFloat(facturaQty) <= 0 || savingFactura}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                              {savingFactura ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Confirmar ingreso
                            </button>
                          </>)}
                        </>)}

                        {/* ── EGRESO ── */}
                        {modalTab === 'egreso' && (<>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cantidad a descontar</label>
                            <div className="flex gap-2 items-center">
                              <input type="number" step="0.001" min="0"
                                value={egresoQty} onChange={e => setEgresoQty(e.target.value)}
                                placeholder="0.000"
                                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-lg font-black text-center outline-none focus:border-red-500" />
                              <span className="text-slate-400 font-bold">{selectedStockItem.unidad}</span>
                            </div>
                            {egresoQty && parseFloat(egresoQty) > 0 && (
                              <p className="text-xs text-slate-500 mt-1.5">
                                Stock actual: <span className="text-white font-bold">{selectedStockItem.cantidad} {selectedStockItem.unidad}</span>
                                {' → '}
                                <span className={`font-black ${selectedStockItem.cantidad - parseFloat(egresoQty) < 0 ? 'text-red-400' : 'text-white'}`}>
                                  {parseFloat((selectedStockItem.cantidad - parseFloat(egresoQty)).toFixed(3))} {selectedStockItem.unidad}
                                </span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] text-red-400 uppercase font-bold mb-1 block">
                              Motivo / Comentario <span className="text-red-500">*</span> (obligatorio)
                            </label>
                            <input type="text"
                              value={egresoComentario} onChange={e => setEgresoComentario(e.target.value)}
                              placeholder="ej: Uso en servicio, merma, corrección..."
                              className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors
                                ${!egresoComentario.trim() && egresoQty ? 'border-red-500 focus:border-red-400' : 'border-slate-700 focus:border-red-500'}`} />
                            {!egresoComentario.trim() && egresoQty && (
                              <p className="text-xs text-red-400 mt-1">⚠️ El comentario es obligatorio para registrar un egreso</p>
                            )}
                          </div>

                          {/* Presets rápidos */}
                          <div className="flex flex-wrap gap-2">
                            {['Uso en servicio', 'Merma / vencimiento', 'Corrección de stock', 'Rotura / accidente'].map(m => (
                              <button key={m} onClick={() => setEgresoComentario(m)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                                  ${egresoComentario === m ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                                {m}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={async () => {
                              const qty = parseFloat(egresoQty);
                              if (!qty || qty <= 0 || !egresoComentario.trim() || savingEgresoRef.current) return;
                              savingEgresoRef.current = true;
                              setSavingEgreso(true);
                              const newQty = parseFloat(((selectedStockItem.cantidad ?? 0) - qty).toFixed(3));
                              await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) }).eq('id', selectedStockItem.id);
                              await supabase.from('stock_movements').insert({
                                stock_id: selectedStockItem.id, nombre: selectedStockItem.nombre,
                                categoria: selectedStockItem.categoria, tipo: 'egreso',
                                cantidad: qty, unidad: selectedStockItem.unidad,
                                motivo: egresoComentario.trim(),
                                operador: 'Admin', fecha: new Date().toISOString(),
                              });
                              setEgresoQty(''); setEgresoComentario('');
                              setSavingEgreso(false); savingEgresoRef.current = false;
                              await fetchMovements();
                              setSelectedStockItem((prev: any) => prev ? { ...prev, cantidad: newQty } : null);
                            }}
                            disabled={!egresoQty || parseFloat(egresoQty) <= 0 || !egresoComentario.trim() || savingEgreso}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                            {savingEgreso ? <RefreshCw size={14} className="animate-spin" /> : '📤'} Confirmar egreso
                          </button>
                        </>)}
                      </div>
                    </div>

                    {/* ── MIS ALERTAS PERSONALES ── */}
                    <div className="border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-400 uppercase">🔔 Mis alertas personales</p>
                        {miAlertaActual && (miAlertaActual.critico || miAlertaActual.medio) && (
                          <span className="text-[10px] text-amber-400 font-black bg-amber-500/10 px-2 py-0.5 rounded-full">ACTIVA</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Umbrales propios — solo vos recibís estas notificaciones</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {[
                          { label: '🚨 Crítico personal', val: miCritico, set: setMiCritico, color: 'focus:border-red-500' },
                          { label: '⚠️ Medio personal',   val: miMedio,   set: setMiMedio,   color: 'focus:border-amber-500' },
                        ].map(({ label, val, set, color }) => (
                          <div key={label}>
                            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">{label}</label>
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" step="0.5" value={val}
                                onChange={e => set(e.target.value)}
                                placeholder="—"
                                className={`flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none ${color}`} />
                              <span className="text-slate-500 text-xs">{selectedStockItem.unidad}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveMiAlerta}
                          disabled={savingMiAlerta || (!miCritico && !miMedio)}
                          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all
                            ${savingMiAlerta || (!miCritico && !miMedio)
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}>
                          {savingMiAlerta ? 'Guardando...' : '🔔 Guardar mis alertas'}
                        </button>
                        {(miAlertaActual?.critico || miAlertaActual?.medio) && (
                          <button onClick={async () => {
                            if (!user) return;
                            await supabase.from('user_stock_alertas').delete()
                              .eq('user_id', user.id).eq('stock_id', selectedStockItem.id);
                            setMiCritico(''); setMiMedio(''); setMiAlertaActual(null);
                          }} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all">
                            🔕 Quitar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Historial de movimientos */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black text-slate-400 uppercase">
                          Historial de movimientos
                          {loadingItemMovs
                            ? <span className="text-slate-600 font-normal ml-2">cargando...</span>
                            : <span className="ml-2 text-indigo-400">{itemMovements.length} registros</span>}
                        </p>
                        <button onClick={() => fetchItemMovs(selectedStockItem.nombre)}
                          className="text-slate-600 hover:text-slate-400 transition-colors" title="Actualizar">
                          <RefreshCw size={13} className={loadingItemMovs ? 'animate-spin' : ''}/>
                        </button>
                      </div>
                      {itemMovements.length === 0 ? (
                        <div className="text-center py-8 text-slate-600">
                          <p className="font-bold">Sin movimientos registrados</p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                            <tr>
                              <th className="px-4 py-2.5 text-left">Fecha</th>
                              <th className="px-4 py-2.5 text-left">Tipo</th>
                              <th className="px-4 py-2.5 text-left">Motivo</th>
                              <th className="px-4 py-2.5 text-right">Cantidad</th>
                              <th className="px-4 py-2.5 text-center w-16"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {itemMovements.map(m => (
                              <tr key={m.id} className="hover:bg-slate-800/40">
                                <td className="px-4 py-2.5 text-slate-400 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {m.tipo}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 text-xs truncate max-w-[120px]">{m.motivo ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right font-black text-white">
                                  {m.tipo === 'egreso' ? '-' : '+'}{m.cantidad} {m.unidad}
                                </td>
                                <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                  <div className="flex gap-1 justify-center">
                                    <button onClick={() => { setEditingMovement(m); setEditMovQty(String(m.cantidad)); setEditMovMotivo(m.motivo ?? ''); }}
                                      className="px-2 py-1 bg-slate-700 hover:bg-blue-600 rounded-lg text-slate-300 hover:text-white text-xs font-bold transition-all" title="Editar">
                                      ✏️
                                    </button>
                                    <button onClick={() => setDeleteMovConfirm(m)}
                                      className="px-2 py-1 bg-slate-700 hover:bg-red-600 rounded-lg text-slate-400 hover:text-white transition-all" title="Eliminar y revertir">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

      {showNuevoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowNuevoModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-white text-lg">➕ Nuevo producto</h3>
            <p className="text-xs text-slate-400">Categoría: <span className="font-black text-white">{nuevoCat}</span></p>
            <div>
              <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Nombre del producto</label>
              <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                placeholder="ej: ACEITE GIRASOL"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Cantidad inicial</label>
                <input type="number" value={nuevoCantidad} onChange={e => setNuevaCantidad(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Unidad</label>
                <select value={nuevoUnidad} onChange={e => setNuevoUnidad(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500">
                  <option value="kg">kg</option>
                  <option value="u">u (unidades)</option>
                  <option value="lt">lt</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowNuevoModal(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm">Cancelar</button>
              <button disabled={!nuevoNombre.trim() || savingNuevo}
                onClick={async () => {
                  if (!nuevoNombre.trim() || savingNuevo) return;
                  setSavingNuevo(true);
                  const qty = parseFloat(nuevoCantidad) || 0;
                  await supabase.from('stock').insert({
                    nombre: nuevoNombre.trim().toUpperCase(), categoria: nuevoCat,
                    cantidad: qty, unidad: nuevoUnidad,
                    fecha_actualizacion: new Date().toISOString().slice(0, 10),
                  });
                  if (qty > 0) {
                    await supabase.from('stock_movements').insert({
                      nombre: nuevoNombre.trim().toUpperCase(), categoria: nuevoCat,
                      tipo: 'ingreso', cantidad: qty, unidad: nuevoUnidad,
                      motivo: 'Alta de producto', operador: 'Admin', fecha: new Date().toISOString(),
                    });
                  }
                  setSavingNuevo(false); setShowNuevoModal(false); await fetchMovements();
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl text-sm disabled:opacity-40">
                {savingNuevo ? 'Guardando...' : '✓ Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEntryModal && (
        <StockEntryModal onClose={() => setShowEntryModal(false)} />
      )}

    </div>
  );
}
