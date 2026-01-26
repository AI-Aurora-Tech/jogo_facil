
import React, { useState } from 'react';
import { User, UserRole, SubTeam, Field } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Upload, Check, Plus, AlertCircle, Building2, MapPin, Trash2, Smartphone, ImageIcon, Camera, Globe } from 'lucide-react';
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

  // Estados do Time (Apenas Capitão)
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
      setError('Máximo de 2 categorias por time.');
      return;
    }
    if (selectedNewCat && !teamCategories.includes(selectedNewCat)) {
      setTeamCategories([...teamCategories, selectedNewCat]);
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Prepara objeto de usuário limpo
    const updatedUser: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: !isFieldOwner ? teamName : user.teamName,
      teamCategories: !isFieldOwner ? teamCategories : user.teamCategories,
      teamLogoUrl: !isFieldOwner ? teamLogo : user.teamLogoUrl,
      subTeams: !isFieldOwner ? subTeams : user.subTeams
    };

    // Prepara objeto de arena limpo
    let updatedField: Partial<Field> | undefined = undefined;
    if (isFieldOwner && field) {
        updatedField = {
            name: arenaName,
            location: arenaLocation,
            imageUrl: arenaImage,
            contactPhone: phone // Sincroniza fone
        };
    }

    onUpdate(updatedUser, updatedField);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-pitch/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center relative">
          <div>
            <h3 className="text-2xl font-black italic tracking-tighter uppercase">Configurações</h3>
            <p className="text-[10px] font-black text-grass-500 uppercase tracking-widest">Ajuste seu perfil e sua {isFieldOwner ? 'Arena' : 'Equipe'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10 overflow-y-auto no-scrollbar pb-16">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 text-[10px] font-black uppercase">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          {/* SEÇÃO: ARENA (SE FOR DONO) */}
          {isFieldOwner && (
            <section className="space-y-6 animate-in slide-in-from-top-4 duration-500">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2 mb-4 border-b pb-2">
                  <Building2 className="w-3.5 h-3.5 text-grass-600" /> Detalhes da sua Arena
              </h4>
              
              <div className="flex flex-col md:flex-row gap-6">
                  <div className="relative shrink-0 mx-auto md:mx-0">
                      <div className="w-32 h-32 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group relative">
                          {arenaImage ? <img src={arenaImage} className="w-full h-full object-cover"/> : <ImageIcon className="w-10 h-10 text-gray-300"/>}
                          <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'ARENA')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="absolute inset-0 bg-pitch/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-6 h-6" />
                          </div>
                      </div>
                      <span className="block text-center text-[8px] font-black text-gray-400 uppercase mt-2 italic">Foto Principal</span>
                  </div>
                  
                  <div className="flex-grow space-y-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-xl" placeholder="Nome da sua Arena" value={arenaName} onChange={e => setArenaName(e.target.value)} required />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Endereço Físico</label>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-grass-600" />
                            <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-xs" placeholder="Rua, Número, Bairro, Cidade" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} required />
                          </div>
                      </div>
                  </div>
              </div>
            </section>
          )}

          {/* SEÇÃO: TIME (SE FOR CAPITÃO) */}
          {!isFieldOwner && (
            <section className="space-y-6 pt-2">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2 mb-4 border-b pb-2">
                  <Shield className="w-3.5 h-3.5 text-grass-600" /> Gestão da Equipe
              </h4>
              <div className="flex flex-col md:flex-row gap-6">
                   <div className="relative shrink-0 mx-auto md:mx-0">
                      <div className="w-32 h-32 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shadow-inner group relative">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Shield className="w-10 h-10 text-gray-300"/>}
                          <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'TEAM')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className="absolute inset-0 bg-pitch/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white w-6 h-6" />
                          </div>
                      </div>
                      <span className="block text-center text-[8px] font-black text-gray-400 uppercase mt-2 italic">Escudo</span>
                  </div>
                  <div className="flex-grow space-y-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                          <input type="text" className="w-full bg-transparent font-black outline-none text-pitch text-lg" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: Galáticos FC" />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Categorias de Atuação:</label>
                          <div className="flex gap-2 mb-3">
                              <select value={selectedNewCat} onChange={e => setSelectedNewCat(e.target.value)} className="flex-grow bg-white p-2 rounded-xl text-[10px] font-black outline-none border border-gray-200">
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <button type="button" onClick={addCategory} className="bg-pitch text-white px-4 rounded-xl active:scale-90 transition-transform"><Plus className="w-4 h-4"/></button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {teamCategories.map(cat => (
                                  <div key={cat} className="bg-grass-500 text-pitch px-3 py-1.5 rounded-lg text-[9px] font-black flex items-center gap-2 border border-pitch/10 shadow-sm animate-in zoom-in-95">
                                      {cat}
                                      <button type="button" onClick={() => setTeamCategories(teamCategories.filter(c => c !== cat))} className="hover:text-white"><X className="w-2.5 h-2.5"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
            </section>
          )}

          {/* SEÇÃO: DADOS DO RESPONSÁVEL (COMUM) */}
          <section className="space-y-4 pt-6 border-t border-gray-100">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2 mb-4">
                <UserIcon className="w-3.5 h-3.5 text-grass-600" /> Dados Pessoais
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Gestor</label>
                    <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-grass-500 transition-colors">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">WhatsApp (DDD + Número)</label>
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-grass-600" />
                        <input type="text" className="w-full bg-transparent font-black outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </div>
                </div>
            </div>
          </section>

          <Button type="submit" className="w-full py-6 rounded-[2.5rem] text-lg shadow-2xl shadow-grass-500/20 uppercase font-black tracking-widest mt-6 bg-grass-600 hover:bg-grass-700">
            Confirmar Alterações
          </Button>
        </form>
      </div>
    </div>
  );
};
