
export enum UserRole {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN', // You
  FIELD_OWNER = 'FIELD_OWNER',
  TEAM_CAPTAIN = 'TEAM_CAPTAIN'
}

export enum SubscriptionPlan {
  NONE = 'NONE',
  FREE = 'FREE', // Campos não pagam mensalidade
  PRO_FIELD = 'PRO_FIELD', // Deprecated but kept for compatibility
  PRO_TEAM = 'PRO_TEAM' // Times pagam R$ 50,00 fixo
}

export type MatchType = 'AMISTOSO' | 'FESTIVAL' | 'ALUGUEL';

export interface SubTeam {
  id: string;
  name: string;
  category: string; // e.g., "Sub-20", "Principal"
  logoUrl?: string; // Novo: Logo do time
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Stored for "fake" auth simulation
  phoneNumber: string;
  role: UserRole;
  subscription: SubscriptionPlan;
  subscriptionExpiry: string | null;
  // New fields
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
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number; // Nova duração (60, 90, 120)
  matchType: MatchType; // Novo tipo
  customImageUrl?: string; // Novo: Foto do evento/time
  
  isBooked: boolean;
  
  // Host Team Info
  hasLocalTeam: boolean; // Se false = ALUGUEL (2 times de fora)
  localTeamName?: string; 
  allowedCategories: string[]; // e.g., ["Sub-20", "Adulto"]
  
  // Visitor/Booker Info (Time A)
  bookedByTeamName?: string; 
  bookedByUserId?: string;
  bookedByPhone?: string;
  bookedByCategory?: string; 
  
  // Opponent Info (Time B - Apenas se for Aluguel/2 de fora)
  opponentTeamName?: string;
  opponentTeamPhone?: string;

  status: 'available' | 'pending_verification' | 'confirmed';
  price: number;
}

export const COMMON_CATEGORIES = ["Sub-09", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Principal", "Veteranos", "Feminino"];

export interface VerificationResult {
  isValid: boolean;
  amountFound: number | null;
  dateFound: string | null;
  reason: string;
}
