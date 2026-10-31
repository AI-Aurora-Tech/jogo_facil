import { db, notify } from './supabaseAdmin.js';
import { asaas, dueDate, PAID_STATUSES } from './asaas.js';
import { env } from './env.js';
import { HttpError } from './http.js';
import type { DbUser } from './auth.js';
import { dateBR, firstTeamName, loadSlotField, loadSlot, toRuleSlot, type FieldRow, type SlotRow } from './slots.js';
import { computeShares, firstTeamUserId, hasHomeTeam, statusAfterPayment, type PayerRole } from '../../shared/matchRules.js';
import { isValidCpfCnpj } from '../../shared/document.js';

export interface PaymentRow {
  id: string;
  slot_id: string;
  payer_role: PayerRole;
  payer_user_id: string | null;
  team_name: string | null;
  amount: number;
  asaas_payment_id: string | null;
  invoice_url: string | null;
  pix_payload: string | null;
  pix_qr_base64: string | null;
  pix_expires_at: string | null;
  status: string;
  paid_at: string | null;
}

/** O que o app pode ver de uma cobrança. */
export const publicPayment = (p: PaymentRow) => ({
  id: p.id,
  role: p.payer_role,
  teamName: p.team_name,
  amount: Number(p.amount),
  status: p.status,
  paidAt: p.paid_at,
  invoiceUrl: p.invoice_url,
  pixPayload: p.pix_payload,
  pixQrBase64: p.pix_qr_base64,
  pixExpiresAt: p.pix_expires_at,
});

export const listPayments = async (slotId: string): Promise<PaymentRow[]> => {
  const { data, error } = await db().from('match_payment').select('*').eq('slot_id', slotId).order('created_at');
  if (error) throw error;
  return (data || []) as PaymentRow[];
};

/** Garante que o pagador tem um cliente no Asaas (exige CPF/CNPJ). */
export const ensureCustomer = async (user: DbUser, cpfCnpj?: string): Promise<string> => {
  const doc = (cpfCnpj || user.cpf_cnpj || '').replace(/\D/g, '');
  if (cpfCnpj && !isValidCpfCnpj(doc)) {
    throw new HttpError(400, 'CPF ou CNPJ inválido.', 'NEED_CPF');
  }
  if (user.asaas_customer_id) {
    if (cpfCnpj && doc !== (user.cpf_cnpj || '').replace(/\D/g, '')) {
      await asaas.updateCustomer(user.asaas_customer_id, { cpfCnpj: doc });
      await db().from('user').update({ cpf_cnpj: doc }).eq('id', user.id);
    }
    return user.asaas_customer_id;
  }
  if (doc.length !== 11 && doc.length !== 14) {
    throw new HttpError(422, 'Informe seu CPF (ou CNPJ) para gerar o PIX.', 'NEED_CPF');
  }
  const customer = await asaas.createCustomer({
    name: user.name,
    cpfCnpj: doc,
    email: user.email,
    mobilePhone: user.phone_number,
    externalReference: `user:${user.id}`,
  });
  await db().from('user').update({ asaas_customer_id: customer.id, cpf_cnpj: doc }).eq('id', user.id);
  user.asaas_customer_id = customer.id;
  user.cpf_cnpj = doc;
  return customer.id;
};

/** Papel de quem está pagando nesta partida. */
export const payerRoleFor = (slot: SlotRow, userId: string): PayerRole | null => {
  if (slot.opponent_user_id === userId) return 'OPPONENT';
  const shares = computeShares(toRuleSlot(slot));
  if (shares.some(s => s.role === 'FIRST') && slot.booked_by_user_id === userId) return 'FIRST';
  return null;
};

/**
 * Quem recebe a taxa do jogo:
 * - horário com mandante (time da casa/mensalista que não é o dono do campo) ou em local próprio:
 *   o dono do time mandante (ele acerta com o campo por fora, se for o caso);
 * - horário livre do campo: o dono do campo.
 */
export const payeeFor = async (slot: SlotRow, field: FieldRow): Promise<{ userId: string | null; walletId: string | null; isHomeTeam: boolean }> => {
  const home = await trustedHomeUserId(slot, field);
  if (home) {
    const { data } = await db().from('user').select('asaas_wallet_id').eq('id', home).maybeSingle();
    if (data?.asaas_wallet_id) return { userId: home, walletId: data.asaas_wallet_id, isHomeTeam: true };
    // Mandante ainda sem conta de recebimento: numa arena, o valor vai para o campo (e o mandante é avisado)
    if (field.id && field.asaas_wallet_id) {
      await notify(home, 'Configure seus recebimentos 💰', `A taxa do jogo de ${dateBR(slot)} foi para a arena porque você ainda não configurou a conta de recebimento. Acesse Agenda > Recebimentos.`, 'warning');
      return { userId: field.owner_id, walletId: field.asaas_wallet_id, isHomeTeam: false };
    }
    return { userId: home, walletId: null, isHomeTeam: true };
  }
  return { userId: field.owner_id || null, walletId: field.asaas_wallet_id || null, isHomeTeam: false };
};

