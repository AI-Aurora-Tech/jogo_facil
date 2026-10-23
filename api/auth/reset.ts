import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabaseAdmin.js';
import {
  hashResetCode, normalizeEmail, RESET_MAX_ATTEMPTS, sameHash, setUserPassword, validateNewPassword,
} from '../_lib/passwords.js';

/**
 * POST /api/auth/reset { email, code, newPassword } -> { message }
 *
 * Confere o código enviado por /api/auth/forgot e grava a nova senha.
 */

const INVALID = 'Código inválido ou expirado. Peça um novo código.';

export const POST = handle(async request => {
  const body = await readJson<{ email?: string; code?: string; newPassword?: string }>(request);
  const email = normalizeEmail(body.email);
  const code = String(body.code || '').replace(/\D/g, '');
  if (!email || code.length !== 6) throw new HttpError(400, 'Informe o e-mail e o código de 6 dígitos.');
  const newPassword = validateNewPassword(body.newPassword);

  const { data: user, error } = await db().from('user').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  if (!user) throw new HttpError(400, INVALID, 'INVALID_CODE');

  const { data: reset, error: resetError } = await db()
    .from('password_reset')
    .select('id, code_hash, expires_at, attempts')
    .eq('user_id', user.id)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resetError) throw resetError;
  if (!reset || new Date(reset.expires_at).getTime() < Date.now()) throw new HttpError(400, INVALID, 'INVALID_CODE');

  const attempts = Number(reset.attempts) || 0;
  if (attempts >= RESET_MAX_ATTEMPTS) {
    await db().from('password_reset').update({ used_at: new Date().toISOString() }).eq('id', reset.id);
    throw new HttpError(400, 'Muitas tentativas erradas. Peça um novo código.', 'INVALID_CODE');
  }

  // Reserva a tentativa antes de comparar: pedidos em paralelo não ganham tentativas extras
  const { data: claimed, error: claimError } = await db()
    .from('password_reset')
    .update({ attempts: attempts + 1 })
    .eq('id', reset.id)
    .eq('attempts', attempts)
    .is('used_at', null)
    .select('id');
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) throw new HttpError(409, 'Tente novamente.');

  if (!sameHash(hashResetCode(code), reset.code_hash)) {
    const left = RESET_MAX_ATTEMPTS - attempts - 1;
    throw new HttpError(
      400,
      left > 0 ? `Código incorreto. Você ainda tem ${left} tentativa(s).` : 'Muitas tentativas erradas. Peça um novo código.',
      'INVALID_CODE'
    );
  }

  // Marca como usado só se ninguém usou antes (uso único)
  const { data: used, error: useError } = await db()
    .from('password_reset')
    .update({ used_at: new Date().toISOString() })
    .eq('id', reset.id)
    .is('used_at', null)
    .select('id');
  if (useError) throw useError;
  if (!used || used.length === 0) throw new HttpError(400, INVALID, 'INVALID_CODE');

  await setUserPassword(user.id, newPassword);
  return json({ message: 'Senha alterada com sucesso! Faça login com a nova senha.' });
});
