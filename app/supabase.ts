import { createClient } from '@supabase/supabase-js';
import { testModeStore } from './testModeStore';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const realSupabase = createClient(supabaseUrl, supabaseAnonKey);

// Tablas donde UPDATE de 'cantidad' necesita rollback log
const ROLLBACK_TABLES = new Set(['stock', 'stock_produccion']);

// Tablas que tienen columna es_test
const TESTABLE_TABLES = new Set([
  'stock_movements',
  'stock_produccion',
  'produccion_eventos',
  'cocina_produccion_activa',
]);

function createProxiedFrom(tabla: string) {
  const builder = realSupabase.from(tabla) as any;
  const store   = testModeStore;

  // INSERT — tag con es_test: true
  const originalInsert = builder.insert.bind(builder);
  builder.insert = (data: any) => {
    if (store.isActive && TESTABLE_TABLES.has(tabla)) {
      const tag = (d: Record<string, any>) => ({ ...d, es_test: true });
      const tagged = Array.isArray(data) ? data.map(tag) : tag(data);
      return originalInsert(tagged);
    }
    return originalInsert(data);
  };

  // UPDATE — loguear rollback de cantidad antes de actualizar
  const originalUpdate = builder.update.bind(builder);
  builder.update = (updates: Record<string, any>) => {
    const chain = originalUpdate(updates);

    if (store.isActive && store.sessionId && ROLLBACK_TABLES.has(tabla) && 'cantidad' in updates) {
      const originalEq = chain.eq.bind(chain);
      chain.eq = (col: string, val: any) => {
        if (col === 'id') {
          realSupabase
            .from(tabla)
            .select('cantidad')
            .eq('id', val)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                realSupabase.from('test_rollback_log').insert({
                  session_id:     store.sessionId,
                  tabla,
                  row_id:         val,
                  columna:        'cantidad',
                  valor_anterior: Number((data as any).cantidad ?? 0),
                });
              }
            });
        }
        return originalEq(col, val);
      };
    }

    return chain;
  };

  return builder;
}

export const supabase = new Proxy(realSupabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (tabla: string) => createProxiedFrom(tabla);
    }
    return (target as any)[prop];
  },
});