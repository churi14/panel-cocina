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

// ── Ajuste de stock (atómico vía RPC, con fallback) ──────────────────────────

export function notifyError(contexto: string, err?: unknown) {
  console.error(`[cocina] ${contexto}`, err);
  if (typeof window !== 'undefined') {
    window.alert(`⚠️ ${contexto}. Avisale al admin para revisar el stock.`);
  }
}

type StockTabla = 'stock' | 'stock_produccion';

/** Suma `delta` (puede ser negativo) a una fila. Nunca baja de 0. Devuelve la cantidad nueva o null si falló. */
export async function adjustStock(tabla: StockTabla, id: string | number, delta: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('adjust_stock', { p_tabla: tabla, p_id: String(id), p_delta: delta });
  if (!error && data !== null && data !== undefined) return Number(data);
  // Fallback si la función SQL (sql/20261019_adjust_stock.sql) todavía no existe
  const { data: row, error: e1 } = await supabase.from(tabla).select('cantidad').eq('id', id).maybeSingle();
  if (e1 || !row) { console.error('adjustStock leer', e1); return null; }
  const nueva = Math.max(0, parseFloat((Number(row.cantidad) + delta).toFixed(3)));
  const { error: e2 } = await supabase.from(tabla).update({ cantidad: nueva }).eq('id', id);
  if (e2) { console.error('adjustStock escribir', e2); return null; }
  return nueva;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/** Descuenta de `stock` (materias primas) una fila ya conocida y deja el movimiento. */
export async function egresoStock(
  row: { id: string | number; nombre: string; categoria?: string | null },
  cantidad: number, unidad: string, motivo: string, operador: string
): Promise<number | null> {
  const nueva = await adjustStock('stock', row.id, -cantidad);
  if (nueva === null) return null;
  await supabase.from('stock').update({ fecha_actualizacion: hoy() }).eq('id', row.id);
  await supabase.from('stock_movements').insert({
    nombre: row.nombre, categoria: row.categoria ?? 'SECOS', tipo: 'egreso',
    cantidad: parseFloat(cantidad.toFixed(3)), unidad, motivo, operador,
    fecha: new Date().toISOString(),
  });
  return nueva;
}

/** Suma `cantidad` a un producto de stock_produccion; lo crea si no existe. */
export async function addProduccion(
  producto: string, cantidad: number, categoria: string, unidad: string
): Promise<boolean> {
  const { data } = await supabase.from('stock_produccion')
    .select('id').eq('producto', producto).limit(1);
  const row = data?.[0];
  if (row) {
    const n = await adjustStock('stock_produccion', row.id, cantidad);
    if (n === null) return false;
    await supabase.from('stock_produccion').update({ ultima_prod: new Date().toISOString() }).eq('id', row.id);
    return true;
  }
  const { error } = await supabase.from('stock_produccion')
    .insert({ producto, categoria, cantidad, unidad, ultima_prod: new Date().toISOString() });
  return !error;
}

// ── Descuento automático de ingredientes según la receta ─────────────────────

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

type StockRow = { id: string | number; nombre: string; unidad: string | null; categoria: string | null };

function matchStock(ingName: string, rows: StockRow[]): StockRow | null {
  const n = norm(ingName);
  if (!n) return null;
  const exact = rows.find(r => norm(r.nombre) === n);
  if (exact) return exact;
  const toks = n.split(' ');
  const cands = rows
    .filter(r => { const rt = norm(r.nombre).split(' '); return toks.every(t => rt.includes(t)); })
    .sort((a, b) => norm(a.nombre).split(' ').length - norm(b.nombre).split(' ').length);
  return cands[0] ?? null;
}

const MASA: Record<string, number> = { g: 1, gr: 1, kg: 1000 };
const VOL:  Record<string, number> = { ml: 1, lt: 1000, l: 1000 };

/** Convierte `qty` de la unidad `from` a la unidad `to` del stock. null si no se puede. */
function convertir(qty: number, from: string, to: string | null): number | null {
  const f = from.toLowerCase(), t = (to ?? 'kg').toLowerCase();
  if (f === t) return qty;
  if (MASA[f] && MASA[t]) return qty * MASA[f] / MASA[t];
  if (VOL[f] && VOL[t])   return qty * VOL[f] / VOL[t];
  if (MASA[f] && VOL[t])  return qty * MASA[f] / VOL[t]; // 1 g ≈ 1 ml
  if (VOL[f] && MASA[t])  return qty * VOL[f] / MASA[t];
  return null;
}

type RecipeLike = {
  id: string; name: string; baseYield: number; recipeType?: string;
  ingredients: { name: string; qty: number; unit: string; isBase?: boolean }[];
};

/**
 * Descuenta de `stock` los ingredientes de la receta, escalados a lo producido.
 *  - percent: baseKg es el ingrediente base (100%).
 *  - batch:   escala por targetUnits / baseYield.
 * Lo que no se encuentra en stock (o no convierte de unidad) queda en produccion_eventos
 * como 'alerta_stock' para que el admin lo revise; no frena el cierre.
 */
export async function deductStockForRecipe(
  recipe: RecipeLike, baseKg: number, targetUnits: number, operador: string
): Promise<{ ok: boolean; sinDescontar: string[] }> {
  const sinDescontar: string[] = [];
  const items: { name: string; qty: number; unit: string }[] = [];
  if (recipe.recipeType === 'percent') {
    if (!(baseKg > 0)) return { ok: true, sinDescontar };
    const baseGr = baseKg * 1000;
    for (const ing of recipe.ingredients)
      items.push({ name: ing.name, qty: ing.isBase ? baseGr : (ing.qty / 100) * baseGr, unit: 'g' });
  } else {
    if (!(recipe.baseYield > 0) || !(targetUnits > 0)) return { ok: true, sinDescontar };
    const mult = targetUnits / recipe.baseYield;
    for (const ing of recipe.ingredients) items.push({ name: ing.name, qty: ing.qty * mult, unit: ing.unit });
  }

  const { data: rows, error } = await supabase.from('stock').select('id, nombre, unidad, categoria');
  if (error || !rows) { notifyError('No se pudo leer el stock para descontar ingredientes', error); return { ok: false, sinDescontar }; }

  let ok = true;
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const row = matchStock(it.name, rows as StockRow[]);
    if (!row) { sinDescontar.push(`${it.name} (no está en stock)`); continue; }
    const cant = convertir(it.qty, it.unit, row.unidad);
    if (cant === null) { sinDescontar.push(`${it.name} (unidad ${it.unit} ≠ ${row.unidad})`); continue; }
    const nueva = await egresoStock(row, cant, row.unidad ?? 'kg', `Producción ${recipe.name}`, operador);
    if (nueva === null) { ok = false; sinDescontar.push(`${it.name} (error al descontar)`); continue; }
    await checkAndNotifyStock(row.nombre, nueva, row.unidad ?? 'kg', { id: row.id, cantidad: nueva } as any);
  }
  if (sinDescontar.length) {
    await supabase.from('produccion_eventos').insert({
      tipo: 'alerta_stock', kind: 'cocina', corte: recipe.name, operador,
      detalle: `Sin descontar: ${sinDescontar.join('; ')}`, fecha: new Date().toISOString(),
    });
  }
  if (!ok) notifyError(`Algunos ingredientes de ${recipe.name} no se pudieron descontar`);
  return { ok, sinDescontar };
}

