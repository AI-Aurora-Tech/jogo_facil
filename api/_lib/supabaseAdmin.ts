import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, requireEnv } from './env.js';

let client: SupabaseClient | null = null;

/** Cliente com service role: ignora RLS. Usar SOMENTE no servidor. */
export const db = (): SupabaseClient => {
  if (!client) {
    client = createClient(
      requireEnv('SUPABASE_URL', env.supabaseUrl()),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY', env.supabaseServiceKey()),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
};

export const notify = async (
  userId: string | null | undefined,
  title: string,
  description: string,
  type: 'success' | 'warning' | 'info' = 'info'
): Promise<void> => {
  if (!userId) return;
  const { error } = await db().from('notification').insert([{ user_id: userId, title, description, type, read: false }]);
  if (error) console.error('[notify] falhou', error.message);
};
