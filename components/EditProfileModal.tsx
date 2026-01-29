
import React, { useState } from 'react';
import { User, UserRole, Field, TeamConfig } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Check, Plus, AlertCircle, Building2, MapPin, Smartphone, Camera, Trash2 } from 'lucide-react';
import { formatCategory, convertFileToBase64 } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, field, onUpdate, onClose }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [teams, setTeams] = useState<TeamConfig[]>(user.teams || []);
  
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaLocation, setArenaLocation] = useState(field?.location || '');
  const [arenaPrice, setArenaPrice] = useState(field?.hourlyRate || 0);

  const [catInput, setCatInput] = useState('');
  const [error, setError] = useState('');

  const handleAddTeam = () => {
    if (teams.length >= 2) return;
    setTeams([...teams, { name: 'Novo Time', categories: [] }]);
  };

  const handleRemoveTeam = (index: number) => {
    setTeams(teams.filter((_, i) => i !== index));
  };

  const updateTeamName = (index: number, val: string) => {
    const newTeams = [...teams];
    newTeams[index].name = val;
    setTeams(newTeams);
  };

  const addCategoryToTeam = (index: number) => {
    const formatted = formatCategory(catInput);
    if (!formatted) return;
    const newTeams = [...teams];
    if (!newTeams[index].categories.includes(formatted)) {
      newTeams[index].categories.push(formatted);
      setTeams(newTeams);
      setCatInput('');
    }
  };

  const removeCategoryFromTeam = (teamIndex: number, cat: string) => {
    const newTeams = [...teams];
    newTeams[teamIndex].categories = newTeams[teamIndex].categories.filter(c => c !== cat);
    setTeams(newTeams);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teams.length === 0) {
      setError('Adicione pelo menos um time.');
      return;
    }
    const updatedUser = { ...user, name, phoneNumber: phone, teams };
    let updatedField;
    if (user.role === UserRole.FIELD_OWNER && field) {
      updatedField = { name: arenaName, location: arenaLocation, hourlyRate: arenaPrice };
    }
    onUpdate(updatedUser, updatedField);
  };

  return (
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurações do Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-red-500 rounded-xl transition-all"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase border border-red-100 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Conta</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3" /> Meus Times (Max 2)</h4>
              {teams.length < 2 && (
                <button type="button" onClick={handleAddTeam} className="text-[10px] font-black text-grass-500 uppercase flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar</button>
              )}
            </div>

            <div className="grid gap-4">
              {teams.map((team, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-200 relative">
                  <button type="button" onClick={() => handleRemoveTeam(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                  
                  <div className="mb-4">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time {idx + 1}</label>
                    <input className="w-full bg-transparent border-b-2 font-black text-lg outline-none text-pitch focus:border-pitch" value={team.name} onChange={e => updateTeamName(idx, e.target.value)} />
                  </div>

                  <div className="flex gap-2">
                    <input className="flex-1 bg-white p-3 rounded-xl border text-xs font-bold" placeholder="Add Categoria (ex: sub 9)" value={catInput} onChange={e => setCatInput(e.target.value)} />
                    <button type="button" onClick={() => addCategoryToTeam(idx)} className="bg-pitch text-white p-3 rounded-xl"><Plus className="w-4 h-4"/></button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {team.categories.map(c => (
                      <div key={c} className="bg-white border-2 border-pitch px-3 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                        {c} <X onClick={() => removeCategoryFromTeam(idx, c)} className="w-3 h-3 cursor-pointer text-red-500" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {user.role === UserRole.FIELD_OWNER && (
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Building2 className="w-3 h-3" /> Arena</h4>
              <div className="space-y-3">
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold" placeholder="Nome da Arena" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold" placeholder="Localização" value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold" type="number" placeholder="Preço" value={arenaPrice} onChange={e => setArenaPrice(Number(e.target.value))} />
              </div>
            </section>
          )}

          <Button type="submit" className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Salvar Alterações</Button>
        </form>
      </div>
    </div>
  );
};
