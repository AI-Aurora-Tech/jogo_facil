import { handle, json, readJson, HttpError, assert } from './_lib/http.js';
import { requireSession, isAdmin, type DbUser } from './_lib/auth.js';
import { db, notify } from './_lib/supabaseAdmin.js';
import {
  loadSlot,
  loadSlotField,
  toRuleSlot,
  updateSlotIfStatus,
  findUserTeam,
  assertNoCategoryConflict,
  dateBR,
  firstTeamName,
  firstTeamCategory,
  CLEAR_OPPONENT,
  CLEAR_FIRST_TEAM,
  CLEAR_HOME_TEAM,
  type SlotRow,
  type FieldRow,
} from './_lib/slots.js';
import {
  getOrCreateMatchPayment,
  listPayments,
  payerRoleFor,
  publicPayment,
  refundAndCancelPayments,
  syncPendingPayments,
  trustedHomeUserId,
  fieldMustApprove,
} from './_lib/payments.js';
import { findValidInvite, markInviteUsed } from './_lib/invites.js';
import { loadHomeTeam } from './_lib/homeTeams.js';
import { countBillableCategories, monthlyPriceForCategories } from '../shared/pricing.js';
import {
  canRate,
  canSetResult,
  computeShares,
  firstTeamUserId,
  hasHomeTeam,
  matchStart,
  opponentApproverId,
  opponentShare,
  statusAfterTeamApproval,
  FIELD_RATING_TAGS,
  TEAM_RATING_TAGS,
} from '../shared/matchRules.js';

/**
 * POST /api/matches  { action, slotId, ... }
 *
 * Todas as mudanças de status da partida passam por aqui, para que o servidor
 * valide quem pode fazer o quê e para que o dinheiro nunca dependa do navegador.
 */

type Ctx = { user: DbUser; actor: DbUser; slot: SlotRow; field: FieldRow; body: any };

const isFieldOwner = (c: Ctx) => c.field.owner_id === c.user.id || isAdmin(c.actor);
const money = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

/**
 * Mensalidade: 1ª categoria grátis; com mais categorias a assinatura precisa estar ativa e cobrir
 * todas elas (o app também bloqueia, mas a conferência que vale é esta).
 */
const requireSubscription = (user: DbUser) => {
  const count = countBillableCategories(user.teams);
  if (monthlyPriceForCategories(count) <= 0) return;
  const billed = user.billed_categories == null ? count : Number(user.billed_categories) || 0;
  assert(
    user.billing_status === 'ACTIVE' && billed >= count,
    402,
    'Sua mensalidade não cobre todas as categorias do seu time (1ª categoria grátis, R$ 19,99 por categoria adicional). Abra "Minha mensalidade" no perfil para regularizar.',
    'NEED_SUBSCRIPTION'
  );
};

const requireFuture = (slot: SlotRow) => {
  assert(matchStart(toRuleSlot(slot)).getTime() > Date.now(), 400, 'Este horário já passou.');
};

// ---------------------------------------------------------------- reservar ---
const sameName = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/** Time da casa ou mensalista deste campo cujo responsável é o usuário (pelo nome do time). */
const myHomeTeamAtField = async (userId: string, fieldId: string, teamName: string) => {
  const { data, error } = await db()
    .from('registered_team')
    .select('id, kind, name, status')
    .eq('field_id', fieldId)
    .eq('captain_user_id', userId);
  if (error) throw error;
  return (data || []).find(t => sameName(t.name, teamName) && ['approved', 'active'].includes(t.status || 'approved')) || null;
};

/**
 * Reserva um horário livre.
 * - Time de fora: vira o "time 1" e a taxa é dividida 50/50 com o adversário.
 * - Time da casa ou mensalista deste campo: assume o horário como MANDANTE e
 *   o adversário paga 100% da taxa.
 */
