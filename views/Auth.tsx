
import React, { useState } from 'react';
import { UserRole, SubscriptionPlan } from '../types';
import { Button } from '../components/Button';
import { Mail, Lock, User as UserIcon, ArrowRight, Phone, MapPin, DollarSign, Key, AlertCircle, Image as ImageIcon, Upload, X, Tag, Plus } from 'lucide-react';
import { api } from '../services/api';
import { convertFileToBase64 } from '../utils';

interface AuthProps {
  categories: string[];
  onLogin: (user: any) => void;
  onCancel: () => void;
}

export const Auth: React.FC<AuthProps> = ({ categories, onLogin, onCancel }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.TEAM_CAPTAIN);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Field Owner Specific
  const [arenaName, setArenaName] = useState('');
  const [address, setAddress] = useState('');

  // Team Specific
  const [teamName, setTeamName] = useState('');
  const [teamCategories, setTeamCategories] = useState<string[]>([]);
  const [selectedCatToAdd, setSelectedCatToAdd] = useState(categories[0] || "");
  const [teamLogo, setTeamLogo] = useState('');

  const handleAddCategory = () => {
    if (!selectedCatToAdd) return;
    if (teamCategories.length >= 2) {
      setError('Você pode escolher no máximo 2 categorias para o seu time.');
      return;
    }
    if (!teamCategories.includes(selectedCatToAdd)) {
      setTeamCategories([...teamCategories, selectedCatToAdd]);
      setError('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setTeamCategories(teamCategories.filter(c => c !== cat));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit check
        setError('A imagem deve ter no máximo 1MB.');
        return;
      }
      try {
        const base64 = await convertFileToBase64(file);
        setTeamLogo(base64);
      } catch (err) {
        setError('Erro ao processar imagem.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegistering && role === UserRole.TEAM_CAPTAIN && teamCategories.length === 0) {
      setError('Selecione ao menos uma categoria para o seu time.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegistering) {
        let initialSubscription = SubscriptionPlan.NONE;
        
        if (role === UserRole.TEAM_CAPTAIN) {
            initialSubscription = SubscriptionPlan.NONE;
        } else if (role === UserRole.FIELD_OWNER) {
            initialSubscription = SubscriptionPlan.FREE;
        }

        const payload: any = {
          email,
          password,
          role: email.toLowerCase().includes('admin') ? UserRole.ADMIN : role,
          name,
          phoneNumber: phone,
          subscription: initialSubscription,
          subscriptionExpiry: null,
          latitude: -23.6337,
          longitude: -46.7905,
          teamName: role === UserRole.TEAM_CAPTAIN ? teamName : undefined,
          teamCategories: role === UserRole.TEAM_CAPTAIN ? teamCategories : [],
          teamLogoUrl: role === UserRole.TEAM_CAPTAIN ? teamLogo : undefined,
          subTeams: [],
          fieldData: role === UserRole.FIELD_OWNER ? {
            name: arenaName,
            location: address,
            hourlyRate: 0,
            cancellationFeePercent: 0,
            pixConfig: { key: '', name: '' },
            contactPhone: phone
          } : undefined
        };
        const newUser = await api.register(payload);
        onLogin(newUser);
      } else {
        const user = await api.login(email, password);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Erro na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-10 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-grass-500 outline-none text-white placeholder-gray-400";
  const simpleInputClass = "w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-grass-500 outline-none text-white placeholder-gray-400";

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl my-4 md:my-10 border border-gray-700">
        <div className="bg-grass-600 p-6 text-center">
          <h2 className="text-2xl font-bold text-white">
            {isRegistering ? 'Criar Conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-grass-100 mt-2">Acesse o Jogo Fácil</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-4">
          
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded flex items-center gap-2 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {!isRegistering ? (
             <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input type="email" required className={inputClass} placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input type="password" required className={inputClass} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
              </div>
             </div>
          ) : (
            <div className="space-y-6">
              
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Eu sou:</label>
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => setRole(UserRole.TEAM_CAPTAIN)}
                    className={`cursor-pointer p-4 border-2 rounded-xl text-center transition flex flex-col items-center justify-center gap-2 ${role === UserRole.TEAM_CAPTAIN ? 'bg-grass-900 border-grass-500 text-white font-bold' : 'hover:bg-gray-700 border-gray-600 text-gray-300'}`}
                  >
                    <span className="text-2xl">⚽</span> 
                    <span className="text-sm md:text-base">Capitão de Time</span>
                  </div>
                  <div 
                    onClick={() => setRole(UserRole.FIELD_OWNER)}
                    className={`cursor-pointer p-4 border-2 rounded-xl text-center transition flex flex-col items-center justify-center gap-2 ${role === UserRole.FIELD_OWNER ? 'bg-grass-900 border-grass-500 text-white font-bold' : 'hover:bg-gray-700 border-gray-600 text-gray-300'}`}
                  >
                    <span className="text-2xl">🏟️</span>
                    <span className="text-sm md:text-base">Dono de Campo</span>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Seu Nome Completo</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <input type="text" required className={inputClass} placeholder="Nome" value={name} onChange={setName ? (e => setName(e.target.value)) : undefined} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">WhatsApp / Celular</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <input type="tel" required className={inputClass} placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <input type="email" required className={inputClass} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <input type="password" required className={inputClass} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                 </div>
              </div>

              {/* Team Specific */}
              {role === UserRole.TEAM_CAPTAIN && (
                <div className="bg-gray-700 p-4 rounded-xl border border-gray-600">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">🏁 Informações do Time</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Nome do Time</label>
                      <input type="text" required className={simpleInputClass} placeholder="Ex: Os Boleiros FC" value={teamName} onChange={e => setTeamName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Categorias (Máx 2)</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-grow p-3 bg-gray-600 border border-gray-500 rounded-lg text-white outline-none focus:ring-1 focus:ring-grass-500"
                          value={selectedCatToAdd}
                          onChange={e => setSelectedCatToAdd(e.target.value)}
                        >
                          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <button 
                          type="button" 
                          onClick={handleAddCategory}
                          className="bg-grass-600 p-3 rounded-lg hover:bg-grass-500 transition active:scale-95 disabled:opacity-50"
                          disabled={teamCategories.length >= 2}
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2">
                       <div className="flex flex-wrap gap-2 mb-4">
                          {teamCategories.length === 0 && <p className="text-xs text-gray-400 italic">Nenhuma categoria selecionada.</p>}
                          {teamCategories.map(cat => (
                            <div key={cat} className="bg-grass-900/50 border border-grass-500 text-grass-400 px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-2">
                               {cat}
                               <button type="button" onClick={() => handleRemoveCategory(cat)} className="hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                       </div>

                       <label className="block text-sm font-medium text-gray-300 mb-1">Logo do Time</label>
                       {!teamLogo ? (
                         <div className="relative border-2 border-dashed border-gray-500 rounded-lg p-4 hover:border-grass-500 hover:bg-gray-600 transition cursor-pointer text-center group">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center gap-2 text-gray-400 group-hover:text-white">
                                <Upload className="w-8 h-8" />
                                <span className="text-sm">Toque para enviar uma foto (Máx 1MB)</span>
                            </div>
                         </div>
                       ) : (
                          <div className="relative w-24 h-24 mx-auto bg-gray-800 rounded-full border-2 border-grass-500 overflow-hidden group">
                             <img src={teamLogo} alt="Logo Preview" className="w-full h-full object-cover" />
                             <button 
                                type="button"
                                onClick={() => setTeamLogo('')}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                             >
                                <X className="text-white w-6 h-6" />
                             </button>
                          </div>
                       )}
                    </div>
                  </div>
                </div>
              )}

              {role === UserRole.FIELD_OWNER && (
                <div className="bg-gray-700 p-4 rounded-xl border border-gray-600 space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2">🏟️ Informações da Arena</h3>
                  <div className="grid gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-1">Nome do Local / Arena</label>
                       <input type="text" required className={simpleInputClass} placeholder="Ex: Arena Jogo Fácil" value={arenaName} onChange={e => setArenaName(e.target.value)} />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-1">Endereço Completo</label>
                       <div className="relative">
                         <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                         <input type="text" required className={inputClass} placeholder="Rua, Número, Bairro, Cidade" value={address} onChange={e => setAddress(e.target.value)} />
                       </div>
                     </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full mt-6 justify-center text-lg py-3">
            {isRegistering ? 'Finalizar Cadastro' : 'Entrar'} <ArrowRight className="w-5 h-5" />
          </Button>

          <div className="text-center mt-4">
            <button 
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="text-sm text-white hover:text-white/80 font-bold underline"
            >
              {isRegistering ? 'Já tenho conta? Entrar' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
          
          <div className="text-center">
             <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-400">Voltar para Home</button>
          </div>
        </form>
      </div>
    </div>
  );
};
