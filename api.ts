import { supabase } from './supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam, PendingUpdate, UserRole, InAppNotification, SubscriptionPlan, TutorialVideo, MatchPaymentInfo, InvitePreview } from './types';

const SESSION_TOKEN_KEY = 'jf_session_token';
const USER_COLUMNS = 'id, email, name, phone_number, role, subscription, subscription_expiry, teams, latitude, longitude, team_rating, team_rating_count, is_subscribed, subscription_id, created_at, billing_status, billing_value, cpf_cnpj';

export const sessionToken = {
  get: (): string | null => {
    try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch { return null; }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
      else localStorage.removeItem(SESSION_TOKEN_KEY);
    } catch { /* navegador sem storage */ }
  },
};

/** Erro vindo das funções do servidor (/api). `code` ajuda a tela a reagir (ex.: NEED_CPF). */
export class ServerError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Admin geral acessando outra conta: as ações vão em nome dela. */
let actAsUserId: string | null = null;
export const setActAsUser = (id: string | null) => { actAsUserId = id; };

const callServer = async <T = any>(path: string, body?: Record<string, unknown>, method: 'POST' | 'GET' = 'POST'): Promise<T> => {
  const token = sessionToken.get();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: method === 'POST' ? JSON.stringify({ ...(body || {}), ...(actAsUserId ? { actAsUserId } : {}) }) : undefined,
    });
  } catch {
    throw new ServerError('Sem conexão com o servidor. Verifique sua internet.', 0, 'NETWORK');
  }
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  if (res.ok && !isJson) {
    // Ex.: "npm run dev" devolve o index.html para /api/* porque as funções da Vercel não rodam
    throw new ServerError('Servidor indisponível. (Em desenvolvimento, rode com "vercel dev".)', 404, 'NO_SERVER');
  }
  if (!res.ok) {
    if (data.code === 'SESSION_EXPIRED') {
      try { window.dispatchEvent(new Event('jf:session-expired')); } catch { /* fora do navegador */ }
    }
    if (res.status === 404 && !data.error) {
      throw new ServerError('Servidor indisponível. (Em desenvolvimento, rode com "vercel dev".)', 404, 'NO_SERVER');
    }
    throw new ServerError(data.error || 'Erro no servidor.', res.status, data.code);
  }
  return data as T;
};

const mapSlotFromDb = (s: any): MatchSlot => ({
  id: s.id,
  fieldId: s.field_id,
  date: s.date,
  time: typeof s.time === 'string' ? s.time.slice(0, 5) : s.time,
  durationMinutes: s.duration_minutes,
  matchType: s.match_type,
  isBooked: s.is_booked,
  hasLocalTeam: s.has_local_team,
  localTeamName: s.local_team_name,
  localTeamCategory: s.local_team_category,
  localTeamPhone: s.local_team_phone,
  localTeamLogoUrl: s.local_team_logo_url,
  localTeamGender: s.local_team_gender,
  bookedByUserId: s.booked_by_user_id,
  bookedByTeamName: s.booked_by_team_name,
  bookedByTeamCategory: s.booked_by_category,
  bookedByTeamLogoUrl: s.booked_by_team_logo_url,
  bookedByTeamGender: s.booked_by_team_gender,
  bookedByUserPhone: s.booked_by_user_phone,
  opponentTeamName: s.opponent_team_name,
  opponentTeamCategory: s.opponent_team_category,
  opponentTeamPhone: s.opponent_team_phone,
  opponentTeamLogoUrl: s.opponent_team_logo_url,
  opponentTeamGender: s.opponent_team_gender,
  status: s.status,
  price: Number(s.price) || 0,
  allowedOpponentCategories: s.allowed_opponent_categories || [],
  allowedOpponentGenders: s.allowed_opponent_genders || [],
  receiptUrl: s.receipt_url,
  receiptUploadedAt: s.receipt_uploaded_at,
  courtName: s.court_name,
  sport: s.sport,
  homeTeamType: s.home_team_type || 'OUTSIDE',
  pixKey: s.pix_key,
  prizeDescription: s.prize_description,
  homeTeamUserId: s.home_team_user_id,
  opponentUserId: s.opponent_user_id,
  firstTeamPaid: !!s.first_team_paid,
  opponentPaid: !!s.opponent_paid,
  homeScore: s.home_score,
  awayScore: s.away_score,
  resultSetAt: s.result_set_at,
  fieldDecisionReason: s.field_decision_reason,
});

