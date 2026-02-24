import { supabase } from './supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam, PendingUpdate, UserRole, Notification } from './types';

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
  password: u.password
});

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();
    const { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('password', password)
      .single();

    if (error || !user) throw new Error('E-mail ou senha incorretos.');
    return mapUserFromDb(user);
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
        teams: userFields.teams || []
      }])
      .select().single();

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
        pix_name: fieldData.pixName || null
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

    const { data, error } = await supabase.from('user').update(payload).eq('id', user.id).select().single();
    if (error) throw error;
    return mapUserFromDb(data);
  },

  confirmProSubscription: async (userId: string, planType: 'PRO_FIELD' | 'PRO_TEAM'): Promise<User> => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 60);

    const { data, error } = await supabase
      .from('user')
      .update({ 
        subscription: planType,
        subscription_expiry: expiry.toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return mapUserFromDb(data);
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
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
    const { data, error } = await supabase.from('user').select('*').order('name');
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
    return (data || []).map(f => ({
        id: f.id,
        ownerId: f.owner_id,
        name: f.name,
        location: f.location,
        hourlyRate: f.hourly_rate,
        cancellationFeePercent: f.cancellation_fee_percent,
        pixConfig: { key: f.pix_key || '', name: f.pix_name || '' },
        imageUrl: f.image_url,
        contactPhone: f.contact_phone,
        latitude: Number(f.latitude) || 0,
        longitude: Number(f.longitude) || 0,
        courts: f.courts || ['Principal'],
        complement: f.complement
    }));
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
      payload.pix_name = updates.pixConfig.name;
    }
    const { data, error } = await supabase.from('field').update(payload).eq('id', fieldId).select().single();
    if (error) throw error;
    return {
        id: data.id,
        ownerId: data.owner_id,
        name: data.name,
        location: data.location,
        hourlyRate: data.hourly_rate,
        cancellationFeePercent: data.cancellation_fee_percent,
        pixConfig: { key: data.pix_key || '', name: data.pix_name || '' },
        imageUrl: data.image_url,
        contactPhone: data.contact_phone,
        latitude: Number(data.latitude) || 0,
        longitude: Number(data.longitude) || 0,
        courts: data.courts || ['Principal'],
        complement: data.complement
    };
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
    return (data || []).map(s => ({
      id: s.id,
      fieldId: s.field_id,
      date: s.date,
      time: s.time,
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
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      opponentTeamLogoUrl: s.opponent_team_logo_url,
      opponentTeamGender: s.opponent_team_gender,
      status: s.status,
      homeTeamType: s.home_team_type || 'LOCAL',
      price: s.price,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      receiptUrl: s.receipt_url,
      receiptUploadedAt: s.receipt_uploaded_at,
      aiVerificationResult: s.ai_verification_result,
      courtName: s.court_name,
      sport: s.sport
    })) as unknown as MatchSlot[];
  },

  getSlotsByFieldId: async (fieldId: string): Promise<MatchSlot[]> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('match_slot')
      .select('*')
      .eq('field_id', fieldId)
      .gte('date', today)
      .order('date')
      .order('time');
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id,
      fieldId: s.field_id,
      date: s.date,
      time: s.time,
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
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      opponentTeamLogoUrl: s.opponent_team_logo_url,
      opponentTeamGender: s.opponent_team_gender,
      status: s.status,
      homeTeamType: s.home_team_type || 'LOCAL',
      price: s.price,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      receiptUrl: s.receipt_url,
      receiptUploadedAt: s.receipt_uploaded_at,
      aiVerificationResult: s.ai_verification_result,
      courtName: s.court_name,
      sport: s.sport
    })) as unknown as MatchSlot[];
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
    return (data || []).map(s => ({
      id: s.id,
      fieldId: s.field_id,
      date: s.date,
      time: s.time,
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
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      opponentTeamLogoUrl: s.opponent_team_logo_url,
      opponentTeamGender: s.opponent_team_gender,
      status: s.status,
      homeTeamType: s.home_team_type || 'LOCAL',
      price: s.price,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      receiptUrl: s.receipt_url,
      receiptUploadedAt: s.receipt_uploaded_at,
      aiVerificationResult: s.ai_verification_result,
      courtName: s.court_name,
      sport: s.sport
    })) as unknown as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      duration_minutes: s.durationMinutes,
      match_type: s.matchType || 'ALUGUEL',
      home_team_type: s.homeTeamType || 'LOCAL',
      is_booked: s.isBooked || false,
      has_local_team: s.hasLocalTeam || false,
      local_team_name: s.localTeamName || null,
      local_team_category: s.localTeamCategory || null,
      local_team_phone: s.localTeamPhone || null,
      local_team_gender: s.localTeamGender || null,
      booked_by_user_id: s.bookedByUserId || null,
      booked_by_team_name: s.bookedByTeamName || null,
      booked_by_category: s.bookedByTeamCategory || null,
      price: s.price,
      status: s.status || 'available',
      allowed_opponent_categories: s.allowedOpponentCategories || [],
      court_name: s.courtName,
      sport: s.sport
    }));
    const { data, error } = await supabase.from('match_slot').insert(payload).select();
    if (error) throw error;
    return data.map(s => ({
      id: s.id,
      fieldId: s.field_id,
      date: s.date,
      time: s.time,
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
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      opponentTeamLogoUrl: s.opponent_team_logo_url,
      opponentTeamGender: s.opponent_team_gender,
      status: s.status,
      homeTeamType: s.home_team_type || 'LOCAL',
      price: s.price,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      receiptUrl: s.receipt_url,
      receiptUploadedAt: s.receipt_uploaded_at,
      aiVerificationResult: s.ai_verification_result,
      courtName: s.court_name,
      sport: s.sport
    })) as unknown as MatchSlot[];
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl !== undefined) payload.receipt_url = data.receiptUrl;
    if (data.receiptUploadedAt !== undefined) payload.receipt_uploaded_at = data.receiptUploadedAt;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.opponentTeamName !== undefined) payload.opponent_team_name = data.opponentTeamName;
    if (data.opponentTeamCategory !== undefined) payload.opponent_team_category = data.opponentTeamCategory;
    if (data.opponentTeamPhone !== undefined) payload.opponent_team_phone = data.opponentTeamPhone;
    if (data.opponentTeamLogoUrl !== undefined) payload.opponent_team_logo_url = data.opponentTeamLogoUrl;
    if (data.opponentTeamGender !== undefined) payload.opponent_team_gender = data.opponentTeamGender;
    if (data.bookedByUserId !== undefined) payload.booked_by_user_id = data.bookedByUserId;
    if (data.bookedByTeamCategory !== undefined) payload.booked_by_category = data.bookedByTeamCategory;
    if (data.homeTeamType !== undefined) payload.home_team_type = data.homeTeamType;
    
    // Missing fields from previous implementation
    if (data.date !== undefined) payload.date = data.date;
    if (data.time !== undefined) payload.time = data.time;
    if (data.durationMinutes !== undefined) payload.duration_minutes = data.durationMinutes;
    if (data.matchType !== undefined) payload.match_type = data.matchType;
    if (data.hasLocalTeam !== undefined) payload.has_local_team = data.hasLocalTeam;
    if (data.localTeamName !== undefined) payload.local_team_name = data.localTeamName;
    if (data.localTeamCategory !== undefined) payload.local_team_category = data.localTeamCategory;
    if (data.localTeamPhone !== undefined) payload.local_team_phone = data.localTeamPhone;
    if (data.localTeamGender !== undefined) payload.local_team_gender = data.localTeamGender;
    if (data.localTeamLogoUrl !== undefined) payload.local_team_logo_url = data.localTeamLogoUrl;
    if (data.price !== undefined) payload.price = data.price;
    if (data.courtName !== undefined) payload.court_name = data.courtName;
    if (data.sport !== undefined) payload.sport = data.sport;
    if (data.allowedOpponentCategories !== undefined) payload.allowed_opponent_categories = data.allowedOpponentCategories;
    if (data.bookedByTeamLogoUrl !== undefined) payload.booked_by_team_logo_url = data.bookedByTeamLogoUrl;
    if (data.bookedByUserPhone !== undefined) payload.booked_by_user_phone = data.bookedByUserPhone;

    const { error } = await supabase.from('match_slot').update(payload).eq('id', slotId);
    if (error) throw error;
  },

  getWhatsAppLink: (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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
      categories: t.categories,
      logoUrl: t.logo_url,
      createdAt: t.created_at,
      captainName: t.captain_name,
      captainPhone: t.captain_phone,
      email: t.email,
      gender: t.gender,
      sport: t.sport,
      courtName: t.court_name
    }));
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<void> => {
    await supabase.from('registered_team').insert([{
      field_id: team.fieldId,
      name: team.name,
      fixed_day: team.fixedDay,
      fixed_time: team.fixedTime,
      categories: team.categories,
      logo_url: team.logoUrl,
      // Fix: Use camelCase properties on Partial<RegisteredTeam> object
      captain_name: team.captainName,
      // Fix: Use camelCase properties on Partial<RegisteredTeam> object
      captain_phone: team.captainPhone,
      email: team.email,
      gender: team.gender,
      sport: team.sport,
      // Fix: Use camelCase properties on Partial<RegisteredTeam> object
      court_name: team.courtName
    }]);
  },

  updateRegisteredTeam: async (teamId: string, updates: Partial<RegisteredTeam>): Promise<void> => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.fixedDay !== undefined) payload.fixed_day = updates.fixedDay;
    if (updates.fixedTime !== undefined) payload.fixed_time = updates.fixedTime;
    if (updates.categories !== undefined) payload.categories = updates.categories;
    if (updates.logoUrl !== undefined) payload.logo_url = updates.logoUrl;
    if (updates.captainName !== undefined) payload.captain_name = updates.captainName;
    if (updates.captainPhone !== undefined) payload.captain_phone = updates.captainPhone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.sport !== undefined) payload.sport = updates.sport;
    if (updates.courtName !== undefined) payload.court_name = updates.courtName;
    
    await supabase.from('registered_team').update(payload).eq('id', teamId);
  },

  deleteRegisteredTeam: async (id: string): Promise<void> => {
    await supabase.from('registered_team').delete().eq('id', id);
  },

  acceptInvitation: async (fieldId: string, user: User): Promise<void> => {
    // Check if already registered
    const { data: existing } = await supabase
      .from('registered_team')
      .select('id')
      .eq('field_id', fieldId)
      .eq('email', user.email)
      .single();
    
    if (existing) return;

    const firstTeam = user.teams && user.teams.length > 0 ? user.teams[0] : null;
    
    await supabase.from('registered_team').insert([{
      field_id: fieldId,
      name: firstTeam?.name || user.name,
      categories: firstTeam?.categories || [],
      logo_url: firstTeam?.logoUrl || '',
      captain_name: user.name,
      captain_phone: user.phoneNumber,
      email: user.email,
      gender: firstTeam?.gender || 'MASCULINO',
      sport: firstTeam?.sport || 'Society',
      // Default values for fixed slot (can be edited later by field owner)
      fixed_day: 1,
      fixed_time: '19:00',
      court_name: 'Principal'
    }]);
  },

  adminUpdatePassword: async (userId: string, newPassword: string): Promise<void> => {
    const { error } = await supabase.from('user').update({ password: newPassword }).eq('id', userId);
    if (error) throw error;
  }
};