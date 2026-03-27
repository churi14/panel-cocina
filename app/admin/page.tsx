"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'movements' | 'reports' | 'stock' | 'produccion'>('dashboard');
  const [filterType, setFilterType] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [filterOp, setFilterOp] = useState('all');
  const [stock, setStock] = useState<any[]>([]);
  const [stockProd, setStockProd] = useState<any[]>([]);
  const [stockCat, setStockCat] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [stats, setStats] = useState({ ingresos: 0, egresos: 0, operadores: 0, hoy: 0 });
  const audioRef = useRef<boolean>(false);

  const fetchMovements = async () => {
    setLoading(true);
    // Fetch stock
    const { data: stockData } = await supabase.from('stock').select('*').order('categoria').order('nombre');
    setStock(stockData ?? []);
    const { data: prodData } = await supabase.from('stock_produccion').select('*').order('categoria').order('producto');
    setStockProd(prodData ?? []);

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
        const emoji = e.kind === 'lomito' ? '🥩' : e.kind === 'burger' ? '🍔' : '🥪';
        const tipo = e.tipo === 'inicio_paso1' ? 'INICIO' : 'FINALIZADO';
        const notif: Notification = {
          id: Date.now(),
          message: `${emoji} ${tipo} — ${e.corte} ${e.peso_kg}kg (${e.kind})`,
          type: e.tipo === 'inicio_paso1' ? 'ingreso' : 'egreso',
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
        {activeTab === 'produccion' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
                const catItems = stockProd.filter((s: any) => s.categoria === cat);
                const total = catItems.reduce((sum: number, s: any) => sum + (s.cantidad || 0), 0);
                const emoji = cat === 'lomito' ? '🥩' : cat === 'burger' ? '🍔' : '🥪';
                const color = cat === 'lomito' ? 'text-rose-400' : cat === 'burger' ? 'text-blue-400' : 'text-amber-400';
                const bg = cat === 'lomito' ? 'bg-rose-500/10 border-rose-500/30' : cat === 'burger' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-amber-500/10 border-amber-500/30';
                const unit = cat === 'milanesa' ? 'kg' : 'u';
                return (
                  <div key={cat} className={`bg-slate-900 border ${bg} rounded-2xl p-5`}>
                    <p className="text-xs font-black uppercase text-slate-500 mb-1">{emoji} {cat}</p>
                    <p className={`text-4xl font-black ${color}`}>{total.toFixed(cat === 'milanesa' ? 2 : 0)} <span className="text-lg font-bold text-slate-500">{unit}</span></p>
                    <p className="text-xs text-slate-600 mt-1">{catItems.length} productos</p>
                  </div>
                );
              })}
            </div>

            {(['lomito', 'burger', 'milanesa'] as const).map(cat => {
              const catItems = stockProd.filter((s: any) => s.categoria === cat);
              if (catItems.length === 0) return null;
              const emoji = cat === 'lomito' ? '🥩' : cat === 'burger' ? '🍔' : '🥪';
              return (
                <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="font-bold text-white">{emoji} {cat.charAt(0).toUpperCase() + cat.slice(1)}</h2>
                    <button onClick={fetchMovements} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                      <RefreshCw size={12} /> Actualizar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                    {catItems.map((item: any) => (
                      <div key={item.id} className="bg-slate-800 rounded-2xl p-4">
                        <p className="font-bold text-slate-300 text-sm mb-2">{item.producto}</p>
                        <p className="text-3xl font-black text-white">{cat === 'milanesa' ? item.cantidad.toFixed(2) : Math.round(item.cantidad)}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.unidad}</p>
                        {item.ultima_prod && (
                          <p className="text-xs text-slate-600 mt-2">
                            {new Date(item.ultima_prod).toLocaleDateString('es-AR')} {new Date(item.ultima_prod).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}
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
                <p className="font-bold text-lg">No hay stock de producción todavía</p>
                <p className="text-sm mt-1">Aparecerá aquí cuando se confirmen producciones</p>
              </div>
            )}
          </div>
        )}

        {/* ── STOCK ── */}
        {activeTab === 'stock' && (
          <div className="max-w-6xl mx-auto space-y-6">
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
                        <div key={item.id} className={`rounded-2xl border-2 p-4 ${zero ? 'border-red-500/40 bg-red-500/10' : low ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900'}`}>
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
          </div>
        )}

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