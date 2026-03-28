"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import TabVentas from './TabVentas';
import {
  Lock, LogOut, Bell, Package, TrendingDown, TrendingUp,
  RefreshCw, Clock, ChevronRight, AlertTriangle, CheckCircle2,
  BarChart3, Activity, User, Calendar, Filter, X, Search
} from 'lucide-react';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const ADMIN_PIN = '0000'; // ← Cambiar acá

type Movement = {
  id: number;
  nombre: string;
  categoria: string;
  tipo: 'ingreso' | 'egreso';
  cantidad: number;
  unidad: string;
  motivo: string;
  operador: string;
  lote: string;
  fecha: string;
};

type Notification = {
  id: number;
  message: string;
  type: 'ingreso' | 'egreso' | 'alert';
  time: string;
};

// ─── PIN SCREEN ───────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        setTimeout(onUnlock, 200);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setPin(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => setPin(p => p.slice(0, -1));

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-1">KitchenOS Admin</h1>
        <p className="text-slate-400 text-sm mb-8">Ingresá tu PIN para continuar</p>

        {/* Puntos */}
        <div className={`flex justify-center gap-4 mb-8 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150
              ${i < pin.length
                ? error ? 'bg-red-500' : 'bg-slate-900'
                : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Teclado */}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button key={i}
              onClick={() => d === '⌫' ? handleDelete() : d ? handleDigit(d) : null}
              disabled={!d && d !== '0'}
              className={`h-14 rounded-2xl text-xl font-bold transition-all active:scale-95
                ${d === '⌫' ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' :
                  d === '' ? '' :
                  'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'}`}>
              {d}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm font-bold mt-4">PIN incorrecto</p>}
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminDashboard({ onLock }: { onLock: () => void }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'movements' | 'reports' | 'stock' | 'produccion' | 'analytics' | 'ventas'>('dashboard');
  const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [filterOp, setFilterOp] = useState('all');
  const [stock, setStock] = useState<any[]>([]);
  const [stockProd, setStockProd] = useState<any[]>([]);
  const [produccionEventos, setProduccionEventos] = useState<any[]>([]);
  const [selectedProdItem, setSelectedProdItem] = useState<any | null>(null);
  const [prodHistorial, setProdHistorial] = useState<any[]>([]);
  const [stockCat, setStockCat] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [stockSubTab, setStockSubTab] = useState<'materiales' | 'produccion'>('materiales');
  const [selectedStockItem, setSelectedStockItem] = useState<any | null>(null);
  const [stats, setStats] = useState({ ingresos: 0, egresos: 0, operadores: 0, hoy: 0 });
  const audioRef = useRef<boolean>(false);

  const fetchMovements = async () => {
    setLoading(true);
    // Fetch stock
    const { data: stockData } = await supabase.from('stock').select('*').order('categoria').order('nombre');
    setStock(stockData ?? []);
    const { data: prodData } = await supabase.from('stock_produccion').select('*').order('categoria').order('producto');
    setStockProd(prodData ?? []);
    const { data: eventosData } = await supabase.from('produccion_eventos').select('*').order('fecha', { ascending: false }).limit(200);
    setProduccionEventos(eventosData ?? []);
    const { data: histData } = await supabase.from('producciones_activas').select('*').order('start_time', { ascending: false }).limit(100);
    setProdHistorial(histData ?? []);

    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(200);
    const m = (data ?? []) as Movement[];
    setMovements(m);

    // Stats
    const today = new Date().toISOString().slice(0, 10);
    const hoy = m.filter(x => x.fecha?.slice(0, 10) === today);
    const ops = new Set(m.map(x => x.operador).filter(Boolean));
    setStats({
      ingresos: m.filter(x => x.tipo === 'ingreso').length,
      egresos: m.filter(x => x.tipo === 'egreso').length,
      operadores: ops.size,
      hoy: hoy.length,
    });
    setLoading(false);
  };

  // Real-time subscription
  useEffect(() => {
    fetchMovements();

    const channel = supabase
      .channel('admin_realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'stock_movements',
      }, (payload) => {
        const m = payload.new as Movement;
        setMovements(prev => [m, ...prev]);
        const notif: Notification = {
          id: Date.now(),
          message: `${m.operador ?? 'Alguien'} ${m.tipo === 'ingreso' ? 'cargó' : 'descontó'} ${m.cantidad} ${m.unidad} de ${m.nombre}`,
          type: m.tipo,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setNotifications(prev => [notif, ...prev].slice(0, 20));
        setStats(prev => ({
          ...prev,
          ingresos: m.tipo === 'ingreso' ? prev.ingresos + 1 : prev.ingresos,
          egresos: m.tipo === 'egreso' ? prev.egresos + 1 : prev.egresos,
          hoy: prev.hoy + 1,
        }));
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'produccion_eventos',
      }, (payload) => {
        const e = payload.new as any;
        const emoji = e.kind === 'lomito' ? '🥩' : e.kind === 'burger' ? '🍔' : e.kind === 'cocina' ? '🍳' : '🥪';
        const tipo = e.tipo === 'inicio_paso1' ? 'INICIO' : e.tipo === 'inicio_cocina' ? 'INICIO COCINA' : e.tipo === 'fin_cocina' ? 'FIN COCINA' : 'FINALIZADO';
        const notif: Notification = {
          id: Date.now(),
          message: `${emoji} ${tipo} — ${e.corte} ${e.peso_kg}kg (${e.kind})`,
          type: (e.tipo === 'inicio_paso1' || e.tipo === 'inicio_cocina') ? 'ingreso' : 'egreso',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setNotifications(prev => [notif, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = movements.filter(m => {
    if (filterType !== 'all' && m.tipo !== filterType) return false;
    if (filterOp !== 'all' && m.operador !== filterOp) return false;
    return true;
  });

  const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))];

  const formatFecha = (f: string) => {
    if (!f) return '—';
    const d = new Date(f);
    return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* TOP BAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
            <span className="text-slate-900 font-black text-sm">K</span>
          </div>
          <div>
            <h1 className="font-black text-lg">KitchenOS <span className="text-slate-400 font-normal text-sm">Admin</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Notif badge */}
          {notifications.length > 0 && (
            <div className="relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] font-black flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            </div>
          )}
          <button onClick={fetchMovements} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onLock} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-slate-300 transition-colors">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* NAV */}
      <nav className="bg-slate-900 border-b border-slate-800 px-8 flex gap-1">
        {([
          { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
          { id: 'movements', label: 'Movimientos', icon: <Package size={16} /> },
          { id: 'reports',   label: 'Reportes',   icon: <BarChart3 size={16} /> },
          { id: 'stock',     label: 'Stock',      icon: <Package size={16} /> },
          { id: 'produccion', label: 'Producción',  icon: <TrendingUp size={16} /> },
          { id: 'analytics',  label: 'Analytics',   icon: <BarChart3 size={16} /> },
          { id: 'ventas',     label: 'Ventas',      icon: <TrendingUp size={16} /> },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all
              ${activeTab === tab.id
                ? 'border-white text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto p-8">

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Movimientos hoy', value: stats.hoy, icon: <Clock size={20} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Ingresos totales', value: stats.ingresos, icon: <TrendingUp size={20} />, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Egresos totales', value: stats.egresos, icon: <TrendingDown size={20} />, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Operadores activos', value: stats.operadores, icon: <User size={20} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((s, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
                  <p className="text-3xl font-black text-white mb-1">{s.value}</p>
                  <p className="text-slate-400 text-xs font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Notificaciones en tiempo real */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Actividad en tiempo real
                </h2>
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    Limpiar
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-6 py-10 text-center text-slate-600">
                    <Activity size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">Esperando actividad...</p>
                    <p className="text-sm">Los movimientos aparecerán acá en tiempo real</p>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} className="px-6 py-4 flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                      ${n.type === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {n.type === 'ingreso' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <p className="flex-1 text-sm text-slate-300">{n.message}</p>
                    <span className="text-xs text-slate-600 shrink-0">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Últimos movimientos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-bold">Últimos 10 movimientos</h2>
                <button onClick={() => setActiveTab('movements')} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  Ver todos <ChevronRight size={14} />
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left">Hora</th>
                    <th className="px-6 py-3 text-left">Operador</th>
                    <th className="px-6 py-3 text-left">Producto</th>
                    <th className="px-6 py-3 text-left">Tipo</th>
                    <th className="px-6 py-3 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {movements.slice(0, 10).map(m => (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3 text-slate-500 font-mono text-xs">{formatFecha(m.fecha)}</td>
                      <td className="px-6 py-3">
                        <span className="flex items-center gap-2">
                          <User size={14} className="text-slate-500" />
                          <span className="font-bold text-slate-300">{m.operador ?? '—'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3 font-bold text-white">{m.nombre}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black
                          ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {m.tipo === 'ingreso' ? '↑ INGRESO' : '↓ EGRESO'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-white">{m.cantidad} {m.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MOVIMIENTOS ── */}
        {activeTab === 'movements' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Filtros */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-sm text-slate-400 font-bold">
                <Filter size={16} /> Filtros:
              </div>
              {/* Tipo */}
              <div className="flex bg-slate-800 p-1 rounded-xl gap-1">
                {(['all', 'ingreso', 'egreso'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${filterType === t ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                    {t === 'all' ? 'Todos' : t === 'ingreso' ? '↑ Ingresos' : '↓ Egresos'}
                  </button>
                ))}
              </div>
              {/* Operador */}
              <select value={filterOp} onChange={e => setFilterOp(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-sm text-slate-300 rounded-xl px-3 py-2 outline-none">
                <option value="all">Todos los operadores</option>
                {operadores.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <span className="text-slate-600 text-xs ml-auto">{filtered.length} registros</span>
            </div>

            {/* Tabla */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left">Fecha y hora</th>
                      <th className="px-6 py-3 text-left">Operador</th>
                      <th className="px-6 py-3 text-left">Producto</th>
                      <th className="px-6 py-3 text-left">Categoría</th>
                      <th className="px-6 py-3 text-left">Tipo</th>
                      <th className="px-6 py-3 text-left">Motivo</th>
                      <th className="px-6 py-3 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filtered.map(m => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                        <td className="px-6 py-3 font-bold text-slate-300">{m.operador ?? '—'}</td>
                        <td className="px-6 py-3 font-bold text-white">{m.nombre}</td>
                        <td className="px-6 py-3 text-slate-400">{m.categoria}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-black
                            ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {m.tipo === 'ingreso' ? '↑ INGRESO' : '↓ EGRESO'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400 text-xs max-w-xs truncate">{m.motivo ?? '—'}</td>
                        <td className="px-6 py-3 text-right font-black text-white">{m.cantidad} {m.unidad}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-600">No hay movimientos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}



        {/* ── PRODUCCIÓN ── */}
        {activeTab === 'produccion' && (() => {
          const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
            lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  headerBg: 'bg-rose-500/20' },
            burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  headerBg: 'bg-blue-500/20' },
            milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', headerBg: 'bg-amber-500/20' },
          };
          return (
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Totales rápidos */}
              <div className="grid grid-cols-3 gap-4">
                {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                  const cfg = PROD_CFG[cat];
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                  const unit = cat === 'milanesa' ? 'kg' : 'u';
                  return (
                    <div key={cat} className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
                      <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
                      <p className={`text-4xl font-black ${cfg.color}`}>
                        {cat === 'milanesa' ? total.toFixed(2) : Math.round(total)}
                        <span className="text-lg font-bold opacity-60 ml-1">{unit}</span>
                      </p>
                      <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
                    </div>
                  );
                })}
              </div>

              {/* Detalle por categoría — cards clickeables */}
              {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                const cfg = PROD_CFG[cat];
                const catItems = stockProd.filter((s: any) => s.categoria === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                      <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{catItems.length} items · click para ver historial</span>
                        <button onClick={fetchMovements} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                          <RefreshCw size={12} /> Actualizar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                      {catItems.map((item: any) => (
                        <div key={item.id} onClick={() => setSelectedProdItem(item)}
                          className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${cfg.border}`}>
                          <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                          <p className={`text-3xl font-black ${cfg.color}`}>
                            {cat === 'milanesa' ? item.cantidad.toFixed(2) : Math.round(item.cantidad)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                          {item.ultima_prod && (
                            <p className="text-xs text-slate-600 mt-2">
                              {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-wide">Ver historial →</p>
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
                  <p className="text-sm mt-1">Aparecerá aquí cuando se confirmen producciones</p>
                </div>
              )}

              {/* ── MODAL HISTORIAL DE PRODUCCIÓN ── */}
              {selectedProdItem && (() => {
                const keyword = selectedProdItem.producto?.toLowerCase() ?? '';
                // Match por corte o producto en produccion_eventos
                const itemEventos = produccionEventos.filter(e => {
                  const corte = (e.corte ?? '').toLowerCase();
                  const detalle = (e.detalle ?? '').toLowerCase();
                  const cat = selectedProdItem.categoria;
                  // match por kind + corte o detalle
                  return e.kind === cat || corte.includes(keyword) || detalle.includes(keyword);
                }).slice(0, 60);

                const formatEvFecha = (f: string) => {
                  if (!f) return '—';
                  const d = new Date(f);
                  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
                };

                const TIPO_LABELS: Record<string, { label: string; color: string }> = {
                  inicio_paso1: { label: '▶ Inicio P1',    color: 'bg-blue-500/20 text-blue-300' },
                  fin_paso2:    { label: '✓ Fin P2',       color: 'bg-green-500/20 text-green-300' },
                  inicio_cocina:{ label: '🍳 Inicio',      color: 'bg-amber-500/20 text-amber-300' },
                  fin_cocina:   { label: '✓ Fin cocina',   color: 'bg-green-500/20 text-green-300' },
                };

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedProdItem(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <div>
                          <h2 className="font-black text-white text-lg">{selectedProdItem.producto}</h2>
                          <p className="text-slate-400 text-xs">
                            Stock actual: <span className="font-black text-white">{selectedProdItem.categoria === 'milanesa' ? selectedProdItem.cantidad.toFixed(2) : Math.round(selectedProdItem.cantidad)} {selectedProdItem.unidad}</span>
                            {selectedProdItem.ultima_prod && (
                              <> · Última prod: <span className="font-black text-white">{new Date(selectedProdItem.ultima_prod).toLocaleDateString('es-AR')}</span></>
                            )}
                          </p>
                        </div>
                        <button onClick={() => setSelectedProdItem(null)} className="p-2 hover:bg-slate-800 rounded-xl">
                          <X size={20} className="text-slate-400" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {itemEventos.length === 0 ? (
                          <div className="py-16 text-center text-slate-600">
                            <p className="text-3xl mb-3">📋</p>
                            <p className="font-bold">Sin eventos registrados</p>
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                              <tr>
                                <th className="px-5 py-3 text-left">Fecha</th>
                                <th className="px-5 py-3 text-left">Evento</th>
                                <th className="px-5 py-3 text-left">Detalle</th>
                                <th className="px-5 py-3 text-right">Kg</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {itemEventos.map((e: any) => {
                                const tl = TIPO_LABELS[e.tipo] ?? { label: e.tipo, color: 'bg-slate-500/20 text-slate-400' };
                                return (
                                  <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-5 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{formatEvFecha(e.fecha)}</td>
                                    <td className="px-5 py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-black ${tl.color}`}>{tl.label}</span>
                                    </td>
                                    <td className="px-5 py-3 text-slate-300 text-xs max-w-[200px] truncate">{e.detalle ?? e.corte ?? '—'}</td>
                                    <td className="px-5 py-3 text-right font-black text-white">{e.peso_kg ?? '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                      <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500 shrink-0">
                        {itemEventos.length} eventos · últimos 60
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {/* ── STOCK ── */}
        {activeTab === 'stock' && (() => {
          const PROD_CFG: Record<string, { emoji: string; color: string; bg: string; border: string; headerBg: string }> = {
            lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',  headerBg: 'bg-rose-500/20' },
            burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30',  headerBg: 'bg-blue-500/20' },
            milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', headerBg: 'bg-amber-500/20' },
          };
          return (
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Sub-tabs Materiales / Producción */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 w-fit">
              {([
                { id: 'materiales', label: '📦 Materiales' },
                { id: 'produccion', label: '🍔 Producción' },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setStockSubTab(t.id)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all
                    ${stockSubTab === t.id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── SUB-TAB MATERIALES ── */}
            {stockSubTab === 'materiales' && (
              <>
                {/* Filtros */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap gap-4 items-center">
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
                          const zero = item.cantidad === 0;
                          const low = !zero && item.cantidad < 5;
                          return (
                            <div key={item.id} onClick={() => setSelectedStockItem(item)} className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-opacity ${zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
                              <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.nombre}</p>
                              <p className={`text-2xl font-black ${zero ? 'text-red-400' : low ? 'text-amber-400' : 'text-white'}`}>
                                {zero ? '—' : `${item.cantidad} ${item.unidad}`}
                              </p>
                              {zero && <p className="text-xs text-red-400 font-black mt-1">SIN STOCK</p>}
                              {item.fecha_vencimiento && <p className="text-xs text-slate-600 mt-1">Vence: {item.fecha_vencimiento}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── SUB-TAB PRODUCCIÓN ── */}
            {stockSubTab === 'produccion' && (
              <>
                {/* Totales */}
                <div className="grid grid-cols-3 gap-4">
                  {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                    const cfg = PROD_CFG[cat];
                    const catItems = stockProd.filter((s: any) => s.categoria === cat);
                    const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                    const unit = cat === 'milanesa' ? 'kg' : 'u';
                    return (
                      <div key={cat} className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
                        <p className={`text-xs font-black uppercase mb-1 ${cfg.color}`}>{cfg.emoji} {cat}</p>
                        <p className={`text-4xl font-black ${cfg.color}`}>
                          {cat === 'milanesa' ? total.toFixed(2) : Math.round(total)}
                          <span className="text-lg font-bold opacity-60 ml-1">{unit}</span>
                        </p>
                        <p className={`text-xs mt-1 ${cfg.color} opacity-60`}>{catItems.length} productos</p>
                      </div>
                    );
                  })}
                </div>

                {/* Detalle por categoría */}
                {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                  const cfg = PROD_CFG[cat];
                  const catItems = stockProd.filter((s: any) => s.categoria === cat);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                      <div className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${cfg.headerBg}`}>
                        <h2 className={`font-black text-sm uppercase ${cfg.color}`}>{cfg.emoji} {cat}</h2>
                        <span className="text-xs text-slate-500">{catItems.length} items · click para historial</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                        {catItems.map((item: any) => (
                          <div key={item.id} onClick={() => setSelectedProdItem(item)}
                            className={`rounded-2xl border-2 p-4 cursor-pointer hover:opacity-80 transition-all bg-slate-800 ${cfg.border}`}>
                            <p className="font-bold text-slate-300 text-sm leading-tight mb-2">{item.producto}</p>
                            <p className={`text-3xl font-black ${cfg.color}`}>
                              {cat === 'milanesa' ? item.cantidad.toFixed(2) : Math.round(item.cantidad)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                            {item.ultima_prod && (
                              <p className="text-xs text-slate-600 mt-2">
                                {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-wide">Ver historial →</p>
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

          </div>
          );
        })()}

        {/* ── REPORTES ── */}
        {activeTab === 'reports' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Por operador */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="font-bold flex items-center gap-2"><User size={18} className="text-slate-400" /> Movimientos por operador</h2>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {operadores.map(op => {
                  const opMovs = movements.filter(m => m.operador === op);
                  const ingresos = opMovs.filter(m => m.tipo === 'ingreso').length;
                  const egresos = opMovs.filter(m => m.tipo === 'egreso').length;
                  return (
                    <div key={op} className="bg-slate-800 rounded-2xl p-4">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mb-3">
                        <User size={18} className="text-slate-300" />
                      </div>
                      <p className="font-black text-white text-lg mb-1">{op}</p>
                      <p className="text-xs text-slate-400">{opMovs.length} movimientos</p>
                      <div className="flex gap-3 mt-3">
                        <span className="text-xs text-green-400 font-bold">↑ {ingresos}</span>
                        <span className="text-xs text-red-400 font-bold">↓ {egresos}</span>
                      </div>
                    </div>
                  );
                })}
                {operadores.length === 0 && (
                  <div className="col-span-4 text-center py-10 text-slate-600">No hay datos aún</div>
                )}
              </div>
            </div>

            {/* Por categoría */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h2 className="font-bold flex items-center gap-2"><BarChart3 size={18} className="text-slate-400" /> Movimientos por categoría</h2>
              </div>
              <div className="p-6 space-y-3">
                {[...new Set(movements.map(m => m.categoria))].map(cat => {
                  const catMovs = movements.filter(m => m.categoria === cat);
                  const pct = movements.length > 0 ? (catMovs.length / movements.length) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-4">
                      <span className="w-28 text-sm font-bold text-slate-300 shrink-0">{cat}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-400 w-16 text-right">{catMovs.length} mov.</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (() => {
          const today = new Date().toISOString().slice(0, 10);

          // ── Producciones completadas (step2_done en producciones_activas) ──
          const prodsCompleted = prodHistorial.filter(p => p.status === 'step2_done');
          const prodsHoy       = prodsCompleted.filter(p => p.date === new Date().toLocaleDateString('es-AR'));

          // ── Por kind ──
          const byKind = (kind: string) => prodsCompleted.filter(p => p.kind === kind);

          // ── Tiempos promedio paso 1 (en minutos) ──
          const avgMin = (arr: any[], field: string) => {
            const valid = arr.filter(p => p[field] && p[field] > 0).map(p => p[field] / 60);
            return valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : '—';
          };

          // ── Operadores únicos de stock ──
          const operadores = [...new Set(movements.map(m => m.operador).filter(Boolean))] as string[];

          // ── Por operador: movimientos, kg ingresados, kg egresados ──
          const opStats = operadores.map(op => {
            const movs = movements.filter(m => m.operador === op);
            const kgIn  = movs.filter(m => m.tipo === 'ingreso' && m.unidad === 'kg').reduce((s, m) => s + m.cantidad, 0);
            const kgOut = movs.filter(m => m.tipo === 'egreso'  && m.unidad === 'kg').reduce((s, m) => s + m.cantidad, 0);
            const hoy   = movs.filter(m => m.fecha?.slice(0, 10) === today).length;
            return { op, total: movs.length, kgIn, kgOut, hoy };
          }).sort((a, b) => b.total - a.total);

          // ── Uso de stock en producción (desde produccion_eventos fin_paso2) ──
          const stockEnProd = produccionEventos.filter(e => e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina');

          // ── Top productos más movidos ──
          const movByProd: Record<string, number> = {};
          movements.forEach(m => { movByProd[m.nombre] = (movByProd[m.nombre] ?? 0) + m.cantidad; });
          const topProds = Object.entries(movByProd).sort((a, b) => b[1] - a[1]).slice(0, 8);

          // ── Timeline de eventos de hoy ──
          const eventosHoy = produccionEventos.filter(e => e.fecha?.slice(0, 10) === today).slice(0, 20);

          const fmtMin = (seg: number | null) => {
            if (!seg) return '—';
            const m = Math.floor(seg / 60), s = Math.round(seg % 60);
            return `${m}:${s.toString().padStart(2,'0')} min`;
          };

          const KIND_CFG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
            lomito:   { emoji: '🥩', color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30' },
            burger:   { emoji: '🍔', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30' },
            milanesa: { emoji: '🥪', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
            cocina:   { emoji: '🍳', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
          };

          return (
            <div className="max-w-6xl mx-auto space-y-8">

              {/* ── KPIs principales ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Producciones totales', value: prodsCompleted.length, icon: '🏭', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Producciones hoy',     value: prodsHoy.length,       icon: '📅', color: 'text-green-400', bg: 'bg-green-500/10' },
                  { label: 'kg procesados total',  value: prodsCompleted.reduce((s, p) => s + (p.weight_kg || 0), 0).toFixed(1), icon: '⚖️', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Operadores activos',   value: operadores.length,      icon: '👤', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map((k, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center mb-3 text-xl`}>{k.icon}</div>
                    <p className={`text-3xl font-black ${k.color} mb-1`}>{k.value}</p>
                    <p className="text-slate-400 text-xs font-medium">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Producciones por tipo + tiempos promedio ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['lomito', 'burger', 'milanesa'] as const).map(kind => {
                  const cfg = KIND_CFG[kind];
                  const prods = byKind(kind);
                  const totalKg = prods.reduce((s, p) => s + (p.weight_kg || 0), 0);
                  const avgP1 = avgMin(prods, 'duration_seconds');
                  const avgP2 = (() => {
                    const valid = prods.filter(p => p.step2_start_time && p.step2_end_time)
                      .map(p => (p.step2_end_time - p.step2_start_time) / 1000 / 60);
                    return valid.length ? (valid.reduce((a,b) => a+b, 0) / valid.length).toFixed(1) : '—';
                  })();
                  return (
                    <div key={kind} className={`rounded-2xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
                      <p className={`text-xs font-black uppercase mb-3 ${cfg.color}`}>{cfg.emoji} {kind}</p>
                      <p className={`text-4xl font-black ${cfg.color} mb-1`}>{prods.length} <span className="text-lg opacity-60">prods</span></p>
                      <p className="text-slate-400 text-sm mb-3">{totalKg.toFixed(1)} kg procesados</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tiempo prom P1</span>
                          <span className={`font-black ${cfg.color}`}>{avgP1} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Tiempo prom P2</span>
                          <span className={`font-black ${cfg.color}`}>{avgP2} min</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Historial completo de producciones ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2">🏭 Historial de producciones</h2>
                  <span className="text-xs text-slate-500">{prodsCompleted.length} completadas</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-5 py-3 text-left">Fecha</th>
                        <th className="px-5 py-3 text-left">Tipo</th>
                        <th className="px-5 py-3 text-left">Corte</th>
                        <th className="px-5 py-3 text-right">Kg</th>
                        <th className="px-5 py-3 text-right">T. Paso 1</th>
                        <th className="px-5 py-3 text-right">T. Paso 2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {prodHistorial.slice(0, 50).map((p: any, i: number) => {
                        const cfg = KIND_CFG[p.kind] ?? KIND_CFG['lomito'];
                        const p2dur = p.step2_start_time && p.step2_end_time
                          ? (p.step2_end_time - p.step2_start_time) / 1000 : null;
                        return (
                          <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{p.date ?? '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${cfg.bg} ${cfg.color}`}>
                                {cfg.emoji} {p.kind ?? '—'}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-bold text-white text-xs">{p.type_name ?? '—'}</td>
                            <td className="px-5 py-3 text-right font-black text-white">{p.weight_kg ? Number(p.weight_kg).toFixed(2) : '—'}</td>
                            <td className="px-5 py-3 text-right text-slate-300 text-xs">{fmtMin(p.duration_seconds)}</td>
                            <td className="px-5 py-3 text-right text-slate-300 text-xs">{fmtMin(p2dur)}</td>
                          </tr>
                        );
                      })}
                      {prodHistorial.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-600">Sin producciones registradas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Operadores + uso de stock ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Operadores */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="font-bold">👤 Actividad por operador</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {opStats.length === 0 && (
                      <p className="text-slate-600 text-sm text-center py-8">Sin datos aún</p>
                    )}
                    {opStats.map(o => (
                      <div key={o.op} className="bg-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-black text-white">
                              {o.op.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-black text-white">{o.op}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">{o.total} mov.</span>
                            {o.hoy > 0 && <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black">{o.hoy} hoy</span>}
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-400 font-bold">↑ {o.kgIn.toFixed(1)} kg ingresados</span>
                          <span className="text-red-400 font-bold">↓ {o.kgOut.toFixed(1)} kg egresados</span>
                        </div>
                        {/* Barra proporcional */}
                        <div className="mt-2 bg-slate-700 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (o.total / (opStats[0]?.total || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top productos movidos */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800">
                    <h2 className="font-bold">📊 Top productos por volumen</h2>
                  </div>
                  <div className="p-4 space-y-2">
                    {topProds.map(([nombre, qty], i) => (
                      <div key={nombre} className="flex items-center gap-3">
                        <span className="text-slate-600 text-xs font-black w-5 text-right">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-bold text-slate-300 truncate max-w-[180px]">{nombre}</span>
                            <span className="text-xs font-black text-white ml-2">{qty.toFixed(1)}</span>
                          </div>
                          <div className="bg-slate-800 rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (qty / (topProds[0]?.[1] || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {topProds.length === 0 && <p className="text-slate-600 text-sm text-center py-8">Sin datos aún</p>}
                  </div>
                </div>
              </div>

              {/* ── Timeline de hoy ── */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Timeline de producción — hoy
                  </h2>
                  <span className="text-xs text-slate-500">{eventosHoy.length} eventos</span>
                </div>
                {eventosHoy.length === 0 ? (
                  <div className="px-6 py-12 text-center text-slate-600">
                    <p className="text-2xl mb-2">📋</p>
                    <p className="font-bold">Sin producciones hoy todavía</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {eventosHoy.map((e: any, i: number) => {
                      const cfg = KIND_CFG[e.kind] ?? { emoji: '🏭', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };
                      const hora = e.fecha ? new Date(e.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';
                      const LABELS: Record<string, string> = {
                        inicio_paso1: 'Inicio paso 1', fin_paso2: 'Fin paso 2',
                        inicio_cocina: 'Inicio cocina', fin_cocina: 'Fin cocina',
                      };
                      return (
                        <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-800 last:border-0">
                          <span className="text-xs font-mono text-slate-500 w-12 shrink-0">{hora}</span>
                          <span className={`text-lg shrink-0`}>{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{e.detalle || e.corte || '—'}</p>
                            <p className="text-xs text-slate-500">{LABELS[e.tipo] ?? e.tipo} · {e.peso_kg ?? 0} kg</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${cfg.bg} ${cfg.color} shrink-0`}>
                            {e.kind}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* ── VENTAS ── */}
        {activeTab === 'ventas' && <TabVentas />}

        {/* ── HISTORIAL DE ITEM ── */}
        {selectedStockItem && (() => {
          const itemMovs = movements
            .filter(m => m.nombre?.toLowerCase() === selectedStockItem.nombre?.toLowerCase())
            .slice(0, 50);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedStockItem(null)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="font-black text-white text-lg">{selectedStockItem.nombre}</h2>
                    <p className="text-slate-400 text-xs">{selectedStockItem.categoria} · Stock actual: <span className="font-black text-white">{selectedStockItem.cantidad} {selectedStockItem.unidad}</span></p>
                  </div>
                  <button onClick={() => setSelectedStockItem(null)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                {/* Movimientos */}
                <div className="flex-1 overflow-y-auto">
                  {itemMovs.length === 0 ? (
                    <div className="py-16 text-center text-slate-600">
                      <Package size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="font-bold">Sin movimientos registrados</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                        <tr>
                          <th className="px-5 py-3 text-left">Fecha</th>
                          <th className="px-5 py-3 text-left">Operador</th>
                          <th className="px-5 py-3 text-left">Tipo</th>
                          <th className="px-5 py-3 text-left">Motivo</th>
                          <th className="px-5 py-3 text-right">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {itemMovs.map(m => (
                          <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{formatFecha(m.fecha)}</td>
                            <td className="px-5 py-3 font-bold text-slate-300">{m.operador ?? '—'}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {m.tipo === 'ingreso' ? '↑ IN' : '↓ OUT'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs max-w-[180px] truncate">{m.motivo ?? '—'}</td>
                            <td className="px-5 py-3 text-right font-black text-white">{m.cantidad} {m.unidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500 shrink-0">
                  {itemMovs.length} movimientos · últimos 50
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  return unlocked
    ? <AdminDashboard onLock={() => setUnlocked(false)} />
    : <PinScreen onUnlock={() => setUnlocked(true)} />;
}