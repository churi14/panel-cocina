import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

// ── Colores de marca ──────────────────────────────────────────────────────────
const COLOR = {
  header:      '1E293B', // slate-900
  headerFont:  'FFFFFF',
  subheader:   '334155', // slate-700
  accent:      'F59E0B', // amber-500
  accentDark:  'D97706', // amber-600
  rowAlt:      'F8FAFC', // slate-50
  rowNormal:   'FFFFFF',
  green:       '16A34A',
  red:         'DC2626',
  blue:        '2563EB',
  yellow:      'FEF08A', // para celdas editables
  yellowBorder:'EAB308',
  border:      'CBD5E1', // slate-300
  total:       'F1F5F9', // slate-100
  totalFont:   '0F172A', // slate-950
};

function hex(color: string): ExcelJS.Color {
  return { argb: 'FF' + color };
}

function headerStyle(ws: ExcelJS.Worksheet, row: number, cols: number, text: string, bg = COLOR.header) {
  ws.mergeCells(row, 1, row, cols);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: 'FF' + COLOR.headerFont }, size: 13, name: 'Arial' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(row).height = 28;
}

function columnHeaders(ws: ExcelJS.Worksheet, row: number, headers: string[], bg = COLOR.subheader) {
  const r = ws.getRow(row);
  r.height = 22;
  headers.forEach((h, i) => {
    const cell = r.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FF' + COLOR.headerFont }, size: 10, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: hex(COLOR.border) },
      right:  { style: 'thin', color: hex(COLOR.border) },
    };
  });
}

function dataRow(ws: ExcelJS.Worksheet, rowNum: number, values: (string | number | null)[], isAlt: boolean) {
  const r = ws.getRow(rowNum);
  r.height = 18;
  const bg = isAlt ? COLOR.rowAlt : COLOR.rowNormal;
  values.forEach((v, i) => {
    const cell = r.getCell(i + 1);
    cell.value = v ?? '';
    cell.font = { size: 10, name: 'Arial' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cell.border = {
      bottom: { style: 'hair', color: hex(COLOR.border) },
      right:  { style: 'hair', color: hex(COLOR.border) },
    };
    cell.alignment = { vertical: 'middle' };
  });
}

function totalRow(ws: ExcelJS.Worksheet, rowNum: number, values: (string | number | null)[]) {
  const r = ws.getRow(rowNum);
  r.height = 22;
  values.forEach((v, i) => {
    const cell = r.getCell(i + 1);
    cell.value = v ?? '';
    cell.font = { bold: true, size: 10, name: 'Arial', color: hex(COLOR.totalFont) };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(COLOR.total) };
    cell.border = {
      top:    { style: 'medium', color: hex(COLOR.accent) },
      bottom: { style: 'medium', color: hex(COLOR.accent) },
      right:  { style: 'thin',   color: hex(COLOR.border) },
    };
    cell.alignment = { vertical: 'middle' };
  });
}

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    lomito: 'Lomito', burger: 'Burger', milanesa: 'Milanesa',
    limpieza: 'Limpieza', cocina: 'Cocina', salsa: 'Salsa', verduras: 'Verdura',
  };
  return map[kind] ?? kind;
}

