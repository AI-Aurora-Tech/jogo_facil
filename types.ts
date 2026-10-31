
export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  FIELD_OWNER = 'FIELD_OWNER',
  TEAM_CAPTAIN = 'TEAM_CAPTAIN'
}

export enum SubscriptionPlan {
  NONE = 'NONE',
  FREE = 'FREE',
  PRO_FIELD = 'PRO_FIELD',
  PRO_TEAM = 'PRO_TEAM'
}

// NORMAL / FESTIVAL / AMISTOSO. 'ALUGUEL' e 'FIXO' são valores antigos e contam como NORMAL.
export type MatchType = 'NORMAL' | 'AMISTOSO' | 'FESTIVAL' | 'ALUGUEL' | 'FIXO';
export type Gender = 'MASCULINO' | 'FEMININO' | 'MISTO';

export interface TeamConfig {
  name: string;
  categories: string[];
  logoUrl?: string;
  gender: Gender;
  sport: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phoneNumber: string;
  role: UserRole;
  subscription: SubscriptionPlan;
  subscriptionExpiry: string | null;
  teams: TeamConfig[];
  latitude?: number;
  longitude?: number;
  teamRating?: number;
  teamRatingCount?: number;
  fieldId?: string;
  createdAt: string; // ISO 8601 date string
  isSubscribed?: boolean;
  subscriptionId?: string;
  /** FREE | ACTIVE | PENDING | OVERDUE | CANCELED (mensalidade por categoria) */
  billingStatus?: string;
  billingValue?: number;
  cpfCnpj?: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info';
  read: boolean;
}

export interface TutorialVideo {
  id: string;
  title: string;
  videoUrl: string;
  createdAt: string;
}

export interface Field {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  hourlyRate: number;
  cancellationFeePercent: number;
  pixConfig: { key: string; name: string; bank?: string };
  imageUrl: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  courts: string[];
  complement?: string;
  payoutStatus?: string;
  ratingAvg?: number;
  ratingCount?: number;
}

// Fluxo: available -> waiting_opponent -> pending_home_approval -> pending_payment -> pending_field_approval -> confirmed -> finished
// (ver shared/matchRules.ts). 'pending_verification' é do fluxo antigo de comprovante PIX.
export type MatchStatus = 'available' | 'pending_home_approval' | 'pending_field_approval' | 'pending_payment' | 'pending_verification' | 'confirmed' | 'finished' | 'rejected' | 'waiting_opponent';

export interface MatchSlot {
  id: string;
  fieldId: string;
  date: string;
  time: string;
  durationMinutes: number;
  matchType: MatchType;
  homeTeamType: 'LOCAL' | 'MENSALISTA' | 'OUTSIDE';
  isBooked: boolean;
  hasLocalTeam: boolean;
  localTeamName?: string;
  localTeamCategory?: string;
  localTeamPhone?: string;
  localTeamLogoUrl?: string;
  localTeamGender?: Gender;
  bookedByUserId?: string;
  bookedByTeamName?: string;
  bookedByTeamCategory?: string;
  bookedByTeamLogoUrl?: string;
  bookedByTeamGender?: Gender;
  bookedByUserPhone?: string;
  opponentTeamName?: string;
  opponentTeamCategory?: string;
  opponentTeamPhone?: string;
  opponentTeamLogoUrl?: string;
  opponentTeamGender?: Gender;
  allowedOpponentCategories: string[];
  allowedOpponentGenders: Gender[];
  status: MatchStatus;
  price: number;
  receiptUrl?: string;
  receiptUploadedAt?: string;
  fieldRating?: number;
  courtName?: string;
  sport: string;
  pixKey?: string;
  prizeDescription?: string;
  homeTeamUserId?: string;
  /** Time da casa/mensalista cadastrado no campo que é o mandante deste horário. */
  homeTeamId?: string;
  /** Jogo em local próprio do mandante (sem campo no app): endereço digitado pelo time. */
  customLocation?: string;
  opponentUserId?: string;
  firstTeamPaid?: boolean;
  opponentPaid?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  resultSetAt?: string;
  fieldDecisionReason?: string;
}

