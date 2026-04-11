"use client";

import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ChefHat, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Completá todos los campos'); return; }
    setLoading(true); setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(err.includes('Invalid') ? 'Email o contraseña incorrectos' : err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">La Cocina</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de Gestión</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 pr-12 outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-sm"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          ¿No tenés acceso? Contactá al administrador.
        </p>
      </div>
    </div>
  );
}