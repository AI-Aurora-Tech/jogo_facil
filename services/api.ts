
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam } from '../types';

export const api = {
  getCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('Category')
      .select('name')
      .order('name', { ascending: true });
    
    if (error || !data || data.length === 0) {
      return ["Livre", "Principal", "Veteranos", "Feminino", "Sub-20"];
    }
    return data.map(c => c.name);
  },

  updateCategories: async (categories: string[]): Promise<string[]> => {
    await supabase.from('Category').delete().neq('name', ''); 
    const { data, error } = await supabase
      .from('Category')
      .insert(categories.map(name => ({ name })))
      .select();
    
    if (error) throw error;
    return categories;
  },

  getRegisteredTeams: async (fieldId: string): Promise<RegisteredTeam[]> => {
    const { data, error } = await supabase
      .from('RegisteredTeam')
      .select('*')
      .eq('fieldId', fieldId);
    
    if (error) return [];
    return data as RegisteredTeam[];
  },

  addRegisteredTeam: async (team: Partial<RegisteredTeam>): Promise<RegisteredTeam> => {
    const { data, error } = await supabase
      .from('RegisteredTeam')
      .insert([team])
      .select()
      .single();

    if (error) throw error;
    return data as RegisteredTeam;
  },

  deleteRegisteredTeam: async (teamId: string): Promise<void> => {
    const { error } = await supabase.from('RegisteredTeam').delete().eq('id', teamId);
    if (error) throw error;
  },

  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) throw new Error('Credenciais inválidas.');
    return user as User;
  },

  register: async (userData: any): Promise<User> => {
    const { fieldData, ...userFields } = userData;
    const { data: newUser, error: userError } = await supabase
      .from('User')
      .insert([userFields])
      .select()
      .single();

    if (userError) throw userError;

    if (userData.role === 'FIELD_OWNER' && fieldData) {
      const { error: fieldError } = await supabase.from('Field').insert([{
        ownerId: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourlyRate: fieldData.hourlyRate || 0,
        pixKey: '',
        pixName: '',
        imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        contactPhone: fieldData.contactPhone,
        latitude: userData.latitude || -23.6337,
        longitude: userData.longitude || -46.7905
      }]);
    }

    return newUser as User;
  },

  updateUser: async (user: User): Promise<User> => {
    const { id, email, role, ...updates } = user;
    const { data, error } = await supabase
      .from('User')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('Field').select('*');
    if (error) throw error;
    return data.map((f: any) => ({
        ...f,
        pixConfig: { key: f.pixKey || '', name: f.pixName || '' }
    }));
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const { id, ownerId, ...cleanUpdates } = updates as any;
    if (cleanUpdates.pixConfig) {
        cleanUpdates.pixKey = cleanUpdates.pixConfig.key;
        cleanUpdates.pixName = cleanUpdates.pixConfig.name;
        delete cleanUpdates.pixConfig;
    }
    const { data, error } = await supabase
      .from('Field')
      .update(cleanUpdates)
      .eq('id', fieldId)
      .select()
      .single();

    if (error) throw error;
    return { ...data, pixConfig: { key: data.pixKey, name: data.pixName } } as Field;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase
      .from('MatchSlot')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) throw error;
    return data as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('MatchSlot').insert(slots).select();
    if (error) throw error;
    return api.getSlots();
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    const { id, ...updates } = data as any;
    const { data: updated, error } = await supabase
      .from('MatchSlot')
      .update(updates)
      .eq('id', slotId)
      .select()
      .single();
    if (error) throw error;
    return updated as MatchSlot;
  },

  deleteSlot: async (slotId: string): Promise<void> => {
    const { error } = await supabase.from('MatchSlot').delete().eq('id', slotId);
    if (error) throw error;
  },

  rateTeam: async (userId: string, slotId: string, rating: number): Promise<void> => {
    await supabase.from('MatchSlot').update({ ratingGiven: rating }).eq('id', slotId);
    const { data: user } = await supabase.from('User').select('teamRating, teamRatingCount').eq('id', userId).single();
    if (!user) return;
    const newCount = (user.teamRatingCount || 0) + 1;
    const newRating = ((user.teamRating || 0) * (user.teamRatingCount || 0) + rating) / newCount;
    await supabase.from('User').update({ teamRating: newRating, teamRatingCount: newCount }).eq('id', userId);
  }
};