const book = async ({ user, slot, field, body }: Ctx) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time podem reservar horários.');
  requireSubscription(user);
  assert(slot.status === 'available' && !hasHomeTeam(toRuleSlot(slot)), 409, 'Este horário não está mais livre.', 'STALE');
  requireFuture(slot);
  const team = findUserTeam(user, body.teamName, body.category);
  await assertNoCategoryConflict(user.id, team.name, body.category, slot);

  const homeTeam = await myHomeTeamAtField(user.id, field.id, team.name);
  if (homeTeam) {
    const updated = await updateSlotIfStatus(slot.id, 'available', {
      status: 'waiting_opponent',
      is_booked: true,
      has_local_team: true,
      home_team_type: homeTeam.kind === 'LOCAL' ? 'LOCAL' : 'MENSALISTA',
      home_team_id: homeTeam.id,
      home_team_user_id: user.id,
      local_team_name: team.name,
      local_team_category: body.category,
      local_team_phone: user.phone_number,
      local_team_logo_url: team.logoUrl || null,
      local_team_gender: team.gender || null,
      allowed_opponent_categories: [body.category],
    });
    await notify(field.owner_id, 'Horário assumido pelo mandante ⚽', `${team.name} (${body.category}) assumiu ${dateBR(slot)} como mandante. Aguardando adversário.`, 'info');
    return { slot: updated, message: 'Horário reservado como mandante! Você define a taxa do adversário e recebe o valor. Agora envie o convite.' };
  }

  const updated = await updateSlotIfStatus(slot.id, 'available', {
    status: 'waiting_opponent',
    is_booked: true,
    home_team_type: 'OUTSIDE',
    booked_by_user_id: user.id,
    booked_by_team_name: team.name,
    booked_by_category: body.category,
    booked_by_team_logo_url: team.logoUrl || null,
    booked_by_team_gender: team.gender || null,
    booked_by_user_phone: user.phone_number,
    allowed_opponent_categories: [body.category],
  });

  await notify(field.owner_id, 'Horário reservado ⚽', `${team.name} (${body.category}) reservou ${dateBR(slot)}. Aguardando adversário.`, 'info');
  return { slot: updated, message: 'Horário reservado! Agora envie o convite para um adversário.' };
};

// ------------------------------------------------ mandante pelo campo ---
/**
 * Dono do campo coloca um mandante (time da casa ou mensalista) num horário que
 * criou livre. A partir daí o adversário paga 100% da taxa.
 * body: { homeTeamId } (time cadastrado no campo) ou { ownerTeamName } (time do perfil do dono do campo),
 *       category, allowedCategories?, allowedGenders?
 */
const assignHome = async (c: Ctx) => {
  const { user, slot, field, body } = c;
  assert(isFieldOwner(c), 403, 'Somente o dono do campo pode definir o mandante.');
  assert(slot.status === 'available' && !slot.booked_by_user_id, 409, 'Este horário já tem time. Cancele a reserva antes de definir o mandante.', 'STALE');
  requireFuture(slot);
  const category = String(body.category || '').trim().slice(0, 30);
  assert(category, 400, 'Selecione a categoria do mandante.');

  let home: { kind: 'LOCAL' | 'MENSALISTA'; id: string | null; name: string; userId: string | null; phone: string | null; logo: string | null; gender: string | null };
  if (body.homeTeamId) {
    const team = await loadHomeTeam(String(body.homeTeamId));
    assert(team.field_id === field.id, 400, 'Este time não é deste campo.');
    home = {
      kind: team.kind,
      id: team.id,
      name: team.name || 'Time da casa',
      userId: team.captain_user_id || (team.kind === 'LOCAL' ? field.owner_id : null),
      phone: team.captain_phone,
      logo: team.logo_url,
      gender: team.gender,
    };
  } else {
    const ownerTeam = (user.teams || []).find(t => sameName(t.name, body.ownerTeamName));
    assert(ownerTeam, 400, 'Selecione o time mandante.');
    home = { kind: 'LOCAL', id: null, name: ownerTeam.name, userId: field.owner_id, phone: field.contact_phone || null, logo: ownerTeam.logoUrl || null, gender: ownerTeam.gender || null };
  }

  const list = (v: any, max: number) => (Array.isArray(v) ? v.map((x: any) => String(x).slice(0, 30)).filter(Boolean).slice(0, max) : []);
  const allowedCategories = list(body.allowedCategories, 10);
  const allowedGenders = list(body.allowedGenders, 3);

  const updated = await updateSlotIfStatus(slot.id, 'available', {
    status: 'waiting_opponent',
    is_booked: true,
    has_local_team: true,
    home_team_type: home.kind,
    home_team_id: home.id,
    home_team_user_id: home.userId,
    local_team_name: home.name,
    local_team_category: category,
    local_team_phone: home.phone,
    local_team_logo_url: home.logo,
    local_team_gender: home.gender,
    allowed_opponent_categories: allowedCategories.length > 0 ? allowedCategories : [category],
    allowed_opponent_genders: allowedGenders.length > 0 ? allowedGenders : home.gender ? [home.gender] : [],
  });
  if (home.userId && home.userId !== field.owner_id) {
    await notify(home.userId, 'Novo jogo na sua agenda 📅', `A arena ${field.name} colocou o ${home.name} (${category}) como mandante em ${dateBR(slot)}. Envie o convite para um adversário!`, 'info');
  }
  return { slot: updated, message: 'Mandante definido! O adversário paga 100% da taxa.' };
};

