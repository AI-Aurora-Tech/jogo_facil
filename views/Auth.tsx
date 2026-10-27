
import React, { useState } from 'react';
import { UserRole, SubscriptionPlan, CATEGORY_ORDER, Gender } from '../types';
import { Button } from '../components/Button';
import { Shield, MapPin, AlertCircle, KeyRound, ChevronLeft, Camera, LayoutGrid, Loader2, Eye, EyeOff } from 'lucide-react';
import { api, ServerError } from '../api';
import { openPasswordHelpWhatsApp } from '../support';
import { convertFileToBase64, fetchAddressByCEP, geocodeAddressParts, GeoResult } from '../utils';
import { ArenaLocation } from '../components/ArenaLocation';

interface AuthProps {
  categories: string[];
  onLogin: (user: any) => void;
  onCancel: () => void;
  initialMode?: AuthMode;
  /** Cadastro vindo de um convite: conta de time com só a categoria do jogo (grátis). */
  inviteCategory?: string;
  /** Cadastro vindo de convite de time do campo: conta de dono de time (sem opção de dono de campo). */
  teamInvite?: { kind: 'MENSALISTA' | 'LOCAL'; teamName?: string; fieldName: string };
}

export type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

/**
 * Recuperação de senha por código no e-mail (Resend). Desligada por enquanto:
 * "Esqueci a senha" leva direto para o WhatsApp do suporte.
 * Para religar, troque para true (e configure RESEND_API_KEY e EMAIL_FROM na Vercel).
 */
const EMAIL_PASSWORD_RESET_ENABLED = false;

