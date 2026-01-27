
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam, PendingUpdate, UserRole } from '../types';

const mapUserFromDb = (u: any): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phoneNumber: u.phone_number,
  role: u.role,
  subscription: u.subscription,
  subscriptionExpiry: u.subscription_expiry,
  teamName: u.team_name,
  teamCategories: u.team_categories || [],
  teamLogoUrl: u.team_logo_url,
  subTeams: u.sub_teams || [],
  latitude: u.latitude,
  longitude: u.longitude,
  teamRating: u.team_rating,
  teamRatingCount: u.team_rating_count,
  password: u.password
});

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Tentativa de login
    const { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('password', password)
      .single();

    if (error || !user) {
      console.error("Login fail:", error);
      throw new Error('E-mail ou senha incorretos.');
    }

    return mapUserFromDb(user);
  },

  register: async (userData: any): Promise<User> => {
    const { fieldData, ...userFields } = userData;
    const normalizedEmail = userFields.email.toLowerCase().trim();

    // Promoção automática para Super Admin via código se for o e-mail do Pedro
    let finalRole = userFields.role;
    if (normalizedEmail === 'pedro@auroratech.com') {
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
        team_logo_url: userFields.teamLogoUrl
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
        image_url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000'
      }]);
    }
    return mapUserFromDb(newUser);
  },

  updateUser: async (user: User): Promise<User> => {
    const payload: any = {
      name: user.name,
      phone_number: user.phoneNumber,
      team_name: user.teamName,
      team_categories: user.teamCategories,
      team_logo_url: user.teamLogoUrl,
      sub_teams: user.subTeams
    };
    if (user.password && user.password.trim() !== '') {
      payload.password = user.password;
    }

    const { data, error } = await supabase.from('user').update(payload).eq('id', user.id).select().single();
    if (error) throw error;
    return mapUserFromDb(data);
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
      entity_type: d.entity_type,
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
    return (error || !data) ? ["Livre", "Principal", "Veteranos"] : data.map(c => c.name);
  },

  updateCategories: async (categories: string[]): Promise<void> => {
    await supabase.from('category').delete().neq('name', '');
    await supabase.from('category').insert(categories.map(name => ({ name })));
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
        latitude: f.latitude,
        longitude: f.longitude
    }));
  },

  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const payload: any = {
      name: updates.name,
      location: updates.location,
      hourly_rate: updates.hourlyRate,
      image_url: updates.imageUrl,
      contact_phone: updates.contactPhone
    };
    if (updates.pixConfig) {
      payload.pix_key = updates.pixConfig.key;
      payload.pix_name = updates.pixConfig.name;
    }
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
      durationMinutes: s.duration_minutes,
      matchType: s.match_type,
      isBooked: s.is_booked,
      hasLocalTeam: s.has_local_team,
      localTeamName: s.local_team_name,
      bookedByUserId: s.booked_by_user_id,
      bookedByTeamName: s.booked_by_team_name,
      bookedByCategory: s.booked_by_category,
      opponentTeamName: s.opponent_team_name,
      opponentTeamPhone: s.opponent_team_phone,
      status: s.status,
      price: s.price,
      allowedCategories: s.allowed_categories || [],
      receiptUrl: s.receipt_url,
      aiVerificationResult: s.ai_verification_result
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<void> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      match_type: s.matchType,
      is_booked: s.isBooked,
      has_local_team: s.hasLocalTeam,
      // Fix: Changed s.local_team_name to s.localTeamName as per MatchSlot interface
      local_team_name: s.localTeamName,
      price: s.price,
      status: s.status,
      allowed_categories: s.allowedCategories
    }));
    await supabase.from('match_slot').insert(payload);
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl) payload.receipt_url = data.receiptUrl;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.opponentTeamName !== undefined) payload.opponent_team_name = data.opponentTeamName;
    await supabase.from('match_slot').update(payload).eq('id', slotId);
  },

  deleteSlot: async (slotId: string): Promise<void> => {
    await supabase.from('match_slot').delete().eq('id', slotId);
  },

  getRegisteredTeams: async (fieldId: string): Promise<RegisteredTeam[]> => {
    const { data, error } = await supabase.from('registered_team').select('*').eq('field_id', fieldId);
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      fieldId: t.field_id,
      fixedDay: t.fixed_day,
      fixedTime: t.fixed_time,
      categories: t.categories,
      logoUrl: t.logo_url,
      createdAt: t.created_at
    }));
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<void> => {
    await supabase.from('registered_team').insert([{
      field_id: team.fieldId,
      name: team.name,
      fixed_day: team.fixedDay,
      fixed_time: team.fixedTime,
      categories: team.categories
    }]);
  },

  deleteRegisteredTeam: async (teamId: string): Promise<void> => {
    const { error } = await supabase.from('registered_team').delete().eq('id', teamId);
    if (error) throw error;
  }
};
