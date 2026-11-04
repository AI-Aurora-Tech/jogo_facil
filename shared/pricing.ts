/**
 * Mensalidade dos donos de time.
 *
 * - Donos de campo: grátis.
 * - Donos de time: 30 dias grátis (contados pelo app, a partir do cadastro) e depois
 *   R$ 19,99 por mês, qualquer que seja a quantidade de times e categorias.
 *
 * Arquivo sem dependências: é usado pelo app (navegador) e pelas funções da Vercel.
 */

export const MONTHLY_PRICE = 19.99;
export const TRIAL_DAYS = 30;

export interface BillingLike {
  role?: string | null;
  /** Fim do teste grátis (ISO). */
  trialEndsAt?: string | null;
  billingStatus?: string | null;
}

const DAY_MS = 86_400_000;

/** Dias de teste grátis que ainda restam (0 quando acabou ou não há data). */
export const trialDaysLeft = (trialEndsAt: string | null | undefined, now: Date = new Date()): number => {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS));
};

export const isTrialActive = (trialEndsAt: string | null | undefined, now: Date = new Date()): boolean =>
  trialDaysLeft(trialEndsAt, now) > 0;

/** O dono de time pode usar o app? (teste grátis em andamento ou assinatura ativa) */
export const hasTeamAccess = (u: BillingLike, now: Date = new Date()): boolean =>
  u.role !== 'TEAM_CAPTAIN' || isTrialActive(u.trialEndsAt, now) || u.billingStatus === 'ACTIVE';

export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
