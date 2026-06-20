import { supabase } from '../../supabase';

export async function addToStockProduccion({
  producto,
  categoria,
  cantidad,
  unidad,
  motivo,
  operador,
}: {
  producto: string;
  categoria: 'lomito' | 'burger' | 'milanesa' | 'carnes_limpias';
  cantidad: number;
  unidad: 'u' | 'kg';
  motivo?: string;
  operador?: string;
}) {
  if (!cantidad || cantidad <= 0) return;

  try {
    // Suma atómica vía función de Postgres (INSERT ... ON CONFLICT DO UPDATE)
    // Esto evita la condición de carrera que generaba filas duplicadas cuando
    // dos producciones del mismo producto se finalizaban casi al mismo tiempo.
    const { error: rpcError } = await supabase.rpc('increment_stock_produccion', {
      p_producto: producto,
      p_categoria: categoria,
      p_cantidad: cantidad,
      p_unidad: unidad,
    });

    if (rpcError) {
      console.error('Error en increment_stock_produccion:', rpcError);
      return;
    }

    // Registrar ingreso en stock_movements para visibilidad en admin
    await supabase.from('stock_movements').insert({
      nombre: producto,
      categoria: categoria,
      tipo: 'ingreso',
      cantidad,
      unidad,
      motivo: motivo ?? `Producción finalizada`,
      operador: operador ?? 'Sistema',
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error en addToStockProduccion:', e);
  }
}