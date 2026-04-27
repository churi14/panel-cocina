// ─────────────────────────────────────────────────────────────────────────────
// kitchenHelpers.ts — Funciones de persistencia, descuento de stock y mapas
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { checkAndNotifyStock, checkAndNotifyProduccionByName } from './pushEvents';
export { checkAndNotifyStock, checkAndNotifyProduccionByName };

export function formatQty(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  }
  return `${grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)} gr`;
}

// ── Persistencia cocina ───────────────────────────────────────────────────────

export async function saveCocinaProduccion(
  id: number, recipeName: string, targetUnits: number,
  unit: string, baseQtyKg: number, startTime: number,
  operadorCocina: string, recipeId?: string
) {
  try {
    await supabase.from('cocina_produccion_activa').insert({
      id, recipe_name: recipeName, recipe_id: recipeId ?? null,
      target_units: targetUnits, unit, base_qty_kg: baseQtyKg,
      start_time: startTime, status: 'running',
      operador: operadorCocina, updated_at: new Date().toISOString(),
    });
    await supabase.from('produccion_eventos').insert({
      tipo: 'inicio_cocina', kind: 'cocina', corte: recipeName,
      operador: operadorCocina, peso_kg: baseQtyKg,
      detalle: `Inicio cocina — ${recipeName}`, fecha: new Date().toISOString(),
    });
  } catch (e) { console.error('Error guardando producción cocina:', e); }
}

export async function clearCocinaProduccion(
  prodId: number, recipeName: string, baseQtyKg: number, operadorCocina: string
) {
  try {
    await supabase.from('cocina_produccion_activa').delete().eq('id', prodId);
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'cocina', corte: recipeName,
      operador: operadorCocina, peso_kg: baseQtyKg,
      detalle: `Fin cocina — ${recipeName}`, fecha: new Date().toISOString(),
    });
  } catch (e) { console.error('Error limpiando producción cocina:', e); }
}

// ── Descuento de stock para menjunje milanesa ─────────────────────────────────

export async function deductStockForMilanesa(
  corteNombre: string,
  cantidadKg: number,
  ingredientes: { nombre: string; cantidad: number; unidad: string }[]
) {
  try {
    const productoMila = `Milanesa - ${corteNombre}`;
    const { data: milaData } = await supabase
      .from('stock_produccion').select('id, cantidad')
      .eq('producto', productoMila).maybeSingle();
    if (milaData) {
      const newQty = parseFloat((Number(milaData.cantidad) - cantidadKg).toFixed(3));
      await supabase.from('stock_produccion').update({ cantidad: newQty }).eq('id', milaData.id);
      await checkAndNotifyProduccionByName(productoMila, newQty, 'kg', supabase);
    }
    for (const ing of ingredientes) {
      const { data: sd } = await supabase.from('stock').select('id, cantidad').ilike('nombre', ing.nombre).maybeSingle();
      if (sd) {
        const newQty = parseFloat((Number(sd.cantidad) - ing.cantidad).toFixed(3));
        await supabase.from('stock').update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) }).eq('id', sd.id);
        await supabase.from('stock_movements').insert({
          nombre: ing.nombre, categoria: 'SECOS', tipo: 'egreso',
          cantidad: ing.cantidad, unidad: ing.unidad,
          motivo: `Menjunje Milanesa — ${productoMila}`,
          operador: 'Cocina', fecha: new Date().toISOString(),
        });
      }
    }
  } catch (e) { console.error('Error descontando stock menjunje:', e); }
}

// ── Fraccionado de salsas ─────────────────────────────────────────────────────

export async function deductStockForFraccion(
  stockNombre: string, stockOrigen: 'stock' | 'stock_produccion',
  kgUsado: number, potesProducidos: number, tipoPote: string, operador: string
) {
  if (kgUsado <= 0 || potesProducidos <= 0) return;
  const tabla = stockOrigen === 'stock' ? 'stock' : 'stock_produccion';
  const campoNombre = stockOrigen === 'stock' ? 'nombre' : 'producto';
  const { data } = await supabase.from(tabla).select('id, cantidad').eq(campoNombre, stockNombre).maybeSingle();
  if (data) {
    const newQty = parseFloat((Number(data.cantidad) - kgUsado).toFixed(3));
    await supabase.from(tabla).update({
      cantidad: newQty,
      ...(stockOrigen === 'stock'
        ? { fecha_actualizacion: new Date().toISOString().slice(0, 10) }
        : { ultima_prod: new Date().toISOString() })
    }).eq('id', data.id);
    if (stockOrigen === 'stock') {
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'SECOS', tipo: 'egreso',
        cantidad: parseFloat(kgUsado.toFixed(3)), unidad: 'kg',
        motivo: `Fraccionado ${stockNombre} — ${potesProducidos}u ${tipoPote}`,
        operador, fecha: new Date().toISOString(),
      });
    }
  }
  const { data: pd } = await supabase.from('stock_produccion').select('id, cantidad').ilike('producto', `%${stockNombre}%`).maybeSingle();
  if (pd) {
    await supabase.from('stock_produccion').update({ cantidad: Number(pd.cantidad) + potesProducidos, ultima_prod: new Date().toISOString() }).eq('id', pd.id);
  } else {
    await supabase.from('stock_produccion').insert({ producto: `POTES ${stockNombre}`, categoria: 'dip', cantidad: potesProducidos, unidad: 'u', ultima_prod: new Date().toISOString() });
  }
  await supabase.from('produccion_eventos').insert({
    tipo: 'fin_cocina', kind: 'salsa', corte: stockNombre, peso_kg: kgUsado,
    operador, detalle: `${potesProducidos} potes ${tipoPote} · ${kgUsado.toFixed(3)}kg`,
    fecha: new Date().toISOString(),
  });
}