/**
 * Mandante que gerencia o horário (aprova o adversário, define e recebe a taxa).
 * Só vale quando dá para confiar nos dados (o navegador consegue mexer em alguns campos do horário):
 * - jogo em local próprio (sem campo, criado pelo servidor); ou
 * - horário da arena ligado (home_team_id) a um time da casa/mensalista aprovado DESTA arena, cujo
 *   responsável é o próprio home_team_user_id, e sem time de fora reservado.
 * Nos outros casos o horário é do campo (null).
 */
export const trustedHomeUserId = async (slot: SlotRow, field: FieldRow): Promise<string | null> => {
  if (!hasHomeTeam(toRuleSlot(slot)) || !slot.home_team_user_id) return null;
  if (!slot.field_id) return slot.home_team_user_id;
  if (slot.home_team_user_id === field.owner_id || !slot.home_team_id || slot.booked_by_user_id) return null;
  const { data: team } = await db().from('registered_team').select('field_id, captain_user_id, status').eq('id', slot.home_team_id).maybeSingle();
  const ok = !!team && team.field_id === slot.field_id && team.captain_user_id === slot.home_team_user_id && ['approved', 'active'].includes(team.status || '');
  return ok ? slot.home_team_user_id : null;
};

/** O campo precisa aprovar o jogo? Só nos horários do campo (sem mandante confiável). */
export const fieldMustApprove = async (slot: SlotRow, field: FieldRow): Promise<boolean> =>
  !!field.id && !(await trustedHomeUserId(slot, field));

/**
 * Cria (ou reaproveita) a cobrança PIX do time.
 * O valor cai direto na carteira Asaas do dono do campo (split), menos a taxa da plataforma.
 */
