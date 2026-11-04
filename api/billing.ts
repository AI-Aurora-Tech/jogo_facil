import { handle, json, readJson, assert, HttpError } from './_lib/http.js';
import { requireSession, type DbUser } from './_lib/auth.js';
import { db } from './_lib/supabaseAdmin.js';
import { asaas, dueDate } from './_lib/asaas.js';
import { ensureCustomer } from './_lib/payments.js';
import { MONTHLY_PRICE, isTrialActive, trialDaysLeft } from '../shared/pricing.js';
import { isValidCpfCnpj, onlyDigits } from '../shared/document.js';

/**
 * Mensalidade dos donos de time: 30 dias grátis e depois R$ 19,99/mês fixo (assinatura recorrente do Asaas).
 *
 * POST /api/billing { action: 'status' | 'subscribe' | 'sync' | 'set_document' }
 *  - status:       situação (TRIAL / ACTIVE / PENDING...), dias de teste restantes e link da fatura em aberto
 *  - subscribe:    cria a assinatura (se assinar no teste, a 1ª cobrança é no fim do teste)
 *  - sync:         passa assinaturas antigas (por categoria) para o valor fixo
 *  - set_document: salva o CPF/CNPJ informado (usado nas cobranças)
 */

const DESCRIPTION = `Jogo Fácil - mensalidade do dono de time (R$ ${MONTHLY_PRICE.toFixed(2).replace('.', ',')})`;

const saveBilling = async (user: DbUser, patch: Record<string, unknown>) => {
  const { error } = await db().from('user').update({ ...patch, billing_updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) throw error;
};

const pendingInvoiceUrl = async (subscriptionId: string | null) => {
  if (!subscriptionId) return null;
  const { data } = await asaas.listSubscriptionPayments(subscriptionId);
  const open = (data || []).find(p => ['PENDING', 'OVERDUE'].includes(p.status));
  return open?.invoiceUrl || null;
};

/**
 * Situação da mensalidade:
 * - ACTIVE:  assinatura paga;
 * - TRIAL:   ainda no teste grátis de 30 dias (sem assinatura ativa);
 * - PENDING / OVERDUE / CANCELED: teste acabou e falta pagar.
 */
const effectiveStatus = (user: DbUser) => {
  if (user.billing_status === 'ACTIVE') return 'ACTIVE';
  if (isTrialActive(user.trial_ends_at)) return 'TRIAL';
  const s = user.billing_status || 'PENDING';
  return s === 'FREE' ? 'PENDING' : s;
};

const summary = (user: DbUser) => ({
  value: MONTHLY_PRICE,
  trialEndsAt: user.trial_ends_at || null,
  trialDaysLeft: trialDaysLeft(user.trial_ends_at),
  billingStatus: effectiveStatus(user),
});

/** Dia (horário de Brasília) em que o teste grátis acaba, se ainda está no teste. */
const trialEndDay = (user: DbUser) =>
  user.trial_ends_at && isTrialActive(user.trial_ends_at)
    ? new Date(new Date(user.trial_ends_at).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
    : null;

/**
 * Acerta uma assinatura que já existia:
 * - assinatura antiga (cobrada por categoria) passa para o valor fixo;
 * - no teste grátis, nada é cobrado antes do fim do teste (cobranças em aberto vencendo antes são apagadas
 *   e o próximo vencimento vai para o fim do teste).
 */
const sync = async (user: DbUser) => {
  const subscriptionId = user.asaas_subscription_id;
  if (!subscriptionId) return summary(user);
  try {
    if (Number(user.billing_value) !== MONTHLY_PRICE) {
      await asaas.updateSubscriptionValue(subscriptionId, MONTHLY_PRICE, DESCRIPTION);
      await saveBilling(user, { billing_value: MONTHLY_PRICE });
      user.billing_value = MONTHLY_PRICE;
    }
    const end = trialEndDay(user);
    if (end && user.billing_status !== 'ACTIVE') {
      const { data } = await asaas.listSubscriptionPayments(subscriptionId);
      const early = (data || []).filter(p => ['PENDING', 'OVERDUE'].includes(p.status) && (p.dueDate || '') < end);
      if (early.length) {
        await asaas.updateSubscriptionDueDate(subscriptionId, end);
        for (const p of early) await asaas.deletePayment(p.id);
        if (user.billing_status === 'OVERDUE') {
          await saveBilling(user, { billing_status: 'PENDING' });
          user.billing_status = 'PENDING';
        }
      }
    }
  } catch (e) {
    console.warn('[billing] falha ao acertar a assinatura', e);
  }
  return summary(user);
};

export const POST = handle(async request => {
  const body = await readJson(request);
  const { user } = await requireSession(request, body.actAsUserId);
  assert(user.role === 'TEAM_CAPTAIN', 400, 'A mensalidade é só para donos de time. Donos de campo usam o app de graça.');

  switch (body.action) {
    case 'status': {
      const invoiceUrl = user.asaas_subscription_id && user.billing_status !== 'ACTIVE' ? await pendingInvoiceUrl(user.asaas_subscription_id).catch(() => null) : null;
      return json({ ...(await sync(user)), invoiceUrl, hasCpf: !!user.cpf_cnpj });
    }

    case 'sync':
      return json(await sync(user));

    case 'set_document': {
      const doc = onlyDigits(body.cpfCnpj);
      assert(isValidCpfCnpj(doc), 400, 'CPF ou CNPJ inválido.', 'NEED_CPF');
      const { error } = await db().from('user').update({ cpf_cnpj: doc }).eq('id', user.id);
      if (error) throw error;
      if (user.asaas_customer_id && onlyDigits(user.cpf_cnpj) !== doc) {
        await asaas.updateCustomer(user.asaas_customer_id, { cpfCnpj: doc });
      }
      return json({ ok: true });
    }

    case 'subscribe': {
      const customer = await ensureCustomer(user, body.cpfCnpj);
      let subscriptionId = user.asaas_subscription_id;
      if (subscriptionId) {
        const current = await asaas.getSubscription(subscriptionId).catch(() => null);
        if (!current || current.deleted || current.status === 'INACTIVE') subscriptionId = null;
      }
      if (!subscriptionId) {
        // Assinou durante o teste grátis: a 1ª cobrança é no dia em que o teste acaba
        const end = trialEndDay(user);
        const sub = await asaas.createSubscription({
          customer,
          value: MONTHLY_PRICE,
          nextDueDate: end && end > dueDate(0) ? end : dueDate(0),
          description: DESCRIPTION,
          externalReference: `subscription:${user.id}`,
        });
        subscriptionId = sub.id;
        await saveBilling(user, { billing_value: MONTHLY_PRICE });
        user.billing_value = MONTHLY_PRICE;
      }
      const status = user.billing_status === 'ACTIVE' ? 'ACTIVE' : 'PENDING';
      await saveBilling(user, { asaas_subscription_id: subscriptionId, billing_status: status });
      user.billing_status = status;
      user.asaas_subscription_id = subscriptionId;
      await sync(user); // assinatura antiga: valor fixo e nada cobrado antes do fim do teste
      const invoiceUrl = await pendingInvoiceUrl(subscriptionId);
      return json({ ...summary(user), invoiceUrl });
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
