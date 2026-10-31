import { randomBytes } from 'node:crypto';
import { db } from './supabaseAdmin.js';
import { HttpError, assert } from './http.js';
import type { DbUser } from './auth.js';
import { todayBR } from './homeTeams.js';
import { opponentShare } from '../../shared/matchRules.js';
import { toRuleSlot, type SlotRow } from './slots.js';

/**
 * Agenda do time:
 * - link exclusivo (team_page) com os jogos em casa abertos e os horários em que o time quer jogar fora;
 * - disponibilidade para jogar fora (team_availability);
 * - convites recebidos de mandantes (away_invite).
 */

const sameName = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const hm = (t: unknown) => String(t || '').slice(0, 5);

export const findOwnTeam = (user: DbUser, teamName: unknown) => {
  const team = (user.teams || []).find(t => sameName(t.name, String(teamName || '')));
  if (!team) throw new HttpError(400, 'Time não encontrado no seu perfil.');
  return team;
};

const newToken = () => randomBytes(9).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Link exclusivo da agenda do time (cria na primeira vez). */
export const agendaLink = async (user: DbUser, teamName: unknown, origin: string) => {
  const team = findOwnTeam(user, teamName);
  const { data: existing } = await db().from('team_page').select('token, team_name').eq('user_id', user.id);
  let token = (existing || []).find(p => sameName(p.team_name, team.name))?.token as string | undefined;
  if (!token) {
    token = newToken();
    const { error } = await db().from('team_page').insert([{ token, user_id: user.id, team_name: team.name }]);
    if (error) throw error;
  }
  const url = `${origin}/?agenda=${token}`;
  const message =
    `⚽ Agenda do ${team.name} no Jogo Fácil!\nVeja nossos jogos em casa e os dias em que jogamos fora, e marque um jogo com a gente.\n` +
    `Criar conta é grátis (1ª categoria): ${url}`;
  return { token, url, message };
};

const fieldsById = async (ids: string[]) => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, any>();
  const { data } = await db().from('field').select('id, name, location, image_url').in('id', unique);
  return new Map((data || []).map(f => [f.id, f]));
};

/** Jogos em casa ainda abertos para adversário (para o link e para a agenda). */
const openHomeGames = async (userId: string, teamName: string) => {
  const { data, error } = await db()
    .from('match_slot')
    .select('*')
    .eq('home_team_user_id', userId)
    .eq('status', 'waiting_opponent')
    .gte('date', todayBR())
    .order('date')
    .order('time');
  if (error) throw error;
  const games = (data || []).filter((s: SlotRow) => sameName(s.local_team_name, teamName));
  const fields = await fieldsById(games.map(g => g.field_id));
  return games.map((s: SlotRow) => {
    const f = s.field_id ? fields.get(s.field_id) : null;
    return {
      slotId: s.id,
      date: s.date,
      time: hm(s.time),
      durationMinutes: s.duration_minutes || 60,
      category: s.local_team_category,
      allowedCategories: s.allowed_opponent_categories || [],
      sport: s.sport,
      matchType: s.match_type,
      opponentShare: opponentShare(toRuleSlot(s)),
      place: f ? { name: f.name, location: f.location, imageUrl: f.image_url } : { name: 'Local do mandante', location: s.custom_location || '' },
    };
  });
};

const availabilityRows = async (userId: string, teamName?: string) => {
  let q = db().from('team_availability').select('*').eq('user_id', userId).gte('date', todayBR()).order('date').order('start_time');
  const { data, error } = await q;
  if (error) throw error;
  return (data || [])
    .filter(a => !teamName || sameName(a.team_name, teamName))
    .map(a => ({ id: a.id, teamName: a.team_name, category: a.category, gender: a.gender, sport: a.sport, date: a.date, startTime: hm(a.start_time), endTime: hm(a.end_time), notes: a.notes }));
};

/** Página pública do link do time (não exige login). */
export const publicAgenda = async (token: string) => {
  if (!token || token.length > 64) throw new HttpError(404, 'Link inválido.');
  const { data: page } = await db().from('team_page').select('*').eq('token', token).maybeSingle();
  if (!page) throw new HttpError(404, 'Agenda não encontrada.');
  const { data: owner } = await db().from('user').select('id, name, teams').eq('id', page.user_id).maybeSingle();
  if (!owner) throw new HttpError(404, 'Agenda não encontrada.');
  const team = ((owner.teams || []) as any[]).find(t => sameName(t.name, page.team_name));
  if (!team) throw new HttpError(404, 'Este time não existe mais.');
  return {
    token,
    ownerUserId: owner.id,
    team: { name: team.name, logoUrl: team.logoUrl || null, categories: team.categories || [], gender: team.gender || null, sport: team.sport || 'Futebol' },
    homeGames: await openHomeGames(owner.id, team.name),
    awayAvailability: await availabilityRows(owner.id, team.name),
  };
};

/** Agenda do próprio time (logado): jogos em casa abertos, disponibilidade e convites. */
export const myAgenda = async (user: DbUser) => {
  const teams = user.teams || [];
  const homeGames: any[] = [];
  for (const t of teams) homeGames.push(...(await openHomeGames(user.id, t.name)).map(g => ({ ...g, teamName: t.name })));

  const { data: received } = await db()
    .from('away_invite')
    .select('*')
    .eq('to_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  const slotIds = (received || []).map(i => i.slot_id);
  const { data: slots } = slotIds.length > 0 ? await db().from('match_slot').select('*').in('id', slotIds) : { data: [] as any[] };
  const fields = await fieldsById((slots || []).map((s: any) => s.field_id));
  const invites = (received || [])
    .map(i => {
      const s = (slots || []).find((x: any) => x.id === i.slot_id) as SlotRow | undefined;
      if (!s || s.status !== 'waiting_opponent' || s.date < todayBR()) return null;
      const f = s.field_id ? fields.get(s.field_id) : null;
      return {
        inviteId: i.id,
        slotId: s.id,
        teamName: i.to_team_name,
        category: i.category,
        homeTeamName: s.local_team_name,
        date: s.date,
        time: hm(s.time),
        opponentShare: opponentShare(toRuleSlot(s)),
        place: f ? { name: f.name, location: f.location } : { name: 'Local do mandante', location: s.custom_location || '' },
      };
    })
    .filter(Boolean);

  return { homeGames, availability: await availabilityRows(user.id), invites };
};

export const addAvailability = async (user: DbUser, body: any) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time.');
  const team = findOwnTeam(user, body.teamName);
  const category = String(body.category || '').trim();
  assert((team.categories || []).includes(category), 400, `O ${team.name} não tem a categoria ${category || 'escolhida'}.`);
  const date = String(body.date || '');
  const start = hm(body.startTime);
  const end = hm(body.endTime) || start;
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayBR(), 400, 'Escolha uma data a partir de hoje.');
  assert(/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && end >= start, 400, 'Informe o horário (início e fim).');
  const { data, error } = await db().from('team_availability').insert([{
    user_id: user.id,
    team_name: team.name,
    category,
    gender: team.gender || null,
    sport: team.sport || 'Futebol',
    date,
    start_time: start,
    end_time: end,
    notes: body.notes ? String(body.notes).slice(0, 200) : null,
  }]).select('id').single();
  if (error) throw error;
  return { id: data.id, message: 'Disponibilidade salva! Os mandantes com jogo nesse horário podem te convidar.' };
};

export const removeAvailability = async (user: DbUser, id: unknown) => {
  const { error } = await db().from('team_availability').delete().eq('id', String(id || '')).eq('user_id', user.id);
  if (error) throw error;
  return { message: 'Disponibilidade removida.' };
};
