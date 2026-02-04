
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
}

export interface MatchSlot {
  id: string;
  fieldId: string;
  date: string;
  time: string;
  durationMinutes: number;
  matchType: MatchType;
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
  status: 'available' | 'pending_verification' | 'confirmed';
  price: number;
  receiptUrl?: string;
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
  categories: string[];
  logoUrl?: string;
  createdAt: string;
  captainName?: string;
  captainPhone?: string;
  email?: string;
  gender: Gender;
  sport: string;
  courtName: string;
}

/**
 * Result of the AI verification process for payment receipts.
 */
export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}

/**
 * Represents a pending update for administrative approval.
 */
export interface PendingUpdate {
  id: string;
  requesterId: string;
  targetId: string;
  entityType: string;
  jsonData: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export const CATEGORY_ORDER = [
  "Sub-8", "Sub-9", "Sub-10", "Sub-11", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-16", "Sub-17", "Sport", "35+", "40+", "45+", "50+"
];

export const SPORTS = ["Futebol", "Vôlei", "Handball", "Basquete", "Futsal", "Tênis", "Beach Tennis"];
