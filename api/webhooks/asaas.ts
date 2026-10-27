import { timingSafeEqual } from 'node:crypto';
import { handle, json, readJson, HttpError } from '../_lib/http.js';
import { db } from '../_lib/supabaseAdmin.js';
import { env } from '../_lib/env.js';
import { markPaymentPaid } from '../_lib/payments.js';
import { asaas, PAID_STATUSES, type AsaasPayment } from '../_lib/asaas.js';

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

/**
 * A mensalidade dos donos de time não existe mais. Se ainda chegar evento de uma
 * assinatura antiga, cancela a assinatura no Asaas e volta a conta para grátis.
 */
const cancelLegacySubscription = async (payment: AsaasPayment) => {
  try {
    await asaas.cancelSubscription(payment.subscription!);
  } catch (e) {
    console.warn('[webhook] não consegui cancelar a assinatura antiga', payment.subscription, e);
  }
  await db()
    .from('user')
    .update({ asaas_subscription_id: null, billing_status: 'FREE', billing_value: 0, billing_updated_at: new Date().toISOString() })
    .eq('asaas_subscription_id', payment.subscription);
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
    if (payment.subscription) await cancelLegacySubscription(payment);
    else if ((payment.externalReference || '').startsWith('match_payment:')) await handleMatchPayment(body.event, payment);
  } catch (err) {
    // Libera o evento para ser reprocessado na próxima tentativa do Asaas
    await db().from('billing_event').delete().eq('id', eventId);
    throw err;
  }
  return json({ ok: true });
});
