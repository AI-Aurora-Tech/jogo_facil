
import React, { useState } from 'react';
import { UserRole, SubscriptionPlan, CATEGORY_ORDER } from '../types';
import { Button } from '../components/Button';
import { Mail, Lock, User as UserIcon, ArrowRight, Phone, MapPin, Shield, Tag, X, Plus, AlertCircle, Check } from 'lucide-react';
import { api } from '../api';
import { formatCategory } from '../utils';

interface AuthProps {
  categories: string[];
  onLogin: (user: any) => void;
  onCancel: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onCancel }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<UserRole>(UserRole.TEAM_CAPTAIN);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [arenaName, setArenaName] = useState('');
  const [address, setAddress] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamCategories, setTeamCategories] = useState<string[]>([]);

  const toggleCategory = (cat: string) => {
    if (teamCategories.includes(cat)) {
      setTeamCategories(teamCategories.filter(c => c !== cat));
    } else {
      if (teamCategories.length >= 5) { // Aumentei um pouco o limite para flexibilidade
        setError('Máximo de 5 categorias por time.');
        return;
      }
      setTeamCategories([...teamCategories, cat]);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      if (!name || !email || !password || !phone) {
         setError('Preencha todos os dados pessoais.');
         return;
      }

      // Validação específica para DONO DE TIME (Capitão)
      if (role === UserRole.TEAM_CAPTAIN) {
        if (!teamName) {
          setError('O nome do time é obrigatório.');
          return;
        }
        if (teamCategories.length === 0) {
          setError('Selecione pelo menos uma categoria para o time.');
          return;
        }
      }

      // Validação específica para DONO DE CAMPO
      if (role === UserRole.FIELD_OWNER && (!arenaName || !address)) {
        setError('Os dados da arena são obrigatórios.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        const payload = {
          email: email.toLowerCase().trim(),
          password,
          role,
          name,
          phoneNumber: phone,
          subscription: SubscriptionPlan.FREE,
          teams: role === UserRole.TEAM_CAPTAIN ? [{ name: teamName, categories: teamCategories }] : [],
          fieldData: role === UserRole.FIELD_OWNER ? {
            name: arenaName,
            location: address,
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
      setError(err.message || 'Erro na autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 my-10">
        <div className="bg-pitch p-10 text-center text-white">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">{isRegistering ? 'Nova Conta' : 'Jogo Fácil'}</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-grass-500 mt-2">{isRegistering ? 'Faça parte do futuro do futebol' : 'Bem-vindo de volta, craque'}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100"><AlertCircle className="w-4 h-4"/> {error}</div>}

          {isRegistering ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button type="button" onClick={() => setRole(UserRole.TEAM_CAPTAIN)} className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all ${role === UserRole.TEAM_CAPTAIN ? 'border-pitch bg-pitch text-white' : 'border-gray-100 text-gray-300'}`}>
                   <Shield className="w-6 h-6" />
                   <span className="text-[10px] font-black uppercase">Capitão</span>
                </button>
                <button type="button" onClick={() => setRole(UserRole.FIELD_OWNER)} className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all ${role === UserRole.FIELD_OWNER ? 'border-pitch bg-pitch text-white' : 'border-gray-100 text-gray-300'}`}>
                   <MapPin className="w-6 h-6" />
                   <span className="text-[10px] font-black uppercase">Dono Arena</span>
                </button>
              </div>

              <div className="space-y-3">
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} required />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} required />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                
                {/* Campos para Capitão do Time */}
                {role === UserRole.TEAM_CAPTAIN && (
                  <div className="bg-gray-50 p-5 rounded-[2rem] border-2 border-dashed border-gray-200 mt-4 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dados da Equipe</p>
                    <input className="w-full bg-transparent border-b-2 border-gray-100 p-2 font-black text-lg outline-none focus:border-pitch transition-colors mb-4" placeholder="Nome do seu Time" value={teamName} onChange={e => setTeamName(e.target.value)} required />
                    
                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Quais categorias seu time joga?</p>
                    <div className="grid grid-cols-4 gap-2">
                       {CATEGORY_ORDER.map(cat => (
                         <button
                           key={cat}
                           type="button"
                           onClick={() => toggleCategory(cat)}
                           className={`px-1 py-2 rounded-xl text-[8px] font-black uppercase transition-all border ${teamCategories.includes(cat) ? 'bg-pitch text-white border-pitch shadow-md' : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300'}`}
                         >
                           {cat}
                         </button>
                       ))}
                    </div>
                  </div>
                )}

                {/* Campos para Dono da Arena */}
                {role === UserRole.FIELD_OWNER && (
                  <div className="bg-gray-50 p-5 rounded-[2rem] border-2 border-dashed border-gray-200 mt-4 space-y-3 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dados da Arena</p>
                    <input className="w-full bg-transparent border-b-2 border-gray-100 p-2 font-black text-lg outline-none" placeholder="Nome da Arena" value={arenaName} onChange={e => setArenaName(e.target.value)} required />
                    <input className="w-full bg-transparent border-b-2 border-gray-100 p-2 font-bold text-sm outline-none" placeholder="Endereço Completo" value={address} onChange={e => setAddress(e.target.value)} required />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Seu e-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Sua senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full py-6 rounded-[2rem] font-black uppercase tracking-widest mt-6 text-sm shadow-xl active:scale-95">
            {isRegistering ? 'Finalizar Cadastro' : 'Entrar na Conta'}
          </Button>

          <div className="text-center mt-6">
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-pitch transition-colors">
              {isRegistering ? 'Já tem conta? Faça Login' : 'Não tem conta? Crie agora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
