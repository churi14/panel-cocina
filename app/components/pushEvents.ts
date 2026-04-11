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

  // ─── NUEVO: aviso de que hay que producir ────────────────────────────────────
  necesitaProduccion: (producto: string, cantidad: number, unidad: string, dias?: number | null) =>
    sendPushNotification(
      `🍳 Hay que producir: ${producto}`,
      dias && dias > 0
        ? `Quedan ${cantidad} ${unidad} — producí en los próximos ${dias} día${dias !== 1 ? 's' : ''}`
        : `Quedan ${cantidad} ${unidad} — producí hoy`,
      'necesita-produccion',
      '/admin'
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
export async function sendResumenTurno(
  producciones: { recipeName: string; operador: string; cantidad?: number; unidad?: string }[],
  stockResumen: { producto: string; cantidad: number; unidad: string }[]
): Promise<void> {
  const operadores = [...new Set(producciones.map(p => p.operador).filter(Boolean))].join(', ');
  const nProd = producciones.length;
  const stockLines = stockResumen.slice(0, 4).map(s => `${s.producto}: ${s.cantidad} ${s.unidad}`).join(' | ');
  
  await sendPushNotification(
    `📋 Resumen de turno · ${operadores}`,
    `${nProd} produccion${nProd !== 1 ? 'es' : ''} completada${nProd !== 1 ? 's' : ''}. Stock: ${stockLines}`,
    'resumen-turno', '/admin'
  );
}

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

  if (newQty < 0) {
    await sendPushNotification(
      `🔴 Stock NEGATIVO: ${nombre}`,
      `Hay ${fmt(newQty)} ${unidad} — cargá la factura en admin`,
      'stock-negativo', '/admin'
    );
  } else if (newQty === 0) {
    await PushEvents.stockAgotado(nombre);
  } else if (newQty <= critico) {
    await sendPushNotification(
      `🚨 Stock CRÍTICO: ${nombre}`,
      `Solo quedan ${fmt(newQty)} ${unidad} — comprá YA`,
      'stock-critico', '/admin'
    );
  } else if (newQty <= medio) {
    await sendPushNotification(
      `⚠️ Stock bajo: ${nombre}`,
      `Quedan ${fmt(newQty)} ${unidad} — reponé pronto`,
      'stock-bajo', '/admin'
    );
  }
}

// ─── NUEVO: Chequeo de umbral de producción ──────────────────────────────────
/**
 * Llama esto cada vez que se descuenta de un item de stock_produccion.
 * Busca el item en la BD (para leer alerta_umbral y alerta_dias) y manda
 * push si el nuevo stock quedó por debajo del umbral configurado.
 *
 * @param productoId  - id del row en stock_produccion
 * @param producto    - nombre del producto (para el mensaje)
 * @param newQty      - cantidad nueva después del descuento
 * @param unidad      - unidad del producto
 * @param alertaUmbral - umbral configurado (se puede pasar directo si ya lo tenés)
 * @param alertaDias   - días de anticipación configurados
 */
export async function checkAndNotifyProduccion(
  producto: string,
  newQty: number,
  unidad: string,
  alertaUmbral?: number | null,
  alertaDias?: number | null
): Promise<void> {
  // Sin umbral configurado → no avisar
  if (!alertaUmbral || alertaUmbral <= 0) return;

  const fmt = (n: number) =>
    (unidad === 'kg' || unidad === 'lt')
      ? n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
      : Math.round(n).toString();

  if (newQty <= 0) {
    // Se agotó completamente → aviso urgente
    await sendPushNotification(
      `🚨 SIN STOCK para producir: ${producto}`,
      `Se agotó — necesitás producir YA`,
      'produccion-agotada',
      '/admin'
    );
  } else if (newQty <= alertaUmbral) {
    // Bajó del umbral → aviso de que hay que producir
    await PushEvents.necesitaProduccion(producto, parseFloat(fmt(newQty)), unidad, alertaDias);
  }
}

/**
 * Versión que busca el item en Supabase por nombre para leer los umbrales.
 * Útil cuando no tenés los datos del item a mano en el momento del descuento.
 */
export async function checkAndNotifyProduccionByName(
  producto: string,
  newQty: number,
  unidad: string,
  supabaseClient: any
): Promise<void> {
  try {
    const { data } = await supabaseClient
      .from('stock_produccion')
      .select('alerta_umbral, alerta_dias')
      .ilike('producto', producto)
      .maybeSingle();

    await checkAndNotifyProduccion(
      producto,
      newQty,
      unidad,
      data?.alerta_umbral ?? null,
      data?.alerta_dias ?? null
    );
  } catch (e) {
    console.warn('checkAndNotifyProduccionByName error:', e);
  }
}