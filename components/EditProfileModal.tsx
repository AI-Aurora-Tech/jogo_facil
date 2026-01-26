
import React, { useState } from 'react';
import { User, UserRole, SubTeam, Field } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Upload, Check, Plus, AlertCircle, Building2, MapPin, Trash2, Smartphone, ImageIcon, Camera } from 'lucide-react';
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
  
  // Estados Pessoais
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  
  // Estados da Arena (Se for Dono)
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaImage, setArenaImage] = useState(field?.imageUrl || '');

  // Estados do Time (Se for Capitão)
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');
  const [subTeams, setSubTeams] = useState<SubTeam[]>(user.subTeams || []);
  
  // Auxiliares
  const [selectedNewCat, setSelectedNewCat] = useState(categories[0] || '');
  const [newSubTeamName, setNewSubTeamName] = useState('');
  const [newSubTeamCat, setNewSubTeamCat] = useState(categories[0] || '');
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'ARENA' | 'TEAM') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        if (target === 'ARENA') setArenaImage(base64);
        else setTeamLogo(base64);
      } catch (err) { alert('Erro ao processar imagem.'); }
    }
  };

  const addCategory = () => {
    if (teamCategories.length >= 2) {
      setError('Máximo de 2 categorias por time.');
      return;
    }
    if (selectedNewCat && !teamCategories.includes(selectedNewCat)) {
      setTeamCategories([...teamCategories, selectedNewCat]);
      setError('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: !isFieldOwner ? teamName : undefined,
      teamCategories: !isFieldOwner ? teamCategories : [],
      teamLogoUrl: !isFieldOwner ? teamLogo : undefined,
      subTeams: !isFieldOwner ? subTeams : []
    };

    const updatedField: Partial<Field> | undefined = isFieldOwner ? {
      name: arenaName,
      location: arenaLocation,
      imageUrl: arenaImage
    } : undefined;

    onUpdate(updatedUser, updatedField);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-pitch/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center relative">
          <div>
            <h3 className="text-2xl font-black italic tracking-tighter">MEU PERFIL</h3>
            <p className="text-[10px] font-black text-grass-500 uppercase tracking-widest">Gerenciar Informações Gerais</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10 overflow-y-auto no-scrollbar pb-12">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 text-[10px] font-black uppercase">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          {/* SEÇÃO: DADOS DO RESPONSÁVEL */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-grass-600" /> Dados do Responsável
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Seu Nome</label>
                    <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">WhatsApp de Contato</label>
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-grass-600" />
                        <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                </div>
            </div>
          </section>

          {/* SEÇÃO: ARENA (Apenas se for Dono) */}
          {isFieldOwner && (
            <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pt-6 border-t">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-grass-600" /> Informações da Arena
              </h4>
              <div className="flex flex-col md:flex-row gap-6">
                  <div className="relative shrink-0 mx-auto">
                      <div className="w-32 h-32 bg-gray-100 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group">
                          {arenaImage ? <img src={arenaImage} className="w-full h-full object-cover"/> : <ImageIcon className="w-10 h-10 text-gray-300"/>}
                          <input type="file" onChange={e => handleFileChange(e, 'ARENA')} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-6 h-6" />
                          </div>
                      </div>
                      <span className="block text-center text-[8px] font-black text-gray-400 uppercase mt-2">Foto da Fachada</span>
                  </div>
                  <div className="flex-grow space-y-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome Fantasia da Arena</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-lg" placeholder="Ex: Arena Real Madrid" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Endereço Completo</label>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-grass-600" />
                            <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-xs" placeholder="Rua, Número, Bairro..." value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
                          </div>
                      </div>
                  </div>
              </div>
            </section>
          )}

          {/* SEÇÃO: TIME (Apenas se for Capitão) */}
          {!isFieldOwner && (
            <section className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pt-6 border-t">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-grass-600" /> Meu Time & Categoria
              </h4>
              <div className="flex flex-col md:flex-row gap-6">
                   <div className="relative shrink-0 mx-auto">
                      <div className="w-32 h-32 bg-gray-100 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Shield className="w-10 h-10 text-gray-300"/>}
                          <input type="file" onChange={e => handleFileChange(e, 'TEAM')} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-6 h-6" />
                          </div>
                      </div>
                      <span className="block text-center text-[8px] font-black text-gray-400 uppercase mt-2">Escudo do Time</span>
                  </div>
                  <div className="flex-grow space-y-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome da Equipe</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-lg" value={teamName} onChange={e => setTeamName(e.target.value)} />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Minhas Categorias (Máx 2):</label>
                          <div className="flex gap-2 mb-3">
                              <select value={selectedNewCat} onChange={e => setSelectedNewCat(e.target.value)} className="flex-grow bg-white p-2 rounded-xl text-xs font-black outline-none border border-gray-200">
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <button type="button" onClick={addCategory} className="bg-pitch text-white px-4 rounded-xl active:scale-90 transition-transform"><Plus className="w-4 h-4"/></button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {teamCategories.map(cat => (
                                  <div key={cat} className="bg-grass-500 text-pitch px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-2 border border-pitch/10">
                                      {cat}
                                      <button type="button" onClick={() => setTeamCategories(teamCategories.filter(c => c !== cat))} className="hover:text-white"><X className="w-3 h-3"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Gestão de Sub-times */}
              <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-dashed border-gray-200 mt-6">
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Adicionar Sub-times (Outras Equipes)</h5>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <input type="text" placeholder="Nome" value={newSubTeamName} onChange={e => setNewSubTeamName(e.target.value)} className="bg-white p-3 rounded-xl text-xs font-bold outline-none border" />
                      <div className="flex gap-2">
                        <select value={newSubTeamCat} onChange={e => setNewSubTeamCat(e.target.value)} className="flex-grow bg-white p-3 rounded-xl text-xs font-bold outline-none border">
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={addSubTeam} className="bg-pitch text-white p-3 rounded-xl active:scale-90"><Plus className="w-4 h-4"/></button>
                      </div>
                  </div>
                  <div className="space-y-2">
                      {subTeams.map(sub => (
                          <div key={sub.id} className="bg-white p-3 rounded-2xl flex items-center justify-between border shadow-sm group">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-pitch text-grass-500 rounded-lg flex items-center justify-center font-black text-xs">{sub.name.charAt(0)}</div>
                                  <div>
                                      <p className="text-[10px] font-black text-pitch uppercase">{sub.name}</p>
                                      <span className="text-[8px] font-bold text-gray-400">{sub.category}</span>
                                  </div>
                              </div>
                              <button type="button" onClick={() => setSubTeams(subTeams.filter(s => s.id !== sub.id))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"><Trash2 className="w-4 h-4"/></button>
                          </div>
                      ))}
                  </div>
              </div>
            </section>
          )}

          <Button type="submit" className="w-full py-6 rounded-[2rem] text-lg shadow-2xl shadow-grass-500/20 uppercase font-black tracking-widest mt-4">
            Salvar Alterações
          </Button>
        </form>
      </div>
    </div>
  );
};
