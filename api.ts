
import { supabase } from './supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam, UserRole, Notification } from './types';

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
    const { data: newUser, error: userError } = await supabase
      .from('user')
      .insert([{
        email: userFields.email.toLowerCase().trim(),
        password: userFields.password,
        name: userFields.name,
        phone_number: userFields.phoneNumber,
        role: userFields.role,
        subscription: userFields.subscription,
        teams: userFields.teams || []
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
    const { data, error } = await supabase.from('user').update({
      name: user.name,
      phone_number: user.phoneNumber,
      teams: user.teams,
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
        hourlyRate: f.hourly_rate,
        cancellationFeePercent: f.cancellation_fee_percent,
        pixConfig: { key: f.pix_key || '', name: f.pix_name || '' },
        imageUrl: f.image_url,
        contactPhone: f.contact_phone,
        latitude: f.latitude,
        longitude: f.longitude
    }));
  },

  /**
   * Update field information in the database.
   */
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.location) payload.location = updates.location;
    if (updates.hourlyRate !== undefined) payload.hourly_rate = updates.hourlyRate;
    if (updates.imageUrl) payload.image_url = updates.imageUrl;
    if (updates.contactPhone) payload.contact_phone = updates.contactPhone;
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
        latitude: data.latitude,
        longitude: data.longitude
    };
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
      localTeamName: s.local_team_name,
      localTeamCategory: s.local_team_category,
      localTeamPhone: s.local_team_phone,
      bookedByUserId: s.booked_by_user_id,
      bookedByTeamName: s.booked_by_team_name,
      bookedByTeamCategory: s.booked_by_team_category,
      bookedByUserPhone: s.booked_by_user_phone,
      opponentTeamName: s.opponent_team_name,
      opponentTeamCategory: s.opponent_team_category,
      opponentTeamPhone: s.opponent_team_phone,
      allowedOpponentCategories: s.allowed_opponent_categories || [],
      status: s.status,
      price: s.price,
      receiptUrl: s.receipt_url,
      fieldRating: s.rating_given
    }));
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<void> => {
    const payload: any = {};
    if (data.status) payload.status = data.status;
    if (data.isBooked !== undefined) payload.is_booked = data.isBooked;
    if (data.receiptUrl !== undefined) payload.receipt_url = data.receiptUrl;
    if (data.bookedByTeamName !== undefined) payload.booked_by_team_name = data.bookedByTeamName;
    if (data.bookedByTeamCategory !== undefined) payload.booked_by_team_category = data.bookedByTeamCategory;
    if (data.bookedByUserId !== undefined) payload.booked_by_user_id = data.bookedByUserId;
    if (data.bookedByUserPhone !== undefined) payload.booked_by_user_phone = data.bookedByUserPhone;
    if (data.opponentTeamName !== undefined) payload.opponent_team_name = data.opponentTeamName;
    if (data.opponentTeamCategory !== undefined) payload.opponent_team_category = data.opponentTeamCategory;
    if (data.opponentTeamPhone !== undefined) payload.opponent_team_phone = data.opponentTeamPhone;
    if (data.fieldRating !== undefined) payload.rating_given = data.fieldRating;
    
    // Add mapping for new fields
    if (data.localTeamCategory) payload.local_team_category = data.localTeamCategory;
    if (data.allowedOpponentCategories) payload.allowed_opponent_categories = data.allowedOpponentCategories;

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
      has_local_team: s.has_local_team || false,
      local_team_name: s.localTeamName || null,
      local_team_category: s.localTeamCategory || null,
      local_team_phone: s.localTeamPhone || null,
      allowed_opponent_categories: s.allowedOpponentCategories || [],
      price: s.price,
      status: s.status || 'available'
    }));
    const { error } = await supabase.from('match_slot').insert(payload);
    if (error) throw error;
  },

  deleteSlot: async (id: string) => { await supabase.from('match_slot').delete().eq('id', id); },

  getCategories: async () => ["Sub-7", "Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Principal", "Veterano", "Master"],
  
  getRegisteredTeams: async (fieldId: string) => [], // Stub for now
  deleteRegisteredTeam: async (id: string) => {}, // Stub
  getAllUsers: async () => [] // Stub
};