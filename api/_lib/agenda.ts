import { randomBytes } from 'node:crypto';
import { db } from './supabaseAdmin.js';
import { HttpError, assert } from './http.js';
import { requireTeamAccess, type DbUser } from './auth.js';
import { hasTeamAccess } from '../../shared/pricing.js';
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
    `Os primeiros 30 dias são grátis: ${url}`;
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
  requireTeamAccess(user);
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

/**
 * Times disponíveis para marcar jogo (aba "Times"): quem tem jogo em casa aberto ou
 * dias em que quer jogar fora. Cada time vem com o link da agenda (para o botão "Jogar")
 * e uma posição para o filtro de distância:
 * - a localização marcada pelo dono do time; ou
 * - a arena do próximo jogo em casa.
 */
export const teamsDirectory = async (viewerId: string) => {
  const today = todayBR();
  const [{ data: games, error: gErr }, { data: avail, error: aErr }] = await Promise.all([
    db()
      .from('match_slot')
      .select('id, field_id, date, time, local_team_name, local_team_category, allowed_opponent_categories, home_team_user_id, custom_location')
      .eq('status', 'waiting_opponent')
      .eq('has_local_team', true)
      .not('home_team_user_id', 'is', null)
      .gte('date', today)
      .order('date')
      .order('time'),
    db().from('team_availability').select('user_id, team_name, category, date').gte('date', today).order('date'),
  ]);
  if (gErr) throw gErr;
  if (aErr) throw aErr;

  type Entry = {
    userId: string;
    teamName: string;
    homeGames: number;
    awayDays: number;
    homeCategories: Set<string>;
    awayCategories: Set<string>;
    nextDate: string | null;
    arenaId: string | null;
  };
  const byTeam = new Map<string, Entry>();
  const keyOf = (userId: string, name: string) => `${userId}::${(name || '').trim().toLowerCase()}`;
  const entry = (userId: string, name: string) => {
    const k = keyOf(userId, name);
    let e = byTeam.get(k);
    if (!e) {
      e = { userId, teamName: name, homeGames: 0, awayDays: 0, homeCategories: new Set(), awayCategories: new Set(), nextDate: null, arenaId: null };
      byTeam.set(k, e);
    }
    return e;
  };

  for (const g of games || []) {
    if (!g.home_team_user_id || g.home_team_user_id === viewerId || !g.local_team_name) continue;
    const e = entry(g.home_team_user_id, g.local_team_name);
    e.homeGames += 1;
    for (const c of g.allowed_opponent_categories?.length ? g.allowed_opponent_categories : [g.local_team_category]) if (c) e.homeCategories.add(c);
    if (!e.nextDate || g.date < e.nextDate) e.nextDate = g.date;
    if (!e.arenaId && g.field_id) e.arenaId = g.field_id;
  }
  for (const a of avail || []) {
    if (a.user_id === viewerId) continue;
    const e = entry(a.user_id, a.team_name);
    e.awayDays += 1;
    e.awayCategories.add(a.category);
    if (!e.nextDate || a.date < e.nextDate) e.nextDate = a.date;
  }
  const entries = Array.from(byTeam.values());
  if (entries.length === 0) return { teams: [] };

  const userIds = Array.from(new Set(entries.map(e => e.userId)));
  const arenaIds = Array.from(new Set(entries.map(e => e.arenaId).filter(Boolean))) as string[];
  const [{ data: owners }, { data: arenas }, { data: pages }] = await Promise.all([
    db().from('user').select('id, role, teams, latitude, longitude, trial_ends_at, billing_status').in('id', userIds),
    arenaIds.length ? db().from('field').select('id, name, latitude, longitude').in('id', arenaIds) : Promise.resolve({ data: [] as any[] }),
    db().from('team_page').select('token, user_id, team_name').in('user_id', userIds),
  ]);
  const ownerById = new Map((owners || []).map(o => [o.id, o]));
  const arenaById = new Map((arenas || []).map((f: any) => [f.id, f]));
  const pageKey = (userId: string, name: string) => `${userId}::${(name || '').trim().toLowerCase()}`;
  const tokenByTeam = new Map((pages || []).map(p => [pageKey(p.user_id, p.team_name), p.token as string]));

  // Só times com o teste grátis ou a mensalidade em dia (os outros não conseguem confirmar o jogo)
  const listed = entries.flatMap(e => {
    const owner = ownerById.get(e.userId);
    if (!owner || !hasTeamAccess({ role: owner.role, trialEndsAt: owner.trial_ends_at, billingStatus: owner.billing_status })) return [];
    const team = ((owner.teams || []) as any[]).find(t => sameName(t.name, e.teamName));
    return team ? [{ e, owner, team }] : []; // time removido do perfil fica de fora
  });

  // Link da agenda: cria de uma vez os que ainda não existem
  const missing = listed.filter(x => !tokenByTeam.has(pageKey(x.e.userId, x.team.name)));
  if (missing.length) {
    const rows = missing.map(x => ({ token: newToken(), user_id: x.e.userId, team_name: x.team.name }));
    const { error } = await db().from('team_page').insert(rows);
    if (error) console.warn('[teams] falha ao criar links da agenda (outra busca pode ter criado antes)', error);
    const { data: again } = await db().from('team_page').select('token, user_id, team_name').in('user_id', Array.from(new Set(missing.map(x => x.e.userId))));
    for (const p of again || []) tokenByTeam.set(pageKey(p.user_id, p.team_name), p.token);
  }

  // Posição aproximada (~1 km): serve para a distância sem expor o endereço do time
  const approx = (n: number) => Math.round(n * 100) / 100;
  const teams = [];
  for (const { e, owner, team } of listed) {
    const token = tokenByTeam.get(pageKey(e.userId, team.name));
    if (!token) continue;
    const arena = e.arenaId ? arenaById.get(e.arenaId) : null;
    const ownLat = Number(owner.latitude);
    const ownLng = Number(owner.longitude);
    const location = Number.isFinite(ownLat) && Number.isFinite(ownLng) && Math.abs(ownLat) > 0.0001
      ? { lat: approx(ownLat), lng: approx(ownLng), source: 'team' as const, label: null }
      : arena && Math.abs(Number(arena.latitude)) > 0.0001
        ? { lat: Number(arena.latitude), lng: Number(arena.longitude), source: 'arena' as const, label: arena.name as string }
        : null;

    teams.push({
      token,
      teamName: team.name,
      logoUrl: team.logoUrl || null,
      gender: team.gender || null,
      categories: team.categories || [],
      homeGames: e.homeGames,
      awayDays: e.awayDays,
      homeCategories: Array.from(e.homeCategories),
      awayCategories: Array.from(e.awayCategories),
      nextDate: e.nextDate,
      location,
    });
  }
  teams.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
  return { teams };
};
