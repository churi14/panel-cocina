import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// ── Constantes ────────────────────────────────────────────────────────────────
const EPOCH_MS    = new Date('2000-01-02T00:00:00Z').getTime();
const RECORD_SIZE = 14;
const DIAS        = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ── 1. Parsear BAK.YG5 → mapa id→nombre ───────────────────────────────────────
function parseYG5(buf: Buffer): Record<number, string> {
  const clean  = buf.toString('latin1').replace(/[\x00\xff]/g, '');
  const nombres = clean.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]+/g) ?? [];
  const usuarios: Record<number, string> = {};
  nombres.forEach((n, i) => {
    usuarios[i + 1] = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  });
  return usuarios;
}

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

// ── 4. Generar Excel con xlsx ──────────────────────────────────────────────────
function generarExcel(filas: Fila[]): Buffer {
  const wb = XLSX.utils.book_new();

  // Datos
  const rows = [
    ['Empleado', 'Día del Turno', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Horas Trabajadas', 'Observaciones'],
    ...filas.map(f => [f.empleado, f.dia, f.fecha, f.entrada, f.salida, f.horas, f.obs]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ancho columnas
  ws['!cols'] = [20, 15, 13, 13, 18, 18, 25].map(w => ({ wch: w }));

  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData();
    const yg5File = form.get('yg5') as File | null;
    const kqFile  = form.get('kq')  as File | null;

    if (!yg5File || !kqFile) {
      return NextResponse.json({ error: 'Faltan archivos (yg5 y kq requeridos)' }, { status: 400 });
    }

    const [yg5Buf, kqBuf] = await Promise.all([
      yg5File.arrayBuffer().then(ab => Buffer.from(ab)),
      kqFile.arrayBuffer().then(ab => Buffer.from(ab)),
    ]);

    const usuarios = parseYG5(yg5Buf);
    const records  = parseKQ(kqBuf);
    const filas    = calcularTurnos(records, usuarios);
    const xlsxBuf  = generarExcel(filas);

    const fecha = new Date().toISOString().slice(0, 10);
    return new NextResponse(xlsxBuf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Asistencia_${fecha}.xlsx"`,
      },
    });
  } catch (e: any) {
    console.error('[anviz]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