function tipoLabel(tipo: string): string {
  return tipo === 'inicio_paso1' ? 'Inicio paso 1'
    : tipo === 'fin_paso2'      ? 'Fin paso 2'
    : tipo === 'inicio_cocina'  ? 'Inicio cocina'
    : tipo === 'fin_cocina'     ? 'Fin cocina'
    : tipo;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  if (!desde || !hasta) {
    return NextResponse.json({ error: 'Parámetros desde/hasta requeridos' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ── Fetch data en paralelo ─────────────────────────────────────────────────
  const [{ data: eventos }, { data: movimientos }] = await Promise.all([
    supabase.from('produccion_eventos')
      .select('*')
      .gte('fecha', desde + 'T00:00:00')
      .lte('fecha', hasta + 'T23:59:59')
      .order('fecha', { ascending: true }),
    supabase.from('stock_movements')
      .select('*')
      .gte('fecha', desde + 'T00:00:00')
      .lte('fecha', hasta + 'T23:59:59')
      .order('fecha', { ascending: true }),
  ]);

  const ev  = (eventos    ?? []) as any[];
  const mov = (movimientos ?? []) as any[];

  // Período label
  const periodoLabel = desde === hasta
    ? fmtDate(desde + 'T12:00:00')
    : `${fmtDate(desde + 'T12:00:00')} — ${fmtDate(hasta + 'T12:00:00')}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'La Cocina Ushuaia — Panel Admin';
  wb.created = new Date();

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 1: Producción Diaria
  // ════════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet('📊 Producción Diaria', {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const COLS1 = 11;
  setColWidths(ws1, [12, 12, 8, 14, 16, 20, 10, 10, 10, 10, 20]);

  // Title
  headerStyle(ws1, 1, COLS1, `🏪 LA COCINA USHUAIA — Producción Diaria · ${periodoLabel}`);

  // Column headers
  columnHeaders(ws1, 2, [
    'FECHA', 'DÍA', 'HORA', 'OPERADOR', 'TIPO', 'CORTE / PRODUCTO',
    'KG BRUTO', 'KG NETO', 'DESPERDICIO', '% DESPERD.', 'DETALLE',
  ]);

  // Filter: only meaningful events
  const evFiltrados = ev.filter(e =>
    e.tipo === 'fin_paso2' || e.tipo === 'fin_cocina' || e.tipo === 'inicio_paso1'
  );

  let totalBruto1 = 0, totalNeto1 = 0, totalDesp1 = 0;

  evFiltrados.forEach((e, i) => {
    const bruto = Number(e.peso_kg) || 0;
    const desp  = Number(e.waste_kg) || 0;
    const neto  = Math.max(0, bruto - desp);
    const pctDesp = bruto > 0 ? desp / bruto : 0;

    totalBruto1 += bruto;
    totalNeto1  += neto;
    totalDesp1  += desp;

    const row = 3 + i;
    dataRow(ws1, row, [
      fmtDate(e.fecha),
      fmtDay(e.fecha),
      fmtTime(e.fecha),
      e.operador ?? '—',
      tipoLabel(e.tipo),
      e.corte ?? '—',
      bruto || null,
      neto || null,
      desp || null,
      pctDesp || null,
      e.detalle ?? '',
    ], i % 2 === 1);

    // Formato numérico
    const r = ws1.getRow(row);
    [7, 8, 9].forEach(c => { r.getCell(c).numFmt = '#,##0.000 "kg"'; });
    r.getCell(10).numFmt = '0.0%';

    // Color tipo
    const tipoCell = r.getCell(5);
    if (e.tipo?.includes('fin')) tipoCell.font = { ...tipoCell.font, color: hex(COLOR.green), bold: true };
    else tipoCell.font = { ...tipoCell.font, color: hex(COLOR.blue) };
  });

  // Total row
  const totalRow1 = 3 + evFiltrados.length;
  totalRow(ws1, totalRow1, [
    'TOTAL', '', '', '', '', `${evFiltrados.length} registros`,
    totalBruto1, totalNeto1, totalDesp1,
    totalBruto1 > 0 ? totalDesp1 / totalBruto1 : 0,
    '',
  ]);
  const tr1 = ws1.getRow(totalRow1);
  [7, 8, 9].forEach(c => { tr1.getCell(c).numFmt = '#,##0.000 "kg"'; });
  tr1.getCell(10).numFmt = '0.0%';

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 2: Movimientos de Stock
  // ════════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet('📦 Movimientos Stock', {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const COLS2 = 10;
  setColWidths(ws2, [12, 12, 8, 14, 22, 16, 10, 10, 8, 32]);

  headerStyle(ws2, 1, COLS2, `🏪 LA COCINA USHUAIA — Movimientos de Stock · ${periodoLabel}`);
  columnHeaders(ws2, 2, [
    'FECHA', 'DÍA', 'HORA', 'OPERADOR', 'PRODUCTO', 'CATEGORÍA',
    'TIPO', 'CANTIDAD', 'UNIDAD', 'MOTIVO / DESTINO',
  ]);

  let totalIngresos2 = 0, totalEgresos2 = 0;

  mov.forEach((m, i) => {
    const qty = Number(m.cantidad) || 0;
    const isIngreso = m.tipo === 'ingreso';
    if (isIngreso) totalIngresos2 += qty;
    else totalEgresos2 += qty;

    const row = 3 + i;
    dataRow(ws2, row, [
      fmtDate(m.fecha),
      fmtDay(m.fecha),
      fmtTime(m.fecha),
      m.operador ?? '—',
      m.nombre ?? '—',
      (m.categoria ?? '').toUpperCase() || '—',
      (m.tipo ?? '').toUpperCase(),
      qty,
      m.unidad ?? '',
      m.motivo ?? '',
    ], i % 2 === 1);

    const r = ws2.getRow(row);
    r.getCell(8).numFmt = '#,##0.000';
    const tipoCell = r.getCell(7);
    tipoCell.font = {
      ...tipoCell.font,
      color: hex(isIngreso ? COLOR.green : COLOR.red),
      bold: true,
    };
  });

  const totalRow2 = 3 + mov.length;
  totalRow(ws2, totalRow2, [
    'TOTAL', '', '', '', `${mov.length} registros`, '',
    '', '', '', `↑ ${totalIngresos2.toFixed(3)} ingresos · ↓ ${totalEgresos2.toFixed(3)} egresos`,
  ]);

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 3: Resumen por Producto
  // ════════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet('📈 Resumen Período', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const COLS3 = 8;
  setColWidths(ws3, [28, 8, 14, 14, 14, 12, 16, 16]);

  headerStyle(ws3, 1, COLS3, `🏪 LA COCINA USHUAIA — Resumen por Producto · ${periodoLabel}`);
  columnHeaders(ws3, 2, [
    'PRODUCTO', 'UNIDAD', 'TOTAL CONSUMIDO', 'TOTAL PRODUCIDO', 'DESPERDICIO',
    '% DESPERD.', 'DÍAS ACTIVO', 'PROMEDIO/DÍA',
  ]);

  // Pivot: consumo por producto (egresos en stock_movements)
  const productoMap: Record<string, {
    nombre: string; unidad: string; consumido: number; producido: number;
    desperdicio: number; dias: Set<string>;
  }> = {};

  mov.forEach(m => {
    const key = (m.nombre ?? '').toLowerCase().trim();
    if (!productoMap[key]) {
      productoMap[key] = { nombre: m.nombre ?? '—', unidad: m.unidad ?? '', consumido: 0, producido: 0, desperdicio: 0, dias: new Set() };
    }
    const qty = Number(m.cantidad) || 0;
    if (m.tipo === 'egreso') productoMap[key].consumido += qty;
    else productoMap[key].producido += qty;
    productoMap[key].dias.add(fmtDate(m.fecha));
  });

  // Añadir desperdicio de produccion_eventos
  ev.filter(e => Number(e.waste_kg) > 0).forEach(e => {
    const key = (e.corte ?? '').toLowerCase().trim() + '_prod';
    if (!productoMap[key]) {
      productoMap[key] = { nombre: `${e.corte ?? '—'} (producción)`, unidad: 'kg', consumido: 0, producido: Number(e.peso_kg) || 0, desperdicio: 0, dias: new Set() };
    }
    productoMap[key].desperdicio += Number(e.waste_kg) || 0;
    productoMap[key].dias.add(fmtDate(e.fecha));
  });

  const productos = Object.values(productoMap)
    .filter(p => p.consumido > 0 || p.producido > 0 || p.desperdicio > 0)
    .sort((a, b) => b.consumido - a.consumido);

  productos.forEach((p, i) => {
    const totalMov = p.consumido;
    const pctDesp = totalMov > 0 ? p.desperdicio / totalMov : (p.producido > 0 ? p.desperdicio / p.producido : 0);
    const dias = p.dias.size;
    const promDia = dias > 0 ? totalMov / dias : 0;

    const row = 3 + i;
    dataRow(ws3, row, [
      p.nombre, p.unidad,
      p.consumido || null,
      p.producido || null,
      p.desperdicio || null,
      pctDesp || null,
      dias || null,
      promDia || null,
    ], i % 2 === 1);

    const r = ws3.getRow(row);
    [3, 4, 5, 8].forEach(c => { r.getCell(c).numFmt = '#,##0.000'; });
    r.getCell(6).numFmt = '0.0%';
    if (pctDesp > 0.15) r.getCell(6).font = { ...r.getCell(6).font, color: hex(COLOR.red), bold: true };
  });

  const totalRow3 = 3 + productos.length;
  const totC = productos.reduce((s, p) => s + p.consumido, 0);
  const totP = productos.reduce((s, p) => s + p.producido, 0);
  const totD = productos.reduce((s, p) => s + p.desperdicio, 0);
  totalRow(ws3, totalRow3, [
    `${productos.length} productos`, '',
    totC || null, totP || null, totD || null,
    totC > 0 ? totD / totC : null, '', '',
  ]);
  const tr3 = ws3.getRow(totalRow3);
  [3, 4, 5].forEach(c => { tr3.getCell(c).numFmt = '#,##0.000'; });
  tr3.getCell(6).numFmt = '0.0%';

  // ════════════════════════════════════════════════════════════════════════════
  // HOJA 4: Calculadora de Costos
  // ════════════════════════════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet('💰 Calculadora Costos', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  const COLS4 = 7;
  setColWidths(ws4, [28, 8, 14, 16, 16, 16, 20]);

  headerStyle(ws4, 1, COLS4, `🏪 LA COCINA USHUAIA — Calculadora de Costos · ${periodoLabel}`, COLOR.accentDark);

  // Instrucciones
  ws4.mergeCells(2, 1, 2, COLS4);
  const instrCell = ws4.getCell(2, 1);
  instrCell.value = '✏️  Completá la columna PRECIO UNIT. (en pesos) para calcular el costo total del período';
  instrCell.font = { italic: true, size: 10, name: 'Arial', color: hex('78350F') };
  instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex('FEF3C7') };
  instrCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws4.getRow(2).height = 20;

  columnHeaders(ws4, 3, [
    'PRODUCTO', 'UNIDAD', 'CANTIDAD USADA', 'PRECIO UNIT. ($)',
    'COSTO TOTAL ($)', '% DEL COSTO', 'NOTAS',
  ], COLOR.accentDark);

  // Ejemplo (fila 4 en gris suave)
  const ejRow = ws4.getRow(4);
  ejRow.height = 18;
  ['Ejemplo: LOMO', 'kg', '120', '8500', '=C4*D4', '=E4/E$TOTAL', 'Precio promedio del mes'].forEach((v, i) => {
    const cell = ejRow.getCell(i + 1);
    cell.value = v;
    cell.font = { italic: true, size: 9, name: 'Arial', color: hex('94A3B8') };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex('F8FAFC') };
    cell.alignment = { vertical: 'middle' };
  });

  const DATA_START4 = 5;

  // Solo productos con consumo (egresos)
  const productosConConsumo = productos.filter(p => p.consumido > 0);

  productosConConsumo.forEach((p, i) => {
    const row = DATA_START4 + i;
    const r = ws4.getRow(row);
    r.height = 20;

    const bg = i % 2 === 1 ? COLOR.rowAlt : COLOR.rowNormal;

    // Columna A: Producto
    const cA = r.getCell(1);
    cA.value = p.nombre;
    cA.font = { size: 10, name: 'Arial', bold: true };
    cA.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cA.alignment = { vertical: 'middle' };

    // Columna B: Unidad
    const cB = r.getCell(2);
    cB.value = p.unidad;
    cB.font = { size: 10, name: 'Arial' };
    cB.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cB.alignment = { vertical: 'middle', horizontal: 'center' };

    // Columna C: Cantidad (fórmula-ready, pero cargada como valor)
    const cC = r.getCell(3);
    cC.value = parseFloat(p.consumido.toFixed(3));
    cC.numFmt = '#,##0.000';
    cC.font = { size: 10, name: 'Arial', color: hex(COLOR.blue) };
    cC.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cC.alignment = { vertical: 'middle', horizontal: 'right' };

    // Columna D: Precio (editable → fondo amarillo)
    const cD = r.getCell(4);
    cD.value = null;
    cD.numFmt = '$#,##0.00';
    cD.font = { size: 10, name: 'Arial', color: hex('92400E') };
    cD.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(COLOR.yellow) };
    cD.border = {
      top: { style: 'thin', color: hex(COLOR.yellowBorder) },
      bottom: { style: 'thin', color: hex(COLOR.yellowBorder) },
      left: { style: 'thin', color: hex(COLOR.yellowBorder) },
      right: { style: 'thin', color: hex(COLOR.yellowBorder) },
    };
    cD.alignment = { vertical: 'middle', horizontal: 'right' };

    // Columna E: Costo = C × D
    const cE = r.getCell(5);
    cE.value = { formula: `=C${row}*D${row}`, result: 0 };
    cE.numFmt = '$#,##0.00';
    cE.font = { size: 10, name: 'Arial', bold: true };
    cE.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bg) };
    cE.alignment = { vertical: 'middle', horizontal: 'right' };

    // Columna G: Notas (editable → fondo amarillo suave)
    const cG = r.getCell(7);
    cG.value = '';
    cG.font = { size: 10, name: 'Arial' };
    cG.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(COLOR.yellow) };
    cG.border = {
      top: { style: 'hair', color: hex(COLOR.yellowBorder) },
      bottom: { style: 'hair', color: hex(COLOR.yellowBorder) },
    };

    [cA, cB, cC, cE].forEach(c => {
      c.border = {
        bottom: { style: 'hair', color: hex(COLOR.border) },
        right:  { style: 'hair', color: hex(COLOR.border) },
      };
    });
  });

  // Fila TOTAL
  const totalRow4 = DATA_START4 + productosConConsumo.length;
  const costoTotalRef = productosConConsumo.length > 0
    ? `E${DATA_START4}:E${totalRow4 - 1}`
    : `E${DATA_START4}`;

  const tr4 = ws4.getRow(totalRow4);
  tr4.height = 26;
  const bgTotal = COLOR.header;

  const labels4 = ['COSTO TOTAL DEL PERÍODO', '', '', '', { formula: `=SUM(${costoTotalRef})`, result: 0 }, '', ''];
  labels4.forEach((v, i) => {
    const cell = tr4.getCell(i + 1);
    cell.value = v as any;
    cell.font = { bold: true, size: 12, name: 'Arial', color: hex(COLOR.headerFont) };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(bgTotal) };
    cell.border = {
      top:    { style: 'medium', color: hex(COLOR.accent) },
      bottom: { style: 'medium', color: hex(COLOR.accent) },
    };
    cell.alignment = { vertical: 'middle' };
  });
  tr4.getCell(5).numFmt = '$#,##0.00';
  tr4.getCell(5).font = { bold: true, size: 14, name: 'Arial', color: hex(COLOR.accent) };

  // Leyenda al pie
  const legendRow = totalRow4 + 2;
  ws4.mergeCells(legendRow, 1, legendRow, COLS4);
  const leg = ws4.getCell(legendRow, 1);
  leg.value = '🟡 Celdas con fondo amarillo = editables · 🔵 Cantidades importadas del sistema · El Excel se puede guardar y actualizar cuando quieras.';
  leg.font = { italic: true, size: 9, name: 'Arial', color: hex('64748B') };
  leg.alignment = { wrapText: true };

  // ── Generar buffer ─────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  const nombreArchivo = `LaCocinUshuaia_${desde}_${hasta}.xlsx`
    .replace(/[^a-zA-Z0-9_.\-]/g, '_');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'no-store',
    },
  });
}
