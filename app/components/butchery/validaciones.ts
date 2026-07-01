// ─────────────────────────────────────────────────────────────
// Validación de cantidades — límites por categoría y por producto
// ─────────────────────────────────────────────────────────────

// LÍMITES POR CATEGORÍA (kg antes de pedir confirmación)
export const LIMITES_CONFIRMACION: Record<string, number> = {
  verdura:     5,
  carne:       15,
  fiambre:     20,
  seco:        50,
  descartable: 2000,
  cocina:      30,
  general:     20,
};

// LÍMITES ABSOLUTOS POR CATEGORÍA (nunca se puede superar)
export const LIMITES_ABSOLUTOS: Record<string, number> = {
  verdura:     50,
  carne:       150,
  fiambre:     100,
  seco:        300,
  descartable: 50000,
  cocina:      200,
  general:     100,
};

// LÍMITES POR PRODUCTO ESPECÍFICO (confirmar si supera)
// nombre en minúscula → límite en kg/u
export const LIMITES_PRODUCTO: Record<string, { confirmar: number; absoluto: number; unidad?: string }> = {
  // Verduras
  'lechuga':           { confirmar: 3,   absoluto: 30  },
  'tomate':            { confirmar: 5,   absoluto: 50  },
  'cebolla':           { confirmar: 5,   absoluto: 50  },
  'morron':            { confirmar: 3,   absoluto: 20  },
  'ajo':               { confirmar: 2,   absoluto: 10  },
  'perejil':           { confirmar: 1,   absoluto: 5   },
  'aji en fruta':      { confirmar: 2,   absoluto: 10  },
  'albahaca':          { confirmar: 1,   absoluto: 5   },
  // Carnes brutas
  'lomo':              { confirmar: 30,  absoluto: 100 },
  'cuadril':           { confirmar: 30,  absoluto: 100 },
  'cuadrada':          { confirmar: 20,  absoluto: 80  },
  'nalga':             { confirmar: 40,  absoluto: 150 },
  'aguja':             { confirmar: 50,  absoluto: 200 },
  'vacio':             { confirmar: 40,  absoluto: 150 },
  'tapa de asado':     { confirmar: 30,  absoluto: 100 },
  'pollo':             { confirmar: 20,  absoluto: 80  },
  // Carnes limpias (producción carnicería)
  'cuadril limpia':    { confirmar: 25,  absoluto: 80  },
  'lomo limpia':       { confirmar: 25,  absoluto: 80  },
  'nalga limpia':      { confirmar: 30,  absoluto: 100 },
  // Fiambres
  'queso tybo':        { confirmar: 15,  absoluto: 50  },
  'queso muzza':       { confirmar: 10,  absoluto: 40  },
  'jamón':             { confirmar: 10,  absoluto: 40  },
  'panceta':           { confirmar: 10,  absoluto: 40  },
  'cheddar en feta':   { confirmar: 10,  absoluto: 40  },
  // Secos
  'harina':            { confirmar: 30,  absoluto: 150 },
  'huevo':             { confirmar: 50,  absoluto: 300, unidad: 'u' },
  'papas mccain':      { confirmar: 30,  absoluto: 100 },
  'mayonesa':          { confirmar: 20,  absoluto: 80  },
  'aceite':            { confirmar: 20,  absoluto: 80  },
};

export function getLimiteProducto(nombre: string): { confirmar: number; absoluto: number } | null {
  const key = (nombre ?? '').toLowerCase().trim();
  // Buscar coincidencia exacta primero, luego parcial
  for (const [k, v] of Object.entries(LIMITES_PRODUCTO)) {
    if (key === k || key.includes(k) || k.includes(key.split(' ')[0])) {
      return v;
    }
  }
  return null;
}

export function getCategoriaLimite(categoria: string): string {
  const cat = (categoria ?? '').toLowerCase();
  if (cat.includes('verdura') || cat.includes('vegetal')) return 'verdura';
  if (cat.includes('carne') || cat.includes('lomito') || cat.includes('burger') || cat.includes('milanesa')) return 'carne';
  if (cat.includes('fiambre')) return 'fiambre';
  if (cat.includes('seco')) return 'seco';
  if (cat.includes('descartable')) return 'descartable';
  if (cat.includes('cocina')) return 'cocina';
  return 'general';
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; tipo: 'bloqueo';      mensaje: string }
  | { ok: false; tipo: 'confirmacion'; mensaje: string; detalle: string };

export function validarCantidad(
  valor: number,
  categoria: string,
  nombre?: string,
  stockActual?: number,
): ValidationResult {
  if (!valor || valor <= 0) return { ok: true };

  // Límites específicos del producto (tienen prioridad)
  const limProd = nombre ? getLimiteProducto(nombre) : null;
  const cat = getCategoriaLimite(categoria);
  
  const limAbs   = limProd?.absoluto ?? LIMITES_ABSOLUTOS[cat]  ?? 100;
  const limConf  = limProd?.confirmar ?? LIMITES_CONFIRMACION[cat] ?? 20;

  // Bloqueo absoluto
  if (valor >= limAbs) {
    return {
      ok: false,
      tipo: 'bloqueo',
      mensaje: `${valor} supera el límite absoluto de ${limAbs} para "${nombre ?? categoria}". Verificá el número antes de continuar.`,
    };
  }

  // Confirmación por límite de producto/categoría
  if (valor > limConf) {
    return {
      ok: false,
      tipo: 'confirmacion',
      mensaje: `Vas a registrar ${valor}${nombre ? ' kg' : ''} de ${nombre ?? categoria}`,
      detalle: `El límite normal para este producto es ${limConf}. Si el número es correcto, confirmá.`,
    };
  }

  // Confirmación si supera 3x el stock actual
  if (stockActual !== undefined && stockActual > 0 && valor > stockActual * 3) {
    return {
      ok: false,
      tipo: 'confirmacion',
      mensaje: `Vas a descontar ${valor}`,
      detalle: `Stock disponible: ${stockActual.toFixed(3)}. Eso representa el ${((valor / stockActual) * 100).toFixed(0)}% del stock.`,
    };
  }

  return { ok: true };
}

// Detecta si el usuario probablemente olvidó la coma decimal
// Ej: "2248" cuando el límite normal es ~22 → sugiere "22.48"
export function detectarPosibleErrorDecimal(valor: number, limiteNormal?: number): string | null {
  if (!valor || valor <= 0 || valor < 10) return null;

  const referencia = limiteNormal ?? 50;
  if (valor <= referencia) return null; // no hay error evidente

  const strVal = String(Math.round(valor));
  if (strVal.length < 3) return null;

  const candidatos: number[] = [];
  for (let i = 1; i < strVal.length; i++) {
    const candidato = parseFloat(strVal.slice(0, i) + '.' + strVal.slice(i));
    if (candidato > 0 && candidato < referencia * 2) {
      candidatos.push(candidato);
    }
  }

  if (candidatos.length === 1) {
    return `¿Quisiste escribir ${candidatos[0].toFixed(candidatos[0] < 10 ? 3 : 2)} kg?`;
  }
  if (candidatos.length > 1) {
    return `¿Quisiste escribir ${candidatos[0].toFixed(2)} kg?`;
  }
  return null;
}