// ── Mapas de stock por receta ─────────────────────────────────────────────────

export const VERDURA_STOCK_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'TOMATE',
  'verdura_lechuga':          'LECHUGA',
  'verdura_cebolla_brunoise': 'CEBOLLA',
  'verdura_cebolla_rodajas':  'CEBOLLA',
  'verdura_morron':           'MORRON',
  'verdura_ajo':              'AJO',
  'verdura_verdeo':           'CEBOLLA DE VERDEO',
};

export const VERDURA_PROD_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'Tomate cortado',
  'verdura_lechuga':          'Lechuga preparada',
  'verdura_cebolla_brunoise': 'Cebolla brunoise',
  'verdura_cebolla_rodajas':  'Cebolla rodajas',
  'verdura_morron':           'Morrón preparado',
  'verdura_ajo':              'Ajo preparado',
  'verdura_verdeo':           'Cebolla de verdeo',
};

export const FIAMBRE_STOCK_MAP: Record<string, string> = {
  'fiambre_jamon':          'JAMÓN',
  'fiambre_panceta':        'PANCETA',
  'fiambre_cheddar_feta':   'CHEDDAR EN FETA',
  'fiambre_cheddar_liq':    'CHEDDAR LIQUIDO',
  'fiambre_cheddar_burger': 'CHEDDAR PARA BURGUER',
  'fiambre_provoleta':      'PROVOLETA',
  'fiambre_muzza_sanguch':  'QUESO MUZZA',
  'fiambre_muzza_mila':     'QUESO MUZZA',
  'fiambre_tybo':           'QUESO TYBO',
};

export const FIAMBRE_PROD_MAP: Record<string, string> = {
  'fiambre_jamon':          'JAMÓN',
  'fiambre_panceta':        'PANCETA',
  'fiambre_cheddar_feta':   'CHEDDAR EN FETA',
  'fiambre_cheddar_liq':    'CHEDDAR LIQUIDO',
  'fiambre_cheddar_burger': 'CHEDDAR PARA BURGUER',
  'fiambre_provoleta':      'PROVOLETA',
  'fiambre_muzza_sanguch':  'Queso Muzza para Sanguchería',
  'fiambre_muzza_mila':     'Queso Muzza para Mila al Plato',
  'fiambre_tybo':           'QUESO TYBO',
};

// ── Utilidades de validación decimal ─────────────────────────────────────────

export function sugerirDecimal(valor: number, limiteMax: number): number | null {
  if (valor <= limiteMax) return null;
  const strVal = String(Math.round(valor));
  for (let i = 1; i < strVal.length; i++) {
    const cand = parseFloat(strVal.slice(0, i) + '.' + strVal.slice(i));
    if (cand > 0 && cand <= limiteMax) return cand;
  }
  return null;
}



const FIAMBRE_UNIDAD_MAP: Record<string, string> = {
  'fiambre_cheddar_feta': 'u',
};

export async function deductStockForFiambre(recipeId: string, pesoKg: number, operador: string) {
  const stockNombre = FIAMBRE_STOCK_MAP[recipeId];
  const prodNombre  = FIAMBRE_PROD_MAP[recipeId];
  const unidad      = FIAMBRE_UNIDAD_MAP[recipeId] ?? 'kg';
  if (!stockNombre || pesoKg <= 0) return;
  try {
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = parseFloat((Number(data.cantidad) - pesoKg).toFixed(3));
      await supabase.from('stock')
        .update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'FIAMBRE', tipo: 'egreso',
        cantidad: pesoKg, unidad,
        motivo: `Producción ${prodNombre}`, operador, fecha: new Date().toISOString(),
      });
    }
    if (pesoKg > 0 && prodNombre) {
      const { data: pd } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', prodNombre).maybeSingle();
      if (pd) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(pd.cantidad) + pesoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', pd.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'fiambre', cantidad: pesoKg, unidad, ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) { console.error('Error deductStockForFiambre:', e); }
}
// ── Descuento de stock para verduras ─────────────────────────────────────────

export async function deductStockForVerdura(recipeId: string, brutoPesoKg: number, desperdicioKg: number) {
  const stockNombre = VERDURA_STOCK_MAP[recipeId];
  const prodNombre  = VERDURA_PROD_MAP[recipeId];
  if (!stockNombre || brutoPesoKg <= 0) return;
  const netoKg = Math.max(0, brutoPesoKg - desperdicioKg);
  try {
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = parseFloat((Number(data.cantidad) - brutoPesoKg).toFixed(3));
      await supabase.from('stock')
        .update({ cantidad: newQty, fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'verduras', tipo: 'egreso',
        cantidad: parseFloat(brutoPesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Producción ${prodNombre}`, operador: 'Cocina', fecha: new Date().toISOString(),
      });
      await supabase.from('produccion_eventos').insert({
        tipo: 'fin_cocina', kind: 'cocina', corte: prodNombre,
        peso_kg: brutoPesoKg, waste_kg: desperdicioKg, operador: 'Cocina',
        detalle: `Bruto: ${brutoPesoKg}kg | Desperdicio: ${desperdicioKg}kg | Neto: ${netoKg}kg`,
        fecha: new Date().toISOString(),
      });
    }
    if (netoKg > 0) {
      const { data: pd } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', prodNombre).maybeSingle();
      if (pd) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(pd.cantidad) + netoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', pd.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'verduras', cantidad: parseFloat(netoKg.toFixed(3)), unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) { console.error('Error deductStockForVerdura:', e); }
}