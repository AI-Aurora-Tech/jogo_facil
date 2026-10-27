import { handle, json, readJson, assert, HttpError } from './_lib/http.js';
import { requireSession, isAdmin, type DbUser } from './_lib/auth.js';
import { db, notify } from './_lib/supabaseAdmin.js';
import { loadField, CLEAR_HOME_TEAM } from './_lib/slots.js';
import { env } from './_lib/env.js';
import {
  createMensalistaSlots,
  dayLabel,
  findTeamInvite,
  loadHomeTeam,
  newTeamInviteToken,
  sportLabel,
  timeLabel,
  todayBR,
  type HomeTeamRow,
} from './_lib/homeTeams.js';

/**
 * Convites dos times do campo (mensalista e time da casa).
 *
 * POST /api/teams { action: 'invite', teamId }            -> link para o dono do campo enviar
 * GET  /api/teams?token=...                               -> dados públicos do convite (sem login)
 * POST /api/teams { action: 'claim', token, ... }         -> dono de time aceita o convite
 *        mensalista:   { teamName, category }             (escolhe o time e a categoria daquele horário)
 *        time da casa: { categories: [...] }              (vira dono do time e cria as categorias)
 * POST /api/teams { action: 'release', teamId }           -> dono do campo tira o responsável do time
 * POST /api/teams { action: 'approve', teamId }           -> dono do campo aprova o pedido de mensalista de um time
 */

const cleanCategory = (c: unknown) => String(c || '').trim().slice(0, 30);
const sameName = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

const inviteUrl = (request: Request, token: string) => `${env.appUrl() || new URL(request.url).origin}/?time=${token}`;

const scheduleText = (team: HomeTeamRow) => {
  const day = dayLabel(team.fixed_day);
  const time = timeLabel(team.fixed_time);
  return [day && time ? `toda ${day} às ${time}` : '', team.court_name ? `quadra ${team.court_name}` : '', sportLabel(team.sport)]
    .filter(Boolean)
    .join(' • ');
};

/** Status em que o mandante ainda pode ser trocado (jogo não foi para pagamento/confirmação). */
const OPEN_HOME_STATUSES = ['waiting_opponent', 'pending_home_approval'];

/** Atualiza os jogos futuros ainda abertos em que o time é mandante (ex.: depois que alguém aceitou o convite). */
const syncFutureHomeSlots = async (team: HomeTeamRow, patch: Record<string, unknown>) => {
  const { error } = await db()
    .from('match_slot')
    .update(patch)
    .eq('home_team_id', team.id)
    .gte('date', todayBR())
    .in('status', OPEN_HOME_STATUSES);
  if (error) throw error;
};

// --------------------------------------------------------------- convite ---
const invite = async (request: Request, body: any) => {
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const team = await loadHomeTeam(body.teamId);
  const field = await loadField(team.field_id);
  assert(field.owner_id === user.id || isAdmin(actor), 403, 'Somente o dono do campo pode convidar.');
  if (team.captain_user_id) {
    throw new HttpError(409, `Este time já tem responsável${team.captain_name ? `: ${team.captain_name}` : ''}. Para trocar, remova o responsável primeiro.`, 'ALREADY_CLAIMED');
  }

  const { data: existing } = await db().from('team_invite').select('token').eq('team_id', team.id).is('used_at', null).limit(1);
  let token = existing?.[0]?.token as string | undefined;
  if (!token) {
    token = newTeamInviteToken();
    const { error } = await db().from('team_invite').insert([{ token, team_id: team.id, created_by: user.id }]);
    if (error) throw error;
  }

  const url = inviteUrl(request, token);
  const message = team.kind === 'MENSALISTA'
    ? `⚽ Convite Jogo Fácil!\nSeu horário de MENSALISTA na arena ${field.name}:\n📅 ${scheduleText(team)}\n` +
      `Crie sua conta (ou entre) e escolha a categoria do seu time: ${url}`
    : `⚽ Convite Jogo Fácil!\nVocê foi convidado para ser o responsável pelo time da casa "${team.name}" da arena ${field.name}.\n` +
      `Crie sua conta (ou entre), cadastre as categorias e marque jogos em casa e fora: ${url}`;
  return json({ token, url, message });
};

