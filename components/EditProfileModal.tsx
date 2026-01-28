
import React, { useState } from 'react';
import { User, UserRole, Field } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Check, Plus, AlertCircle, Building2, MapPin, Smartphone, Camera, Settings, Image as ImageIcon, Upload } from 'lucide-react';
import { formatCategory, convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
  isSuperAdminMode?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, field, onUpdate, onClose }) => {
  const isFieldOwner = user.role === UserRole.FIELD_OWNER;
  
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaImage, setArenaImage] = useState(field?.imageUrl || '');
  const [arenaPrice, setArenaPrice] = useState(field?.hourlyRate || 0);

  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamLogoUrl, setTeamLogoUrl] = useState(user.teamLogoUrl || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [categoryInput, setCategoryInput] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const addCategory = () => {
    const formatted = formatCategory(categoryInput);
    if (!formatted) return;
    if (teamCategories.length >= 2) {
      setError('Máximo de 2 categorias por time.');
      return;
    }
    if (formatted && !teamCategories.includes(formatted)) {
      setTeamCategories([...teamCategories, formatted]);
      setCategoryInput('');
      setError('');
    }
  };

  const removeCategory = (cat: string) => {
    setTeamCategories(teamCategories.filter(c => c !== cat));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const base64 = await convertFileToBase64(file);
        setTeamLogoUrl(base64);
      } finally { setIsUploading(false); }
    }
  };

  const handleArenaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const base64 = await convertFileToBase64(file);
        setArenaImage(base64);
      } finally { setIsUploading(false); }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (teamCategories.length === 0 || teamCategories.length > 2) {
      setError('O time deve ter entre 1 e 2 categorias.');
      return;
    }

    if (isFieldOwner && (!arenaName || !arenaLocation)) {
      setError('Dados da arena são obrigatórios.');
      return;
    }

    const updatedUser: User = { ...user, name, phoneNumber: phone, teamName, teamCategories, teamLogoUrl };
    let updatedField: Partial<Field> | undefined = undefined;
    
    if (isFieldOwner && field) {
        updatedField = {
            name: arenaName,
            location: arenaLocation,
            imageUrl: arenaImage,
            hourlyRate: arenaPrice,
            contactPhone: phone
        };
    }

    onUpdate(updatedUser, updatedField);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurações do Perfil</h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-red-500 transition-all"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto no-scrollbar pb-10">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100"><AlertCircle className="w-4 h-4"/> {error}</div>}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Responsável</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Shield className="w-3 h-3" /> Minha Equipe</h4>
            <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                <div className="flex items-center gap-4 mb-6">
                   <div className="relative group">
                      <div className="w-20 h-20 bg-pitch rounded-3xl flex items-center justify-center overflow-hidden border-4 border-white shadow-xl bg-gray-100">
                         {teamLogoUrl ? <img src={teamLogoUrl} className="w-full h-full object-cover" /> : <Shield className="w-8 h-8 text-grass-500" />}
                      </div>
                      <label className="absolute -bottom-2 -right-2 bg-pitch text-white p-2 rounded-xl border-2 border-white cursor-pointer shadow-lg active:scale-95 transition-all">
                        <Camera className="w-3 h-3" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                   </div>
                   <div className="flex-1 min-w-0">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                      <input className="w-full bg-transparent border-b-2 border-gray-100 p-1 font-black text-xl outline-none text-pitch focus:border-pitch transition-all" placeholder="Nome do Time" value={teamName} onChange={e => setTeamName(e.target.value)} />
                   </div>
                </div>
                
                <div className="flex gap-2">
                   <input 
                    className="flex-1 bg-white p-3 rounded-xl border text-xs font-bold" 
                    placeholder="Nova Categoria (ex: sub 10)" 
                    value={categoryInput} 
                    onChange={e => setCategoryInput(e.target.value)} 
                   />
                   <button type="button" onClick={addCategory} className="bg-pitch text-white p-3 rounded-xl active:scale-95 transition-all"><Plus className="w-4 h-4"/></button>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {teamCategories.map(c => (
                    <div key={c} className="bg-pitch text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 animate-in slide-in-from-left duration-200 shadow-sm">
                      {c} <X onClick={() => removeCategory(c)} className="w-3 h-3 cursor-pointer text-red-500" />
                    </div>
                  ))}
                </div>
            </div>
          </section>

          {isFieldOwner && (
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Building2 className="w-3 h-3" /> Minha Arena</h4>
              <div className="space-y-4">
                  <div className="relative h-48 rounded-[2.5rem] overflow-hidden border-2 border-gray-100 bg-gray-50 group shadow-inner">
                      {arenaImage ? <img src={arenaImage} className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                           <ImageIcon className="w-10 h-10" />
                           <span className="text-[10px] font-black uppercase">Foto da Arena</span>
                        </div>
                      )}
                      <label className="absolute bottom-4 right-4 bg-white text-pitch px-4 py-2 rounded-xl shadow-xl font-black text-[10px] uppercase flex items-center gap-2 cursor-pointer active:scale-95 transition-all hover:bg-gray-100">
                        <Upload className="w-3 h-3" /> Alterar Foto
                        <input type="file" accept="image/*" className="hidden" onChange={handleArenaImageUpload} />
                      </label>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                    <input className="w-full bg-transparent font-bold outline-none text-pitch" placeholder="Nome da Arena" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Endereço Completo</label>
                    <input className="w-full bg-transparent font-bold outline-none text-pitch" placeholder="Endereço Completo" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between">
                    <span className="text-[8px] font-black text-gray-400 uppercase">Preço Base por Hora (R$)</span>
                    <input type="number" className="bg-transparent font-black text-right w-20 outline-none text-pitch" value={arenaPrice} onChange={e => setArenaPrice(Number(e.target.value))} />
                  </div>
              </div>
            </section>
          )}

          <Button type="submit" isLoading={isUploading} className="w-full py-5 rounded-[2rem] text-sm uppercase font-black shadow-xl">
            <Check className="w-5 h-5 mr-2" /> Salvar Perfil
          </Button>
        </form>
      </div>
    </div>
  );
};
