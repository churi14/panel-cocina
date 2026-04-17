"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import AdminTour from '../components/AdminTour';
import {
  LogOut, Bell, Package, TrendingUp, TrendingDown,
  RefreshCw, BarChart3, Activity, ChefHat, Users, Award
} from 'lucide-react';
import { Movement, Notification } from './types';
import TabDashboard   from './TabDashboard';
import TabMovimientos from './TabMovimientos';
import TabProduccion  from './TabProduccion';
import TabStock       from './TabStock';
import TabReportes    from './TabReportes';
import TabAnalytics   from './TabAnalytics';
import TabVentas      from './TabVentas';
import TabUsuarios    from './TabUsuarios';
import TabOperadores  from './TabOperadores';
import TabProyeccion  from './TabProyeccion';
import PushButton     from '../components/PushButton';
import { useAuth }    from '../AuthContext';

export default function AdminDashboard({ onLock, onIrACocina }: { onLock: () => void; onIrACocina?: () => void }) {
  const { perfil } = useAuth();
  const [movements, setMovements]               = useState<Movement[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [notifications, setNotifications]       = useState<Notification[]>([]);
  const [activeTab, setActiveTab]               = useState<'dashboard' | 'movements' | 'reports' | 'stock' | 'produccion' | 'analytics' | 'ventas' | 'usuarios' | 'operadores' | 'proyeccion'>('dashboard');
  const [filterType, setFilterType]             = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [filterOp, setFilterOp]                 = useState('all');
  const [stock, setStock]                       = useState<any[]>([]);
  const [stockProd, setStockProd]               = useState<any[]>([]);
  const [produccionEventos, setProduccionEventos] = useState<any[]>([]);
  const [prodHistorial, setProdHistorial]       = useState<any[]>([]);
  const [cocinaActiva, setCocinaActiva]         = useState<any[]>([]);
  const [stats, setStats]                       = useState({ ingresos: 0, egresos: 0, operadores: 0, hoy: 0 });

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
    const today = new Date().toISOString().slice(0, 10);
    const ops = new Set(m.map(x => x.operador).filter(Boolean));
    setStats({
      ingresos:   m.filter(x => x.tipo === 'ingreso').length,
      egresos:    m.filter(x => x.tipo === 'egreso').length,
      operadores: ops.size,
      hoy:        m.filter(x => x.fecha?.slice(0, 10) === today).length,
    });
    setLoading(false);
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

    // Canal único por sesión para evitar conflictos entre dispositivos
    const channelId = `admin_realtime_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' }, (payload) => {
        const m = payload.new as Movement;
        setMovements(prev => [m, ...prev]);
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
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'produccion_eventos' }, (payload) => {
        const e = payload.new as any;
        const emoji = e.kind === 'lomito' ? '🥩' : e.kind === 'burger' ? '🍔' : e.kind === 'cocina' ? '🍳' : '🥪';
        const tipo  = e.tipo === 'inicio_paso1' ? 'INICIO' : e.tipo === 'inicio_cocina' ? 'INICIO COCINA' : e.tipo === 'fin_cocina' ? 'FIN COCINA' : 'FINALIZADO';
        setNotifications(prev => [{
          id: Date.now(),
          message: `${emoji} ${tipo} — ${e.corte} ${e.peso_kg}kg (${e.kind})${e.operador && e.operador !== 'Sistema' ? ' · ' + e.operador : ''}`,
          type: ((e.tipo === 'inicio_paso1' || e.tipo === 'inicio_cocina') ? 'ingreso' : 'egreso') as 'ingreso' | 'egreso' | 'alert',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const TABS = [
    { id: 'dashboard',  label: 'Dashboard',   icon: <Activity  size={16} /> },
    { id: 'movements',  label: 'Movimientos', icon: <Package   size={16} /> },
    { id: 'reports',    label: 'Reportes',    icon: <BarChart3 size={16} /> },
    { id: 'stock',      label: 'Stock',       icon: <Package   size={16} /> },
    { id: 'produccion', label: 'Producción',  icon: <TrendingUp size={16} /> },
    { id: 'analytics',  label: 'Analytics',   icon: <BarChart3 size={16} /> },
    { id: 'ventas',     label: 'Ventas',      icon: <TrendingUp size={16} /> },
    { id: 'usuarios',   label: 'Usuarios',    icon: <Users size={16} /> },
    { id: 'operadores', label: 'Operadores',  icon: <Award size={16} /> },
    { id: 'proyeccion', label: 'Proyección',   icon: <TrendingUp size={16} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* TOP BAR */}
      <header id="admin-tour-header" className="bg-slate-900 border-b border-slate-800 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-admin-192.png" alt="La Cocina" className="w-9 h-9 rounded-xl object-cover" />
          <h1 className="font-black text-lg">La Cocina <span className="text-slate-400 font-normal text-sm">Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {notifications.length > 0 && (
            <div className="relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] font-black flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            </div>
          )}
          <PushButton />
          <button onClick={fetchMovements} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {perfil && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black text-white">
                {perfil.nombre.slice(0,1).toUpperCase()}
              </div>
              <span className="text-slate-300 text-sm font-bold">{perfil.nombre}</span>
            </div>
          )}
          <button onClick={onIrACocina} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-slate-300 transition-colors">
            <ChefHat size={16} /> <span className="hidden md:inline">Cocina</span>
          </button>
          <button onClick={onLock} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-slate-300 transition-colors">
            <LogOut size={16} /> <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* NAV */}
      <nav className="bg-slate-900 border-b border-slate-800 flex gap-1 overflow-x-auto scrollbar-hide px-2 md:px-8">
        {TABS.map(tab => (
          <button key={tab.id} id={`admin-tour-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 md:px-5 py-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0
              ${activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {activeTab === 'dashboard'  && <TabDashboard   movements={movements} notifications={notifications} stats={stats} setNotifications={setNotifications} setActiveTab={setActiveTab} cocinaActiva={cocinaActiva} prodHistorial={prodHistorial} />}
        {activeTab === 'movements'  && <TabMovimientos movements={movements} filterType={filterType} setFilterType={setFilterType} filterOp={filterOp} setFilterOp={setFilterOp}  fetchMovements={fetchMovements} />}
        {activeTab === 'reports'    && <TabReportes    movements={movements} />}
        {activeTab === 'stock'      && <TabStock       stock={stock} stockProd={stockProd} movements={movements} fetchMovements={fetchMovements} />}
        {activeTab === 'produccion' && <TabProduccion  stockProd={stockProd} produccionEventos={produccionEventos} fetchMovements={fetchMovements} />}
        {activeTab === 'analytics'  && <TabAnalytics   movements={movements} produccionEventos={produccionEventos} prodHistorial={prodHistorial} />}
        {activeTab === 'ventas'     && <TabVentas />}
        {activeTab === 'usuarios'   && <TabUsuarios />}
        {activeTab === 'operadores' && <TabOperadores />}
        {activeTab === 'proyeccion' && <TabProyeccion />}
      </main>

      <AdminTour />
    </div>
  );
}