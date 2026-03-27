import { supabase } from '../../supabase';
import { ButcheryProduction } from '../../types';

// Convierte producción a formato Supabase
function toRow(p: ButcheryProduction) {
  return {
    id: p.id,
    batch_id: p.batchId,
    kind: p.kind ?? null,
    type: p.type,
    type_name: p.typeName,
    cut: p.cut,
    weight_kg: p.weightKg,
    status: p.status,
    start_time: p.startTime,
    end_time: p.endTime ?? null,
    duration_seconds: p.durationSeconds ?? null,
    start_time_fmt: p.startTimeFormatted,
    end_time_fmt: p.endTimeFormatted ?? null,
    step2_start_time: p.step2StartTime ?? null,
    step2_end_time: p.step2EndTime ?? null,
    date: p.date,
    updated_at: new Date().toISOString(),
  };
}

// Convierte fila de Supabase a producción
function fromRow(row: any): ButcheryProduction {
  return {
    id: row.id,
    batchId: row.batch_id,
    kind: row.kind,
    type: row.type,
    typeName: row.type_name,
    cut: row.cut,
    weightKg: parseFloat(row.weight_kg),
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
    startTimeFormatted: row.start_time_fmt,
    endTimeFormatted: row.end_time_fmt,
    step2StartTime: row.step2_start_time,
    step2EndTime: row.step2_end_time,
    date: row.date,
  };
}

// Cargar producciones activas (todo menos step2_done)
export async function loadProduccionesActivas(): Promise<ButcheryProduction[]> {
  try {
    const { data, error } = await supabase
      .from('producciones_activas')
      .select('*')
      .neq('status', 'step2_done')
      .order('start_time');
    if (error) { console.error('Error cargando producciones:', error); return []; }
    return (data ?? []).map(fromRow);
  } catch (e) {
    console.error('Error en loadProduccionesActivas:', e);
    return [];
  }
}

// Guardar/actualizar una producción
export async function saveProduccion(p: ButcheryProduction) {
  try {
    await supabase.from('producciones_activas').upsert(toRow(p));
  } catch (e) {
    console.error('Error guardando producción:', e);
  }
}

// Guardar múltiples producciones
export async function saveProduccionesMany(prods: ButcheryProduction[]) {
  try {
    await supabase.from('producciones_activas').upsert(prods.map(toRow));
  } catch (e) {
    console.error('Error guardando producciones:', e);
  }
}

// Marcar como completada (step2_done) — la deja en tabla para historial
export async function markProduccionDone(id: number) {
  try {
    await supabase.from('producciones_activas')
      .update({ status: 'step2_done', updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (e) {
    console.error('Error marcando producción done:', e);
  }
}

// Eliminar producciones completadas más viejas de 24hs (limpieza)
export async function cleanOldProducciones() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('producciones_activas')
      .delete()
      .eq('status', 'step2_done')
      .lt('updated_at', cutoff);
  } catch (e) { /* silencioso */ }
}