// ------------------------------------------------------- se candidatar ---
/** Adversário se inscreve num horário que já tem o time 1. */
const apply = async ({ user, slot, field, body }: Ctx) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time podem se candidatar.');
  requireSubscription(user);
  assert(slot.status === 'waiting_opponent', 409, 'Este jogo não está mais aberto para adversários.', 'STALE');
  requireFuture(slot);

  const first = firstTeamUserId(toRuleSlot(slot), field.owner_id);
  assert(user.id !== first && user.id !== slot.booked_by_user_id && user.id !== slot.home_team_user_id, 400, 'Você já é o time 1 deste jogo.');

  const team = findUserTeam(user, body.teamName, body.category);
  const baseCategory = firstTeamCategory(slot);
  const allowed = slot.allowed_opponent_categories || [];
  if (allowed.length > 0) {
    assert(allowed.includes(body.category), 400, `Este jogo aceita apenas: ${allowed.join(', ')}.`);
  } else if (baseCategory) {
    assert(body.category === baseCategory, 400, `Este jogo é da categoria ${baseCategory}.`);
  }
  const genders = slot.allowed_opponent_genders || [];
  if (genders.length > 0 && team.gender) {
    assert(genders.includes(team.gender), 400, `Este jogo aceita apenas times: ${genders.join(', ').toLowerCase()}.`);
  }
  await assertNoCategoryConflict(user.id, team.name, body.category, slot);

  let inviteId: string | null = null;
  if (body.inviteToken) {
    const invite = await findValidInvite(body.inviteToken);
    assert(invite.slot_id === slot.id, 400, 'Este convite é de outra partida.');
    inviteId = invite.id;
  }

  const updated = await updateSlotIfStatus(slot.id, 'waiting_opponent', {
    status: 'pending_home_approval',
    opponent_user_id: user.id,
    opponent_team_name: team.name,
    opponent_team_category: body.category,
    opponent_team_phone: user.phone_number,
    opponent_team_logo_url: team.logoUrl || null,
    opponent_team_gender: team.gender || null,
    opponent_applied_at: new Date().toISOString(),
    field_decision_reason: null,
  });
  if (inviteId) await markInviteUsed(inviteId, user.id);

  const approver = opponentApproverId(toRuleSlot(slot), field.owner_id);
  await notify(
    approver,
    'Novo adversário: aprove a partida ⚔️',
    `${team.name} (${body.category}) quer jogar contra ${firstTeamName(slot)} em ${dateBR(slot)}. Abra "Meus Jogos" para aprovar.`,
    'info'
  );
  return { slot: updated, message: 'Inscrição enviada! Aguarde a aprovação do time adversário.' };
};

// ------------------------------------------- adversário aprovado ---
/**
 * Adversário aprovado (pelo time 1 ou por convite aceito): segue para o pagamento,
 * para a aprovação do campo (só horário livre do campo) ou já fica confirmado.
 */
const afterOpponentApproved = async (slot: SlotRow, field: FieldRow, from: string | string[], patch: Record<string, unknown> = {}) => {
  const merged = { ...slot, ...patch } as SlotRow;
  const needsField = await fieldMustApprove(merged, field);
  const next = statusAfterTeamApproval(toRuleSlot(merged), needsField);
  const now = new Date().toISOString();
  const updated = await updateSlotIfStatus(slot.id, from, {
    ...patch,
    status: next,
    team_approved_at: now,
    ...(next === 'confirmed' ? { confirmed_at: now } : {}),
  });
  if (next === 'pending_payment') {
    for (const share of computeShares(toRuleSlot(merged))) {
      const payerId = share.role === 'FIRST' ? merged.booked_by_user_id : merged.opponent_user_id;
      await notify(payerId, 'Partida aprovada: faça o pagamento 💸', `Jogo de ${dateBR(merged)} aprovado. Sua parte é ${money(share.amount)} via PIX.`, 'success');
    }
    return { slot: updated, message: 'Partida aprovada! Pagamento liberado.' };
  }
  if (next === 'pending_field_approval') {
    await notify(merged.opponent_user_id, 'Partida aprovada ✅', `${firstTeamName(merged)} aceitou o jogo de ${dateBR(merged)}. Falta a aprovação do campo.`, 'success');
    await notify(field.owner_id, 'Jogo aguardando sua aprovação', `${firstTeamName(merged)} x ${merged.opponent_team_name} em ${dateBR(merged)}.`, 'info');
    return { slot: updated, message: 'Partida aprovada! Aguardando o campo.' };
  }
  for (const id of [firstTeamUserId(toRuleSlot(merged), field.owner_id), merged.opponent_user_id]) {
    await notify(id, 'Jogo confirmado! ⚽', `${firstTeamName(merged)} x ${merged.opponent_team_name} em ${field.name}, ${dateBR(merged)}. Bom jogo!`, 'success');
  }
  return { slot: updated, message: 'Jogo confirmado!' };
};

