"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';
import { testModeStore } from '../testModeStore';

const LS_KEY     = 'test_mode_active';
const LS_SID_KEY = 'test_mode_session_id';

interface TestModeContextValue {
  isTestMode: boolean;
  sessionId: string | null;
  activarTestMode: () => void;
  limpiarTestMode: () => Promise<{ ok: boolean; detalle: string }>;
}

const TestModeContext = createContext<TestModeContextValue>({
  isTestMode: false,
  sessionId: null,
  activarTestMode: () => {},
  limpiarTestMode: async () => ({ ok: false, detalle: '' }),
});

export function useTestMode() {
  return useContext(TestModeContext);
}

function newSessionId() {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  // Inicializar desde localStorage para que funcione entre pestañas
  const [isTestMode, setIsTestMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LS_KEY) === 'true';
  });
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LS_SID_KEY);
  });

  // Sincronizar el store global al montar (para que el proxy de supabase lo sepa)
  useEffect(() => {
    const sid = localStorage.getItem(LS_SID_KEY);
    const active = localStorage.getItem(LS_KEY) === 'true';
    if (active && sid) {
      testModeStore.activate(sid);
      setIsTestMode(true);
      setSessionId(sid);
    }
  }, []);

  // Escuchar cambios de otras pestañas via storage event
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) {
        const active = e.newValue === 'true';
        const sid = localStorage.getItem(LS_SID_KEY);
        if (active && sid) {
          testModeStore.activate(sid);
          setIsTestMode(true);
          setSessionId(sid);
        } else {
          testModeStore.deactivate();
          setIsTestMode(false);
          setSessionId(null);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const activarTestMode = useCallback(() => {
    const sid = newSessionId();
    localStorage.setItem(LS_KEY, 'true');
    localStorage.setItem(LS_SID_KEY, sid);
    testModeStore.activate(sid);
    setSessionId(sid);
    setIsTestMode(true);
  }, []);

  const limpiarTestMode = useCallback(async (): Promise<{ ok: boolean; detalle: string }> => {
    const sid = sessionId ?? localStorage.getItem(LS_SID_KEY);
    if (!sid) return { ok: false, detalle: 'No hay sesión activa' };

    try {
      let detalle = '';

      // 1. Revertir UPDATEs de stock desde el log
      const { data: logs } = await supabase
        .from('test_rollback_log')
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: false });

      if (logs && logs.length > 0) {
        for (const log of logs) {
          await supabase
            .from(log.tabla)
            .update({ [log.columna]: log.valor_anterior })
            .eq('id', log.row_id);
        }
        detalle += `${logs.length} cambios de stock revertidos. `;
      }

      await supabase.from('test_rollback_log').delete().eq('session_id', sid);

      // 2. Borrar todos los inserts etiquetados
      const { data: mov }  = await supabase.from('stock_movements').delete().eq('es_test', true).select('id');
      const { data: prod } = await supabase.from('stock_produccion').delete().eq('es_test', true).select('id');
      const { data: ev }   = await supabase.from('produccion_eventos').delete().eq('es_test', true).select('id');
      const { data: coc }  = await supabase.from('cocina_produccion_activa').delete().eq('es_test', true).select('id');

      detalle += `Borrados: ${mov?.length ?? 0} movimientos, ${prod?.length ?? 0} prod, ${ev?.length ?? 0} eventos, ${coc?.length ?? 0} activas.`;

      // 3. Desactivar en todas las pestañas
      localStorage.setItem(LS_KEY, 'false');
      localStorage.removeItem(LS_SID_KEY);
      testModeStore.deactivate();
      setIsTestMode(false);
      setSessionId(null);

      return { ok: true, detalle };
    } catch (e: any) {
      return { ok: false, detalle: e.message ?? 'Error desconocido' };
    }
  }, [sessionId]);

  return (
    <TestModeContext.Provider value={{ isTestMode, sessionId, activarTestMode, limpiarTestMode }}>
      {children}
    </TestModeContext.Provider>
  );
}