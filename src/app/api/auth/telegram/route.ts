import { NextResponse } from 'next/server';
import { verifyTelegramHash, checkGroupMembership, sendWelcomeMessage } from '@/lib/telegram';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const userData = await req.json();

    // 1. Verify Hash
    const isValid = verifyTelegramHash(userData);
    if (!isValid) {
      return NextResponse.json({ error: 'Firma de datos inválida' }, { status: 401 });
    }

    // 2. Check Group Membership
    const isMember = await checkGroupMembership(userData.id);
    if (!isMember) {
      return NextResponse.json({ 
        error: 'Acceso denegado: Debes unirte al grupo @Cine_3Estrellas para acceder a la aplicación.' 
      }, { status: 403 });
    }

    // 3. Sync with Supabase (public.users)
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userData.id, // bigint id matches telegram id
        first_name: userData.first_name,
        last_name: userData.last_name || null,
        username: userData.username || null,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      // We continue even if DB sync fails, but ideally it shouldn't
    }

    // 4. Send Welcome Message
    // This is asynchronous, we don't need to wait for it to finish to return the response
    sendWelcomeMessage(userData.id, userData.first_name).catch(console.error);

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