// ----------------------------------------------- aprovação do time 1 ---
const teamDecision = async ({ user, actor, slot, field, body }: Ctx) => {
  assert(slot.status === 'pending_home_approval', 409, 'Esta partida não está aguardando aprovação.', 'STALE');
  const approver = opponentApproverId(toRuleSlot(slot), field.owner_id);
  assert(user.id === approver || isAdmin(actor), 403, 'Somente o time 1 deste jogo pode aprovar o adversário.');

  if (body.approve) {
    return afterOpponentApproved(slot, field, 'pending_home_approval');
  }

  const updated = await updateSlotIfStatus(slot.id, 'pending_home_approval', { ...CLEAR_OPPONENT, status: 'waiting_opponent' });
  await notify(slot.opponent_user_id, 'Partida recusada', `${firstTeamName(slot)} não aceitou o jogo de ${dateBR(slot)}.`, 'warning');
  return { slot: updated, message: 'Adversário recusado. O jogo voltou a ficar aberto.' };
};

// ---------------------------------------------------------- pagamento ---
const pay = async ({ user, slot, field, body }: Ctx) => {
  assert(slot.status === 'pending_payment', 409, 'Esta partida não está aguardando pagamento.', 'STALE');
  const role = payerRoleFor(slot, user.id);
  assert(role, 403, 'Seu time não tem pagamento pendente nesta partida.');
  const payment = await getOrCreateMatchPayment(slot, field, user, role, body.cpfCnpj);
  return { payment: publicPayment(payment) };
};

const paymentStatus = async (c: Ctx) => {
  const { slot, user } = c;
  const participant = [slot.booked_by_user_id, slot.home_team_user_id, slot.opponent_user_id].includes(user.id);
  assert(participant || isFieldOwner(c), 403, 'Você não participa desta partida.');
  if (slot.status === 'pending_payment') await syncPendingPayments(slot.id);
  const fresh = await loadSlot(slot.id);
  const payments = (await listPayments(slot.id)).filter(p => p.status !== 'CANCELED').map(p => ({ ...publicPayment(p), pixPayload: undefined, pixQrBase64: undefined }));
  return { slot: fresh, payments };
};

// ------------------------------------------------ aprovação do campo ---
/** Devolve o horário para a agenda (com estorno) quando o campo recusa ou cancela. */
const releaseSlot = async (slot: SlotRow, reason: string) => {
  const refunded = await refundAndCancelPayments(slot.id, reason);
  const patch = hasHomeTeam(toRuleSlot(slot))
    ? { ...CLEAR_OPPONENT, status: 'waiting_opponent', field_decision_reason: reason }
    : { ...CLEAR_OPPONENT, ...CLEAR_FIRST_TEAM, status: 'available', field_decision_reason: reason };
  const { data, error } = await db().from('match_slot').update(patch).eq('id', slot.id).select('*').single();
  if (error) throw error;
  return { slot: data as SlotRow, refunded };
};

const fieldDecision = async (c: Ctx) => {
  const { slot, field, body } = c;
  assert(isFieldOwner(c), 403, 'Somente o dono do campo pode aprovar a partida.');
  // 'pending_verification' = partidas antigas do fluxo de comprovante PIX
  const fieldStatuses = ['pending_field_approval', 'pending_verification'];
  assert(fieldStatuses.includes(slot.status), 409, 'Esta partida não está aguardando aprovação do campo.', 'STALE');
  const teams = [firstTeamUserId(toRuleSlot(slot), field.owner_id), slot.opponent_user_id].filter(id => id && id !== field.owner_id);

  if (body.approve) {
    const updated = await updateSlotIfStatus(slot.id, fieldStatuses, { status: 'confirmed', confirmed_at: new Date().toISOString(), is_booked: true });
    for (const id of teams) {
      await notify(id, 'Jogo confirmado! ⚽', `${firstTeamName(slot)} x ${slot.opponent_team_name} em ${field.name}, ${dateBR(slot)}. Bom jogo!`, 'success');
    }
    return { slot: updated, message: 'Partida confirmada!' };
  }

  const reason = String(body.reason || 'Recusada pelo campo').slice(0, 300);
  const { slot: updated, refunded } = await releaseSlot(slot, reason);
  for (const id of teams) {
    await notify(id, 'Partida recusada pelo campo', `O jogo de ${dateBR(slot)} foi recusado: ${reason}.${refunded ? ' O valor pago será estornado.' : ''}`, 'warning');
  }
  return { slot: updated, message: refunded ? 'Partida recusada. Os pagamentos foram estornados.' : 'Partida recusada.' };
};