export const Auth: React.FC<AuthProps> = ({ onLogin, onCancel, initialMode, inviteCategory, teamInvite }) => {
  const [mode, setMode] = useState<AuthMode>(initialMode || 'LOGIN');
  const isInviteSignup = mode === 'REGISTER' && !!inviteCategory;
  const isTeamInviteSignup = mode === 'REGISTER' && !!teamInvite;
  const [role, setRole] = useState<UserRole>(UserRole.TEAM_CAPTAIN);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Recuperação de senha: 1) pede o código por e-mail  2) informa código + nova senha
  const [resetCodeSent, setResetCodeSent] = useState(false);
  // Recuperação de senha pelo WhatsApp do suporte (padrão enquanto o e-mail estiver desligado)
  const [resetViaSupport, setResetViaSupport] = useState(!EMAIL_PASSWORD_RESET_ENABLED);
  const [resetCode, setResetCode] = useState('');

  // Common Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Field Owner Specific States
  const [arenaName, setArenaName] = useState('');

  const [arenaPhoto, setArenaPhoto] = useState('');

  const [complement, setComplement] = useState('');
  const [courts, setCourts] = useState<string[]>(['Principal']);
  const [newCourt, setNewCourt] = useState('');

  // Address / CEP
  const [cep, setCep] = useState('');
  // Coordenadas da arena (GPS no local ou pelo endereço)
  const [arenaGeo, setArenaGeo] = useState<GeoResult | null>(null);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  // Captain Specific States
  // Time da casa: o cadastro já nasce com o nome do time do convite
  const [teamName, setTeamName] = useState(teamInvite?.kind === 'LOCAL' ? teamInvite.teamName || '' : '');
  const [teamCategories, setTeamCategories] = useState<string[]>(inviteCategory ? [inviteCategory] : []);
  const [teamGender, setTeamGender] = useState<Gender>('MASCULINO');
  const [teamSport, setTeamSport] = useState('Futebol');
  const [teamLogo, setTeamLogo] = useState('');


  const toggleCategory = (cat: string) => {
    if (teamCategories.includes(cat)) {
      setTeamCategories(teamCategories.filter(c => c !== cat));
    } else {
      setTeamCategories([...teamCategories, cat]);
      setError('');
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'REGISTER') {
      if (!name || !email || !password || !phone) {
         setError('Preencha todos os dados pessoais.');
         return;
      }

      // Validação CAPITÃO
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

      // Validação DONO DE CAMPO
      if (role === UserRole.FIELD_OWNER) {
        if (!arenaName) {
            setError('O nome da arena é obrigatório.');
            return;
        }
        if (!cep || !street || !number || !city) {
            setError('O endereço da arena precisa estar completo (CEP, Rua, Número).');
            return;
        }
      }
    }

    if (mode === 'FORGOT_PASSWORD') {
      // Recuperação pelo WhatsApp: Enter no campo de e-mail abre o WhatsApp em vez de pedir código
      if (resetViaSupport) {
        openPasswordHelpWhatsApp(email);
        return;
      }
      if (!email) {
        setError('Informe o e-mail cadastrado.');
        return;
      }
      if (resetCodeSent && (resetCode.replace(/\D/g, '').length !== 6 || !password)) {
        setError('Informe o código de 6 dígitos e a nova senha.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'REGISTER') {
        
        // Constrói o endereço completo para salvar no banco
        let fullAddress = '';
        let geo: GeoResult | null = null;
        if (role === UserRole.FIELD_OWNER) {
            fullAddress = `${street}, ${number}`;
            if (neighborhood) fullAddress += ` - ${neighborhood}`;
            fullAddress += ` - ${city} - ${state}, ${cep}`;
            // Salva a posição da arena no cadastro (antes a distância era adivinhada a cada busca)
            geo = arenaGeo || await geocodeAddressParts({ street, number, neighborhood, city, state, cep });
        }

        const payload = {
          email: email.toLowerCase().trim(),
          password,
          role,
          name,
          phoneNumber: phone,
          subscription: role === UserRole.FIELD_OWNER ? SubscriptionPlan.PRO_FIELD : SubscriptionPlan.NONE,
          teams: role === UserRole.TEAM_CAPTAIN ? [{ 
              name: teamName, 
              categories: teamCategories, 
              logoUrl: teamLogo, 
              gender: teamGender,
              sport: teamSport
          }] : [],
          teamLogoUrl: role === UserRole.TEAM_CAPTAIN ? teamLogo : undefined,
          fieldData: role === UserRole.FIELD_OWNER ? {
            name: arenaName,
            location: fullAddress,
            contactPhone: phone,
            imageUrl: arenaPhoto,
            latitude: geo?.lat,
            longitude: geo?.lng,
            pixKey: undefined,
            pixName: undefined,
            complement,
            courts: courts
          } : undefined
        };
        await api.register(payload);
        // Entra logo em seguida para obter a sessão do servidor (usada em partidas e pagamentos)
        try {
          onLogin(await api.login(payload.email, password));
        } catch (loginErr: any) {
          setMode('LOGIN');
          setError(`Sua conta foi criada, mas não conseguimos entrar agora: ${loginErr?.message || 'erro no servidor'}`);
        }
      } else if (mode === 'LOGIN') {
        const user = await api.login(email, password);
        onLogin(user);
      } else if (mode === 'FORGOT_PASSWORD') {
        setError('');
        if (!resetCodeSent) {
          setSuccessMsg(await api.requestPasswordReset(email));
          setResetCodeSent(true);
          setPassword('');
        } else {
          setSuccessMsg(await api.resetPassword(email, resetCode, password));
          setResetCodeSent(false);
          setResetCode('');
          setTimeout(() => { setMode('LOGIN'); setSuccessMsg(''); }, 3000);
        }
      }
    } catch (err: any) {
      if (mode === 'FORGOT_PASSWORD' && err instanceof ServerError && err.code === 'EMAIL_NOT_CONFIGURED') {
        setResetViaSupport(true);
        setError('');
      } else {
        setError(err.message || 'Erro na operação.');
      }
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-[3.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 my-10">
        <div className="bg-pitch p-10 text-center text-white relative">
          {mode !== 'LOGIN' && (
             <button onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); setResetCodeSent(false); setResetCode(''); }} className="absolute top-8 left-8 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                <ChevronLeft className="w-6 h-6 text-white" />
             </button>
          )}
          <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">
            {mode === 'REGISTER' ? 'Nova Conta' : mode === 'FORGOT_PASSWORD' ? 'Recuperar Senha' : 'Jogo Fácil'}
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-grass-500 mt-2">
            {mode === 'REGISTER' ? 'Faça parte do futuro do futebol' : mode === 'FORGOT_PASSWORD' ? 'Defina sua nova senha' : 'Bem-vindo de volta, craque'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100"><AlertCircle className="w-4 h-4"/> {error}</div>}
          {successMsg && <div className="bg-grass-50 text-grass-600 p-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 border border-grass-100"><KeyRound className="w-4 h-4"/> {successMsg}</div>}

          {mode === 'REGISTER' && (
            <>
              {isInviteSignup && (
                <div className="bg-grass-50 border border-grass-100 p-4 rounded-2xl text-[10px] font-bold text-grass-700 uppercase">
                  Conta de time para a categoria {inviteCategory}. Depois do cadastro você já entra no jogo do convite.
                </div>
              )}
              {isTeamInviteSignup && (
                <div className="bg-grass-50 border border-grass-100 p-4 rounded-2xl text-[10px] font-bold text-grass-700 uppercase">
                  {teamInvite!.kind === 'LOCAL'
                    ? `Conta do responsável pelo time da casa ${teamInvite!.teamName || ''} (${teamInvite!.fieldName}). Depois do cadastro você confirma o convite.`
                    : `Conta do seu time para ser mensalista na arena ${teamInvite!.fieldName}. Depois do cadastro você escolhe a categoria do horário.`}
                </div>
              )}
              <div className={`grid grid-cols-2 gap-3 mb-6 ${isInviteSignup || isTeamInviteSignup ? 'hidden' : ''}`}>
                <button type="button" onClick={() => setRole(UserRole.TEAM_CAPTAIN)} className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all ${role === UserRole.TEAM_CAPTAIN ? 'border-pitch bg-pitch text-white' : 'border-gray-100 text-gray-300'}`}>
                   <Shield className="w-6 h-6" />
                   <span className="text-[10px] font-black uppercase">Sou Capitão</span>
                </button>
                <button type="button" onClick={() => setRole(UserRole.FIELD_OWNER)} className={`p-4 rounded-[1.5rem] border-2 flex flex-col items-center gap-2 transition-all ${role === UserRole.FIELD_OWNER ? 'border-pitch bg-pitch text-white' : 'border-gray-100 text-gray-300'}`}>
                   <MapPin className="w-6 h-6" />
                   <span className="text-[10px] font-black uppercase">Dono Arena</span>
                </button>
              </div>

              <div className="space-y-3">
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)} required />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="WhatsApp (com DDD)" value={phone} onChange={e => setPhone(e.target.value)} required />
                <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                
                <div className="relative">
                   <input className="w-full p-4 bg-gray-50 rounded-2xl border font-bold outline-none pr-10" placeholder="Senha" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required />
                   <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pitch">
                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </button>
                </div>
                
                {/* Campos para Capitão do Time */}
                {role === UserRole.TEAM_CAPTAIN && (
                  <div className="bg-gray-50 p-5 rounded-[2rem] border-2 border-dashed border-gray-200 mt-4 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dados do Seu Time</p>
                    
                    <div className="flex flex-col items-center mb-4">
                       <div className="w-20 h-20 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                          {teamLogo ? <img src={teamLogo} className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-gray-300" />}
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                             const f = e.target.files?.[0];
                             if(f) setTeamLogo(await convertFileToBase64(f));
                          }} />
                       </div>
                       <span className="text-[8px] font-black text-gray-400 uppercase mt-2">Logo do Time</span>
                    </div>

                    <input className="w-full bg-transparent border-b-2 border-gray-100 p-2 font-black text-lg outline-none focus:border-pitch transition-colors mb-4" placeholder="Nome do Time" value={teamName} onChange={e => setTeamName(e.target.value)} readOnly={isTeamInviteSignup && teamInvite?.kind === 'LOCAL'} required />
                    
                    <div className="mb-4">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Esporte Praticado</p>
                        <select 
                          className="w-full p-3 bg-white rounded-xl border font-bold text-xs outline-none"
                          value={teamSport}
                          onChange={e => setTeamSport(e.target.value)}
                        >
                          {["Futebol", "Volei", "Handball", "Basquete", "Tênis", "Beach Tenis"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Gênero do Time</p>
                        <div className="flex gap-1 p-1 bg-white rounded-xl border">
                            {['MASCULINO', 'FEMININO', 'MISTO'].map((g: any) => (
                              <button key={g} type="button" onClick={() => setTeamGender(g)} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${teamGender === g ? 'bg-pitch text-white' : 'text-gray-300 hover:text-gray-400'}`}>{g}</button>
                            ))}
                        </div>
                    </div>

                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">{isInviteSignup ? 'Categoria do jogo' : 'Quais categorias seu time joga?'}</p>
                    <div className={`grid grid-cols-4 gap-2 ${isInviteSignup ? 'hidden' : ''}`}>
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
                    
                    {isInviteSignup && (
                      <span className="inline-block px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-pitch text-white">{inviteCategory}</span>
                    )}

                  </div>
                )}

                {/* Campos para Dono da Arena */}
                {role === UserRole.FIELD_OWNER && (
                  <div className="bg-gray-50 p-5 rounded-[2rem] border-2 border-dashed border-gray-200 mt-4 space-y-3 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dados da Arena</p>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white p-3 rounded-xl border">
                           <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                           <input className="w-full bg-transparent font-bold text-pitch outline-none" value={arenaName} onChange={e => setArenaName(e.target.value)} required />
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center mb-2">
                       <div className="w-full h-32 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                          {arenaPhoto ? <img src={arenaPhoto} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center text-gray-300"><Camera className="w-8 h-8" /><span className="text-[8px] font-black uppercase mt-1">Foto da Arena</span></div>}
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => {
                             const f = e.target.files?.[0];
                             if(f) setArenaPhoto(await convertFileToBase64(f));
                          }} />
                       </div>
                    </div>





                    {/* SEÇÃO DE ENDEREÇO COM CEP */}
                    <div className="bg-white p-4 rounded-xl border space-y-3">
                         <div className="grid grid-cols-3 gap-2">
                             <div className="relative">
                               <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">CEP</label>
                               <input 
                                  className="w-full bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none" 
                                  placeholder="00000-000" 
                                  value={cep} 
                                  onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} 
                                  onBlur={handleCEPBlur}
                                  required
                               />
                               {isLoadingCEP && <div className="absolute right-2 top-6 animate-spin"><Loader2 className="w-3 h-3 text-pitch"/></div>}
                             </div>
                             <div className="col-span-2">
                               <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Cidade / Estado</label>
                               <input className="w-full bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none text-gray-500" value={`${city}${state ? ' - ' + state : ''}`} readOnly tabIndex={-1} placeholder="Automático" />
                             </div>
                         </div>
                         
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Rua / Logradouro</label>
                            <input className="w-full bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none" value={street} onChange={e => setStreet(e.target.value)} placeholder="Endereço" required />
                         </div>

                         <div className="grid grid-cols-2 gap-2">
                             <div>
                               <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Número</label>
                               <input className="w-full bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none" value={number} onChange={e => setNumber(e.target.value)} placeholder="123" required />
                             </div>
                             <div>
                               <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Complemento (Opcional)</label>
                               <input className="w-full bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none" value={complement} onChange={e => setComplement(e.target.value)} placeholder="Apto, Bloco..." />
                             </div>
                         </div>

                         <div className="bg-white p-3 rounded-xl border">
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Bairro</label>
                            <input className="w-full bg-transparent font-bold text-pitch outline-none" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Bairro" required />
                         </div>

                         <ArenaLocation
                           value={arenaGeo}
                           onChange={setArenaGeo}
                           onSearchAddress={() => geocodeAddressParts({ street, number, neighborhood, city, state, cep })}
                         />

                         {/* GESTÃO DE QUADRAS */}
                         <div className="bg-white p-4 rounded-xl border space-y-3">
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Campos / Quadras</label>
                            <div className="flex gap-2">
                               <input 
                                 className="flex-1 bg-gray-50 p-2 rounded-lg font-bold text-xs outline-none" 
                                 placeholder="Ex: Quadra Society A"
                                 value={newCourt}
                                 onChange={e => setNewCourt(e.target.value)}
                               />
                               <button type="button" onClick={() => {
                                 if (newCourt.trim()) {
                                   setCourts([...courts, newCourt.trim()]);
                                   setNewCourt('');
                                 }
                               }} className="bg-pitch text-white px-3 rounded-lg"><LayoutGrid className="w-4 h-4"/></button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                               {courts.map(c => (
                                 <div key={c} className="bg-gray-100 px-2 py-1 rounded-md flex items-center gap-1">
                                   <span className="text-[8px] font-bold uppercase">{c}</span>
                                   <button type="button" onClick={() => setCourts(courts.filter(x => x !== c))} className="text-red-500">×</button>
                                 </div>
                               ))}
                            </div>
                         </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'LOGIN' && (
            <div className="space-y-4">
              <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Seu e-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <div className="relative">
                 <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none pr-10" placeholder="Sua senha" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pitch">
                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                 </button>
                 <button type="button" onClick={() => { setMode('FORGOT_PASSWORD'); setError(''); }} className="absolute right-4 bottom-2 text-[9px] font-black text-gray-400 uppercase hover:text-pitch transform translate-y-full">Esqueci a senha</button>
              </div>
            </div>
          )}

          {mode === 'FORGOT_PASSWORD' && resetViaSupport && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-700 text-[10px] font-bold">
                Para criar uma nova senha, fale com o nosso suporte pelo WhatsApp. A gente redefine para você rapidinho.
              </div>
              <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none" placeholder="Seu e-mail cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <Button type="button" onClick={() => openPasswordHelpWhatsApp(email)} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs">
                Pedir nova senha pelo WhatsApp
              </Button>
            </div>
          )}

          {mode === 'FORGOT_PASSWORD' && !resetViaSupport && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-orange-600 text-[10px] font-bold">
                 {resetCodeSent
                   ? 'Digite o código de 6 dígitos que enviamos para o seu e-mail e escolha a nova senha.'
                   : 'Informe seu e-mail cadastrado. Vamos enviar um código para você criar uma nova senha.'}
              </div>
              <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none disabled:opacity-60" placeholder="Seu e-mail cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={resetCodeSent} required />
              {resetCodeSent && (
                <>
                  <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none tracking-[0.5em] text-center" placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} required />
                  <div className="relative">
                     <input className="w-full p-5 bg-gray-50 rounded-2xl border font-bold outline-none pr-10" placeholder="Nova senha (mínimo 6 caracteres)" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pitch">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                  </div>
                  <button type="button" onClick={() => { setResetCodeSent(false); setResetCode(''); setSuccessMsg(''); setError(''); }} className="text-[9px] font-black text-gray-400 uppercase hover:text-pitch">
                    Não recebeu? Enviar outro código
                  </button>
                  <button type="button" onClick={() => openPasswordHelpWhatsApp(email)} className="block text-[9px] font-black text-gray-400 uppercase hover:text-pitch">
                    Ainda sem o código? Falar com o suporte no WhatsApp
                  </button>
                </>
              )}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} hidden={mode === 'FORGOT_PASSWORD' && resetViaSupport} className="w-full py-6 rounded-[2rem] font-black uppercase tracking-widest mt-6 text-sm shadow-xl active:scale-95">
            {mode === 'REGISTER' ? 'Finalizar Cadastro' : mode === 'FORGOT_PASSWORD' ? (resetCodeSent ? 'Redefinir Senha' : 'Enviar Código') : 'Entrar na Conta'}
          </Button>

          {mode === 'LOGIN' && (
            <div className="text-center mt-6">
              <button type="button" onClick={() => setMode('REGISTER')} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-pitch transition-colors">
                Não tem conta? Crie agora
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
