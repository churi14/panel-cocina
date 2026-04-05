"use client";

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Calendar, Clock, ShoppingBag, RefreshCw, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Datos base del análisis de 30 días ──────────────────────────────────────
const BASE_STATS = {
  por_dia: {
    "Lunes":     { prom_ventas: 324190, prom_ordenes: 10.8, max_ventas: 776400, min_ventas: 158700, pct_semana: 17.7 },
    "Martes":    { prom_ventas: 254710, prom_ordenes: 7.5,  max_ventas: 435440, min_ventas: 86700,  pct_semana: 13.9 },
    "Miércoles": { prom_ventas: 123375, prom_ordenes: 3.5,  max_ventas: 303600, min_ventas: 36500,  pct_semana: 6.7  },
    "Jueves":    { prom_ventas: 225332, prom_ordenes: 7.0,  max_ventas: 288500, min_ventas: 163000, pct_semana: 12.3 },
    "Viernes":   { prom_ventas: 274900, prom_ordenes: 8.8,  max_ventas: 381800, min_ventas: 198500, pct_semana: 15.0 },
    "Sábado":    { prom_ventas: 260992, prom_ordenes: 8.2,  max_ventas: 352800, min_ventas: 175900, pct_semana: 14.2 },
    "Domingo":   { prom_ventas: 372280, prom_ordenes: 11.2, max_ventas: 476760, min_ventas: 152900, pct_semana: 20.3 },
  },
  por_hora: { "12": 30938, "13": 38192, "14": 30730, "20": 94650, "21": 78853, "22": 64344, "23": 55793 },
  ticket_promedio: 32160,
  total_30d: 8104340,
  ordenes_30d: 252,
};

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOY_IDX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
const HOY = DIAS[HOY_IDX];

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;

type DayStats = { prom_ventas: number; prom_ordenes: number; max_ventas: number; min_ventas: number; pct_semana: number };

