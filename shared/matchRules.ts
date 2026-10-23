/**
 * Regras do fluxo de partidas (máquina de estados).
 *
 * Arquivo sem dependências: é usado pelo app (navegador) e pelas funções da Vercel,
 * para que a tela e o servidor sempre calculem valores e permissões do mesmo jeito.
 *
 * Fluxo:
 *  available ─(1º time de fora reserva)──────────────┐
 *  (horário com mensalista/time da casa nasce aqui) ─┴─> waiting_opponent
 *  waiting_opponent ─(adversário se inscreve)──> pending_home_approval
 *  pending_home_approval ─(time 1 aprova)──> pending_payment (ou pending_field_approval se amistoso)
 *  pending_payment ─(todos pagaram)──> pending_field_approval
 *  pending_field_approval ─(campo aprova)──> confirmed  |  (campo nega + estorno)──> volta a ficar livre
 *  confirmed ─(2h após o fim, time 1 lança placar)──> finished
 */

export type MatchKind = 'NORMAL' | 'FESTIVAL' | 'AMISTOSO';
export type HomeTeamType = 'LOCAL' | 'MENSALISTA' | 'OUTSIDE';

export type FlowStatus =
  | 'available'
  | 'waiting_opponent'
  | 'pending_home_approval'
  | 'pending_payment'
  | 'pending_field_approval'
  | 'confirmed'
  | 'finished'
  | 'rejected'
  // legado (fluxo antigo de comprovante PIX)
  | 'pending_verification';

export type PayerRole = 'FIRST' | 'OPPONENT';

/** Horário de Brasília (sem horário de verão desde 2019). */
export const BRAZIL_UTC_OFFSET = '-03:00';

/** Quanto tempo depois do fim do jogo o placar e as avaliações são liberados. */
export const RESULT_DELAY_MINUTES = 120;

export interface SlotLike {
  status: string;
  price: number | string | null;
  matchType?: string | null;
  homeTeamType?: string | null;
  hasLocalTeam?: boolean | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM ou HH:MM:SS
  durationMinutes?: number | null;
  bookedByUserId?: string | null;
  homeTeamUserId?: string | null;
  opponentUserId?: string | null;
}

export const normalizeMatchKind = (matchType?: string | null): MatchKind => {
  const t = (matchType || '').toUpperCase();
  if (t === 'AMISTOSO') return 'AMISTOSO';
  if (t === 'FESTIVAL') return 'FESTIVAL';
  return 'NORMAL'; // 'NORMAL', e os legados 'ALUGUEL' e 'FIXO'
};

export const MATCH_KIND_LABEL: Record<MatchKind, string> = {
  NORMAL: 'Partida Normal',
  FESTIVAL: 'Festival',
  AMISTOSO: 'Amistoso',
};

/** Horário tem mensalista ou time da casa (só falta 1 adversário). */
export const hasHomeTeam = (slot: Pick<SlotLike, 'homeTeamType' | 'hasLocalTeam'>): boolean =>
  !!slot.hasLocalTeam && (slot.homeTeamType === 'LOCAL' || slot.homeTeamType === 'MENSALISTA');

/** Amistoso tem taxa R$ 0. Qualquer horário com preço 0 também não gera cobrança. */
export const effectivePrice = (slot: Pick<SlotLike, 'price' | 'matchType'>): number => {
  if (normalizeMatchKind(slot.matchType) === 'AMISTOSO') return 0;
  const p = Number(slot.price) || 0;
  return p > 0 ? Math.round(p * 100) / 100 : 0;
};

export const requiresPayment = (slot: Pick<SlotLike, 'price' | 'matchType'>): boolean =>
  effectivePrice(slot) > 0;

export interface PaymentShare {
  role: PayerRole;
  amount: number;
}

/**
 * Divisão da taxa:
 * - 2 times de fora: 50% para cada (centavo ímpar fica com o adversário).
 * - Mensalista / time da casa: 100% com o adversário.
 */
export const computeShares = (slot: Pick<SlotLike, 'price' | 'matchType' | 'homeTeamType' | 'hasLocalTeam'>): PaymentShare[] => {
  const total = effectivePrice(slot);
  if (total <= 0) return [];
  if (hasHomeTeam(slot)) return [{ role: 'OPPONENT', amount: total }];
  const cents = Math.round(total * 100);
  const first = Math.floor(cents / 2);
  return [
    { role: 'FIRST', amount: first / 100 },
    { role: 'OPPONENT', amount: (cents - first) / 100 },
  ];
};

