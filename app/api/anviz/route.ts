import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

// ── Constantes ────────────────────────────────────────────────────────────────
const EPOCH_MS    = new Date('2000-01-02T00:00:00Z').getTime();
const RECORD_SIZE = 14;
const DIAS        = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ── Mapeo fijo de IDs del reloj Anviz ─────────────────────────────────────────
const USUARIOS_DB: Record<number, string> = {
  1: 'Teo',
  2: 'Milagros',
  3: 'Daiana',
  4: 'Julian',
  5: 'Juliana',
  6: 'Marina',
};

// ── 2. Parsear BAK.KQ → registros crudos ──────────────────────────────────────
// Estructura big-endian por registro (14 bytes): Q(8) I(4) B(1) B(1)
//   Q = user_id   I = timestamp_desde_epoch_anviz   B2 = estado_raw
function parseKQ(buf: Buffer): { userId: number; fecha: Date; estadoRaw: number }[] {
  const records: { userId: number; fecha: Date; estadoRaw: number }[] = [];
  const data = buf.slice(RECORD_SIZE); // saltar cabecera rota

  for (let i = 0; i + RECORD_SIZE <= data.length; i += RECORD_SIZE) {
    const chunk = data.slice(i, i + RECORD_SIZE);
    try {
      const userId    = Number(chunk.readBigUInt64BE(0));
      const timestamp = chunk.readUInt32BE(8);
      const estadoRaw = chunk.readUInt8(13);
      const fecha     = new Date(EPOCH_MS + timestamp * 1000);
      records.push({ userId, fecha, estadoRaw });
    } catch {
      break;
    }
  }
  return records;
}

// ── 3. Calcular turnos con lógica nocturna (−6h) ──────────────────────────────
type Fila = {
  empleado: string; dia: string; fecha: string;
  entrada: string; salida: string; horas: string; obs: string;
};

