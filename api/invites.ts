import { handle, json, readJson, assert, HttpError } from './_lib/http.js';
import { requireSession, isAdmin } from './_lib/auth.js';
import { db } from './_lib/supabaseAdmin.js';
import { findValidInvite, newInviteToken } from './_lib/invites.js';
import { loadField, loadSlot, toRuleSlot, firstTeamName, firstTeamCategory } from './_lib/slots.js';
import { env } from './_lib/env.js';
import { firstTeamUserId, matchStart, normalizeMatchKind, opponentShare, MATCH_KIND_LABEL } from '../shared/matchRules.js';

/**
 * Convites de partida.
 *
 * POST /api/invites { slotId }   -> cria o link (dono do campo, mensalista/time da casa ou time 1)
 * GET  /api/invites?token=...    -> dados públicos do jogo, para a tela do convite (não exige login)
 */

export const POST = handle(async request => {
  const body = await readJson(request);
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const slot = await loadSlot(body.slotId);
  const field = await loadField(slot.field_id);

  const first = firstTeamUserId(toRuleSlot(slot), field.owner_id);
  const allowed = isAdmin(actor) || user.id === field.owner_id || user.id === first || user.id === slot.home_team_user_id;
  assert(allowed, 403, 'Somente o campo ou o time 1 deste jogo podem enviar convites.');
  assert(slot.status === 'waiting_opponent', 400, 'O convite só pode ser enviado enquanto o jogo aguarda adversário.');

  // Reaproveita um convite ainda válido deste jogo
  const { data: existing } = await db()
    .from('match_invite')
    .select('*')
    .eq('slot_id', slot.id)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  let token = existing?.[0]?.token as string | undefined;
  if (!token) {
    token = newInviteToken();
    const { error } = await db().from('match_invite').insert([{
      token,
      slot_id: slot.id,
      created_by: user.id,
      category: firstTeamCategory(slot),
      expires_at: matchStart(toRuleSlot(slot)).toISOString(),
    }]);
    if (error) throw error;
  }

  const origin = env.appUrl() || new URL(request.url).origin;
  const url = `${origin}/?convite=${token}`;
  const share = opponentShare(toRuleSlot(slot));
  const category = firstTeamCategory(slot);
  const message =
    `⚽ Convite Jogo Fácil!\n${firstTeamName(slot)}${category ? ` (${category})` : ''} procura adversário.\n` +
    `📍 ${field.name}\n📅 ${slot.date.split('-').reverse().join('/')} às ${String(slot.time).slice(0, 5)}\n` +
    `💰 ${share > 0 ? `Taxa do adversário: R$ ${share.toFixed(2).replace('.', ',')}` : 'Sem taxa'}\n` +
    `Crie sua conta grátis e confirme: ${url}`;

  return json({ token, url, message });
});

export const GET = handle(async request => {
  const token = new URL(request.url).searchParams.get('token') || '';
  const invite = await findValidInvite(token);
  const slot = await loadSlot(invite.slot_id);
  const field = await loadField(slot.field_id);

  await db().from('match_invite').update({ opened_count: (invite.opened_count || 0) + 1 }).eq('id', invite.id);

  if (!['waiting_opponent'].includes(slot.status) && !invite.used_by) {
    throw new HttpError(410, 'Este jogo já encontrou um adversário ou não está mais disponível.');
  }

  const kind = normalizeMatchKind(slot.match_type);
  return json({
    token,
    open: slot.status === 'waiting_opponent',
    slotId: slot.id,
    date: slot.date,
    time: String(slot.time).slice(0, 5),
    durationMinutes: slot.duration_minutes,
    sport: slot.sport,
    courtName: slot.court_name,
    matchKind: kind,
    matchKindLabel: MATCH_KIND_LABEL[kind],
    prizeDescription: slot.prize_description,
    homeTeamName: firstTeamName(slot),
    homeTeamLogoUrl: slot.has_local_team ? slot.local_team_logo_url : slot.booked_by_team_logo_url,
    category: invite.category || firstTeamCategory(slot),
    allowedCategories: slot.allowed_opponent_categories || [],
    allowedGenders: slot.allowed_opponent_genders || [],
    opponentShare: opponentShare(toRuleSlot(slot)),
    field: { id: field.id, name: field.name, location: field.location, imageUrl: field.image_url, ratingAvg: Number(field.rating_avg) || 0, ratingCount: field.rating_count || 0 },
  });
});
