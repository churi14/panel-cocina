"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { Plus, RefreshCw, CheckCircle2, Clock, AlertTriangle, Trash2, X, User, Users } from 'lucide-react';

const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];
const PRIORIDADES = [
  { id: 'alta',  label: 'Alta',  color: 'text-red-400',    bg: 'bg-red-900/30',   border: 'border-red-700' },
  { id: 'media', label: 'Media', color: 'text-amber-400',  bg: 'bg-amber-900/30', border: 'border-amber-700' },
  { id: 'baja',  label: 'Baja',  color: 'text-slate-400',  bg: 'bg-slate-800',    border: 'border-slate-600' },
];

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

function prioConfig(p: string) {
  return PRIORIDADES.find(x => x.id === p) ?? PRIORIDADES[1];
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function TabTareas() {
  const [tareas, setTareas]         = useState<Tarea[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filtro, setFiltro]         = useState<'todas' | 'pendiente' | 'completada'>('todas');
  const [showForm, setShowForm]     = useState(false);

  // Form state
  const [titulo, setTitulo]         = useState('');
  const [desc, setDesc]             = useState('');
  const [prioridad, setPrioridad]   = useState<'alta' | 'media' | 'baja'>('media');
  const [asignadoA, setAsignadoA]   = useState<string>('todos');
  const [creadoPor, setCreadoPor]   = useState('Admin');
  const [saving, setSaving]         = useState(false);
  const savingRef                   = useRef(false);

  const fetchTareas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tareas')
      .select('*')
      .order('estado')           // pendientes primero
      .order('prioridad')        // alta antes que media
      .order('fecha_creada', { ascending: false });
    setTareas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTareas(); }, [fetchTareas]);

  const handleCrear = async () => {
    if (!titulo.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    await supabase.from('tareas').insert({
      titulo: titulo.trim(),
      descripcion: desc.trim() || null,
      prioridad,
      asignado_a: asignadoA === 'todos' ? null : asignadoA,
      creada_por: creadoPor,
      estado: 'pendiente',
    });
    setTitulo(''); setDesc(''); setPrioridad('media'); setAsignadoA('todos');
    setSaving(false);
    savingRef.current = false;
    setShowForm(false);
    fetchTareas();
  };

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await supabase.from('tareas').delete().eq('id', id);
    fetchTareas();
  };

  const handleToggleEstado = async (t: Tarea) => {
    const nuevoEstado = t.estado === 'pendiente' ? 'completada' : 'pendiente';
    await supabase.from('tareas').update({
      estado: nuevoEstado,
      completada_por: nuevoEstado === 'completada' ? 'Admin' : null,
      completada_en: nuevoEstado === 'completada' ? new Date().toISOString() : null,
    }).eq('id', t.id);
    fetchTareas();
  };

  const tareasFiltradas = tareas.filter(t =>
    filtro === 'todas' ? true : t.estado === filtro
  );

  const pendientes  = tareas.filter(t => t.estado === 'pendiente').length;
  const completadas = tareas.filter(t => t.estado === 'completada').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Tareas</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {pendientes} pendiente{pendientes !== 1 ? 's' : ''} · {completadas} completada{completadas !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTareas} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black text-white transition-all active:scale-95">
            <Plus size={16} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(['todas', 'pendiente', 'completada'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize
              ${filtro === f ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {f === 'todas' ? 'Todas' : f === 'pendiente' ? 'Pendientes' : 'Completadas'}
          </button>
        ))}
      </div>

      {/* Modal nueva tarea */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white text-lg">Nueva tarea</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Título *</label>
              <input
                value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="ej: Limpiar freidoras"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Descripción (opcional)</label>
              <textarea
                value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Prioridad</label>
                <div className="flex gap-2">
                  {PRIORIDADES.map(p => (
                    <button key={p.id} onClick={() => setPrioridad(p.id as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all
                        ${prioridad === p.id ? `${p.bg} ${p.color} ${p.border}` : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Asignar a</label>
                <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-blue-500">
                  <option value="todos">Todos</option>
                  {OPERADORES.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Creada por</label>
              <select value={creadoPor} onChange={e => setCreadoPor(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-blue-500">
                <option value="Admin">Admin</option>
                {OPERADORES.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-slate-300 transition-all">
                Cancelar
              </button>
              <button onClick={handleCrear} disabled={!titulo.trim() || saving}
                className={`flex-1 py-3 rounded-xl font-black text-white transition-all flex items-center justify-center gap-2
                  ${titulo.trim() && !saving ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Creando...' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
          <RefreshCw size={18} className="animate-spin" /> Cargando tareas...
        </div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-bold">Sin tareas {filtro !== 'todas' ? filtro + 's' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tareasFiltradas.map(t => {
            const prio = prioConfig(t.prioridad);
            const done = t.estado === 'completada';
            return (
              <div key={t.id}
                className={`border rounded-2xl p-4 transition-all ${done
                  ? 'bg-slate-900 border-slate-800 opacity-60'
                  : `bg-slate-900 border-slate-700 ${t.prioridad === 'alta' ? 'border-l-4 border-l-red-500' : t.prioridad === 'media' ? 'border-l-4 border-l-amber-500' : ''}`
                }`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => handleToggleEstado(t)}
                    className={`mt-0.5 shrink-0 transition-all ${done ? 'text-green-500' : 'text-slate-600 hover:text-green-400'}`}>
                    <CheckCircle2 size={22} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`font-black text-base ${done ? 'line-through text-slate-500' : 'text-white'}`}>
                        {t.titulo}
                      </span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${prio.bg} ${prio.color}`}>
                        {prio.label}
                      </span>
                      {t.asignado_a ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-lg">
                          <User size={10} /> {t.asignado_a}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                          <Users size={10} /> Todos
                        </span>
                      )}
                    </div>
                    {t.descripcion && (
                      <p className="text-sm text-slate-400 mb-2">{t.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {fechaCorta(t.fecha_creada)} {horaCorta(t.fecha_creada)}
                      </span>
                      <span>· creada por <span className="text-slate-400 font-bold">{t.creada_por}</span></span>
                      {done && t.completada_por && (
                        <span className="text-green-600">· ✓ {t.completada_por} {t.completada_en ? horaCorta(t.completada_en) : ''}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleEliminar(t.id)}
                    className="shrink-0 p-1.5 hover:bg-red-900/30 hover:text-red-400 text-slate-600 rounded-lg transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}