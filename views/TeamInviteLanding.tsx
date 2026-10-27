import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Calendar, Loader2, Shield, Home, X, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { CATEGORY_ORDER, TeamInvitePreview, User } from '../types';
import { api } from '../api';

interface TeamInviteLandingProps {
  token: string;
  currentUser: User | null;
  /** Categorias cadastradas pelo admin (lista usada no app). */
  categories: string[];
  /** Abre login/cadastro. No time da casa, o cadastro já vem com o nome do time. */
  onAuth: (mode: 'LOGIN' | 'REGISTER', invite: TeamInvitePreview) => void;
  onUserUpdated: (u: User) => void;
  onDone: () => void;
  onDismiss: () => void;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const sameName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * Tela aberta pelo convite de time do campo:
 * - Mensalista: o dono do time escolhe qual time e a categoria daquele horário fixo.
 * - Time da casa: a pessoa vira dona do time e escolhe as categorias.
 */
export const TeamInviteLanding: React.FC<TeamInviteLandingProps> = ({ token, currentUser, categories, onAuth, onUserUpdated, onDone, onDismiss }) => {
  const [invite, setInvite] = useState<TeamInvitePreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [teamIdx, setTeamIdx] = useState(0);
  const [category, setCategory] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  useEffect(() => {
    api.getTeamInvite(token)
      .then(setInvite)
      .catch(e => setError(e.message || 'Convite inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const teams = currentUser?.teams || [];
  const allCategories = categories.length > 0 ? categories : CATEGORY_ORDER;
  const isCaptain = currentUser?.role === 'TEAM_CAPTAIN';

  // Time da casa: começa com as categorias que a pessoa já tem num time com o mesmo nome
  const existingHomeTeam = useMemo(
    () => (invite?.kind === 'LOCAL' ? teams.find(t => sameName(t.name, invite.teamName)) : undefined),
    [invite, teams]
  );
  useEffect(() => {
    if (existingHomeTeam) setSelectedCats(existingHomeTeam.categories || []);
  }, [existingHomeTeam]);

  // Mensalista: categoria padrão = 1ª categoria do time escolhido
  const chosenTeam = teams[teamIdx] || teams[0];
  useEffect(() => {
    if (invite?.kind === 'MENSALISTA' && chosenTeam && !category) setCategory(chosenTeam.categories?.[0] || '');
  }, [invite, chosenTeam]);

  const accept = async () => {
    if (!invite || !currentUser) return;
    if (invite.kind === 'MENSALISTA' && (!chosenTeam || !category)) {
      alert('Escolha o time e a categoria.');
      return;
    }
    if (invite.kind === 'LOCAL' && selectedCats.length === 0) {
      alert('Escolha pelo menos uma categoria do time.');
      return;
    }
    setSending(true);
    try {
      const res = invite.kind === 'MENSALISTA'
        ? await api.claimTeamInvite(token, { teamName: chosenTeam!.name, category })
        : await api.claimTeamInvite(token, { categories: selectedCats });
      try {
        onUserUpdated(await api.getUserById(currentUser.id));
      } catch { /* atualiza no próximo login */ }
      alert(res.message);
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${active ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-400'}`;

  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <button onClick={onDismiss} className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full"><X className="w-5 h-5" /></button>

        {loading && <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pitch" /></div>}

        {!loading && error && (
          <div className="p-10 text-center space-y-6">
            <h2 className="text-xl font-black text-pitch uppercase italic">Convite indisponível</h2>
            <p className="text-sm text-gray-500 font-bold">{error}</p>
            <Button onClick={onDismiss} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Continuar</Button>
          </div>
        )}

        {!loading && invite && (
          <>
            <div className="h-36 bg-pitch relative">
              {invite.field.imageUrl && <img src={invite.field.imageUrl} className="w-full h-full object-cover opacity-60" />}
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <p className="text-[10px] font-black uppercase text-grass-400">
                  {invite.kind === 'MENSALISTA' ? 'Convite para ser mensalista' : 'Convite para o time da casa'}
                </p>
                <h2 className="text-2xl font-black uppercase italic leading-none truncate">
                  {invite.kind === 'LOCAL' ? invite.teamName : invite.field.name}
                </h2>
              </div>
            </div>

            <div className="p-8 space-y-5">
              <div className="space-y-2 text-sm font-bold text-pitch">
                <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> <span>{invite.field.name}<br /><span className="text-xs text-gray-400">{invite.field.location}</span></span></p>
                {invite.kind === 'MENSALISTA' && (
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Toda {WEEKDAYS[invite.fixedDay ?? -1] || '—'} às {invite.fixedTime} ({invite.durationMinutes} min)
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-1 rounded-lg uppercase">{invite.sport}</span>
                  {invite.courtName && <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-lg uppercase">Quadra {invite.courtName}</span>}
                  {invite.gender && <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-lg uppercase">{invite.gender}</span>}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 text-[10px] font-bold text-gray-500 uppercase leading-relaxed">
                {invite.kind === 'MENSALISTA'
                  ? 'Seu time fica com este horário toda semana. Você escolhe a categoria que joga nele e convida os adversários. Os jogos entram na sua agenda automaticamente.'
                  : 'Você vira o responsável por este time: cria as categorias, aprova adversários nos jogos em casa e também pode marcar jogos fora.'}
              </div>

              {!invite.open && <p className="text-center text-xs font-black text-red-500 uppercase">Este convite já foi aceito.</p>}

              {invite.open && !currentUser && (
                <div className="space-y-3">
                  <Button onClick={() => onAuth('REGISTER', invite)} className="w-full py-4 rounded-2xl font-black uppercase text-xs">
                    {invite.kind === 'LOCAL' ? <Home className="w-4 h-4" /> : <Shield className="w-4 h-4" />} Criar conta e aceitar
                  </Button>
                  <button onClick={() => onAuth('LOGIN', invite)} className="w-full text-[10px] font-black uppercase text-pitch">Já tenho conta</button>
                </div>
              )}

              {invite.open && currentUser && !isCaptain && (
                <p className="text-center text-xs font-bold text-gray-500">Entre com uma conta de dono de time para aceitar o convite.</p>
              )}

              {invite.open && isCaptain && invite.kind === 'MENSALISTA' && (
                <div className="space-y-3">
                  {teams.length === 0 ? (
                    <p className="text-xs font-bold text-gray-500">Cadastre um time no seu perfil para aceitar o convite.</p>
                  ) : (
                    <>
                      {teams.length > 1 && (
                        <div>
                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Qual time?</label>
                          <select className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold" value={teamIdx} onChange={e => { setTeamIdx(Number(e.target.value)); setCategory(''); }}>
                            {teams.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Categoria que joga neste horário</label>
                        <select className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold" value={category} onChange={e => setCategory(e.target.value)}>
                          <option value="">Selecione</option>
                          {(chosenTeam?.categories || []).map(c => <option key={`t-${c}`} value={c}>{c}</option>)}
                          {allCategories.filter(c => !(chosenTeam?.categories || []).includes(c)).map(c => <option key={c} value={c}>{c} (adicionar ao time)</option>)}
                        </select>
                      </div>
                      <Button onClick={accept} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-pitch">
                        <Check className="w-4 h-4" /> Aceitar: {chosenTeam?.name} {category && `• ${category}`}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {invite.open && isCaptain && invite.kind === 'LOCAL' && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-gray-400 uppercase">Categorias do {invite.teamName}</p>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCats(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))}
                        className={chip(selectedCats.includes(c))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Você pode mudar as categorias depois no seu perfil.</p>
                  <Button onClick={accept} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-pitch">
                    <Check className="w-4 h-4" /> Aceitar e ser o responsável
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
