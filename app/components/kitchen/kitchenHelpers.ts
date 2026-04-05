import { supabase } from '../../supabase';
import { checkAndNotifyStock } from '../pushEvents';

export function formatQty(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  }
  return `${grams % 1 === 0 ? grams.toFixed(0) : grams.toFixed(1)} gr`;
}

export const KITCHEN_CATEGORIES = [
  { id: 'Panificados', label: 'Panificados',  border: 'border-amber-200', hover: 'hover:border-amber-400', icon: <Wheat   size={48} className="text-amber-600 mb-4" /> },
  { id: 'Salsas',      label: 'Salsas',       border: 'border-red-200',   hover: 'hover:border-red-400',   icon: <Droplet size={48} className="text-red-600 mb-4" /> },
  { id: 'Milanesas',   label: 'Milanesas',    border: 'border-rose-200',  hover: 'hover:border-rose-400',  icon: <ChefHat size={48} className="text-rose-600 mb-4" /> },
  { id: 'Verduras',    label: 'Verduras',     border: 'border-green-200', hover: 'hover:border-green-400', icon: <Carrot  size={48} className="text-green-600 mb-4" /> },
  { id: 'Prep',        label: 'Prep / Otros', border: 'border-blue-200',  hover: 'hover:border-blue-400',  icon: <Clock   size={48} className="text-blue-600 mb-4" /> },
];

// ─── PERSISTENCIA COCINA ──────────────────────────────────────────────────────

