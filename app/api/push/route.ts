import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@kitchenos.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { title, body, tag, url: notifUrl, userId } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // userId = mandar solo a ese usuario. Sin userId = a todos.
    let query = supabase.from('push_subscriptions').select('*');
    if (userId) query = (query as any).eq('user_id', userId);

    const { data: subs, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0, message: 'No hay suscriptores' });

    const payload = JSON.stringify({
      title: title ?? 'La Cocina',
      body:  body  ?? '',
      tag:   tag   ?? 'kitchenos',
      url:   notifUrl ?? '/',
    });

    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        failed++;
      }
    }
    return NextResponse.json({ sent, failed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}