import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const { email, password, nombre, rol, local } = await req.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Usar upsert para cubrir el caso en que el trigger ya creó el perfil vacío
    const { error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .upsert(
        { id: data.user.id, nombre, rol, local: local ?? null, activo: true },
        { onConflict: 'id' }
      );
    if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}