// ── Persistencia cocina ───────────────────────────────────────────────────────

export async function saveCocinaProduccion(
  id: number, recipeName: string, targetUnits: number,
  unit: string, baseQtyKg: number, startTime: number,
  operadorCocina: string, recipeId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('cocina_produccion_activa').insert({
      id, recipe_name: recipeName, recipe_id: recipeId ?? null,
      target_units: targetUnits, unit, base_qty_kg: baseQtyKg,
      start_time: startTime, status: 'running',
      operador: operadorCocina, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await supabase.from('produccion_eventos').insert({
      tipo: 'inicio_cocina', kind: 'cocina', corte: recipeName,
      operador: operadorCocina, peso_kg: baseQtyKg,
      detalle: `Inicio cocina — ${recipeName}`, fecha: new Date().toISOString(),
    });
    return true;
  } catch (e) { console.error('Error guardando producción cocina:', e); return false; }
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
  const productoMila = `Milanesa - ${corteNombre}`;
  let ok = true;
  try {
    const { data: milaRows } = await supabase
      .from('stock_produccion').select('id').eq('producto', productoMila).limit(1);
    if (milaRows?.[0]) {
      const newQty = await adjustStock('stock_produccion', milaRows[0].id, -cantidadKg);
      if (newQty === null) ok = false;
      else await checkAndNotifyProduccionByName(productoMila, newQty, 'kg', supabase);
    }
    const { data: rows } = await supabase.from('stock').select('id, nombre, unidad, categoria');
    for (const ing of ingredientes) {
      const row = matchStock(ing.nombre, (rows ?? []) as StockRow[]);
      if (!row) continue;
      const nueva = await egresoStock(row, ing.cantidad, ing.unidad, `Menjunje Milanesa — ${productoMila}`, 'Cocina');
      if (nueva === null) ok = false;
    }
  } catch (e) { console.error('Error descontando stock menjunje:', e); ok = false; }
  if (!ok) notifyError('No se pudo descontar todo el stock del menjunje');
}

// ── Fraccionado de salsas ─────────────────────────────────────────────────────

export async function deductStockForFraccion(
  stockNombre: string, stockOrigen: 'stock' | 'stock_produccion',
  kgUsado: number, potesProducidos: number, tipoPote: string, operador: string
) {
  if (kgUsado <= 0 || potesProducidos <= 0) return;
  try {
    const tabla = stockOrigen === 'stock' ? 'stock' : 'stock_produccion';
    const campoNombre = stockOrigen === 'stock' ? 'nombre' : 'producto';
    const { data: origen } = await supabase.from(tabla).select('id').eq(campoNombre, stockNombre).limit(1);
    if (origen?.[0]) {
      const newQty = await adjustStock(tabla, origen[0].id, -kgUsado);
      if (newQty === null) { notifyError(`No se pudo descontar ${stockNombre}`); }
      else if (stockOrigen === 'stock') {
        await supabase.from('stock').update({ fecha_actualizacion: hoy() }).eq('id', origen[0].id);
        await checkAndNotifyStock(stockNombre, newQty, 'kg', { id: origen[0].id, cantidad: newQty } as any);
        await supabase.from('stock_movements').insert({
          nombre: stockNombre, categoria: 'SECOS', tipo: 'egreso',
          cantidad: parseFloat(kgUsado.toFixed(3)), unidad: 'kg',
          motivo: `Fraccionado ${stockNombre} — ${potesProducidos}u ${tipoPote}`,
          operador, fecha: new Date().toISOString(),
        });
      } else {
        await supabase.from('stock_produccion').update({ ultima_prod: new Date().toISOString() }).eq('id', origen[0].id);
      }
    }
    // Potes: fila propia "POTES <salsa>" (nunca la salsa a granel, que está en kg)
    if (!(await addProduccion(`POTES ${stockNombre}`, potesProducidos, 'dip', 'u')))
      notifyError(`No se pudieron sumar los potes de ${stockNombre}`);
    await supabase.from('produccion_eventos').insert({
      tipo: 'fin_cocina', kind: 'salsa', corte: stockNombre, peso_kg: kgUsado,
      operador, detalle: `${potesProducidos} potes ${tipoPote} · ${kgUsado.toFixed(3)}kg`,
      fecha: new Date().toISOString(),
    });
  } catch (e) { notifyError('Error en el fraccionado', e); }
}

// ── Mapas de stock por receta ─────────────────────────────────────────────────

export const VERDURA_STOCK_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'TOMATE PRODUCIDO',
  'verdura_lechuga':          'LECHUGA',
  'verdura_cebolla_brunoise': 'CEBOLLA',
  'verdura_cebolla_rodajas':  'CEBOLLA',
  'verdura_morron':           'MORRON',
  'verdura_ajo':              'AJO',
  'verdura_verdeo':           'CEBOLLA DE VERDEO',
};

