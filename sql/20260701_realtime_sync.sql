-- ════════════════════════════════════════════════════════════
-- Migración: Auto-sync Fudo en tiempo real
-- Correr en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Agregar columna "tipo" a fudo_sync_log para distinguir auto vs manual
ALTER TABLE fudo_sync_log
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'manual';

-- 2. Tabla para trackear ventas Fudo ya procesadas (evita doble descuento)
CREATE TABLE IF NOT EXISTS fudo_ventas_procesadas (
  sale_id     text        PRIMARY KEY,
  procesada_at timestamptz DEFAULT now()
);

ALTER TABLE fudo_ventas_procesadas ENABLE ROW LEVEL SECURITY;

-- Permitir al service role insertar/consultar (el cron usa service role key)
CREATE POLICY "service_all" ON fudo_ventas_procesadas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Limpiar registros viejos de más de 7 días automáticamente (opcional)
-- (Supabase no tiene TTL nativo, pero podés crear una pg_cron si querés)
-- DELETE FROM fudo_ventas_procesadas WHERE procesada_at < now() - interval '7 days';
