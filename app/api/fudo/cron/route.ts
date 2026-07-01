import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Fudo auth (duplicado de /api/fudo/route.ts — self-contained) ──────────────
const FUDO_AUTH_URL = 'https://auth.fu.do/api';
const FUDO_API_BASE = 'https://api.fu.do/v1alpha1';
const API_KEY       = process.env.FUDO_API_KEY!;
const API_SECRET    = process.env.FUDO_API_SECRET!;

let cachedToken: string | null = null;
let tokenExp: number = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() / 1000 < tokenExp - 60) return cachedToken;
  const res = await fetch(FUDO_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fudo API ${res.status}: ${path} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function fudoGetAll(path: string, params: Record<string, string> = {}, maxPages = 3) {
  let page = 1;
  const allData: any[] = [];
  const allIncluded: any[] = [];
  while (page <= maxPages) {
    const res      = await fudoFetch(path, { 'page[size]': '500', 'page[number]': String(page), ...params });
    const data     = Array.isArray(res) ? res : (res.data ?? []);
    const included = res.included ?? [];
    allData.push(...data);
    allIncluded.push(...included);
    if (data.length < 500) break;
    page++;
  }
  return { data: allData, included: allIncluded };
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type RecetaRow     = { producto_fudo: string; ingrediente: string; cantidad: number; unidad: string; tabla_origen: string; };
type StockDescuento = { producto: string; cantidad: number; unidad: string; tabla: string; };
type RecetasMap    = Record<string, StockDescuento[]>;

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function buscarEnMapa(nombre: string, mapa: RecetasMap): StockDescuento[] | null {
  const norm = normalizar(nombre);
  if (mapa[norm]) return mapa[norm];
  for (const [key, val] of Object.entries(mapa)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Verificar CRON_SECRET (Vercel lo manda automáticamente)
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Usar service role key para bypasear RLS en updates
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const startTime = Date.now();

  try {
    // ── 1. Cargar sale IDs ya procesados (últimas 48h) ─────────────────────
    const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: procesadas } = await supabase
      .from('fudo_ventas_procesadas')
      .select('sale_id')
      .gte('procesada_at', since48h);
    const procesadasSet = new Set((procesadas ?? []).map((p: any) => String(p.sale_id)));

    // ── 2. Cargar recetas_fudo ──────────────────────────────────────────────
    const { data: recetasData } = await supabase.from('recetas_fudo').select('*');
    const recetasMap: RecetasMap = {};
    for (const row of (recetasData ?? []) as RecetaRow[]) {
      const key = normalizar(row.producto_fudo);
      if (!recetasMap[key]) recetasMap[key] = [];
      recetasMap[key].push({
        producto: row.ingrediente,
        cantidad: Number(row.cantidad),
        unidad: row.unidad,
        tabla: row.tabla_origen,
      });
    }

    // ── 3. Traer productos + ventas en paralelo ─────────────────────────────
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [{ data: productsData }, { data: salesData, included }] = await Promise.all([
      fudoGetAll('/products'),
      fudoGetAll('/sales', { include: 'items', sort: '-createdAt' }, 2),
    ]);

    const productById: Record<string, string> = {};
    for (const p of productsData) {
      productById[p.id] = p.attributes?.name ?? `Producto #${p.id}`;
    }

    const itemsById: Record<string, { quantity: number; productId: string }> = {};
    for (const inc of included) {
      if (inc.type === 'Item') {
        itemsById[inc.id] = {
          quantity:  inc.attributes?.quantity ?? 1,
          productId: inc.relationships?.product?.data?.id ?? '',
        };
      }
    }

    // ── 4. Filtrar ventas de hoy/ayer que no fueron procesadas ─────────────
    const salesRecientes = salesData.filter((s: any) => {
      const fecha = (s.attributes?.createdAt ?? s.attributes?.openedAt ?? '').slice(0, 10);
      return fecha === today || fecha === yesterday;
    });

    const nuevasVentas = salesRecientes.filter((s: any) => !procesadasSet.has(String(s.id)));

    if (nuevasVentas.length === 0) {
      await supabase.from('fudo_sync_log').insert({
        desde: yesterday, hasta: today, ventas: 0, descuentos: [], tipo: 'auto',
      });
      return NextResponse.json({
        ok: true,
        message: 'Sin ventas nuevas para procesar',
        revisadas: salesRecientes.length,
        ya_procesadas: procesadasSet.size,
        ms: Date.now() - startTime,
      });
    }

    // ── 5. Agregar descuentos ───────────────────────────────────────────────
    const descuentoMap: Record<string, { total: number; unidad: string; tabla: string }> = {};
    let itemsReconocidos = 0;

    for (const sale of nuevasVentas) {
      const itemRefs: any[] = sale.relationships?.items?.data ?? [];
      for (const ref of itemRefs) {
        const item = itemsById[ref.id];
        if (!item) continue;
        const nombre = productById[item.productId] ?? '';
        const qty    = item.quantity ?? 1;
        const descuentos = buscarEnMapa(nombre, recetasMap);
        if (descuentos) {
          itemsReconocidos++;
          for (const d of descuentos) {
            const key = `${d.tabla}::${d.producto}`;
            if (!descuentoMap[key]) descuentoMap[key] = { total: 0, unidad: d.unidad, tabla: d.tabla };
            descuentoMap[key].total += d.cantidad * qty;
          }
        }
      }
    }

    const descuentosArray = Object.entries(descuentoMap).map(([key, v]) => ({
      producto: key.split('::')[1],
      total:    parseFloat(v.total.toFixed(3)),
      unidad:   v.unidad,
      tabla:    v.tabla,
    }));

    // ── 6. Aplicar descuentos al stock ─────────────────────────────────────
    const motivo = `Auto-sync Fudo ${today}`;
    const debug: { producto: string; tabla: string; encontrado: boolean; error?: string }[] = [];
    for (const d of descuentosArray) {
      if (d.tabla === 'stock_produccion') {
        const { data: sp, error: spErr } = await supabase
          .from('stock_produccion').select('id, cantidad').ilike('producto', d.producto).maybeSingle();
        debug.push({ producto: d.producto, tabla: 'stock_produccion', encontrado: !!sp, error: spErr?.message });
        if (sp) {
          await supabase.from('stock_produccion').update({
            cantidad:    parseFloat((Number(sp.cantidad) - d.total).toFixed(3)),
            ultima_prod: new Date().toISOString(),
          }).eq('id', sp.id);
          await supabase.from('stock_movements').insert({
            nombre: d.producto, categoria: 'FUDO', tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
            motivo, operador: 'Fudo Cron', fecha: new Date().toISOString(),
          });
        }
      } else if (d.tabla === 'stock') {
        const { data: sm, error: smErr } = await supabase
          .from('stock').select('id, cantidad').ilike('nombre', d.producto).maybeSingle();
        debug.push({ producto: d.producto, tabla: 'stock', encontrado: !!sm, error: smErr?.message });
        if (sm) {
          await supabase.from('stock').update({
            cantidad: parseFloat((Number(sm.cantidad) - d.total).toFixed(3)),
          }).eq('id', sm.id);
          await supabase.from('stock_movements').insert({
            nombre: d.producto, categoria: 'FUDO', tipo: 'egreso', cantidad: d.total, unidad: d.unidad,
            motivo, operador: 'Fudo Cron', fecha: new Date().toISOString(),
          });
        }
      }
    }

    // ── 7. Marcar ventas como procesadas ───────────────────────────────────
    await supabase.from('fudo_ventas_procesadas').upsert(
      nuevasVentas.map((s: any) => ({ sale_id: String(s.id) })),
      { onConflict: 'sale_id' }
    );

    // ── 8. Loguear la sync ─────────────────────────────────────────────────
    await supabase.from('fudo_sync_log').insert({
      desde:      yesterday,
      hasta:      today,
      ventas:     nuevasVentas.length,
      descuentos: descuentosArray,
      tipo:       'auto',
    });

    return NextResponse.json({
      ok:               true,
      nuevas_ventas:    nuevasVentas.length,
      items_reconocidos: itemsReconocidos,
      descuentos:       descuentosArray.length,
      debug,
      ms:               Date.now() - startTime,
    });

  } catch (e: any) {
    console.error('[fudo/cron]', e.message);
    return NextResponse.json({ error: e.message, ms: Date.now() - startTime }, { status: 500 });
  }
}