export async function saveCocinaProduccion(id: number, recipeName: string, targetUnits: number, unit: string, baseQtyKg: number, startTime: number, operadorCocina: string) {
  try {
    await supabase.from('cocina_produccion_activa').insert({
      id,
      recipe_name: recipeName,
      target_units: targetUnits,
      unit,
      base_qty_kg: baseQtyKg,
      start_time: startTime,
      status: 'running',
      operador: operadorCocina,
      updated_at: new Date().toISOString(),
    });
    // Notificar al panel admin via produccion_eventos
    await supabase.from('produccion_eventos').insert({
      tipo: 'inicio_cocina',
      kind: 'cocina',
      corte: recipeName,
      operador: operadorCocina,
      peso_kg: baseQtyKg,
      detalle: `Inicio cocina — ${recipeName}`,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error guardando producción cocina:', e);
  }
}

export async function clearCocinaProduccion(prodId: number, recipeName: string, baseQtyKg: number, operadorCocina: string) {
  try {
    await supabase.from('cocina_produccion_activa').delete().eq('id', prodId);
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina',
      kind: 'cocina',
      corte: recipeName,
      operador: operadorCocina,
      peso_kg: baseQtyKg,
      detalle: `Fin cocina — ${recipeName}`,
      fecha: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error limpiando producción cocina:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────


// ─── Descuento de stock para recetas de Milanesa (Menjunje) ───────────────────
export async function deductStockForMilanesa(
  corteNombre: string,  // ej: "Cuadrada", "Nalga"
  cantidadKg: number,   // kg de milanesa cruda a usar
  ingredientes: { nombre: string; cantidad: number; unidad: string }[]
) {
  try {
    // 1. Descontar del stock_produccion: Milanesa - {corte}
    const productoMila = `Milanesa - ${corteNombre}`;
    const { data: milaData } = await supabase
      .from('stock_produccion')
      .select('id, cantidad')
      .eq('producto', productoMila)
      .maybeSingle();

    if (milaData) {
      const newQty = Math.max(0, Number(milaData.cantidad) - cantidadKg);
      await supabase.from('stock_produccion')
        .update({ cantidad: parseFloat(newQty.toFixed(3)) })
        .eq('id', milaData.id);
    }

    // 2. Descontar ingredientes del stock directo (huevo, pan rallado, etc.)
    for (const ing of ingredientes) {
      const { data: stockData } = await supabase
        .from('stock')
        .select('id, cantidad')
        .ilike('nombre', ing.nombre)
        .maybeSingle();

      if (stockData) {
        const newQty = Math.max(0, Number(stockData.cantidad) - ing.cantidad);
        await supabase.from('stock')
          .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
          .eq('id', stockData.id);

        // Log movement
        await supabase.from('stock_movements').insert({
          nombre: ing.nombre, categoria: 'SECOS',
          tipo: 'egreso', cantidad: ing.cantidad, unidad: ing.unidad,
          motivo: `Menjunje Milanesa — ${productoMila}`,
          operador: 'Cocina', fecha: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('Error descontando stock menjunje:', e);
  }
}


// ─── Descuento de stock para salsas en potes ──────────────────────────────────
export const POTES_MAP: Record<string, string> = {
  'potes_ketchup':  'KETCHUP',
  'potes_barbacoa': 'BARBACOA',
  'potes_mayonesa': 'MAYONESA',
  'potes_savora':   'SAVORA',
};
const POTE_ML = 500; // ml por pote

export async function deductStockForSalsa(recipeId: string, baseKgUsado: number, potesProducidos: number) {
  try {
    const stockNombre = POTES_MAP[recipeId];
    if (!stockNombre || baseKgUsado <= 0) return;

    // 1. Descontar kg de stock directo
    const { data } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('nombre', stockNombre)
      .maybeSingle();

    if (data) {
      const newQty = Math.max(0, Number(data.cantidad) - baseKgUsado);
      await supabase.from('stock')
        .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'SECOS',
        tipo: 'egreso', cantidad: parseFloat(baseKgUsado.toFixed(3)), unidad: 'kg',
        motivo: `Producción potes ${stockNombre}`,
        operador: 'Cocina', fecha: new Date().toISOString(),
      });
    }

    // 2. Sumar potes a stock_produccion
    if (potesProducidos > 0) {
      const prodNombre = `Potes ${stockNombre.charAt(0) + stockNombre.slice(1).toLowerCase()} 500ml`;
      const { data: prodData } = await supabase
        .from('stock_produccion')
        .select('id, cantidad')
        .eq('producto', prodNombre)
        .maybeSingle();

      if (prodData) {
        await supabase.from('stock_produccion')
          .update({ cantidad: Number(prodData.cantidad) + potesProducidos, ultima_prod: new Date().toISOString() })
          .eq('id', prodData.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'salsas', cantidad: potesProducidos, unidad: 'u', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) {
    console.error('Error descontando stock salsa:', e);
  }
}


// ─── Stock map verduras: nombre en stock ──────────────────────────────────────
export const VERDURA_STOCK_MAP: Record<string, string> = {
  'verdura_tomate_rodajas': 'TOMATE',
  'verdura_lechuga':        'LECHUGA',
  'verdura_cebolla_brunoise': 'CEBOLLA',
  'verdura_cebolla_rodajas':  'CEBOLLA',
  'verdura_morron':           'MORRON',
};
export const VERDURA_PROD_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'Tomate cortado',
  'verdura_lechuga':          'Lechuga preparada',
  'verdura_cebolla_brunoise': 'Cebolla brunoise',
  'verdura_cebolla_rodajas':  'Cebolla rodajas',
  'verdura_morron':           'Morrón preparado',
};

export async function deductStockForVerdura(recipeId: string, brutoPesoKg: number, desperdicioKg: number) {
  const stockNombre = VERDURA_STOCK_MAP[recipeId];
  const prodNombre  = VERDURA_PROD_MAP[recipeId];
  if (!stockNombre || brutoPesoKg <= 0) return;

  const netoKg = Math.max(0, brutoPesoKg - desperdicioKg);

  try {
    // 1. Descontar bruto del stock
    const { data } = await supabase.from('stock')
      .select('id, cantidad').eq('nombre', stockNombre).maybeSingle();
    if (data) {
      const newQty = Math.max(0, Number(data.cantidad) - brutoPesoKg);
      await supabase.from('stock')
        .update({ cantidad: parseFloat(newQty.toFixed(3)), fecha_actualizacion: new Date().toISOString().slice(0, 10) })
        .eq('id', data.id);
      await checkAndNotifyStock(stockNombre, newQty, 'kg', data as any);
      await supabase.from('stock_movements').insert({
        nombre: stockNombre, categoria: 'VERDURA',
        tipo: 'egreso', cantidad: parseFloat(brutoPesoKg.toFixed(3)), unidad: 'kg',
        motivo: `Producción ${prodNombre}`, operador: 'Cocina', fecha: new Date().toISOString(),
      });
    }

    // 2. Sumar neto a stock_produccion
    if (netoKg > 0) {
      const { data: prodData } = await supabase.from('stock_produccion')
        .select('id, cantidad').eq('producto', prodNombre).maybeSingle();
      if (prodData) {
        await supabase.from('stock_produccion')
          .update({ cantidad: parseFloat((Number(prodData.cantidad) + netoKg).toFixed(3)), ultima_prod: new Date().toISOString() })
          .eq('id', prodData.id);
      } else {
        await supabase.from('stock_produccion')
          .insert({ producto: prodNombre, categoria: 'verduras', cantidad: parseFloat(netoKg.toFixed(3)), unidad: 'kg', ultima_prod: new Date().toISOString() });
      }
    }
  } catch (e) { console.error('Error deductStockForVerdura:', e); }
}

export const OPERADORES = ['Franco', 'Gisela', 'Julian', 'Milagros', 'Daiana', 'Emmanuel'];