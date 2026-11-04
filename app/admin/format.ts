// ─────────────────────────────────────────────────────────────────────────────
// Formato de cantidades para el admin: fácil de leer de un vistazo.
//   25424.14 kg → "25.424,14" kg   ·   0.35 kg → "350" g   ·   4161 u → "4.161" u
// ─────────────────────────────────────────────────────────────────────────────

/** Número con punto de miles y coma decimal (también para 4 dígitos: 1.245). */
export function formatNumero(n: number, maxDecimales = 2): string {
  const s = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimales }).format(n);
  return s.replace(/,/g, '§').replace('.', ',').replace(/§/g, '.');
}

/**
 * Devuelve el número y la unidad a mostrar.
 * - kg / lt: hasta 2 decimales; si es menos de 1, se muestra en g / ml (0,35 kg → 350 g).
 * - el resto (u, etc.): entero con separador de miles.
 */
export function formatCantidad(valor: number, unidad: string): { num: string; unit: string } {
  const n = Number(valor) || 0;
  if (unidad === 'kg' || unidad === 'lt') {
    if (n !== 0 && Math.abs(n) < 1) {
      return { num: formatNumero(Math.round(n * 1000), 0), unit: unidad === 'kg' ? 'g' : 'ml' };
    }
    return { num: formatNumero(n, 2), unit: unidad };
  }
  return { num: formatNumero(n, Number.isInteger(n) ? 0 : 1), unit: unidad };
}

/** Plata en pesos argentinos: $ 1.234,56 (sin decimales si es 100 o más). */
export function formatPlata(n: number): string {
  const v = Number(n) || 0;
  return `$ ${formatNumero(v, Math.abs(v) >= 100 ? 0 : 2)}`;
}
