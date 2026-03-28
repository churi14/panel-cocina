"use client";

import React from 'react';
import { useAuth } from '../AuthContext';
import AdminDashboard from './AdminDashboard';
import { ShieldX, ChefHat } from 'lucide-react';

export default function AdminPage() {
  const { perfil, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Solo admin y administrativa pueden entrar
  if (!perfil || (perfil.rol !== 'admin' && perfil.rol !== 'administrativa')) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldX size={32} className="text-red-400" />
          </div>
          <h1 className="text-white font-black text-xl mb-2">Acceso denegado</h1>
          <p className="text-slate-400 text-sm mb-6">Tu cuenta no tiene permisos para acceder al panel admin.</p>
          <button onClick={signOut}
            className="px-6 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors text-sm">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard onLock={signOut} />;
}