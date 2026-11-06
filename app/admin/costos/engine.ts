// ─────────────────────────────────────────────────────────────────────────────
// Motor de costos — puro (sin React ni base de datos).
//  · cada insumo tiene un precio por unidad (kg, lt o u)
//  · un insumo "elaborado" (pan, salsas) se calcula solo a partir de su receta de cocina
//  · un producto (lomito, burger…) suma el costo de todos los insumos de su receta
// (las recetas de productos están en la tabla recetas_fudo, solo por cómo se cargaron).
// ─────────────────────────────────────────────────────────────────────────────
import { INITIAL_RECIPES } from '../../data/recipes';
import { matchStock, convertir, norm, FIAMBRE_PROD_MAP, FIAMBRE_STOCK_MAP, type StockRow } from '../../components/kitchenHelpers';

export type Precios = Record<string, { precio: number; unidad: string; nombre: string }>;
export type FuenteCosto = 'manual' | 'receta' | 'crudo' | 'falta';
export type CostoInfo = {
  precio: number | null;     // costo por `unidad`
  unidad: string;            // kg | lt | u
  fuente: FuenteCosto;
  incompleto: boolean;       // falta algún dato para que el número sea confiable
  detalle?: string;
  faltantes?: string[];      // insumos sin precio que impiden calcular (para avisar qué cargar)
};
export type RecetaFudoRow = { producto_fudo: string; ingrediente: string; cantidad: number; unidad: string; tabla_origen: string };
export type LineaProducto = {
  ingrediente: string; tabla: string; cantidad: number; unidad: string;
  info: CostoInfo; costo: number | null; problema: string | null;
};
export type ResultadoProducto = { lineas: LineaProducto[]; total: number; incompleto: boolean; faltan: number };

export const CLAVE_VENTA = 'venta::';
export const unidadBase = (u: string) => (u === 'g' || u === 'gr' ? 'kg' : u === 'ml' ? 'lt' : u === 'uds' ? 'u' : u);

/** Mano de obra por medallón de hamburguesa (pesos), valor calculado por cocina. A futuro: medirlo día a día con tiempos reales. */
export const MANO_OBRA_MEDALLON = 400;

/** Medallón de hamburguesa: peso (kg) y parte de carne de la mezcla (el resto es grasa). */
export const MEDALLON_KG = 0.12;
export const MEDALLON_PCT_CARNE = 0.66;

/** El agua de las recetas no tiene costo. */
export const esAgua = (nombre: string) => /^agua( |$)/.test(norm(nombre));

/**
 * Insumos que las recetas piden con un nombre y que se compran con otro:
 * la receta dice "Aceite" y el precio cargado es el del aceite de girasol.
 * (clave pedida → clave del precio cargado; sirve solo si la pedida no tiene precio propio)
 */
export const ALIAS_PRECIO: Record<string, string> = {
  'aceite': 'aceite girasol',
  'aceite eloico': 'aceite alto oleico',
  'pan kalis': 'pan kalis golden',   // es el mismo pan
};
export const precioCargado = (precios: Precios, ...claves: (string | undefined)[]) => {
  for (const c of claves) {
    if (!c) continue;
    const p = precios[c] ?? precios[ALIAS_PRECIO[c] ?? ''];
    if (p) return p;
  }
  return undefined;
};

/** Recetas de cocina que sirven para calcular el costo de un insumo elaborado. */
export const RECETAS_CALCULABLES = INITIAL_RECIPES.filter(r =>
  r.ingredients.length > 0 && !['fraccion', 'verdura', 'fiambre', 'empanado'].includes(r.recipeType ?? ''));

