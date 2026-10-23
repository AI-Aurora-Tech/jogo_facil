import { randomBytes } from 'node:crypto';
import { db } from './supabaseAdmin.js';
import { HttpError } from './http.js';

export interface InviteRow {
  id: string;
  token: string;
  slot_id: string;
  created_by: string | null;
  category: string | null;
  expires_at: string | null;
  opened_count: number | null;
  used_by: string | null;
  used_at: string | null;
}

export const newInviteToken = () =>
  randomBytes(12).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export const findValidInvite = async (token: string): Promise<InviteRow> => {
  if (!token || token.length > 64) throw new HttpError(404, 'Convite inválido.');
  const { data, error } = await db().from('match_invite').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Convite não encontrado.');
  const invite = data as InviteRow;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, 'Este convite expirou.');
  }
  return invite;
};

export const markInviteUsed = async (id: string, userId: string) => {
  await db().from('match_invite').update({ used_by: userId, used_at: new Date().toISOString() }).eq('id', id);
};
