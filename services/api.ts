
import { supabase } from '../supabaseClient';
import { User, Field, MatchSlot, RegisteredTeam } from '../types';

// O Jogo Fácil agora é 100% Cloud. 
// Removemos todos os helpers de localStorage que causavam a perda de dados entre browsers.

export const api = {
  // --- CATEGORIAS GLOBAIS ---
  getCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('Category')
      .select('name')
      .order('name', { ascending: true });
    
    if (error || !data || data.length === 0) {
      // Fallback caso a tabela esteja vazia, mas o ideal é popular o banco
      return ["Livre", "Principal", "Veteranos", "Feminino", "Sub-20"];
    }
    return data.map(c => c.name);
  },

  updateCategories: async (categories: string[]): Promise<string[]> => {
    // Primeiro limpamos e depois inserimos as novas (Operação de Admin)
    await supabase.from('Category').delete().neq('name', ''); 
    const { data, error } = await supabase
      .from('Category')
      .insert(categories.map(name => ({ name })))
      .select();
    
    if (error) throw error;
    return categories;
  },

  // --- MENSALISTAS (EQUIPES REGISTRADAS) ---
  getRegisteredTeams: async (fieldId: string): Promise<RegisteredTeam[]> => {
    const { data, error } = await supabase
      .from('RegisteredTeam')
      .select('*')
      .eq('fieldId', fieldId);
    
    if (error) return [];
    return data as RegisteredTeam[];
  },

  addRegisteredTeam: async (fieldId: string, teamName: string, fixedDay: number, fixedTime: string, categories: string[], logoUrl?: string): Promise<RegisteredTeam> => {
    const { data, error } = await supabase
      .from('RegisteredTeam')
      .insert([{
        fieldId,
        name: teamName,
        fixedDay,
        fixedTime,
        categories,
        logoUrl,
        createdAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data as RegisteredTeam;
  },

  deleteRegisteredTeam: async (fieldId: string, teamId: string): Promise<void> => {
    const { error } = await supabase
      .from('RegisteredTeam')
      .delete()
      .eq('id', teamId);
    if (error) throw error;
  },

  // --- USUÁRIOS E AUTENTICAÇÃO ---
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
    
    // Inserimos o usuário com todos os campos (agora persistidos no DB)
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
        hourlyRate: fieldData.hourlyRate,
        pixKey: fieldData.pixKey || '',
        pixName: fieldData.pixName || '',
        imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1000',
        contactPhone: fieldData.contactPhone,
        latitude: userData.latitude || -23.6337,
        longitude: userData.longitude || -46.7905
      }]);
      if (fieldError) console.error("Erro ao criar arena:", fieldError);
    }

    return newUser as User;
  },

  updateUser: async (user: User): Promise<User> => {
    const { id, ...updates } = user;
    const { data, error } = await supabase
      .from('User')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  // --- ARENAS E CAMPOS ---
  getFields: async (): Promise<Field[]> => {
    const { data, error } = await supabase.from('Field').select('*');
    if (error) throw error;
    return data.map((f: any) => ({
        ...f,
        pixConfig: { key: f.pixKey, name: f.pixName }
    }));
  },
  
  updateField: async (fieldId: string, updates: Partial<Field>): Promise<Field> => {
    const dbUpdates: any = { ...updates };
    if (updates.pixConfig) {
        dbUpdates.pixKey = updates.pixConfig.key;
        dbUpdates.pixName = updates.pixConfig.name;
        delete dbUpdates.pixConfig;
    }
    const { data, error } = await supabase.from('Field').update(dbUpdates).eq('id', fieldId).select().single();
    if (error) throw error;
    return { ...data, pixConfig: { key: data.pixKey, name: data.pixName } } as Field;
  },

  // --- SLOTS E HORÁRIOS ---
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
    const { data: updated, error } = await supabase
      .from('MatchSlot')
      .update(data)
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

  // --- AVALIAÇÕES ---
  rateTeam: async (userId: string, slotId: string, rating: number): Promise<void> => {
    // Atualiza o slot com a nota dada
    await supabase.from('MatchSlot').update({ ratingGiven: rating }).eq('id', slotId);

    // Busca dados atuais do usuário para calcular nova média
    const { data: user, error: userError } = await supabase.from('User').select('teamRating, teamRatingCount').eq('id', userId).single();
    if (userError || !user) return;

    const currentRating = user.teamRating || 0;
    const currentCount = user.teamRatingCount || 0;
    const newCount = currentCount + 1;
    const newRating = (currentRating * currentCount + rating) / newCount;

    await supabase.from('User').update({
        teamRating: newRating,
        teamRatingCount: newCount
    }).eq('id', userId);
  }
};
