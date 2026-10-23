import { env, requireEnv } from './env.js';
import { HttpError } from './http.js';

/**
 * Cliente mínimo da API v3 do Asaas.
 * Docs: https://docs.asaas.com/reference
 */

const baseUrl = () =>
  process.env.ASAAS_BASE_URL || // só para testes locais
  (env.asaasEnv() === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');

export const asaasConfigured = () => !!env.asaasApiKey();

const request = async <T = any>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'JogoFacil/1.0',
      access_token: requireEnv('ASAAS_API_KEY', env.asaasApiKey()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const description = data?.errors?.map((e: any) => e.description).join(' ') || `Asaas respondeu ${res.status}`;
    console.error('[asaas]', method, path, res.status, text);
    throw new HttpError(502, `Pagamento: ${description}`, 'ASAAS_ERROR');
  }
  return data as T;
};

export interface AsaasPayment {
  id: string;
  status: string; // PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, RECEIVED_IN_CASH, ...
  value: number;
  netValue?: number;
  invoiceUrl?: string;
  dueDate?: string;
  externalReference?: string;
  subscription?: string;
  customer?: string;
}

export const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

const onlyDigits = (v?: string | null) => (v || '').replace(/\D/g, '');

/** Data de hoje (fuso de Brasília) + N dias, no formato YYYY-MM-DD. */
export const dueDate = (daysFromToday = 0) => {
  const now = new Date(Date.now() - 3 * 3600_000 + daysFromToday * 86400_000);
  return now.toISOString().slice(0, 10);
};

export const asaas = {
  createCustomer: (p: { name: string; cpfCnpj: string; email?: string; mobilePhone?: string | null; externalReference: string }) =>
    request<{ id: string }>('POST', '/customers', {
      name: p.name,
      cpfCnpj: onlyDigits(p.cpfCnpj),
      email: p.email,
      mobilePhone: onlyDigits(p.mobilePhone) || undefined,
      externalReference: p.externalReference,
      notificationDisabled: true,
    }),

  updateCustomer: (id: string, p: { cpfCnpj?: string; name?: string }) =>
    request('POST', `/customers/${id}`, { ...p, cpfCnpj: p.cpfCnpj ? onlyDigits(p.cpfCnpj) : undefined }),

  /** Cobrança PIX com split automático para a carteira do dono do campo. */
  createPixPayment: (p: {
    customer: string;
    value: number;
    description: string;
    externalReference: string;
    dueDate: string;
    split?: { walletId: string; percentualValue: number }[];
  }) =>
    request<AsaasPayment>('POST', '/payments', {
      customer: p.customer,
      billingType: 'PIX',
      value: p.value,
      dueDate: p.dueDate,
      description: p.description,
      externalReference: p.externalReference,
      split: p.split,
    }),

  getPayment: (id: string) => request<AsaasPayment>('GET', `/payments/${id}`),

  getPixQrCode: (id: string) =>
    request<{ encodedImage: string; payload: string; expirationDate?: string }>('GET', `/payments/${id}/pixQrCode`),

  refundPayment: (id: string, description?: string) =>
    request<AsaasPayment>('POST', `/payments/${id}/refund`, { description }),

  deletePayment: (id: string) => request('DELETE', `/payments/${id}`),

  /** Assinatura mensal. billingType UNDEFINED deixa o cliente escolher PIX, boleto ou cartão. */
  createSubscription: (p: { customer: string; value: number; description: string; externalReference: string; nextDueDate: string }) =>
    request<{ id: string; status: string }>('POST', '/subscriptions', {
      customer: p.customer,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      value: p.value,
      nextDueDate: p.nextDueDate,
      description: p.description,
      externalReference: p.externalReference,
    }),

  updateSubscriptionValue: (id: string, value: number, description: string) =>
    request('POST', `/subscriptions/${id}`, { value, description, updatePendingPayments: true }),

  getSubscription: (id: string) => request<{ id: string; status: string; value: number; deleted?: boolean }>('GET', `/subscriptions/${id}`),

  cancelSubscription: (id: string) => request('DELETE', `/subscriptions/${id}`),

  listSubscriptionPayments: (id: string) =>
    request<{ data: AsaasPayment[] }>('GET', `/subscriptions/${id}/payments?limit=10`),

  /** Subconta (white label) do dono do campo. Retorna o walletId usado no split. */
  createSubaccount: (p: {
    name: string;
    email: string;
    cpfCnpj: string;
    birthDate?: string;
    companyType?: string;
    mobilePhone: string;
    incomeValue: number;
    address: string;
    addressNumber: string;
    province: string;
    postalCode: string;
  }) =>
    request<{ id: string; walletId: string }>('POST', '/accounts', {
      ...p,
      cpfCnpj: onlyDigits(p.cpfCnpj),
      mobilePhone: onlyDigits(p.mobilePhone),
      postalCode: onlyDigits(p.postalCode),
    }),
};
