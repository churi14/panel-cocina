// Helper para enviar notificaciones push desde el cliente
export async function sendPushNotification(
  title: string, body: string, tag?: string, url?: string
): Promise<void> {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, tag: tag ?? 'kitchenos', url: url ?? '/' }),
    });
  } catch (e) {
    console.warn('Push notification failed:', e);
  }
}

export const PushEvents = {
  inicioProduccion: (kind: string, corte: string, pesoKg: number, op?: string) =>
    sendPushNotification(
      `🔪 Inicio de producción${op ? ' · ' + op : ''}`,
      `${kind.toUpperCase()} — ${corte} ${pesoKg}kg`,
      'produccion-inicio', '/'
    ),

  finProduccion: (kind: string, corte: string, cantidad: number, unidad: string, op?: string) =>
    sendPushNotification(
      `✅ Producción finalizada${op ? ' · ' + op : ''}`,
      `${kind.toUpperCase()} — ${cantidad} ${unidad} de ${corte} listos`,
      'produccion-fin', '/'
    ),

  stockBajo: (nombre: string, cantidad: number, unidad: string) =>
    sendPushNotification(
      `⚠️ Stock bajo: ${nombre}`,
      `Quedan solo ${cantidad.toFixed(1)} ${unidad} — reponé pronto`,
      'stock-bajo', '/admin'
    ),

  stockAgotado: (nombre: string) =>
    sendPushNotification(
      `🚨 Stock AGOTADO: ${nombre}`,
      `No hay más existencias disponibles`,
      'stock-agotado', '/admin'
    ),

  stockInsuficiente: (nombre: string, disponible: number, requerido: number) =>
    sendPushNotification(
      `⛔ Stock insuficiente: ${nombre}`,
      `Disponible: ${disponible.toFixed(1)}kg — Requerido: ${requerido.toFixed(1)}kg`,
      'stock-insuficiente', '/admin'
    ),
};

// ─── Umbrales dinámicos desde Supabase ───────────────────────────────────────
// Fallbacks si el item no tiene umbrales configurados
const FALLBACK_CRITICO_KG = 5;
const FALLBACK_MEDIO_KG   = 15;
const FALLBACK_CRITICO_U  = 10;
const FALLBACK_MEDIO_U    = 30;

export function isStockBajo(cantidad: number, unidad: string): boolean {
  const umbral = (unidad === 'kg' || unidad === 'lt') ? FALLBACK_CRITICO_KG : FALLBACK_CRITICO_U;
  return cantidad > 0 && cantidad <= umbral;
}

export function isStockAgotado(cantidad: number): boolean {
  return cantidad <= 0;
}

/**
 * Chequea umbrales dinámicos de un item y dispara la push correspondiente.
 * stockItem puede tener stock_critico, stock_medio, stock_minimo.
 */
export async function checkAndNotifyStock(
  nombre: string,
  newQty: number,
  unidad: string,
  stockItem?: { stock_critico?: number | null; stock_medio?: number | null; stock_minimo?: number | null }
): Promise<void> {
  const critico = stockItem?.stock_critico ?? ((unidad === 'kg' || unidad === 'lt') ? FALLBACK_CRITICO_KG : FALLBACK_CRITICO_U);
  const medio   = stockItem?.stock_medio   ?? ((unidad === 'kg' || unidad === 'lt') ? FALLBACK_MEDIO_KG   : FALLBACK_MEDIO_U);

  const fmt = (n: number) => (unidad === 'kg' || unidad === 'lt')
    ? n.toFixed(3).replace(/\.?0+$/, '').replace('.', ',')
    : Math.round(n).toString();

  if (newQty <= 0) {
    await PushEvents.stockAgotado(nombre);
  } else if (newQty <= critico) {
    await sendPushNotification(
      `🚨 Stock CRÍTICO: \${nombre}`,
      `Solo quedan \${fmt(newQty)} \${unidad} — comprá YA`,
      'stock-critico', '/admin'
    );
  } else if (newQty <= medio) {
    await sendPushNotification(
      `⚠️ Stock bajo: \${nombre}`,
      `Quedan \${fmt(newQty)} \${unidad} — reponé pronto`,
      'stock-bajo', '/admin'
    );
  }
}