// --------------------------------------------------------------- preview ---
const preview = async (token: string) => {
  const inv = await findTeamInvite(token);
  const team = await loadHomeTeam(inv.team_id);
  const field = await loadField(team.field_id);
  return json({
    token,
    kind: team.kind,
    open: !inv.used_at && !team.captain_user_id,
    teamName: team.name || '',
    fixedDay: team.fixed_day != null && team.fixed_day !== '' ? Number(team.fixed_day) : null,
    fixedTime: timeLabel(team.fixed_time) || null,
    durationMinutes: team.fixed_duration_minutes || 60,
    courtName: team.court_name,
    sport: sportLabel(team.sport),
    gender: team.gender,
    field: { id: field.id, name: field.name, location: field.location, imageUrl: field.image_url },
  });
};

// ---------------------------------------------------------------- aceitar ---
const saveUserTeams = async (user: DbUser, teams: NonNullable<DbUser['teams']>) => {
  const { error } = await db().from('user').update({ teams }).eq('id', user.id);
  if (error) throw error;
  user.teams = teams;
};

const claim = async (request: Request, body: any) => {
  const { user, actor } = await requireSession(request);
  assert(actor.role === 'TEAM_CAPTAIN', 403, 'Entre com uma conta de dono de time para aceitar o convite.');
  const inv = await findTeamInvite(String(body.token || ''));
  const team = await loadHomeTeam(inv.team_id);
  const field = await loadField(team.field_id);
  if (inv.used_at || (team.captain_user_id && team.captain_user_id !== user.id)) {
    throw new HttpError(409, 'Este convite já foi aceito.', 'ALREADY_CLAIMED');
  }

  const teams = [...(user.teams || [])];
  let message: string;
  let category = '';

  if (team.kind === 'MENSALISTA') {
    category = cleanCategory(body.category);
    assert(category, 400, 'Escolha a categoria que vai jogar neste horário.');
    const idx = teams.findIndex(t => sameName(t.name, body.teamName));
    assert(idx >= 0, 400, 'Escolha um dos seus times.');
    const myTeam = teams[idx];
    if (!(myTeam.categories || []).includes(category)) {
      teams[idx] = { ...myTeam, categories: [...(myTeam.categories || []), category] };
      await saveUserTeams(user, teams);
    }
    const { error } = await db().from('registered_team').update({
      name: myTeam.name,
      categories: [category],
      logo_url: myTeam.logoUrl || team.logo_url,
      gender: myTeam.gender || team.gender || 'MASCULINO',
      captain_user_id: user.id,
      captain_name: user.name,
      captain_phone: user.phone_number,
      email: user.email,
      status: 'approved',
    }).eq('id', team.id);
    if (error) throw error;
    Object.assign(team, { name: myTeam.name, logo_url: myTeam.logoUrl || team.logo_url, gender: myTeam.gender || team.gender });

    await syncFutureHomeSlots(team, {
      home_team_user_id: user.id,
      local_team_name: myTeam.name,
      local_team_phone: user.phone_number,
      local_team_logo_url: myTeam.logoUrl || team.logo_url || null,
    });
    // Jogos já criados para este horário e ainda sem adversário passam a ser da categoria escolhida
    const gender = myTeam.gender || team.gender || 'MASCULINO';
    const { error: catErr } = await db()
      .from('match_slot')
      .update({ local_team_category: category, allowed_opponent_categories: [category], local_team_gender: gender, allowed_opponent_genders: [gender] })
      .eq('home_team_id', team.id)
      .gte('date', todayBR())
      .eq('status', 'waiting_opponent')
      .is('opponent_user_id', null);
    if (catErr) throw catErr;
    const created = await createMensalistaSlots(team, user, category);
    message = created > 0
      ? `Pronto! ${myTeam.name} (${category}) é mensalista da arena ${field.name}. Criamos ${created} jogo(s) na sua agenda.`
      : `Pronto! ${myTeam.name} (${category}) é mensalista da arena ${field.name}.`;
    await notify(field.owner_id, 'Mensalista confirmado ✅', `${myTeam.name} (${category}) aceitou o convite: ${scheduleText(team)}.`, 'success');
  } else {
    const categories: string[] = Array.isArray(body.categories) ? Array.from(new Set(body.categories.map(cleanCategory).filter(Boolean))) : [];
    let idx = teams.findIndex(t => sameName(t.name, team.name));
    const existingCats = idx >= 0 ? teams[idx].categories || [] : [];
    const merged = Array.from(new Set([...existingCats, ...categories]));
    assert(merged.length > 0, 400, 'Escolha pelo menos uma categoria do time.');
    if (idx >= 0) {
      teams[idx] = { ...teams[idx], categories: merged };
    } else {
      teams.push({
        name: team.name || 'Time da casa',
        categories: merged,
        logoUrl: team.logo_url || undefined,
        gender: team.gender || 'MASCULINO',
        sport: sportLabel(team.sport),
      });
      idx = teams.length - 1;
    }
    await saveUserTeams(user, teams);
    const { error } = await db().from('registered_team').update({
      categories: merged,
      captain_user_id: user.id,
      captain_name: user.name,
      captain_phone: user.phone_number,
      email: user.email,
      status: 'approved',
    }).eq('id', team.id);
    if (error) throw error;
    await syncFutureHomeSlots(team, { home_team_user_id: user.id, local_team_phone: user.phone_number });
    message = `Pronto! Você é o responsável pelo ${team.name}, time da casa da arena ${field.name}. Os jogos em casa aparecem em "Meus Jogos".`;
    await notify(field.owner_id, 'Time da casa com responsável ✅', `${user.name} agora é o responsável pelo ${team.name}.`, 'success');
  }

  await db().from('team_invite').update({ used_by: user.id, used_at: new Date().toISOString() }).eq('id', inv.id);
  return json({ message, kind: team.kind, teamName: team.name, category: category || undefined });
};

