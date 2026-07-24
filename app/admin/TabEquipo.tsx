"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { invalidateOperadoresCache } from '../hooks/useOperadores';
import {
  RefreshCw, ChevronDown, ChevronUp, Plus, X, Check,
  Edit2, Trash2, Eye, EyeOff, Bell, Send, ShieldCheck,
  Users, ToggleLeft, ToggleRight
} from 'lucide-react';

// ─────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────
type Operador = { id: number; nombre: string; activo: boolean };
type Rol = 'admin' | 'operador' | 'administrativa';
type Perfil = { id: string; nombre: string; email: string; rol: Rol; local: string | null; activo: boolean };
type Evento = {
  id: number; tipo: string; kind: string; corte: string;
  peso_kg: number; detalle: string | null; operador: string | null;
  fecha: string; waste_kg?: number;
};
type Sesion = { ini: Evento; fin: Evento | null; durMin: number | null; iniMs: number };

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
const KIND_EMOJI: Record<string, string> = {
  lomito:'🥩', burger:'🍔', milanesa:'🍗', cocina:'🍳',
  limpieza:'🔪', carnes_limpias:'🔪', salsa:'🫙', verduras:'🥬', fiambre:'🧀',
};
const ROL_CONFIG: Record<Rol, { label: string; color: string; bg: string }> = {
  admin:          { label: 'Admin',          color: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/30' },
  administrativa: { label: 'Administrativa', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  operador:       { label: 'Operador',       color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30' },
};
const LOCALES = ['todos', 'burger', 'lomito', 'milanesa'];

function durLabel(m: number | null) {
  if (m === null) return null;
  return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
}
function durColor(m: number | null) {
  if (m === null) return 'text-slate-500';
  if (m <= 30) return 'text-green-400';
  if (m <= 60) return 'text-amber-400';
  return 'text-red-400';
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
}
function weekKey(iso: string) {
  const d = new Date(iso);
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const monday = new Date(d.getTime() - day * 86400000);
  return monday.toISOString().slice(0,10);
}
function buildSesiones(eventos: Evento[], opNombre: string): Sesion[] {
  const norm = opNombre.toLowerCase().trim();
  const mine = eventos.filter(e => e.operador?.toLowerCase().trim() === norm);
  const inicios = mine.filter(e => e.tipo === 'inicio_paso1');
  const fines   = mine.filter(e => e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina');
  return inicios.map(ini => {
    const iniMs = new Date(ini.fecha).getTime();
    const fin = fines
      .filter(f =>
        f.corte?.toLowerCase() === ini.corte?.toLowerCase() &&
        f.kind === ini.kind &&
        new Date(f.fecha).getTime() > iniMs
      )
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0] ?? null;
    const durMin = fin ? Math.round((new Date(fin.fecha).getTime() - iniMs) / 60000) : null;
    return { ini, fin, durMin, iniMs };
  }).sort((a, b) => b.iniMs - a.iniMs);
}

// ─────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────
export default function TabEquipo() {
  // Data
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [perfiles,   setPerfiles]   = useState<Perfil[]>([]);
  const [eventos,    setEventos]    = useState<Evento[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Productividad
  const [periodo,     setPeriodo]     = useState<'hoy' | 'semana' | 'mes'>('semana');
  const [expandedOp,  setExpandedOp]  = useState<number | null>(null);
  const [detailTab,   setDetailTab]   = useState<Record<number, 'sesiones' | 'tendencia'>>({});

  // Nuevo operador (tabla operadores)
  const [showFormOp,  setShowFormOp]  = useState(false);
  const [editingOp,   setEditingOp]   = useState<Operador | null>(null);
  const [opNombre,    setOpNombre]    = useState('');
  const [savingOp,    setSavingOp]    = useState(false);
  const [deleteConfirmOp, setDeleteConfirmOp] = useState<Operador | null>(null);

  // Nuevo usuario admin (tabla perfiles + auth)
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [showFormAdmin, setShowFormAdmin] = useState(false);
  const [editingAdmin,  setEditingAdmin]  = useState<Perfil | null>(null);
  const [adminNombre,   setAdminNombre]   = useState('');
  const [adminEmail,    setAdminEmail]    = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRol,      setAdminRol]      = useState<Rol>('operador');
  const [adminLocal,    setAdminLocal]    = useState('todos');
  const [showPass,      setShowPass]      = useState(false);
  const [savingAdmin,   setSavingAdmin]   = useState(false);
  const [deleteConfirmAdmin, setDeleteConfirmAdmin] = useState<Perfil | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState(false);

  // Notificaciones
  const [showNotif,    setShowNotif]    = useState(false);
  const [notifTarget,  setNotifTarget]  = useState<Perfil | null>(null);
  const [notifTitle,   setNotifTitle]   = useState('');
  const [notifBody,    setNotifBody]    = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSent,    setNotifSent]    = useState(false);

  const [formError,   setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // ── Fetch ──────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ops }, { data: prfs }, { data: evs }] = await Promise.all([
      supabase.from('operadores').select('*').order('nombre'),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('produccion_eventos').select('*').order('fecha', { ascending: false }).limit(3000),
    ]);
    setOperadores((ops ?? []) as Operador[]);
    setPerfiles((prfs ?? []) as Perfil[]);
    setEventos((evs ?? []) as Evento[]);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  // ── Calcular período ───────────────────────────────
  const ahora = Date.now();
  const desde = periodo === 'hoy'
    ? new Date(new Date().setHours(0,0,0,0)).toISOString()
    : periodo === 'semana'
    ? new Date(ahora - 7  * 86400000).toISOString()
    : new Date(ahora - 30 * 86400000).toISOString();

  // ── Stats por operador ─────────────────────────────
  const opStats = operadores.map(op => {
    const sesiones = buildSesiones(eventos, op.nombre);
    const sesionesEnPeriodo = sesiones.filter(s => s.ini.fecha >= desde);
    const totalKg = sesionesEnPeriodo.reduce((sum, s) => sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const duraciones = sesionesEnPeriodo.map(s => s.durMin).filter((d): d is number => d !== null);
    const durProm = duraciones.length ? Math.round(duraciones.reduce((a,b)=>a+b,0)/duraciones.length) : null;

    const s1Start = new Date(ahora - 7  * 86400000).toISOString();
    const s2Start = new Date(ahora - 14 * 86400000).toISOString();
    const semAct  = sesiones.filter(s => s.ini.fecha >= s1Start);
    const semAnt  = sesiones.filter(s => s.ini.fecha >= s2Start && s.ini.fecha < s1Start);
    const kgAct   = semAct.reduce((sum,s) => sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const kgAnt   = semAnt.reduce((sum,s) => sum + (s.fin?.peso_kg ?? s.ini.peso_kg ?? 0), 0);
    const durAct  = semAct.filter(s=>s.durMin).map(s=>s.durMin!);
    const avgDurAct = durAct.length ? Math.round(durAct.reduce((a,b)=>a+b,0)/durAct.length) : null;
    const durAnt  = semAnt.filter(s=>s.durMin).map(s=>s.durMin!);
    const avgDurAnt = durAnt.length ? Math.round(durAnt.reduce((a,b)=>a+b,0)/durAnt.length) : null;

    const porSemana: Record<string, { count: number; kg: number; durs: number[] }> = {};
    sesiones.slice(0, 200).forEach(s => {
      const wk = weekKey(s.ini.fecha);
      if (!porSemana[wk]) porSemana[wk] = { count:0, kg:0, durs:[] };
      porSemana[wk].count++;
      porSemana[wk].kg += s.fin?.peso_kg ?? s.ini.peso_kg ?? 0;
      if (s.durMin !== null) porSemana[wk].durs.push(s.durMin);
    });
    const semanasOrd = Object.entries(porSemana).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);

    return {
      op, sesiones, sesionesEnPeriodo, totalKg, durProm,
      kgAct, kgAnt, avgDurAct, avgDurAnt, semanasOrd,
      ultimaFecha: sesiones[0]?.ini.fecha ?? null,
    };
  }).sort((a,b) => b.totalKg - a.totalKg);

  const getTab = (id: number) => detailTab[id] ?? 'sesiones';
  const setTab = (id: number, t: 'sesiones' | 'tendencia') =>
    setDetailTab(p => ({ ...p, [id]: t }));

  // ── Gestión operadores ─────────────────────────────
  const openNewOp = () => { setOpNombre(''); setEditingOp(null); setFormError(''); setShowFormOp(true); };
  const openEditOp = (op: Operador) => { setOpNombre(op.nombre); setEditingOp(op); setFormError(''); setShowFormOp(true); };

  const saveOp = async () => {
    if (!opNombre.trim()) { setFormError('Ingresá un nombre'); return; }
    setSavingOp(true); setFormError('');
    if (editingOp) {
      await supabase.from('operadores').update({ nombre: opNombre.trim() }).eq('id', editingOp.id);
    } else {
      await supabase.from('operadores').insert({ nombre: opNombre.trim(), activo: true });
    }
    invalidateOperadoresCache();
    await fetchAll();
    setShowFormOp(false); setSavingOp(false);
  };

  const toggleOp = async (op: Operador) => {
    await supabase.from('operadores').update({ activo: !op.activo }).eq('id', op.id);
    invalidateOperadoresCache();
    await fetchAll();
  };

  const deleteOp = async (op: Operador) => {
    await supabase.from('operadores').delete().eq('id', op.id);
    invalidateOperadoresCache();
    setDeleteConfirmOp(null);
    await fetchAll();
  };

  // ── Gestión admin (perfiles) ───────────────────────
  const resetAdmin = () => {
    setAdminNombre(''); setAdminEmail(''); setAdminPassword('');
    setAdminRol('operador'); setAdminLocal('todos');
    setEditingAdmin(null); setFormError(''); setFormSuccess('');
  };
  const openNewAdmin = () => { resetAdmin(); setShowFormAdmin(true); };
  const openEditAdmin = (p: Perfil) => {
    setEditingAdmin(p); setAdminNombre(p.nombre); setAdminEmail(p.email);
    setAdminRol(p.rol); setAdminLocal(p.local ?? 'todos'); setAdminPassword('');
    setFormError(''); setFormSuccess(''); setShowFormAdmin(true);
  };
  const saveAdmin = async () => {
    if (!adminNombre.trim() || !adminEmail.trim()) { setFormError('Nombre y email son obligatorios'); return; }
    if (!editingAdmin && !adminPassword) { setFormError('Ingresá una contraseña'); return; }
    setSavingAdmin(true); setFormError('');
    try {
      if (editingAdmin) {
        const { error: err } = await supabase.from('perfiles').update({
          nombre: adminNombre.trim(), rol: adminRol,
          local: adminLocal === 'todos' ? null : adminLocal,
        }).eq('id', editingAdmin.id);
        if (err) throw err;
        if (adminPassword) {
          const res = await fetch('/api/admin/update-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingAdmin.id, password: adminPassword }),
          });
          if (!res.ok) throw new Error('Error al actualizar contraseña');
        }
        setFormSuccess('Usuario actualizado');
      } else {
        const res = await fetch('/api/admin/create-user', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: adminEmail.trim(), password: adminPassword, nombre: adminNombre.trim(), rol: adminRol, local: adminLocal === 'todos' ? null : adminLocal }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al crear usuario');
        setFormSuccess('Usuario creado');
      }
      await fetchAll();
      setTimeout(() => { setShowFormAdmin(false); resetAdmin(); }, 1200);
    } catch (e: any) { setFormError(e.message); }
    setSavingAdmin(false);
  };
  const toggleAdmin = async (p: Perfil) => {
    await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id);
    await fetchAll();
  };
  const deleteAdmin = async (p: Perfil) => {
    setDeletingAdmin(true);
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: p.id }),
    });
    if (!res.ok) await supabase.from('perfiles').delete().eq('id', p.id);
    setDeleteConfirmAdmin(null); setDeletingAdmin(false);
    await fetchAll();
  };

  // ── Notificaciones ─────────────────────────────────
  const sendNotif = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return;
    setSendingNotif(true);
    await fetch('/api/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: notifTitle, body: notifBody, tag: 'mensaje-admin', url: '/', userId: notifTarget?.id }),
    });
    setNotifSent(true);
    setTimeout(() => { setNotifSent(false); setShowNotif(false); setNotifTitle(''); setNotifBody(''); setNotifTarget(null); }, 1500);
    setSendingNotif(false);
  };

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-white">👥 Equipo</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {operadores.filter(o=>o.activo).length} operadores activos · {operadores.length} en total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-800 border border-slate-700 p-1 rounded-xl gap-1">
            {(['hoy','semana','mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${periodo === p ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
          <button onClick={() => { setNotifTarget(null); setShowNotif(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-black text-xs rounded-xl transition-colors">
            <Bell size={14} /> Notificar
          </button>
          <button onClick={openNewOp}
            className="flex items-center gap-2 px-3 py-2 bg-white text-slate-900 font-black text-xs rounded-xl hover:bg-slate-100 transition-colors">
            <Plus size={14} /> Nuevo operador
          </button>
          <button onClick={fetchAll} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Cards de operadores ─────────────────── */}
          <div className="space-y-3">
            {opStats.map(({ op, sesiones, sesionesEnPeriodo, totalKg, durProm, kgAct, kgAnt, avgDurAct, avgDurAnt, semanasOrd, ultimaFecha }, idx) => {
              const isExpanded = expandedOp === op.id;
              const tab = getTab(op.id);
              const kgDiff = kgAct - kgAnt;
              const durDiff = avgDurAct !== null && avgDurAnt !== null ? avgDurAct - avgDurAnt : null;

              return (
                <div key={op.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all
                  ${!op.activo ? 'opacity-50 border-slate-800' : 'border-slate-800'}`}>

                  {/* Fila principal */}
                  <div className="flex items-center">
                    {/* Click para expandir */}
                    <button onClick={() => op.activo && setExpandedOp(isExpanded ? null : op.id)}
                      className="flex-1 flex items-center gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors text-left">
                      {/* Ranking */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0
                        ${idx === 0 ? 'bg-amber-500 text-slate-900' : idx === 1 ? 'bg-slate-400 text-slate-900' : idx === 2 ? 'bg-amber-700/80 text-white' : 'bg-slate-700 text-slate-500'}`}>
                        {idx+1}
                      </div>
                      <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white shrink-0">
                        {op.nombre.slice(0,1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white">{op.nombre}</p>
                        <p className="text-slate-500 text-xs">
                          {sesionesEnPeriodo.length} sesiones · {totalKg.toFixed(1)} kg
                          {durProm !== null && ` · prom ${durProm} min`}
                        </p>
                      </div>

                      {/* KPIs (md+) */}
                      <div className="hidden md:flex items-center gap-5 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase">Kg (sem)</p>
                          <p className="font-black text-white text-sm">{kgAct.toFixed(1)}</p>
                          {kgAnt > 0 && <p className={`text-[10px] font-bold ${kgDiff>=0?'text-green-400':'text-red-400'}`}>{kgDiff>=0?'▲':'▼'} {Math.abs(kgDiff).toFixed(1)}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase">Dur. prom</p>
                          <p className={`font-black text-sm ${durColor(avgDurAct)}`}>{durLabel(avgDurAct) ?? '—'}</p>
                          {durDiff !== null && <p className={`text-[10px] font-bold ${durDiff<0?'text-green-400':'text-red-400'}`}>{durDiff<0?`▼${-durDiff}`:`▲${durDiff}`} min</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase">Última</p>
                          <p className="font-black text-white text-xs">{ultimaFecha ? fmtFecha(ultimaFecha) : '—'}</p>
                          {ultimaFecha && <p className="text-[10px] text-slate-600">{fmtHora(ultimaFecha)}</p>}
                        </div>
                      </div>

                      {op.activo && (isExpanded ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />)}
                    </button>

                    {/* Acciones de gestión */}
                    <div className="flex items-center gap-1 pr-3 shrink-0">
                      <button onClick={() => openEditOp(op)} title="Editar nombre"
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-blue-400 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => toggleOp(op)} title={op.activo ? 'Desactivar' : 'Activar'}
                        className={`p-2 rounded-xl transition-colors ${op.activo ? 'text-slate-500 hover:bg-slate-800 hover:text-amber-400' : 'text-slate-700 hover:bg-slate-800 hover:text-green-400'}`}>
                        {op.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => setDeleteConfirmOp(op)} title="Eliminar"
                        className="p-2 hover:bg-red-500/10 rounded-xl text-slate-700 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── Detalle expandido ───────────── */}
                  {isExpanded && (
                    <div className="border-t border-slate-800">
                      <div className="flex border-b border-slate-800">
                        {(['sesiones','tendencia'] as const).map(t => (
                          <button key={t} onClick={() => setTab(op.id, t)}
                            className={`flex-1 py-2.5 text-xs font-black transition-all
                              ${tab===t ? 'text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t==='sesiones' ? `📋 Sesiones (${sesionesEnPeriodo.length})` : '📈 Tendencia semanal'}
                          </button>
                        ))}
                      </div>

                      {tab === 'sesiones' && (
                        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                          {sesionesEnPeriodo.length === 0
                            ? <p className="text-center text-slate-600 py-6 text-sm">Sin sesiones en este período</p>
                            : sesionesEnPeriodo.map((s, i) => (
                              <div key={i} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="text-lg shrink-0">{KIND_EMOJI[s.ini.kind] ?? '🔪'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-white text-sm">{s.ini.corte}</p>
                                  <p className="text-xs text-slate-500 capitalize">{s.ini.kind}</p>
                                </div>
                                <div className="text-center shrink-0">
                                  <p className="text-xs text-slate-400 font-mono">{fmtHora(s.ini.fecha)}{s.fin && ` → ${fmtHora(s.fin.fecha)}`}</p>
                                  <p className="text-[10px] text-slate-600">{fmtFecha(s.ini.fecha)}</p>
                                </div>
                                <div className="text-center shrink-0 w-16">
                                  {s.durMin !== null
                                    ? <p className={`font-black text-sm ${durColor(s.durMin)}`}>{durLabel(s.durMin)}</p>
                                    : <p className="text-amber-400 text-xs font-bold">en curso</p>}
                                </div>
                                <div className="text-right shrink-0 w-16">
                                  {(s.fin?.peso_kg ?? s.ini.peso_kg) > 0 && (
                                    <p className="font-black text-amber-400 text-sm">{(s.fin?.peso_kg ?? s.ini.peso_kg).toFixed(1)} kg</p>
                                  )}
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      )}

                      {tab === 'tendencia' && (
                        <div className="p-4 space-y-4">
                          {semanasOrd.length === 0
                            ? <p className="text-center text-slate-600 py-6 text-sm">Sin datos históricos</p>
                            : (
                              <>
                                {/* Barras */}
                                <div>
                                  <p className="text-xs font-black text-slate-500 uppercase mb-3">Kg por semana</p>
                                  <div className="flex items-end gap-2 h-24">
                                    {(() => {
                                      const maxKg = Math.max(...semanasOrd.map(([,v])=>v.kg), 1);
                                      return semanasOrd.map(([wk, v], i) => {
                                        const isLast = i === semanasOrd.length - 1;
                                        const pct = Math.max(6, (v.kg/maxKg)*100);
                                        const wkLabel = new Date(wk+'T12:00:00').toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit'});
                                        return (
                                          <div key={wk} className="flex-1 flex flex-col items-center gap-1 group relative">
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                              {v.kg.toFixed(1)} kg · {v.count} ses.
                                            </div>
                                            <div className={`w-full rounded-t ${isLast ? 'bg-amber-500' : 'bg-slate-600'}`} style={{ height:`${pct}%` }} />
                                            <span className="text-[9px] text-slate-600 whitespace-nowrap">{wkLabel}</span>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                                {/* Tabla */}
                                <div className="bg-slate-800 rounded-xl overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-700">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-slate-400 font-black uppercase">Semana</th>
                                        <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Ses.</th>
                                        <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Kg</th>
                                        <th className="px-3 py-2 text-right text-slate-400 font-black uppercase">Prom</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                      {[...semanasOrd].reverse().map(([wk, v], i) => {
                                        const isLast = i === 0;
                                        const avgDur = v.durs.length ? Math.round(v.durs.reduce((a,b)=>a+b,0)/v.durs.length) : null;
                                        const prev   = semanasOrd[semanasOrd.length - 1 - i - 1];
                                        const prevAvg = prev && prev[1].durs.length ? Math.round(prev[1].durs.reduce((a,b)=>a+b,0)/prev[1].durs.length) : null;
                                        const mejoro  = avgDur !== null && prevAvg !== null && avgDur < prevAvg;
                                        const wkLabel = new Date(wk+'T12:00:00').toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit'});
                                        return (
                                          <tr key={wk} className={isLast ? 'bg-amber-500/5' : ''}>
                                            <td className="px-3 py-2.5 font-bold text-slate-300">{isLast ? '⭐ ' : ''}{wkLabel}</td>
                                            <td className="px-3 py-2.5 text-right text-white font-black">{v.count}</td>
                                            <td className="px-3 py-2.5 text-right font-black text-amber-400">{v.kg.toFixed(1)} kg</td>
                                            <td className="px-3 py-2.5 text-right">
                                              {avgDur !== null
                                                ? <span className={`font-black ${durColor(avgDur)}`}>
                                                    {avgDur} min
                                                    {prevAvg !== null && <span className={`ml-1 text-[10px] ${mejoro?'text-green-400':'text-red-400'}`}>{mejoro?`▼${prevAvg-avgDur}`:`▲${avgDur-prevAvg}`}</span>}
                                                  </span>
                                                : <span className="text-slate-600">—</span>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {operadores.length === 0 && (
              <div className="text-center py-12 text-slate-600">
                <Users size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-bold">Sin operadores — agregá uno con el botón de arriba</p>
              </div>
            )}
          </div>

          {/* ── Acceso al sistema (perfiles) ────────── */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAdminSection(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-blue-400" />
                <div className="text-left">
                  <p className="font-black text-white text-sm">Acceso al sistema</p>
                  <p className="text-slate-500 text-xs">{perfiles.length} usuarios con login · administradores y operadores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showAdminSection && (
                  <button onClick={e => { e.stopPropagation(); openNewAdmin(); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-lg transition-colors">
                    <Plus size={12} /> Nuevo
                  </button>
                )}
                {showAdminSection ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </div>
            </button>

            {showAdminSection && (
              <div className="border-t border-slate-800 divide-y divide-slate-800">
                {perfiles.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 px-5 py-3 ${!p.activo ? 'opacity-50' : ''}`}>
                    <div className="w-8 h-8 bg-slate-700 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0">
                      {p.nombre.slice(0,1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-white text-sm">{p.nombre}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${ROL_CONFIG[p.rol].bg} ${ROL_CONFIG[p.rol].color}`}>
                          {ROL_CONFIG[p.rol].label}
                        </span>
                        {!p.activo && <span className="text-[10px] text-slate-500 font-bold">INACTIVO</span>}
                      </div>
                      <p className="text-slate-500 text-xs truncate">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setNotifTarget(p); setShowNotif(true); }}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-400 transition-colors">
                        <Bell size={13} />
                      </button>
                      <button onClick={() => openEditAdmin(p)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => toggleAdmin(p)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-400 transition-colors">
                        {p.activo ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => setDeleteConfirmAdmin(p)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-700 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal: nuevo/editar operador ────────────── */}
      {showFormOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowFormOp(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">{editingOp ? 'Editar operador' : 'Nuevo operador'}</h3>
              <button onClick={() => setShowFormOp(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Nombre</label>
              <input value={opNombre} onChange={e => setOpNombre(e.target.value)}
                placeholder="Ej: Cristopher"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white" />
            </div>
            {formError && <p className="text-red-400 text-xs font-bold">{formError}</p>}
            <button onClick={saveOp} disabled={savingOp}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {savingOp ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</> : <><Check size={16} /> {editingOp ? 'Guardar cambios' : 'Agregar'}</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: nuevo/editar usuario admin ───────── */}
      {showFormAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { setShowFormAdmin(false); resetAdmin(); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-400" />
                {editingAdmin ? 'Editar acceso' : 'Nuevo acceso al sistema'}
              </h3>
              <button onClick={() => { setShowFormAdmin(false); resetAdmin(); }} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Nombre</label>
                <input value={adminNombre} onChange={e => setAdminNombre(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>
              {!editingAdmin && (
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Email</label>
                  <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
                  {editingAdmin ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} type={showPass ? 'text' : 'password'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 pr-10" />
                  <button onClick={() => setShowPass(v=>!v)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin','administrativa','operador'] as Rol[]).map(r => (
                    <button key={r} onClick={() => setAdminRol(r)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all
                        ${adminRol===r ? `${ROL_CONFIG[r].bg} ${ROL_CONFIG[r].color}` : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                      {ROL_CONFIG[r].label}
                    </button>
                  ))}
                </div>
              </div>
              {adminRol === 'operador' && (
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Local</label>
                  <div className="grid grid-cols-4 gap-2">
                    {LOCALES.map(l => (
                      <button key={l} onClick={() => setAdminLocal(l)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all capitalize
                          ${adminLocal===l ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                        {l === 'todos' ? 'Todos' : l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {formError   && <p className="text-red-400 text-xs font-bold">{formError}</p>}
              {formSuccess  && <p className="text-green-400 text-xs font-bold flex items-center gap-1"><Check size={12} /> {formSuccess}</p>}
              <button onClick={saveAdmin} disabled={savingAdmin}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {savingAdmin ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</> : <><Check size={16} /> {editingAdmin ? 'Guardar cambios' : 'Crear usuario'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm eliminar operador ────────────────── */}
      {deleteConfirmOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDeleteConfirmOp(null)}>
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <Trash2 size={24} className="text-red-400 mx-auto" />
            <p className="font-black text-white">¿Eliminar a <span className="text-red-400">{deleteConfirmOp.nombre}</span>?</p>
            <p className="text-slate-500 text-sm">Se va a borrar de la lista de cocina. No se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmOp(null)} className="flex-1 py-2.5 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={() => deleteOp(deleteConfirmOp)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm eliminar usuario admin ──────────── */}
      {deleteConfirmAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDeleteConfirmAdmin(null)}>
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <ShieldCheck size={24} className="text-red-400 mx-auto" />
            <p className="font-black text-white">¿Eliminar acceso de <span className="text-red-400">{deleteConfirmAdmin.nombre}</span>?</p>
            <p className="text-slate-500 text-sm">Se va a revocar el login al sistema. No se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmAdmin(null)} className="flex-1 py-2.5 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={() => deleteAdmin(deleteConfirmAdmin)} disabled={deletingAdmin}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deletingAdmin ? <><RefreshCw size={14} className="animate-spin" /> Eliminando...</> : <><Trash2 size={14} /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Notificación ───────────────────────── */}
      {showNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowNotif(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-2">
                <Bell size={18} className="text-amber-400" />
                {notifTarget ? `Notificar a ${notifTarget.nombre}` : 'Notificar a todos'}
              </h3>
              <button onClick={() => setShowNotif(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Para</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setNotifTarget(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${!notifTarget ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 text-slate-500'}`}>
                    👥 Todos
                  </button>
                  {perfiles.filter(p=>p.activo).map(p => (
                    <button key={p.id} onClick={() => setNotifTarget(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${notifTarget?.id===p.id ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-slate-700 text-slate-500'}`}>
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Título</label>
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Ej: Acordate del stock"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Mensaje</label>
                <textarea value={notifBody} onChange={e => setNotifBody(e.target.value)} rows={3} placeholder="Ej: Hay que pedir tomate hoy"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" />
              </div>
              {notifSent && <p className="text-green-400 text-xs font-bold flex items-center gap-1"><Check size={12} /> Enviada</p>}
              <button onClick={sendNotif} disabled={sendingNotif || !notifTitle.trim() || !notifBody.trim()}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {sendingNotif ? <><RefreshCw size={16} className="animate-spin" /> Enviando...</> : <><Send size={16} /> Enviar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
