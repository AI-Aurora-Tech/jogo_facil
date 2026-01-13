
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot } from '../types';

const getLocalUserData = (userId: string) => {
    const data = localStorage.getItem(`jf_user_extra_${userId}`);
    return data ? JSON.parse(data) : { teamName: '', teamCategories: [], teamLogoUrl: '' };
};

const saveLocalUserData = (userId: string, data: any) => {
    localStorage.setItem(`jf_user_extra_${userId}`, JSON.stringify(data));
};

const getLocalFieldData = (fieldId: string) => {
    const data = localStorage.getItem(`jf_field_extra_${fieldId}`);
    return data ? JSON.parse(data) : { localTeams: [] };
};

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('User')
      .select('*, subTeams:SubTeam(*)')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) throw new Error('Credenciais inválidas.');
    
    const extra = getLocalUserData(user.id);
    return { ...user, ...extra } as User;
  },

  register: async (userData: any): Promise<User> => {
    const { subTeams, fieldData, teamName, teamCategories, teamLogoUrl, ...userFields } = userData;
    const { data: newUser, error: userError } = await supabase.from('User').insert([userFields]).select().single();
    if (userError) throw userError;

    saveLocalUserData(newUser.id, { teamName, teamCategories, teamLogoUrl });

    if (userData.role === 'FIELD_OWNER' && fieldData) {
      await supabase.from('Field').insert([{
        ownerId: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourlyRate: fieldData.hourlyRate,
        pixKey: fieldData.pixConfig.key,
        pixName: fieldData.pixConfig.name,
        imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        contactPhone: fieldData.contactPhone,
        latitude: userData.latitude || -23.6337,
        longitude: userData.longitude || -46.7905
      }]);
    }

    return { ...newUser, teamName, teamCategories, teamLogoUrl } as User;
  },

  updateUser: async (user: User): Promise<User> => {
    const { teamName, teamCategories, teamLogoUrl, ...dbFields } = user;
    saveLocalUserData(user.id, { teamName, teamCategories, teamLogoUrl });

    const { error } = await supabase
      .from('User')
      .update({
         name: user.name,
         phoneNumber: user.phoneNumber,
         subscription: user.subscription,
         subscriptionExpiry: user.subscriptionExpiry
      })
      .eq('id', user.id);

    if (error) throw error;
    return user;
  },

  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('Field').select('*');
    if (error) throw error;
    return data.map((f: any) => ({
        ...f,
        pixConfig: { key: f.pixKey, name: f.pixName },
        localTeams: [] 
    }));
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const dbUpdates: any = {
        name: updates.name,
        location: updates.location,
        hourlyRate: updates.hourlyRate,
        contactPhone: updates.contactPhone
    };
    if (updates.pixConfig) {
        dbUpdates.pixKey = updates.pixConfig.key;
        dbUpdates.pixName = updates.pixConfig.name;
    }
    const { data, error } = await supabase.from('Field').update(dbUpdates).eq('id', fieldId).select().single();
    if (error) throw error;
    return { ...data, pixConfig: { key: data.pixKey, name: data.pixName } } as Field;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('MatchSlot').select('*');
    if (error) throw error;
    return (data || []).map((s: any) => ({
       ...s,
       durationMinutes: 60,
       matchType: s.matchType || 'AMISTOSO',
       allowedCategories: s.allowedCategories || ["Principal"]
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const slotsToInsert = slots.map(({ durationMinutes, matchType, allowedCategories, statusUpdatedAt, ...rest }) => ({
        ...rest,
        allowedCategories // Salvamos a categoria aqui
    }));
    const { error } = await supabase.from('MatchSlot').insert(slotsToInsert);
    if (error) throw error;
    // Fix: replaced 'this.getSlots()' with 'api.getSlots()' because arrow functions don't bind 'this' to the current object.
    return api.getSlots();
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    const { durationMinutes, matchType, allowedCategories, statusUpdatedAt, ...rest } = data;
    const { data: updated, error } = await supabase.from('MatchSlot').update(rest).eq('id', slotId).select().single();
    if (error) throw error;
    return { ...updated, allowedCategories } as MatchSlot;
  }
};