export default function TabProyeccion() {
  const [stats, setStats] = useState<{
    por_dia: Record<string, DayStats>;
    por_hora: Record<string, number>;
    ticket_promedio: number;
    total_30d: number;
    ordenes_30d: number;
  }>(BASE_STATS);
  const [uploading, setUploading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('30 días (Burger, Mar-Abr 2026)');

  // ── Upload new Excel ────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const ws = wb.Sheets['Evolución de ventas'];
      if (!ws) throw new Error('No se encontró la hoja "Evolución de ventas"');
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const dias_es = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
      const por_fecha: Record<string, { ventas: number; ordenes: number; dow: number }> = {};
      const por_hora: Record<string, number[]> = {};

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[0]) continue;
        let fecha: Date;
        if (r[0] instanceof Date) fecha = r[0];
        else if (typeof r[0] === 'number') fecha = new Date((r[0] - 25569) * 86400 * 1000);
        else fecha = new Date(r[0]);
        const key = fecha.toISOString().slice(0, 10);
        if (!por_fecha[key]) por_fecha[key] = { ventas: 0, ordenes: 0, dow: fecha.getDay() };
        por_fecha[key].ventas += Number(r[3]) || 0;
        por_fecha[key].ordenes += Number(r[4]) || 0;
        if (r[2]) {
          const h = String(r[2]);
          if (!por_hora[h]) por_hora[h] = [];
          por_hora[h].push(Number(r[3]) || 0);
        }
      }

      // Aggregate by day of week
      const agg: Record<string, number[][]> = {};
      Object.values(por_fecha).forEach(({ ventas, ordenes, dow }) => {
        const dia = dias_es[dow];
        if (!agg[dia]) agg[dia] = [[], []];
        agg[dia][0].push(ventas);
        agg[dia][1].push(ordenes);
      });

      const nuevo_por_dia: Record<string, DayStats> = {};
      const total_prom = Object.values(agg).reduce((s, [v]) => s + v.reduce((a,b) => a+b,0)/v.length, 0);
      DIAS.forEach(dia => {
        if (!agg[dia]) return;
        const [v, o] = agg[dia];
        const prom_v = v.reduce((a,b)=>a+b,0)/v.length;
        nuevo_por_dia[dia] = {
          prom_ventas: Math.round(prom_v),
          prom_ordenes: Math.round(o.reduce((a,b)=>a+b,0)/o.length * 10)/10,
          max_ventas: Math.max(...v),
          min_ventas: Math.min(...v),
          pct_semana: Math.round(prom_v/total_prom*1000)/10,
        };
      });

      const nuevo_por_hora: Record<string,number> = {};
      Object.entries(por_hora).forEach(([h, vals]) => {
        nuevo_por_hora[h] = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
      });

      const total_ventas = Object.values(por_fecha).reduce((s,d)=>s+d.ventas,0);
      const total_ordenes = Object.values(por_fecha).reduce((s,d)=>s+d.ordenes,0);

      setStats({
        por_dia: nuevo_por_dia,
        por_hora: nuevo_por_hora,
        ticket_promedio: Math.round(total_ventas/total_ordenes),
        total_30d: total_ventas,
        ordenes_30d: total_ordenes,
      });
      setLastUpdate(`${Object.keys(por_fecha).length} días — ${file.name}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  const maxVentas = Math.max(...DIAS.filter(d => stats.por_dia[d]).map(d => stats.por_dia[d].prom_ventas));
  const maxHora = Math.max(...Object.values(stats.por_hora));

  // Proyección próximos 7 días
  const proyeccion = Array.from({ length: 7 }, (_, i) => {
    const idx = (HOY_IDX + i) % 7;
    const dia = DIAS[idx];
    const s = stats.por_dia[dia];
    return { dia, es_hoy: i === 0, ...s };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp size={20} /> Proyección de Ventas
          </h2>
          <p className="text-slate-400 text-sm mt-1">Basado en: {lastUpdate}</p>
        </div>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm cursor-pointer transition-colors ${uploading ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
          {uploading ? <><RefreshCw size={16} className="animate-spin" /> Procesando...</> : <><Upload size={16} /> Actualizar con Excel</>}
          <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Facturación 30d', value: fmtK(stats.total_30d), icon: '💰' },
          { label: 'Órdenes 30d', value: String(stats.ordenes_30d), icon: '🛒' },
          { label: 'Ticket promedio', value: fmt$(stats.ticket_promedio), icon: '🎫' },
          { label: 'Mejor día', value: DIAS.filter(d=>stats.por_dia[d]).sort((a,b)=>stats.por_dia[b].prom_ventas-stats.por_dia[a].prom_ventas)[0], icon: '⭐' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-xl font-black text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Proyección próximos 7 días */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-black text-white flex items-center gap-2"><Calendar size={16} /> Proyección próximos 7 días</h3>
        </div>
        <div className="p-4 grid grid-cols-7 gap-2">
          {proyeccion.map(({ dia, es_hoy, prom_ventas, prom_ordenes, pct_semana }) => {
            if (!prom_ventas) return <div key={dia} className="text-center p-2 text-slate-600 text-xs">{dia}</div>;
            const pct = Math.round(prom_ventas / maxVentas * 100);
            const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-600';
            return (
              <div key={dia} className={`rounded-2xl p-3 text-center transition-all ${es_hoy ? 'bg-blue-600/20 border-2 border-blue-500' : 'bg-slate-800/50 border border-slate-700'}`}>
                <p className={`text-xs font-black uppercase mb-2 ${es_hoy ? 'text-blue-400' : 'text-slate-400'}`}>
                  {es_hoy ? '⬤ HOY' : dia.slice(0,3)}
                </p>
                {/* Bar */}
                <div className="h-16 flex items-end justify-center mb-2">
                  <div className={`w-6 rounded-t ${color} transition-all`} style={{ height: `${pct}%` }} />
                </div>
                <p className="text-xs font-black text-white">{fmtK(prom_ventas)}</p>
                <p className="text-[10px] text-slate-500">{prom_ordenes} ord</p>
                <p className="text-[10px] text-slate-600">{pct_semana}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribución por hora */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-black text-white flex items-center gap-2"><Clock size={16} /> Pico de ventas por hora</h3>
        </div>
        <div className="p-4 flex items-end gap-2 h-32">
          {Object.entries(stats.por_hora).sort((a,b) => Number(a[0])-Number(b[0])).map(([hora, venta]) => {
            const pct = Math.round(venta / maxHora * 100);
            const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-600';
            const esAhora = new Date().getHours() === Number(hora);
            return (
              <div key={hora} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-[10px] text-slate-500">{fmtK(venta)}</p>
                <div className={`w-full rounded-t ${color} ${esAhora ? 'ring-2 ring-white' : ''}`} style={{ height: `${pct}%` }} />
                <p className={`text-[10px] font-bold ${esAhora ? 'text-white' : 'text-slate-500'}`}>{hora}h</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla detalle por día */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-black text-white flex items-center gap-2"><BarChart3 size={16} /> Detalle por día de semana</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">Día</th>
              <th className="px-5 py-3 text-right">Promedio</th>
              <th className="px-5 py-3 text-right">Órdenes</th>
              <th className="px-5 py-3 text-right">Máximo</th>
              <th className="px-5 py-3 text-right">Mínimo</th>
              <th className="px-5 py-3 text-right">% semana</th>
              <th className="px-5 py-3 text-left">Intensidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {DIAS.filter(d => stats.por_dia[d]).map(dia => {
              const s = stats.por_dia[dia];
              const pct = Math.round(s.prom_ventas / maxVentas * 100);
              const esHoy = dia === HOY;
              const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-400' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-600';
              return (
                <tr key={dia} className={`hover:bg-slate-800/40 ${esHoy ? 'bg-blue-600/10' : ''}`}>
                  <td className="px-5 py-3 font-black text-white">
                    {esHoy && <span className="text-blue-400 text-[10px] mr-1">⬤</span>}{dia}
                  </td>
                  <td className="px-5 py-3 text-right font-black text-white">{fmt$(s.prom_ventas)}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{s.prom_ordenes}</td>
                  <td className="px-5 py-3 text-right text-green-400">{fmt$(s.max_ventas)}</td>
                  <td className="px-5 py-3 text-right text-red-400">{fmt$(s.min_ventas)}</td>
                  <td className="px-5 py-3 text-right text-slate-400">{s.pct_semana}%</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-8">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recomendaciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="font-black text-white mb-4 flex items-center gap-2"><ShoppingBag size={16} /> Recomendaciones para hoy ({HOY})</h3>
        {stats.por_dia[HOY] && (() => {
          const s = stats.por_dia[HOY];
          const manana = DIAS[(HOY_IDX + 1) % 7];
          const mananaS = stats.por_dia[manana];
          const pct = s.prom_ventas / maxVentas;
          return (
            <div className="space-y-3">
              <div className={`px-4 py-3 rounded-xl border ${pct >= 0.7 ? 'bg-green-500/10 border-green-500/30 text-green-300' : pct >= 0.5 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-slate-700/50 border-slate-600 text-slate-300'}`}>
                <p className="font-black text-sm">
                  {pct >= 0.7 ? '🔥 Día FUERTE' : pct >= 0.5 ? '✅ Día NORMAL' : '😴 Día TRANQUILO'} — esperá ~{s.prom_ordenes} órdenes y ${(s.prom_ventas/1000).toFixed(0)}k en ventas
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">⏰ Pico principal</p>
                  <p className="font-black text-white text-sm">20hs — 23hs</p>
                  <p className="text-xs text-slate-500">Tener todo listo a las 19:30</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-1">📦 Producción estimada</p>
                  <p className="font-black text-white text-sm">~{Math.round(s.prom_ordenes * 1.1)} órdenes</p>
                  <p className="text-xs text-slate-500">+10% de margen de seguridad</p>
                </div>
                {mananaS && (
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">📅 Mañana ({manana})</p>
                    <p className="font-black text-white text-sm">${(mananaS.prom_ventas/1000).toFixed(0)}k esperado</p>
                    <p className={`text-xs ${mananaS.prom_ventas > s.prom_ventas ? 'text-green-400' : 'text-slate-500'}`}>
                      {mananaS.prom_ventas > s.prom_ventas ? '↑ Día más fuerte' : '→ Similar o menor'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}