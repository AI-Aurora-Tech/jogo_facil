
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
    if (!categoryInput.trim()) return;
    if (teamCategories.length >= 2) {
      setError('O time pode ter no máximo 2 categorias.');
      return;
    }
    const formatted = formatCategory(categoryInput);
    if (formatted && !teamCategories.includes(formatted)) {
      setTeamCategories([...teamCategories, formatted]);
      setCategoryInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <div className="bg-pitch p-8 text-white flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-lg ${isSuperAdminMode ? 'bg-yellow-500 text-pitch' : 'bg-grass-500 text-pitch'}`}>
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black italic uppercase leading-none">
                {isSuperAdminMode ? 'Sugerir Alterações' : 'Configurações'}
              </h3>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-1">
                {isSuperAdminMode ? 'Modo Super Admin - Pedro' : 'Perfil & Conta'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
            <X className="w-6 h-6"/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10 overflow-y-auto no-scrollbar pb-10">
          {isSuperAdminMode && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl text-yellow-800 text-[10px] font-black uppercase flex items-center gap-3">
               <AlertCircle className="w-5 h-5" /> Você está sugerindo mudanças. O dono da conta precisará aprovar.
            </div>
          )}

          {/* Dados Pessoais */}
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
                <div className="bg-gray-50 p-4 rounded-2xl border col-span-full">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1.5"><Lock className="w-3 h-3"/> Mudar Senha (deixe vazio para não alterar)</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-transparent font-black outline-none text-pitch" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
            </div>
          </section>

          {/* Arena ou Time */}
          {isFieldOwner ? (
            <section className="space-y-6">
               <div className="flex items-center gap-3 border-b pb-2">
                  <Building2 className="w-4 h-4 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest">Arena</h4>
              </div>
              <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Estabelecimento</label>
                      <input className="w-full bg-transparent font-black outline-none text-pitch text-lg" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Endereço</label>
                      <input className="w-full bg-transparent font-black outline-none text-pitch" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
                  </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
               <div className="flex items-center gap-3 border-b pb-2">
                  <Shield className="w-4 h-4 text-grass-600" />
                  <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest">Equipe</h4>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                  <input className="w-full bg-transparent font-black outline-none text-pitch text-lg" value={teamName} onChange={e => setTeamName(e.target.value)} />
              </div>
            </section>
          )}

          <div className="pt-6 sticky bottom-0 bg-white pb-4">
            <Button type="submit" className={`w-full py-5 rounded-[2rem] text-sm uppercase font-black tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${isSuperAdminMode ? 'bg-pitch' : 'bg-grass-600'}`}>
              <Check className="w-5 h-5" /> {isSuperAdminMode ? 'Enviar para Aprovação' : 'Salvar Dados'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