// ---------------------------------------------------------- cancelar ---
const cancel = async (c: Ctx) => {
  const { user, slot, field } = c;
  const anyPaid = (await listPayments(slot.id)).some(p => p.status === 'PAID');

  // Dono do campo / admin: libera o horário em qualquer etapa, com estorno
  if (isFieldOwner(c)) {
    assert(!['available', 'finished'].includes(slot.status), 400, 'Não há nada para cancelar neste horário.');
    const reason = String(c.body.reason || 'Cancelado pelo campo').slice(0, 300);
    const others = [slot.booked_by_user_id, slot.home_team_user_id, slot.opponent_user_id].filter(id => id && id !== field.owner_id);
    const { slot: updated } = await releaseSlot(slot, reason);
    for (const id of new Set(others)) await notify(id, 'Jogo cancelado pelo campo', `O jogo de ${dateBR(slot)} foi cancelado: ${reason}.`, 'warning');
    return { slot: updated, message: 'Jogo cancelado.' };
  }

  // Jogo em local próprio: não tem campo, quem cancela (em qualquer etapa, com estorno) é o mandante
  if (!slot.field_id && slot.home_team_user_id === user.id) {
    assert(!['finished', 'rejected'].includes(slot.status), 400, 'Este jogo não pode mais ser cancelado.');
    const reason = String(c.body.reason || 'Cancelado pelo mandante').slice(0, 300);
    const refunded = await refundAndCancelPayments(slot.id, reason);
    const updated = await updateSlotIfStatus(slot.id, slot.status, { status: 'rejected', field_decision_reason: reason });
    await notify(slot.opponent_user_id, 'Jogo cancelado pelo mandante', `O jogo de ${dateBR(slot)} foi cancelado: ${reason}.${refunded ? ' O valor pago será estornado.' : ''}`, 'warning');
    return { slot: updated, message: refunded ? 'Jogo cancelado. Os pagamentos foram estornados.' : 'Jogo cancelado.' };
  }

  const cancellable = ['waiting_opponent', 'pending_home_approval', 'pending_payment'];
  assert(cancellable.includes(slot.status), 400, 'Depois do pagamento, fale com o campo para cancelar.');
  assert(!anyPaid, 400, 'Já existe pagamento feito. Fale com o campo para cancelar e receber o estorno.');

  // Adversário desiste
  if (slot.opponent_user_id === user.id) {
    await refundAndCancelPayments(slot.id, 'Adversário desistiu');
    const updated = await updateSlotIfStatus(slot.id, cancellable, { ...CLEAR_OPPONENT, status: 'waiting_opponent' });
    await notify(firstTeamUserId(toRuleSlot(slot), field.owner_id), 'Adversário desistiu', `${slot.opponent_team_name} saiu do jogo de ${dateBR(slot)}. O jogo voltou a ficar aberto.`, 'warning');
    return { slot: updated, message: 'Você saiu da partida.' };
  }

  // Primeiro time de fora desiste: horário volta a ficar livre
  if (!hasHomeTeam(toRuleSlot(slot)) && slot.booked_by_user_id === user.id) {
    await refundAndCancelPayments(slot.id, 'Time 1 desistiu');
    const updated = await updateSlotIfStatus(slot.id, cancellable, { ...CLEAR_OPPONENT, ...CLEAR_FIRST_TEAM, status: 'available' });
    await notify(slot.opponent_user_id, 'Jogo cancelado', `${slot.booked_by_team_name} cancelou o jogo de ${dateBR(slot)}.`, 'warning');
    await notify(field.owner_id, 'Reserva cancelada', `${slot.booked_by_team_name} cancelou ${dateBR(slot)}. O horário voltou a ficar livre.`, 'info');
    return { slot: updated, message: 'Reserva cancelada.' };
  }

  // Mandante (time da casa/mensalista) libera o horário enquanto ainda não tem adversário
  if (hasHomeTeam(toRuleSlot(slot)) && slot.home_team_user_id === user.id && user.id !== field.owner_id) {
    assert(slot.status === 'waiting_opponent' && !slot.opponent_user_id, 400, 'Já tem adversário inscrito. Recuse o adversário ou fale com o campo para cancelar.');
    // O horário volta para a arena com o valor dela (o mandante pode ter mudado a taxa)
    const updated = await updateSlotIfStatus(slot.id, 'waiting_opponent', {
      ...CLEAR_OPPONENT, ...CLEAR_FIRST_TEAM, ...CLEAR_HOME_TEAM, status: 'available', price: Number(field.hourly_rate) || 0,
    });
    await notify(field.owner_id, 'Mandante liberou o horário', `${firstTeamName(slot)} não vai jogar em ${dateBR(slot)}. O horário voltou a ficar livre.`, 'info');
    return { slot: updated, message: 'Horário liberado.' };
  }

  throw new HttpError(403, 'Você não participa desta partida.');
};

