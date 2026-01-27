
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam } from '../types';

// Helper centralizado para mapear o usuário vindo do banco (snake_case) para o tipo TS (camelCase)
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
  teamRatingCount: u.team_rating_count
});

export const api = {
  getCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('category')
      .select('name')
      .order('name', { ascending: true });
    
    if (error || !data || data.length === 0) {
      return ["Livre", "Principal", "Veteranos", "Feminino", "Sub-20"];
    }
    return data.map(c => c.name);
  },

  updateCategories: async (categories: string[]): Promise<string[]> => {
    await supabase.from('category').delete().neq('name', ''); 
    const { error } = await supabase
      .from('category')
      .insert(categories.map(name => ({ name })));
    
    if (error) throw error;
    return categories;
  },

  getRegisteredTeams: async (fieldId: string): Promise<RegisteredTeam[]> => {
    const { data, error } = await supabase
      .from('registered_team')
      .select('*')
      .eq('field_id', fieldId);
    
    if (error) {
      console.error("Erro ao buscar mensalistas:", error);
      return [];
    }
    
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      fieldId: t.field_id,
      fixedDay: t.fixed_day,
      fixedTime: t.fixed_time,
      categories: t.categories,
      logoUrl: t.logo_url,
      createdAt: t.created_at
    })) as RegisteredTeam[];
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<RegisteredTeam> => {
    const payload = {
      field_id: team.fieldId,
      name: team.name,
      fixed_day: team.fixed_day,
      fixed_time: team.fixed_time,
      categories: team.categories,
      logo_url: team.logoUrl
    };

    const { data, error } = await supabase
      .from('registered_team')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data as any;
  },

  deleteRegisteredTeam: async (teamId: string): Promise<void> => {
    const { error } = await supabase.from('registered_team').delete().eq('id', teamId);
    if (error) throw error;
  },

  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('user')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) throw new Error('Credenciais inválidas.');
    return mapUserFromDb(user);
  },

  register: async (userData: any): Promise<User> => {
    const { fieldData, ...userFields } = userData;
    
    const userPayload = {
      email: userFields.email,
      password: userFields.password,
      name: userFields.name,
      phone_number: userFields.phoneNumber,
      role: userFields.role,
      subscription: userFields.subscription,
      team_name: userFields.teamName,
      team_categories: userFields.teamCategories,
      team_logo_url: userFields.teamLogoUrl,
      latitude: userFields.latitude,
      longitude: userFields.longitude
    };

    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert([userPayload])
      .select()
      .single();

    if (userError) throw userError;

    if (userData.role === 'FIELD_OWNER' && fieldData) {
      await supabase.from('field').insert([{
        owner_id: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourly_rate: fieldData.hourlyRate || 0,
        pix_key: '',
        pix_name: '',
        image_url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        contact_phone: fieldData.contactPhone,
        latitude: userData.latitude || -23.6337,
        longitude: userData.longitude || -46.7905
      }]);
    }

    return mapUserFromDb(newUser);
  },

  updateUser: async (user: User): Promise<User> => {
    const payload = {
      name: user.name,
      phone_number: user.phoneNumber,
      team_name: user.teamName,
      team_categories: user.teamCategories,
      team_logo_url: user.teamLogoUrl,
      sub_teams: user.subTeams
    };

    const { data, error } = await supabase
      .from('user')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return mapUserFromDb(data);
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

    const { data, error } = await supabase
      .from('field')
      .update(payload)
      .eq('id', fieldId)
      .select()
      .single();

    if (error) throw error;
    return data as any;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase
      .from('match_slot')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
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
      aiVerificationResult: s.ai_verification_result,
      ratingGiven: s.rating_given
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      duration_minutes: s.durationMinutes,
      match_type: s.matchType,
      is_booked: s.isBooked,
      has_local_team: s.hasLocalTeam,
      local_team_name: s.localTeamName,
      price: s.price,
      status: s.status,
      // Fixed: Use camelCase allowedCategories from MatchSlot interface instead of snake_case allowed_categories
      allowed_categories: s.allowedCategories,
      booked_by_team_name: s.bookedByTeamName,
      booked_by_category: s.bookedByCategory
    }));

    const { error } = await supabase.from('match_slot').insert(payload);
    if (error) throw error;
    return api.getSlots();
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl !== undefined) payload.receipt_url = data.receiptUrl;
    if (data.aiVerificationResult) payload.ai_verification_result = data.aiVerificationResult;
    if (data.bookedByUserId) payload.booked_by_user_id = data.bookedByUserId;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.bookedByCategory !== undefined) payload.booked_by_category = data.bookedByCategory;
    if (data.opponentTeamName !== undefined) payload.opponent_team_name = data.opponentTeamName;
    if (data.opponentTeamPhone !== undefined) payload.opponent_team_phone = data.opponentTeamPhone;

    const { data: updated, error } = await supabase
      .from('match_slot')
      .update(payload)
      .eq('id', slotId)
      .select()
      .single();
      
    if (error) throw error;
    return updated as any;
  },

  deleteSlot: async (slotId: string): Promise<void> => {
    const { error } = await supabase.from('match_slot').delete().eq('id', slotId);
    if (error) throw error;
  }
};
