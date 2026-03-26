import { supabase } from '../../supabase';

export async function addToStockProduccion({
  producto,
  categoria,
  cantidad,
  unidad,
}: {
  producto: string;
  categoria: 'lomito' | 'burger' | 'milanesa';
  cantidad: number;
  unidad: 'u' | 'kg';
}) {
  if (!cantidad || cantidad <= 0) return;

  try {
    // maybeSingle() no tira error si no encuentra nada (a diferencia de single())
    const { data, error: fetchError } = await supabase
      .from('stock_produccion')
      .select('id, cantidad')
      .eq('producto', producto)
      .maybeSingle();

    if (fetchError) {
      console.error('Error buscando stock_produccion:', fetchError);
      return;
    }

    if (data) {
      // Ya existe — suma
      const { error: updateError } = await supabase
        .from('stock_produccion')
        .update({
          cantidad: Number(data.cantidad) + cantidad,
          ultima_prod: new Date().toISOString(),
        })
        .eq('id', data.id);
      if (updateError) console.error('Error actualizando stock_produccion:', updateError);
    } else {
      // No existe — crea nuevo
      const { error: insertError } = await supabase
        .from('stock_produccion')
        .insert({
          producto,
          categoria,
          cantidad,
          unidad,
          ultima_prod: new Date().toISOString(),
        });
      if (insertError) console.error('Error insertando stock_produccion:', insertError);
    }
  } catch (e) {
    console.error('Error en addToStockProduccion:', e);
  }
}