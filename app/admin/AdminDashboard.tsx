"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import AdminTour from '../components/AdminTour';
import {
  LogOut, Bell, Package, TrendingUp,
  RefreshCw, Activity, ChefHat, Users, CheckCircle2, Sun, Moon, AlertTriangle, FileText, Trash2, FileSpreadsheet, BookOpen,
  Menu, X, Clock, ArrowLeftRight, Calculator, Truck, ReceiptText
} from 'lucide-react';
import { Movement, Notification, diaLocal } from './types';
import TabDashboard   from './TabDashboard';
import TabMovimientos from './TabMovimientos';
import TabProduccion  from './TabProduccion';
import TabStock       from './TabStock';


import TabVentas      from './TabVentas';
import TabCostos      from './TabCostos';
import TabCompras     from './TabCompras';
import TabRegistro    from './TabRegistro';
import TabEquipo      from './TabEquipo';
import TabTareas      from './TabTareas';
import TabAuditoria   from './TabAuditoria';
import TabFichador      from './TabFichador';
import TabFactura       from './TabFactura';
import TabDesperdicios    from './TabDesperdicios';
import TabProcedimientos  from './TabProcedimientos';
import ExportModal        from './ExportModal';
import HopeSwitch         from './HopeSwitch';
import PushButton     from '../components/PushButton';
import TestModeButton from '../components/TestModeButton';
import { useAuth }    from '../AuthContext';

