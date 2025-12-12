import React, { useState } from 'react';
import { User, SubTeam, COMMON_CATEGORIES } from '../types';
import { Button } from './Button';
import { X, Plus, Trash, User as UserIcon, Shield, Upload } from 'lucide-react';
import { convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onUpdate, onClose }) => {
  // Personal Info
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);

  // Team Management
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCategory, setNewTeamCategory] = useState(COMMON_CATEGORIES[6]); // Default Sub-20
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [teams, setTeams] = useState<SubTeam[]>(user.subTeams || []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        setNewTeamLogo(base64);
      } catch (err) {
        alert('Erro ao processar imagem.');
      }
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim()) {
      const newTeam: SubTeam = {
        id: Math.random().toString(36).substr(2, 9),
        name: newTeamName.trim(),
        category: newTeamCategory,
        logoUrl: newTeamLogo || undefined
      };
      setTeams([...teams, newTeam]);
      setNewTeamName('');
      setNewTeamLogo('');
    }
  };

  const handleRemoveTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...user,
      name,
      phoneNumber: phone,
      subTeams: teams
    });
    onClose();
  };

  const inputClass = "w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-grass-500 outline-none transition";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-grass-700 p-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <UserIcon className="w-6 h-6" /> Minha Conta
            </h3>
            <p className="text-grass-100 text-sm opacity-80">Mantenha seus dados atualizados para facilitar o contato.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
            <X className="w-6 h-6"/>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          {/* Section 1: Personal Data */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-grass-400 border-b border-gray-700 pb-2">Dados Pessoais</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1 font-medium">Nome Completo</label>
                <input type="text" className={inputClass} value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1 font-medium">WhatsApp</label>
                <input type="text" className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Section 2: Teams Management */}
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-gray-700 pb-2">
               <h4 className="text-lg font-semibold text-grass-400">Meus Times</h4>
               <span className="text-xs text-gray-500">Cadastre suas categorias para poder agendar jogos.</span>
            </div>
            
            {/* Add Team Form */}
            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
               <label className="block text-sm text-gray-300 mb-2 font-bold">Adicionar Novo Time</label>
               <div className="flex flex-col gap-3">
                 <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <input 
                        type="text" 
                        className={inputClass} 
                        placeholder="Nome do Time (Ex: Os Boleiros)"
                        value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)}
                        />
                    </div>
                    <div className="md:w-1/3">
                        <select 
                        className={inputClass}
                        value={newTeamCategory}
                        onChange={e => setNewTeamCategory(e.target.value)}
                        >
                        {COMMON_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                        </select>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                       {!newTeamLogo ? (
                           <div className="border border-dashed border-gray-600 rounded p-2 text-center text-xs text-gray-400 hover:bg-gray-700 cursor-pointer relative">
                              <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0" />
                              <span className="flex items-center justify-center gap-2"><Upload className="w-4 h-4"/> Logo do Time (Upload)</span>
                           </div>
                       ) : (
                           <div className="flex items-center gap-2 text-green-400 text-xs bg-green-400/10 p-2 rounded border border-green-400/30">
                              <Shield className="w-4 h-4" /> Logo carregada
                              <button type="button" onClick={() => setNewTeamLogo('')}><X className="w-3 h-3 text-red-400"/></button>
                           </div>
                       )}
                    </div>
                    <Button type="button" onClick={handleAddTeam} className="w-auto">
                        <Plus className="w-5 h-5" /> Adicionar
                    </Button>
                 </div>
               </div>
            </div>
            
            {/* Teams List */}
            <div className="space-y-2">
              {teams.length === 0 && (
                <div className="text-center py-6 bg-gray-700/30 rounded-lg border border-dashed border-gray-600">
                  <Shield className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">Você ainda não cadastrou nenhum time.</p>
                </div>
              )}
              {teams.map((t) => (
                <div key={t.id} className="bg-gray-700 flex justify-between items-center p-3 rounded-lg border border-gray-600 shadow-sm">
                  <div className="flex items-center gap-3">
                    {t.logoUrl ? (
                         <img src={t.logoUrl} className="w-10 h-10 rounded-full object-cover border border-gray-500" />
                    ) : (
                        <div className="bg-grass-600 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold">
                            {t.name.substring(0,2).toUpperCase()}
                        </div>
                    )}
                    <div>
                      <p className="font-bold text-white">{t.name}</p>
                      <span className="text-xs bg-gray-900 text-gray-300 px-2 py-0.5 rounded border border-gray-700">{t.category}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRemoveTeam(t.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-gray-600 rounded transition">
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-700">
            <Button type="submit" size="lg" className="w-full">Salvar Informações</Button>
          </div>
        </form>
      </div>
    </div>
  );
};