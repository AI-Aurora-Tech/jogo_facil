
import { supabase } from './supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam, UserRole, Notification, TeamConfig } from './types';

const mapUserFromDb = (u: any): User => {
  const teams: TeamConfig[] = [];
  if (u.team_name) {
    teams.push({ name: u.team_name, categories: u.team_categories || [] });
  }
  if (u.sub_teams && Array.isArray(u.sub_teams)) {
    u.sub_teams.forEach((t: any) => {
      if (teams.length < 2) teams.push(t);
    });
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phoneNumber: u.phone_number,
    role: u.role,
    subscription: u.subscription,
    subscriptionExpiry: u.subscription_expiry,
    teams: teams,
    latitude: u.latitude,
    longitude: u.longitude,
    teamRating: u.team_rating,
    teamRatingCount: u.team_rating_count,
    password: u.password
  };
};

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('password', password)
      .single();
    if (error || !user) throw new Error('Credenciais inválidas.');
    return mapUserFromDb(user);
  },

  register: async (userData: any): Promise<User> => {
    const { fieldData, ...userFields } = userData;
    const firstTeam = userFields.teams?.[0];
    const secondTeam = userFields.teams?.[1] ? [userFields.teams[1]] : [];

    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert([{
        email: userFields.email.toLowerCase().trim(),
        password: userFields.password,
        name: userFields.name,
        phone_number: userFields.phoneNumber,
        role: userFields.role,
        subscription: userFields.subscription,
        team_name: firstTeam?.name || '',
        team_categories: firstTeam?.categories || [],
        sub_teams: secondTeam
      }])
      .select().single();

    if (userError) throw userError;

    if (userData.role === UserRole.FIELD_OWNER && fieldData) {
      await supabase.from('field').insert([{
        owner_id: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourly_rate: fieldData.hourlyRate || 0,
        contact_phone: fieldData.contactPhone,
        image_url: fieldData.imageUrl || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000'
      }]);
    }
    return mapUserFromDb(newUser);
  },

  updateUser: async (user: User): Promise<User> => {
    const firstTeam = user.teams?.[0];
    const secondTeam = user.teams?.slice(1) || [];

    const { data, error } = await supabase.from('user').update({
      name: user.name,
      phone_number: user.phoneNumber,
      team_name: firstTeam?.name || '',
      team_categories: firstTeam?.categories || [],
      sub_teams: secondTeam,
      password: user.password
    }).eq('id', user.id).select().single();
    if (error) throw error;
    return mapUserFromDb(data);
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    const { data, error } = await supabase.from('notification').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return (data || []).map(n => ({
      id: n.id,
      userId: n.user_id,
      title: n.title,
      description: n.description,
      timestamp: n.created_at,
      type: n.type,
      read: n.read
    }));
  },

  createNotification: async (n: any) => {
    await supabase.from('notification').insert([{
      user_id: n.userId,
      title: n.title,
      description: n.description,
      type: n.type,
      read: false
    }]);
  },

  markNotificationAsRead: async (id: string) => {
    await supabase.from('notification').update({ read: true }).eq('id', id);
  },

  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('field').select('*');
    if (error) throw error;
    return (data || []).map(f => ({
        id: f.id,
        ownerId: f.owner_id,
        name: f.name,
        location: f.location,
        hourlyRate: f.hourly_rate || 0,
        cancellationFeePercent: f.cancellation_fee_percent,
        pixConfig: { key: f.pix_key || '', name: f.pix_name || '' },
        imageUrl: f.image_url,
        contactPhone: f.contact_phone,
        latitude: f.latitude,
        longitude: f.longitude,
        courts: f.courts || []
    }));
  },

  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.location) payload.location = updates.location;
    if (updates.hourlyRate !== undefined) payload.hourly_rate = updates.hourlyRate;
    if (updates.courts !== undefined) payload.courts = updates.courts;
    
    const { data, error } = await supabase.from('field').update(payload).eq('id', fieldId).select().single();
    if (error) throw error;
    return data as any;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('match_slot').select('*').order('date').order('time');
    if (error) throw error;
    return (data || []).map(s => ({
      id: s.id,
      fieldId: s.field_id,
      date: s.date,
      time: s.time,
      durationMinutes: s.duration_minutes || 60,
      matchType: s.match_type,
      isBooked: s.is_booked,
      hasLocalTeam: s.has_local_team,
      local_team_name: s.local_team_name,
      local_team_category: s.local_team_category,
      local_team_phone: s.local_team_phone,
      bookedByUserId: s.booked_by_user_id,
      bookedByTeamName: s.booked_by_team_name,
      bookedByTeamCategory: s.booked_by_team_category,
      bookedByUserPhone: s.booked_by_user_phone,
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      status: s.status,
      price: s.price || 0,
      receiptUrl: s.receipt_url,
      fieldRating: s.rating_given,
      courtName: s.court_name,
      sport: s.sport || 'Futebol'
    }));
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl !== undefined) payload.receipt_url = data.receiptUrl;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.opponentTeamName !== undefined) payload.opponent_team_name = data.opponentTeamName;
    if (data.opponentTeamCategory !== undefined) payload.opponent_team_category = data.opponentTeamCategory;
    if (data.opponentTeamPhone !== undefined) payload.opponent_team_phone = data.opponentTeamPhone;
    if (data.matchType) payload.match_type = data.matchType;
    if (data.price !== undefined) payload.price = data.price;
    if (data.localTeamName !== undefined) payload.local_team_name = data.localTeamName;
    if (data.localTeamCategory !== undefined) payload.local_team_category = data.localTeamCategory;
    if (data.allowedOpponentCategories !== undefined) payload.allowed_opponent_categories = data.allowedOpponentCategories;
    if (data.courtName !== undefined) payload.court_name = data.courtName;
    if (data.sport !== undefined) payload.sport = data.sport;
    if (data.bookedByUserId !== undefined) payload.booked_by_user_id = data.bookedByUserId;
    if (data.date) payload.date = data.date;
    if (data.time) payload.time = data.time;
    if (data.hasLocalTeam !== undefined) payload.has_local_team = data.hasLocalTeam;
    
    const { error } = await supabase.from('match_slot').update(payload).eq('id', slotId);
    if (error) throw error;
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<void> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      match_type: s.matchType || 'ALUGUEL',
      is_booked: s.isBooked || false,
      has_local_team: s.hasLocalTeam || false,
      local_team_name: s.localTeamName || null,
      local_team_category: s.localTeamCategory || null,
      local_team_phone: s.localTeamPhone || null,
      // Fix: Correctly access allowedOpponentCategories (camelCase) from the Partial<MatchSlot> parameter.
      allowed_opponent_categories: s.allowedOpponentCategories || [],
      price: s.price || 0,
      status: s.status || 'available',
      court_name: s.courtName || null,
      sport: s.sport || 'Futebol'
    }));
    const { error } = await supabase.from('match_slot').insert(payload);
    if (error) throw error;
  },

  deleteSlot: async (id: string) => { await supabase.from('match_slot').delete().eq('id', id); },

  getCategories: async () => ["Sub-8", "Sub-9", "Sub-10", "Sub-11", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-16", "Sub-17", "Sport", "35+", "40+", "45+", "50+"],
  
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
      captainPhone: t.captain_phone
    }));
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<void> => {
    const payload = {
      field_id: team.fieldId,
      name: team.name,
      fixed_day: team.fixedDay,
      fixed_time: team.fixedTime,
      categories: team.categories,
      captain_name: team.captainName || null,
      captain_phone: team.captainPhone || null
    };
    const { error } = await supabase.from('registered_team').insert([payload]);
    if (error) throw error;
  },

  updateRegisteredTeam: async (teamId: string, updates: Partial<RegisteredTeam>): Promise<void> => {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.fixedDay) payload.fixed_day = updates.fixedDay;
    if (updates.fixedTime) payload.fixed_time = updates.fixedTime;
    if (updates.categories) payload.categories = updates.categories;
    if (updates.captainName !== undefined) payload.captain_name = updates.captainName;
    if (updates.captainPhone !== undefined) payload.captain_phone = updates.captainPhone;
    
    // Fix: Corrected table target to 'registered_team' as intended for registered team updates.
    const { error } = await supabase.from('registered_team').update(payload).eq('id', teamId);
    if (error) throw error;
  },

  deleteRegisteredTeam: async (teamId: string): Promise<void> => {
    await supabase.from('registered_team').delete().eq('id', teamId);
  },

  getAllUsers: async () => []
};
