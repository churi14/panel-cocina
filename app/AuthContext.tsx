"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Rol = 'admin' | 'operador' | 'administrativa';

export type Perfil = {
  id: string;
  nombre: string;
  rol: Rol;
  local: string | null;
  activo: boolean;
};

type AuthContextType = {
  user:    User | null;
  perfil:  Perfil | null;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin:         boolean;
  isOperador:      boolean;
  isAdministrativa: boolean;
};

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null, perfil: null, loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  isAdmin: false, isOperador: false, isAdministrativa: false,
});

export function useAuth() { return useContext(AuthContext); }

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [perfil,  setPerfil]  = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPerfil = async (userId: string) => {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    setPerfil(data as Perfil ?? null);
  };

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchPerfil(session.user.id);
      setLoading(false);
    });

    // Cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchPerfil(session.user.id);
      else setPerfil(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  };

  return (
    <AuthContext.Provider value={{
      user, perfil, loading, signIn, signOut,
      isAdmin:          perfil?.rol === 'admin',
      isOperador:       perfil?.rol === 'operador',
      isAdministrativa: perfil?.rol === 'administrativa',
    }}>
      {children}
    </AuthContext.Provider>
  );
}