export function crearResolver(stockRows: StockRow[], precios: Precios, manoObraMedallon: number = MANO_OBRA_MEDALLON) {
  const cache = new Map<string, CostoInfo>();
  const recetaPorNombre = new Map(RECETAS_CALCULABLES.map(r => [norm(r.name), r]));
  // Fiambres elaborados = el mismo kilo del fiambre crudo (1:1)
  const crudoPorProducido = new Map(
    Object.entries(FIAMBRE_PROD_MAP).map(([id, prodNombre]) => [norm(prodNombre), FIAMBRE_STOCK_MAP[id]]));

  const falta = (unidad: string, detalle?: string, faltantes?: string[]): CostoInfo => ({ precio: null, unidad, fuente: 'falta', incompleto: true, detalle, faltantes });

  const resolver = (nombre: string, depth = 0): CostoInfo => {
    const k = norm(nombre);
    const guardado = cache.get(k);
    if (guardado) return guardado;
    const r = calcular(nombre, depth);
    if (depth === 0) cache.set(k, r);
    return r;
  };

  const costoDeReceta = (rec: (typeof RECETAS_CALCULABLES)[number], depth: number): CostoInfo => {
    const items: { name: string; qty: number; unit: string }[] = [];
    let salida: number; let unidad: string;
    if (rec.recipeType === 'percent') {
      const ratio = rec.ingredients.reduce((s, i) => s + i.qty / 100, 0);
      rec.ingredients.forEach(i => items.push({ name: i.name, qty: ((i.isBase ? 100 : i.qty) / 100) * 1000, unit: 'g' })); // para 1 kg de base
      salida = ratio; unidad = 'kg';
    } else {
      rec.ingredients.forEach(i => items.push({ name: i.name, qty: i.qty, unit: i.unit }));
      salida = rec.baseYield; unidad = unidadBase(rec.unit);
    }
    let total = 0; let faltan = 0;
    const sinPrecio: string[] = [];
    for (const it of items) {
      const info = resolver(it.name, depth + 1);
      const q = info.precio !== null ? convertir(it.qty, it.unit, info.unidad) : null;
      if (info.precio === null || q === null) {
        faltan++;
        // si el insumo es otro elaborado, se avisa lo que le falta a él; si no, el insumo mismo
        sinPrecio.push(...(info.faltantes?.length ? info.faltantes : [it.name]));
        continue;
      }
      if (info.incompleto) { faltan++; sinPrecio.push(...(info.faltantes ?? [])); }
      total += info.precio * q;
    }
    const faltantes = [...new Set(sinPrecio)];
    const aviso = faltantes.length ? `falta cargar: ${faltantes.join(', ')}` : undefined;
    if (!(salida > 0) || total === 0) return falta(unidad, aviso, faltantes);
    return {
      precio: total / salida, unidad, fuente: 'receta', incompleto: faltan > 0, faltantes,
      detalle: aviso ?? 'calculado con la receta de cocina',
    };
  };

  const calcular = (nombre: string, depth: number): CostoInfo => {
    const base = calcularBase(nombre, depth);
    // mano de obra: cada medallón suma su hora-hombre (~$45.000 la media jornada ÷ ~200 medallones)
    if (norm(nombre) === 'medallones burger' && base.precio !== null && base.unidad === 'u')
      return { ...base, precio: base.precio + manoObraMedallon, detalle: `${base.detalle ? base.detalle + ' · ' : ''}incluye $${manoObraMedallon} de mano de obra` };
    return base;
  };

  const calcularBase = (nombre: string, depth: number): CostoInfo => {
    const k = norm(nombre);
    const row = matchStock(nombre, stockRows);
    // 1) precio cargado a mano (por el nombre o por el insumo de stock que coincide)
    const m = precioCargado(precios, k, row ? norm(row.nombre) : undefined);
    if (m) return { precio: m.precio, unidad: m.unidad, fuente: 'manual', incompleto: false };
    // el agua de las recetas no tiene costo (si alguien carga un precio, manda ese)
    if (esAgua(nombre)) return { precio: 0, unidad: 'kg', fuente: 'crudo', incompleto: false, detalle: 'agua: sin costo' };
    if (depth > 4) return falta(row?.unidad ?? 'kg');
    // 2) elaborado con receta de cocina
    const rec = recetaPorNombre.get(k);
    if (rec) return costoDeReceta(rec, depth);
    // el medallón se arma con su mezcla: 120 g, 66% carne (cuadril) y 34% grasa
    if (k === 'medallones burger') {
      const carne = resolver('cuadril', depth + 1), grasa = resolver('grasa', depth + 1);
      const faltan = [carne.precio === null ? 'cuadril' : '', grasa.precio === null ? 'grasa' : ''].filter(Boolean);
      if (faltan.length) return falta('u', `falta cargar: ${faltan.join(', ')}`, faltan);
      const porKg = MEDALLON_PCT_CARNE * carne.precio! + (1 - MEDALLON_PCT_CARNE) * grasa.precio!;
      return { precio: porKg * MEDALLON_KG, unidad: 'u', fuente: 'receta', incompleto: false, detalle: `${MEDALLON_KG * 1000} g · ${MEDALLON_PCT_CARNE * 100}% cuadril, ${Math.round((1 - MEDALLON_PCT_CARNE) * 100)}% grasa` };
    }
    // 3) fiambre elaborado = crudo 1:1
    const crudo = crudoPorProducido.get(k);
    if (crudo) {
      const c = resolver(crudo, depth + 1);
      if (c.precio !== null) return { ...c, fuente: 'crudo', detalle: `igual al precio de ${crudo}` };
    }
    return falta(row?.unidad ?? 'kg');
  };

  return resolver;
}

export type Resolver = ReturnType<typeof crearResolver>;

export function costoProducto(rows: RecetaFudoRow[], resolver: Resolver): ResultadoProducto {
  const lineas: LineaProducto[] = rows.map(r => {
    const cantidad = Number(r.cantidad) || 0;
    const info = resolver(r.ingrediente);
    let costo: number | null = null; let problema: string | null = null;
    if (info.precio !== null) {
      const q = convertir(cantidad, r.unidad, info.unidad);
      if (q === null) problema = `unidad ${r.unidad} no compatible con ${info.unidad}`;
      else costo = q * info.precio;
    }
    return { ingrediente: r.ingrediente, tabla: r.tabla_origen, cantidad, unidad: r.unidad, info, costo, problema };
  });
  const faltan = lineas.filter(l => l.costo === null || l.info.incompleto).length;
  return { lineas, total: lineas.reduce((s, l) => s + (l.costo ?? 0), 0), incompleto: faltan > 0, faltan };
}

/** Clasifica un producto por su nombre, para filtrar la lista. */
export function categoriaProducto(nombre: string): 'Lomitos' | 'Burgers' | 'Milanesas' | 'Sánguches' | 'Promos' {
  const n = nombre.toLowerCase();
  if (/promo/.test(n)) return 'Promos';
  if (/^1 lomo/.test(n)) return 'Lomitos';
  if (/milanesa|suprema/.test(n)) return 'Milanesas';
  if (/tucumano/.test(n)) return 'Sánguches';
  return 'Burgers';
}

/** Dónde se guarda el precio de un insumo (clave) y en qué unidad se expresa. */
export function destinoPrecio(nombre: string, stockRows: StockRow[], unidadUso: string): { clave: string; unidad: string } {
  const row = matchStock(nombre, stockRows);
  const rec = RECETAS_CALCULABLES.find(r => norm(r.name) === norm(nombre));
  return {
    clave: norm(row?.nombre ?? nombre),
    unidad: row?.unidad ?? (rec ? (rec.recipeType === 'percent' ? 'kg' : unidadBase(rec.unit)) : unidadBase(unidadUso || 'kg')),
  };
}

export { norm };
