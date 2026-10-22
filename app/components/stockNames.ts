// ─────────────────────────────────────────────────────────────────────────────
// stockNames.ts — Nombres oficiales de carne (cruda / limpia) y lectura de números
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza para comparar: minúsculas, sin acentos, sin símbolos. */
export function normNombre(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "Nalga_L", "Nalga Limpia" o "Nalga" → "Nalga" (el corte, sin sufijos). */
export function corteBase(nombre: string): string {
  return nombre.replace(/_L$/i, '').replace(/\s+limpia$/i, '').trim();
}

/** Nombre oficial en stock_produccion de la carne limpia de un corte: "Nalga" → "Nalga_L". */
export function nombreLimpio(corte: string): string {
  const base = corteBase(corte);
  return `${base.toLowerCase().includes('nalga') && !/tapa/i.test(base) ? 'Nalga' : base}_L`;
}

/** Nombre del corte crudo en `stock` (categoría CARNES). null si no es un corte conocido. */
export const CORTE_CRUDO: Record<string, string> = {
  'Lomo':              'LOMO',
  'Roast Beef':        'ROAST BEEF',
  'Tapa de Asado':     'TAPA DE ASADO',
  'Tapa de Nalga':     'TAPA DE NALGA',
  'Nalga':             'NALGA',
  'Nalga sin fetear':  'NALGA SIN FETEAR',
  'Nalga con Tapa':    'NALGA CON TAPA',
  'Bife de Chorizo':   'BIFE DE CHORIZO',
  'Bife Angosto':      'BIFE ANGOSTO',
  'Vacío':             'VACIO',
  'Picaña':            'PICAÑA',
  'Ojo de Bife':       'OJO DE BIFE',
  'Grasa de Pella':    'GRASA DE PELLA',
  'Pollo':             'POLLO',
  'Cuadril':           'CUADRIL',
  'Cuadrada':          'CUADRADA',
  'Not Burger':        'NOT',
  'Aguja':             'AGUJA',
};

/**
 * Lee un peso o cantidad escrito por una persona.
 * Acepta "1,5", "1.5", "1.234,5" y "1,234.5". Con un solo separador lo toma como decimal
 * (los pesos de cocina se cargan en kg, no hay miles). Devuelve NaN si no es un número.
 */
export function parseNumero(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return valor;
  let s = String(valor ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // El último separador es el decimal; el otro es de miles
    const dec = coma > punto ? ',' : '.';
    const mil = dec === ',' ? /\./g : /,/g;
    s = s.replace(mil, '').replace(dec, '.');
  } else {
    s = s.replace(',', '.');
  }
  return /^-?\d*\.?\d+$/.test(s) || /^-?\d+\.$/.test(s) ? parseFloat(s) : NaN;
}
