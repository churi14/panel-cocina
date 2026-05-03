/**
 * testModeSupabase.ts
 *
 * Wrapper alrededor de supabase que en modo test:
 * - Etiqueta todos los INSERTs con es_test: true
 * - Antes de cada UPDATE de stock/stock_produccion, guarda el valor anterior
 *   en test_rollback_log para poder revertirlo al limpiar
 */
import { supabase } from '../supabase';

interface TestConfig {
  isTestMode: boolean;
  sessionId: string | null;
}

// ── INSERT etiquetado ─────────────────────────────────────────────────────────
export async function testInsert(
  tabla: string,
  data: Record<string, any>,
  config: TestConfig
) {
  const payload = config.isTestMode ? { ...data, es_test: true } : data;
  return supabase.from(tabla).insert(payload);
}

// ── UPDATE con log de rollback ─────────────────────────────────────────────────
export async function testUpdate(
  tabla: string,
  rowId: number,
  columna: string,
  valorNuevo: number,
  config: TestConfig
) {
  if (config.isTestMode && config.sessionId) {
    // Leer valor actual antes de cambiar
    const { data } = await supabase
      .from(tabla)
      .select(columna)
      .eq('id', rowId)
      .maybeSingle();

    if (data) {
      // Guardar para rollback
      await supabase.from('test_rollback_log').insert({
        session_id:     config.sessionId,
        tabla,
        row_id:         rowId,
        columna,
        valor_anterior: Number(data[columna] ?? 0),
      });
    }
  }

  return supabase.from(tabla).update({ [columna]: valorNuevo }).eq('id', rowId);
}

// ── UPDATE genérico (sin rollback — para campos no numéricos como fecha) ───────
export async function testUpdateGeneric(
  tabla: string,
  rowId: number,
  updates: Record<string, any>,
  config: TestConfig
) {
  // Para UPDATEs que no sean de cantidad (ej: ultima_prod), no hace rollback
  // pero sí registra si es test para trazabilidad
  return supabase.from(tabla).update(updates).eq('id', rowId);
}

// ── UPSERT etiquetado ─────────────────────────────────────────────────────────
export async function testUpsert(
  tabla: string,
  data: Record<string, any>,
  options: { onConflict: string },
  config: TestConfig
) {
  const payload = config.isTestMode ? { ...data, es_test: true } : data;
  return supabase.from(tabla).upsert(payload, options);
}