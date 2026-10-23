import { timingSafeEqual } from 'node:crypto';
import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { db, notify } from '../_lib/supabaseAdmin.js';
import { env } from '../_lib/env.js';
import { markPaymentPaid } from '../_lib/payments.js';
import { PAID_STATUSES, type AsaasPayment } from '../_lib/asaas.js';

/**
 * Webhook do Asaas (configurar em Asaas > Integrações > Webhooks):
 *   URL:   https://SEU-DOMINIO/api/webhooks/asaas
 *   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos: cobranças (PAYMENT_*)
 */

const tokenOk = (given: string | null) => {
  const expected = env.asaasWebhookToken();
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

const handleSubscriptionPayment = async (event: string, payment: AsaasPayment) => {
  const { data: user } = await db().from('user').select('id, billing_status').eq('asaas_subscription_id', payment.subscription).maybeSingle();
  if (!user) return;

  if (PAID_STATUSES.includes(payment.status) && ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)) {
    const expiry = new Date(`${payment.dueDate || new Date().toISOString().slice(0, 10)}T12:00:00-03:00`);
    expiry.setMonth(expiry.getMonth() + 1);
    expiry.setDate(expiry.getDate() + 3); // 3 dias de tolerância
    await db().from('user').update({ billing_status: 'ACTIVE', is_subscribed: true, subscription_expiry: expiry.toISOString(), billing_updated_at: new Date().toISOString() }).eq('id', user.id);
    if (user.billing_status !== 'ACTIVE') await notify(user.id, 'Mensalidade ativa 🏆', 'Pagamento recebido. Todas as suas categorias estão liberadas.', 'success');
  } else if (event === 'PAYMENT_OVERDUE') {
    await db().from('user').update({ billing_status: 'OVERDUE', is_subscribed: false, billing_updated_at: new Date().toISOString() }).eq('id', user.id);
    await notify(user.id, 'Mensalidade em atraso ⚠️', 'Sua mensalidade venceu. Regularize para continuar agendando jogos com todas as categorias.', 'warning');
  }
};

const handleMatchPayment = async (event: string, payment: AsaasPayment) => {
  const id = (payment.externalReference || '').replace('match_payment:', '');
  if (!id) return;
  if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event) && PAID_STATUSES.includes(payment.status)) {
    await markPaymentPaid(id);
  } else if (event === 'PAYMENT_REFUNDED') {
    await db().from('match_payment').update({ status: 'REFUNDED', refunded_at: new Date().toISOString() }).eq('id', id);
  } else if (event === 'PAYMENT_OVERDUE') {
    await db().from('match_payment').update({ status: 'OVERDUE' }).eq('id', id).eq('status', 'PENDING');
  } else if (event === 'PAYMENT_DELETED') {
    await db().from('match_payment').update({ status: 'CANCELED' }).eq('id', id).in('status', ['PENDING', 'OVERDUE']);
  }
};

export const POST = handle(async request => {
  if (!tokenOk(request.headers.get('asaas-access-token'))) throw new HttpError(401, 'Token inválido.');
  const body = await readJson<{ id?: string; event: string; payment?: AsaasPayment }>(request);
  const payment = body.payment;
  if (!payment) return json({ ok: true, ignored: true });

  // Idempotência: o Asaas reenvia eventos até receber 200
  const eventId = body.id || `${body.event}:${payment.id}:${payment.status}`;
  const { error: dupErr } = await db().from('billing_event').insert([{ id: eventId, event: body.event, payment_id: payment.id, payload: body }]);
  if (dupErr) {
    if ((dupErr as any).code === '23505') return json({ ok: true, duplicate: true });
    throw dupErr;
  }

  try {
    if (payment.subscription) await handleSubscriptionPayment(body.event, payment);
    else if ((payment.externalReference || '').startsWith('match_payment:')) await handleMatchPayment(body.event, payment);
  } catch (err) {
    // Libera o evento para ser reprocessado na próxima tentativa do Asaas
    await db().from('billing_event').delete().eq('id', eventId);
    throw err;
  }
  return json({ ok: true });
});
