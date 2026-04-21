"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, RefreshCw, Plus, X, User, Users, AlertTriangle } from 'lucide-react';

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];

type Tarea = {
  id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  asignado_a: string | null;
  estado: 'pendiente' | 'completada';
  completada_por: string | null;
  completada_en: string | null;
  creada_por: string;
  fecha_creada: string;
};

const PRIO_COLORS = {
  alta:  { dot: 'bg-red-500',   text: 'text-red-400',   label: 'URGENTE' },
  media: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'MEDIA'   },
  baja:  { dot: 'bg-slate-400', text: 'text-slate-400', label: 'BAJA'    },
};

export default function TareasPanel({ operadorActual }: { operadorActual?: string }) {
  const [tareas, setTareas]         = useState<Tarea[]>([]);
  const [loading, setLoading]       = useState(true);
  const [collapsed, setCollapsed]   = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [operador, setOperador]     = useState(operadorActual ?? '');

  // Form
  const [titulo, setTitulo]         = useState('');
  const [desc, setDesc]             = useState('');
  const [prioridad, setPrioridad]   = useState<'alta' | 'media' | 'baja'>('media');
  const [asignadoA, setAsignadoA]   = useState('todos');
  const [saving, setSaving]         = useState(false);

  // Sincronizar operador cuando cambia el perfil (llega async)
  useEffect(() => {
    if (operadorActual && !operador) setOperador(operadorActual);
  }, [operadorActual]);
  const savingRef                   = useRef(false);

  const fetchTareas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tareas')
      .select('*')
      .order('estado')
      .order('prioridad')
      .order('fecha_creada', { ascending: false });
    setTareas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTareas();
    const t = setInterval(fetchTareas, 60_000);
    return () => clearInterval(t);
  }, [fetchTareas]);

  const handleCheck = async (tarea: Tarea) => {
    if (!operador) return;
    const nuevoEstado = tarea.estado === 'pendiente' ? 'completada' : 'pendiente';
    await supabase.from('tareas').update({
      estado: nuevoEstado,
      completada_por: nuevoEstado === 'completada' ? operador : null,
      completada_en: nuevoEstado === 'completada' ? new Date().toISOString() : null,
    }).eq('id', tarea.id);
    fetchTareas();
  };

  const handleCrear = async () => {
    if (!titulo.trim() || !operador || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    await supabase.from('tareas').insert({
      titulo: titulo.trim(),
      descripcion: desc.trim() || null,
      prioridad,
      asignado_a: asignadoA === 'todos' ? null : asignadoA,
      creada_por: operador,
      estado: 'pendiente',
    });
    setTitulo(''); setDesc(''); setPrioridad('media'); setAsignadoA('todos');
    setSaving(false);
    savingRef.current = false;
    setShowForm(false);
    fetchTareas();
  };

  const pendientes  = tareas.filter(t => t.estado === 'pendiente');
  const completadas = tareas.filter(t => t.estado === 'completada');

  // Si hay operador: muestra las de todos + las asignadas a él
  // Si no hay operador: muestra todas
  const tareasFiltradas = operador
    ? tareas.filter(t => t.asignado_a === null || t.asignado_a === operador)
    : tareas;
  const pendientesFiltradas  = tareasFiltradas.filter(t => t.estado === 'pendiente');
  const completadasFiltradas = tareasFiltradas.filter(t => t.estado === 'completada');

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 font-bold text-slate-800 hover:text-slate-600 transition-colors">
          <span className="text-base">✅ Tareas del día</span>
          {pendientesFiltradas.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">
              {pendientesFiltradas.length}
            </span>
          )}
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        <div className="flex items-center gap-2">
          {/* Selector de operador rápido */}
          <select
            value={operador}
            onChange={e => setOperador(e.target.value)}
            className="text-xs font-bold bg-slate-100 border-0 rounded-lg px-2 py-1.5 text-slate-600 outline-none">
            <option value="">¿Quién sos?</option>
            {OPERADORES.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <button onClick={fetchTareas}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-all text-slate-400">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={!operador}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all
              ${operador ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
            <Plus size={12} /> Nueva
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Form nueva tarea */}
          {showForm && (
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-700">Nueva tarea</p>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
              <input
                value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="¿Qué hay que hacer?"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-slate-400 bg-white"
              />
              <textarea
                value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400 bg-white resize-none"
              />
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(['alta','media','baja'] as const).map(p => (
                    <button key={p} onClick={() => setPrioridad(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all
                        ${prioridad === p
                          ? p === 'alta' ? 'bg-red-100 text-red-700 border-red-300'
                            : p === 'media' ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-slate-200 text-slate-700 border-slate-400'
                          : 'bg-white text-slate-400 border-slate-200'}`}>
                      {p === 'alta' ? '🔴 Urgente' : p === 'media' ? '🟡 Media' : '⚪ Baja'}
                    </button>
                  ))}
                </div>
                <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)}
                  className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none">
                  <option value="todos">Para todos</option>
                  {OPERADORES.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <button onClick={handleCrear} disabled={!titulo.trim() || saving}
                className={`w-full py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2
                  ${titulo.trim() && !saving ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                {saving ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : 'Crear tarea'}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          )}

          {!loading && tareasFiltradas.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-medium">Sin tareas pendientes</p>
            </div>
          )}

          {!loading && tareasFiltradas.length > 0 && (
            <div className="divide-y divide-slate-50">
              {/* PENDIENTES */}
              {pendientesFiltradas.map(t => {
                const prio = PRIO_COLORS[t.prioridad];
                return (
                  <div key={t.id}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors
                      ${t.prioridad === 'alta' ? 'border-l-4 border-l-red-400' : ''}`}>
                    <button onClick={() => handleCheck(t)}
                      className="mt-0.5 shrink-0 text-slate-300 hover:text-green-500 transition-colors">
                      <Circle size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{t.titulo}</span>
                        {t.prioridad === 'alta' && (
                          <span className="flex items-center gap-1 text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                            <AlertTriangle size={10} /> URGENTE
                          </span>
                        )}
                        {t.asignado_a ? (
                          <span className="flex items-center gap-1 text-xs text-blue-500 font-bold">
                            <User size={10} /> {t.asignado_a}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Users size={10} /> Todos
                          </span>
                        )}
                      </div>
                      {t.descripcion && (
                        <p className="text-xs text-slate-500 mt-0.5">{t.descripcion}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        Creada por {t.creada_por}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* COMPLETADAS */}
              {completadasFiltradas.length > 0 && (
                <>
                  <div className="px-5 py-2 bg-slate-50">
                    <p className="text-xs font-black text-slate-400 uppercase">
                      Completadas ({completadasFiltradas.length})
                    </p>
                  </div>
                  {completadasFiltradas.map(t => (
                    <div key={t.id} className="flex items-start gap-3 px-5 py-3 opacity-50">
                      <button onClick={() => handleCheck(t)}
                        className="mt-0.5 shrink-0 text-green-500">
                        <CheckCircle2 size={20} />
                      </button>
                      <div className="flex-1">
                        <span className="text-sm text-slate-500 line-through">{t.titulo}</span>
                        {t.completada_por && (
                          <p className="text-xs text-slate-400">
                            ✓ {t.completada_por}
                            {t.completada_en && ` · ${new Date(t.completada_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}