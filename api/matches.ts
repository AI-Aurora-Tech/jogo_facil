import { handle, json, readJson, HttpError, assert } from './_lib/http.js';
import { requireSession, isAdmin, type DbUser } from './_lib/auth.js';
import { db, notify } from './_lib/supabaseAdmin.js';
import {
  loadSlot,
  loadField,
  toRuleSlot,
  updateSlotIfStatus,
  findUserTeam,
  assertNoCategoryConflict,
  dateBR,
  firstTeamName,
  firstTeamCategory,
  CLEAR_OPPONENT,
  CLEAR_FIRST_TEAM,
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
} from './_lib/payments.js';
import { findValidInvite, markInviteUsed } from './_lib/invites.js';
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

const requireFuture = (slot: SlotRow) => {
  assert(matchStart(toRuleSlot(slot)).getTime() > Date.now(), 400, 'Este horário já passou.');
};

// ---------------------------------------------------------------- reservar ---
/** 1º time de fora reserva um horário livre (sem mensalista/time da casa). */
const book = async ({ user, slot, field, body }: Ctx) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time podem reservar horários.');
  assert(slot.status === 'available' && !hasHomeTeam(toRuleSlot(slot)), 409, 'Este horário não está mais livre.', 'STALE');
  requireFuture(slot);
  const team = findUserTeam(user, body.teamName, body.category);
  await assertNoCategoryConflict(user.id, team.name, body.category, slot);

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

// ------------------------------------------------------- se candidatar ---
/** Adversário se inscreve num horário que já tem o time 1. */
const apply = async ({ user, slot, field, body }: Ctx) => {
  assert(user.role === 'TEAM_CAPTAIN', 403, 'Apenas donos de time podem se candidatar.');
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

// ----------------------------------------------- aprovação do time 1 ---
const teamDecision = async ({ user, actor, slot, field, body }: Ctx) => {
  assert(slot.status === 'pending_home_approval', 409, 'Esta partida não está aguardando aprovação.', 'STALE');
  const approver = opponentApproverId(toRuleSlot(slot), field.owner_id);
  assert(user.id === approver || isAdmin(actor), 403, 'Somente o time 1 deste jogo pode aprovar o adversário.');

  if (body.approve) {
    const next = statusAfterTeamApproval(toRuleSlot(slot));
    const updated = await updateSlotIfStatus(slot.id, 'pending_home_approval', { status: next, team_approved_at: new Date().toISOString() });
    if (next === 'pending_payment') {
      for (const share of computeShares(toRuleSlot(slot))) {
        const payerId = share.role === 'FIRST' ? slot.booked_by_user_id : slot.opponent_user_id;
        await notify(payerId, 'Partida aprovada: faça o pagamento 💸', `Jogo de ${dateBR(slot)} aprovado. Sua parte é ${money(share.amount)} via PIX.`, 'success');
      }
    } else {
      await notify(slot.opponent_user_id, 'Partida aprovada ✅', `${firstTeamName(slot)} aceitou o jogo de ${dateBR(slot)}. Falta a aprovação do campo.`, 'success');
      await notify(field.owner_id, 'Amistoso aguardando sua aprovação', `${firstTeamName(slot)} x ${slot.opponent_team_name} em ${dateBR(slot)}.`, 'info');
    }
    return { slot: updated, message: next === 'pending_payment' ? 'Partida aprovada! Pagamento liberado.' : 'Partida aprovada! Aguardando o campo.' };
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
  if (fieldScore && user.id !== field.owner_id) {
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

const ACTIONS: Record<string, (c: Ctx) => Promise<any>> = {
  book,
  apply,
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
  const fn = ACTIONS[body.action];
  if (!fn) throw new HttpError(400, 'Ação inválida.');
  const { user, actor } = await requireSession(request, body.actAsUserId);
  const slot = await loadSlot(body.slotId);
  const field = await loadField(slot.field_id);
  return json(await fn({ user, actor, slot, field, body }));
});
