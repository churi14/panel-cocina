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

  // Sin sesión → login (vuelven a /)
  if (!perfil) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  // Operador → redirigir al panel de cocina
  if (perfil.rol === 'operador') {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  return <AdminDashboard onLock={signOut} />;
}