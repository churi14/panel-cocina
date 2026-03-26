"use client";

import React, { useState, useEffect } from 'react';
import { 
  ChefHat, Truck, BookOpen, Droplet, LogOut, Scale, Beef, 
  UtensilsCrossed, LayoutDashboard, Settings, ChevronRight,
  PackageMinus, X, Carrot, Wine, Sandwich, Wheat, Soup,
  Plus, Trash2, Calculator, CheckCircle2, Clock, Thermometer, AlertCircle, ArrowLeft, Play, Square, CheckSquare,
  Search, Phone, MapPin, Mail, Calendar as CalendarIcon, FileText, User, Edit, List, BarChart3, Download
} from 'lucide-react';
import ButcheryModal from './components/ButcheryModal';
import StockEntryModalComponent from './components/StockEntryModal';
import StockViewModal from './components/StockViewModal';
import StockExitModal from './components/StockExitModal';
import RecipeManagerModal from './components/Recipemanagermodal';
import SuppliersModal from './components/Suppliersmodal';
import KitchenProductionModal from './components/Kitchenproductionmodal';
import { NavItem, StationCard, QuickActionCard } from './components/Uicomponents';
import type { Ingredient, Recipe, ProductionRecord, Supplier, ActiveProduction, ButcheryProduction, ButcheryRecord } from './types';

