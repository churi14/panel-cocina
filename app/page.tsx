"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import LoginPage from './auth/LoginPage';
import AdminDashboard from './admin/AdminDashboard';
import { 
  ChefHat, Truck, BookOpen, Droplet, LogOut, Scale, Beef, 
  UtensilsCrossed, LayoutDashboard, Settings, ChevronRight,
  PackageMinus, Package, X, Carrot, Wine, Sandwich, Wheat, Soup,
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
import CamaraFrioModal from './components/CamaraFrioModal';
import { NavItem, StationCard, QuickActionCard } from './components/Uicomponents';
import KitchenTour from './components/KitchenTour';
import type { Ingredient, Recipe, ProductionRecord, Supplier, ActiveProduction, ButcheryProduction, ButcheryRecord } from './types';
import { loadProduccionesActivas, cleanOldProducciones } from './components/butchery/produccionPersistence';
import ProduccionDelDia from './components/butchery/ProduccionDelDia';
import TareasPanel from './components/butchery/TareasPanel';
import ProducidosPorUsuario from './components/butchery/ProducidosPorUsuario';
import { supabase } from './supabase';
import { useTestMode } from './components/TestModeContext';
import { FlaskConical, Snowflake } from 'lucide-react';
import MermaRapidaModal from './components/MermaRapidaModal';
import ProcedimientosModal from './components/ProcedimientosModal';
import { INITIAL_RECIPES } from './data/recipes';

// ── PWA: registrar service worker ────────────────────────────────────────────
function usePWA() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
}


// ── Auth gate — NO hooks after conditional returns ────────────────────────────
// Wrapper para AdminDashboard que provee signOut
function AdminDashboardWrapper({ onIrACocina }: { onIrACocina?: () => void }) {
  const { signOut } = useAuth();
  return <AdminDashboard onLock={signOut} onIrACocina={onIrACocina} />;
}

export default function Page() {
  usePWA();
  const { user, perfil, loading } = useAuth();

  // Hook ANTES de cualquier return — persiste en localStorage para que F5 no vuelva al admin
  const [verCocina, setVerCocina] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('view_preference') === 'cocina';
  });

  const irACocina = () => {
    localStorage.setItem('view_preference', 'cocina');
    setVerCocina(true);
  };
  const irAAdmin = () => {
    localStorage.setItem('view_preference', 'admin');
    setVerCocina(false);
  };

  // ── Spinner mientras carga la sesión ──────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ChefHat size={32} className="text-white" />
        </div>
        <div className="flex gap-1 justify-center mt-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── Sin sesión → login ────────────────────────────────────────────────────
  if (!user || !perfil) return <LoginPage />;

  // ── Renderizar según rol — sin navegación, sin reload ─────────────────────
  if ((perfil.rol === 'admin' || perfil.rol === 'administrativa') && !verCocina) {
    return <AdminDashboardWrapper onIrACocina={irACocina} />;
  }

  return <Dashboard onIrAAdmin={perfil.rol === 'admin' || perfil.rol === 'administrativa' ? irAAdmin : undefined} />;
}

