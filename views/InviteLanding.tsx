import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Calendar, Trophy, Loader2, Swords, Star, X } from 'lucide-react';
import { Button } from '../components/Button';
import { InvitePreview, User } from '../types';
import { api } from '../api';

interface InviteLandingProps {
  token: string;
  currentUser: User | null;
  /** Abre login/cadastro. No cadastro, a conta já nasce com a categoria do jogo. */
  onAuth: (mode: 'LOGIN' | 'REGISTER', category?: string) => void;
  onUserUpdated: (u: User) => void;
  onDone: () => void;
  onDismiss: () => void;
}

/** Tela aberta pelo link de convite: mostra o jogo e inscreve o time como adversário. */
export const InviteLanding: React.FC<InviteLandingProps> = ({ token, currentUser, onAuth, onUserUpdated, onDone, onDismiss }) => {
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamIdx, setTeamIdx] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.getInvite(token)
      .then(setInvite)
      .catch(e => setError(e.message || 'Convite inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const accepted = useMemo(() => {
    if (!invite) return [] as string[];
    return invite.allowedCategories.length > 0 ? invite.allowedCategories : invite.category ? [invite.category] : [];
  }, [invite]);

  const teams = currentUser?.teams || [];
  const eligible = teams
    .map((t, idx) => ({ t, idx, cat: t.categories.find(c => accepted.length === 0 || accepted.includes(c)) }))
    .filter(x => !!x.cat);

  const apply = async (teamName: string, category: string) => {
    if (!invite) return;
    setSending(true);
    try {
      const res = await api.match('apply', invite.slotId, { teamName, category, inviteToken: token });
      alert(res.message || 'Inscrição enviada!');
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  /** O time não tem a categoria do jogo: adiciona e já se inscreve. */
  const addCategoryAndApply = async () => {
    if (!currentUser || !invite || !invite.category || teams.length === 0) return;
    const team = teams[teamIdx] || teams[0];
    const newTeams = teams.map(t => (t.name === team.name ? { ...t, categories: [...t.categories, invite.category!] } : t));
    if (!confirm(`Adicionar ${invite.category} ao ${team.name}?`)) return;
    setSending(true);
    try {
      const updated = await api.updateUser({ ...currentUser, teams: newTeams, password: undefined });
      onUserUpdated(updated);
      await apply(team.name, invite.category);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <button onClick={onDismiss} className="absolute top-5 right-5 z-10 p-2 bg-white/80 rounded-full"><X className="w-5 h-5" /></button>

        {loading && <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pitch" /></div>}

        {!loading && error && (
          <div className="p-10 text-center space-y-6">
            <h2 className="text-xl font-black text-pitch uppercase italic">Convite indisponível</h2>
            <p className="text-sm text-gray-500 font-bold">{error}</p>
            <Button onClick={onDismiss} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Ver outros jogos</Button>
          </div>
        )}

        {!loading && invite && (
          <>
            <div className="h-36 bg-pitch relative">
              {invite.field.imageUrl && <img src={invite.field.imageUrl} className="w-full h-full object-cover opacity-60" />}
              <div className="absolute bottom-4 left-6 text-white">
                <p className="text-[10px] font-black uppercase text-grass-400">Você foi convidado para um jogo</p>
                <h2 className="text-2xl font-black uppercase italic leading-none">{invite.homeTeamName}</h2>
              </div>
            </div>

            <div className="p-8 space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-lg uppercase">{invite.matchKindLabel}</span>
                {invite.category && <span className="text-[9px] font-black bg-grass-100 text-grass-700 px-2 py-1 rounded-lg uppercase">{invite.category}</span>}
                <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-1 rounded-lg uppercase">{invite.sport}</span>
              </div>

              <div className="space-y-2 text-sm font-bold text-pitch">
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> {invite.date.split('-').reverse().join('/')} às {invite.time}</p>
                <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> <span>{invite.field.name}<br /><span className="text-xs text-gray-400">{invite.field.location}</span></span></p>
                {invite.field.ratingCount > 0 && (
                  <p className="flex items-center gap-2 text-xs"><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /> {invite.field.ratingAvg.toFixed(1)} ({invite.field.ratingCount} avaliações)</p>
                )}
                {invite.matchKind === 'FESTIVAL' && invite.prizeDescription && (
                  <p className="flex items-center gap-2 text-yellow-700"><Trophy className="w-4 h-4" /> Prêmio: {invite.prizeDescription}</p>
                )}
              </div>

              {!invite.open && <p className="text-center text-xs font-black text-red-500 uppercase">Este jogo já tem adversário.</p>}

              {invite.open && !currentUser && (
                <div className="space-y-3">
                  <Button onClick={() => onAuth('REGISTER', invite.category)} className="w-full py-4 rounded-2xl font-black uppercase text-xs">
                    <Swords className="w-4 h-4" /> Criar conta grátis e jogar
                  </Button>
                  <p className="text-[9px] text-center text-gray-400 font-bold uppercase">O Jogo Fácil é gratuito</p>
                  <button onClick={() => onAuth('LOGIN')} className="w-full text-[10px] font-black uppercase text-pitch">Já tenho conta</button>
                </div>
              )}

              {invite.open && currentUser && currentUser.role !== 'TEAM_CAPTAIN' && (
                <p className="text-center text-xs font-bold text-gray-500">Entre com uma conta de dono de time para aceitar o convite.</p>
              )}

              {invite.open && currentUser?.role === 'TEAM_CAPTAIN' && eligible.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Jogar com:</p>
                  {eligible.map(({ t, cat }) => (
                    <Button key={t.name} onClick={() => apply(t.name, cat!)} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-pitch">
                      {t.name} • {cat}
                    </Button>
                  ))}
                </div>
              )}

              {invite.open && currentUser?.role === 'TEAM_CAPTAIN' && eligible.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500">Nenhum time seu tem a categoria {accepted.join(' / ') || invite.category}.</p>
                  {teams.length > 1 && (
                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold" value={teamIdx} onChange={e => setTeamIdx(Number(e.target.value))}>
                      {teams.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                    </select>
                  )}
                  {invite.category && teams.length > 0 && (
                    <Button onClick={addCategoryAndApply} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs">
                      Adicionar {invite.category} e jogar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
