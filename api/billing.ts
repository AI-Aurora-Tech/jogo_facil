import { handle, json, readJson, assert, HttpError } from './_lib/http.js';
import { requireSession, type DbUser } from './_lib/auth.js';
import { db } from './_lib/supabaseAdmin.js';
import { asaas, dueDate } from './_lib/asaas.js';
import { ensureCustomer } from './_lib/payments.js';
import { countBillableCategories, monthlyPriceForCategories, CATEGORY_MONTHLY_PRICE } from '../shared/pricing.js';

/**
 * Mensalidade dos donos de time (por categoria), via assinatura recorrente do Asaas.
 *
 * POST /api/billing { action: 'status' | 'subscribe' | 'sync' }
 *  - status:    valor calculado + situação da assinatura
 *  - subscribe: cria/atualiza a assinatura e devolve o link da fatura (PIX, boleto ou cartão)
 *  - sync:      chamado quando o time muda as categorias; ajusta o valor (ou cancela se ficou grátis)
 */

const describe = (count: number) => `Jogo Fácil - ${count} categoria(s) x R$ ${CATEGORY_MONTHLY_PRICE.toFixed(2).replace('.', ',')}`;

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

const summary = (user: DbUser) => {
  const categories = countBillableCategories(user.teams);
  const value = monthlyPriceForCategories(categories);
  return { categories, value };
};

/** Ajusta a assinatura ao número atual de categorias. */
const sync = async (user: DbUser) => {
  const { categories, value } = summary(user);

  if (value === 0) {
    if (user.asaas_subscription_id) {
      try {
        await asaas.cancelSubscription(user.asaas_subscription_id);
      } catch (e) {
        console.warn('[billing] falha ao cancelar assinatura', e);
      }
    }
    await saveBilling(user, { billing_status: 'FREE', billed_categories: categories, billing_value: 0, asaas_subscription_id: null, is_subscribed: false });
    return { categories, value, billingStatus: 'FREE' };
  }

  if (user.asaas_subscription_id) {
    if (Number(user.billing_value) !== value) {
      await asaas.updateSubscriptionValue(user.asaas_subscription_id, value, describe(categories));
    }
    await saveBilling(user, { billed_categories: categories, billing_value: value });
    return { categories, value, billingStatus: user.billing_status || 'PENDING' };
  }

  // Passou de 1 categoria e ainda não assinou
  const status = user.billing_status === 'ACTIVE' ? 'ACTIVE' : 'PENDING';
  await saveBilling(user, { billing_status: status, billed_categories: categories, billing_value: value });
  return { categories, value, billingStatus: status };
};

export const POST = handle(async request => {
  const body = await readJson(request);
  const { user } = await requireSession(request, body.actAsUserId);
  assert(user.role === 'TEAM_CAPTAIN', 400, 'A mensalidade é só para donos de time. Donos de campo usam o app de graça.');

  switch (body.action) {
    case 'status': {
      const { categories, value } = summary(user);
      const invoiceUrl = user.asaas_subscription_id && user.billing_status !== 'ACTIVE' ? await pendingInvoiceUrl(user.asaas_subscription_id).catch(() => null) : null;
      return json({ categories, value, billingStatus: value === 0 ? 'FREE' : user.billing_status || 'PENDING', invoiceUrl, hasCpf: !!user.cpf_cnpj });
    }

    case 'sync':
      return json(await sync(user));

    case 'subscribe': {
      const { categories, value } = summary(user);
      if (value === 0) return json(await sync(user));

      const customer = await ensureCustomer(user, body.cpfCnpj);
      let subscriptionId = user.asaas_subscription_id;
      if (subscriptionId) {
        const current = await asaas.getSubscription(subscriptionId).catch(() => null);
        if (!current || current.deleted || current.status === 'INACTIVE') subscriptionId = null;
      }
      if (!subscriptionId) {
        const sub = await asaas.createSubscription({
          customer,
          value,
          nextDueDate: dueDate(0),
          description: describe(categories),
          externalReference: `subscription:${user.id}`,
        });
        subscriptionId = sub.id;
      } else if (Number(user.billing_value) !== value) {
        await asaas.updateSubscriptionValue(subscriptionId, value, describe(categories));
      }
      await saveBilling(user, {
        asaas_subscription_id: subscriptionId,
        billing_status: user.billing_status === 'ACTIVE' ? 'ACTIVE' : 'PENDING',
        billed_categories: categories,
        billing_value: value,
      });
      const invoiceUrl = await pendingInvoiceUrl(subscriptionId);
      return json({ categories, value, billingStatus: user.billing_status === 'ACTIVE' ? 'ACTIVE' : 'PENDING', invoiceUrl });
    }

    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