export default function Dashboard() {
  // --- ESTADOS DE MODALES ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false); 
  const [isStockViewOpen, setIsStockViewOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false); 
  const [isButcheryModalOpen, setIsButcheryModalOpen] = useState(false);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);
  const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);

  // --- DATOS EN MEMORIA (Base de Datos Local) ---
  
  // 1. Historial
  const [productionHistory, setProductionHistory] = useState<ProductionRecord[]>([]);
  
  // 2. Proveedores
  const [suppliersDB, setSuppliersDB] = useState<Supplier[]>([
      { id: 1, name: "Frigorífico El Toro", categories: ["Carnicería", "Fiambres"], cuit: "30-11223344-5", phone: "11-4455-6677", email: "pedidos@eltoro.com", address: "Av. Corrientes 1234", days: ["Lun", "Jue"] },
      { id: 2, name: "La Huerta del Sol", categories: ["Verduras"], cuit: "20-99887766-1", phone: "11-9876-5432", email: "ventas@huertasol.com.ar", address: "Mercado Central Nave 4", days: ["Mar", "Vie"] }
  ]);

  // 3. Recetas (Tus datos reales)
  const [recipesDB, setRecipesDB] = useState<Recipe[]>([
    // ── PANIFICADOS ──────────────────────────────────────────────────────────
    {
      id: 'pan_lomito', name: 'Pan de Lomito', category: 'Panificados',
      baseYield: 140, unit: 'u', recipeType: 'percent',
      ingredients: [
        { name: 'Harina 0000',        qty: 100,  unit: '%', isBase: true },
        { name: 'Levadura en polvo',  qty: 1,    unit: '%' },
        { name: 'Azúcar',             qty: 2,    unit: '%' },
        { name: 'Mejormiga',          qty: 0.5,  unit: '%' },
        { name: 'Sal',                qty: 1.25, unit: '%' },
        { name: 'Aceite',             qty: 15,   unit: '%' },
        { name: 'Agua',               qty: 53,   unit: '%' },
      ]
    },
    {
      id: 'pan_sanguchero', name: 'Pan Sanguchero', category: 'Panificados',
      baseYield: 0, unit: 'u', recipeType: 'percent',
      ingredients: [
        { name: 'Harina 0000',        qty: 100,             unit: '%', isBase: true },
        { name: 'Levadura en polvo',  qty: 0.93,            unit: '%' },
        { name: 'Azúcar',             qty: 1.87,            unit: '%' },
        { name: 'Mejormiga',          qty: 0.93,            unit: '%' },
        { name: 'Sal',                qty: 1.87,            unit: '%' },
        { name: 'Agua',               qty: 56,              unit: '%' },
      ]
    },
    // ── SALSAS ───────────────────────────────────────────────────────────────
    {
      id: 'mayo_ajo', name: 'Mayonesa de Ajo', category: 'Salsas',
      baseYield: 3, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',       qty: 100, unit: '%', isBase: true },
        { name: 'Ajo triturado', qty: 1,   unit: '%' },
      ]
    },
    {
      id: 'mayo_mila', name: 'Mayonesa de Mila', category: 'Salsas',
      baseYield: 3, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',       qty: 100,  unit: '%', isBase: true },
        { name: 'Jugo de limón', qty: 0.26, unit: '%' },
      ]
    },
    {
      id: 'salsa_spread', name: 'Salsa Spread', category: 'Salsas',
      baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa Natura', qty: 100, unit: '%', isBase: true },
        { name: 'Ketchup',         qty: 38,  unit: '%' },
        { name: 'Relish',          qty: 25,  unit: '%' },
        { name: 'Vinagre',         qty: 6,   unit: '%' },
        { name: 'Azúcar',          qty: 2.5, unit: '%' },
      ]
    },
    {
      id: 'salsa_napolitana', name: 'Salsa Napolitana', category: 'Salsas',
      baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Tomate triturado',   qty: 100,  unit: '%', isBase: true },
        { name: 'Cebolla',            qty: 25,   unit: '%' },
        { name: 'Aceite de girasol',  qty: 4.17, unit: '%' },
        { name: 'Ajo',               qty: 0.38, unit: '%' },
        { name: 'Sal',               qty: 0.42, unit: '%' },
        { name: 'Orégano',           qty: 0.33, unit: '%' },
        { name: 'Bicarbonato',       qty: 0.07, unit: '%' },
      ]
    },
    // ── PREP ─────────────────────────────────────────────────────────────────
    {
      id: 'menjunje', name: 'Menjunje Milanesa', category: 'Prep',
      baseYield: 5, unit: 'lt', warning: 'Requiere 24hs Frío',
      ingredients: [
        { name: 'Huevo', qty: 30, unit: 'u' },
        { name: 'Ajo y Perejil', qty: 0.5, unit: 'kg' },
        { name: 'Mostaza', qty: 0.2, unit: 'kg' },
      ]
    },
  ]);

  const [activeProduction, setActiveProduction] = useState<ActiveProduction>(null);

  // 4. Producciones de Carnicería (multi-producción simultánea)
  const [butcheryProductions, setButcheryProductions] = useState<ButcheryProduction[]>([]);
  const [butcheryRecords, setButcheryRecords] = useState<ButcheryRecord[]>([]);

  // Helper tiempo
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Monitor Flotante
  const LiveProductionMonitor = () => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
      if (!activeProduction) return;
      const interval = setInterval(() => setElapsed(Date.now() - activeProduction.startTime), 1000);
      return () => clearInterval(interval);
    }, []);
    if (!activeProduction) return null;
    return (
        <div onClick={() => setIsKitchenModalOpen(true)} className="col-span-full bg-slate-900 rounded-xl p-4 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)] flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-all animate-in slide-in-from-top-2">
            <div className="flex items-center gap-4"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/><div><h4 className="text-white font-bold text-sm">PRODUCCIÓN EN CURSO: {activeProduction.recipeName.toUpperCase()}</h4><p className="text-slate-400 text-xs">Objetivo: {activeProduction.targetUnits} {activeProduction.unit}</p></div></div>
            <div className="text-2xl font-mono font-bold text-green-400">{formatTime(Date.now() - activeProduction.startTime)}</div>
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#f3f4f6] p-4 font-sans text-slate-800 overflow-hidden relative">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white rounded-2xl shadow-sm flex flex-col justify-between p-6 mr-4 transition-all hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/30"><ChefHat size={24} className="text-white" /></div>
            <div><h1 className="text-lg font-bold text-slate-900 leading-tight">KitchenOS</h1><span className="text-xs text-slate-400 font-medium">v20.0 Final Fixed</span></div>
          </div>
          <nav className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Principal</p>
            <NavItem icon={<LayoutDashboard size={20} />} label="Panel Control" active />
            <button onClick={() => setIsRecipeManagerOpen(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <BookOpen size={20} /> <span>Recetario</span>
            </button>

          </nav>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-100">
           <button className="flex items-center gap-3 text-slate-500 hover:text-red-500 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-50"><LogOut size={20} /> <span className="font-medium text-sm">Cerrar Sesión</span></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 bg-white rounded-2xl shadow-sm overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-8 py-6 flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-slate-800">Centro de Producción</h2><p className="text-slate-500 text-sm">Gestión integral de cocina, carnicería y stock.</p></div>
            <div className="flex items-center gap-3"><span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 animate-pulse">SISTEMA ONLINE</span></div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-10 w-full">
            {activeProduction && <LiveProductionMonitor />}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`group rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-slate-900 border-rose-500' : 'bg-white border-slate-100 hover:border-rose-200'}`}>
                    <div className="flex justify-between items-start mb-6"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-600'}`}><Beef size={28}/></div>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">{butcheryProductions.filter(p => p.status === 'step1_running').length} EN CURSO</span>}</div>
                    <h3 className={`text-xl font-bold mb-1 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'text-white' : 'text-slate-800'}`}>Carnicería</h3><p className={`text-sm font-medium mb-4 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'text-slate-400' : 'text-slate-400'}`}>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? `${butcheryProductions.filter(p => p.status === 'step1_running').map(p => p.typeName).join(', ')}` : 'Lomito, Burger y Milanesa'}</p>
                    <button onClick={() => setIsButcheryModalOpen(true)} className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-slate-900 hover:bg-rose-600 text-white'}`}>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'VER PRODUCCIONES' : 'ABRIR CARNICERÍA'} <ChevronRight size={16} /></button>
                </div>
                <div className={`group rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${activeProduction ? 'bg-slate-900 border-green-500' : 'bg-white border-slate-100 hover:border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-6"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${activeProduction ? 'bg-green-600 text-white' : 'bg-amber-100 text-amber-600'}`}><UtensilsCrossed size={28}/></div>{activeProduction && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">EN CURSO</span>}</div>
                    <h3 className={`text-xl font-bold mb-1 ${activeProduction ? 'text-white' : 'text-slate-800'}`}>Cocina General</h3><p className={`text-sm font-medium mb-4 ${activeProduction ? 'text-slate-400' : 'text-slate-400'}`}>{activeProduction ? `Produciendo: ${activeProduction.recipeName}` : 'Salsas, Panes y Prep'}</p>
                    <button onClick={() => setIsKitchenModalOpen(true)} className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${activeProduction ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-900 hover:bg-amber-600 text-white'}`}>{activeProduction ? 'VER TIMER' : 'ABRIR RECETARIO'} <ChevronRight size={16} /></button>
                </div>
            </section>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <QuickActionCard title="Cargar Stock / Facturas" subtitle="Sumá mercadería al stock" icon={<Truck size={24} />} color="blue" onClick={() => setIsEntryModalOpen(true)} />
                <QuickActionCard title="Uso Manual / Mermas" subtitle="Descontar stock manualmente" icon={<PackageMinus size={24} />} color="orange" onClick={() => setIsStockModalOpen(true)} />
                <QuickActionCard title="Ver Stock" subtitle="Stock actual por categoría" icon={<BarChart3 size={24} />} color="green" onClick={() => setIsStockViewOpen(true)} />
            </section>
        </div>
      </main>

      {/* --- RENDERIZADO DE MODALES --- */}
      {isEntryModalOpen && <StockEntryModalComponent onClose={() => setIsEntryModalOpen(false)} />}
      {isStockModalOpen && <StockExitModal onClose={() => setIsStockModalOpen(false)} />}
      {isStockViewOpen && <StockViewModal onClose={() => setIsStockViewOpen(false)} />}
      {isButcheryModalOpen && <ButcheryModal onClose={() => setIsButcheryModalOpen(false)} butcheryProductions={butcheryProductions} setButcheryProductions={setButcheryProductions} butcheryRecords={butcheryRecords} setButcheryRecords={setButcheryRecords} />}
      
      {/* MODALES CONECTADOS A LA DB EN MEMORIA */}
      {isSuppliersModalOpen && <SuppliersModal onClose={() => setIsSuppliersModalOpen(false)} suppliersDB={suppliersDB} setSuppliersDB={setSuppliersDB} />}
      {isRecipeManagerOpen && <RecipeManagerModal onClose={() => setIsRecipeManagerOpen(false)} recipes={recipesDB} setRecipes={setRecipesDB} />}
      {isReportsModalOpen && <ReportsModal onClose={() => setIsReportsModalOpen(false)} history={productionHistory} />}
      {isKitchenModalOpen && <KitchenProductionModal onClose={() => setIsKitchenModalOpen(false)} activeProduction={activeProduction} setActiveProduction={setActiveProduction} recipesDB={recipesDB} setProductionHistory={setProductionHistory} />}

    </div>
  );
}