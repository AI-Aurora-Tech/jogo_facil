
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot } from '../types';

// Helper para persistência local de dados que não existem no schema do banco
const getLocalFieldData = (fieldId: string) => {
    const data = localStorage.getItem(`jf_field_extra_${fieldId}`);
    return data ? JSON.parse(data) : { localTeams: [] };
};

const saveLocalFieldData = (fieldId: string, data: any) => {
    localStorage.setItem(`jf_field_extra_${fieldId}`, JSON.stringify(data));
};

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
      const { data: newField } = await supabase.from('Field').insert([{
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
        longitude: userData.longitude || -46.7905
      }]).select().single();
      
      if (newField) {
          saveLocalFieldData(newField.id, { localTeams: [] });
      }
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
        const extra = getLocalFieldData(f.id);
        return {
            ...f,
            pixConfig: { key: f.pixKey, name: f.pixName },
            localTeams: extra.localTeams || []
        };
    });
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    if (updates.localTeams) {
        saveLocalFieldData(fieldId, { localTeams: updates.localTeams });
    }

    const dbUpdates: any = {
        name: updates.name,
        location: updates.location,
        hourlyRate: updates.hourlyRate,
        cancellationFeePercent: updates.cancellationFeePercent,
        contactPhone: updates.contactPhone,
        imageUrl: updates.imageUrl
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

    const extra = getLocalFieldData(fieldId);
    return { 
        ...data, 
        pixConfig: { key: data.pixKey, name: data.pixName },
        localTeams: extra.localTeams || []
    } as Field;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('MatchSlot').select('*');
    if (error) throw error;
    
    return (data || []).map((s: any) => ({
       ...s,
       durationMinutes: 60,
       matchType: 'AMISTOSO',
       allowedCategories: ["Livre"]
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    // REMOÇÃO ESTRITA de todas as colunas que não existem no banco de dados
    const slotsToInsert = slots.map(({ 
      durationMinutes, 
      matchType, 
      allowedCategories, 
      statusUpdatedAt, 
      customImageUrl,
      ...rest 
    }) => ({
        ...rest
    }));

    const { error } = await supabase.from('MatchSlot').insert(slotsToInsert);
    if (error) throw new Error('Erro ao salvar agenda: ' + error.message);

    const { data: allSlots } = await supabase.from('MatchSlot').select('*');
    return (allSlots || []).map((s: any) => ({
       ...s,
       durationMinutes: 60,
       matchType: 'AMISTOSO',
       allowedCategories: ["Livre"]
    })) as MatchSlot[];
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    // REMOÇÃO ESTRITA de todas as colunas que não existem no banco de dados
    const { 
      durationMinutes, 
      matchType, 
      allowedCategories, 
      statusUpdatedAt, 
      customImageUrl,
      ...rest 
    } = data;
    
    const updatePayload: any = {
        ...rest
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
        durationMinutes: 60,
        matchType: 'AMISTOSO',
        allowedCategories: ["Livre"]
    } as MatchSlot;
  }
};
