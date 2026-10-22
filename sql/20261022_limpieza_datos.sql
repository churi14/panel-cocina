-- ════════════════════════════════════════════════════════════
-- Limpieza de datos de stock — REVISAR ANTES DE CORRER
-- Todo va en una transacción y deja copia de respaldo (tablas *_backup_20261022).
-- Si algo falla, no se aplica nada.
-- Basado en las respuestas de cocina (documento "Preguntas para cocina").
-- ════════════════════════════════════════════════════════════
BEGIN;

-- 0) Respaldo (se pueden borrar cuando todo esté verificado)
CREATE TABLE IF NOT EXISTS stock_backup_20261022 AS SELECT * FROM stock;
CREATE TABLE IF NOT EXISTS stock_produccion_backup_20261022 AS SELECT * FROM stock_produccion;

-- 1) Materias primas que faltaban (cantidad 0; las carga la encargada con la factura)
INSERT INTO stock (nombre, categoria, cantidad, unidad)
SELECT v.nombre, v.categoria, 0, v.unidad
FROM (VALUES
  ('NALGA CON TAPA',    'CARNES', 'kg'),
  ('HARINA 0000',       'SECOS',  'kg'),
  ('TOMATE TRITURADO',  'SECOS',  'kg'),
  ('BICARBONATO',       'SECOS',  'kg'),
  ('RELISH',            'SECOS',  'kg'),
  ('PIMIENTA',          'SECOS',  'kg')
) AS v(nombre, categoria, unidad)
WHERE NOT EXISTS (SELECT 1 FROM stock s WHERE upper(s.nombre) = v.nombre);

-- 2) Limón se compra por kilo (estaba cargado en litros)
UPDATE stock SET unidad = 'kg' WHERE upper(nombre) IN ('LIMÓN', 'LIMON');

-- 3) Filas duplicadas en stock_produccion (mismo producto escrito distinto): se suman en la oficial
--    Salsa de Ajo  →  SALSA DE AJO
UPDATE stock_produccion o
   SET cantidad = o.cantidad + COALESCE((SELECT sum(d.cantidad) FROM stock_produccion d WHERE d.producto = 'Salsa de Ajo'), 0)
 WHERE o.producto = 'SALSA DE AJO'
   AND EXISTS (SELECT 1 FROM stock_produccion d WHERE d.producto = 'Salsa de Ajo');
DELETE FROM stock_produccion WHERE producto = 'Salsa de Ajo'
  AND EXISTS (SELECT 1 FROM stock_produccion WHERE producto = 'SALSA DE AJO');

--    Milanesa - Pollo_L (0 kg)  →  se descarta, la oficial es "Milanesa - Pollo"
DELETE FROM stock_produccion WHERE producto = 'Milanesa - Pollo_L' AND cantidad = 0;

--    Milanesa de Carne Empanada - Nalga Limpia (0 kg)  →  se descarta, la oficial es "Milanesa de Carne Empanada"
DELETE FROM stock_produccion WHERE producto = 'Milanesa de Carne Empanada - Nalga Limpia' AND cantidad = 0;

-- 4) Negativos causados por descuentos incorrectos → 0
UPDATE stock_produccion SET cantidad = 0
 WHERE producto IN ('Nalga_L', 'SALSA CLUB', 'Menjunje Milanesa Carne', 'Menjunje Milanesa Pollo')
   AND cantidad < 0;

COMMIT;

-- 5) Control posterior (opcional): no debería quedar ningún negativo de los corregidos
SELECT producto, cantidad FROM stock_produccion WHERE cantidad < 0;

-- NO incluido a propósito (falta confirmar con cocina):
--   • "Lechuga preparada" (23.156 kg) y "Tomate producido" (390 kg): hay que saber el valor real.
--   • Picaña Limpia / Nalga Limpia: son productos distintos, no se fusionan.
