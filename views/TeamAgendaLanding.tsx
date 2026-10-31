import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Calendar, Loader2, X, Swords, Plane, Home, ChevronLeft, Check, Clock, Info } from 'lucide-react';
import { Button } from '../components/Button';
import { PublicAgenda, AgendaHomeGame, AgendaAvailability, User } from '../types';
import { api } from '../api';
import { formatBRL, CATEGORY_MONTHLY_PRICE, monthlyPriceForTeams } from '../shared/pricing';

interface TeamAgendaLandingProps {
  token: string;
  currentUser: User | null;
  /** Abre login/cadastro. No cadastro, a conta já nasce com a categoria do jogo escolhido. */
  onAuth: (mode: 'LOGIN' | 'REGISTER', category?: string) => void;
  onUserUpdated: (u: User) => void;
  onDone: () => void;
  onDismiss: () => void;
}

/** Jogo escolhido no link (guardado enquanto a pessoa cria a conta ou entra). */
type Pick = { kind: 'HOME'; id: string; category: string } | { kind: 'AWAY'; id: string; category: string };

const PICK_KEY = 'jf_agenda_pick';
const readPick = (token: string): Pick | null => {
  try {
    const raw = sessionStorage.getItem(PICK_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.token === token ? (p.pick as Pick) : null;
  } catch {
    return null;
  }
};
const savePick = (token: string, pick: Pick | null) => {
  try {
    if (pick) sessionStorage.setItem(PICK_KEY, JSON.stringify({ token, pick }));
    else sessionStorage.removeItem(PICK_KEY);
  } catch { /* sem storage */ }
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dateLabel = (d: string) => {
  const dt = new Date(`${d}T12:00:00`);
  return `${WEEKDAYS[dt.getDay()]} ${d.split('-').reverse().slice(0, 2).join('/')}`;
};

const acceptedOf = (g: AgendaHomeGame) => (g.allowedCategories.length > 0 ? g.allowedCategories : g.category ? [g.category] : []);

/**
 * Link exclusivo de um time.
 * - Cada jogo em casa e cada dia em que o time joga fora tem o botão "Jogar".
 * - Sem conta: cria a conta (já com a categoria do jogo) ou entra, e volta direto para a confirmação.
 * - Jogo em casa do time do link: você é o visitante e confirma o DESAFIO.
 * - Time do link quer jogar fora: você é o mandante, informa local/horário e confirma o CONVITE.
 */
export const TeamAgendaLanding: React.FC<TeamAgendaLandingProps> = ({ token, currentUser, onAuth, onUserUpdated, onDone, onDismiss }) => {
  const [agenda, setAgenda] = useState<PublicAgenda | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pick, setPick] = useState<Pick | null>(() => readPick(token));
  const [askAuthFor, setAskAuthFor] = useState<Pick | null>(null);

  // Confirmação
  const [teamIdx, setTeamIdx] = useState(0);
  const [awayTime, setAwayTime] = useState('');
  const [awayDuration, setAwayDuration] = useState(60);
  const [awayLocation, setAwayLocation] = useState('');
  const [awayFee, setAwayFee] = useState('');

  useEffect(() => {
    api.getPublicAgenda(token)
      .then(setAgenda)
      .catch(e => setError(e.message || 'Link inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const myTeams = currentUser?.teams || [];
  const isOwner = !!agenda && currentUser?.id === agenda.ownerUserId;
  const isCaptain = currentUser?.role === 'TEAM_CAPTAIN';

  const pickedHome = pick?.kind === 'HOME' ? agenda?.homeGames.find(g => g.slotId === pick.id) : undefined;
  const pickedAway = pick?.kind === 'AWAY' ? agenda?.awayAvailability.find(a => a.id === pick.id) : undefined;

  // Times do usuário que já têm a categoria do jogo escolhido (aparecem primeiro)
  const teamOptions = useMemo(() => {
    if (!pick) return myTeams.map((t, i) => ({ t, i, has: false }));
    return myTeams.map((t, i) => ({ t, i, has: (t.categories || []).includes(pick.category) })).sort((a, b) => Number(b.has) - Number(a.has));
  }, [myTeams, pick]);

  useEffect(() => {
    if (teamOptions.length > 0) setTeamIdx(teamOptions[0].i);
  }, [teamOptions]);

  useEffect(() => {
    if (pickedAway) setAwayTime(pickedAway.startTime);
  }, [pickedAway?.id]);

  const play = (p: Pick) => {
    if (!currentUser) {
      savePick(token, p);
      setAskAuthFor(p);
      return;
    }
    savePick(token, p);
    setPick(p);
  };

  const backToList = () => {
    savePick(token, null);
    setPick(null);
  };

  const finish = () => {
    savePick(token, null);
    onDone();
  };

  /** Garante que o time escolhido tem a categoria do jogo (adiciona, avisando o valor, se preciso). */
  const ensureCategory = async (category: string): Promise<string | null> => {
    const team = myTeams[teamIdx];
    if (!team || !currentUser) return null;
    if ((team.categories || []).includes(category)) return team.name;
    const newTeams = myTeams.map((t, i) => (i === teamIdx ? { ...t, categories: [...(t.categories || []), category] } : t));
    const newPrice = monthlyPriceForTeams(newTeams);
    const ok = confirm(
      newPrice > 0
        ? `Adicionar ${category} ao ${team.name}? Cada categoria adicional custa ${formatBRL(CATEGORY_MONTHLY_PRICE)}/mês: sua mensalidade passa a ser ${formatBRL(newPrice)}/mês.`
        : `Adicionar ${category} ao ${team.name}?`
    );
    if (!ok) return null;
    const updated = await api.updateUser({ ...currentUser, teams: newTeams, password: undefined });
    await api.billing('sync').catch(() => null);
    onUserUpdated(updated);
    if (newPrice > 0) {
      alert('Categoria adicionada. Para jogar com ela, ative a mensalidade em Perfil > Minha mensalidade.');
      return null;
    }
    return team.name;
  };

  const confirmChallenge = async () => {
    if (!pickedHome || !pick) return;
    setSending(true);
    try {
      const teamName = await ensureCategory(pick.category);
      if (!teamName) return;
      const res = await api.match('apply', pickedHome.slotId, { teamName, category: pick.category });
      alert(res.message || 'Desafio enviado!');
      finish();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const confirmInvite = async () => {
    if (!pickedAway || !pick) return;
    if (awayLocation.trim().length < 5) {
      alert('Informe o endereço do campo onde vai ser o jogo.');
      return;
    }
    if (awayTime < pickedAway.startTime || awayTime > pickedAway.endTime) {
      alert(`Escolha um horário entre ${pickedAway.startTime} e ${pickedAway.endTime}.`);
      return;
    }
    setSending(true);
    try {
      const teamName = await ensureCategory(pick.category);
      if (!teamName) return;
      const res = await api.createHomeGame({
        teamName,
        category: pick.category,
        date: pickedAway.date,
        time: awayTime,
        durationMinutes: awayDuration,
        location: awayLocation.trim(),
        price: Number(awayFee.replace(',', '.')) || 0,
        inviteAvailabilityId: pickedAway.id,
      });
      alert(res.message);
      finish();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const playButton = (p: Pick) =>
    !isOwner && (
      <Button onClick={() => play(p)} className="px-5 py-3 rounded-xl text-[10px] font-black uppercase bg-pitch shrink-0">
        <Swords className="w-4 h-4" /> Jogar
      </Button>
    );

  const input = 'w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none';
  const label = 'text-[9px] font-black text-gray-400 uppercase block mb-1';

  const teamSelect = myTeams.length > 1 && (
    <div>
      <label className={label}>Jogar com</label>
      <select className={input} value={teamIdx} onChange={e => setTeamIdx(Number(e.target.value))}>
        {teamOptions.map(({ t, i, has }) => <option key={t.name} value={i}>{t.name}{has ? '' : ` (adicionar ${pick?.category})`}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-pitch flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <button onClick={() => { savePick(token, null); onDismiss(); }} className="absolute top-4 right-4 z-10 p-2 bg-white/80 rounded-full"><X className="w-5 h-5" /></button>

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
                <p className="text-[10px] font-bold text-gray-300 uppercase mt-1">{agenda.team.categories.join(', ')}</p>
              </div>
            </div>

            {/* ---------- Confirmação do jogo escolhido (já logado) ---------- */}
            {pick && currentUser && (
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <button onClick={backToList} className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Ver todos os horários</button>

                {!isCaptain && <p className="text-center text-xs font-bold text-gray-500">Entre com uma conta de dono de time para marcar jogo.</p>}

                {isCaptain && pick.kind === 'HOME' && !pickedHome && (
                  <p className="text-center text-xs font-black text-red-500 uppercase">Este jogo não está mais disponível.</p>
                )}
                {isCaptain && pick.kind === 'AWAY' && !pickedAway && (
                  <p className="text-center text-xs font-black text-red-500 uppercase">Este horário não está mais disponível.</p>
                )}

                {isCaptain && pickedHome && (
                  <>
                    <h3 className="text-lg font-black text-pitch uppercase italic">Confirmar desafio</h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-1 text-[11px] font-bold text-gray-600">
                      <p className="text-xs font-black text-pitch uppercase">{agenda.team.name} (mandante) x seu time • {pick.category}</p>
                      <p className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateLabel(pickedHome.date)} às {pickedHome.time}</p>
                      <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {pickedHome.place.name}{pickedHome.place.location ? ` • ${pickedHome.place.location}` : ''}</p>
                      <p className="text-pitch font-black">{pickedHome.opponentShare > 0 ? `Taxa do seu time: ${formatBRL(pickedHome.opponentShare)} (PIX, depois que o ${agenda.team.name} aprovar)` : 'Sem taxa'}</p>
                    </div>
                    {teamSelect}
                    <p className="text-[9px] font-bold text-gray-400 uppercase">O {agenda.team.name} recebe seu desafio e aprova o jogo.</p>
                    <Button onClick={confirmChallenge} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-pitch"><Check className="w-4 h-4" /> Confirmar desafio</Button>
                  </>
                )}

                {isCaptain && pickedAway && (
                  <>
                    <h3 className="text-lg font-black text-pitch uppercase italic">Confirmar convite</h3>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-1 text-[11px] font-bold text-gray-600">
                      <p className="text-xs font-black text-pitch uppercase">Seu time (mandante) x {agenda.team.name} • {pick.category}</p>
                      <p className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateLabel(pickedAway.date)} • disponível das {pickedAway.startTime} às {pickedAway.endTime}</p>
                      {pickedAway.notes && <p>{pickedAway.notes}</p>}
                    </div>
                    {teamSelect}
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className={label}>Horário do jogo</label><input type="time" className={input} min={pickedAway.startTime} max={pickedAway.endTime} value={awayTime} onChange={e => setAwayTime(e.target.value)} /></div>
                      <div><label className={label}>Duração (min)</label><input type="number" className={input} value={awayDuration} onChange={e => setAwayDuration(Number(e.target.value))} /></div>
                    </div>
                    <div><label className={label}>Endereço do campo (seu mando)</label><input className={input} value={awayLocation} onChange={e => setAwayLocation(e.target.value)} placeholder="Rua, número, bairro, cidade" /></div>
                    <div><label className={label}>Taxa do adversário (R$, opcional) — você recebe</label><input type="number" min={0} className={input} value={awayFee} onChange={e => setAwayFee(e.target.value)} placeholder="Em branco: sem taxa" /></div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">O {agenda.team.name} recebe o convite e confirma o jogo.</p>
                    <Button onClick={confirmInvite} isLoading={sending} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-pitch"><Check className="w-4 h-4" /> Confirmar convite</Button>
                  </>
                )}
              </div>
            )}

            {/* ---------- Lista de horários ---------- */}
            {!(pick && currentUser) && (
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {!currentUser && (
                  <p className="text-[10px] font-bold text-gray-500 uppercase bg-grass-50 border border-grass-100 rounded-2xl p-3">
                    Toque em <b>Jogar</b> no horário que você quer. Criar conta é grátis (1ª categoria).
                  </p>
                )}

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Home className="w-4 h-4" /> Jogos em casa do {agenda.team.name} (você é o visitante)</p>
                  {agenda.homeGames.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase">Nenhum jogo em casa aberto agora.</p>}
                  {agenda.homeGames.map(g => {
                    const cat = acceptedOf(g)[0] || g.category || '';
                    return (
                      <div key={g.slotId} className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-black text-pitch uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateLabel(g.date)} às {g.time} • {acceptedOf(g).join(' / ')}</p>
                          <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {g.place.name}{g.place.location ? ` • ${g.place.location}` : ''}</p>
                          <p className="text-[10px] font-black text-pitch">{g.opponentShare > 0 ? `Taxa do visitante: ${formatBRL(g.opponentShare)}` : 'Sem taxa'}</p>
                        </div>
                        {playButton({ kind: 'HOME', id: g.slotId, category: cat })}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Plane className="w-4 h-4" /> Dias em que o {agenda.team.name} joga fora (você é o mandante)</p>
                  {agenda.awayAvailability.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase">Nenhum dia cadastrado.</p>}
                  {agenda.awayAvailability.map((a: AgendaAvailability) => (
                    <div key={a.id} className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-black text-pitch uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> {dateLabel(a.date)} • das {a.startTime} às {a.endTime}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase">{a.category}{a.notes ? ` • ${a.notes}` : ''}</p>
                      </div>
                      {playButton({ kind: 'AWAY', id: a.id, category: a.category })}
                    </div>
                  ))}
                </div>

                {currentUser && !isCaptain && (
                  <p className="text-center text-xs font-bold text-gray-500">Entre com uma conta de dono de time para marcar jogo.</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ---------- Criar conta ou entrar ---------- */}
        {askAuthFor && (
          <div className="absolute inset-0 bg-pitch/95 flex items-end">
            <div className="bg-white w-full rounded-t-[2.5rem] p-6 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-pitch uppercase italic">Quase lá!</h3>
                <button onClick={() => { setAskAuthFor(null); savePick(token, null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-[11px] font-bold text-gray-500 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-blue-500" />
                <span>O jogo que você escolheu é da categoria <b className="text-pitch">{askAuthFor.category}</b>. Depois de entrar, você volta direto para confirmar.</span>
              </p>
              <Button onClick={() => onAuth('REGISTER', askAuthFor.category)} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Criar conta grátis</Button>
              <Button variant="outline" onClick={() => onAuth('LOGIN')} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Já tenho conta</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
