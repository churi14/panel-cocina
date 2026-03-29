// Helper para enviar notificaciones push desde el cliente
// Llama al endpoint /api/push que las distribuye a todos los admins suscriptos

export async function sendPushNotification(
  title: string,
  body: string,
  tag?: string,
  url?: string
): Promise<void> {
  try {
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, tag: tag ?? 'kitchenos', url: url ?? '/' }),
    });
  } catch (e) {
    // Silencioso — las notificaciones son best-effort
    console.warn('Push notification failed:', e);
  }
}

// Notificaciones predefinidas del sistema
export const PushEvents = {
  inicioProduccion: (kind: string, corte: string, pesoKg: number) =>
    sendPushNotification(
      `🔪 Inicio de producción`,
      `${kind.toUpperCase()} — ${corte} ${pesoKg}kg`,
      'produccion-inicio',
      '/'
    ),

  finProduccion: (kind: string, corte: string, cantidad: number, unidad: string) =>
    sendPushNotification(
      `✅ Producción finalizada`,
      `${kind.toUpperCase()} — ${cantidad} ${unidad} de ${corte} listos`,
      'produccion-fin',
      '/'
    ),

  stockBajo: (nombre: string, cantidad: number, unidad: string) =>
    sendPushNotification(
      `⚠️ Stock bajo`,
      `${nombre}: quedan ${cantidad} ${unidad}`,
      'stock-bajo',
      '/admin'
    ),

  stockAgotado: (nombre: string) =>
    sendPushNotification(
      `🚨 Stock agotado`,
      `${nombre} está en cero`,
      'stock-agotado',
      '/admin'
    ),
};

// Umbral de stock bajo (en kg o unidades)
export const STOCK_UMBRAL: Record<string, number> = {
  // Kg
  'default_kg': 5,
  // Unidades
  'default_u':  20,
};

export function isStockBajo(cantidad: number, unidad: string, nombre?: string): boolean {
  const umbral = unidad === 'kg' || unidad === 'lt' ? STOCK_UMBRAL.default_kg : STOCK_UMBRAL.default_u;
  return cantidad > 0 && cantidad <= umbral;
}

export function isStockAgotado(cantidad: number): boolean {
  return cantidad <= 0;
}