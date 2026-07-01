"use client";

import React, { useState } from 'react';
import TabMotorIA from './TabMotorIA';
import { TrendingUp, BarChart3, Calendar, Clock, ShoppingBag, RefreshCw, Upload, ChefHat, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

type DayStats = {
  prom_ventas: number;
  prom_ordenes: number;
  max_ventas: number;
  min_ventas: number;
  pct_semana: number;
  semanas: number;
  prod_burgers_estimado: number;
  medallones_recomendados: number;
  kg_carne_recomendado: number;
  kg_pan_recomendado: number;
};

// ─── Datos reales: 238 días / Jul 2025 → Abr 2026 ───────────────────────────
const BASE_STATS: {
  por_dia: Record<string, DayStats>;
  por_hora: Record<string, number>;
  ticket_promedio: number;
  total_anio: number;
  ordenes_anio: number;
  dias_con_datos: number;
} = {
  por_dia: {
    "Lunes":     { prom_ventas: 285296,  prom_ordenes: 9.3,  max_ventas: 776400,   min_ventas: 46660,  pct_semana: 13.5, semanas: 15, prod_burgers_estimado: 17, medallones_recomendados: 33, kg_carne_recomendado: 3.96, kg_pan_recomendado: 1.36 },
    "Martes":    { prom_ventas: 249831,  prom_ordenes: 8.6,  max_ventas: 486100,   min_ventas: 17600,  pct_semana: 11.9, semanas: 36, prod_burgers_estimado: 16, medallones_recomendados: 37, kg_carne_recomendado: 4.44, kg_pan_recomendado: 1.28 },
    "Miércoles": { prom_ventas: 201695,  prom_ordenes: 6.6,  max_ventas: 533900,   min_ventas: 16500,  pct_semana: 9.6,  semanas: 37, prod_burgers_estimado: 11, medallones_recomendados: 26, kg_carne_recomendado: 3.12, kg_pan_recomendado: 0.88 },
    "Jueves":    { prom_ventas: 246072,  prom_ordenes: 7.9,  max_ventas: 494180,   min_ventas: 32300,  pct_semana: 11.7, semanas: 37, prod_burgers_estimado: 16, medallones_recomendados: 37, kg_carne_recomendado: 4.44, kg_pan_recomendado: 1.28 },
    "Viernes":   { prom_ventas: 347678,  prom_ordenes: 10.9, max_ventas: 589850,   min_ventas: 185000, pct_semana: 16.5, semanas: 37, prod_burgers_estimado: 18, medallones_recomendados: 43, kg_carne_recomendado: 5.16, kg_pan_recomendado: 1.44 },
    "Sábado":    { prom_ventas: 381579,  prom_ordenes: 12.4, max_ventas: 1336360,  min_ventas: 105600, pct_semana: 18.1, semanas: 38, prod_burgers_estimado: 20, medallones_recomendados: 48, kg_carne_recomendado: 5.76, kg_pan_recomendado: 1.60 },
    "Domingo":   { prom_ventas: 395671,  prom_ordenes: 13.1, max_ventas: 761420,   min_ventas: 61100,  pct_semana: 18.8, semanas: 38, prod_burgers_estimado: 21, medallones_recomendados: 51, kg_carne_recomendado: 6.12, kg_pan_recomendado: 1.68 },
  },
  por_hora: { "12": 41927, "13": 43438, "14": 37543, "19": 55120, "20": 84072, "21": 97911, "22": 78604, "23": 49053 },
  ticket_promedio: 30610,
  total_anio: 72240289,
  ordenes_anio: 2360,
  dias_con_datos: 238,
};

// Tendencia mensual (para mostrar contexto)
const TENDENCIA_MENSUAL = [
  { mes: 'Jul 25', prom: 195674, ords: 7.9 },
  { mes: 'Ago 25', prom: 347983, ords: 13.1 },
  { mes: 'Sep 25', prom: 431874, ords: 14.2 },
  { mes: 'Oct 25', prom: 310653, ords: 10.5 },
  { mes: 'Nov 25', prom: 285092, ords: 9.1 },
  { mes: 'Dic 25', prom: 274240, ords: 8.3 },
  { mes: 'Ene 26', prom: 266449, ords: 8.0 },
  { mes: 'Feb 26', prom: 346374, ords: 10.3 },
  { mes: 'Mar 26', prom: 262769, ords: 8.2 },
  { mes: 'Abr 26', prom: 277938, ords: 8.2 },
];

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const HOY_IDX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
const HOY = DIAS[HOY_IDX];
const MANANA = DIAS[(HOY_IDX + 1) % 7];

const fmt$ = (n: number) => `$${n.toLocaleString('es-AR')}`;
const fmtK = (n: number) => `$${(n / 1000).toFixed(0)}k`;

export default function TabProyeccion() {
  const [stats, setStats] = useState<typeof BASE_STATS>(BASE_STATS);
  const [uploading, setUploading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('238 días · Jul 2025 → Abr 2026');
  const [tab, setTab] = useState<'semana' | 'horas' | 'tendencia' | 'produccion' | 'ia'>('produccion');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const ws = wb.Sheets['Evolución de ventas'];
      if (!ws) throw new Error('No encontré la hoja "Evolución de ventas"');
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
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
        if (r[2]) { const h = String(r[2]); if (!por_hora[h]) por_hora[h] = []; por_hora[h].push(Number(r[3]) || 0); }
      }
      const dias_es = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const agg: Record<string, { v: number[]; o: number[] }> = {};
      Object.values(por_fecha).forEach(({ ventas, ordenes, dow }) => {
        const dia = dias_es[dow];
        if (!agg[dia]) agg[dia] = { v: [], o: [] };
        agg[dia].v.push(ventas); agg[dia].o.push(ordenes);
      });
      const total_prom = Object.values(agg).reduce((s, { v }) => s + v.reduce((a, b) => a + b, 0) / v.length, 0);
      const nuevo_por_dia: Record<string, DayStats> = {};
      DIAS.forEach(dia => {
        if (!agg[dia]) return;
        const { v, o } = agg[dia];
        const pv = v.reduce((a, b) => a + b, 0) / v.length;
        const po = o.reduce((a, b) => a + b, 0) / o.length;
        nuevo_por_dia[dia] = {
          prom_ventas: Math.round(pv), prom_ordenes: Math.round(po * 10) / 10,
          max_ventas: Math.max(...v), min_ventas: Math.min(...v),
          pct_semana: Math.round(pv / total_prom * 1000) / 10, semanas: v.length,
          prod_burgers_estimado: Math.round(po * 1.3),
          medallones_recomendados: Math.round(po * 1.3 * 2.33 * 1.15),
          kg_carne_recomendado: Math.round(po * 1.3 * 2.33 * 1.15 * 0.120 * 100) / 100,
          kg_pan_recomendado: Math.round(po * 1.3 * 1.15 * 0.080 * 1000) / 1000,
        };
      });
      const nuevo_por_hora: Record<string, number> = {};
      Object.entries(por_hora).forEach(([h, vals]) => { nuevo_por_hora[h] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length); });
      const tv = Object.values(por_fecha).reduce((s, d) => s + d.ventas, 0);
      const to = Object.values(por_fecha).reduce((s, d) => s + d.ordenes, 0);
      setStats({ por_dia: nuevo_por_dia, por_hora: nuevo_por_hora, ticket_promedio: Math.round(tv / to), total_anio: tv, ordenes_anio: to, dias_con_datos: Object.keys(por_fecha).length });
      setLastUpdate(`${Object.keys(por_fecha).length} días · ${file.name}`);
    } catch (err: any) { alert('Error: ' + err.message); }
    setUploading(false);
    e.target.value = '';
  };

  const maxVentas = Math.max(...DIAS.filter(d => stats.por_dia[d]).map(d => stats.por_dia[d].prom_ventas));
  const maxHora = Math.max(...Object.values(stats.por_hora));
  const maxTendencia = Math.max(...TENDENCIA_MENSUAL.map(m => m.prom));
  const hoyStats = stats.por_dia[HOY];
  const mananaStats = stats.por_dia[MANANA];

  const getColor = (pct: number) => pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-600';
  const getLabel = (pct: number) => pct >= 80 ? '🔥 DÍA FUERTE' : pct >= 60 ? '✅ DÍA NORMAL' : '😴 DÍA TRANQUILO';
  const getLabelColor = (pct: number) => pct >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/30' : pct >= 60 ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-slate-400 bg-slate-700/50 border-slate-600';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2"><TrendingUp size={20} /> Proyección de Ventas</h2>
          <p className="text-slate-400 text-sm mt-0.5">Base: {lastUpdate} · Burger Club · {stats.ordenes_anio} órdenes · ticket {fmt$(stats.ticket_promedio)}</p>
        </div>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm cursor-pointer transition-colors ${uploading ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
          {uploading ? <><RefreshCw size={16} className="animate-spin" /> Procesando...</> : <><Upload size={16} /> Actualizar Excel</>}
          <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {/* Hoy + Mañana */}
      {hoyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[{ dia: HOY, s: hoyStats, label: 'HOY' }, { dia: MANANA, s: mananaStats, label: 'MAÑANA' }].map(({ dia, s, label }) => {
            if (!s) return null;
            const pct = Math.round(s.prom_ventas / maxVentas * 100);
            return (
              <div key={dia} className={`bg-slate-900 border rounded-2xl p-5 ${label === 'HOY' ? 'border-blue-500/50' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-black text-slate-500 uppercase">{label}</span>
                    <h3 className="text-lg font-black text-white">{dia}</h3>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border font-black ${getLabelColor(pct)}`}>{getLabel(pct)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Ventas esperadas</p>
                    <p className="font-black text-white">{fmtK(s.prom_ventas)}</p>
                    <p className="text-[10px] text-slate-600">máx {fmtK(s.max_ventas)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Órdenes</p>
                    <p className="font-black text-white">{s.prom_ordenes}</p>
                    <p className="text-[10px] text-slate-600">{s.semanas} sem de datos</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Pico</p>
                    <p className="font-black text-white">21hs</p>
                    <p className="text-[10px] text-slate-600">tener listo 19:30</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${getColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-bold">{pct}% del máximo</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1 w-fit">
        {([['produccion', '📦 Producción'], ['semana', '📅 Semana'], ['horas', '⏰ Horario'], ['tendencia', '📈 Tendencia'], ['ia', '🧠 Motor IA']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === id ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Producción recomendada */}
      {tab === 'produccion' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex items-start gap-2">
            <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400">Datos reales de 6 meses (Nov 2025 → Abr 2026). Medallones de 120g. +15% margen de seguridad. 2.33 medallones/burger promedio.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="font-black text-white flex items-center gap-2"><ChefHat size={16} /> Guía de producción semanal</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Día</th>
                  <th className="px-5 py-3 text-right">🍔 Burgers</th>
                  <th className="px-5 py-3 text-right">🥩 Medallones</th>
                  <th className="px-5 py-3 text-right">Kg carne</th>
                  <th className="px-5 py-3 text-right">Kg pan</th>
                  <th className="px-5 py-3 text-left">Nivel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {DIAS.filter(d => stats.por_dia[d]).map(dia => {
                  const s = stats.por_dia[dia];
                  const pct = Math.round(s.prom_ventas / maxVentas * 100);
                  const esHoy = dia === HOY;
                  return (
                    <tr key={dia} className={`${esHoy ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'}`}>
                      <td className="px-5 py-3 font-black text-white">
                        {esHoy && <span className="text-blue-400 text-[10px] mr-1">⬤ </span>}{dia}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-black text-amber-400 text-base">{s.prod_burgers_estimado}</span>
                        <span className="text-slate-500 text-xs ml-1">u</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-black text-white text-base">{s.medallones_recomendados}</span>
                        <span className="text-slate-500 text-xs ml-1">u</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-black text-rose-400">{s.kg_carne_recomendado} kg</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-400">{s.kg_pan_recomendado} kg</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${getColor(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[10px] font-black ${pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-blue-400' : pct >= 40 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {pct >= 80 ? 'FUERTE' : pct >= 60 ? 'NORMAL' : 'BAJO'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Resumen semanal */}
          <div className="px-5 py-4 bg-slate-800/50 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Semana completa</p>
              <p className="text-xl font-black text-white">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].medallones_recomendados || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">medallones</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg carne/semana</p>
              <p className="text-xl font-black text-rose-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_carne_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Burgers/semana</p>
              <p className="text-xl font-black text-amber-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].prod_burgers_estimado || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">u</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg pan/semana</p>
              <p className="text-xl font-black text-slate-300">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_pan_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Semana */}
      {tab === 'semana' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-black text-white flex items-center gap-2"><Calendar size={16} /> Ventas por día de semana</h3>
          </div>
          <div className="p-5 grid grid-cols-7 gap-2 h-64 items-end">
            {DIAS.filter(d => stats.por_dia[d]).map(dia => {
              const s = stats.por_dia[dia];
              const pct = Math.round(s.prom_ventas / maxVentas * 100);
              const esHoy = dia === HOY;
              return (
                <div key={dia} className="flex flex-col items-center gap-1 h-full justify-end">
                  <p className="text-[10px] text-slate-500 font-bold">{fmtK(s.prom_ventas)}</p>
                  <div className={`w-full rounded-t transition-all ${getColor(pct)} ${esHoy ? 'ring-2 ring-blue-400' : ''}`}
                    style={{ height: `${pct}%` }} />
                  <p className={`text-[10px] font-black ${esHoy ? 'text-blue-400' : 'text-slate-500'}`}>{dia.slice(0, 3)}</p>
                  <p className="text-[10px] text-slate-600">{s.pct_semana}%</p>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-5 grid grid-cols-7 gap-2">
            {DIAS.filter(d => stats.por_dia[d]).map(dia => {
              const s = stats.por_dia[dia];
              return (
                <div key={dia} className="text-center">
                  <p className="text-xs font-black text-white">{s.prom_ordenes}</p>
                  <p className="text-[10px] text-slate-500">órd</p>
                </div>
              );
            })}
          </div>
          {/* Resumen semanal */}
          <div className="px-5 py-4 bg-slate-800/50 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Semana completa</p>
              <p className="text-xl font-black text-white">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].medallones_recomendados || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">medallones</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg carne/semana</p>
              <p className="text-xl font-black text-rose-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_carne_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Burgers/semana</p>
              <p className="text-xl font-black text-amber-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].prod_burgers_estimado || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">u</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg pan/semana</p>
              <p className="text-xl font-black text-slate-300">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_pan_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Horario */}
      {tab === 'horas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-black text-white flex items-center gap-2"><Clock size={16} /> Pico de ventas por hora</h3>
          </div>
          <div className="p-5 flex items-end gap-3 h-48">
            {Object.entries(stats.por_hora).sort((a, b) => Number(a[0]) - Number(b[0])).map(([hora, venta]) => {
              const pct = Math.round(venta / maxHora * 100);
              const esAhora = new Date().getHours() === Number(hora);
              return (
                <div key={hora} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <p className="text-[10px] text-slate-500">{fmtK(venta)}</p>
                  <div className={`w-full rounded-t ${getColor(pct)} ${esAhora ? 'ring-2 ring-white' : ''}`} style={{ height: `${pct}%` }} />
                  <p className={`text-[10px] font-bold ${esAhora ? 'text-white' : 'text-slate-500'}`}>{hora}h</p>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-4 bg-slate-800/30">
            <div className="flex items-center gap-3 py-3 border-t border-slate-800">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <p className="text-sm text-slate-300">
                <span className="font-black text-white">21hs es el pico máximo</span> — tené todo listo antes de las 19:30. El 80% de las ventas ocurren entre 20hs y 23hs.
              </p>
            </div>
          </div>
          {/* Resumen semanal */}
          <div className="px-5 py-4 bg-slate-800/50 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Semana completa</p>
              <p className="text-xl font-black text-white">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].medallones_recomendados || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">medallones</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg carne/semana</p>
              <p className="text-xl font-black text-rose-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_carne_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Burgers/semana</p>
              <p className="text-xl font-black text-amber-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].prod_burgers_estimado || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">u</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg pan/semana</p>
              <p className="text-xl font-black text-slate-300">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_pan_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tendencia mensual */}
      {tab === 'tendencia' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-black text-white flex items-center gap-2"><BarChart3 size={16} /> Tendencia mensual (10 meses)</h3>
          </div>
          <div className="p-5 flex items-end gap-2 h-48">
            {TENDENCIA_MENSUAL.map(({ mes, prom }) => {
              const pct = Math.round(prom / maxTendencia * 100);
              const esMesActual = mes.includes('Abr');
              return (
                <div key={mes} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <p className="text-[10px] text-slate-500">{fmtK(prom)}</p>
                  <div className={`w-full rounded-t ${getColor(pct)} ${esMesActual ? 'ring-2 ring-white' : ''}`} style={{ height: `${pct}%` }} />
                  <p className={`text-[10px] font-bold ${esMesActual ? 'text-white' : 'text-slate-500'}`}>{mes}</p>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Mejor mes</p>
                <p className="font-black text-green-400">Sep 2025</p>
                <p className="text-xs text-slate-400">$431k/día</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Total 10 meses</p>
                <p className="font-black text-white">${(stats.total_anio / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-slate-400">{stats.ordenes_anio} órdenes</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Peor mes</p>
                <p className="font-black text-amber-400">Jul 2025</p>
                <p className="text-xs text-slate-400">$195k/día</p>
              </div>
            </div>
          </div>
          {/* Resumen semanal */}
          <div className="px-5 py-4 bg-slate-800/50 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Semana completa</p>
              <p className="text-xl font-black text-white">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].medallones_recomendados || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">medallones</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg carne/semana</p>
              <p className="text-xl font-black text-rose-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_carne_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Burgers/semana</p>
              <p className="text-xl font-black text-amber-400">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].prod_burgers_estimado || 0), 0)}
                <span className="text-sm text-slate-400 ml-1">u</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-1">Kg pan/semana</p>
              <p className="text-xl font-black text-slate-300">
                {DIAS.filter(d => stats.por_dia[d]).reduce((s, d) => s + (stats.por_dia[d].kg_pan_recomendado || 0), 0).toFixed(2)}
                <span className="text-sm text-slate-400 ml-1">kg</span>
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Tab: Motor IA */}
      {tab === 'ia' && <TabMotorIA />}
    </div>
  );
}