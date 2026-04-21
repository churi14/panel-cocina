"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import LoginPage from './auth/LoginPage';
import AdminDashboard from './admin/AdminDashboard';
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
import KitchenTour from './components/KitchenTour';
import type { Ingredient, Recipe, ProductionRecord, Supplier, ActiveProduction, ButcheryProduction, ButcheryRecord } from './types';
import { loadProduccionesActivas, cleanOldProducciones } from './components/butchery/produccionPersistence';
import ProduccionDelDia from './components/butchery/ProduccionDelDia';
import TareasPanel from './components/butchery/TareasPanel';
import { supabase } from './supabase';

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

  // Hook ANTES de cualquier return
  const [verCocina, setVerCocina] = React.useState(false);

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
    return <AdminDashboardWrapper onIrACocina={() => setVerCocina(true)} />;
  }

  return <Dashboard onIrAAdmin={perfil.rol === 'admin' || perfil.rol === 'administrativa' ? () => setVerCocina(false) : undefined} />;
}

// ── Dashboard real — todos los hooks acá, sin conditionals antes ──────────────
function Dashboard({ onIrAAdmin }: { onIrAAdmin?: () => void }) {
  const { signOut, perfil } = useAuth();
  // --- ESTADOS DE MODALES ---
  const [isStockModalOpen, setIsStockModalOpen] = useState(false); 
  const [isStockViewOpen, setIsStockViewOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false); 
  const [isButcheryModalOpen, setIsButcheryModalOpen] = useState(false);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);
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
    // ── SALSAS DE PACK — Fraccionar en potes ────────────────────────────────
    // stockOrigen: 'stock' = materias primas | 'stock_produccion' = producido en cocina
    {
      id: 'frac_mayonesa', name: 'Mayonesa', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock', stockNombre: 'MAYONESA',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'MAYONESA', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_ketchup', name: 'Ketchup', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock', stockNombre: 'KETCHUP',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'KETCHUP', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_barbacoa', name: 'Barbacoa', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock', stockNombre: 'BARBACOA',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'BARBACOA', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_savora', name: 'Savora', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock', stockNombre: 'SAVORA',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'SAVORA', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_mostaza', name: 'Mostaza', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock', stockNombre: 'MOSTAZA',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'MOSTAZA', qty: 1, unit: 'kg' }],
    },
    // ── SALSAS DE RECETA — fraccionar lo producido ───────────────────────────
    {
      id: 'frac_salsa_club', name: 'Salsa Club', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock_produccion', stockNombre: 'SALSA CLUB',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'SALSA CLUB', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_mayo_mila', name: 'Mayo Mila', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock_produccion', stockNombre: 'MAYO MILA',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'MAYO MILA', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_salsa_spread', name: 'Salsa Spread', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock_produccion', stockNombre: 'SALSA SPREAD',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'SALSA SPREAD', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_salsa_crema', name: 'Salsa Crema', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock_produccion', stockNombre: 'SALSA CREMA',
      potes: [
        { id: 'crema',   label: 'Pote Crema', capacidadKg: 0.530 },
        { id: 'grande',  label: 'Grande',     capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano',    capacidadKg: 0.850 },
      ],
      ingredients: [{ name: 'SALSA CREMA', qty: 1, unit: 'kg' }],
    },
    {
      id: 'frac_mayo_ajo', name: 'Mayo con Ajo', category: 'Fraccionar',
      baseYield: 0, unit: 'potes', recipeType: 'fraccion',
      stockOrigen: 'stock_produccion', stockNombre: 'SALSA DE AJO',
      potes: [
        { id: 'grande',  label: 'Grande',  capacidadKg: 1.100 },
        { id: 'mediano', label: 'Mediano', capacidadKg: 0.850 },
        { id: 'chico',   label: 'Chico',   capacidadKg: 0.480 },
      ],
      ingredients: [{ name: 'SALSA DE AJO', qty: 1, unit: 'kg' }],
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
    // ── VERDURAS PRODUCIDAS ───────────────────────────────────────────────────
    // recipeType: 'verdura' → modal usa flujo peso bruto → neto (sin checklist)
    {
      id: 'verdura_tomate_rodajas', name: 'Tomate cortado', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_lechuga', name: 'Lechuga preparada', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_cebolla_brunoise', name: 'Cebolla brunoise', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_cebolla_rodajas', name: 'Cebolla en rodajas', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_morron', name: 'Morrón preparado', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_ajo', name: 'Ajo preparado', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },
    {
      id: 'verdura_verdeo', name: 'Cebolla de verdeo', category: 'Verduras',
      baseYield: 0, unit: 'kg', recipeType: 'verdura', ingredients: []
    },

    // ── MILANESAS ─────────────────────────────────────────────────────────────
    {
      id: 'menjunje_carne', name: 'Menjunje Milanesa Carne', category: 'Milanesas',
      baseYield: 10, unit: 'kg base', warning: 'Requiere 24hs Frío',
      ingredients: [
        { name: 'Milanesa - Carne (stock prod.)', qty: 10, unit: 'kg' },
        { name: 'Huevo',    qty: 42,    unit: 'u'  },
        { name: 'Ajo',      qty: 0.125, unit: 'kg' },
        { name: 'Limón',    qty: 0.175, unit: 'u'  },
        { name: 'Sal',      qty: 0.195, unit: 'kg' },
        { name: 'Perejil',  qty: 0.150, unit: 'kg' },
      ]
    },
    {
      id: 'menjunje_pollo', name: 'Menjunje Milanesa Pollo', category: 'Milanesas',
      baseYield: 10, unit: 'kg base', warning: 'Requiere 24hs Frío',
      ingredients: [
        { name: 'Milanesa - Pollo (stock prod.)', qty: 10, unit: 'kg' },
        { name: 'Huevo',    qty: 42,    unit: 'u'  },
        { name: 'Ajo',      qty: 0.125, unit: 'kg' },
        { name: 'Limón',    qty: 0.175, unit: 'u'  },
        { name: 'Sal',      qty: 0.195, unit: 'kg' },
        { name: 'Perejil',  qty: 0.150, unit: 'kg' },
      ]
    },
    // ── FIAMBRES ─────────────────────────────────────────────────────────────
    { id: 'fiambre_jamon',          name: 'Jamón',                category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_panceta',        name: 'Panceta',              category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_cheddar_feta',   name: 'Cheddar en Feta',      category: 'Fiambres', baseYield: 0, unit: 'u',  recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_cheddar_liq',    name: 'Cheddar Líquido',      category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_cheddar_burger', name: 'Cheddar para Burger',  category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_provoleta',      name: 'Provoleta',            category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_muzza_sanguch',    name: 'Queso Muzza para Sanguchería', category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_muzza_mila',       name: 'Queso Muzza para Mila al Plato', category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },
    { id: 'fiambre_tybo',           name: 'Queso Tybo',           category: 'Fiambres', baseYield: 0, unit: 'kg', recipeType: 'fiambre', ingredients: [] },

    // ── EMPANADO MILANESA ─────────────────────────────────────────────────────
    { id: 'empanado_carne', name: 'Empanado Milanesa Carne', category: 'Milanesas', baseYield: 0, unit: 'kg',
      recipeType: 'empanado' as any,
      warning: 'Usa menjunje de carne del stock de producción',
      ingredients: [] },
    { id: 'empanado_pollo', name: 'Empanado Milanesa Pollo', category: 'Milanesas', baseYield: 0, unit: 'kg',
      recipeType: 'empanado' as any,
      warning: 'Usa menjunje de pollo del stock de producción',
      ingredients: [] },

    // ── SALSAS PRODUCCIÓN ─────────────────────────────────────────────────────
    { id: 'salsa_club',    name: 'Salsa Club',    category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',       qty: 100, unit: '%', isBase: true },
        { name: 'Ajo',            qty: 2,   unit: '%' },
        { name: 'Jugo de limón',  qty: 1,   unit: '%' },
        { name: 'Sal',            qty: 0.5, unit: '%' },
      ]},
    { id: 'salsa_mayo_mila', name: 'Mayo Mila', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',  qty: 100, unit: '%', isBase: true },
        { name: 'Ajo',       qty: 1.5, unit: '%' },
        { name: 'Limón',     qty: 1,   unit: '%' },
      ]},
    { id: 'salsa_spread', name: 'Salsa Spread', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',  qty: 100, unit: '%', isBase: true },
        { name: 'Ketchup',   qty: 20,  unit: '%' },
        { name: 'Mostaza',   qty: 5,   unit: '%' },
        { name: 'Sal',       qty: 0.3, unit: '%' },
      ]},
    { id: 'salsa_crema', name: 'Salsa Crema', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Queso crema', qty: 100, unit: '%', isBase: true },
        { name: 'Ajo',         qty: 2,   unit: '%' },
        { name: 'Sal',         qty: 0.5, unit: '%' },
      ]},
    { id: 'salsa_ajo', name: 'Salsa de Ajo', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Mayonesa',  qty: 100, unit: '%', isBase: true },
        { name: 'Ajo',       qty: 8,   unit: '%' },
      ]},
    { id: 'salsa_criolla', name: 'Criolla', category: 'Salsas', baseYield: 0, unit: 'kg', recipeType: 'percent',
      ingredients: [
        { name: 'Tomate',    qty: 100, unit: '%', isBase: true },
        { name: 'Cebolla',   qty: 40,  unit: '%' },
        { name: 'Morrón',    qty: 20,  unit: '%' },
        { name: 'Aceite',    qty: 10,  unit: '%' },
        { name: 'Vinagre',   qty: 5,   unit: '%' },
        { name: 'Sal',       qty: 1,   unit: '%' },
        { name: 'Orégano',   qty: 0.5, unit: '%' },
      ]},

    // ── PREP ─────────────────────────────────────────────────────────────────
  ]);

  const [activeProductions, setActiveProductions] = useState<import('./types').ActiveProductionItem[]>([]);

  // Cargar producciones activas desde Supabase al iniciar
  useEffect(() => {
    // Carnicería
    loadProduccionesActivas().then(prods => {
      if (prods.length > 0) {
        setButcheryProductions(prods);
      }
    });
    cleanOldProducciones();

    // ✅ Cocina: restaurar producciones activas al hacer F5
    supabase
      .from('cocina_produccion_activa')
      .select('*')
      .eq('status', 'running')
      .then(({ data }) => {
        if (data && data.length > 0) {
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
    <div className="flex h-screen bg-[#f3f4f6] p-4 font-sans text-slate-800 overflow-hidden relative">
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

          </nav>
        </div>
        <div className="mt-auto pt-6 border-t border-slate-100">
           {onIrAAdmin && (
             <button onClick={onIrAAdmin} className="flex items-center gap-3 text-slate-500 hover:text-blue-600 transition-colors w-full px-3 py-2 rounded-lg hover:bg-blue-50 mb-2">
               <Scale size={20} /> <span className="font-medium text-sm">Panel Admin</span>
             </button>
           )}
           <button id="tour-logout" onClick={signOut} className="flex items-center gap-3 text-slate-500 hover:text-red-500 transition-colors w-full px-3 py-2 rounded-lg hover:bg-red-50"><LogOut size={20} /> <span className="font-medium text-sm">Cerrar Sesión</span></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 bg-white rounded-2xl shadow-sm overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-8 py-6 flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-slate-800">Centro de Producción</h2><p className="text-slate-500 text-sm">Gestión integral de cocina, carnicería y stock.</p></div>
            <div className="flex items-center gap-3"><span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200 animate-pulse">SISTEMA ONLINE</span></div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-10 w-full">
            {activeProductions.length > 0 && <LiveProductionMonitor />}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div id="tour-card-stock-entry"><QuickActionCard title="Cargar Stock / Facturas" subtitle="Sumá mercadería al stock" icon={<Truck size={24} />} color="blue" onClick={() => setIsEntryModalOpen(true)} /></div>
                <div id="tour-card-stock-exit"><QuickActionCard title="Uso Manual / Mermas" subtitle="Descontar stock manualmente" icon={<PackageMinus size={24} />} color="orange" onClick={() => setIsStockModalOpen(true)} /></div>
                <div id="tour-card-stock-view"><QuickActionCard title="Ver Stock" subtitle="Stock actual por categoría" icon={<BarChart3 size={24} />} color="green" onClick={() => setIsStockViewOpen(true)} /></div>
            </section>
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
      {isKitchenModalOpen && <KitchenProductionModal onClose={() => setIsKitchenModalOpen(false)} activeProductions={activeProductions} setActiveProductions={setActiveProductions} recipesDB={recipesDB} setProductionHistory={setProductionHistory} operadorNombre={perfil?.nombre ?? ''} />}

      {/* ── TOUR ── */}
      <KitchenTour />

    </div>
  );

}