// ------------------------------------------------------- tirar responsável ---
const release = async (request: Request, body: any) => {
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const team = await loadHomeTeam(body.teamId);
  const field = await loadField(team.field_id);
  assert(field.owner_id === user.id || isAdmin(actor), 403, 'Somente o dono do campo pode alterar o time.');
  const previous = team.captain_user_id;
  const { error } = await db().from('registered_team')
    .update({ captain_user_id: null, captain_name: null, captain_phone: null, email: null })
    .eq('id', team.id);
  if (error) throw error;
  if (team.kind === 'MENSALISTA') {
    // Os jogos futuros do mensalista ainda sem adversário voltam a ficar livres na agenda
    const { error: freeErr } = await db()
      .from('match_slot')
      .update({ ...CLEAR_HOME_TEAM, home_team_type: 'OUTSIDE', is_booked: false, allowed_opponent_categories: [], status: 'available' })
      .eq('home_team_id', team.id)
      .gte('date', todayBR())
      .eq('status', 'waiting_opponent')
      .is('opponent_user_id', null);
    if (freeErr) throw freeErr;
    // Os que já têm adversário passam a ser aprovados pelo dono do campo
    await syncFutureHomeSlots(team, { home_team_user_id: null });
    await db().from('registered_team').update({ categories: [] }).eq('id', team.id);
  } else {
    // Time da casa sem responsável volta a ser aprovado pelo dono do campo
    await syncFutureHomeSlots(team, { home_team_user_id: field.owner_id });
  }
  if (previous) await notify(previous, 'Você saiu do time do campo', `A arena ${field.name} tirou você como responsável pelo ${team.name}.`, 'warning');
  return json({ message: 'Responsável removido. Envie um novo convite quando quiser.' });
};

// ------------------------------------------------- aprovar pedido de time ---
/** Pedido de mensalista feito pelo time ("Seja mensalista"): só o dono do campo aprova. */
const approve = async (request: Request, body: any) => {
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const team = await loadHomeTeam(body.teamId);
  const field = await loadField(team.field_id);
  assert(field.owner_id === user.id || isAdmin(actor), 403, 'Somente o dono do campo pode aprovar.');
  assert(team.status === 'pending', 409, 'Este pedido já foi respondido.');
  const { error } = await db().from('registered_team').update({ status: 'approved', processed_by: user.id }).eq('id', team.id);
  if (error) throw error;
  if (team.captain_user_id) {
    await notify(team.captain_user_id, 'Mensalista aprovado ✅', `A arena ${field.name} aprovou o ${team.name}: ${scheduleText(team)}.`, 'success');
  }
  return json({ message: 'Mensalista aprovado!' });
};

export const GET = handle(async request => {
  const token = new URL(request.url).searchParams.get('token') || '';
  return preview(token);
});

export const POST = handle(async request => {
  const body = await readJson(request);
  switch (body.action) {
    case 'invite':
      return invite(request, body);
    case 'claim':
      return claim(request, body);
    case 'release':
      return release(request, body);
    case 'approve':
      return approve(request, body);
    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
