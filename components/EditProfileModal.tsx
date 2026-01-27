
import React, { useState } from 'react';
import { User, UserRole, SubTeam, Field } from '../types';
import { Button } from './Button';
// Added Settings to the import list from lucide-react
import { X, User as UserIcon, Shield, Upload, Check, Plus, AlertCircle, Building2, MapPin, Trash2, Smartphone, ImageIcon, Camera, Globe, Swords, Settings } from 'lucide-react';
import { convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ categories, user, field, onUpdate, onClose }) => {
  const isFieldOwner = user.role === UserRole.FIELD_OWNER;
  
  // Estados Pessoais (Comum a todos)
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  
  // Estados da Arena (Apenas Dono)
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaImage, setArenaImage] = useState(field?.imageUrl || '');

  // Estados do Time (Apenas Capitão ou Dono com Time Local)
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');
  const [subTeams, setSubTeams] = useState<SubTeam[]>(user.subTeams || []);
  
  // Auxiliares para novos sub-times
  const [newSubName, setNewSubName] = useState('');
  const [newSubCat, setNewSubCat] = useState(categories[0] || 'Livre');
  const [selectedNewCat, setSelectedNewCat] = useState(categories[0] || 'Livre');
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'ARENA' | 'TEAM') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Imagem muito grande! Máximo 2MB.");
        return;
      }
      try {
        const base64 = await convertFileToBase64(file);
        if (target === 'ARENA') setArenaImage(base64);
        else setTeamLogo(base64);
      } catch (err) { alert('Erro ao processar imagem.'); }
    }
  };

  const addCategory = () => {
    if (teamCategories.length >= 2) {
      setError('O time pode ter no máximo 2 categorias.');
      return;
    }
    if (selectedNewCat && !teamCategories.includes(selectedNewCat)) {
      setTeamCategories([...teamCategories, selectedNewCat]);
      setError('');
    }
  };

  const addSubTeam = () => {
    if (!newSubName.trim()) return;
    const newSub: SubTeam = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSubName,
      category: newSubCat
    };
    setSubTeams([...subTeams, newSub]);
    setNewSubName('');
  };

  const removeSubTeam = (id: string) => {
    setSubTeams(subTeams.filter(s => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (teamCategories.length === 0 && !isFieldOwner) {
      setError('O time precisa de pelo menos uma categoria.');
      return;
    }

    const updatedUser: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: teamName || user.teamName,
      teamCategories: teamCategories,
      teamLogoUrl: teamLogo || user.teamLogoUrl,
      subTeams: subTeams
    };

    let updatedField: Partial<Field> | undefined = undefined;
    if (isFieldOwner && field) {
        updatedField = {
            name: arenaName,
            location: arenaLocation,
            imageUrl: arenaImage,
            contactPhone: phone
        };
    }

    onUpdate(updatedUser, updatedField);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3.5rem] w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div className="bg-pitch p-10 text-white flex justify-between items-center relative border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-grass-500 text-pitch rounded-2xl shadow-lg">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Configurações</h3>
              <p className="text-[10px] font-black text-grass-500 uppercase tracking-widest mt-1">Gestão de Conta e Equipes</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-12 overflow-y-auto no-scrollbar pb-20">
          {error && (
            <div className="bg-red-50 text-red-600 p-5 rounded-[2rem] flex items-center gap-4 border border-red-100 text-[11px] font-black uppercase animate-in zoom-in-95">
              <AlertCircle className="w-6 h-6" /> {error}
            </div>
          )}

          {/* SEÇÃO: ARENA */}
          {isFieldOwner && (
            <section className="space-y-8 animate-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <Building2 className="w-5 h-5 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-[0.2em]">Detalhes da sua Arena</h4>
              </div>
              
              <div className="flex flex-col md:flex-row gap-8">
                  <div className="relative shrink-0 mx-auto md:mx-0">
                      <div className="w-40 h-40 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group relative transition-all hover:border-grass-500">
                          {arenaImage ? <img src={arenaImage} className="w-full h-full object-cover"/> : <ImageIcon className="w-12 h-12 text-gray-200"/>}
                          <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'ARENA')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="absolute inset-0 bg-pitch/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <div className="text-center">
                              <Camera className="text-white w-8 h-8 mx-auto mb-1" />
                              <span className="text-[8px] text-white font-black uppercase">Alterar Foto</span>
                            </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex-grow space-y-5">
                      <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 focus-within:border-grass-500 transition-colors shadow-sm">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5">Nome Oficial da Arena</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-2xl tracking-tighter" placeholder="Nome da sua Arena" value={arenaName} onChange={e => setArenaName(e.target.value)} required />
                      </div>
                      <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 focus-within:border-grass-500 transition-colors shadow-sm">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5">Endereço de Localização</label>
                          <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-grass-600" />
                            <input type="text" className="w-full bg-transparent font-bold outline-none text-pitch text-xs" placeholder="Rua, Número, Bairro, Cidade" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} required />
                          </div>
                      </div>
                  </div>
              </div>
            </section>
          )}

          {/* SEÇÃO: TIME PRINCIPAL */}
          <section className="space-y-8 pt-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <Shield className="w-5 h-5 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-[0.2em]">Sua Equipe Principal</h4>
              </div>
              <div className="flex flex-col md:flex-row gap-8">
                   <div className="relative shrink-0 mx-auto md:mx-0">
                      <div className="w-40 h-40 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group relative transition-all hover:border-grass-500">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Shield className="w-12 h-12 text-gray-200"/>}
                          <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'TEAM')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="absolute inset-0 bg-pitch/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                             <div className="text-center">
                              <Camera className="text-white w-8 h-8 mx-auto mb-1" />
                              <span className="text-[8px] text-white font-black uppercase">Alterar Escudo</span>
                            </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex-grow space-y-5">
                      <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 focus-within:border-grass-500 transition-colors shadow-sm">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5">Nome do Time</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-2xl tracking-tighter" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: Galáticos FC" />
                      </div>
                      <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Categorias (Máx 2):</label>
                            <span className="text-[8px] font-black text-grass-600 uppercase bg-grass-50 px-2 py-0.5 rounded">{teamCategories.length}/2</span>
                          </div>
                          <div className="flex gap-3 mb-5">
                              <select value={selectedNewCat} onChange={e => setSelectedNewCat(e.target.value)} className="flex-grow bg-white p-3 rounded-2xl text-[10px] font-black outline-none border border-gray-200 shadow-sm">
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <button type="button" onClick={addCategory} className="bg-pitch text-white px-5 rounded-2xl active:scale-90 transition-transform shadow-lg"><Plus className="w-5 h-5"/></button>
                          </div>
                          <div className="flex flex-wrap gap-3">
                              {teamCategories.map(cat => (
                                  <div key={cat} className="bg-grass-500 text-pitch px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-3 border border-pitch/10 shadow-md animate-in zoom-in-95">
                                      {cat}
                                      <button type="button" onClick={() => setTeamCategories(teamCategories.filter(c => c !== cat))} className="hover:text-white transition-colors"><X className="w-3.5 h-3.5"/></button>
                                  </div>
                              ))}
                              {teamCategories.length === 0 && <span className="text-[10px] text-gray-300 italic">Nenhuma categoria selecionada</span>}
                          </div>
                      </div>
                  </div>
              </div>
          </section>

          {/* SEÇÃO: SUB-TIMES (CADASTRO DE TIMES) */}
          <section className="space-y-8 pt-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <Swords className="w-5 h-5 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-[0.2em]">Cadastro de Sub-times / Divisões</h4>
              </div>
              
              <div className="bg-gray-50 p-8 rounded-[3rem] border border-gray-100 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome da Divisão</label>
                      <input type="text" className="w-full p-4 bg-white border rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-grass-500" placeholder="Ex: Time de Domingo" value={newSubName} onChange={e => setNewSubName(e.target.value)} />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Categoria Única</label>
                      <div className="flex gap-2">
                        <select className="flex-grow p-4 bg-white border rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-grass-500" value={newSubCat} onChange={e => setNewSubCat(e.target.value)}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={addSubTeam} className="bg-grass-500 text-pitch px-5 rounded-2xl font-black shadow-lg active:scale-95 transition-all"><Plus className="w-6 h-6"/></button>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                  {subTeams.length === 0 ? (
                    <div className="text-center py-6 text-gray-300 italic text-[10px] uppercase font-black">Nenhum sub-time cadastrado</div>
                  ) : (
                    subTeams.map(sub => (
                      <div key={sub.id} className="bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm group animate-in slide-in-from-left-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-pitch text-white rounded-xl flex items-center justify-center font-black text-sm">{sub.name.charAt(0)}</div>
                          <div>
                            <span className="text-xs font-black text-pitch block">{sub.name}</span>
                            <span className="text-[8px] font-black text-grass-600 uppercase">{sub.category}</span>
                          </div>
                        </div>
                        <button onClick={() => removeSubTeam(sub.id)} className="p-2 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))
                  )}
                </div>
              </div>
          </section>

          {/* SEÇÃO: DADOS DO RESPONSÁVEL */}
          <section className="space-y-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 pb-2">
                <UserIcon className="w-5 h-5 text-grass-600" />
                <h4 className="text-[11px] font-black text-pitch uppercase tracking-[0.2em]">Dados Pessoais do Gestor</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 focus-within:border-grass-500 transition-colors shadow-sm">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5">Nome do Responsável</label>
                    <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 focus-within:border-grass-500 transition-colors shadow-sm">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1.5">WhatsApp para Contato</label>
                    <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-grass-600" />
                        <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                </div>
            </div>
          </section>

          <div className="pt-10 sticky bottom-0 bg-white/80 backdrop-blur-md pb-6 -mx-10 px-10">
            <Button type="submit" className="w-full py-7 rounded-[3rem] text-xl shadow-2xl shadow-grass-500/30 uppercase font-black tracking-[0.2em] bg-grass-600 hover:bg-grass-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
              <Check className="w-7 h-7" /> Salvar Configurações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
