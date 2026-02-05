
import React, { useState } from 'react';
import { User, UserRole, Field, TeamConfig, Gender } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Check, Plus, AlertCircle, Building2, MapPin, Smartphone, Camera, Trash2, LayoutGrid, Tag, Lock } from 'lucide-react';
import { formatCategory, convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ categories, user, field, onUpdate, onClose }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [newPassword, setNewPassword] = useState('');
  const [teams, setTeams] = useState<TeamConfig[]>(user.teams || []);
  
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaPrice, setArenaPrice] = useState(field?.hourlyRate || 0);
  const [arenaPhoto, setArenaPhoto] = useState(field?.imageUrl || '');
  const [courts, setCourts] = useState<string[]>(field?.courts || []);

  const [categoryInputs, setCategoryInputs] = useState<string[]>(['', '']);
  const [error, setError] = useState('');

  const handleAddTeam = () => {
    if (teams.length >= 2) return;
    setTeams([...teams, { name: 'Novo Time', categories: [], gender: 'MASCULINO' }]);
  };

  const handleRemoveTeam = (index: number) => {
    if (teams.length <= 1) {
      setError('Você precisa ter pelo menos um time.');
      return;
    }
    setTeams(teams.filter((_, i) => i !== index));
  };

  const handleUpdateTeam = (index: number, updates: Partial<TeamConfig>) => {
    const newTeams = [...teams];
    newTeams[index] = { ...newTeams[index], ...updates };
    setTeams(newTeams);
  };

  const addCategoryToTeam = (teamIndex: number, catToAdd?: string) => {
    // Se passar catToAdd, usa ela, senão pega do input
    const input = catToAdd || categoryInputs[teamIndex];
    const formatted = formatCategory(input);
    if (!formatted) return;

    const team = teams[teamIndex];
    
    if (!team.categories.includes(formatted)) {
      handleUpdateTeam(teamIndex, { categories: [...team.categories, formatted] });
      
      // Se veio do input, limpa o input
      if (!catToAdd) {
        const newInputs = [...categoryInputs];
        newInputs[teamIndex] = '';
        setCategoryInputs(newInputs);
      }
      setError('');
    }
  };

  const removeCategoryFromTeam = (teamIndex: number, cat: string) => {
    const team = teams[teamIndex];
    handleUpdateTeam(teamIndex, { categories: team.categories.filter(c => c !== cat) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teams.length === 0) {
      setError('Adicione pelo menos um time.');
      return;
    }
    const updatedUser: User = { ...user, name, phoneNumber: phone, teams };
    if (newPassword.trim()) {
        updatedUser.password = newPassword.trim();
    }

    let updatedField;
    if (user.role === UserRole.FIELD_OWNER && field) {
      updatedField = { name: arenaName, location: arenaLocation, hourlyRate: arenaPrice, courts, imageUrl: arenaPhoto };
    }
    onUpdate(updatedUser, updatedField);
  };

  return (
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurações do Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-red-500 rounded-xl transition-all"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto pb-20">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase border border-red-100 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Sua Conta</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Seu Nome</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-orange-400" />
                <div className="flex-1">
                    <label className="text-[8px] font-black text-orange-400 uppercase block mb-1">Alterar Senha (Opcional)</label>
                    <input 
                        className="w-full bg-transparent font-bold outline-none text-pitch placeholder-orange-200" 
                        placeholder="Digite a nova senha para alterar" 
                        type="password"
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                    />
                </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3" /> Gestão de Times</h4>
              {teams.length < 2 && (
                <button type="button" onClick={handleAddTeam} className="text-[10px] font-black text-grass-500 uppercase flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Time</button>
              )}
            </div>

            <div className="grid gap-6">
              {teams.map((team, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-200 relative space-y-4 group shadow-sm">
                  {teams.length > 1 && (
                    <button type="button" onClick={() => handleRemoveTeam(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  )}
                  
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                       {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                       <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                          const f = e.target.files?.[0];
                          if(f) handleUpdateTeam(idx, { logoUrl: await convertFileToBase64(f) });
                       }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                      <input className="w-full bg-transparent border-b-2 font-black text-pitch text-lg outline-none focus:border-pitch" value={team.name} onChange={e => handleUpdateTeam(idx, { name: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Gênero</label>
                      <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                        {['MASCULINO', 'FEMININO', 'MISTO'].map((g: any) => (
                          <button key={g} type="button" onClick={() => handleUpdateTeam(idx, { gender: g })} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${team.gender === g ? 'bg-pitch text-white' : 'text-gray-300 hover:text-gray-400'}`}>{g}</button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categorias</label>
                      
                      {/* Lista de Sugestões de Categorias (Checklist) */}
                      <div className="flex flex-wrap gap-1 mb-3 bg-gray-50 p-2 rounded-xl border border-gray-100 max-h-32 overflow-y-auto">
                         {categories.map(cat => {
                           const isSelected = team.categories.includes(cat);
                           return (
                             <button 
                               key={cat}
                               type="button"
                               onClick={() => {
                                 if(isSelected) removeCategoryFromTeam(idx, cat);
                                 else addCategoryToTeam(idx, cat);
                               }}
                               className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all border ${isSelected ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300'}`}
                             >
                               {cat}
                             </button>
                           );
                         })}
                      </div>

                      {/* Input Manual para Categorias Personalizadas */}
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Outra Categoria</label>
                      <div className="flex gap-2 mb-2">
                        <input 
                          className="flex-1 bg-gray-50 p-2 rounded-lg text-[9px] font-black uppercase outline-none" 
                          placeholder="Digite..."
                          value={categoryInputs[idx]}
                          onChange={e => {
                            const newInputs = [...categoryInputs];
                            newInputs[idx] = e.target.value;
                            setCategoryInputs(newInputs);
                          }}
                        />
                        <button type="button" onClick={() => addCategoryToTeam(idx)} className="bg-pitch text-white p-2 rounded-lg"><Plus className="w-4 h-4"/></button>
                      </div>

                      {/* Categorias Selecionadas */}
                      <div className="flex flex-wrap gap-1">
                        {team.categories.map(cat => (
                          <div key={cat} className="bg-gray-100 px-2 py-1 rounded-md text-[8px] font-black uppercase flex items-center gap-1">
                            {cat} <X onClick={() => removeCategoryFromTeam(idx, cat)} className="w-2.5 h-2.5 cursor-pointer text-red-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {user.role === UserRole.FIELD_OWNER && (
            <section className="space-y-6">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Building2 className="w-3 h-3" /> Dados da Arena</h4>
              <div className="flex flex-col items-center gap-2">
                 <div className="w-full h-40 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                    {arenaPhoto ? <img src={arenaPhoto} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                       const f = e.target.files?.[0];
                       if(f) setArenaPhoto(await convertFileToBase64(f));
                    }} />
                 </div>
                 <span className="text-[8px] font-black text-gray-400 uppercase">Foto da Arena</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                   <input className="w-full bg-transparent font-bold text-pitch outline-none" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Preço Base (R$)</label>
                   <input className="w-full bg-transparent font-bold text-pitch outline-none" type="number" value={arenaPrice} onChange={e => setArenaPrice(Number(e.target.value))} />
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border">
                 <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Endereço</label>
                 <input className="w-full bg-transparent font-bold text-pitch outline-none" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
              </div>
            </section>
          )}

          <Button type="submit" className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95">Salvar Todas as Configurações</Button>
        </form>
      </div>
    </div>
  );
};
