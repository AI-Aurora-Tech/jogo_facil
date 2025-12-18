
export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN',
  FIELD_OWNER = 'FIELD_OWNER',
  TEAM_CAPTAIN = 'TEAM_CAPTAIN'
}

export enum SubscriptionPlan {
  NONE = 'NONE',
  FREE = 'FREE',
  PRO_FIELD = 'PRO_FIELD',
  PRO_TEAM = 'PRO_TEAM'
}

export type MatchType = 'AMISTOSO' | 'FESTIVAL' | 'ALUGUEL';

export interface SubTeam {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
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
  subTeams: SubTeam[]; 
  latitude?: number;
  longitude?: number;
}

export interface PixConfig {
  key: string;
  name: string;
}

export interface Field {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  hourlyRate: number;
  cancellationFeePercent: number;
  pixConfig: PixConfig;
  imageUrl: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
}

export interface MatchSlot {
  id: string;
  fieldId: string;
  date: string;
  time: string;
  durationMinutes: number;
  matchType: MatchType;
  customImageUrl?: string;
  isBooked: boolean;
  hasLocalTeam: boolean;
  localTeamName?: string; 
  allowedCategories: string[];
  bookedByTeamName?: string; 
  bookedByUserId?: string;
  bookedByPhone?: string;
  bookedByCategory?: string; 
  opponentTeamName?: string;
  opponentTeamPhone?: string;
  status: 'available' | 'pending_verification' | 'confirmed';
  statusUpdatedAt?: string; // Novo: para rastrear expiração
  price: number;
}

export const COMMON_CATEGORIES = ["Sub-09", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Principal", "Veteranos", "Feminino"];

export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}