// --------------------------------------------------------- resultado ---
const setResult = async ({ user, actor, slot, field, body }: Ctx) => {
  const rule = toRuleSlot(slot);
  assert(canSetResult(rule), 400, 'O placar só pode ser lançado 2 horas após o fim do jogo.');
  const setter = firstTeamUserId(rule, field.owner_id);
  assert(user.id === setter || isAdmin(actor), 403, 'Somente o time 1 lança o placar.');
  const home = Number(body.homeScore);
  const away = Number(body.awayScore);
  assert(Number.isInteger(home) && Number.isInteger(away) && home >= 0 && away >= 0 && home < 100 && away < 100, 400, 'Placar inválido.');

  const updated = await updateSlotIfStatus(slot.id, 'confirmed', {
    status: 'finished',
    home_score: home,
    away_score: away,
    result_notes: body.notes ? String(body.notes).slice(0, 300) : null,
    result_set_by: user.id,
    result_set_at: new Date().toISOString(),
  });
  await notify(slot.opponent_user_id, 'Placar lançado 🏆', `${firstTeamName(slot)} ${home} x ${away} ${slot.opponent_team_name}. Avalie o adversário e o campo!`, 'info');
  return { slot: updated, message: 'Placar salvo! Agora avalie o adversário e o campo.' };
};

// --------------------------------------------------------- avaliação ---
const rate = async ({ user, slot, field, body }: Ctx) => {
  const rule = toRuleSlot(slot);
  assert(canRate(rule), 400, 'A avaliação abre 2 horas após o fim do jogo.');
  const first = firstTeamUserId(rule, field.owner_id);
  const isFirst = user.id === first;
  const isOpponent = user.id === slot.opponent_user_id;
  assert(isFirst || isOpponent, 403, 'Somente os times da partida podem avaliar.');

  const raterTeam = isOpponent ? slot.opponent_team_name : firstTeamName(slot);
  const target = isOpponent
    ? { userId: slot.has_local_team ? slot.home_team_user_id : slot.booked_by_user_id, team: firstTeamName(slot) }
    : { userId: slot.opponent_user_id, team: slot.opponent_team_name };

  const score = (v: any) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const tags = (v: any, allowed: string[]) => (Array.isArray(v) ? v.filter((t: string) => allowed.includes(t)).slice(0, 8) : []);
  const comment = body.comment ? String(body.comment).slice(0, 500) : null;

  const rows: any[] = [];
  const teamScore = score(body.teamScore);
  if (teamScore) {
    rows.push({ slot_id: slot.id, rater_user_id: user.id, rater_team_name: raterTeam, target_type: 'TEAM', target_user_id: target.userId, target_team_name: target.team, score: teamScore, tags: tags(body.teamTags, TEAM_RATING_TAGS), comment });
  }
  const fieldScore = score(body.fieldScore);
  // Jogo em local próprio do mandante não tem campo para avaliar
  if (fieldScore && field.id && user.id !== field.owner_id) {
    rows.push({ slot_id: slot.id, rater_user_id: user.id, rater_team_name: raterTeam, target_type: 'FIELD', target_field_id: field.id, score: fieldScore, tags: tags(body.fieldTags, FIELD_RATING_TAGS), comment });
  }
  assert(rows.length > 0, 400, 'Dê uma nota de 1 a 5 estrelas.');

  const { error } = await db().from('rating').upsert(rows, { onConflict: 'slot_id,rater_user_id,target_type' });
  if (error) throw error;
  return { message: 'Avaliação enviada. Obrigado!' };
};

const myRatings = async ({ user, slot }: Ctx) => {
  const { data } = await db().from('rating').select('target_type, score, tags, comment').eq('slot_id', slot.id).eq('rater_user_id', user.id);
  return { ratings: data || [] };
};

/** Pré-visualização de valores para a tela (o que cada lado paga). */
const quote = async ({ slot }: Ctx) => ({ opponentShare: opponentShare(toRuleSlot(slot)), shares: computeShares(toRuleSlot(slot)) });

// -------------------------------------------- taxa definida pelo mandante ---
/** Mandante define a taxa que o adversário paga (antes de gerar cobrança). */
const setFee = async ({ user, slot, field, body }: Ctx) => {
  const rule = toRuleSlot(slot);
  assert(hasHomeTeam(rule) && (await trustedHomeUserId(slot, field)) === user.id, 403, 'Somente o time mandante define a taxa deste jogo.');
  // Depois que um adversário se inscreve, a taxa não muda mais (ele aceitou o valor mostrado)
  assert(slot.status === 'waiting_opponent' && !slot.opponent_user_id, 409, 'A taxa só pode mudar enquanto o jogo não tem adversário.', 'STALE');
  const price = Math.round(Number(body.price) * 100) / 100;
  assert(Number.isFinite(price) && price >= 0 && price <= 5000, 400, 'Taxa inválida.');
  const { data, error } = await db().from('match_slot').update({ price }).eq('id', slot.id).eq('status', 'waiting_opponent').is('opponent_user_id', null).select('*');
  if (error) throw error;
  assert(data && data.length > 0, 409, 'Esta partida acabou de mudar. Atualize a tela.', 'STALE');
  return { slot: data[0], message: price > 0 ? `Taxa do adversário: ${money(price)}.` : 'Jogo sem taxa.' };
};

