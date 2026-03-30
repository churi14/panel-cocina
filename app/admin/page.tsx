"use client";

import React from 'react';
import { useAuth } from '../AuthContext';
import AdminDashboard from './AdminDashboard';

export default function AdminPage() {
  const { perfil, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!perfil || perfil.rol === 'operador') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white font-black text-xl mb-2">Sin acceso</p>
          <p className="text-slate-400 text-sm mb-6">Tu usuario no tiene permisos para esta sección.</p>
          <a href="/" className="px-6 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-sm inline-block">
            Ir al panel
          </a>
        </div>
      </div>
    );
  }

  return <AdminDashboard onLock={signOut} />;
}