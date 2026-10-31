import React, { useEffect, useState } from 'react';
import { MapPin, Calendar, Loader2, X, Swords, Plane, Home } from 'lucide-react';
import { Button } from '../components/Button';
import { PublicAgenda, AgendaHomeGame, User } from '../types';
import { api } from '../api';
import { formatBRL } from '../shared/pricing';

interface TeamAgendaLandingProps {
  token: string;
  currentUser: User | null;
  /** Abre login/cadastro. No cadastro, a conta já nasce com a categoria escolhida. */
  onAuth: (mode: 'LOGIN' | 'REGISTER', category?: string) => void;
  onDone: () => void;
  onDismiss: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dateLabel = (d: string) => {
  const dt = new Date(`${d}T12:00:00`);
  return `${WEEKDAYS[dt.getDay()]} ${d.split('-').reverse().slice(0, 2).join('/')}`;
};

/**
 * Link exclusivo de um time: mostra os jogos em casa abertos (para desafiar) e os dias em
 * que o time quer jogar fora. Quem não tem conta cria uma (1ª categoria grátis).
 */
export const TeamAgendaLanding: React.FC<TeamAgendaLandingProps> = ({ token, currentUser, onAuth, onDone, onDismiss }) => {
  const [agenda, setAgenda] = useState<PublicAgenda | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [teamIdx, setTeamIdx] = useState(0);

  useEffect(() => {
    api.getPublicAgenda(token)
      .then(setAgenda)
      .catch(e => setError(e.message || 'Link inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const myTeams = currentUser?.teams || [];
  const isOwner = !!agenda && currentUser?.id === agenda.ownerUserId;
  const isCaptain = currentUser?.role === 'TEAM_CAPTAIN';

  const accepted = (g: AgendaHomeGame) => (g.allowedCategories.length > 0 ? g.allowedCategories : g.category ? [g.category] : []);

  const challenge = async (g: AgendaHomeGame) => {
    const team = myTeams[teamIdx] || myTeams[0];
    if (!team) return;
    const cat = team.categories.find(c => accepted(g).length === 0 || accepted(g).includes(c));
    if (!cat) {
      alert(`O ${team.name} não tem a categoria ${accepted(g).join(' / ')}. Adicione no seu perfil (1ª categoria grátis; R$ 19,99 por categoria adicional).`);
      return;
    }
    setSending(true);
    try {
      const res = await api.match('apply', g.slotId, { teamName: team.name, category: cat });
      alert(res.message || 'Inscrição enviada!');
      onDone();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <button onClick={onDismiss} className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full"><X className="w-5 h-5" /></button>

        {loading && <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pitch" /></div>}

        {!loading && error && (
          <div className="p-10 text-center space-y-6">
            <h2 className="text-xl font-black text-pitch uppercase italic">Agenda indisponível</h2>
            <p className="text-sm text-gray-500 font-bold">{error}</p>
            <Button onClick={onDismiss} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Continuar</Button>
          </div>
        )}

        {!loading && agenda && (
          <>
            <div className="bg-pitch p-8 pt-10 text-white flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {agenda.team.logoUrl ? <img src={agenda.team.logoUrl} className="w-full h-full object-cover" /> : <span className="text-2xl font-black">{agenda.team.name.charAt(0)}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase text-grass-400">Agenda do time</p>
                <h2 className="text-2xl font-black uppercase italic leading-none truncate">{agenda.team.name}</h2>
                <p className="text-[10px] font-bold text-gray-300 uppercase mt-1">{agenda.team.sport} • {agenda.team.categories.join(', ')}</p>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {!currentUser && (
                <div className="bg-grass-50 border border-grass-100 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase text-grass-700">Crie sua conta grátis (1ª categoria) e marque um jogo com o {agenda.team.name}.</p>
                  <Button onClick={() => onAuth('REGISTER', agenda.homeGames[0]?.category || undefined)} className="w-full py-4 rounded-2xl font-black uppercase text-xs"><Swords className="w-4 h-4" /> Criar conta grátis</Button>
                  <button onClick={() => onAuth('LOGIN')} className="w-full text-[10px] font-black uppercase text-pitch">Já tenho conta</button>
                </div>
              )}

              {isCaptain && !isOwner && myTeams.length > 1 && (
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Jogar com</label>
                  <select className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold" value={teamIdx} onChange={e => setTeamIdx(Number(e.target.value))}>
                    {myTeams.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Home className="w-4 h-4" /> Jogos em casa (procurando adversário)</p>
                {agenda.homeGames.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase">Nenhum jogo em casa aberto agora.</p>}
                {agenda.homeGames.map(g => (
                  <div key={g.slotId} className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-black text-pitch uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateLabel(g.date)} às {g.time} • {accepted(g).join(' / ')}</p>
                    <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {g.place.name}{g.place.location ? ` • ${g.place.location}` : ''}</p>
                    <p className="text-[10px] font-black text-pitch">{g.opponentShare > 0 ? `Taxa do adversário: ${formatBRL(g.opponentShare)}` : 'Sem taxa'}</p>
                    {isCaptain && !isOwner && (
                      <Button onClick={() => challenge(g)} isLoading={sending} className="w-full py-3 rounded-xl text-[10px] font-black uppercase bg-pitch"><Swords className="w-4 h-4" /> Desafiar</Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Plane className="w-4 h-4" /> Dias em que jogamos fora</p>
                {agenda.awayAvailability.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase">Nenhum dia cadastrado.</p>}
                {agenda.awayAvailability.map(a => (
                  <div key={a.id} className="bg-gray-50 rounded-2xl p-4">
                    <p className="text-xs font-black text-pitch uppercase">{dateLabel(a.date)} • das {a.startTime} às {a.endTime}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{a.category}{a.notes ? ` • ${a.notes}` : ''}</p>
                  </div>
                ))}
                {agenda.awayAvailability.length > 0 && (
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Tem jogo em casa nesse dia? Crie o jogo em "Minha agenda" e convide o {agenda.team.name} em "Visitantes".</p>
                )}
              </div>

              {currentUser && !isCaptain && (
                <p className="text-center text-xs font-bold text-gray-500">Entre com uma conta de dono de time para marcar jogo.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
