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
  inicioProduccion: (kind: string, corte: string, pesoKg: number) =>
    sendPushNotification(
      `🔪 Inicio de producción`,
      `${kind.toUpperCase()} — ${corte} ${pesoKg}kg`,
      'produccion-inicio', '/'
    ),

  finProduccion: (kind: string, corte: string, cantidad: number, unidad: string) =>
    sendPushNotification(
      `✅ Producción finalizada`,
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

// Umbrales por unidad
const UMBRAL_KG = 5;
const UMBRAL_U  = 20;

export function isStockBajo(cantidad: number, unidad: string): boolean {
  const umbral = (unidad === 'kg' || unidad === 'lt') ? UMBRAL_KG : UMBRAL_U;
  return cantidad > 0 && cantidad <= umbral;
}

export function isStockAgotado(cantidad: number): boolean {
  return cantidad <= 0;
}