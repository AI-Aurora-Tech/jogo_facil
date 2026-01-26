
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Upload, Check, Plus, AlertCircle } from 'lucide-react';
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
  
  // Estados de time inicializados apenas se necessário
  const [teamName, setTeamName] = useState(user.teamName || '');
  const [teamCategories, setTeamCategories] = useState<string[]>(user.teamCategories || []);
  const [teamLogo, setTeamLogo] = useState(user.teamLogoUrl || '');
  const [selectedNewCat, setSelectedNewCat] = useState(categories[0] || '');
  const [error, setError] = useState('');

  const addCategory = () => {
    setError('');
    if (teamCategories.length >= 2) {
      setError('O limite máximo é de 2 categorias por time.');
      return;
    }
    if (selectedNewCat && !teamCategories.includes(selectedNewCat)) {
      setTeamCategories([...teamCategories, selectedNewCat]);
    }
  };

  const removeCategory = (cat: string) => {
    setError('');
    setTeamCategories(teamCategories.filter(c => c !== cat));
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
    if (!isFieldOwner && user.role === UserRole.TEAM_CAPTAIN && teamCategories.length === 0) {
      setError('Escolha pelo menos 1 categoria.');
      return;
    }
    
    // Payload limpo para Dono de Campo
    const updatedData: User = {
      ...user,
      name,
      phoneNumber: phone,
      teamName: isFieldOwner ? undefined : teamName,
      teamCategories: isFieldOwner ? [] : teamCategories,
      teamLogoUrl: isFieldOwner ? undefined : teamLogo
    };
    
    onUpdate(updatedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-black">{isFieldOwner ? 'Dados do Gestor' : 'Configurações do Perfil'}</h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 text-xs font-bold">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome Completo</label>
                    <input type="text" className="w-full bg-transparent font-bold outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">WhatsApp de Contato</label>
                    <input type="text" className="w-full bg-transparent font-bold outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
            </div>
          </section>

          {!isFieldOwner && (
            <section className="space-y-6 animate-in fade-in duration-300 border-t pt-8">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meu Time</h4>
              <div className="flex items-center gap-6">
                  <div className="relative group">
                      <div className="w-24 h-24 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover"/> : <Shield className="w-10 h-10 text-gray-300"/>}
                          <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                  </div>
                  <div className="flex-grow bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                      <input type="text" className="w-full bg-transparent text-xl font-black outline-none text-pitch" placeholder="Ex: Galácticos FC" value={teamName} onChange={e => setTeamName(e.target.value)} />
                  </div>
              </div>

              <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase block tracking-tighter">Categorias (Máx 2):</label>
                  <div className="flex gap-2">
                      <select 
                          value={selectedNewCat}
                          onChange={e => setSelectedNewCat(e.target.value)}
                          className="flex-grow p-4 bg-gray-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-grass-500 disabled:opacity-50 text-pitch"
                          disabled={teamCategories.length >= 2}
                      >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button 
                        type="button" 
                        onClick={addCategory} 
                        className="bg-pitch text-white px-6 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                        disabled={teamCategories.length >= 2}
                      >
                        <Plus className="w-6 h-6"/>
                      </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                      {teamCategories.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma categoria vinculada.</p>}
                      {teamCategories.map(cat => (
                          <div key={cat} className="bg-grass-100 text-grass-800 px-4 py-2 rounded-xl text-xs font-black border border-grass-200 flex items-center gap-2">
                              {cat}
                              <button type="button" onClick={() => removeCategory(cat)} className="text-grass-400 hover:text-red-500"><X className="w-3 h-3"/></button>
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
