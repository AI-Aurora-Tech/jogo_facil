
import React, { useState } from 'react';
import { User, COMMON_CATEGORIES } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Upload, Check } from 'lucide-react';
import { convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onUpdate, onClose }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');

  const toggleCategory = (cat: string) => {
    setTeamCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
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
    onUpdate({
      ...user,
      name,
      phoneNumber: phone,
      teamName,
      teamCategories,
      teamLogoUrl: teamLogo
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-black">Configurações do Perfil</h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto">
          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Informações Pessoais</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-2xl border">
                    <label className="text-[10px] font-bold text-gray-400">Seu Nome</label>
                    <input type="text" className="w-full bg-transparent font-bold outline-none" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border">
                    <label className="text-[10px] font-bold text-gray-400">WhatsApp</label>
                    <input type="text" className="w-full bg-transparent font-bold outline-none" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meu Time</h4>
            <div className="flex items-center gap-6">
                <div className="relative group">
                    <div className="w-24 h-24 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                        {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Shield className="w-10 h-10 text-gray-300"/>}
                        <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                </div>
                <div className="flex-grow bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[10px] font-bold text-gray-400">Nome do Time Único</label>
                    <input type="text" className="w-full bg-transparent text-xl font-black outline-none" placeholder="Ex: Galácticos FC" value={teamName} onChange={e => setTeamName(e.target.value)} />
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400">Categorias que jogamos:</label>
                <div className="flex flex-wrap gap-2">
                    {COMMON_CATEGORIES.map(cat => (
                        <button 
                            key={cat} 
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${teamCategories.includes(cat) ? 'bg-grass-500 border-grass-500 text-pitch' : 'bg-white text-gray-400 border-gray-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
          </section>

          <Button type="submit" className="w-full py-5 rounded-[2rem] text-lg shadow-xl">Salvar Perfil</Button>
        </form>
      </div>
    </div>
  );
};
