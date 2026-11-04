-- ════════════════════════════════════════════════════════════
-- Precios de insumos para el Calculador de costos (Admin → Costos)
-- Correr una vez en Supabase SQL Editor. Hasta entonces los precios
-- se guardan solo en el navegador de quien los carga.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS costos_insumos (
  clave       text PRIMARY KEY,                 -- nombre normalizado (minúsculas, sin acentos)
  nombre      text NOT NULL,                    -- nombre del insumo tal como se muestra
  precio      numeric NOT NULL CHECK (precio >= 0),
  unidad      text NOT NULL DEFAULT 'kg',       -- el precio es por esta unidad: kg, lt o u
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE costos_insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costos_insumos_all" ON costos_insumos;
CREATE POLICY "costos_insumos_all" ON costos_insumos
  FOR ALL USING (true) WITH CHECK (true);