const mapFieldFromDb = (f: any): Field => ({
  id: f.id,
  ownerId: f.owner_id,
  name: f.name,
  location: f.location,
  hourlyRate: f.hourly_rate,
  cancellationFeePercent: f.cancellation_fee_percent,
  pixConfig: { key: f.pix_key || '', name: (f.pix_name || '').split('|')[0]?.trim() || '', bank: (f.pix_name || '').split('|')[1]?.trim() || '' },
  imageUrl: f.image_url,
  contactPhone: f.contact_phone,
  latitude: Number(f.latitude) || 0,
  longitude: Number(f.longitude) || 0,
  courts: f.courts || ['Principal'],
  complement: f.complement,
  payoutStatus: f.payout_status || 'NONE',
  ratingAvg: Number(f.rating_avg) || 0,
  ratingCount: f.rating_count || 0,
});

function normalizeSport(sport: string): string {
  return sport.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

const mapUserFromDb = (u: any): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phoneNumber: u.phone_number,
  role: u.role,
  subscription: u.subscription,
  subscriptionExpiry: u.subscription_expiry,
  teams: u.teams || [], 
  latitude: u.latitude,
  longitude: u.longitude,
  teamRating: u.team_rating,
  teamRatingCount: u.team_rating_count,
  password: u.password || undefined, // Password may be missing if using secure RPC
  createdAt: u.created_at,
  isSubscribed: u.role === UserRole.FIELD_OWNER || u.is_subscribed || u.subscription === SubscriptionPlan.PRO_TEAM || u.subscription === SubscriptionPlan.PRO_FIELD,
  subscriptionId: u.subscription_id,
  billingStatus: u.billing_status || undefined,
  billingValue: u.billing_value != null ? Number(u.billing_value) : undefined,
  cpfCnpj: u.cpf_cnpj || undefined,
});