// ------------------------------------------------ visitantes disponíveis ---
const hm = (t: unknown) => String(t || '').slice(0, 5);
const plainSport = (s: unknown) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

/** O visitante disponível combina com este jogo? (dia, horário, categoria, gênero e esporte) */
const visitorMatches = (slot: SlotRow, a: any) => {
  if (a.date !== slot.date) return false;
  const t = hm(slot.time);
  if (t < hm(a.start_time) || t > hm(a.end_time)) return false;
  const allowed = slot.allowed_opponent_categories?.length ? slot.allowed_opponent_categories : [firstTeamCategory(slot)].filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(a.category)) return false;
  const genders = slot.allowed_opponent_genders || [];
  if (genders.length > 0 && a.gender && !genders.includes(a.gender)) return false;
  if (a.sport && slot.sport && plainSport(a.sport) !== plainSport(slot.sport)) return false;
  return true;
};

/** Mandante vê os times que querem jogar fora no dia/horário/categoria deste jogo. */
const visitors = async ({ user, slot, field }: Ctx) => {
  assert(firstTeamUserId(toRuleSlot(slot), field.owner_id) === user.id, 403, 'Somente o time mandante vê os visitantes.');
  const { data, error } = await db().from('team_availability').select('*').eq('date', slot.date).neq('user_id', user.id);
  if (error) throw error;
  const { data: sent } = await db().from('away_invite').select('availability_id, to_user_id, status').eq('slot_id', slot.id);
  const list = (data || []).filter(a => visitorMatches(slot, a)).map(a => ({
    id: a.id,
    teamName: a.team_name,
    category: a.category,
    gender: a.gender,
    sport: a.sport,
    startTime: hm(a.start_time),
    endTime: hm(a.end_time),
    notes: a.notes,
    invited: (sent || []).some(i => i.to_user_id === a.user_id && i.status === 'pending'),
  }));
  return { visitors: list };
};

/** Mandante convida um time que está disponível para jogar fora. */
const inviteVisitor = async ({ user, slot, field, body }: Ctx) => {
  assert(firstTeamUserId(toRuleSlot(slot), field.owner_id) === user.id, 403, 'Somente o time mandante pode convidar.');
  assert(slot.status === 'waiting_opponent' && !slot.opponent_user_id, 409, 'Este jogo já tem adversário.', 'STALE');
  requireFuture(slot);
  const { data: a } = await db().from('team_availability').select('*').eq('id', String(body.availabilityId || '')).maybeSingle();
  assert(a, 404, 'Este time não está mais disponível.');
  assert(a.user_id !== user.id, 400, 'Escolha um time adversário.');
  assert(visitorMatches(slot, a), 400, 'O horário, a categoria ou o esporte não combinam com este jogo.');
  const { error } = await db().from('away_invite').insert([{
    slot_id: slot.id, availability_id: a.id, from_user_id: user.id, to_user_id: a.user_id, to_team_name: a.team_name, category: a.category,
  }]);
  if (error) {
    if ((error as any).code === '23505') throw new HttpError(409, 'Você já convidou este time para este jogo.');
    throw error;
  }
  await notify(a.user_id, 'Convite para jogar fora ⚽', `${firstTeamName(slot)} convidou o ${a.team_name} (${a.category}) para jogar em ${field.name}, ${dateBR(slot)}. Abra "Minha agenda" para aceitar.`, 'info');
  return { message: `Convite enviado para ${a.team_name}!` };
};

const loadInvite = async (slot: SlotRow, userId: string, inviteId: unknown) => {
  const { data: inv } = await db().from('away_invite').select('*').eq('id', String(inviteId || '')).maybeSingle();
  assert(inv && inv.slot_id === slot.id && inv.to_user_id === userId, 404, 'Convite não encontrado.');
  assert(inv.status === 'pending', 409, 'Este convite já foi respondido.');
  return inv;
};