// ── Dashboard real — todos los hooks acá, sin conditionals antes ──────────────
function Dashboard({ onIrAAdmin }: { onIrAAdmin?: () => void }) {
  const { signOut, perfil } = useAuth();

  // Test mode — persiste en sessionStorage para sobrevivir F5
  const [isTestMode, setIsTestMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('test_mode') === 'true';
  });

  const toggleTestMode = () => {
    if (isTestMode) {
      if (confirm('¿Salir del modo test? Los datos de prueba se van a borrar desde admin.')) {
        sessionStorage.removeItem('test_mode');
        setIsTestMode(false);
      }
    } else {
      sessionStorage.setItem('test_mode', 'true');
      setIsTestMode(true);
    }
  };
  // --- ESTADOS DE MODALES ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false); 
  const [isStockViewOpen, setIsStockViewOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false); 
  const [isButcheryModalOpen, setIsButcheryModalOpen] = useState(false);
  const [showProducidos, setShowProducidos] = useState(false);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);
  const [isCamaraOpen, setIsCamaraOpen]             = useState(false);
  const [isMermaOpen, setIsMermaOpen]               = useState(false);
  const [isProcedimientosOpen, setIsProcedimientosOpen] = useState(false);
  const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState(false);

  // --- DATOS EN MEMORIA (Base de Datos Local) ---
  
  // 1. Historial
  const [productionHistory, setProductionHistory] = useState<ProductionRecord[]>([]);
  
  // 2. Proveedores
  const [suppliersDB, setSuppliersDB] = useState<Supplier[]>([
      { id: 1, name: "Frigorífico El Toro", categories: ["Carnicería", "Fiambres"], cuit: "30-11223344-5", phone: "11-4455-6677", email: "pedidos@eltoro.com", address: "Av. Corrientes 1234", days: ["Lun", "Jue"] },
      { id: 2, name: "La Huerta del Sol", categories: ["Verduras"], cuit: "20-99887766-1", phone: "11-9876-5432", email: "ventas@huertasol.com.ar", address: "Mercado Central Nave 4", days: ["Mar", "Vie"] }
  ]);

  // 3. Recetas (Tus datos reales)
  const [recipesDB, setRecipesDB] = useState<Recipe[]>(INITIAL_RECIPES);

  const [activeProductions, setActiveProductions] = useState<import('./types').ActiveProductionItem[]>([]);

  // Cargar producciones activas desde Supabase al iniciar
  useEffect(() => {
    // Carnicería
    loadProduccionesActivas().then(prods => {
      if (prods.length > 0) setButcheryProductions(prods);
    });
    cleanOldProducciones();

    // Cocina: restaurar producciones activas al hacer F5
    const fetchCocinaActiva = () =>
      supabase.from('cocina_produccion_activa').select('*').eq('status', 'running').then(({ data }) => {
        if (data) {
          setActiveProductions(data.map((d: any) => ({
            id: d.id ?? d.start_time,
            recipeName: d.recipe_name ?? 'Producción en curso',
            recipeId: d.recipe_id ?? '',
            targetUnits: parseFloat(d.target_units),
            unit: d.unit,
            startTime: d.start_time,
            status: 'running' as const,
            operador: d.operador ?? '',
            baseKg: d.base_qty_kg ?? 0,
          })));
        }
      });

    fetchCocinaActiva();

    // ── Real-time: actualizar si otra tablet hace cambios ──────────────────
    const channelId = `cocina_rt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      // Producciones de carnicería: otra tablet inició/finalizó algo
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones_activas' }, () => {
        loadProduccionesActivas().then(prods => setButcheryProductions(prods));
      })
      // Producciones de cocina: otra tablet inició/finalizó algo
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cocina_produccion_activa' }, () => {
        fetchCocinaActiva();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      if (!activeProductions.length) return;
      const interval = setInterval(() => setElapsed(Date.now() - (activeProductions[0]?.startTime ?? Date.now())), 1000);
      return () => clearInterval(interval);
    }, []);
    if (!activeProductions.length) return null;
    return (
        <div onClick={() => setIsKitchenModalOpen(true)} className="col-span-full bg-slate-900 rounded-xl p-4 border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)] flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-all animate-in slide-in-from-top-2">
            <div className="flex items-center gap-4 flex-wrap">
              {activeProductions.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
                  <span className="text-white font-bold text-sm">{p.recipeName}</span>
                  <span className="text-green-400 font-mono text-sm">{formatTime(Date.now() - p.startTime)}</span>
                </div>
              ))}
            </div>
        </div>
    );
  };

  return (
    <div className={`flex h-screen bg-[#f3f4f6] p-4 font-sans text-slate-800 overflow-hidden relative${isTestMode ? ' pt-8' : ''}`}>
      {/* BANNER MODO TEST */}
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-400 text-slate-900 text-xs font-black text-center py-1.5 flex items-center justify-center gap-3">
          <FlaskConical size={14} />
          🧪 MODO TEST — Lo que hacés acá NO afecta el stock real
          <button onClick={toggleTestMode} className="bg-slate-900 text-amber-400 px-3 py-0.5 rounded-full text-xs font-black hover:bg-slate-700">
            Salir del test
          </button>
        </div>
      )}
      {/* SIDEBAR */}
      <aside className="w-72 bg-white rounded-2xl shadow-sm flex flex-col justify-between p-6 mr-4 transition-all hidden md:flex">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <img id="tour-logo" src="/icons/icon-cocina-192.png" alt="La Cocina" className="w-10 h-10 rounded-xl object-cover" />
            <div><h1 className="text-lg font-bold text-slate-900 leading-tight">La Cocina</h1><span className="text-xs text-slate-400 font-medium">Dark Kitchen</span></div>
          </div>
          <nav className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Principal</p>
            <NavItem icon={<LayoutDashboard size={20} />} label="Panel Control" active />
            <button id="tour-nav-recetario" onClick={() => setIsRecipeManagerOpen(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <BookOpen size={20} /> <span>Recetario</span>
            </button>
            <button onClick={() => setShowProducidos(true)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                <Package size={20} /> <span>Mis producidos</span>
            </button>

          </nav>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-100">
           {onIrAAdmin && (
             <button onClick={onIrAAdmin} className="flex items-center gap-3 text-slate-500 hover:text-blue-600 transition-colors w-full px-3 py-2 rounded-lg hover:bg-blue-50 mb-2">
               <Scale size={20} /> <span className="font-medium text-sm">Panel Admin</span>
             </button>
           )}
           <button onClick={toggleTestMode}
             className={`flex items-center gap-3 transition-colors w-full px-3 py-2 rounded-lg mb-2 text-sm font-medium
               ${isTestMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}>
             <FlaskConical size={18} />
             <span>{isTestMode ? '🧪 Salir del modo test' : 'Modo test'}</span>
           </button>
           <button id="tour-logout" onClick={signOut} className="flex items-center gap-3 text-slate-500 hover:text-red-500 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-50"><LogOut size={20} /> <span className="font-medium text-sm">Cerrar Sesión</span></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 bg-white rounded-2xl shadow-sm overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-8 py-6 flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-slate-800">Centro de Producción</h2><p className="text-slate-500 text-sm">Gestión integral de cocina, carnicería y stock.</p></div>
            <div className="flex items-center gap-3"><span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 animate-pulse">SISTEMA ONLINE</span></div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
            {activeProductions.length > 0 && <LiveProductionMonitor />}
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Producción</p>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div id="tour-card-carniceria" className={`group rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-slate-900 border-rose-500' : 'bg-white border-slate-100 hover:border-rose-200'}`}>
                    <div className="flex justify-between items-start mb-6"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-600'}`}><Beef size={28}/></div>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">{butcheryProductions.filter(p => p.status === 'step1_running').length} EN CURSO</span>}</div>
                    <h3 className={`text-xl font-bold mb-1 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'text-white' : 'text-slate-800'}`}>Carnicería</h3><p className={`text-sm font-medium mb-4 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'text-slate-400' : 'text-slate-400'}`}>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? `${butcheryProductions.filter(p => p.status === 'step1_running').map(p => p.typeName).join(', ')}` : 'Lomito, Burger y Milanesa'}</p>
                    <button onClick={() => setIsButcheryModalOpen(true)} className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-slate-900 hover:bg-rose-600 text-white'}`}>{butcheryProductions.filter(p => p.status === 'step1_running').length > 0 ? 'VER PRODUCCIONES' : 'ABRIR CARNICERÍA'} <ChevronRight size={16} /></button>
                </div>
                <div id="tour-card-cocina" className={`group rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border ${activeProductions.length > 0 ? 'bg-slate-900 border-green-500' : 'bg-white border-slate-100 hover:border-amber-200'}`}>
                    <div className="flex justify-between items-start mb-6"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${activeProductions.length > 0 ? 'bg-green-600 text-white' : 'bg-amber-100 text-amber-600'}`}><UtensilsCrossed size={28}/></div>{activeProductions.length > 0 && <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">{activeProductions.length} EN CURSO</span>}</div>
                    <h3 className={`text-xl font-bold mb-1 ${activeProductions.length > 0 ? 'text-white' : 'text-slate-800'}`}>Cocina General</h3><p className={`text-sm font-medium mb-4 ${activeProductions.length > 0 ? 'text-slate-400' : 'text-slate-400'}`}>{activeProductions.length > 0 ? activeProductions.map(p => p.recipeName).join(', ') : 'Salsas, Panes y Prep'}</p>
                    <button onClick={() => setIsKitchenModalOpen(true)} className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${activeProductions.length > 0 ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-900 hover:bg-amber-600 text-white'}`}>{'ABRIR RECETARIO'} <ChevronRight size={16} /></button>
                </div>
            </section>
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Gestión</p>
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div id="tour-card-camara" className="group rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border bg-white border-slate-100 hover:border-blue-200">
                    <div className="mb-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-blue-100 text-blue-600"><Snowflake size={22}/></div></div>
                    <h3 className="text-base font-black mb-0.5 text-slate-800">Cámara de Frío</h3>
                    <p className="text-xs font-medium mb-4 text-slate-400">Carne, Pan Kalis y Medallones</p>
                    <button onClick={() => setIsCamaraOpen(true)} className="w-full py-2.5 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 bg-slate-900 hover:bg-blue-600 text-white text-sm">ABRIR <ChevronRight size={14} /></button>
                </div>
                <div id="tour-card-stock-entry"><QuickActionCard title="Cargar Stock / Facturas" subtitle="Sumá mercadería al stock" icon={<Truck size={24} />} color="blue" onClick={() => setIsEntryModalOpen(true)} /></div>
                <div id="tour-card-merma">
                  <div onClick={() => setIsMermaOpen(true)} className="group rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border bg-white border-slate-100 hover:border-red-200 cursor-pointer">
                    <div className="mb-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-red-100 text-red-600">
                        <Trash2 size={22} />
                      </div>
                    </div>
                    <h3 className="text-base font-black mb-0.5 text-slate-800">Registrar Merma</h3>
                    <p className="text-xs font-medium mb-4 text-slate-400">Se cayó, consumo, descarte</p>
                    <div className="w-full py-2.5 font-bold rounded-xl text-sm bg-slate-900 hover:bg-red-600 text-white transition-all flex items-center justify-center gap-2">
                      REGISTRAR <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
                <div onClick={() => setIsProcedimientosOpen(true)} className="group rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border bg-white border-slate-100 hover:border-amber-200 cursor-pointer">
                  <div className="mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-amber-100 text-amber-600">
                      <BookOpen size={22} />
                    </div>
                  </div>
                  <h3 className="text-base font-black mb-0.5 text-slate-800">Procedimientos</h3>
                  <p className="text-xs font-medium mb-4 text-slate-400">Estándares del equipo</p>
                  <div className="w-full py-2.5 font-bold rounded-xl text-sm bg-slate-900 hover:bg-amber-600 text-white transition-all flex items-center justify-center gap-2">
                    VER <ChevronRight size={14} />
                  </div>
                </div>
                <div id="tour-card-stock-view"><QuickActionCard title="Ver Stock" subtitle="Stock actual por categoría" icon={<BarChart3 size={24} />} color="green" onClick={() => setIsStockViewOpen(true)} /></div>
            </section>
            </div>
            <ProduccionDelDia />
            <TareasPanel operadorActual={perfil?.nombre} />
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
      {showProducidos && perfil && (
        <ProducidosPorUsuario operadorActual={perfil.nombre} onClose={() => setShowProducidos(false)} />
      )}
      {isKitchenModalOpen && <KitchenProductionModal onClose={() => setIsKitchenModalOpen(false)} activeProductions={activeProductions} setActiveProductions={setActiveProductions} recipesDB={recipesDB} setProductionHistory={setProductionHistory} operadorNombre={perfil?.nombre ?? ''} />}
      {isCamaraOpen && <CamaraFrioModal onClose={() => setIsCamaraOpen(false)} operadorNombre={perfil?.nombre ?? ''} />}
      {isMermaOpen && <MermaRapidaModal onClose={() => setIsMermaOpen(false)} operadorNombre={perfil?.nombre ?? ''} />}
      {isProcedimientosOpen && <ProcedimientosModal onClose={() => setIsProcedimientosOpen(false)} />}

      {/* ── TOUR ── */}
      <KitchenTour />

    </div>
  );

}