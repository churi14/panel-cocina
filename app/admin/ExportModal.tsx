"use client";

import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Calendar, RefreshCw, Check, ChevronDown } from 'lucide-react';

type Preset = 'hoy' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado';

function toLocalDate(date: Date): string {
  // Devuelve YYYY-MM-DD en hora local argentina
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function getPresetDates(preset: Preset): { desde: string; hasta: string } {
  const now = new Date();
  const hoy = toLocalDate(now);

  if (preset === 'hoy') return { desde: hoy, hasta: hoy };

  if (preset === 'semana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { desde: toLocalDate(d), hasta: hoy };
  }

  if (preset === 'mes') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { desde: toLocalDate(d), hasta: hoy };
  }

  if (preset === 'mes_anterior') {
    const ini = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fin = new Date(now.getFullYear(), now.getMonth(), 0);
    return { desde: toLocalDate(ini), hasta: toLocalDate(fin) };
  }

  return { desde: hoy, hasta: hoy };
}

const PRESETS: { id: Preset; label: string; icon: string }[] = [
  { id: 'hoy',          label: 'Hoy',            icon: '📅' },
  { id: 'semana',       label: 'Últimos 7 días',  icon: '📆' },
  { id: 'mes',          label: 'Este mes',        icon: '🗓️' },
  { id: 'mes_anterior', label: 'Mes anterior',    icon: '📋' },
  { id: 'personalizado',label: 'Personalizado',   icon: '✏️' },
];

const HOJAS = [
  { id: 'produccion', label: '📊 Producción Diaria',     desc: 'Cada evento de producción: kg, operador, desperdicio' },
  { id: 'movimientos',label: '📦 Movimientos de Stock',   desc: 'Todos los ingresos y egresos del stock' },
  { id: 'resumen',    label: '📈 Resumen por Producto',   desc: 'Pivot: consumo total, desperdicio y promedio diario' },
  { id: 'costos',     label: '💰 Calculadora de Costos',  desc: 'Completás precios y calcula el costo total del período' },
];

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const [preset, setPreset]   = useState<Preset>('mes');
  const dates                  = preset !== 'personalizado' ? getPresetDates(preset) : null;
  const [desdeCustom, setDesdeCustom] = useState(() => getPresetDates('mes').desde);
  const [hastaCustom, setHastaCustom] = useState(() => getPresetDates('mes').hasta);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  const desde = dates?.desde ?? desdeCustom;
  const hasta  = dates?.hasta ?? hastaCustom;

  const diasCount = Math.round(
    (new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000
  ) + 1;

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const url = `/api/export?desde=${desde}&hasta=${hasta}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al generar el archivo');

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `LaCocinUshuaia_${desde}_${hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}>
      <div
        className="bg-slate-950 border border-slate-800 w-full md:max-w-xl rounded-t-3xl md:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-emerald-900/60 to-slate-900 px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet size={22} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="font-black text-white text-lg">Exportar a Excel</h2>
              <p className="text-slate-400 text-xs">4 hojas · Producción · Stock · Costos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Selector de período ── */}
          <div>
            <p className="text-xs font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
              <Calendar size={13} /> Período a exportar
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                    preset === p.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}>
                  <span className="block text-lg mb-0.5">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            {preset === 'personalizado' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={desdeCustom}
                    onChange={e => setDesdeCustom(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={hastaCustom}
                    onChange={e => setHastaCustom(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Período seleccionado */}
            {desde && hasta && (
              <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl">
                <Calendar size={14} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-slate-300 font-bold">
                  {new Date(desde + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {desde !== hasta && (
                    <> → {new Date(hasta + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</>
                  )}
                </p>
                <span className="ml-auto text-xs text-slate-500 font-bold shrink-0">
                  {diasCount === 1 ? '1 día' : `${diasCount} días`}
                </span>
              </div>
            )}
          </div>

          {/* ── Qué incluye ── */}
          <div>
            <p className="text-xs font-black text-slate-500 uppercase mb-3">Contenido del archivo</p>
            <div className="space-y-2">
              {HOJAS.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                    <Check size={12} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-sm">{h.label}</p>
                    <p className="text-slate-500 text-xs">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tip ── */}
          <div className="flex gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <span className="text-xl shrink-0">💡</span>
            <p className="text-amber-300 text-xs leading-relaxed">
              La hoja <strong>💰 Calculadora de Costos</strong> tiene las celdas amarillas para que vos completes el precio de cada insumo. El Excel calcula el costo total automáticamente cuando guardás.
            </p>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Footer / Botón ── */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950">
          <button
            onClick={handleExport}
            disabled={loading || !desde || !hasta}
            className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-lg ${
              done
                ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-900/30'
            }`}>
            {loading ? (
              <><RefreshCw size={20} className="animate-spin" /> Generando Excel...</>
            ) : done ? (
              <><Check size={20} /> ¡Descargado!</>
            ) : (
              <><Download size={20} /> Descargar Excel</>
            )}
          </button>
          <p className="text-center text-slate-600 text-xs mt-2">
            Archivo .xlsx compatible con Excel, Google Sheets y LibreOffice
          </p>
        </div>
      </div>
    </div>
  );
}