function fmtHora(d: Date): string {
  return d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function calcularTurnos(
  records: ReturnType<typeof parseKQ>,
  usuarios: Record<number, string>,
): Fila[] {
  const grupos = new Map<string, Date[]>();

  for (const r of records) {
    const nombre     = usuarios[r.userId] ?? `ID ${r.userId}`;
    const logicoDate = new Date(r.fecha.getTime() - 6 * 3600_000);
    const key        = `${nombre}||${logicoDate.toISOString().slice(0, 10)}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(r.fecha);
  }

  const filas: Fila[] = [];

  for (const [key, horas] of grupos) {
    const [empleado, fechaTurnoISO] = key.split('||');
    horas.sort((a, b) => a.getTime() - b.getTime());

    const fechaTurno = new Date(fechaTurnoISO + 'T00:00:00Z');
    const diaSemana  = DIAS[fechaTurno.getUTCDay() === 0 ? 6 : fechaTurno.getUTCDay() - 1];
    const fechaStr   = [
      String(fechaTurno.getUTCDate()).padStart(2, '0'),
      String(fechaTurno.getUTCMonth() + 1).padStart(2, '0'),
      fechaTurno.getUTCFullYear(),
    ].join('/');

    const entrada = horas[0];
    let salida = '';
    let horasTrabajadas = '';
    let obs = '';

    if (horas.length > 1) {
      const salidaObj = horas[horas.length - 1];
      const diffMs    = salidaObj.getTime() - entrada.getTime();

      if (diffMs < 5 * 60_000) {
        obs    = 'Fichadas muy juntas (<5m)';
        salida = fmtHora(salidaObj);
      } else {
        const totalMin = Math.floor(diffMs / 60_000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        horasTrabajadas = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const cruzaMedianoche =
          salidaObj.toISOString().slice(0, 10) > entrada.toISOString().slice(0, 10);
        salida = fmtHora(salidaObj) + (cruzaMedianoche ? ' (+1)' : '');
        if (cruzaMedianoche) obs = 'Turno cruzó medianoche';
      }
    } else {
      obs = 'Falta marcar salida';
    }

    filas.push({ empleado, dia: diaSemana, fecha: fechaStr, entrada: fmtHora(entrada), salida, horas: horasTrabajadas, obs });
  }

  filas.sort((a, b) => {
    if (a.empleado !== b.empleado) return a.empleado.localeCompare(b.empleado);
    const parseDate = (s: string) => {
      const [d, m, y] = s.split('/');
      return new Date(`${y}-${m}-${d}`).getTime();
    };
    return parseDate(a.fecha) - parseDate(b.fecha);
  });

  return filas;
}

// ── Paleta de colores por empleado (cicla si hay más de 5) ───────────────────
const EMP_PALETTES = [
  { header: 'FF1E3A5F', row1: 'FFDBEAFE', row2: 'FFEff6ff' }, // azul
  { header: 'FF14532D', row1: 'FFDCFCE7', row2: 'FFF0FDF4' }, // verde
  { header: 'FF7C2D12', row1: 'FFFFEDD5', row2: 'FFFFF7ED' }, // naranja
  { header: 'FF581C87', row1: 'FFF3E8FF', row2: 'FFFAF5FF' }, // violeta
  { header: 'FF713F12', row1: 'FFFEF3C7', row2: 'FFFFFBEB' }, // ámbar
];

// ── 4. Generar Excel estilizado con ExcelJS ────────────────────────────────────
async function generarExcel(filas: Fila[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'La Cocina Ushuaia';
  const ws = wb.addWorksheet('Asistencia', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  ws.columns = [
    { key: 'empleado', width: 18 },
    { key: 'dia',      width: 13 },
    { key: 'fecha',    width: 13 },
    { key: 'entrada',  width: 12 },
    { key: 'salida',   width: 17 },
    { key: 'horas',    width: 16 },
    { key: 'obs',      width: 28 },
  ];

  // ── Fila de título ──────────────────────────────────────────────────────────
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '🍳  REPORTE DE ASISTENCIA — LA COCINA USHUAIA';
  titleCell.font  = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // ── Fila de cabecera ────────────────────────────────────────────────────────
  const HEADERS = ['Empleado', 'Día', 'Fecha', 'Entrada', 'Salida', 'Hs. Trabajadas', 'Observaciones'];
  const headerRow = ws.addRow(HEADERS);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
  });

  // ── Agrupar por empleado ────────────────────────────────────────────────────
  const grupos = new Map<string, Fila[]>();
  for (const f of filas) {
    if (!grupos.has(f.empleado)) grupos.set(f.empleado, []);
    grupos.get(f.empleado)!.push(f);
  }

  let paletteIdx = 0;
  let rowIdx = 3;

  for (const [empleado, empFilas] of grupos) {
    const pal = EMP_PALETTES[paletteIdx % EMP_PALETTES.length];
    paletteIdx++;

    // ── Cabecera de empleado ──────────────────────────────────────────────────
    ws.mergeCells(`A${rowIdx}:G${rowIdx}`);
    const empHeaderCell = ws.getCell(`A${rowIdx}`);
    empHeaderCell.value     = `  ${empleado.toUpperCase()}`;
    empHeaderCell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    empHeaderCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: pal.header } };
    empHeaderCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(rowIdx).height = 20;
    rowIdx++;

    let totalMinutes = 0;
    let diasConHoras = 0;
    let rowToggle    = true;

    for (const f of empFilas) {
      const row = ws.addRow([f.empleado, f.dia, f.fecha, f.entrada, f.salida, f.horas, f.obs ?? '']);
      row.height = 18;

      if (f.horas) {
        const [h, m] = f.horas.split(':').map(Number);
        totalMinutes += h * 60 + m;
        diasConHoras++;
      }

      // Color de fondo según estado
      let bgArgb = rowToggle ? pal.row1 : pal.row2;
      let obsFontArgb = 'FF64748B';
      if (f.obs === 'Falta marcar salida') { bgArgb = 'FFFEE2E2'; obsFontArgb = 'FF991B1B'; }
      else if (f.obs?.includes('juntas'))   { bgArgb = 'FFFFEDD5'; obsFontArgb = 'FF9A3412'; }

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.alignment = { horizontal: col <= 1 ? 'left' : 'center', vertical: 'middle' };
        cell.font      = { size: 10 };
        cell.border    = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };

        // Horas trabajadas: verde y negrita
        if (col === 6 && f.horas) {
          cell.font = { size: 10, bold: true, color: { argb: 'FF166534' } };
        }
        // Observaciones: color según tipo
        if (col === 7 && f.obs) {
          cell.font = { size: 9, italic: true, color: { argb: obsFontArgb } };
        }
      });

      rowToggle = !rowToggle;
      rowIdx++;
    }

    // ── Fila de totales por empleado ─────────────────────────────────────────
    const totalH   = Math.floor(totalMinutes / 60);
    const totalM   = totalMinutes % 60;
    const totalStr = `${String(totalH).padStart(2, '0')}:${String(totalM).padStart(2, '0')}`;

    ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
    const totRow = ws.getRow(rowIdx);
    totRow.height = 20;

    const totLabelCell = ws.getCell(`A${rowIdx}`);
    totLabelCell.value     = `Total ${empleado} · ${diasConHoras} día${diasConHoras !== 1 ? 's' : ''}`;
    totLabelCell.font      = { bold: true, size: 10, italic: true, color: { argb: 'FF475569' } };
    totLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totHorasCell = ws.getCell(`F${rowIdx}`);
    totHorasCell.value     = totalStr;
    totHorasCell.font      = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
    totHorasCell.alignment = { horizontal: 'center', vertical: 'middle' };

    totRow.eachCell({ includeEmpty: true }, cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top:    { style: 'thin',  color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin',  color: { argb: 'FF94A3B8' } },
      };
    });
    rowIdx++;

    // Fila en blanco entre empleados
    ws.addRow([]);
    rowIdx++;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData();
    const kqFile = form.get('kq') as File | null;

    if (!kqFile) {
      return NextResponse.json({ error: 'Falta el archivo BAK.KQ' }, { status: 400 });
    }

    const kqBuf  = Buffer.from(await kqFile.arrayBuffer());
    const records = parseKQ(kqBuf);
    const filas   = calcularTurnos(records, USUARIOS_DB);
    const xlsxBuf  = await generarExcel(filas);

    // ── Guardar en Supabase Storage ──────────────────────────────────────────
    const fecha       = new Date().toISOString().slice(0, 10);
    const timestamp   = Date.now();
    const filename    = `Asistencia_${fecha}_${timestamp}.xlsx`;
    const storagePath = `reportes/${filename}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: uploadError } = await supabase.storage
      .from('fichador')
      .upload(storagePath, xlsxBuf, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('fichador').getPublicUrl(storagePath);
      const empleados = new Set(filas.map(f => f.empleado)).size;

      await supabase.from('fichador_reportes').insert({
        filename,
        storage_path: storagePath,
        url: urlData.publicUrl,
        rows_count: filas.length,
        empleados_count: empleados,
      });
    } else {
      console.warn('[anviz] storage upload failed:', uploadError.message);
    }

    // ── Devolver el xlsx para descarga inmediata ──────────────────────────────
    return new NextResponse(new Uint8Array(xlsxBuf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('[anviz]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
