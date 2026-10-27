import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { createSessionToken } from '../_lib/auth.js';
import { env, requireEnv } from '../_lib/env.js';
import { db } from '../_lib/supabaseAdmin.js';

/** POST /api/auth/login { email, password } -> { user, token } */
export const POST = handle(async request => {
  const { email, password } = await readJson<{ email?: string; password?: string }>(request);
  if (!email || !password) throw new HttpError(400, 'Informe e-mail e senha.');

  // Falha cedo e com mensagem clara se a sessão não puder ser criada
  requireEnv('SESSION_SECRET', env.sessionSecret());

  const { data, error } = await db().rpc('login_user', { p_email: email.toLowerCase().trim(), p_password: password });
  const user = Array.isArray(data) ? data[0] : data;
  if (error) {
    // Ex.: SUPABASE_SERVICE_ROLE_KEY errada ("Invalid API key") ou migração não rodada
    console.error('[login] erro no banco', error.message);
    throw new HttpError(500, `Servidor não conseguiu acessar o banco: ${error.message}. Veja /api/health.`, 'DB_ERROR');
  }
  if (!user) throw new HttpError(401, 'E-mail ou senha incorretos.');

  return json({ user, token: createSessionToken(user.id) });
});
