-- ════════════════════════════════════════════════════════════
-- Corrección de valores mal cargados (gramos puestos como kilos y negativos)
-- Dejar en 0 lo que está claramente mal; después la encargada lo carga con el valor real
-- desde Admin → Stock → tocar el producto → "Corregir stock".
-- Todo en una transacción y con respaldo. Correr en Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════
BEGIN;

-- 0) Respaldo (se pueden borrar cuando todo esté verificado)
CREATE TABLE IF NOT EXISTS stock_backup_20261104 AS SELECT * FROM stock;
CREATE TABLE IF NOT EXISTS stock_produccion_backup_20261104 AS SELECT * FROM stock_produccion;

-- 1) Materias primas en negativo por descuentos con gramos como kilos
UPDATE stock SET cantidad = 0, fecha_actualizacion = CURRENT_DATE
 WHERE categoria = 'VERDURAS' AND nombre IN ('LECHUGA', 'MORRON') AND cantidad < 0;

-- 2) Producción con valores imposibles (suma de errores de gramos/kilos) → 0 para recontar
UPDATE stock_produccion SET cantidad = 0
 WHERE categoria = 'verduras' AND producto IN ('Lechuga preparada', 'Morrón preparado')
   AND cantidad > 100;

-- 3) Producción en negativo por descuentos incorrectos (ya corregidos en el código)
UPDATE stock_produccion SET cantidad = 0
 WHERE cantidad < 0
   AND producto IN ('Nalga_L', 'SALSA CLUB', 'Menjunje Milanesa Carne', 'Menjunje Milanesa Pollo');

COMMIT;

-- ════════════════════════════════════════════════════════════
-- Control: lo que quedó sospechoso para que la encargada recuente y corrija
-- (cantidades muy altas o negativas; no se tocan automáticamente porque pueden ser reales)
-- ════════════════════════════════════════════════════════════
SELECT 'stock_produccion' AS tabla, categoria, producto AS nombre, cantidad, unidad
  FROM stock_produccion
 WHERE cantidad < 0
    OR (unidad IN ('kg','lt') AND cantidad > 150)
UNION ALL
SELECT 'stock', categoria, nombre, cantidad, unidad
  FROM stock
 WHERE cantidad < 0
    OR (unidad IN ('kg','lt') AND cantidad > 300)
ORDER BY 1, 2, 3;

-- Para recontar (esperado, según datos actuales):
--   • Blend Tapa de Asado + Aguja (~420 kg): burger no descontaba hasta ahora, probablemente inflado.
--   • TOMATE PRODUCIDO (~466 kg), Cebolla rodajas (~172 kg).
--   • Fiambres: JAMÓN (~286 kg), QUESO TYBO (~221 kg), Queso Muzza para Sanguchería (~343 kg).
-- Corregirlos desde el admin con el valor contado.
