-- ════════════════════════════════════════════════════════════
-- Ajuste atómico de stock (evita pisadas entre tablets)
-- Correr en Supabase SQL Editor. Si no se corre, la app usa un
-- fallback leer→escribir (menos seguro ante concurrencia).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION adjust_stock(p_tabla text, p_id text, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  nuevo numeric;
BEGIN
  IF p_tabla = 'stock' THEN
    UPDATE stock SET cantidad = GREATEST(0, round((cantidad + p_delta)::numeric, 3))
      WHERE id::text = p_id RETURNING cantidad INTO nuevo;
  ELSIF p_tabla = 'stock_produccion' THEN
    UPDATE stock_produccion SET cantidad = GREATEST(0, round((cantidad + p_delta)::numeric, 3))
      WHERE id::text = p_id RETURNING cantidad INTO nuevo;
  ELSE
    RAISE EXCEPTION 'tabla no permitida: %', p_tabla;
  END IF;
  RETURN nuevo;
END;
$$;
