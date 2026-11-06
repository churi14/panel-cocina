-- ════════════════════════════════════════════════════════════
-- Mano de obra por medallón (Admin → Costos → Mano de obra)
-- Correr una vez en Supabase SQL Editor. Una fila por día en que se cargó/cambió el valor;
-- el vigente es la fila más reciente, y queda fijo hasta que se cargue otra.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS costos_mano_obra (
  fecha         date PRIMARY KEY,
  jornada       numeric,            -- lo que se pagó por la jornada (opcional)
  medallones    numeric,            -- medallones que se hicieron en esa jornada (opcional)
  por_medallon  numeric NOT NULL,   -- costo de mano de obra por medallón
  nota          text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE costos_mano_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costos_mano_obra_all" ON costos_mano_obra;
CREATE POLICY "costos_mano_obra_all" ON costos_mano_obra
  FOR ALL USING (true) WITH CHECK (true);
