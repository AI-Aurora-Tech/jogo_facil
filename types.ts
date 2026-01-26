
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

export type MatchType = 'AMISTOSO' | 'FESTIVAL' | 'ALUGUEL' | 'FIXO';

export interface SubTeam {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'success' | 'warning' | 'info';
  read: boolean;
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
  teamName?: string; 
  teamCategories: string[]; 
  teamLogoUrl?: string;
  subTeams: SubTeam[]; 
  latitude?: number;
  longitude?: number;
  teamRating?: number;
  teamRatingCount?: number;
}

export interface PixConfig {
  key: string;
  name: string;
}

export interface RegisteredTeam {
  id: string;
  name: string;
  fieldId: string;
  fixedDay: number; // 0-6 (Sun-Sat)
  fixedTime: string;
  categories: string[];
  logoUrl?: string;
  createdAt: string;
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
  localTeams?: string[]; 
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
  statusUpdatedAt?: string;
  price: number;
  ratingGiven?: number;
  receiptUrl?: string; // URL ou Base64 do comprovante
  aiVerificationResult?: string; // Resultado da análise da Gemini
}

export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}
