"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────
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

// ── Hook público ──────────────────────────────────────────────────────────────
export function useTestMode() {
  return useContext(TestModeContext);
}

// ── Generador de session ID ───────────────────────────────────────────────────
function newSessionId() {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const activarTestMode = useCallback(() => {
    const sid = newSessionId();
    setSessionId(sid);
    setIsTestMode(true);
    console.log(`[TEST MODE] Activado. Session: ${sid}`);
  }, []);

  const limpiarTestMode = useCallback(async (): Promise<{ ok: boolean; detalle: string }> => {
    if (!sessionId) return { ok: false, detalle: 'No hay sesión activa' };

    try {
      let detalle = '';

      // 1. Revertir UPDATEs de stock — leer el log y volver a los valores anteriores
      const { data: logs } = await supabase
        .from('test_rollback_log')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }); // revertir en orden inverso

      if (logs && logs.length > 0) {
        for (const log of logs) {
          await supabase
            .from(log.tabla)
            .update({ [log.columna]: log.valor_anterior })
            .eq('id', log.row_id);
        }
        detalle += `${logs.length} cambios de stock revertidos. `;
      }

      // 2. Borrar log de rollback
      await supabase.from('test_rollback_log').delete().eq('session_id', sessionId);

      // 3. Borrar inserts etiquetados
      const { count: movCount } = await supabase
        .from('stock_movements').delete().eq('es_test', true).select('*', { count: 'exact', head: true });

      const { count: prodCount } = await supabase
        .from('stock_produccion').delete().eq('es_test', true).select('*', { count: 'exact', head: true });

      const { count: evCount } = await supabase
        .from('produccion_eventos').delete().eq('es_test', true).select('*', { count: 'exact', head: true });

      const { count: cocCount } = await supabase
        .from('cocina_produccion_activa').delete().eq('es_test', true).select('*', { count: 'exact', head: true });

      detalle += `Borrados: ${movCount ?? 0} movimientos, ${prodCount ?? 0} prod. activas, ${evCount ?? 0} eventos, ${cocCount ?? 0} cocina activa.`;

      // 4. Desactivar
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