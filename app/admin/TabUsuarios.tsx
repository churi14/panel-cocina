"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, X, Check, RefreshCw, Eye, EyeOff, ShieldCheck, Edit2, Trash2 } from 'lucide-react';

type Rol = 'admin' | 'operador' | 'administrativa';

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  local: string | null;
  activo: boolean;
  created_at?: string;
};

const ROL_CONFIG: Record<Rol, { label: string; color: string; bg: string }> = {
  admin:          { label: 'Admin',          color: 'text-blue-400',   bg: 'bg-blue-500/20 border-blue-500/30' },
  administrativa: { label: 'Administrativa', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  operador:       { label: 'Operador',       color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30' },
};

const LOCALES = ['burger', 'lomito', 'milanesa', 'todos'];

export default function TabUsuarios() {
  const [usuarios, setUsuarios]     = useState<Usuario[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  // Form state
  const [nombre, setNombre]         = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [rol, setRol]               = useState<Rol>('operador');
  const [local, setLocal]           = useState('todos');
  const [activo, setActivo]         = useState(true);

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data } = await supabase.from('perfiles').select('*').order('nombre');
    setUsuarios((data as Usuario[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const resetForm = () => {
    setNombre(''); setEmail(''); setPassword('');
    setRol('operador'); setLocal('todos'); setActivo(true);
    setEditingUser(null); setError(''); setSuccess('');
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (u: Usuario) => {
    setEditingUser(u);
    setNombre(u.nombre); setEmail(u.email);
    setRol(u.rol); setLocal(u.local ?? 'todos'); setActivo(u.activo);
    setPassword(''); setError(''); setSuccess('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!nombre.trim() || !email.trim()) { setError('Nombre y email son obligatorios'); return; }
    if (!editingUser && !password) { setError('Ingresá una contraseña para el nuevo usuario'); return; }
    setSaving(true); setError('');

    try {
      if (editingUser) {
        // Editar perfil existente
        const { error: err } = await supabase.from('perfiles').update({
          nombre: nombre.trim(),
          rol,
          local: local === 'todos' ? null : local,
          activo,
        }).eq('id', editingUser.id);
        if (err) throw err;

        // Si ingresó nueva contraseña, actualizarla via API interna
        if (password) {
          const res = await fetch('/api/admin/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingUser.id, password }),
          });
          if (!res.ok) throw new Error('Error al actualizar contraseña');
        }
        setSuccess('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, nombre: nombre.trim(), rol, local: local === 'todos' ? null : local }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al crear usuario');
        setSuccess('Usuario creado correctamente');
      }

      await fetchUsuarios();
      setTimeout(() => { setShowForm(false); resetForm(); }, 1500);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleToggleActivo = async (u: Usuario) => {
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id);
    await fetchUsuarios();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users size={20} /> Gestión de Usuarios
          </h2>
          <p className="text-slate-400 text-sm mt-1">{usuarios.length} usuarios registrados</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl transition-colors">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Lista de usuarios */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="text-slate-500 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {usuarios.map(u => (
            <div key={u.id}
              className={`bg-slate-900 border rounded-2xl p-4 flex items-center gap-4 transition-all
                ${u.activo ? 'border-slate-800' : 'border-slate-800 opacity-50'}`}>

              {/* Avatar */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0
                ${u.activo ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-600'}`}>
                {u.nombre.slice(0,1).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white">{u.nombre}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${ROL_CONFIG[u.rol].bg} ${ROL_CONFIG[u.rol].color}`}>
                    {ROL_CONFIG[u.rol].label}
                  </span>
                  {!u.activo && <span className="text-xs text-slate-500 font-bold">INACTIVO</span>}
                </div>
                <p className="text-slate-400 text-xs mt-0.5 truncate">{u.email}</p>
                {u.local && <p className="text-slate-500 text-xs">Local: {u.local}</p>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(u)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-400 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleToggleActivo(u)}
                  className={`p-2 rounded-xl transition-colors ${u.activo
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-amber-400'
                    : 'hover:bg-slate-800 text-slate-600 hover:text-green-400'}`}>
                  {u.activo ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-400" />
                {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Matías"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
              </div>

              {/* Email (solo en creación) */}
              {!editingUser && (
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-1 block">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="operador@cocina.com"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-1 block">
                  {editingUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                </label>
                <div className="relative">
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type={showPass ? 'text' : 'password'}
                    placeholder={editingUser ? '(sin cambios)' : 'Mínimo 6 caracteres'}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 pr-10" />
                  <button onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Rol */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'administrativa', 'operador'] as Rol[]).map(r => (
                    <button key={r} onClick={() => setRol(r)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all
                        ${rol === r ? `${ROL_CONFIG[r].bg} ${ROL_CONFIG[r].color}` : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                      {ROL_CONFIG[r].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local (solo operadores) */}
              {rol === 'operador' && (
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Local asignado</label>
                  <div className="grid grid-cols-4 gap-2">
                    {LOCALES.map(l => (
                      <button key={l} onClick={() => setLocal(l)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all capitalize
                          ${local === l ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                        {l === 'todos' ? 'Todos' : l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Activo toggle (solo edición) */}
              {editingUser && (
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-400 uppercase">Estado</label>
                  <button onClick={() => setActivo(v => !v)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black border transition-all
                      ${activo ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-slate-700 text-slate-500'}`}>
                    {activo ? '✓ Activo' : 'Inactivo'}
                  </button>
                </div>
              )}

              {error   && <p className="text-red-400 text-xs font-bold">{error}</p>}
              {success && <p className="text-green-400 text-xs font-bold flex items-center gap-1"><Check size={12} /> {success}</p>}

              <button onClick={handleSave} disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</> : <><Check size={16} /> {editingUser ? 'Guardar cambios' : 'Crear usuario'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}