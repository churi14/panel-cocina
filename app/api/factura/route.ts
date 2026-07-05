import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export interface FacturaItem {
  nombre: string;
  cantidad: number;
  unidad: 'kg' | 'u' | 'lt' | 'g';
  precio_unitario: number | null;
}

export interface FacturaData {
  proveedor: string | null;
  fecha: string | null;
  numero_factura: string | null;
  items: FacturaItem[];
}

const PROMPT = `Analizá esta factura de proveedor de un restaurante/dark kitchen.

Extraé la información en JSON con exactamente esta estructura:
{
  "proveedor": "nombre del proveedor",
  "fecha": "fecha en formato YYYY-MM-DD o null",
  "numero_factura": "número de factura o null",
  "items": [
    {
      "nombre": "nombre del producto, en español, sin código ni referencia",
      "cantidad": número decimal,
      "unidad": "kg|u|lt",
      "precio_unitario": número o null
    }
  ]
}

Reglas:
- Convertí gramos a kg (500g → 0.5, unidad "kg")
- Si dice "unidades", "piezas", "cajas", "docena" → unidad "u" (1 docena = 12u)
- Si dice "litros" → "lt"
- Ignorá subtotales, descuentos, IVA y filas de totales — solo los productos
- Si hay ambigüedad en el nombre, elegí el más descriptivo
- Respondé SOLO con el JSON sin ningún texto adicional`;

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData();
    const imageFile = form.get('imagen') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
    }

    const buf    = await imageFile.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    const isPdf  = imageFile.type === 'application/pdf';

    const fileBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const,    source: { type: 'base64' as const, media_type: (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } };

    const msg = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const raw  = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return NextResponse.json({ error: 'No se pudo leer la factura' }, { status: 500 });

    const data: FacturaData = JSON.parse(json);

    // Normalizar unidades
    data.items = data.items.map(item => ({
      ...item,
      unidad: (['kg','u','lt'].includes(item.unidad) ? item.unidad : 'u') as FacturaItem['unidad'],
    }));

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[factura]', e);
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 });
  }
}