export const VERDURA_PROD_MAP: Record<string, string> = {
  'verdura_tomate_rodajas':   'TOMATE PRODUCIDO',
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
  let ok = true;
  try {
    const { data } = await supabase.from('stock').select('id, nombre, categoria').eq('nombre', stockNombre).limit(1);
    if (data?.[0]) {
      const nueva = await egresoStock({ ...data[0], categoria: 'FIAMBRE' }, pesoKg, unidad, `Producción ${prodNombre}`, operador);
      if (nueva === null) ok = false;
      else await checkAndNotifyStock(stockNombre, nueva, 'kg', { id: data[0].id, cantidad: nueva } as any);
    }
    if (prodNombre && !(await addProduccion(prodNombre, pesoKg, 'fiambre', unidad))) ok = false;
  } catch (e) { console.error('Error deductStockForFiambre:', e); ok = false; }
  if (!ok) notifyError(`No se pudo registrar el stock de ${prodNombre}`);
}

// ── Descuento de stock para verduras ─────────────────────────────────────────

export async function deductStockForVerdura(recipeId: string, brutoPesoKg: number, desperdicioKg: number) {
  const stockNombre = VERDURA_STOCK_MAP[recipeId];
  const prodNombre  = VERDURA_PROD_MAP[recipeId];
  if (!stockNombre || brutoPesoKg <= 0) return;
  const netoKg = Math.max(0, brutoPesoKg - desperdicioKg);
  let ok = true;
  try {
    const { data } = await supabase.from('stock').select('id, nombre').eq('nombre', stockNombre).limit(1);
    if (data?.[0]) {
      const nueva = await egresoStock({ ...data[0], categoria: 'verduras' }, brutoPesoKg, 'kg', `Producción ${prodNombre}`, 'Cocina');
      if (nueva === null) ok = false;
      else {
        await checkAndNotifyStock(stockNombre, nueva, 'kg', { id: data[0].id, cantidad: nueva } as any);
        await supabase.from('produccion_eventos').insert({
          tipo: 'fin_cocina', kind: 'cocina', corte: prodNombre,
          peso_kg: brutoPesoKg, waste_kg: desperdicioKg, operador: 'Cocina',
          detalle: `Bruto: ${brutoPesoKg}kg | Desperdicio: ${desperdicioKg}kg | Neto: ${netoKg}kg`,
          fecha: new Date().toISOString(),
        });
      }
    }
    if (netoKg > 0 && !(await addProduccion(prodNombre, parseFloat(netoKg.toFixed(3)), 'verduras', 'kg'))) ok = false;
  } catch (e) { console.error('Error deductStockForVerdura:', e); ok = false; }
  if (!ok) notifyError(`No se pudo registrar el stock de ${prodNombre}`);
}
