
import React, { useState } from 'react';
import { User, UserRole, SubTeam } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Upload, Check, Plus, AlertCircle, Building2, MapPin, Trash2, Smartphone } from 'lucide-react';
import { convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  onUpdate: (updatedUser: User) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ categories, user, onUpdate, onClose }) => {
  const isFieldOwner = user.role === UserRole.FIELD_OWNER;
  
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  
  // Dados do Time / Sub-times
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');
  const [subTeams, setSubTeams] = useState<SubTeam[]>(user.subTeams || []);
  
  // Auxiliares para adicionar
  const [selectedNewCat, setSelectedNewCat] = useState(categories[0] || '');
  const [newSubTeamName, setNewSubTeamName] = useState('');
  const [newSubTeamCat, setNewSubTeamCat] = useState(categories[0] || '');
  
  const [error, setError] = useState('');

  const addCategory = () => {
    setError('');
    if (teamCategories.length >= 2) {
      setError('O limite máximo é de 2 categorias por time principal.');
      return;
    }
    if (selectedNewCat && !teamCategories.includes(selectedNewCat)) {
      setTeamCategories([...teamCategories, selectedNewCat]);
    }
  };

  const addSubTeam = () => {
    if (!newSubTeamName) return;
    const newSub: SubTeam = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSubTeamName,
      category: newSubTeamCat
    };
    setSubTeams([...subTeams, newSub]);
    setNewSubTeamName('');
  };

  const removeSubTeam = (id: string) => {
    setSubTeams(subTeams.filter(s => s.id !== id));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        setTeamLogo(base64);
      } catch (err) { alert('Erro ao processar imagem.'); }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: isFieldOwner ? undefined : teamName,
      teamCategories: isFieldOwner ? [] : teamCategories,
      teamLogoUrl: isFieldOwner ? undefined : teamLogo,
      subTeams: isFieldOwner ? [] : subTeams
    };
    onUpdate(updatedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-black">{isFieldOwner ? 'Dados da Arena' : 'Meu Perfil & Times'}</h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto no-scrollbar">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 text-xs font-bold">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="w-3 h-3" /> Responsável
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                    <input type="text" className="w-full bg-transparent font-bold outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-gray-400" />
                        <input type="text" className="w-full bg-transparent font-bold outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                </div>
            </div>
          </section>

          {!isFieldOwner && (
            <section className="space-y-6 animate-in fade-in duration-300 border-t pt-8">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Time Principal
              </h4>
              <div className="flex items-center gap-6">
                  <div className="relative group">
                      <div className="w-24 h-24 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Upload className="w-8 h-8 text-gray-300"/>}
                          <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pitch text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Alterar</div>
                  </div>
                  <div className="flex-grow bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome da Equipe</label>
                      <input type="text" className="w-full bg-transparent text-xl font-black outline-none text-pitch" placeholder="Ex: Galácticos FC" value={teamName} onChange={e => setTeamName(e.target.value)} />
                  </div>
              </div>

              <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase block tracking-tighter">Categorias do Principal (Máx 2):</label>
                  <div className="flex gap-2">
                      <select 
                          value={selectedNewCat}
                          onChange={e => setSelectedNewCat(e.target.value)}
                          className="flex-grow p-4 bg-gray-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-grass-500 text-pitch"
                          disabled={teamCategories.length >= 2}
                      >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button type="button" onClick={addCategory} className="bg-pitch text-white px-6 rounded-2xl active:scale-95 disabled:opacity-50"><Plus className="w-6 h-6"/></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {teamCategories.map(cat => (
                          <div key={cat} className="bg-grass-100 text-grass-800 px-4 py-2 rounded-xl text-xs font-black border border-grass-200 flex items-center gap-2">
                              {cat}
                              <button type="button" onClick={() => setTeamCategories(teamCategories.filter(c => c !== cat))} className="text-grass-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                          </div>
                      ))}
                  </div>
              </div>

              {/* GESTÃO DE SUB-TIMES */}
              <div className="border-t pt-8 space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-3 h-3" /> Gerenciar Outros Times (Sub-times)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Sub-time</label>
                        <input type="text" value={newSubTeamName} onChange={e => setNewSubTeamName(e.target.value)} className="w-full bg-transparent font-bold text-xs outline-none" placeholder="Ex: Galácticos B" />
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex gap-2 items-end">
                        <div className="flex-grow">
                          <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                          <select value={newSubTeamCat} onChange={e => setNewSubTeamCat(e.target.value)} className="w-full bg-transparent font-bold text-xs outline-none">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={addSubTeam} className="p-2 bg-pitch text-white rounded-lg active:scale-90"><Plus className="w-4 h-4" /></button>
                      </div>
                  </div>

                  <div className="space-y-2">
                      {subTeams.map(sub => (
                        <div key={sub.id} className="bg-white border p-4 rounded-2xl flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-pitch font-black text-xs">{sub.name.charAt(0)}</div>
                                <div>
                                    <p className="text-xs font-black text-pitch">{sub.name}</p>
                                    <span className="text-[10px] font-bold text-grass-600 uppercase">{sub.category}</span>
                                </div>
                            </div>
                            <button type="button" onClick={() => removeSubTeam(sub.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      ))}
                  </div>
              </div>
            </section>
          )}

          <Button type="submit" className="w-full py-5 rounded-[2rem] text-lg shadow-xl uppercase font-black tracking-widest">
            Salvar Alterações
          </Button>
        </form>
      </div>
    </div>
  );
};