/** Visitante aceita o convite: entra como adversário já aprovado pelo mandante. */
const acceptInvite = async ({ user, slot, field, body }: Ctx) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Entre com uma conta de dono de time.');
  requireSubscription(user);
  const inv = await loadInvite(slot, user.id, body.inviteId);
  assert(slot.status === 'waiting_opponent' && !slot.opponent_user_id, 409, 'Este jogo já tem adversário.', 'STALE');
  requireFuture(slot);
  const team = findUserTeam(user, inv.to_team_name, inv.category);
  await assertNoCategoryConflict(user.id, team.name, inv.category, slot);

  const res = await afterOpponentApproved(slot, field, 'waiting_opponent', {
    opponent_user_id: user.id,
    opponent_team_name: team.name,
    opponent_team_category: inv.category,
    opponent_team_phone: user.phone_number,
    opponent_team_logo_url: team.logoUrl || null,
    opponent_team_gender: team.gender || null,
    opponent_applied_at: new Date().toISOString(),
    field_decision_reason: null,
  });
  const now = new Date().toISOString();
  await db().from('away_invite').update({ status: 'accepted', responded_at: now }).eq('id', inv.id);
  await db().from('away_invite').update({ status: 'canceled', responded_at: now }).eq('slot_id', slot.id).eq('status', 'pending');
  if (inv.availability_id) await db().from('team_availability').delete().eq('id', inv.availability_id);
  await notify(inv.from_user_id, 'Convite aceito ✅', `${team.name} (${inv.category}) aceitou jogar em ${dateBR(slot)}.`, 'success');
  return res;
};

const declineInvite = async ({ user, slot, body }: Ctx) => {
  const inv = await loadInvite(slot, user.id, body.inviteId);
  await db().from('away_invite').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', inv.id);
  await notify(inv.from_user_id, 'Convite recusado', `${inv.to_team_name} não vai poder jogar em ${dateBR(slot)}.`, 'warning');
  return { message: 'Convite recusado.' };
};

// ------------------------------------------ jogo em casa em local próprio ---
/**
 * Mandante cria um jogo em casa num local próprio (campo sem cadastro no app).
 * Sem dono de campo: o mandante aprova o adversário, define a taxa e recebe.
 * body: { teamName, category, date, time, durationMinutes, location, price, matchType?, prizeDescription? }
 */
const createHomeGame = async (user: DbUser, body: any) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time podem criar jogos em casa.');
  requireSubscription(user);
  const category = String(body.category || '').trim();
  const team = findUserTeam(user, body.teamName, category);
  const date = String(body.date || '');
  const time = hm(body.time);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time), 400, 'Informe a data e o horário.');
  const location = String(body.location || '').trim().slice(0, 300);
  assert(location.length >= 5, 400, 'Informe o endereço do local do jogo.');
  const duration = Math.min(Math.max(Number(body.durationMinutes) || 60, 20), 300);
  const price = Math.round((Number(body.price) || 0) * 100) / 100;
  assert(price >= 0 && price <= 5000, 400, 'Taxa inválida.');
  const kind = ['NORMAL', 'FESTIVAL', 'AMISTOSO'].includes(body.matchType) ? body.matchType : 'NORMAL';

  const draft = { id: '', date, time, duration_minutes: duration } as SlotRow;
  assert(matchStart(toRuleSlot({ ...draft, status: 'available' } as SlotRow)).getTime() > Date.now(), 400, 'Este horário já passou.');
  await assertNoCategoryConflict(user.id, team.name, category, draft);

  const { data, error } = await db().from('match_slot').insert([{
    field_id: null,
    custom_location: location,
    date,
    time,
    duration_minutes: duration,
    match_type: kind,
    prize_description: kind === 'FESTIVAL' ? String(body.prizeDescription || '').slice(0, 200) || null : null,
    is_booked: true,
    has_local_team: true,
    home_team_type: 'LOCAL',
    home_team_user_id: user.id,
    local_team_name: team.name,
    local_team_category: category,
    local_team_phone: user.phone_number,
    local_team_logo_url: team.logoUrl || null,
    local_team_gender: team.gender || null,
    allowed_opponent_categories: [category],
    allowed_opponent_genders: team.gender ? [team.gender] : [],
    status: 'waiting_opponent',
    price: kind === 'AMISTOSO' ? 0 : price,
    sport: team.sport || 'Futebol',
  }]).select('*').single();
  if (error) throw error;
  return { slot: data, message: 'Jogo em casa criado! Envie o convite ou convide um visitante disponível.' };
};

const ACTIONS: Record<string, (c: Ctx) => Promise<any>> = {
  set_fee: setFee,
  visitors,
  invite_visitor: inviteVisitor,
  accept_invite: acceptInvite,
  decline_invite: declineInvite,
  book,
  apply,
  assign_home: assignHome,
  team_decision: teamDecision,
  pay,
  payment_status: paymentStatus,
  field_decision: fieldDecision,
  cancel,
  set_result: setResult,
  rate,
  my_ratings: myRatings,
  quote,
};

export const POST = handle(async request => {
  const body = await readJson(request);
  if (body.action === 'create_home_game') {
    const { user } = await requireSession(request, body.actAsUserId);
    return json(await createHomeGame(user, body));
  }
  const fn = ACTIONS[body.action];
  if (!fn) throw new HttpError(400, 'Ação inválida.');
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const slot = await loadSlot(body.slotId);
  const field = await loadSlotField(slot);
  return json(await fn({ user, actor, slot, field, body }));
});