export const getOrCreateMatchPayment = async (slot: SlotRow, field: FieldRow, payer: DbUser, role: PayerRole, cpfCnpj?: string) => {
  const share = computeShares(toRuleSlot(slot)).find(s => s.role === role);
  if (!share) throw new HttpError(400, 'Este time não precisa pagar nesta partida.');

  const existing = (await listPayments(slot.id)).find(p => p.payer_role === role && ['PENDING', 'PAID', 'OVERDUE'].includes(p.status));
  if (existing?.status === 'PAID') return existing;
  if (existing && existing.asaas_payment_id) {
    const expired = existing.pix_expires_at && new Date(existing.pix_expires_at).getTime() < Date.now();
    if (!expired && existing.pix_payload) return existing;
    // PIX vencido: gera novo QR Code da mesma cobrança
    const qr = await asaas.getPixQrCode(existing.asaas_payment_id);
    const { data } = await db()
      .from('match_payment')
      .update({ pix_payload: qr.payload, pix_qr_base64: qr.encodedImage, pix_expires_at: qr.expirationDate || null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    return data as PaymentRow;
  }

  const payee = await payeeFor(slot, field);
  if (!payee.walletId) {
    await notify(
      payee.userId,
      'Configure seus recebimentos 💰',
      payee.isHomeTeam
        ? `Um time quer pagar a taxa do jogo de ${dateBR(slot)}, mas você ainda não configurou a conta de recebimento. Acesse Minha agenda > Recebimentos.`
        : `Um time quer pagar o jogo de ${dateBR(slot)}, mas sua arena ainda não tem conta de recebimento. Acesse Arena > Recebimentos.`,
      'warning'
    );
    throw new HttpError(
      409,
      payee.isHomeTeam
        ? 'O time mandante ainda não configurou a conta de recebimento. Já avisamos o responsável.'
        : 'A arena ainda não configurou a conta de recebimento. Já avisamos o dono do campo.',
      'FIELD_NO_WALLET'
    );
  }

  const customerId = await ensureCustomer(payer, cpfCnpj);
  const teamName = role === 'OPPONENT' ? slot.opponent_team_name : slot.booked_by_team_name;

  const { data: row, error } = await db()
    .from('match_payment')
    .insert([{ slot_id: slot.id, payer_role: role, payer_user_id: payer.id, team_name: teamName, amount: share.amount, field_wallet_id: payee.walletId, status: 'PENDING' }])
    .select('*')
    .single();
  if (error) {
    if ((error as any).code === '23505') throw new HttpError(409, 'Já existe uma cobrança sendo gerada. Atualize a tela.', 'STALE');
    throw error;
  }

  try {
    const fieldPercent = Math.round((100 - env.platformFeePercent()) * 100) / 100;
    const payment = await asaas.createPixPayment({
      customer: customerId,
      value: share.amount,
      dueDate: dueDate(1) > slot.date ? slot.date : dueDate(1),
      description: `Jogo Fácil - ${field.name} - ${dateBR(slot)} - ${teamName || ''}`.slice(0, 500),
      externalReference: `match_payment:${row.id}`,
      split: fieldPercent > 0 ? [{ walletId: payee.walletId, percentualValue: fieldPercent }] : undefined,
    });
    const qr = await asaas.getPixQrCode(payment.id);
    const { data: updated, error: upErr } = await db()
      .from('match_payment')
      .update({
        asaas_payment_id: payment.id,
        invoice_url: payment.invoiceUrl || null,
        pix_payload: qr.payload,
        pix_qr_base64: qr.encodedImage,
        pix_expires_at: qr.expirationDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (upErr) throw upErr;
    return updated as PaymentRow;
  } catch (err) {
    await db().from('match_payment').delete().eq('id', row.id);
    throw err;
  }
};

/**
 * Marca a cobrança como paga. Quando todos os times pagaram, a partida vai para
 * aprovação do dono do campo. Idempotente (webhook pode chegar repetido).
 */
export const markPaymentPaid = async (paymentId: string): Promise<void> => {
  const { data: updatedRows, error } = await db()
    .from('match_payment')
    .update({ status: 'PAID', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .in('status', ['PENDING', 'OVERDUE'])
    .select('*');
  if (error) throw error;
  const payment = updatedRows?.[0] as PaymentRow | undefined;
  if (!payment) return; // já processado

  const slotFlag = payment.payer_role === 'FIRST' ? { first_team_paid: true } : { opponent_paid: true };
  await db().from('match_slot').update(slotFlag).eq('id', payment.slot_id);

  const slot = await loadSlot(payment.slot_id);
  const field = await loadSlotField(slot);
  await notify(payment.payer_user_id, 'Pagamento recebido ✅', `Recebemos o PIX de R$ ${Number(payment.amount).toFixed(2)} do jogo de ${dateBR(slot)}.`, 'success');

  const shares = computeShares(toRuleSlot(slot));
  const allPaid = shares.every(s => (s.role === 'FIRST' ? slot.first_team_paid : slot.opponent_paid));
  if (allPaid && slot.status === 'pending_payment') {
    const needsField = await fieldMustApprove(slot, field);
    const { data: moved } = await db()
      .from('match_slot')
      .update({
        status: statusAfterPayment(needsField),
        paid_at: new Date().toISOString(),
        ...(needsField ? {} : { confirmed_at: new Date().toISOString() }),
      })
      .eq('id', slot.id)
      .eq('status', 'pending_payment')
      .select('id');
    if (moved && moved.length > 0) {
      if (needsField) {
        await notify(
          field.owner_id,
          'Pagamento confirmado: aprove a partida ⚽',
          `${firstTeamName(slot)} x ${slot.opponent_team_name} em ${dateBR(slot)} está pago. Aprove ou recuse o jogo.`,
          'success'
        );
        await notify(firstTeamUserId(toRuleSlot(slot), field.owner_id), 'Pagamento concluído', `Todos pagaram o jogo de ${dateBR(slot)}. Agora falta a aprovação do campo.`, 'info');
      } else {
        // Horário do mandante: pago = jogo confirmado
        for (const id of [slot.home_team_user_id, slot.opponent_user_id]) {
          await notify(id, 'Jogo confirmado! ⚽', `${firstTeamName(slot)} x ${slot.opponent_team_name} em ${field.name}, ${dateBR(slot)}. Bom jogo!`, 'success');
        }
      }
    }
  } else if (!allPaid) {
    const pendingRole = shares.find(s => !(s.role === 'FIRST' ? slot.first_team_paid : slot.opponent_paid))?.role;
    const pendingUser = pendingRole === 'FIRST' ? slot.booked_by_user_id : slot.opponent_user_id;
    await notify(pendingUser, 'Falta o seu pagamento 💸', `O adversário já pagou a parte dele do jogo de ${dateBR(slot)}. Pague a sua para confirmar.`, 'warning');
  }
};

/** Consulta o Asaas e atualiza cobranças pendentes (útil se o webhook atrasar). */
export const syncPendingPayments = async (slotId: string): Promise<void> => {
  const pending = (await listPayments(slotId)).filter(p => ['PENDING', 'OVERDUE'].includes(p.status) && p.asaas_payment_id);
  for (const p of pending) {
    const remote = await asaas.getPayment(p.asaas_payment_id!);
    if (PAID_STATUSES.includes(remote.status)) await markPaymentPaid(p.id);
  }
};

/** Estorna o que foi pago e cancela o que está pendente. */
export const refundAndCancelPayments = async (slotId: string, reason: string, onlyRole?: PayerRole): Promise<number> => {
  const payments = (await listPayments(slotId)).filter(p => !onlyRole || p.payer_role === onlyRole);
  let refunded = 0;
  for (const p of payments) {
    if (p.status === 'PAID' && p.asaas_payment_id) {
      await asaas.refundPayment(p.asaas_payment_id, reason.slice(0, 200));
      await db().from('match_payment').update({ status: 'REFUNDED', refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.id);
      refunded += 1;
    } else if (['PENDING', 'OVERDUE'].includes(p.status)) {
      if (p.asaas_payment_id) {
        try {
          await asaas.deletePayment(p.asaas_payment_id);
        } catch (e) {
          console.warn('[payments] não consegui cancelar no Asaas', p.asaas_payment_id, e);
        }
      }
      await db().from('match_payment').update({ status: 'CANCELED', updated_at: new Date().toISOString() }).eq('id', p.id);
    }
  }
  return refunded;
};
