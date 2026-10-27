import { db } from './supabaseAdmin.js';
import { HttpError } from './http.js';
import type { DbUser } from './auth.js';
import { ACTIVE_MATCH_STATUSES, overlaps, type SlotLike } from '../../shared/matchRules.js';

export interface SlotRow {
  id: string;
  field_id: string;
  date: string;
  time: string;
  duration_minutes: number | null;
  match_type: string | null;
  status: string;
  price: number | null;
  has_local_team: boolean | null;
  home_team_type: string | null;
  local_team_name: string | null;
  local_team_category: string | null;
  local_team_gender: string | null;
  booked_by_user_id: string | null;
  booked_by_team_name: string | null;
  booked_by_category: string | null;
  home_team_user_id: string | null;
  opponent_user_id: string | null;
  opponent_team_name: string | null;
  opponent_team_category: string | null;
  allowed_opponent_categories: string[] | null;
  allowed_opponent_genders: string[] | null;
  first_team_paid: boolean | null;
  opponent_paid: boolean | null;
  [key: string]: any;
}

export interface FieldRow {
  id: string;
  owner_id: string;
  name: string;
  location: string | null;
  asaas_wallet_id: string | null;
  payout_status: string | null;
  [key: string]: any;
}

export const toRuleSlot = (s: SlotRow): SlotLike => ({
  status: s.status,
  price: s.price,
  matchType: s.match_type,
  homeTeamType: s.home_team_type,
  hasLocalTeam: s.has_local_team,
  date: s.date,
  time: s.time,
  durationMinutes: s.duration_minutes,
  bookedByUserId: s.booked_by_user_id,
  homeTeamUserId: s.home_team_user_id,
  opponentUserId: s.opponent_user_id,
});

export const loadSlot = async (id: string): Promise<SlotRow> => {
  if (!id) throw new HttpError(400, 'Partida não informada.');
  const { data, error } = await db().from('match_slot').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Partida não encontrada.');
  return data as SlotRow;
};

export const loadField = async (id: string): Promise<FieldRow> => {
  const { data, error } = await db().from('field').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Campo não encontrado.');
  return data as FieldRow;
};

/**
 * Atualiza a partida somente se ela ainda estiver no status esperado.
 * Evita que duas pessoas façam a mesma ação ao mesmo tempo (ex.: dois adversários).
 */
export const updateSlotIfStatus = async (id: string, expected: string | string[], patch: Record<string, unknown>): Promise<SlotRow> => {
  const statuses = Array.isArray(expected) ? expected : [expected];
  const { data, error } = await db().from('match_slot').update(patch).eq('id', id).in('status', statuses).select('*');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new HttpError(409, 'Esta partida acabou de ser atualizada por outra pessoa. Atualize a tela e tente de novo.', 'STALE');
  }
  return data[0] as SlotRow;
};

export const dateBR = (s: Pick<SlotRow, 'date' | 'time'>) =>
  `${s.date.split('-').reverse().slice(0, 2).join('/')} às ${String(s.time).slice(0, 5)}`;

/** Nome do "time 1" (mensalista/time da casa ou primeiro time de fora). */
export const firstTeamName = (s: SlotRow) => (s.has_local_team ? s.local_team_name : s.booked_by_team_name) || 'Time 1';
export const firstTeamCategory = (s: SlotRow) => (s.has_local_team ? s.local_team_category : s.booked_by_category) || null;

export const findUserTeam = (user: DbUser, teamName: string, category: string) => {
  const team = (user.teams || []).find(t => (t.name || '').trim().toLowerCase() === (teamName || '').trim().toLowerCase());
  if (!team) throw new HttpError(400, 'Time não encontrado no seu perfil.');
  if (!(team.categories || []).includes(category)) {
    throw new HttpError(400, `O time ${team.name} não tem a categoria ${category}. Adicione a categoria no seu perfil.`, 'MISSING_CATEGORY');
  }
  return team;
};

/**
 * Regra: um time não pode marcar dois jogos da MESMA categoria no mesmo horário
 * (vale para jogos em casa, como mensalista/time da casa, e fora).
 */
export const assertNoCategoryConflict = async (userId: string, teamName: string, category: string, target: SlotRow) => {
  const { data, error } = await db()
    .from('match_slot')
    .select('*')
    .eq('date', target.date)
    .in('status', ACTIVE_MATCH_STATUSES)
    .or(`booked_by_user_id.eq.${userId},opponent_user_id.eq.${userId},home_team_user_id.eq.${userId}`);
  if (error) throw error;

  const team = teamName.trim().toLowerCase();
  const cat = category.trim().toLowerCase();
  const same = (name?: string | null, c?: string | null) =>
    (name || '').trim().toLowerCase() === team && (c || '').trim().toLowerCase() === cat;

  const conflict = (data as SlotRow[]).find(s => {
    if (s.id === target.id) return false;
    const mine =
      (s.booked_by_user_id === userId && same(s.booked_by_team_name, s.booked_by_category)) ||
      (s.opponent_user_id === userId && same(s.opponent_team_name, s.opponent_team_category)) ||
      (s.home_team_user_id === userId && s.has_local_team && same(s.local_team_name, s.local_team_category));
    return mine && overlaps(toRuleSlot(s), toRuleSlot(target));
  });

  if (conflict) {
    throw new HttpError(
      409,
      `O ${teamName} (${category}) já tem jogo em ${dateBR(conflict)}. Escolha outro horário ou outra categoria.`,
      'CATEGORY_CONFLICT'
    );
  }
};

/** Campos do adversário zerados (quando ele sai ou é recusado). */
export const CLEAR_OPPONENT = {
  opponent_user_id: null,
  opponent_team_name: null,
  opponent_team_category: null,
  opponent_team_phone: null,
  opponent_team_logo_url: null,
  opponent_team_gender: null,
  opponent_applied_at: null,
  team_approved_at: null,
  paid_at: null,
  first_team_paid: false,
  opponent_paid: false,
  receipt_url: null,
  receipt_uploaded_at: null,
};

/** Campos do primeiro time de fora zerados (horário volta a ficar livre). */
export const CLEAR_FIRST_TEAM = {
  booked_by_user_id: null,
  booked_by_team_name: null,
  booked_by_category: null,
  booked_by_team_logo_url: null,
  booked_by_user_phone: null,
  booked_by_team_gender: null,
  allowed_opponent_categories: [],
  is_booked: false,
  home_team_type: 'OUTSIDE',
};

/** Campos do mandante (time da casa/mensalista) zerados (horário volta a ficar livre). */
export const CLEAR_HOME_TEAM = {
  has_local_team: false,
  home_team_id: null,
  home_team_user_id: null,
  local_team_name: null,
  local_team_category: null,
  local_team_phone: null,
  local_team_logo_url: null,
  local_team_gender: null,
  allowed_opponent_genders: [],
};
