
import React, { useState } from 'react';
import { User, UserRole, Field } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Check, Plus, AlertCircle, Building2, MapPin, Smartphone, Camera, Settings, Lock } from 'lucide-react';
import { convertFileToBase64, formatCategory } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
  isSuperAdminMode?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ categories, user, field, onUpdate, onClose, isSuperAdminMode }) => {
  const isFieldOwner = user.role === UserRole.FIELD_OWNER;
  
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [password, setPassword] = useState('');
  
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaImage, setArenaImage] = useState(field?.imageUrl || '');

  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');
  
  const [categoryInput, setCategoryInput] = useState('');
  const [error, setError] = useState('');

  const addCategory = () => {
    if (teamCategories.length >= 2) {
      setError('Máximo de 2 categorias por time.');
      return;
    }
    const formatted = formatCategory(categoryInput);
    if (formatted && !teamCategories.includes(formatted)) {
      setTeamCategories([...teamCategories, formatted]);
      setCategoryInput('');
      setError('');
    }
  };

  const removeCategory = (cat: string) => {
    setTeamCategories(teamCategories.filter(c => c !== cat));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === UserRole.TEAM_CAPTAIN && (teamCategories.length === 0 || teamCategories.length > 2)) {
      setError('O time deve ter entre 1 e 2 categorias.');
      return;
    }

    const updatedUser: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: teamName,
      teamCategories: teamCategories,
      teamLogoUrl: teamLogo,
      password: password || undefined
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
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-grass-500 rounded-2xl text-pitch">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black italic uppercase italic">Configurações</h3>
          </div>
          <button type="button" onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-all">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto no-scrollbar pb-10">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100"><AlertCircle className="w-4 h-4"/> {error}</div>}

          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-2">
                <UserIcon className="w-4 h-4 text-grass-600" />
                <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest">Responsável</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                    <input className="w-full bg-transparent font-black outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                    <input className="w-full bg-transparent font-black outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
            </div>
          </section>

          {!isFieldOwner && (
            <section className="space-y-6">
               <div className="flex items-center gap-3 border-b pb-2">
                  <Shield className="w-4 h-4 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest">Dados do Time</h4>
              </div>
              <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200">
                  <input className="w-full bg-transparent border-b-2 border-gray-100 p-2 font-black text-xl outline-none mb-4" placeholder="Nome do Time" value={teamName} onChange={e => setTeamName(e.target.value)} />
                  
                  <div className="flex gap-2">
                     <select className="flex-1 bg-white p-3 rounded-xl border text-[10px] font-black uppercase" value={categoryInput} onChange={e => setCategoryInput(e.target.value)}>
                        <option value="">Adicionar Categoria</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <button type="button" onClick={addCategory} className="bg-pitch text-white p-3 rounded-xl"><Plus className="w-4 h-4"/></button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {teamCategories.map(c => (
                      <div key={c} className="bg-white border-2 border-pitch px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                        {c} <X onClick={() => removeCategory(c)} className="w-3 h-3 cursor-pointer text-red-500" />
                      </div>
                    ))}
                  </div>
              </div>
            </section>
          )}

          {isFieldOwner && (
            <section className="space-y-6">
               <div className="flex items-center gap-3 border-b pb-2">
                  <Building2 className="w-4 h-4 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest">Arena</h4>
              </div>
              <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                      <input className="w-full bg-transparent font-black outline-none text-pitch text-lg" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Endereço Completo</label>
                      <input className="w-full bg-transparent font-black outline-none text-pitch" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
                  </div>
              </div>
            </section>
          )}

          <div className="pt-6">
            <Button type="submit" className="w-full py-5 rounded-[2rem] text-sm uppercase font-black tracking-widest shadow-xl flex items-center justify-center gap-3">
              <Check className="w-5 h-5" /> Salvar Alterações
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
