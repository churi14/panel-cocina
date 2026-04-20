"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type Evento = {
  id: number;
  tipo: string;
  kind: string;
  corte: string;
  peso_kg: number;
  waste_kg: number;
  operador: string;
  detalle: string;
  fecha: string;
};

const KIND_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  lomito:   { label: 'LOMITO',   color: 'text-rose-700',   bg: 'bg-rose-100' },
  burger:   { label: 'BURGER',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  milanesa: { label: 'MILANESA', color: 'text-amber-700',  bg: 'bg-amber-100' },
  limpieza: { label: 'LIMPIEZA', color: 'text-slate-700',  bg: 'bg-slate-100' },
};

function rendimiento(pesoKg: number, wasteKg: number) {
  if (!pesoKg) return '—';
  const pct = ((pesoKg - wasteKg) / pesoKg) * 100;
  return `${pct.toFixed(1)}%`;
}

function horaDesde(fechaISO: string) {
  try {
    return new Date(fechaISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export default function ProduccionDelDia() {
  const [eventos, setEventos]   = useState<Evento[]>([]);
  const [loading, setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    // Trae solo los fin_paso2 de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('produccion_eventos')
      .select('*')
      .eq('tipo', 'fin_paso2')
      .gte('fecha', hoy.toISOString())
      .order('fecha', { ascending: false });

    if (!error && data) {
      setEventos(data);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEventos();
    // Refresh automático cada 60s
    const t = setInterval(fetchEventos, 60_000);
    return () => clearInterval(t);
  }, [fetchEventos]);

  // Totales
  const totalBruto = eventos.reduce((s, e) => s + (e.peso_kg ?? 0), 0);
  const totalWaste = eventos.reduce((s, e) => s + (e.waste_kg ?? 0), 0);
  const totalNeto  = totalBruto - totalWaste;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-2 font-bold text-slate-800 hover:text-slate-600 transition-colors">
            <span className="text-base">📋 Producción del día</span>
            {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          {!loading && (
            <span className="text-xs text-slate-400 font-medium">
              {eventos.length} {eventos.length === 1 ? 'producción' : 'producciones'}
              {' · '}actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={fetchEventos}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-slate-100 transition-all active:scale-95 text-slate-400 hover:text-slate-700">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!collapsed && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm font-medium">Cargando producciones...</span>
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm font-medium">Sin producciones finalizadas hoy</p>
            </div>
          ) : (
            <>
              {/* Tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Hora</th>
                      <th className="text-left px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Tipo</th>
                      <th className="text-left px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Corte</th>
                      <th className="text-right px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Bruto</th>
                      <th className="text-right px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Desperdicio</th>
                      <th className="text-right px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Rendimiento</th>
                      <th className="text-left px-5 py-3 font-black text-slate-400 text-xs uppercase tracking-wide">Operador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {eventos.map((e) => {
                      const kind = KIND_LABEL[e.kind] ?? { label: e.kind?.toUpperCase(), color: 'text-slate-700', bg: 'bg-slate-100' };
                      const rend = rendimiento(e.peso_kg, e.waste_kg);
                      const rendNum = parseFloat(rend);
                      const rendColor =
                        isNaN(rendNum) ? 'text-slate-400' :
                        rendNum >= 90  ? 'text-green-600' :
                        rendNum >= 75  ? 'text-amber-600' : 'text-red-600';

                      return (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-slate-500 whitespace-nowrap">
                            {horaDesde(e.fecha)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${kind.bg} ${kind.color}`}>
                              {kind.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {e.corte}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-slate-700 whitespace-nowrap">
                            {e.peso_kg?.toFixed ? e.peso_kg.toFixed(3) : e.peso_kg} kg
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-red-500 whitespace-nowrap">
                            {e.waste_kg > 0 ? `${e.waste_kg.toFixed(3)} kg` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <span className={`font-black ${rendColor}`}>{rend}</span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-medium">
                            {e.operador}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer con totales */}
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Total bruto</p>
                  <p className="text-xl font-black text-slate-800">{totalBruto.toFixed(3)} kg</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Total desperdicio</p>
                  <p className="text-xl font-black text-red-500">{totalWaste.toFixed(3)} kg</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Total neto</p>
                  <p className="text-xl font-black text-green-600">{totalNeto.toFixed(3)} kg</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}