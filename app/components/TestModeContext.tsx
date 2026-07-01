"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { testModeStore } from '../testModeStore';

interface TestModeContextValue {
  isTestMode: boolean;
  sessionId: string | null;
  activarTestMode: () => Promise<void>;
  limpiarTestMode: () => Promise<{ ok: boolean; detalle: string }>;
}

const TestModeContext = createContext<TestModeContextValue>({
  isTestMode: false,
  sessionId: null,
  activarTestMode: async () => {},
  limpiarTestMode: async () => ({ ok: false, detalle: '' }),
});

export function useTestMode() {
  return useContext(TestModeContext);
}

function newSessionId() {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  // ── Leer estado inicial y suscribirse a cambios en tiempo real ──────────────
  useEffect(() => {
    // 1. Leer estado actual desde Supabase
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'test_mode')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const active = data.value.active === true;
          const sid    = data.value.session_id ?? null;
          setIsTestMode(active);
          setSessionId(sid);
          if (active && sid) testModeStore.activate(sid);
        }
      });

    // 2. Suscribirse a cambios en tiempo real (funciona entre dispositivos)
    channelRef.current = supabase
      .channel('system_config_test_mode')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_config', filter: 'key=eq.test_mode' },
        (payload) => {
          const val    = (payload.new as any).value;
          const active = val?.active === true;
          const sid    = val?.session_id ?? null;
          setIsTestMode(active);
          setSessionId(sid);
          if (active && sid) testModeStore.activate(sid);
          else               testModeStore.deactivate();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Activar modo test ────────────────────────────────────────────────────────
  const activarTestMode = useCallback(async () => {
    const sid = newSessionId();
    await supabase
      .from('system_config')
      .update({ value: { active: true, session_id: sid } })
      .eq('key', 'test_mode');
    // El realtime lo actualizará en todos los dispositivos
    // pero también actualizamos local por si el evento tarda
    testModeStore.activate(sid);
    setIsTestMode(true);
    setSessionId(sid);
  }, []);

  // ── Limpiar modo test ────────────────────────────────────────────────────────
  const limpiarTestMode = useCallback(async (): Promise<{ ok: boolean; detalle: string }> => {
    const sid = sessionId;
    if (!sid) return { ok: false, detalle: 'No hay sesión activa' };

    try {
      let detalle = '';

      // 1. Revertir UPDATEs de stock
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
        detalle += `${logs.length} cambios revertidos. `;
      }
      await supabase.from('test_rollback_log').delete().eq('session_id', sid);

      // 2. Borrar inserts etiquetados
      const { data: mov }  = await supabase.from('stock_movements').delete().eq('es_test', true).select('id');
      const { data: prod } = await supabase.from('stock_produccion').delete().eq('es_test', true).select('id');
      const { data: ev }   = await supabase.from('produccion_eventos').delete().eq('es_test', true).select('id');
      const { data: coc }  = await supabase.from('cocina_produccion_activa').delete().eq('es_test', true).select('id');
      detalle += `Borrados: ${mov?.length ?? 0} movimientos, ${prod?.length ?? 0} prod, ${ev?.length ?? 0} eventos, ${coc?.length ?? 0} activas.`;

      // 3. Desactivar en todos los dispositivos via Supabase
      await supabase
        .from('system_config')
        .update({ value: { active: false, session_id: null } })
        .eq('key', 'test_mode');

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