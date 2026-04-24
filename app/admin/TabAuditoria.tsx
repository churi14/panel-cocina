"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { RefreshCw, Trash2, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';

type Movimiento = {
  id: number;
  nombre: string;
  categoria: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  motivo: string;
  operador: string;
  fecha: string;
  razon_sospecha?: string;
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

const LIMITES: Record<string, number> = {
  VERDURAS:     50,    // absoluto
  CARNES:       150,
  FIAMBRES:     100,
  SECOS:        300,
  DESCARTABLES: 50000,
  BEBIDAS:      10000,
  BROLAS:       500,
  LIMPIEZA:     200,
};

export default function TabAuditoria() {
  const [movSospechosos, setMovSospechosos] = useState<Movimiento[]>([]);
  const [duplicados, setDuplicados]         = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [deletingId, setDeletingId]         = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete]   = useState<Movimiento | null>(null);
  const [lastUpdate, setLastUpdate]         = useState(new Date());

  const fetchAnomalias = useCallback(async () => {
    setLoading(true);

    // 1. Movimientos con cantidades sospechosas (mayores al límite por categoría)
    const { data: movs } = await supabase
      .from('stock_movements')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(500);

    if (movs) {
      const sospechosos: Movimiento[] = [];
      const vistos: Record<string, number> = {};

      for (const m of movs) {
        const limite = LIMITES[m.categoria?.toUpperCase()] ?? 200;
        const cantidad = parseFloat(m.cantidad) || 0;
        const key = `${m.nombre}-${m.cantidad}-${m.tipo}`;
        const fechaMs = new Date(m.fecha).getTime();

        let razon = '';

        // Cantidad absurda
        if (cantidad >= limite) {
          razon = `Cantidad de ${cantidad} ${m.unidad} supera el límite de ${limite} para ${m.categoria}`;
        }

        // Duplicado (mismo nombre, cantidad, tipo en menos de 5 segundos)
        if (vistos[key]) {
          const diff = Math.abs(fechaMs - vistos[key]) / 1000;
          if (diff < 5) {
            razon = razon ? razon + ' · Posible doble submit' : `Posible duplicado (${diff.toFixed(1)}s de diferencia)`;
          }
        }
        vistos[key] = fechaMs;

        if (razon) sospechosos.push({ ...m, razon_sospecha: razon });
      }
      setMovSospechosos(sospechosos);
    }

    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAnomalias]);

  function fetchAuditoria() { fetchAnomalias(); }

  const handleDelete = async (m: Movimiento) => {
    setDeletingId(m.id);
    // Revertir efecto en stock
    const { data: stockItem } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('nombre', m.nombre)
      .maybeSingle();

    if (stockItem) {
      const revert = m.tipo === 'ingreso' ? -m.cantidad : m.cantidad;
      const newQty = parseFloat((Number(stockItem.cantidad) + revert).toFixed(3));
      await supabase.from('stock').update({
        cantidad: newQty,
        fecha_actualizacion: new Date().toISOString().slice(0, 10)
      }).eq('id', stockItem.id);
    }

    await supabase.from('stock_movements').delete().eq('id', m.id);
    setDeletingId(null);
    setConfirmDelete(null);
    fetchAuditoria();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Auditoría</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Movimientos sospechosos detectados automáticamente
            · actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={fetchAuditoria}
          className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
          <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Confirmación delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-3xl mb-3">🗑️</p>
            <h3 className="font-black text-white text-lg mb-2">¿Eliminar movimiento?</h3>
            <p className="text-slate-400 text-sm mb-1">{confirmDelete.nombre}</p>
            <p className="text-red-400 font-black text-xl mb-4">
              {confirmDelete.tipo === 'ingreso' ? '+' : '-'}{confirmDelete.cantidad} {confirmDelete.unidad}
            </p>
            <p className="text-xs text-slate-500 mb-5">
              Esto revierte el efecto en el stock automáticamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl flex items-center justify-center gap-2">
                {deletingId === confirmDelete.id
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
                Eliminar y revertir
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <RefreshCw size={18} className="animate-spin" /> Analizando movimientos...
        </div>
      ) : movSospechosos.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <p className="font-bold text-white text-lg">Todo parece normal</p>
          <p className="text-slate-500 text-sm mt-1">No se detectaron anomalías en los últimos 500 movimientos</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm font-bold">
              {movSospechosos.length} movimiento{movSospechosos.length !== 1 ? 's' : ''} sospechoso{movSospechosos.length !== 1 ? 's' : ''} detectado{movSospechosos.length !== 1 ? 's' : ''}
            </p>
          </div>

          {movSospechosos.map(m => (
            <div key={m.id} className="bg-slate-900 border border-red-500/40 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-white">{m.nombre}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      m.tipo === 'ingreso' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{m.cantidad} {m.unidad}
                    </span>
                    <span className="text-xs text-slate-500">{m.categoria}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    <p className="text-amber-300 text-xs font-bold">{m.razon_sospecha}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
                    <span>{formatFecha(m.fecha)}</span>
                    <span>· {m.operador}</span>
                    {m.motivo && <span>· {m.motivo}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="shrink-0 p-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}