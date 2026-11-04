-- ════════════════════════════════════════════════════════════
-- Compras / pedidos en viaje (Admin → Compras)
-- Correr una vez en Supabase SQL Editor. Hasta entonces los pedidos
-- se guardan solo en el navegador de quien los carga.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS compras (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proveedor      text NOT NULL DEFAULT '',
  fecha_pedido   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_llegada  date NOT NULL,                       -- estimada; se puede cambiar
  estado         text NOT NULL DEFAULT 'en_viaje'
                 CHECK (estado IN ('en_viaje', 'recibido', 'cancelado')),
  -- [{ stock_id, nombre, cantidad, unidad, precio_kg, recibido }]
  items          jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas          text,
  recibido_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compras_estado_llegada_idx ON compras (estado, fecha_llegada);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compras_all" ON compras;
CREATE POLICY "compras_all" ON compras
  FOR ALL USING (true) WITH CHECK (true);
