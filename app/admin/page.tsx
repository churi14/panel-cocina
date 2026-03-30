"use client";

import React, { useEffect } from 'react';
import { useAuth } from '../AuthContext';
import AdminDashboard from './AdminDashboard';

export default function AdminPage() {
  const { perfil, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!perfil || perfil.rol === 'operador') {
      window.location.replace('/');
    }
  }, [perfil, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!perfil || perfil.rol === 'operador') return null;

  return <AdminDashboard onLock={signOut} />;
}