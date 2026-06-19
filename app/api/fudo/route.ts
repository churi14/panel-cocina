import { NextRequest, NextResponse } from 'next/server';

const FUDO_AUTH_URL  = 'https://auth.fu.do/api';
const FUDO_API_BASE  = 'https://api.fu.do/v1alpha1';
const API_KEY        = process.env.FUDO_API_KEY!;
const API_SECRET     = process.env.FUDO_API_SECRET!;

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

async function fudoFetch(path: string, params: Record<string, string> = {}) {
  const token = await getToken();
  const url   = new URL(`${FUDO_API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res   = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fudo API error ${res.status}: ${path} — ${body.slice(0, 400)}`);
  }
  return res.json();
}

// Paginar y traer todo — maneja formato JSON:API {data: [...], included: [...]}
async function fudoGetAll(path: string, params: Record<string, string> = {}) {
  let pageNumber = 1;
  const allData: any[]     = [];
  const allIncluded: any[] = [];
  while (true) {
    const res  = await fudoFetch(path, { 'page[size]': '500', 'page[number]': String(pageNumber), ...params });
    const data     = Array.isArray(res) ? res : (res.data ?? []);
    const included = res.included ?? [];
    allData.push(...data);
    allIncluded.push(...included);
    if (data.length < 500) break;
    pageNumber++;
  }
  return { data: allData, included: allIncluded };
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    // ── DEBUG: ver estructura cruda ──────────────────────────────────────────
    if (action === 'debug') {
      const token = await getToken();
      const res   = await fetch(`${FUDO_API_BASE}/sales?page[size]=2&include=items,subitems`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await res.json();
      return NextResponse.json({ status: res.status, body });
    }

    // ── DEBUG: ver modificadores de producto (ej: elegir carne/pollo) ────────
    if (action === 'modifiers') {
      const token = await getToken();
      const res = await fetch(`${FUDO_API_BASE}/productModifiersGroups?page[size]=100&include=productModifiers`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await res.json();
      // También traer una venta reciente con subitems para ver si los modificadores aparecen ahí
      const salesRes = await fetch(`${FUDO_API_BASE}/sales?page[size]=10&include=items,subitems`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const salesBody = await salesRes.json();
      return NextResponse.json({ status: res.status, modifierGroups: body, sampleSales: salesBody });
    }

    // ── RECETAS: productos con sus ingredientes ───────────────────────────────
    if (action === 'recipes') {
      const token = await getToken();
      // Traer productos con ingredientes incluidos
      const res = await fetch(`${FUDO_API_BASE}/products?page[size]=500&include=ingredients`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await res.json();
      // Si no soporta include, traer ingredients por separado
      const ingredients_res = await fetch(`${FUDO_API_BASE}/ingredients?page[size]=500`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const ingredients_body = await ingredients_res.json();
      return NextResponse.json({
        products: body,
        ingredients: ingredients_body,
      });
    }

    // ── LISTAR PRODUCTOS del catálogo ────────────────────────────────────────
    if (action === 'products') {
      const { data } = await fudoGetAll('/products');
      return NextResponse.json({ products: data });
    }

    // ── VENTAS con items y nombres de producto ───────────────────────────────
    if (action === 'sales') {
      const desde = req.nextUrl.searchParams.get('desde') ?? '';
      const hasta = req.nextUrl.searchParams.get('hasta') ?? '';

      // 1. Traer catálogo de productos para mapear id → nombre
      const { data: productsData } = await fudoGetAll('/products');
      const productById: Record<string, string> = {};
      for (const p of productsData) {
        productById[p.id] = p.attributes?.name ?? p.attributes?.nombre ?? `Producto #${p.id}`;
      }

      // 2. Traer ventas con items incluidos
      const { data: salesData, included } = await fudoGetAll('/sales', { include: 'items' });

      // 3. Crear mapa de items incluidos: itemId → { quantity, productId }
      const itemsById: Record<string, { quantity: number; productId: string }> = {};
      for (const inc of included) {
        if (inc.type === 'Item') {
          itemsById[inc.id] = {
            quantity:  inc.attributes?.quantity ?? 1,
            productId: inc.relationships?.product?.data?.id ?? '',
          };
        }
      }

      // 4. Filtrar por fecha (closedAt) y armar la respuesta
      const sales = salesData
        .filter((s: any) => {
          const fecha = (s.attributes?.closedAt ?? s.attributes?.createdAt ?? '').slice(0, 10);
          if (desde && fecha < desde) return false;
          if (hasta && fecha > hasta) return false;
          return true;
        })
        .map((s: any) => {
          const itemRefs: any[] = s.relationships?.items?.data ?? [];
          const items = itemRefs
            .map((ref: any) => {
              const item      = itemsById[ref.id];
              const productId = item?.productId ?? '';
              return {
                id:        ref.id,
                name:      productById[productId] ?? `Producto #${productId}`,
                productId,
                quantity:  item?.quantity ?? 1,
              };
            })
            .filter((i: any) => i.quantity > 0);
          return {
            id:       s.id,
            fecha:    s.attributes?.closedAt ?? s.attributes?.createdAt ?? '',
            total:    s.attributes?.total ?? 0,
            saleType: s.attributes?.saleType ?? '',
            items,
          };
        });

      return NextResponse.json({ sales, total_raw: salesData.length });
    }

    return NextResponse.json({ error: 'action no reconocida' }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}