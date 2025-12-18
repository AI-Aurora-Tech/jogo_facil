
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot } from '../types';

export const api = {
  // Auth (Simulado usando tabela User customizada para manter estrutura do projeto)
  login: async (email: string, password: string): Promise<User> => {
    const { data: user, error } = await supabase
      .from('User')
      .select('*, subTeams:SubTeam(*)')
      .eq('email', email)
      .eq('password', password) // Nota: Em produção real, usar Supabase Auth. Aqui mantemos a lógica simples do protótipo.
      .single();

    if (error || !user) {
      throw new Error('Credenciais inválidas ou usuário não encontrado.');
    }
    
    // CamelCase formatting manually if DB returns lowercase
    return user as User;
  },

  register: async (userData: any): Promise<User> => {
    // 1. Check existing
    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existing) {
      throw new Error('Email já cadastrado.');
    }

    // 2. Insert User
    const { subTeams, fieldData, ...userFields } = userData;
    
    const { data: newUser, error: userError } = await supabase
      .from('User')
      .insert([userFields])
      .select()
      .single();

    if (userError) throw new Error('Erro ao criar usuário: ' + userError.message);

    // 3. Insert SubTeams
    if (subTeams && subTeams.length > 0) {
      const teamsToInsert = subTeams.map((t: any) => {
        // Sanitize: remove logoUrl se a coluna não existir no banco
        const { logoUrl, ...rest } = t;
        return {
          name: t.name,
          category: t.category,
          // logoUrl: t.logoUrl, // Comentado para evitar erro de coluna inexistente
          userId: newUser.id
        };
      });
      await supabase.from('SubTeam').insert(teamsToInsert);
    }

    // 4. Insert Field if owner
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
        latitude: -23.6337, // Atualizado para região dos testes (Taboão/SP)
        longitude: -46.7905
      }]);
    }

    // Return complete user
    const { data: completeUser } = await supabase
      .from('User')
      .select('*, subTeams:SubTeam(*)')
      .eq('id', newUser.id)
      .single();

    return completeUser as User;
  },

  updateUser: async (user: User): Promise<User> => {
    const { subTeams, ...fieldsToUpdate } = user;
    
    // Update main user data
    const { error } = await supabase
      .from('User')
      .update({
         name: fieldsToUpdate.name,
         phoneNumber: fieldsToUpdate.phoneNumber,
         subscription: fieldsToUpdate.subscription,
         subscriptionExpiry: fieldsToUpdate.subscriptionExpiry
      })
      .eq('id', user.id);

    if (error) throw new Error('Erro ao atualizar usuário');

    // Sync teams (Delete all and recreate - simple approach)
    await supabase.from('SubTeam').delete().eq('userId', user.id);
    if (subTeams && subTeams.length > 0) {
        const teamsToInsert = subTeams.map((t: any) => {
            // Sanitize
            const { logoUrl, ...rest } = t;
            return {
                name: t.name,
                category: t.category,
                // logoUrl: t.logoUrl, // Comentado
                userId: user.id
            };
        });
        await supabase.from('SubTeam').insert(teamsToInsert);
    }

    return user;
  },

  // Data
  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('Field').select('*');
    if (error) throw error;
    return data.map((f: any) => ({
        ...f,
        pixConfig: { key: f.pixKey, name: f.pixName }
    }));
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    // Mapear objeto Field para colunas do banco (flatten pixConfig)
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

    // Remover chaves undefined
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
        .from('Field')
        .update(dbUpdates)
        .eq('id', fieldId)
        .select()
        .single();

    if (error) throw new Error('Erro ao atualizar campo: ' + error.message);

    return {
        ...data,
        pixConfig: { key: data.pixKey, name: data.pixName }
    } as Field;
  },

  getSlots: async (): Promise<MatchSlot[]> => {
    const { data, error } = await supabase.from('MatchSlot').select('*');
    if (error) throw error;
    
    // Mapeia para garantir que campos opcionais ou novos tenham valor default
    // Isso evita undefined na UI se o banco não tiver as colunas
    return data.map((s: any) => ({
       ...s,
       durationMinutes: s.durationMinutes || 60,
       matchType: s.matchType || 'AMISTOSO',
       allowedCategories: s.allowedCategories || ["Livre"]
    })) as MatchSlot[];
  },

  createSlots: async (slots: Partial<MatchSlot>[]): Promise<MatchSlot[]> => {
    // Sanitização: Remove customImageUrl, durationMinutes e matchType antes de enviar para o Supabase
    // pois essas colunas não existem no banco de dados atual.
    const sanitizedSlots = slots.map(slot => {
        const { customImageUrl, durationMinutes, matchType, ...rest } = slot;
        return rest;
    });

    const { data, error } = await supabase.from('MatchSlot').insert(sanitizedSlots).select();
    if (error) throw new Error('Erro ao criar horários: ' + error.message);
    
    // Return all slots to refresh UI
    const { data: allSlots } = await supabase.from('MatchSlot').select('*');
    
    return (allSlots || []).map((s: any) => ({
       ...s,
       durationMinutes: s.durationMinutes || 60,
       matchType: s.matchType || 'AMISTOSO',
       allowedCategories: s.allowedCategories || ["Livre"]
    })) as MatchSlot[];
  },

  updateSlot: async (slotId: string, data: Partial<MatchSlot>): Promise<MatchSlot> => {
    // Sanitização também no update
    const { customImageUrl, durationMinutes, matchType, ...rest } = data;

    const { data: updated, error } = await supabase
      .from('MatchSlot')
      .update(rest)
      .eq('id', slotId)
      .select()
      .single();

    if (error) throw new Error('Erro ao atualizar horário');
    
    // Aplica defaults no retorno para manter compatibilidade com Typescript
    return {
        ...updated,
        durationMinutes: updated.durationMinutes || 60,
        matchType: updated.matchType || 'AMISTOSO',
        allowedCategories: updated.allowedCategories || ["Livre"]
    } as MatchSlot;
  }
};
