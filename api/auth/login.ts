import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { createSessionToken } from '../_lib/auth.js';
import { db } from '../_lib/supabaseAdmin.js';

/** POST /api/auth/login { email, password } -> { user, token } */
export const POST = handle(async request => {
  const { email, password } = await readJson<{ email?: string; password?: string }>(request);
  if (!email || !password) throw new HttpError(400, 'Informe e-mail e senha.');

  const { data, error } = await db().rpc('login_user', { p_email: email.toLowerCase().trim(), p_password: password });
  const user = Array.isArray(data) ? data[0] : data;
  if (error || !user) throw new HttpError(401, 'E-mail ou senha incorretos.');

  const { data: extra } = await db()
    .from('user')
    .select('billing_status, billed_categories, billing_value, cpf_cnpj')
    .eq('id', user.id)
    .maybeSingle();

  return json({ user: { ...user, ...(extra || {}) }, token: createSessionToken(user.id) });
});
