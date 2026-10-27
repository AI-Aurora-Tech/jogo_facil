
export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  FIELD_OWNER = 'FIELD_OWNER',
  TEAM_CAPTAIN = 'TEAM_CAPTAIN'
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
  teams: TeamConfig[];
  latitude?: number;
  longitude?: number;
  teamRating?: number;
  teamRatingCount?: number;
  fieldId?: string;
  createdAt: string; // ISO 8601 date string
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
  imageUrl: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
  courts: string[];
  complement?: string;
  ratingAvg?: number;
  ratingCount?: number;
}

// Fluxo: available -> waiting_opponent -> pending_home_approval -> pending_field_approval -> confirmed -> finished
// (ver shared/matchRules.ts). 'pending_payment' e 'pending_verification' são legados (o app é gratuito)
// e contam como "aguardando aprovação do campo".
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
  fieldRating?: number;
  courtName?: string;
  sport: string;
  prizeDescription?: string;
  homeTeamUserId?: string;
  opponentUserId?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  resultSetAt?: string;
  fieldDecisionReason?: string;
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
  field: { id: string; name: string; location: string; imageUrl?: string; ratingAvg: number; ratingCount: number };
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
