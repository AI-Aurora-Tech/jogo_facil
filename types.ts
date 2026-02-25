
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

export type MatchType = 'AMISTOSO' | 'FESTIVAL' | 'ALUGUEL' | 'FIXO';
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
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info';
  read: boolean;
}

export interface Field {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  hourlyRate: number;
  cancellationFeePercent: number;
  pixConfig: { key: string; name: string };
  imageUrl: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  courts: string[];
  complement?: string;
}

export type MatchStatus = 'available' | 'pending_home_approval' | 'pending_field_approval' | 'pending_payment' | 'pending_verification' | 'confirmed' | 'rejected' | 'waiting_opponent';

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
  bookedByUserPhone?: string;
  opponentTeamName?: string;
  opponentTeamCategory?: string;
  opponentTeamPhone?: string;
  opponentTeamLogoUrl?: string;
  opponentTeamGender?: Gender;
  allowedOpponentCategories: string[];
  status: MatchStatus;
  price: number;
  receiptUrl?: string;
  receiptUploadedAt?: string;
  fieldRating?: number;
  courtName?: string;
  sport: string;
}

export interface RegisteredTeam {
  id: string;
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
  email?: string;
  gender: Gender;
  sport: string;
  courtName: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const CATEGORY_ORDER = [
  "Sub-8", "Sub-9", "Sub-10", "Sub-11", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-16", "Sub-17", 
  "Sport", "35+", "40+", "45+", "50+", "60+", "70+"
];

export const SPORTS = ["Futebol", "Society", "Futsal", "Vôlei", "Handball", "Basquete", "Tênis", "Beach Tennis"];

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
