import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4;
  const padded = pad ? str + '='.repeat(4 - pad) : str;
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function buildVapidJwt(endpoint: string): Promise<string> {
  const url      = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now      = Math.floor(Date.now() / 1000);

  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: now + 3600, sub: 'mailto:admin@kitchenos.com' };

  const enc = (obj: object) =>
    base64UrlEncode(toArrayBuffer(new TextEncoder().encode(JSON.stringify(obj))));

  const sigInput = `${enc(header)}.${enc(payload)}`;

  const privBytes = base64UrlDecode(process.env.VAPID_PRIVATE_KEY!);

  const sigKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(privBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    sigKey,
    toArrayBuffer(new TextEncoder().encode(sigInput))
  );

  return `${sigInput}.${base64UrlEncode(sig)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, tag, url: notifUrl } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: subs } = await supabase.from('push_subscriptions').select('*');

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No hay suscriptores' });
    }

    const pubKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
    const payload = JSON.stringify({
      title: title ?? 'KitchenOS',
      body:  body  ?? '',
      tag:   tag   ?? 'kitchenos',
      url:   notifUrl ?? '/',
    });

    let sent = 0, failed = 0;

    for (const sub of subs) {
      try {
        const jwt  = await buildVapidJwt(sub.endpoint);
        const auth = `vapid t=${jwt},k=${pubKey}`;

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/octet-stream',
            'Authorization': auth,
            'TTL':           '86400',
          },
          body: payload,
        });

        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          failed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}