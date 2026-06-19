import { NextRequest, NextResponse } from 'next/server';

const FUDO_AUTH_URL  = 'https://auth.fu.do/api';
const FUDO_API_BASE  = 'https://api.fu.do/v1alpha1';
const API_KEY        = process.env.FUDO_API_KEY!;
const API_SECRET     = process.env.FUDO_API_SECRET!;

// Cache token en memoria (dura 24hs, se renueva si expira)
let cachedToken: string | null = null;
let tokenExp: number           = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() / 1000 < tokenExp - 60) return cachedToken;
  const res = await fetch(FUDO_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY, apiSecret: API_SECRET }),
  });
  if (!res.ok) throw new Error(`Fudo auth error: ${res.status}`);
  const data = await res.json();
  cachedToken = data.token;
  tokenExp    = data.exp;
  return cachedToken!;
}

async function fudoGet(path: string, params: Record<string, string> = {}) {
  const token = await getToken();
  const url   = new URL(`${FUDO_API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res   = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fudo API error ${res.status}: ${path} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Traer TODAS las páginas de un endpoint
async function fudoGetAll(path: string, extraParams: Record<string, string> = {}) {
  const pageSize = '500';
  let pageNumber = 1;
  const all: any[] = [];
  while (true) {
    const data = await fudoGet(path, { 'page[size]': pageSize, 'page[number]': String(pageNumber), ...extraParams });
    const items = Array.isArray(data) ? data : (data.data ?? data.items ?? data.sales ?? []);
    all.push(...items);
    if (items.length < parseInt(pageSize)) break;
    pageNumber++;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'products') {
      const items = await fudoGetAll('/items');
      return NextResponse.json({ items });
    }

    if (action === 'debug') {
      // Sin filtros — ver qué trae la API de sales cruda
      const token = await getToken();
      const res = await fetch(`${FUDO_API_BASE}/sales?page[size]=5`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await res.text();
      return NextResponse.json({ status: res.status, body: JSON.parse(body) });
    }

    if (action === 'sales') {
      const desde = req.nextUrl.searchParams.get('desde') ?? '';
      const hasta = req.nextUrl.searchParams.get('hasta') ?? '';
      // Traer sin filtros de fecha (Fudo no documenta bien los filtros)
      // y filtrar por fecha del lado del servidor
      const todas = await fudoGetAll('/sales', {});
      let sales = todas;
      if (desde || hasta) {
        sales = todas.filter((s: any) => {
          // Buscar el campo de fecha en el objeto — puede ser date, openedAt, createdAt, closedAt
          const fechaRaw = s.openedAt ?? s.closedAt ?? s.date ?? s.createdAt ?? s.created_at ?? '';
          if (!fechaRaw) return true;
          const fecha = fechaRaw.slice(0, 10); // YYYY-MM-DD
          if (desde && fecha < desde) return false;
          if (hasta && fecha > hasta) return false;
          return true;
        });
      }
      return NextResponse.json({ sales, total_raw: todas.length });
    }

    if (action === 'sale_detail') {
      // Detalle de una venta específica con sus items
      const id   = req.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
      const data = await fudoGet(`/sales/${id}`);
      return NextResponse.json({ sale: data });
    }

    return NextResponse.json({ error: 'action no reconocida' }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}