
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
    const normalizedEmail = userFields.email.toLowerCase().trim();

    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert([{
        email: normalizedEmail,
        password: userFields.password,
        name: userFields.name,
        phone_number: userFields.phoneNumber,
        role: userFields.role,
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
    const { data, error } = await supabase.from('user').update({
      name: user.name,
      phone_number: user.phoneNumber,
      team_name: user.teamName,
      team_categories: user.teamCategories,
      team_logo_url: user.teamLogoUrl
    }).eq('id', user.id).select().single();
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

  updateField: async (fieldId: string, updates: Partial<Field>): Promise<void> => {
    const payload: any = {
      name: updates.name,
      location: updates.location,
      hourly_rate: updates.hourlyRate,
      contact_phone: updates.contactPhone
    };
    await supabase.from('field').update(payload).eq('id', fieldId);
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
    }));
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<void> => {
    const payload = slots.map(s => ({
      field_id: s.fieldId,
      date: s.date,
      time: s.time,
      match_type: s.matchType,
      is_booked: s.isBooked || false,
      has_local_team: s.hasLocalTeam || false,
      local_team_name: s.localTeamName,
      booked_by_team_name: s.bookedByTeamName,
      booked_by_category: s.bookedByCategory,
      price: s.price,
      status: s.status || 'available',
      allowed_categories: s.allowedCategories || []
    }));
    const { error } = await supabase.from('match_slot').insert(payload);
    if (error) throw error;
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl) payload.receipt_url = data.receiptUrl;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.bookedByUserId !== undefined) payload.booked_by_user_id = data.bookedByUserId;
    if (data.bookedByCategory !== undefined) payload.booked_by_category = data.bookedByCategory;
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
    await supabase.from('registered_team').delete().eq('id', teamId);
  },

  getPendingUpdatesForTarget: async (t: string) => [],
  getCategories: async () => ["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Veterano", "Principal", "Feminino"],
  getAllUsers: async () => []
};
