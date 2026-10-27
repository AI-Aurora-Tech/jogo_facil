import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, requireEnv } from './env.js';
import { db } from './supabaseAdmin.js';
import { HttpError } from './http.js';

/**
 * Sessão simples assinada com HMAC (o app usa login próprio, não o Supabase Auth).
 * O token vai no header "Authorization: Bearer <token>".
 */

const SESSION_DAYS = 30;

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

const fromB64url = (input: string) => Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sign = (data: string) =>
  b64url(createHmac('sha256', requireEnv('SESSION_SECRET', env.sessionSecret())).update(data).digest());

export const createSessionToken = (userId: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + SESSION_DAYS * 86400 }));
  return `${payload}.${sign(payload)}`;
};

const verifySessionToken = (token: string): string | null => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(fromB64url(payload).toString('utf8'));
    if (!data.sub || typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return String(data.sub);
  } catch {
    return null;
  }
};

export const USER_COLUMNS =
  'id, email, name, phone_number, role, teams, latitude, longitude, team_rating, team_rating_count, created_at';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  phone_number: string | null;
  role: string;
  teams: { name: string; categories: string[]; logoUrl?: string; gender?: string; sport?: string }[] | null;
  [key: string]: any;
}

export const isAdmin = (u: Pick<DbUser, 'role'>) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN';

export const loadUser = async (id: string): Promise<DbUser | null> => {
  const { data, error } = await db().from('user').select(USER_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as DbUser) || null;
};

export interface Session {
  /** Quem está logado. */
  actor: DbUser;
  /** Em nome de quem a ação é feita (o admin geral pode agir como outro usuário). */
  user: DbUser;
  /** true quando o admin está agindo em nome de outra conta. */
  impersonating: boolean;
}

export const requireSession = async (request: Request, actAsUserId?: string | null): Promise<Session> => {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) throw new HttpError(401, 'Sessão expirada. Faça login novamente.', 'SESSION_EXPIRED');

  const actor = await loadUser(userId);
  if (!actor) throw new HttpError(401, 'Usuário não encontrado. Faça login novamente.', 'SESSION_EXPIRED');

  if (actAsUserId && actAsUserId !== actor.id) {
    if (!isAdmin(actor)) throw new HttpError(403, 'Sem permissão para agir em nome de outra conta.');
    const target = await loadUser(actAsUserId);
    if (!target) throw new HttpError(404, 'Conta não encontrada.');
    return { actor, user: target, impersonating: true };
  }
  return { actor, user: actor, impersonating: false };
};
