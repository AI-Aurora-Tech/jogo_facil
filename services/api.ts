
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot } from '../types';

export const api = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('User')
      .select('*, subTeams:SubTeam(*)')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) {
      throw new Error('Credenciais inválidas ou usuário não encontrado.');
    }
    return user as User;
  },

  register: async (userData: any): Promise<User> => {
    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existing) {
      throw new Error('Email já cadastrado.');
    }

    const { subTeams, fieldData, ...userFields } = userData;
    const { data: newUser, error: userError } = await supabase
      .from('User')
      .insert([userFields])
      .select()
      .single();

    if (userError) throw new Error('Erro ao criar usuário: ' + userError.message);

    if (subTeams && subTeams.length > 0) {
      const teamsToInsert = subTeams.map((t: any) => ({
          name: t.name,
          category: t.category,
          userId: newUser.id
      }));
      await supabase.from('SubTeam').insert(teamsToInsert);
    }

    if (userData.role === 'FIELD_OWNER' && fieldData) {
      await supabase.from('Field').insert([{
        ownerId: newUser.id,
        name: fieldData.name,
        location: fieldData.location,
        hourlyRate: fieldData.hourlyRate,
        cancellationFeePercent: fieldData.cancellationFeePercent,
        pixKey: fieldData.pixConfig.key,
        pixName: fieldData.pixConfig.name,
        imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        contactPhone: fieldData.contactPhone,
        latitude: userData.latitude || -23.6337,
        longitude: userData.longitude || -46.7905,
        localTeams: []
      }]);
    }

    const { data: completeUser } = await supabase
      .from('User')
      .select('*, subTeams:SubTeam(*)')
      .eq('id', newUser.id)
      .single();

    return completeUser as User;
  },

  updateUser: async (user: User): Promise<User> => {
    const { error } = await supabase
      .from('User')
      .update({
         name: user.name,
         phoneNumber: user.phoneNumber,
         subscription: user.subscription,
         subscriptionExpiry: user.subscriptionExpiry
      })
      .eq('id', user.id);

    if (error) throw new Error('Erro ao atualizar usuário');
    return user;
  },

  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('Field').select('*');
    if (error) throw error;
    
    return data.map((f: any, idx: number) => {
        let lat = f.latitude;
        let lng = f.longitude;
        
        if (f.name.toLowerCase().includes('martinica')) {
            lat = -23.6554;
            lng = -46.7725;
        } else if (f.name.toLowerCase().includes('maria virginia')) {
            lat = -23.6421;
            lng = -46.7850;
        } else {
            lat += (idx * 0.012);
            lng += (idx * 0.008);
        }

        return {
            ...f,
            latitude: lat,
            longitude: lng,
            pixConfig: { key: f.pixKey, name: f.pixName },
            localTeams: f.localTeams || []
        };
    });
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const dbUpdates: any = {
        name: updates.name,
        location: updates.location,
        hourlyRate: updates.hourlyRate,
        cancellationFeePercent: updates.cancellationFeePercent,
        contactPhone: updates.contactPhone,
        imageUrl: updates.imageUrl,
        localTeams: updates.localTeams
    };

    if (updates.pixConfig) {
        dbUpdates.pixKey = updates.pixConfig.key;
        dbUpdates.pixName = updates.pixConfig.name;
    }

    const { data, error } = await supabase
        .from('Field')
        .update(dbUpdates)
        .eq('id', fieldId)
        .select()
        .single();

    if (error) throw new Error('Erro ao atualizar campo');
    return { 
        ...data, 
        pixConfig: { key: data.pixKey, name: data.pixName },
        localTeams: data.localTeams || []
    } as Field;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('MatchSlot').select('*');
    if (error) throw error;
    
    return (data || []).map((s: any) => ({
       ...s,
       durationMinutes: s.durationMinutes || 60,
       matchType: s.matchType || 'AMISTOSO',
       allowedCategories: s.allowedCategories || ["Livre"]
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    const slotsToInsert = slots.map(slot => ({
        ...slot,
        statusUpdatedAt: new Date().toISOString()
    }));

    const { error } = await supabase.from('MatchSlot').insert(slotsToInsert);
    if (error) throw new Error('Erro ao salvar agenda: ' + error.message);

    const { data: allSlots } = await supabase.from('MatchSlot').select('*');
    return (allSlots || []).map((s: any) => ({
       ...s,
       durationMinutes: s.durationMinutes || 60,
       matchType: s.matchType || 'AMISTOSO',
       allowedCategories: s.allowedCategories || ["Livre"]
    })) as MatchSlot[];
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    const updatePayload: any = {
        ...data,
        statusUpdatedAt: new Date().toISOString()
    };

    const { data: updated, error } = await supabase
      .from('MatchSlot')
      .update(updatePayload)
      .eq('id', slotId)
      .select()
      .single();

    if (error) throw new Error('Erro ao atualizar horário');
    return {
        ...updated,
        durationMinutes: updated.durationMinutes || 60,
        matchType: updated.matchType || 'AMISTOSO',
        allowedCategories: updated.allowedCategories || ["Livre"]
    } as MatchSlot;
  }
};