export type MatchAction = 'book' | 'apply' | 'team_decision' | 'payment_status' | 'field_decision' | 'cancel' | 'set_result' | 'rate' | 'my_ratings';

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();

    // Login pelo servidor: devolve a sessão usada nas ações de partida/pagamento
    try {
      const { user, token } = await callServer<{ user: any; token: string }>('/api/auth/login', { email: normalizedEmail, password });
      sessionToken.set(token);
      return mapUserFromDb(user);
    } catch (err: any) {
      if (!(err instanceof ServerError) || (err.code !== 'NO_SERVER' && err.code !== 'NETWORK' && err.status < 500)) throw err;
      console.warn('Servidor /api indisponível, entrando sem sessão (ações de partida ficarão bloqueadas).');
    }
    
    // Usando a função RPC segura para evitar expor a senha no front-end
    const { data: user, error } = await supabase.rpc('login_user', {
      p_email: normalizedEmail,
      p_password: password
    });

    if (error || !user || (Array.isArray(user) && user.length === 0)) {
       throw new Error('E-mail ou senha incorretos.');
    }
    
    // O RPC retorna um array de resultados
    const userData = Array.isArray(user) ? user[0] : user;
    return mapUserFromDb(userData);
  },

  register: async (userData: any): Promise<User> => {
    const { fieldData, ...userFields } = userData;
    const normalizedEmail = userFields.email.toLowerCase().trim();

    let finalRole = userFields.role;
    // Super Admin check para os e-mails informados
    if (normalizedEmail === 'ai.auroratech@gmail.com' || normalizedEmail === 'pedro@auroratech.com') {
      finalRole = UserRole.SUPER_ADMIN;
    }

    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert([{
        email: normalizedEmail,
        password: userFields.password,
        name: userFields.name,
        phone_number: userFields.phoneNumber,
        role: finalRole,
        subscription: userFields.subscription,
        team_name: userFields.teamName,
        team_categories: userFields.teamCategories,
        team_logo_url: userFields.teamLogoUrl,
        teams: userFields.teams || [],
        created_at: new Date().toISOString()
      }])
      .select(USER_COLUMNS)
      .single();

    if (userError) throw userError;

    if (userData.role === 'FIELD_OWNER' && fieldData) {
      await supabase.from('field').insert([{
        owner_id: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourly_rate: fieldData.hourlyRate || 0,
        contact_phone: fieldData.contactPhone,
        image_url: fieldData.imageUrl || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        complement: fieldData.complement || null,
        pix_key: fieldData.pixKey || null,
        pix_name: fieldData.pixName || null,
        courts: fieldData.courts || ['Principal']
      }]);
    }
    return mapUserFromDb(newUser);
  },

  resetPassword: async (email: string, newPassword: string): Promise<void> => {
     const normalizedEmail = email.toLowerCase().trim();
     const { data: user } = await supabase.from('user').select('id').eq('email', normalizedEmail).single();
     if (!user) throw new Error('E-mail não encontrado.');

     const { error } = await supabase.from('user').update({ password: newPassword }).eq('id', user.id);
     if (error) throw error;
  },

  updateUser: async (user: User): Promise<User> => {
    const firstTeam = user.teams && user.teams.length > 0 ? user.teams[0] : null;
    const payload: any = {
      name: user.name,
      phone_number: user.phoneNumber,
      team_name: firstTeam?.name || '',
      team_categories: firstTeam?.categories || [],
      team_logo_url: firstTeam?.logoUrl || '',
      teams: user.teams
    };
    if (user.password && user.password.trim() !== '') {
        payload.password = user.password;
    }

    const { data, error } = await supabase
      .from('user')
      .update(payload)
      .eq('id', user.id)
      .select(USER_COLUMNS)
      .single();
    if (error) throw error;
    return mapUserFromDb(data);
  },

  /** Recarrega o usuário logado (ex.: depois de pagar a mensalidade). */
  getUserById: async (userId: string): Promise<User> => {
    const { data, error } = await supabase.from('user').select(USER_COLUMNS).eq('id', userId).single();
    if (error) throw error;
    return mapUserFromDb(data);
  },

  getNotifications: async (userId: string): Promise<InAppNotification[]> => {
    const { data, error } = await supabase.from('notification').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return [];
    return data.map(n => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      description: n.description,
      timestamp: n.created_at,
      type: n.type,
      read: n.read
    }));
  },

  createNotification: async (notification: { userId: string, title: string, description: string, type: 'success' | 'warning' | 'info' }): Promise<void> => {
    await supabase.from('notification').insert([{
      user_id: notification.userId,
      title: notification.title,
      description: notification.description,
      type: notification.type,
      read: false
    }]);
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    await supabase.from('notification').update({ read: true }).eq('id', id);
  },

  getAllUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('user')
      .select(USER_COLUMNS)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapUserFromDb);
  },

  requestUpdate: async (req: Omit<PendingUpdate, 'id' | 'createdAt' | 'status'>): Promise<void> => {
    const { error } = await supabase.from('pending_update').insert([{
      requester_id: req.requesterId,
      target_id: req.targetId,
      entity_type: req.entityType,
      json_data: req.jsonData,
      status: 'pending'
    }]);
    if (error) throw error;
  },

  getPendingUpdatesForTarget: async (targetId: string): Promise<PendingUpdate[]> => {
    const { data, error } = await supabase
      .from('pending_update')
      .select('*')
      .eq('target_id', targetId)
      .eq('status', 'pending');
    if (error) return [];
    return data.map(d => ({
      id: d.id,
      requesterId: d.requester_id,
      targetId: d.target_id,
      entityType: d.entity_type,
      jsonData: d.json_data,
      status: d.status,
      createdAt: d.created_at
    }));
  },

  resolveUpdate: async (updateId: string, status: 'approved' | 'rejected'): Promise<void> => {
    const { error } = await supabase.from('pending_update').update({ status }).eq('id', updateId);
    if (error) throw error;
  },

  getCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase.from('category').select('name').order('name');
    return (error || !data) ? ["Sub-8", "Sub-9", "Veteranos"] : data.map(c => c.name);
  },

  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('field').select('*');
    if (error) throw error;
    return (data || []).map(mapFieldFromDb);
  },

  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.hourlyRate !== undefined) payload.hourly_rate = updates.hourlyRate;
    if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.courts !== undefined) payload.courts = updates.courts;
    if (updates.latitude !== undefined) payload.latitude = updates.latitude;
    if (updates.longitude !== undefined) payload.longitude = updates.longitude;
    if (updates.complement !== undefined) payload.complement = updates.complement;
    if (updates.cancellationFeePercent !== undefined) payload.cancellation_fee_percent = updates.cancellationFeePercent;

    if (updates.pixConfig) {
      payload.pix_key = updates.pixConfig.key;
      payload.pix_name = `${updates.pixConfig.name} | ${updates.pixConfig.bank || ''}`;
    }
    const { data, error } = await supabase.from('field').update(payload).eq('id', fieldId).select().single();
    if (error) throw error;
    return mapFieldFromDb(data);
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('match_slot')
      .select('*')
      .gte('date', today)
      .order('date')
      .order('time');
    if (error) throw error;
    return (data || []).map(mapSlotFromDb);
  },
  
  getSlotsByFieldId: async (fieldId: string, includeHistory: boolean = false): Promise<MatchSlot[]> => {
    let query = supabase
      .from('match_slot')
      .select('*')
      .eq('field_id', fieldId);
    
    if (!includeHistory) {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('date', today);
    }

    const { data, error } = await query.order('date').order('time');
    if (error) throw error;
    return (data || []).map(mapSlotFromDb);
  },

  /** Jogos do time. Com includeHistory, traz também os últimos 90 dias (placar e avaliação). */
  getSlotsForTeam: async (userId: string, teamNames: string[] = [], includeHistory = false): Promise<MatchSlot[]> => {
    const from = new Date(Date.now() - (includeHistory ? 90 : 0) * 86400000).toISOString().split('T')[0];
    
    let query = supabase
      .from('match_slot')
      .select('*')
      .gte('date', from)
      .order('date')
      .order('time');

    if (teamNames.length > 0) {
        const namesList = teamNames.map(n => `"${n.replace(/"/g, '')}"`).join(',');
        const orCondition = `booked_by_user_id.eq.${userId},home_team_user_id.eq.${userId},opponent_user_id.eq.${userId},local_team_name.in.(${namesList}),opponent_team_name.in.(${namesList}),booked_by_team_name.in.(${namesList})`;
        query = query.or(orCondition);
    } else {
        query = query.or(`booked_by_user_id.eq.${userId},home_team_user_id.eq.${userId},opponent_user_id.eq.${userId}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map(mapSlotFromDb);
  },

  getSlotHistory: async (fieldId: string): Promise<MatchSlot[]> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('match_slot')
      .select('*')
      .eq('field_id', fieldId)
      .lt('date', today)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(mapSlotFromDb);
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      duration_minutes: s.durationMinutes,
      match_type: s.matchType || 'NORMAL',
      prize_description: s.prizeDescription || null,
      allowed_opponent_genders: s.allowedOpponentGenders || [],
      is_booked: s.isBooked || false,
      has_local_team: s.hasLocalTeam || false,
      local_team_name: s.localTeamName || null,
      local_team_category: s.localTeamCategory || null,
      local_team_phone: s.localTeamPhone || null,
      local_team_gender: s.localTeamGender || null,
      local_team_logo_url: s.localTeamLogoUrl || null,
      booked_by_user_id: s.bookedByUserId || null,
      booked_by_team_name: s.bookedByTeamName || null,
      booked_by_category: s.bookedByTeamCategory || null,
      booked_by_team_logo_url: s.bookedByTeamLogoUrl || null,
      booked_by_user_phone: s.bookedByUserPhone || null,
      opponent_team_name: s.opponentTeamName || null,
      opponent_team_category: s.opponentTeamCategory || null,
      opponent_team_phone: s.opponentTeamPhone || null,
      opponent_team_logo_url: s.opponentTeamLogoUrl || null,
      opponent_team_gender: s.opponentTeamGender || null,
      price: s.price || 0,
      status: s.status || 'available',
      allowed_opponent_categories: s.allowedOpponentCategories || [],
      court_name: s.courtName,
      sport: s.sport,
      home_team_type: s.homeTeamType || 'OUTSIDE',
      receipt_url: s.receiptUrl || null,
      receipt_uploaded_at: s.receiptUploadedAt || null,
      pix_key: s.pixKey || null
    }));
    const { data, error } = await supabase.from('match_slot').insert(payload).select('*');
    if (error) throw error;
    return (data || []).map(mapSlotFromDb);
  },

  /**
   * Edição do horário pelo dono do campo (data, hora, preço, mandante...).
   * Status, times inscritos, pagamento e placar só mudam pelo servidor: use api.match().
   */
  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.date !== undefined) payload.date = data.date;
    if (data.time !== undefined) payload.time = data.time;
    if (data.durationMinutes !== undefined) payload.duration_minutes = data.durationMinutes;
    if (data.matchType !== undefined) payload.match_type = data.matchType;
    if (data.prizeDescription !== undefined) payload.prize_description = data.prizeDescription || null;
    if (data.hasLocalTeam !== undefined) payload.has_local_team = data.hasLocalTeam;
    if (data.localTeamName !== undefined) payload.local_team_name = data.localTeamName;
    if (data.localTeamCategory !== undefined) payload.local_team_category = data.localTeamCategory;
    if (data.localTeamPhone !== undefined) payload.local_team_phone = data.localTeamPhone;
    if (data.localTeamGender !== undefined) payload.local_team_gender = data.localTeamGender;
    if (data.localTeamLogoUrl !== undefined) payload.local_team_logo_url = data.localTeamLogoUrl;
    if (data.homeTeamType !== undefined) payload.home_team_type = data.homeTeamType;
    if (data.price !== undefined) payload.price = data.price;
    if (data.courtName !== undefined) payload.court_name = data.courtName;
    if (data.sport !== undefined) payload.sport = data.sport;
    if (data.allowedOpponentCategories !== undefined) payload.allowed_opponent_categories = data.allowedOpponentCategories;
    if (data.allowedOpponentGenders !== undefined) payload.allowed_opponent_genders = data.allowedOpponentGenders;
    if (data.pixKey !== undefined) payload.pix_key = data.pixKey;
    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from('match_slot').update(payload).eq('id', slotId);
    if (error) throw error;
  },

  // ------------------------------------------------------------------
  // Ações no servidor (/api): fluxo da partida, pagamentos, convites
  // ------------------------------------------------------------------

  /** Executa uma etapa do fluxo da partida no servidor. */
  match: <T = { message?: string }>(action: MatchAction, slotId: string, params: Record<string, unknown> = {}) =>
    callServer<T>('/api/matches', { action, slotId, ...params }),

  payMatch: (slotId: string, cpfCnpj?: string) =>
    callServer<{ payment: MatchPaymentInfo }>('/api/matches', { action: 'pay', slotId, cpfCnpj }),

  matchPayments: async (slotId: string) => {
    const res = await callServer<{ slot: any; payments: MatchPaymentInfo[] }>('/api/matches', { action: 'payment_status', slotId });
    return { slot: mapSlotFromDb(res.slot), payments: res.payments };
  },

  createInvite: (slotId: string) => callServer<{ token: string; url: string; message: string }>('/api/invites', { slotId }),

  getInvite: (token: string) => callServer<InvitePreview>(`/api/invites?token=${encodeURIComponent(token)}`, undefined, 'GET'),

  billing: (action: 'status' | 'subscribe' | 'sync', params: Record<string, unknown> = {}) =>
    callServer<{ categories: number; value: number; billingStatus: string; invoiceUrl?: string | null; hasCpf?: boolean }>('/api/billing', { action, ...params }),

  payouts: (action: 'status' | 'set_wallet' | 'create_account', fieldId: string, params: Record<string, unknown> = {}) =>
    callServer<{ payoutStatus: string; hasWallet: boolean; walletIdEnd?: string | null; platformFeePercent?: number; message?: string }>('/api/payouts', { action, fieldId, ...params }),

  getWhatsAppLink: (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  },

  uploadFile: async (bucket: string, path: string, base64Data: string): Promise<string> => {
    // Remove prefix if present (e.g., "data:image/png;base64,")
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  },

  deleteSlot: async (slotId: string): Promise<void> => {
    await supabase.from('match_slot').delete().eq('id', slotId);
  },

  getRegisteredTeams: async (fieldId: string): Promise<RegisteredTeam[]> => {
    const { data } = await supabase.from('registered_team').select('*').eq('field_id', fieldId);
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      fieldId: t.field_id,
      fixedDay: t.fixed_day,
      fixedTime: t.fixed_time,
      fixedDurationMinutes: t.fixed_duration_minutes,
      categories: t.categories,
      logoUrl: t.logo_url,
      createdAt: t.created_at,
      captainName: t.captain_name,
      captainPhone: t.captain_phone,
      captainUserId: t.captain_user_id,
      email: t.email,
      gender: t.gender,
      sport: t.sport,
      courtName: t.court_name,
      status: t.status || 'pending',
      rejectionReason: t.rejection_reason
    }));
  },

  getRegisteredTeamsForCaptain: async (phone: string): Promise<RegisteredTeam[]> => {
    const { data } = await supabase.from('registered_team').select('*').eq('captain_phone', phone);
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      fieldId: t.field_id,
      fixedDay: t.fixed_day,
      fixedTime: t.fixed_time,
      fixedDurationMinutes: t.fixed_duration_minutes,
      categories: t.categories,
      logoUrl: t.logo_url,
      createdAt: t.created_at,
      captainName: t.captain_name,
      captainPhone: t.captain_phone,
      captainUserId: t.captain_user_id,
      email: t.email,
      gender: t.gender,
      sport: t.sport,
      courtName: t.court_name,
      status: t.status || 'pending',
      rejectionReason: t.rejection_reason
    }));
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<RegisteredTeam> => {
    const { data, error } = await supabase.from('registered_team').insert([{
      field_id: team.fieldId,
      name: team.name,
      fixed_day: parseInt(team.fixedDay || '0') || 0,
      fixed_time: team.fixedTime,
      fixed_duration_minutes: team.fixedDurationMinutes,
      categories: team.categories,
      logo_url: team.logoUrl,
      captain_name: team.captainName,
      captain_phone: team.captainPhone,
      captain_user_id: team.captainUserId || null,
      email: team.email,
      gender: team.gender,
      sport: team.sport ? normalizeSport(team.sport) : 'FUTEBOL',
      court_name: team.courtName,
      status: team.status || 'pending'
    }]).select().single();

    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      fieldId: data.field_id,
      fixedDay: data.fixed_day,
      fixedTime: data.fixed_time,
      fixedDurationMinutes: data.fixed_duration_minutes,
      categories: data.categories,
      logoUrl: data.logo_url,
      createdAt: data.created_at,
      captainName: data.captain_name,
      captainPhone: data.captain_phone,
      email: data.email,
      gender: data.gender,
      sport: data.sport,
      courtName: data.court_name,
      status: data.status,
      rejectionReason: data.rejection_reason,
      updatedAt: data.updated_at,
      processedBy: data.processed_by
    };
  },

  updateRegisteredTeam: async (teamId: string, updates: Partial<RegisteredTeam>): Promise<void> => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.fixedDay !== undefined) payload.fixed_day = parseInt(updates.fixedDay || '0') || 0;
    if (updates.fixedTime !== undefined) payload.fixed_time = updates.fixedTime;
    if (updates.fixedDurationMinutes !== undefined) payload.fixed_duration_minutes = updates.fixedDurationMinutes;
    if (updates.categories !== undefined) payload.categories = updates.categories;
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
    if (updates.captainName !== undefined) payload.captain_name = updates.captainName;
    if (updates.captainPhone !== undefined) payload.captain_phone = updates.captainPhone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.sport !== undefined) payload.sport = normalizeSport(updates.sport);
    if (updates.courtName !== undefined) payload.court_name = updates.courtName;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.rejectionReason !== undefined) payload.rejection_reason = updates.rejectionReason;
    
    await supabase.from('registered_team').update(payload).eq('id', teamId);
  },

  deleteRegisteredTeam: async (id: string): Promise<void> => {
    await supabase.from('registered_team').delete().eq('id', id);
  },



  adminUpdatePassword: async (userId: string, newPassword: string): Promise<void> => {
    const { error } = await supabase.from('user').update({ password: newPassword }).eq('id', userId);
    if (error) throw error;
  },

  getTutorialVideos: async (): Promise<TutorialVideo[]> => {
    const { data, error } = await supabase.from('tutorial_video').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(v => ({
      id: v.id,
      title: v.title,
      videoUrl: v.video_url,
      createdAt: v.created_at
    }));
  },

  createTutorialVideo: async (title: string, videoUrl: string): Promise<void> => {
    const { error } = await supabase.from('tutorial_video').insert([{
      title,
      video_url: videoUrl
    }]);
    if (error) throw error;
  },

  uploadTutorialVideo: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('videos').getPublicUrl(filePath);
    return data.publicUrl;
  },

  deleteTutorialVideo: async (id: string): Promise<void> => {
    const { error } = await supabase.from('tutorial_video').delete().eq('id', id);
    if (error) throw error;
  }
};