import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env, requireEnv } from './env.js';
import { db } from './supabaseAdmin.js';
import { HttpError } from './http.js';

/** Validade do código de recuperação. */
export const RESET_CODE_MINUTES = 15;
/** Tentativas de digitar o código antes de ele ser invalidado. */
export const RESET_MAX_ATTEMPTS = 5;

export const normalizeEmail = (email: unknown) => String(email || '').toLowerCase().trim();

/** Código de 6 dígitos. */
export const generateResetCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Hash do código com HMAC (chave = SESSION_SECRET). Um SHA-256 puro de 6 dígitos
 * seria revertido em segundos por quem lesse a tabela.
 */
export const hashResetCode = (code: string) =>
  createHmac('sha256', requireEnv('SESSION_SECRET', env.sessionSecret())).update(`password-reset:${code}`).digest('hex');

export const sameHash = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const validateNewPassword = (password: unknown): string => {
  const p = typeof password === 'string' ? password : '';
  if (p.trim().length < 6) throw new HttpError(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  if (p.length > 72) throw new HttpError(400, 'A nova senha pode ter no máximo 72 caracteres.');
  // O trigger hash_user_password não refaz o hash de valores que já parecem bcrypt
  if (p.startsWith('$2')) throw new HttpError(400, 'A nova senha não pode começar com "$2".');
  return p;
};

/** Grava a nova senha. O trigger hash_user_password faz o hash no banco. */
export const setUserPassword = async (userId: string, password: string): Promise<void> => {
  const { error } = await db().from('user').update({ password }).eq('id', userId);
  if (error) throw error;
  // Códigos de recuperação pendentes deixam de valer depois de qualquer troca de senha
  await db().from('password_reset').update({ used_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null);
};

/** Confere a senha atual usando a mesma função do login (compara com o hash no banco). */
export const checkPassword = async (email: string, password: string): Promise<boolean> => {
  if (!password) return false;
  const { data, error } = await db().rpc('login_user', { p_email: normalizeEmail(email), p_password: password });
  if (error) return false;
  return Array.isArray(data) ? data.length > 0 : !!data;
};