/** Valor que um time paga, conforme o papel dele no jogo. */
export const shareFor = (slot: Parameters<typeof computeShares>[0], role: PayerRole): number =>
  computeShares(slot).find(s => s.role === role)?.amount ?? 0;

/** Valor exibido para quem vai se inscrever como adversário. */
export const opponentShare = (slot: Parameters<typeof computeShares>[0]): number => shareFor(slot, 'OPPONENT');

/**
 * Quem aprova o adversário:
 * - Mensalista / time da casa: o dono desse time (se não tiver conta no app, o dono do campo).
 * - 2 times de fora: o time que se inscreveu primeiro.
 */
export const opponentApproverId = (slot: SlotLike, fieldOwnerId: string): string | null => {
  if (hasHomeTeam(slot)) return slot.homeTeamUserId || fieldOwnerId;
  return slot.bookedByUserId || null;
};

/** "Time 1": quem lança o placar. Mesmo critério de quem aprova o adversário. */
export const firstTeamUserId = opponentApproverId;

export const statusAfterTeamApproval = (slot: Pick<SlotLike, 'price' | 'matchType'>): FlowStatus =>
  requiresPayment(slot) ? 'pending_payment' : 'pending_field_approval';

const pad = (n: number) => String(n).padStart(2, '0');

/** Início do jogo como Date (UTC), considerando horário de Brasília. */
export const matchStart = (slot: Pick<SlotLike, 'date' | 'time'>): Date => {
  const [h = '0', m = '0'] = (slot.time || '00:00').split(':');
  return new Date(`${slot.date}T${pad(Number(h))}:${pad(Number(m))}:00${BRAZIL_UTC_OFFSET}`);
};

export const matchEnd = (slot: Pick<SlotLike, 'date' | 'time' | 'durationMinutes'>): Date =>
  new Date(matchStart(slot).getTime() + (slot.durationMinutes || 60) * 60_000);

/** Momento a partir do qual o time 1 pode lançar o placar e os times podem avaliar. */
export const resultOpensAt = (slot: Pick<SlotLike, 'date' | 'time' | 'durationMinutes'>): Date =>
  new Date(matchEnd(slot).getTime() + RESULT_DELAY_MINUTES * 60_000);

export const canSetResult = (slot: SlotLike, now: Date = new Date()): boolean =>
  slot.status === 'confirmed' && now.getTime() >= resultOpensAt(slot).getTime();

export const canRate = (slot: SlotLike, now: Date = new Date()): boolean =>
  (slot.status === 'confirmed' || slot.status === 'finished') && now.getTime() >= resultOpensAt(slot).getTime();

/** Dois horários se sobrepõem? (mesmo dia; usado para o conflito de categoria do time) */
export const overlaps = (
  a: Pick<SlotLike, 'date' | 'time' | 'durationMinutes'>,
  b: Pick<SlotLike, 'date' | 'time' | 'durationMinutes'>
): boolean => {
  const aStart = matchStart(a).getTime();
  const aEnd = matchEnd(a).getTime();
  const bStart = matchStart(b).getTime();
  const bEnd = matchEnd(b).getTime();
  return aStart < bEnd && bStart < aEnd;
};

/** Status em que o time já está "comprometido" com aquele horário. */
export const ACTIVE_MATCH_STATUSES: FlowStatus[] = [
  'waiting_opponent',
  'pending_home_approval',
  'pending_payment',
  'pending_field_approval',
  'pending_verification',
  'confirmed',
];

export const STATUS_LABEL: Record<string, string> = {
  available: 'Disponível',
  waiting_opponent: 'Aguardando adversário',
  pending_home_approval: 'Aguardando aprovação do time 1',
  pending_payment: 'Aguardando pagamento',
  pending_field_approval: 'Aguardando aprovação do campo',
  confirmed: 'Jogo confirmado',
  finished: 'Encerrado',
  rejected: 'Recusado',
  pending_verification: 'Aguardando validação do PIX',
};

/** Tags rápidas da avaliação. */
export const TEAM_RATING_TAGS = ['Pontual', 'Fair play', 'Time completo', 'Pagou em dia', 'Atrasou', 'Faltou jogador', 'Jogo violento', 'Desrespeitoso'];
export const FIELD_RATING_TAGS = ['Gramado bom', 'Vestiário limpo', 'Boa iluminação', 'Horário respeitado', 'Gramado ruim', 'Vestiário sujo', 'Iluminação ruim', 'Atrasou o jogo'];
