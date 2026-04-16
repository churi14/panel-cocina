"use client";
import React from 'react';
import { TrendingUp, TrendingDown, Clock, User, Activity, ChevronRight, Package } from 'lucide-react';
import { Movement, Notification, formatFecha } from './types';

type Props = {
  movements: Movement[];
  notifications: Notification[];
  stats: { ingresos: number; egresos: number; operadores: number; hoy: number };
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setActiveTab: (tab: any) => void;
  cocinaActiva?: any[];
  prodHistorial?: any[];
};

export default function TabDashboard({ movements, notifications, stats, setNotifications, setActiveTab, cocinaActiva = [], prodHistorial = [] }: Props) {

  return (
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

      {/* Producciones activas ahora */}
      {(() => {
        const carnActivas = prodHistorial.filter((p: any) => ['step1_running','step2_running','step2_pending'].includes(p.status));
        const total = cocinaActiva.length + carnActivas.length;
        if (total === 0) return null;

        const kindCfg: Record<string, {emoji: string; color: string; bg: string}> = {
          lomito:   { emoji: '🥩', color: 'text-rose-400',   bg: 'bg-rose-500/10'   },
          burger:   { emoji: '🍔', color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
          milanesa: { emoji: '🥪', color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
        };
        const statusCfg: Record<string, {label: string; color: string; bg: string}> = {
          step1_running:  { label: 'PASO 1',      color: 'text-rose-400',   bg: 'bg-rose-500/15'   },
          step2_running:  { label: 'PASO 2',      color: 'text-amber-400',  bg: 'bg-amber-500/15'  },
          step2_pending:  { label: 'P2 PENDIENTE',color: 'text-amber-300',  bg: 'bg-amber-500/10'  },
        };

        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-green-500/30" style={{boxShadow:'0 0 30px rgba(34,197,94,0.08)'}}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <div className="w-3 h-3 bg-green-500 rounded-full absolute inset-0 animate-ping opacity-40" />
                </div>
                <h2 className="font-black text-green-400 text-sm uppercase tracking-wider">Producciones activas ahora</h2>
              </div>
              <span className="text-xs font-black text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{total} en curso</span>
            </div>

            {/* Grid de producciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800/50">
              {/* Cocina General */}
              {cocinaActiva.map((p: any) => {
                const mins = Math.floor((Date.now() - p.start_time) / 60000);
                const hrs  = Math.floor(mins / 60);
                const timer = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
                return (
                  <div key={p.id} className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 text-lg">🍳</div>
                      <div className="min-w-0">
                        <p className="font-black text-white text-sm truncate">{p.recipe_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.operador ?? '—'} · Cocina General</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block text-xs font-black text-green-400 bg-green-500/15 px-2.5 py-1 rounded-full">EN CURSO</span>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{timer}</p>
                    </div>
                  </div>
                );
              })}
              {/* Carnicería */}
              {carnActivas.map((p: any) => {
                const cfg = kindCfg[p.kind] ?? { emoji: '🥩', color: 'text-slate-400', bg: 'bg-slate-500/10' };
                const sCfg = statusCfg[p.status] ?? { label: p.status, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                return (
                  <div key={p.id} className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 text-lg`}>{cfg.emoji}</div>
                      <div className="min-w-0">
                        <p className="font-black text-white text-sm truncate">{p.type_name ?? p.cut}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Carnicería · {p.kind?.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-full ${sCfg.color} ${sCfg.bg}`}>{sCfg.label}</span>
                      <p className="text-xs text-slate-500 mt-1 font-mono">{p.weight_kg} kg</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                <td className="px-6 py-3 text-right font-bold text-white">{m.unidad === 'kg' || m.unidad === 'lt' ? m.cantidad.toFixed(3).replace(/\.?0+$/, '').replace('.', ',') : m.cantidad} {m.unidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}