export default function AdminDashboard({ onLock, onIrACocina }: { onLock: () => void; onIrACocina?: () => void }) {
  const { perfil } = useAuth();
  const [movements, setMovements]               = useState<Movement[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [notifications, setNotifications]       = useState<Notification[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-theme');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    } catch { /* sin localStorage: queda el tema claro */ }
  }, []);

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('admin-theme', next);
      return next;
    });
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'movements' | 'stock' | 'factura' | 'ventas' | 'costos' | 'compras' | 'registro' | 'equipo' | 'tareas' | 'auditoria' | 'fichador' | 'desperdicios' | 'procedimientos'>('dashboard');
  const [stockSubTab, setStockSubTab] = useState<'produccion' | 'materias'>('materias');
  const [filterType, setFilterType]             = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [filterOp, setFilterOp]                 = useState('all');
  const [stock, setStock]                       = useState<any[]>([]);
  const [stockProd, setStockProd]               = useState<any[]>([]);
  const [produccionEventos, setProduccionEventos] = useState<any[]>([]);
  const [prodHistorial, setProdHistorial]       = useState<any[]>([]);
  const [cocinaActiva, setCocinaActiva]         = useState<any[]>([]);
  const [stats, setStats]                       = useState({ ingresos: 0, egresos: 0, operadores: 0, hoy: 0 });
  const [cierresPendientes, setCierresPendientes] = useState<{ fecha: string; ventas_count: number }[]>([]);
  const [cierreDismissed, setCierreDismissed]   = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchMovements = async () => {
    setLoading(true);
    const [{ data: stockData }, { data: prodData }, { data: eventosData }, { data: histData }, { data }, { data: cocinaData }] = await Promise.all([
      supabase.from('stock').select('*').order('categoria').order('nombre'),
      supabase.from('stock_produccion').select('*').order('categoria').order('producto'),
      supabase.from('produccion_eventos').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('producciones_activas').select('*').order('start_time', { ascending: false }).limit(100),
      supabase.from('stock_movements').select('*').order('fecha', { ascending: false }).limit(200),
      supabase.from('cocina_produccion_activa').select('*').eq('status', 'running').order('start_time', { ascending: false }),
    ]);
    setStock(stockData ?? []);
    setStockProd(prodData ?? []);
    setProduccionEventos(eventosData ?? []);
    setProdHistorial(histData ?? []);
    setCocinaActiva(cocinaData ?? []);
    const m = (data ?? []) as Movement[];
    setMovements(m);
    const today = diaLocal(new Date());
    const ops = new Set(m.map(x => x.operador).filter(Boolean));
    setStats({
      ingresos:   m.filter(x => x.tipo === 'ingreso').length,
      egresos:    m.filter(x => x.tipo === 'egreso').length,
      operadores: ops.size,
      hoy:        m.filter(x => x.fecha && diaLocal(x.fecha) === today).length,
    });
    setLoading(false);
    // Verificar cierres pendientes de Fudo
    const hoy = new Date().toISOString().slice(0, 10);
    supabase.from('fudo_cierre_diario')
      .select('fecha, ventas_count')
      .eq('status', 'pendiente')
      .gt('ventas_count', 0)
      .lt('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(7)
      .then(({ data }) => { if (data?.length) setCierresPendientes(data as any); });
  };

  useEffect(() => {
    fetchMovements();

    // Cargar actividad reciente al montar (últimas 2hs) para que no aparezca vacío al refrescar
    supabase
      .from('produccion_eventos')
      .select('*')
      .gte('fecha', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('fecha', { ascending: false })
      .limit(20)
      .then(({ data: recientes }) => {
        if (!recientes || recientes.length === 0) return;
        setNotifications(recientes.map(e => {
          const emoji = e.kind === 'lomito' ? '🥩' : e.kind === 'burger' ? '🍔' : e.kind === 'cocina' ? '🍳' : '🥪';
          const tipo = e.tipo === 'inicio_paso1' ? 'INICIO' : e.tipo === 'inicio_cocina' ? 'INICIO COCINA' : e.tipo === 'fin_cocina' ? 'FIN COCINA' : 'FINALIZADO';
          return {
            id: e.id ?? Date.now() + Math.random(),
            message: `${emoji} ${tipo} — ${e.corte ?? ''}${e.peso_kg ? ' ' + e.peso_kg + 'kg' : ''} (${e.kind ?? ''})${e.operador && e.operador !== 'Sistema' ? ' · ' + e.operador : ''}`,
            type: (e.tipo === 'inicio_paso1' || e.tipo === 'inicio_cocina') ? 'ingreso' : 'egreso',
            time: new Date(e.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }));
      });

    // Helpers para re-fetch parcial sin reload completo
    const refreshStock = () => {
      supabase.from('stock').select('*').order('categoria').order('nombre').then(({ data }) => { if (data) setStock(data); });
      supabase.from('stock_produccion').select('*').order('categoria').order('producto').then(({ data }) => { if (data) setStockProd(data); });
    };

    // Canal único por sesión para evitar conflictos entre dispositivos
    const channelId = `admin_realtime_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      // ── stock_movements: nuevo movimiento ───────────────────────────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' }, (payload) => {
        const m = payload.new as Movement;
        setMovements(prev => [m, ...prev.slice(0, 199)]);
        setNotifications(prev => [{
          id: Date.now(),
          message: `${m.operador ?? 'Alguien'} ${m.tipo === 'ingreso' ? 'cargó' : 'descontó'} ${m.cantidad} ${m.unidad} de ${m.nombre}`,
          type: m.tipo,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }, ...prev].slice(0, 20));
        setStats(prev => ({
          ...prev,
          ingresos: m.tipo === 'ingreso' ? prev.ingresos + 1 : prev.ingresos,
          egresos:  m.tipo === 'egreso'  ? prev.egresos  + 1 : prev.egresos,
          hoy: prev.hoy + 1,
        }));
        // Re-fetch stock para reflejar los nuevos totales al instante
        refreshStock();
      })
      // ── stock: cambio directo en tabla (Fudo sync, ediciones manuales) ──────
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock' }, () => {
        supabase.from('stock').select('*').order('categoria').order('nombre').then(({ data }) => { if (data) setStock(data); });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_produccion' }, () => {
        supabase.from('stock_produccion').select('*').order('categoria').order('producto').then(({ data }) => { if (data) setStockProd(data); });
      })
      // ── produccion_eventos: nueva producción ─────────────────────────────────
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'produccion_eventos' }, (payload) => {
        const e = payload.new as any;
        const emoji = e.kind === 'lomito' ? '🥩' : e.kind === 'burger' ? '🍔' : e.kind === 'cocina' ? '🍳' : '🥪';
        const tipo  = e.tipo === 'inicio_paso1' ? 'INICIO' : e.tipo === 'inicio_cocina' ? 'INICIO COCINA' : e.tipo === 'fin_cocina' ? 'FIN COCINA' : 'FINALIZADO';
        setProduccionEventos(prev => [e, ...prev.slice(0, 199)]);
        setNotifications(prev => [{
          id: Date.now(),
          message: `${emoji} ${tipo} — ${e.corte} ${e.peso_kg}kg (${e.kind})${e.operador && e.operador !== 'Sistema' ? ' · ' + e.operador : ''}`,
          type: ((e.tipo === 'inicio_paso1' || e.tipo === 'inicio_cocina') ? 'ingreso' : 'egreso') as 'ingreso' | 'egreso' | 'alert',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }, ...prev].slice(0, 20));
      })
      // ── producciones_activas: tablet de carnicería actualiza estado ──────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'producciones_activas' }, () => {
        supabase.from('producciones_activas').select('*').order('start_time', { ascending: false }).limit(100).then(({ data }) => { if (data) setProdHistorial(data); });
      })
      // ── cocina_produccion_activa: tablet de cocina actualiza estado ──────────
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cocina_produccion_activa' }, () => {
        supabase.from('cocina_produccion_activa').select('*').eq('status', 'running').order('start_time', { ascending: false }).then(({ data }) => { if (data) setCocinaActiva(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  type TabId = typeof activeTab;
  const NAV: { label: string; items: { id: TabId; label: string; icon: React.ReactNode }[] }[] = [
    { label: 'Principal', items: [
      { id: 'dashboard',  label: 'Dashboard',   icon: <Activity size={18} /> },
      { id: 'movements',  label: 'Movimientos', icon: <ArrowLeftRight size={18} /> },
      { id: 'stock',      label: 'Stock',       icon: <Package size={18} /> },
      { id: 'compras',    label: 'Compras',     icon: <Truck size={18} /> },
      { id: 'factura',    label: 'Facturas',    icon: <FileText size={18} /> },
      { id: 'registro',   label: 'Registro',    icon: <ReceiptText size={18} /> },
      { id: 'ventas',     label: 'Ventas',      icon: <TrendingUp size={18} /> },
      { id: 'costos',     label: 'Costos',      icon: <Calculator size={18} /> },
    ] },
    { label: 'Equipo', items: [
      { id: 'equipo',     label: 'Operadores',  icon: <Users size={18} /> },
      { id: 'tareas',     label: 'Tareas',      icon: <CheckCircle2 size={18} /> },
      { id: 'fichador',   label: 'Fichador',    icon: <Clock size={18} /> },
      { id: 'auditoria',  label: 'Auditoría',   icon: <AlertTriangle size={18} /> },
    ] },
    { label: 'Cocina', items: [
      { id: 'desperdicios',   label: 'Desperdicios',   icon: <Trash2 size={18} /> },
      { id: 'procedimientos', label: 'Procedimientos', icon: <BookOpen size={18} /> },
    ] },
  ];
  const activeLabel = NAV.flatMap(g => g.items).find(i => i.id === activeTab)?.label ?? 'Admin';
  const goTab = (id: TabId) => { setActiveTab(id); setMenuOpen(false); };

  return (
    <div className="min-h-screen" data-admin-theme={theme}>

      {/* OVERLAY móvil */}
      {menuOpen && <div className="hp-overlay lg:hidden" onClick={() => setMenuOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`hp-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="hp-sidebar-head">
          <img src="/icons/icon-admin-192.png" alt="La Cocina" className="w-10 h-10 rounded-xl object-cover" />
          <div className="hp-brand">La Cocina<small>Panel de administración</small></div>
          <button className="hp-icon-btn ml-auto lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <X size={18} />
          </button>
        </div>
        <nav id="admin-tour-nav" className="hp-nav">
          {NAV.map(group => (
            <div key={group.label}>
              <p className="hp-nav-label">{group.label}</p>
              {group.items.map(tab => (
                <button key={tab.id} id={`admin-tour-tab-${tab.id}`} onClick={() => goTab(tab.id)}
                  className={`hp-nav-link ${activeTab === tab.id ? 'active' : ''}`}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hp-sidebar-foot">
          {/* En celular los controles de la barra superior se pasan acá */}
          <div className="md:hidden flex flex-wrap items-center gap-2 pb-2">
            <button onClick={toggleTheme} className="hp-icon-btn" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <PushButton />
            <TestModeButton />
            <button onClick={() => { setShowExport(true); setMenuOpen(false); }} className="hp-btn-soft">
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
          <button onClick={onIrACocina} className="hp-nav-link"><ChefHat size={18} /> Ir a Cocina</button>
          <button onClick={onLock} className="hp-nav-link"><LogOut size={18} /> Salir</button>
        </div>
      </aside>

      <div className="hp-main flex flex-col">

      {/* TOP BAR */}
      <header id="admin-tour-header" className="hp-topbar">
        <div className="flex items-center gap-3 min-w-0">
          <button className="hp-icon-btn lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="hp-title truncate">{activeLabel}</h1>
            <p className="hp-subtitle hidden sm:block">La Cocina · Dark Kitchen Ushuaia</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          {notifications.length > 0 && (
            <div className="hp-icon-btn" title={`${notifications.length} novedades`}>
              <Bell size={20} />
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center"
                style={{ background: 'var(--hp-primary)', color: '#fff' }}>
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={toggleTheme} className="hp-icon-btn" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <PushButton />
            <TestModeButton />
            <button onClick={() => setShowExport(true)} title="Exportar a Excel" className="hp-btn-soft">
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
          <button onClick={fetchMovements} className="hp-icon-btn" title="Actualizar">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {perfil && (
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid var(--hp-border)' }}>
              <div className="hp-avatar">{perfil.nombre.slice(0, 1).toUpperCase()}</div>
              <span className="text-sm font-bold" style={{ color: 'var(--hp-heading)' }}>{perfil.nombre}</span>
            </div>
          )}
        </div>
      </header>

      {/* BANNER CIERRE FUDO PENDIENTE */}
      {!cierreDismissed && cierresPendientes.length > 0 && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 md:px-8 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm font-bold flex-1">
            {cierresPendientes.length === 1
              ? `Tenés ${cierresPendientes[0].ventas_count} ventas del ${new Date(cierresPendientes[0].fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })} sin descontar del stock`
              : `Tenés ventas de ${cierresPendientes.length} días sin descontar del stock`}
          </p>
          <button onClick={() => setActiveTab('ventas')}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-lg transition-all">
            Ir a Ventas
          </button>
          <button onClick={() => setCierreDismissed(true)} className="text-amber-600 hover:text-amber-400 text-xs font-bold px-2">✕</button>
        </div>
      )}

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {activeTab === 'dashboard'  && <TabDashboard   movements={movements} notifications={notifications} stats={stats} setNotifications={setNotifications} setActiveTab={setActiveTab} cocinaActiva={cocinaActiva} prodHistorial={prodHistorial} />}
        {activeTab === 'movements'  && <TabMovimientos movements={movements} filterType={filterType} setFilterType={setFilterType} filterOp={filterOp} setFilterOp={setFilterOp}  fetchMovements={fetchMovements} produccionEventos={produccionEventos} />}

        {activeTab === 'stock'      && (
          <div className="max-w-6xl mx-auto">
            {/* Sub-tabs de Stock */}
            <div className="mb-6">
              <HopeSwitch name="stock-sub"
                options={[
                  { id: 'materias',   label: '📦 Materias primas' },
                  { id: 'produccion', label: '🍳 Producción' },
                ]}
                value={stockSubTab} onChange={setStockSubTab} />
            </div>
            {stockSubTab === 'produccion' && (
              <TabProduccion stockProd={stockProd} produccionEventos={produccionEventos} fetchMovements={fetchMovements} cocinaActiva={cocinaActiva} />
            )}
            {stockSubTab === 'materias' && (
              <TabStock stock={stock} stockProd={stockProd} movements={movements} fetchMovements={fetchMovements} />
            )}
          </div>
        )}
        {activeTab === 'ventas'     && <TabVentas />}
        {activeTab === 'costos'     && <TabCostos />}
        {activeTab === 'compras'    && <TabCompras />}
        {activeTab === 'registro'   && <TabRegistro />}
        {activeTab === 'equipo'     && <TabEquipo />}
        {activeTab === 'tareas'     && <TabTareas />}
        {activeTab === 'auditoria'  && <TabAuditoria />}
        {activeTab === 'fichador'      && <TabFichador />}
        {activeTab === 'factura'       && <TabFactura />}
        {activeTab === 'desperdicios'   && <TabDesperdicios />}
        {activeTab === 'procedimientos' && <TabProcedimientos />}
      </main>

      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      <AdminTour />
    </div>
  );
}