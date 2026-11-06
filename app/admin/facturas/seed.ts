// Datos leídos de las fotos de facturas (carpeta FACTURAS). Se pueden corregir desde Admin → Registro.
export type ItemFactura = {
  desc: string;            // como figura en la factura
  insumo: string;          // nombre del insumo (el mismo que en Stock / Costos)
  cant: number;            // cantidad comprada
  precio: number | null;   // precio por unidad de compra (ya con descuento)
  cont: number | null;     // kg / lt / u que trae cada unidad de compra (5 = bolsa de 5 kg)
  uc: 'kg' | 'lt' | 'u';   // unidad en que se mide el contenido
  duda?: string;           // lo que no se pudo leer / confirmar
};
export type Factura = {
  id: string;
  proveedor: string;
  numero: string;
  fecha: string;           // YYYY-MM-DD
  items: ItemFactura[];
};

const kg = (desc: string, insumo: string, cant: number, precio: number | null, duda?: string): ItemFactura =>
  ({ desc, insumo, cant, precio, cont: 1, uc: 'kg', duda });

export const FACTURAS_SEED: Factura[] = [
  { id: 'f01', proveedor: 'DASA', numero: '0006-00135241', fecha: '2026-08-24', items: [
    { desc: 'Tonadita cheddar untable salsa 2 x 3 kg', insumo: 'Cheddar liquido', cant: 2, precio: 24943.8, cont: 3, uc: 'kg' },
    { desc: 'Celusal sal entrefina paquete 30 x 500', insumo: 'Sal', cant: 4, precio: 1576.2, cont: 0.5, uc: 'kg', duda: '¿Cada unidad es un paquete de 500 g?' },
  ] },
  { id: 'f02', proveedor: 'Sena Nelson Alejandro', numero: 'C 00002-00000481', fecha: '2026-09-10', items: [
    { desc: 'Cajas empanadas N°9', insumo: 'Caja empanada', cant: 3000, precio: 510, cont: 1, uc: 'u' },
    { desc: 'Cajas lomitos', insumo: 'CAJAS LOMITOS', cant: 1500, precio: 450, cont: 1, uc: 'u' },
  ] },
  { id: 'f03', proveedor: 'Abamar', numero: 'A 0015-00110392', fecha: '2026-10-03', items: [
    { desc: 'Ketchup sachet x 3 kg Hellmanns (-15%)', insumo: 'Ketchup', cant: 2, precio: 11849, cont: 3, uc: 'kg' },
  ] },
  { id: 'f04', proveedor: 'Abamar', numero: 'A 0015-00107079', fecha: '2026-08-07', items: [
    { desc: 'Mozzarella x 25 kg Vidal (-15%)', insumo: 'QUESO MUZZA', cant: 1, precio: 239700, cont: 25, uc: 'kg' },
    { desc: 'Manteca pilón x 5 kg Vidal (-15%)', insumo: 'Manteca', cant: 1, precio: 65911, cont: 5, uc: 'kg' },
    { desc: 'Mayonesa 3 bolsas x 2900 cc Hellmanns (-15%)', insumo: 'Mayonesa', cant: 9, precio: 10727, cont: 2.9, uc: 'lt', duda: 'Dice "3 bolsas x 2900 cc": ¿cada unidad son 3 bolsas (8,7 L) o 1 bolsa de 2,9 L? El precio parece de 1 bolsa.' },
    { desc: 'Limón jugo x 1 lt Minerva (-15%)', insumo: 'Limon', cant: 12, precio: 7259, cont: 1, uc: 'lt' },
  ] },
  { id: 'f05', proveedor: 'Abamar', numero: 'A 0015-00111996', fecha: '2026-11-03', items: [
    { desc: 'Mozzarella x 25 kg Vidal (-15%)', insumo: 'QUESO MUZZA', cant: 1, precio: 239700, cont: 25, uc: 'kg' },
  ] },
  { id: 'f06', proveedor: 'DASA', numero: '0006-00138371', fecha: '2026-11-02', items: [
    { desc: 'Campo Austral jamón cocido barra 50 cm (-5%: 11.412,80 → 10.842,16)', insumo: 'Jamon', cant: 9.4, precio: 10842.16, cont: 1, uc: 'kg' },
  ] },
  { id: 'f07', proveedor: 'Distri TDF', numero: 'A-0009-00001178', fecha: '2026-10-16', items: [
    { desc: 'Aceite girasol Cañuelas x 5 lt (4)', insumo: 'Aceite girasol', cant: 40, precio: 18451.35, cont: 5, uc: 'lt', duda: 'Supuse bidones de 5 L (≈ $3.690/L). Si cada unidad es una caja de 4, avisame.' },
  ] },
  { id: 'f08', proveedor: 'Aimá Distribuidora', numero: '0010-00034151', fecha: '2026-10-16', items: [
    { desc: 'Aceite Lágrimas del Sol alto oleico', insumo: 'Aceite alto oleico', cant: 16, precio: 27252.13, cont: null, uc: 'lt', duda: 'No se ve el tamaño del envase. ¿5 L?' },
  ] },
  { id: 'f09', proveedor: 'Blancaluna Austral Food', numero: 'Remito 000-00001152', fecha: '2026-10-29', items: [
    { desc: 'Queso cheddar americano x 140 fetas Tonadita, pieza x 1,66 kg', insumo: 'Cheddar fetas burger', cant: 6, precio: null, cont: 1.66, uc: 'kg', duda: 'Es un remito, no trae precios. Total 9,96 kg.' },
  ] },
  { id: 'f10', proveedor: 'Blancaluna Austral Food', numero: '0002-54329', fecha: '2026-10-31', items: [
    { desc: 'Salsa barbacoa Hellmann\'s bol x 1 kg', insumo: 'Barbacoa', cant: 8, precio: 4331.7, cont: 1, uc: 'kg' },
    { desc: 'Morrón Cumana lata x 750 g', insumo: 'MORRON EN LATA', cant: 12, precio: 4495.4, cont: 0.75, uc: 'kg' },
    { desc: 'Azúcar común Domino bol x 1 kg', insumo: 'Azucar', cant: 10, precio: 1586.45, cont: 1, uc: 'kg' },
    { desc: 'Mayonesa Hellmann\'s clásica bol x 2.900 cc', insumo: 'Mayonesa', cant: 9, precio: 11814.62, cont: 2.9, uc: 'lt' },
    kg('Queso barra Tybo La Paulina x kg', 'Queso tybo', 30.2, 8990),
  ] },
  { id: 'f11', proveedor: 'Blancaluna Austral Food', numero: '0002-54418', fecha: '2026-11-03', items: [
    { desc: 'Vinagre de alcohol Favinco bid x 5 lt', insumo: 'Vinagre', cant: 4, precio: 6091.46, cont: 5, uc: 'lt' },
    { desc: 'Pan rallado preferido bol x 5 kg', insumo: 'Pan rallado', cant: 6, precio: 12289.56, cont: 5, uc: 'kg' },
    { desc: 'Mostaza Savora tradicional bol x 5 kg', insumo: 'SAVORA', cant: 2, precio: 9612.9, cont: 5, uc: 'kg' },
    { desc: 'Levadura instantánea Mauripan est x 500 g', insumo: 'Levadura', cant: 5, precio: 8202.48, cont: 0.5, uc: 'kg' },
  ] },
  { id: 'f12', proveedor: 'Blancaluna Austral Food', numero: '0002-52071', fecha: '2026-09-05', items: [
    { desc: 'Mejorador Mejormiga bol x 10 kg', insumo: 'MEJORADOR MEJORMIGA', cant: 1, precio: 72892.56, cont: 10, uc: 'kg' },
  ] },
  { id: 'f13', proveedor: 'Blancaluna Austral Food', numero: '0002-51438', fecha: '2026-08-22', items: [
    { desc: 'Pepinos agridulces Reygal fco x 3 kg', insumo: 'PEPINO ENCURTIDO', cant: 1, precio: 17503.28, cont: 3, uc: 'kg' },
  ] },
  { id: 'f14', proveedor: 'SGL', numero: 'A 0014-00043683', fecha: '2026-11-02', items: [
    { desc: 'Lechuga repollada (1 cajón)', insumo: 'Lechuga', cant: 1, precio: 30000, cont: null, uc: 'kg', duda: 'A mano parece decir "13 00": ¿13 kg?' },
    { desc: 'Tomates redondo cajón gde (1)', insumo: 'TOMATE DE CAJON', cant: 1, precio: 47500, cont: null, uc: 'kg', duda: 'A mano parece decir "16 000": ¿16 kg?' },
    { desc: 'Cebolla nacional argentina (1)', insumo: 'Cebolla', cant: 1, precio: 48000, cont: 19.81, uc: 'kg', duda: 'A mano: 19,810 kg' },
  ] },
  { id: 'f15', proveedor: 'SGL', numero: 'A 0014-00042116', fecha: '2026-09-30', items: [
    { desc: 'Ajo cajón x 5 kg', insumo: 'Ajo', cant: 1, precio: 58500, cont: 5, uc: 'kg' },
    kg('Morrón colorado x kg', 'Morron', 2, 7300),
    kg('Morrón verde x kg', 'Morron verde', 2, 7300),
  ] },
  { id: 'f16', proveedor: 'SGL', numero: 'A 0014-00043221', fecha: '2026-10-23', items: [
    { desc: 'Perejil jaula', insumo: 'Perejil', cant: 1, precio: 37900, cont: null, uc: 'kg', duda: 'No dice cuántos kg trae la jaula.' },
  ] },
  { id: 'f17', proveedor: 'Surtry S.A.S.', numero: 'A 00001-00025033', fecha: '2026-11-03', items: [
    { desc: 'Huevo blanco N°2', insumo: 'Huevo', cant: 5, precio: 38500, cont: null, uc: 'u', duda: '¿Cada unidad es un cajón o un maple? ¿Cuántos huevos trae?' },
    kg('Queso cheddar barra x kg Tremblay', 'CHEDDAR EN FETA', 3.94, 11526.19),
  ] },
  { id: 'f18', proveedor: 'Compañía Bernal', numero: 'E 0125-00008089', fecha: '2026-10-15', items: [
    kg('Aguja E/mitad ST enfriada Ciaber', 'Aguja', 21.82, 9533.35),
    kg('Cuadril ST CC enfriado Ciaber', 'Cuadril', 24.38, 12404.1),
    kg('T de asado enfriado Ciaber', 'T de asado', 19.48, 10148.7),
    kg('Nalga feteada enfriada Ciaber premium (3 u)', 'Nalga', 66.66, 13343.6),
  ] },
  { id: 'f19', proveedor: '3 Ciudades', numero: 'A 00260-00013453', fecha: '2026-10-28', items: [
    kg('Cagnoli panceta ahumada y cocida (precio x kilo)', 'Panceta', 11.5, 22960),
  ] },
  { id: 'f20', proveedor: 'CH Distribuidora', numero: 'A 0007-00005579', fecha: '2026-10-15', items: [
    kg('Provoleta parrillera Tremblay', 'Provoleta', 8.3, 20930, 'No dice la unidad: supuse kg.'),
  ] },
  { id: 'f21', proveedor: 'DASA', numero: '0006-00137273', fecha: '2026-10-08', items: [
    { desc: 'Tonadita manteca pilón 1 x 5 kg', insumo: 'Manteca', cant: 2, precio: 67689, cont: 5, uc: 'kg' },
  ] },
  { id: 'f22', proveedor: 'Distribuidora Don Luis', numero: 'A-0004-00046676', fecha: '2026-10-23', items: [
    { desc: 'Harina 0000 x 25 kg Don Antonio', insumo: 'Harina 0000', cant: 3, precio: 30900, cont: 25, uc: 'kg' },
    { desc: 'Harina 000 x 25 kg Don Antonio', insumo: 'Harina 000', cant: 3, precio: 27900, cont: 25, uc: 'kg' },
  ] },
  { id: 'f23', proveedor: 'Distri TDF', numero: 'A-0010-00002498', fecha: '2026-10-05', items: [
    kg('Lomos c/c Rafaela E/V congelado +1,7 (752)', 'Lomo', 114.4, 19500),
  ] },
  { id: 'f24', proveedor: 'Ooshooia Logistic Group', numero: 'A-0002-00004828', fecha: '2026-10-07', items: [
    { desc: 'Leche clasificada entera 1 lt Apóstoles 2%', insumo: 'Leche', cant: 36, precio: 1750, cont: 1, uc: 'lt' },
    { desc: 'Azúcar x 1 kg La Campechana', insumo: 'Azucar', cant: 10, precio: 1490, cont: 1, uc: 'kg' },
  ] },
  { id: 'f25', proveedor: 'EFA - Empresa Fueguina de Alimentos', numero: 'A 00662-00004260', fecha: '2026-10-28', items: [
    kg('Suprema de pollo IQF x 10 kg Bello', 'Suprema', 20, 7900),
  ] },
  { id: 'f26', proveedor: 'Creando Momentos', numero: 'E 00005-00000040', fecha: '2026-10-13', items: [
    { desc: 'Hamburguesa Max Golden 80 g x 48 u (caja)', insumo: 'Pan burger', cant: 15, precio: 35380.8, cont: 48, uc: 'u' },
  ] },
  { id: 'f27', proveedor: 'SGL', numero: 'A 0018-00007307', fecha: '2026-08-28', items: [
    kg('Ají picante x kg', 'AJÍ EN FRUTA', 1.8, 15200, 'A mano dice algo como "1715".'),
  ] },
  { id: 'f28', proveedor: 'Frigorífico Pastoriza', numero: 'B 00004-00205454', fecha: '2026-10-26', items: [
    kg('Grasa vacuna p/derretir', 'GRASA', 13.37, 3000),
  ] },
  { id: 'f29', proveedor: 'Supermercados La Anónima', numero: 'B 04280-04403068', fecha: '2026-10-06', items: [
    { desc: 'Queso crema cla fort (4 x 5.150, con descuento de 5.150 en total)', insumo: 'Queso crema', cant: 4, precio: 3862.5, cont: null, uc: 'kg', duda: 'El ticket no muestra el gramaje de cada queso crema.' },
  ] },
  { id: 'f30', proveedor: 'Golden S.A.S. (Mundo Papel)', numero: 'A-0002-00019622', fecha: '2026-10-30', items: [
    kg('Lámina Folex 25x37 x kg', 'Folex', 10, 12158.7),
  ] },
  { id: 'f31', proveedor: 'Pafundi Julieta Denise', numero: 'E 00010-00000003', fecha: '2026-08-12', items: [
    { desc: 'PAL1 - Aluminio (envoltorio térmico)', insumo: 'Aluminio', cant: 3, precio: 328333.33, cont: 1, uc: 'u', duda: 'La captura no traía mensaje; leí "envoltorio térmico" del remito.' },
  ] },
  { id: 'f32', proveedor: 'Pafundi Julieta Denise', numero: 'E 00010-00000004', fecha: '2026-10-20', items: [
    { desc: 'Bolsas delivery', insumo: 'Bolsa de papel', cant: 11, precio: 69394.18, cont: 1, uc: 'u', duda: 'Son 11 bultos; ¿cuántas bolsas trae cada uno?' },
  ] },
];
