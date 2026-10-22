-- ════════════════════════════════════════════════════════════
-- adjust_stock v2: agrega p_floor (por defecto true = nunca baja de 0).
-- La carne cruda (CARNES) puede quedar negativa hasta que se carga la factura,
-- por eso carnicería llama con p_floor = false.
-- Correr UNA vez en Supabase SQL Editor (reemplaza la versión anterior).
-- ════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS adjust_stock(text, text, numeric);

CREATE OR REPLACE FUNCTION adjust_stock(
  p_tabla text, p_id text, p_delta numeric, p_floor boolean DEFAULT true
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  nuevo numeric;
BEGIN
  IF p_tabla = 'stock' THEN
    UPDATE stock
      SET cantidad = CASE WHEN p_floor THEN GREATEST(0, round((cantidad + p_delta)::numeric, 3))
                          ELSE round((cantidad + p_delta)::numeric, 3) END
      WHERE id::text = p_id RETURNING cantidad INTO nuevo;
  ELSIF p_tabla = 'stock_produccion' THEN
    UPDATE stock_produccion
      SET cantidad = CASE WHEN p_floor THEN GREATEST(0, round((cantidad + p_delta)::numeric, 3))
                          ELSE round((cantidad + p_delta)::numeric, 3) END
      WHERE id::text = p_id RETURNING cantidad INTO nuevo;
  ELSE
    RAISE EXCEPTION 'tabla no permitida: %', p_tabla;
  END IF;
  RETURN nuevo;
END;
$$;
