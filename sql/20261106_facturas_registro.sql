-- ════════════════════════════════════════════════════════════
-- Registro de facturas (Admin → Registro)
-- Correr una vez en Supabase SQL Editor. Cada factura se guarda entera en `data` (jsonb).
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS facturas_registro (
  id          text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE facturas_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facturas_registro_all" ON facturas_registro;
CREATE POLICY "facturas_registro_all" ON facturas_registro
  FOR ALL USING (true) WITH CHECK (true);
