
import React, { useState, useEffect } from 'react';
import { User, UserRole, Field, TeamConfig, Gender } from '../types';
import { Button } from './Button';
import { X, User as UserIcon, Shield, Check, Plus, AlertCircle, Building2, MapPin, Smartphone, Camera, Trash2, LayoutGrid, Tag, Lock, PlusCircle, Globe, Search, Eye, EyeOff } from 'lucide-react';
import { formatCategory, convertFileToBase64, geocodeAddress, fetchAddressByCEP } from '../utils';

interface EditProfileModalProps {
  categories: string[];
  user: User;
  field?: Field | null;
  onUpdate: (updatedUser: User, updatedField?: Partial<Field>) => void;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ categories, user, field, onUpdate, onClose }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber);
  const [newPassword, setNewPassword] = useState('');
  const [teams, setTeams] = useState<TeamConfig[]>(user.teams || []);
  const [showPassword, setShowPassword] = useState(false);
  
  // Arena State
  const [arenaName, setArenaName] = useState(field?.name || '');
  const [arenaPrice, setArenaPrice] = useState(field?.hourlyRate || 0);
  const [arenaPhoto, setArenaPhoto] = useState(field?.imageUrl || '');
  const [courts, setCourts] = useState<string[]>(field?.courts || ['Principal']);
  const [newCourtName, setNewCourtName] = useState('');
  
  // Address State (CEP Logic)
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [categoryInputs, setCategoryInputs] = useState<string[]>(['', '']);
  const [error, setError] = useState('');

  // Inicializa campos de endereço se já existir localização salva
  useEffect(() => {
    if (field?.location) {
      // Tenta parsing simples, mas o usuário provavelmente vai usar o CEP para corrigir
      const parts = field.location.split(',');
      if (parts.length > 0 && !street) {
        // Se já tem endereço salvo, mostramos no campo "Rua" como fallback
        setStreet(field.location); 
      }
    }
  }, [field]);

  const handleCEPBlur = async () => {
    if (cep.length < 8) return;
    setIsLoadingCEP(true);
    const data = await fetchAddressByCEP(cep);
    setIsLoadingCEP(false);
    
    if (data) {
      setStreet(data.logradouro);
      setNeighborhood(data.bairro);
      setCity(data.localidade);
      setState(data.uf);
      setError('');
    } else {
      setError('CEP não encontrado.');
    }
  };

  const handleAddTeam = () => {
    if (teams.length >= 2) return;
    setTeams([...teams, { name: 'Novo Time', categories: [], gender: 'MASCULINO' }]);
  };

  const handleRemoveTeam = (index: number) => {
    // Permite remover todos os times (pois Super Admin e Donos de Campo não precisam)
    setTeams(teams.filter((_, i) => i !== index));
  };

  const handleUpdateTeam = (index: number, updates: Partial<TeamConfig>) => {
    const newTeams = [...teams];
    newTeams[index] = { ...newTeams[index], ...updates };
    setTeams(newTeams);
  };

  const addCategoryToTeam = (teamIndex: number, catToAdd?: string) => {
    const input = catToAdd || categoryInputs[teamIndex];
    const formatted = formatCategory(input);
    if (!formatted) return;

    const team = teams[teamIndex];
    if (!team.categories.includes(formatted)) {
      handleUpdateTeam(teamIndex, { categories: [...team.categories, formatted] });
      if (!catToAdd) {
        const newInputs = [...categoryInputs];
        newInputs[teamIndex] = '';
        setCategoryInputs(newInputs);
      }
      setError('');
    }
  };

  const removeCategoryFromTeam = (teamIndex: number, cat: string) => {
    const team = teams[teamIndex];
    handleUpdateTeam(teamIndex, { categories: team.categories.filter(c => c !== cat) });
  };

  const handleAddCourt = () => {
    if (newCourtName.trim() && !courts.includes(newCourtName.trim())) {
      setCourts([...courts, newCourtName.trim()]);
      setNewCourtName('');
    }
  };

  const handleRemoveCourt = (court: string) => {
    if (courts.length <= 1) return;
    setCourts(courts.filter(c => c !== court));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        const updatedUser: User = { ...user, name, phoneNumber: phone, teams };
        if (newPassword.trim()) {
            updatedUser.password = newPassword.trim();
        }

        let updatedField;
        if (user.role === UserRole.FIELD_OWNER && field) {
          
          // Constrói string final do endereço
          let fullAddress = field.location;
          
          // Se o usuário preencheu o CEP e Rua, construímos o novo endereço padronizado
          if (street && city) {
             fullAddress = `${street}, ${number || 'S/N'}`;
             if (neighborhood) fullAddress += ` - ${neighborhood}`;
             fullAddress += ` - ${city} - ${state}`;
             if (cep) fullAddress += `, ${cep}`;
          } else if (street) {
             // Caso fallback onde ele só editou o texto livre
             fullAddress = street;
          }

          // Geocoding Automático
          let finalLat = field.latitude;
          let finalLng = field.longitude;

          // Se o endereço mudou ou se não tem coordenadas, busca agora
          if (fullAddress !== field.location || (finalLat === 0 && finalLng === 0)) {
              const coords = await geocodeAddress(fullAddress);
              if (coords) {
                  finalLat = coords.lat;
                  finalLng = coords.lng;
              }
          }

          updatedField = { 
            name: arenaName, 
            location: fullAddress, 
            hourlyRate: arenaPrice, 
            courts, 
            imageUrl: arenaPhoto,
            latitude: finalLat,
            longitude: finalLng
          };
        }
        
        onUpdate(updatedUser, updatedField);
    } catch (e) {
        setError("Erro ao salvar dados.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-pitch p-8 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurações do Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-red-500 rounded-xl transition-all"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto pb-20">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase border border-red-100 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><UserIcon className="w-3 h-3" /> Sua Conta</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Seu Nome</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp</label>
                  <input className="w-full bg-transparent font-bold outline-none text-pitch" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-orange-400" />
                <div className="flex-1 relative">
                    <label className="text-[8px] font-black text-orange-400 uppercase block mb-1">Alterar Senha (Opcional)</label>
                    <input 
                        className="w-full bg-transparent font-bold outline-none text-pitch placeholder-orange-200 pr-8" 
                        placeholder="Digite a nova senha para alterar" 
                        type={showPassword ? "text" : "password"}
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-orange-400 hover:text-orange-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>
          </section>

          {user.role === UserRole.FIELD_OWNER && (
            <section className="space-y-6">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2"><Building2 className="w-3 h-3" /> Dados da Arena</h4>
              <div className="flex flex-col items-center gap-2">
                 <div className="w-full h-40 bg-gray-100 rounded-[2rem] border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                    {arenaPhoto ? <img src={arenaPhoto} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                       const f = e.target.files?.[0];
                       if(f) setArenaPhoto(await convertFileToBase64(f));
                    }} />
                 </div>
                 <span className="text-[8px] font-black text-gray-400 uppercase">Foto da Arena</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                   <input className="w-full bg-transparent font-bold text-pitch outline-none" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Preço Base (R$)</label>
                   <input className="w-full bg-transparent font-bold text-pitch outline-none" type="number" value={arenaPrice} onChange={e => setArenaPrice(Number(e.target.value))} />
                </div>
              </div>
              
              {/* ADDRESS SECTION WITH CEP */}
              <div className="bg-gray-50 p-6 rounded-[2rem] border space-y-4">
                 <h5 className="text-[10px] font-black text-pitch uppercase tracking-widest flex items-center gap-2">
                   <MapPin className="w-3 h-3 text-grass-500" /> Endereço
                 </h5>
                 
                 <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 bg-white p-3 rounded-xl border relative">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">CEP</label>
                       <input 
                         className="w-full bg-transparent font-bold text-pitch outline-none" 
                         placeholder="00000-000"
                         value={cep} 
                         onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                         onBlur={handleCEPBlur}
                       />
                       {isLoadingCEP && <div className="absolute right-3 top-3 animate-spin rounded-full h-4 w-4 border-2 border-grass-500 border-t-transparent"></div>}
                    </div>
                    <div className="col-span-2 bg-white p-3 rounded-xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Cidade / UF</label>
                       <input 
                         className="w-full bg-transparent font-bold text-pitch outline-none disabled:text-gray-400" 
                         value={city && state ? `${city} - ${state}` : ''} 
                         readOnly
                         placeholder="Preenchido via CEP"
                       />
                    </div>
                 </div>

                 <div className="bg-white p-3 rounded-xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Rua / Logradouro</label>
                    <input 
                      className="w-full bg-transparent font-bold text-pitch outline-none" 
                      placeholder="Ex: Rua das Flores" 
                      value={street} 
                      onChange={e => setStreet(e.target.value)} 
                    />
                 </div>

                 <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 bg-white p-3 rounded-xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Número</label>
                       <input 
                         className="w-full bg-transparent font-bold text-pitch outline-none" 
                         placeholder="123" 
                         value={number} 
                         onChange={e => setNumber(e.target.value)} 
                       />
                    </div>
                    <div className="col-span-2 bg-white p-3 rounded-xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Bairro</label>
                       <input 
                         className="w-full bg-transparent font-bold text-pitch outline-none" 
                         value={neighborhood} 
                         onChange={e => setNeighborhood(e.target.value)} 
                       />
                    </div>
                 </div>
                 <p className="text-[8px] text-gray-400 italic font-bold text-center">* Ao salvar, o GPS da arena será atualizado automaticamente.</p>
              </div>

              {/* GESTÃO DE QUADRAS */}
              <div className="bg-gray-50 p-6 rounded-[2rem] border space-y-4">
                 <h5 className="text-[10px] font-black text-pitch uppercase tracking-widest flex items-center gap-2">
                   <LayoutGrid className="w-3 h-3 text-grass-500" /> Suas Quadras/Campos
                 </h5>
                 <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-white p-3 rounded-xl border text-xs font-bold outline-none focus:border-pitch" 
                      placeholder="Ex: Quadra Society A"
                      value={newCourtName}
                      onChange={e => setNewCourtName(e.target.value)}
                    />
                    <button type="button" onClick={handleAddCourt} className="bg-pitch text-white px-4 rounded-xl active:scale-95"><PlusCircle className="w-5 h-5"/></button>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {courts.map(court => (
                      <div key={court} className="bg-white px-3 py-2 rounded-xl border flex items-center gap-2 shadow-sm animate-in zoom-in-95">
                         <span className="text-[10px] font-black uppercase text-pitch">{court}</span>
                         <X onClick={() => handleRemoveCourt(court)} className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" />
                      </div>
                    ))}
                 </div>
              </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3" /> Seus Times</h4>
              {teams.length < 2 && (
                <button type="button" onClick={handleAddTeam} className="text-[10px] font-black text-grass-500 uppercase flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Time</button>
              )}
            </div>

            <div className="grid gap-6">
              {teams.length === 0 && (
                 <div className="p-4 bg-gray-50 border rounded-2xl text-[10px] text-gray-400 font-bold uppercase text-center">
                    Você não possui times cadastrados.
                 </div>
              )}
              {teams.map((team, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-200 relative space-y-4 group shadow-sm">
                  <button type="button" onClick={() => handleRemoveTeam(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-5 h-5"/>
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                       {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                       <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                          const f = e.target.files?.[0];
                          if(f) handleUpdateTeam(idx, { logoUrl: await convertFileToBase64(f) });
                       }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                      <input className="w-full bg-transparent border-b-2 font-black text-pitch text-lg outline-none focus:border-pitch" value={team.name} onChange={e => handleUpdateTeam(idx, { name: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Gênero</label>
                      <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                        {['MASCULINO', 'FEMININO', 'MISTO'].map((g: any) => (
                          <button key={g} type="button" onClick={() => handleUpdateTeam(idx, { gender: g })} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${team.gender === g ? 'bg-pitch text-white' : 'text-gray-300 hover:text-gray-400'}`}>{g}</button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categorias</label>
                      <div className="flex flex-wrap gap-1 mb-3 bg-gray-50 p-2 rounded-xl border border-gray-100 max-h-32 overflow-y-auto">
                         {categories.map(cat => {
                           const isSelected = team.categories.includes(cat);
                           return (
                             <button 
                               key={cat}
                               type="button"
                               onClick={() => {
                                 if(isSelected) removeCategoryFromTeam(idx, cat);
                                 else addCategoryToTeam(idx, cat);
                               }}
                               className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all border ${isSelected ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300'}`}
                             >
                               {cat}
                             </button>
                           );
                         })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Button type="submit" isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95">Salvar Todas as Configurações</Button>
        </form>
      </div>
    </div>
  );
};
