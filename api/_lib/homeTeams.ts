import { randomBytes } from 'node:crypto';
import { db } from './supabaseAdmin.js';
import { HttpError } from './http.js';
import type { DbUser } from './auth.js';

/**
 * Times do campo: mensalistas (dia/horário fixos) e times da casa.
 * Ficam em registered_team (kind = 'MENSALISTA' | 'LOCAL').
 */

export type HomeTeamKind = 'MENSALISTA' | 'LOCAL';

export interface HomeTeamRow {
  id: string;
  field_id: string;
  kind: HomeTeamKind;
  name: string | null;
  fixed_day: number | string | null;
  fixed_time: string | null;
  fixed_duration_minutes: number | null;
  categories: string[] | null;
  logo_url: string | null;
  gender: string | null;
  sport: string | null;
  court_name: string | null;
  status: string | null;
  captain_user_id: string | null;
  captain_name: string | null;
  captain_phone: string | null;
  [key: string]: any;
}

export interface TeamInviteRow {
  id: string;
  token: string;
  team_id: string;
  used_by: string | null;
  used_at: string | null;
}

export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const newTeamInviteToken = () =>
  randomBytes(12).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export const loadHomeTeam = async (id: string): Promise<HomeTeamRow> => {
  if (!id) throw new HttpError(400, 'Time não informado.');
  const { data, error } = await db().from('registered_team').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Time não encontrado.');
  return { ...data, kind: data.kind === 'LOCAL' ? 'LOCAL' : 'MENSALISTA' } as HomeTeamRow;
};

export const findTeamInvite = async (token: string): Promise<TeamInviteRow> => {
  if (!token || token.length > 64) throw new HttpError(404, 'Convite inválido.');
  const { data, error } = await db().from('team_invite').select('*').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Convite não encontrado.');
  return data as TeamInviteRow;
};

export const dayLabel = (day: number | string | null | undefined) => {
  const n = Number(day);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? WEEKDAYS[n] : '';
};

export const timeLabel = (t: string | null | undefined) => String(t || '').slice(0, 5);

const SPORTS = ['Futebol', 'Society', 'Vôlei', 'Beach Tennis', 'Tênis', 'Basquete', 'Handball'];
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
/** O cadastro de mensalista guarda o esporte em maiúsculas ("FUTEBOL"); os horários usam "Futebol". */
export const sportLabel = (sport: string | null | undefined) =>
  SPORTS.find(s => plain(s) === plain(String(sport || ''))) || String(sport || 'Futebol');

/** Data de hoje (YYYY-MM-DD) no horário de Brasília. */
export const todayBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const addDays = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const toMinutes = (t: string) => {
  const [h = '0', m = '0'] = String(t).split(':');
  return Number(h) * 60 + Number(m);
};

/** Próximas datas (YYYY-MM-DD) que caem no dia da semana informado, a partir de hoje. */
export const nextWeekdayDates = (weekday: number, count: number): string[] => {
  const today = todayBR();
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const first = addDays(today, (weekday - todayDow + 7) % 7);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
};

/**
 * Cria os jogos semanais do mensalista (padrão: 8 semanas), pulando datas em que a
 * quadra já tem horário no mesmo período. Retorna quantos foram criados.
 */
export const createMensalistaSlots = async (team: HomeTeamRow, captain: DbUser, category: string, weeks = 8): Promise<number> => {
  const weekday = Number(team.fixed_day);
  const time = timeLabel(team.fixed_time);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(time)) return 0;

  const duration = team.fixed_duration_minutes || 60;
  const dates = nextWeekdayDates(weekday, weeks);
  // Hoje só entra se o horário ainda não passou
  const nowBR = new Date(Date.now() - 3 * 3600_000);
  const nowMinutes = nowBR.getUTCHours() * 60 + nowBR.getUTCMinutes();
  const validDates = dates.filter(d => d !== todayBR() || toMinutes(time) > nowMinutes);
  if (validDates.length === 0) return 0;

  const { data: field } = await db().from('field').select('id, hourly_rate').eq('id', team.field_id).maybeSingle();
  const { data: existing, error } = await db()
    .from('match_slot')
    .select('id, date, time, duration_minutes, court_name, status, booked_by_user_id, has_local_team')
    .eq('field_id', team.field_id)
    .in('date', validDates);
  if (error) throw error;

  const start = toMinutes(time);
  const end = start + duration;
  const court = team.court_name || null;
  const free: string[] = [];
  // Horário livre que a arena já criou no mesmo dia/hora/quadra: vira o jogo do mensalista
  const reuse: string[] = [];
  for (const date of validDates) {
    const overlapping = (existing || []).filter(s => {
      if (s.date !== date) return false;
      if ((s.court_name || null) !== court) return false;
      const sStart = toMinutes(s.time);
      const sEnd = sStart + (s.duration_minutes || 60);
      return start < sEnd && sStart < end;
    });
    if (overlapping.length === 0) free.push(date);
    else if (
      overlapping.length === 1 &&
      overlapping[0].status === 'available' &&
      !overlapping[0].booked_by_user_id &&
      !overlapping[0].has_local_team &&
      toMinutes(overlapping[0].time) === start
    ) reuse.push(overlapping[0].id);
  }
  if (free.length === 0 && reuse.length === 0) return 0;

  const captainTeam = (captain.teams || []).find(t => (t.name || '').trim().toLowerCase() === (team.name || '').trim().toLowerCase());
  const gender = team.gender || captainTeam?.gender || 'MASCULINO';
  const homeFields = {
    is_booked: true,
    has_local_team: true,
    home_team_type: 'MENSALISTA',
    home_team_id: team.id,
    home_team_user_id: captain.id,
    local_team_name: team.name,
    local_team_category: category,
    local_team_phone: captain.phone_number,
    local_team_logo_url: team.logo_url || captainTeam?.logoUrl || null,
    local_team_gender: gender,
    allowed_opponent_categories: [category],
    allowed_opponent_genders: [gender],
    status: 'waiting_opponent',
  };

  if (reuse.length > 0) {
    const { error: upErr } = await db().from('match_slot').update(homeFields).in('id', reuse).eq('status', 'available');
    if (upErr) throw upErr;
  }
  const rows = free.map(date => ({
    ...homeFields,
    field_id: team.field_id,
    date,
    time,
    duration_minutes: duration,
    match_type: 'NORMAL',
    price: Number(field?.hourly_rate) || 0,
    sport: sportLabel(team.sport || captainTeam?.sport),
    court_name: court,
  }));
  if (rows.length > 0) {
    const { error: insErr } = await db().from('match_slot').insert(rows);
    if (insErr) throw insErr;
  }
  return rows.length + reuse.length;
};
