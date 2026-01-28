
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

export interface PendingUpdate {
  id: string;
  requesterId: string;
  targetId: string;
  entityType: 'USER' | 'FIELD';
  jsonData: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SubTeam {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
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
  fixedDay: number; // 0-6 (Dom-Sab)
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
  isBooked: boolean;
  hasLocalTeam: boolean;
  localTeamName?: string;
  localTeamPhone?: string;
  bookedByUserId?: string;
  bookedByTeamName?: string;
  bookedByUserPhone?: string;
  bookedByCategory?: string;
  opponentTeamName?: string;
  opponentTeamCategory?: string;
  opponentTeamPhone?: string;
  rewardDescription?: string;
  status: 'available' | 'pending_verification' | 'confirmed';
  price: number;
  allowedCategories: string[]; 
  receiptUrl?: string;
  aiVerificationResult?: string;
  ratingGiven?: number; // Avaliação do time dada pelo dono do campo
  fieldRating?: number; // Nota da arena dada pelo time (0-5)
  fieldRatingComment?: string;
}

export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}