export interface MatchPaymentInfo {
  id: string;
  role: 'FIRST' | 'OPPONENT';
  teamName?: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELED' | 'OVERDUE';
  paidAt?: string;
  invoiceUrl?: string;
  pixPayload?: string;
  pixQrBase64?: string;
  pixExpiresAt?: string;
}

export interface InvitePreview {
  token: string;
  open: boolean;
  slotId: string;
  date: string;
  time: string;
  durationMinutes: number;
  sport: string;
  courtName?: string;
  matchKind: 'NORMAL' | 'FESTIVAL' | 'AMISTOSO';
  matchKindLabel: string;
  prizeDescription?: string;
  homeTeamName: string;
  homeTeamLogoUrl?: string;
  category?: string;
  allowedCategories: string[];
  allowedGenders: string[];
  opponentShare: number;
  field: { id: string; name: string; location: string; imageUrl?: string; ratingAvg: number; ratingCount: number };
}

/** Time do campo: mensalista (dia/horário fixos) ou time da casa. */
export type HomeTeamKind = 'MENSALISTA' | 'LOCAL';

/** Dados públicos do convite de time (mensalista ou time da casa). */
export interface TeamInvitePreview {
  token: string;
  kind: HomeTeamKind;
  open: boolean;
  teamName: string;
  fixedDay: number | null;
  fixedTime: string | null;
  durationMinutes: number;
  courtName?: string | null;
  sport: string;
  gender?: string | null;
  field: { id: string; name: string; location: string; imageUrl?: string };
}

/** Lugar do jogo (campo do app ou local próprio do mandante). */
export interface GamePlace {
  name: string;
  location: string | null;
  imageUrl?: string | null;
}

export interface AgendaHomeGame {
  slotId: string;
  teamName?: string;
  date: string;
  time: string;
  durationMinutes: number;
  category: string | null;
  allowedCategories: string[];
  sport: string;
  matchType: string;
  opponentShare: number;
  place: GamePlace;
}

export interface AgendaAvailability {
  id: string;
  teamName: string;
  category: string;
  gender?: string | null;
  sport?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

/** Página pública do link exclusivo de um time. */
export interface PublicAgenda {
  token: string;
  ownerUserId: string;
  team: { name: string; logoUrl: string | null; categories: string[]; gender: string | null; sport: string };
  homeGames: AgendaHomeGame[];
  awayAvailability: AgendaAvailability[];
}

export interface AgendaInvite {
  inviteId: string;
  slotId: string;
  teamName: string;
  category: string;
  homeTeamName: string;
  date: string;
  time: string;
  opponentShare: number;
  place: GamePlace;
}

/** Agenda do próprio time (logado). */
export interface MyAgenda {
  homeGames: AgendaHomeGame[];
  availability: AgendaAvailability[];
  invites: AgendaInvite[];
}

export interface RegisteredTeam {
  id: string;
  kind: HomeTeamKind;
  name: string;
  fieldId: string;
  fixedDay: string;
  fixedTime: string;
  fixedDurationMinutes?: number;
  categories: string[];
  logoUrl?: string;
  createdAt: string;
  captainName?: string;
  captainPhone?: string;
  captainUserId?: string;
  email?: string;
  gender: Gender;
  sport: string;
  courtName: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'active' | 'inactive';
  rejectionReason?: string;
  updatedAt?: string;
  processedBy?: string;
}

export const CATEGORY_ORDER = [
  "Sub-8", "Sub-9", "Sub-10", "Sub-11", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-16", "Sub-17", 
  "Sport", "35+", "40+", "45+", "50+", "60+", "70+"
];

export const SPORTS = ["Futebol", "Society", "Vôlei", "Beach Tennis", "Tênis", "Basquete", "Handball"];

/**
 * Interface representing the result of a PIX receipt verification processed by AI.
 */
export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}

/**
 * Interface representing a pending update request for users or field entities.
 */
export interface PendingUpdate {
  id: string;
  requesterId: string;
  targetId: string;
  entityType: 'field' | 'slot' | 'user';
  jsonData: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
