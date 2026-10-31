import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Copy, Send, Home, Plane, Plus, Trash2, Loader2, MapPin, Calendar, Users, X, Check, Wallet, DollarSign } from 'lucide-react';
import { Button } from '../components/Button';
import { WalletSetup } from '../components/WalletSetup';
import { shareInvite } from '../components/shareInvite';
import { api } from '../api';
import { AgendaHomeGame, Field, MatchSlot, MyAgenda, RegisteredTeam, User } from '../types';
import { formatBRL } from '../shared/pricing';

interface TeamAgendaProps {
  currentUser: User;
  fields: Field[];
  onChanged: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dateLabel = (d: string) => {
  const dt = new Date(`${d}T12:00:00`);
  return `${WEEKDAYS[dt.getDay()]} ${d.split('-').reverse().slice(0, 2).join('/')}`;
};
const todayStr = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const sameName = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

interface Visitor {
  id: string;
  teamName: string;
  category: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  invited: boolean;
}

/**
 * Agenda do time:
 * - link exclusivo (quem abre vê os jogos em casa e os dias em que o time joga fora);
 * - jogos em casa: numa arena onde o time é time da casa/mensalista, ou em local próprio. O mandante
 *   define a taxa, aprova o adversário e recebe;
 * - dias em que quer jogar fora: mandantes com jogo no mesmo dia/horário/categoria convidam;
 * - convites recebidos para jogar fora.
 */
export const TeamAgenda: React.FC<TeamAgendaProps> = ({ currentUser, fields, onChanged }) => {
  const teams = currentUser.teams || [];
  const [teamIdx, setTeamIdx] = useState(0);
  const team = teams[teamIdx] || teams[0];
  const [agenda, setAgenda] = useState<MyAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeTeams, setHomeTeams] = useState<RegisteredTeam[]>([]);
  const [showWallet, setShowWallet] = useState(false);

  // Visitantes compatíveis por jogo em casa
  const [visitorsFor, setVisitorsFor] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);

  // Novo jogo em casa
  const [showNewHome, setShowNewHome] = useState(false);
  const [homeMode, setHomeMode] = useState<'ARENA' | 'OWN'>('ARENA');
  const [arenaId, setArenaId] = useState('');
  const [arenaSlots, setArenaSlots] = useState<MatchSlot[]>([]);
  const [arenaSlotId, setArenaSlotId] = useState('');
  const [hgCategory, setHgCategory] = useState('');
  // Vazio = mantém a taxa da arena (horário da arena) / sem taxa (local próprio)
  const [hgFee, setHgFee] = useState('');
  const [hgDate, setHgDate] = useState(todayStr());
  const [hgTime, setHgTime] = useState('19:00');
  const [hgDuration, setHgDuration] = useState(60);
  const [hgLocation, setHgLocation] = useState('');
  const [hgType, setHgType] = useState<'NORMAL' | 'AMISTOSO' | 'FESTIVAL'>('NORMAL');
  const [saving, setSaving] = useState(false);

  // Disponibilidade para jogar fora
  const [showNewAway, setShowNewAway] = useState(false);
  const [awDate, setAwDate] = useState(todayStr());
  const [awStart, setAwStart] = useState('08:00');
  const [awEnd, setAwEnd] = useState('12:00');
  const [awCategory, setAwCategory] = useState('');
  const [awNotes, setAwNotes] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      setAgenda(await api.myAgenda());
    } catch (e: any) {
      console.warn('Agenda', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    api.getMyHomeTeams(currentUser.id).then(setHomeTeams).catch(() => setHomeTeams([]));
  }, [currentUser.id]);

  useEffect(() => {
    setHgCategory(team?.categories?.[0] || '');
    setAwCategory(team?.categories?.[0] || '');
  }, [teamIdx, team?.name]);

  // Arenas onde ESTE time é time da casa ou mensalista
  const myArenas = useMemo(() => {
    const ids = homeTeams.filter(h => sameName(h.name, team?.name)).map(h => h.fieldId);
    return fields.filter(f => ids.includes(f.id));
  }, [homeTeams, fields, team?.name]);

  useEffect(() => {
    if (!arenaId) {
      setArenaSlots([]);
      return;
    }
    api.getSlotsByFieldId(arenaId).then(list => {
      const now = todayStr();
      setArenaSlots(list.filter(s => s.status === 'available' && !s.hasLocalTeam && !s.bookedByUserId && s.date >= now));
    });
  }, [arenaId]);

  if (!team) {
    return <div className="p-10 text-center text-sm font-bold text-gray-500">Cadastre um time no seu perfil para usar a agenda.</div>;
  }

  const myHomeGames = (agenda?.homeGames || []).filter(g => sameName(g.teamName, team.name));
  const myAvailability = (agenda?.availability || []).filter(a => sameName(a.teamName, team.name));
  const invites = agenda?.invites || [];

  const run = async (fn: () => Promise<{ message?: string } | void>) => {
    setSaving(true);
    try {
      const res = await fn();
      if (res && (res as any).message) alert((res as any).message);
      await reload();
      onChanged();
      return true;
    } catch (e: any) {
      alert(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (how: 'copy' | 'whatsapp') => {
    try {
      const { url, message } = await api.agendaLink(team.name);
      if (how === 'copy') {
        try {
          await navigator.clipboard.writeText(message);
          alert('Link copiado! Cole no WhatsApp ou nas redes do time.');
        } catch {
          prompt('Copie o link da sua agenda:', url);
        }
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const setFee = (g: AgendaHomeGame) => {
    const value = prompt('Taxa que o adversário paga (R$). Use 0 para jogo sem taxa:', String(g.opponentShare || 0));
    if (value === null) return;
    const price = Number(value.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) {
      alert('Valor inválido.');
      return;
    }
    run(() => api.match('set_fee', g.slotId, { price }));
  };

  const openVisitors = async (slotId: string) => {
    if (visitorsFor === slotId) {
      setVisitorsFor(null);
      return;
    }
    setVisitorsFor(slotId);
    setVisitors(null);
    try {
      const res = await api.match<{ visitors: Visitor[] }>('visitors', slotId);
      setVisitors(res.visitors);
    } catch (e: any) {
      alert(e.message);
      setVisitorsFor(null);
    }
  };

  const inviteVisitor = async (slotId: string, v: Visitor) => {
    const ok = await run(() => api.match('invite_visitor', slotId, { availabilityId: v.id }));
    if (ok) setVisitors(prev => (prev || []).map(x => (x.id === v.id ? { ...x, invited: true } : x)));
  };

  const saveHomeGame = async () => {
    if (!hgCategory) {
      alert('Escolha a categoria.');
      return;
    }
    if (homeMode === 'ARENA') {
      if (!arenaSlotId) {
        alert('Escolha um horário livre da arena.');
        return;
      }
      const ok = await run(async () => {
        const res = await api.match('book', arenaSlotId, { teamName: team.name, category: hgCategory });
        // Só muda a taxa se o mandante digitou um valor (ou escolheu amistoso)
        if (hgType === 'AMISTOSO') await api.match('set_fee', arenaSlotId, { price: 0 });
        else if (hgFee.trim() !== '') await api.match('set_fee', arenaSlotId, { price: Number(hgFee.replace(',', '.')) || 0 });
        return res;
      });
      if (ok) setShowNewHome(false);
      return;
    }
    if (hgLocation.trim().length < 5) {
      alert('Informe o endereço do local do jogo.');
      return;
    }
    const ok = await run(() =>
      api.createHomeGame({
        teamName: team.name,
        category: hgCategory,
        date: hgDate,
        time: hgTime,
        durationMinutes: hgDuration,
        location: hgLocation.trim(),
        price: hgType === 'AMISTOSO' ? 0 : Number(hgFee.replace(',', '.')) || 0,
        matchType: hgType,
      })
    );
    if (ok) setShowNewHome(false);
  };

  const saveAway = async () => {
    if (!awCategory) {
      alert('Escolha a categoria.');
      return;
    }
    const ok = await run(() => api.addAvailability({ teamName: team.name, category: awCategory, date: awDate, startTime: awStart, endTime: awEnd, notes: awNotes }));
    if (ok) {
      setShowNewAway(false);
      setAwNotes('');
    }
  };

  const card = 'bg-white rounded-[2rem] border shadow-sm p-5 space-y-3';
  const input = 'w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none';
  const label = 'text-[8px] font-black text-gray-400 uppercase block mb-1';

  return (
    <div className="p-4 pb-28 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-pitch uppercase italic leading-none">Minha agenda</h2>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Jogos em casa, dias para jogar fora e convites</p>
        </div>
        {teams.length > 1 && (
          <select className="p-2 bg-white border rounded-xl text-[10px] font-black uppercase" value={teamIdx} onChange={e => setTeamIdx(Number(e.target.value))}>
            {teams.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
          </select>
        )}
      </div>

      {/* Link exclusivo */}
      <div className="bg-pitch text-white rounded-[2rem] p-5 space-y-3">
        <p className="text-[10px] font-black uppercase text-grass-500 flex items-center gap-2"><Link2 className="w-4 h-4" /> Link exclusivo do {team.name}</p>
        <p className="text-[10px] font-bold text-gray-300">Quem abre vê seus jogos em casa e os dias em que você joga fora, cria a conta (1ª categoria grátis) e marca jogo com você.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => copyLink('copy')} className="py-3 rounded-xl bg-white/10 text-[9px] font-black uppercase flex items-center justify-center gap-1"><Copy className="w-4 h-4" /> Copiar link</button>
          <button onClick={() => copyLink('whatsapp')} className="py-3 rounded-xl bg-grass-500 text-pitch text-[9px] font-black uppercase flex items-center justify-center gap-1"><Send className="w-4 h-4" /> WhatsApp</button>
        </div>
      </div>

      {/* Convites para jogar fora */}
      {invites.length > 0 && (
        <div className={`${card} border-orange-200`}>
          <p className="text-[10px] font-black uppercase text-orange-600">Convites para jogar fora</p>
          {invites.map(inv => (
            <div key={inv.inviteId} className="bg-orange-50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-black text-pitch uppercase">{inv.homeTeamName} x {inv.teamName} ({inv.category})</p>
              <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateLabel(inv.date)} às {inv.time}</p>
              <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {inv.place.name}{inv.place.location ? ` • ${inv.place.location}` : ''}</p>
              <p className="text-[10px] font-black text-pitch">{inv.opponentShare > 0 ? `Taxa do seu time: ${formatBRL(inv.opponentShare)} (PIX, paga ao mandante)` : 'Sem taxa'}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" isLoading={saving} onClick={() => run(() => api.match('decline_invite', inv.slotId, { inviteId: inv.inviteId }))} className="py-3 rounded-xl text-[9px] font-black uppercase text-red-500 border-red-200"><X className="w-4 h-4" /> Recusar</Button>
                <Button isLoading={saving} onClick={() => run(() => api.match('accept_invite', inv.slotId, { inviteId: inv.inviteId }))} className="py-3 rounded-xl text-[9px] font-black uppercase bg-pitch"><Check className="w-4 h-4" /> Aceitar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Jogos em casa */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Home className="w-4 h-4" /> Jogos em casa (aguardando adversário)</p>
          <button onClick={() => setShowNewHome(true)} className="p-2 bg-pitch text-white rounded-xl flex items-center gap-1"><Plus className="w-4 h-4" /><span className="text-[9px] font-black uppercase">Novo</span></button>
        </div>
        {loading && <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-pitch" /></div>}
        {!loading && myHomeGames.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase text-center py-2">Nenhum jogo em casa aberto.</p>}
        {myHomeGames.map(g => (
          <div key={g.slotId} className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-pitch uppercase">{dateLabel(g.date)} às {g.time} • {g.category}</p>
                <p className="text-[10px] font-bold text-gray-500 truncate flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {g.place.name}{g.place.location ? ` • ${g.place.location}` : ''}</p>
              </div>
              <button onClick={() => setFee(g)} className="shrink-0 text-right">
                <span className="block text-sm font-black text-pitch">{g.opponentShare > 0 ? formatBRL(g.opponentShare) : 'Sem taxa'}</span>
                <span className="text-[8px] font-black uppercase text-grass-600 flex items-center gap-1 justify-end"><DollarSign className="w-3 h-3" /> alterar taxa</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => openVisitors(g.slotId)} className="py-3 rounded-xl text-[9px] font-black uppercase"><Users className="w-4 h-4" /> Visitantes</Button>
              <Button onClick={() => shareInvite(g.slotId)} className="py-3 rounded-xl text-[9px] font-black uppercase bg-pitch"><Send className="w-4 h-4" /> Convite</Button>
            </div>
            {visitorsFor === g.slotId && (
              <div className="space-y-2 pt-2 border-t">
                {visitors === null && <div className="flex justify-center p-2"><Loader2 className="w-4 h-4 animate-spin text-pitch" /></div>}
                {visitors && visitors.length === 0 && (
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Nenhum time disponível para jogar fora nesse dia, horário e categoria.</p>
                )}
                {visitors?.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-2 bg-white rounded-xl p-3 border">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-pitch uppercase truncate">{v.teamName} • {v.category}</p>
                      <p className="text-[9px] font-bold text-gray-400">Disponível das {v.startTime} às {v.endTime}{v.notes ? ` • ${v.notes}` : ''}</p>
                    </div>
                    {v.invited ? (
                      <span className="text-[9px] font-black uppercase text-grass-600 shrink-0">Convidado</span>
                    ) : (
                      <button onClick={() => inviteVisitor(g.slotId, v)} disabled={saving} className="shrink-0 px-3 py-2 rounded-lg bg-pitch text-white text-[9px] font-black uppercase">Convidar</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Jogar fora */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Plane className="w-4 h-4" /> Quero jogar fora (visitante)</p>
          <button onClick={() => setShowNewAway(true)} className="p-2 bg-pitch text-white rounded-xl flex items-center gap-1"><Plus className="w-4 h-4" /><span className="text-[9px] font-black uppercase">Novo</span></button>
        </div>
        <p className="text-[9px] font-bold text-gray-400 uppercase">Diga quando seu time pode jogar fora. Times com jogo em casa nesse dia, horário e categoria vão te convidar.</p>
        {!loading && myAvailability.length === 0 && <p className="text-[10px] font-bold text-gray-400 uppercase text-center py-2">Nenhum horário cadastrado.</p>}
        {myAvailability.map(a => (
          <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
            <div>
              <p className="text-xs font-black text-pitch uppercase">{dateLabel(a.date)} • das {a.startTime} às {a.endTime}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase">{a.category}{a.notes ? ` • ${a.notes}` : ''}</p>
            </div>
            <button onClick={() => { if (confirm('Remover este horário?')) run(() => api.removeAvailability(a.id)); }} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {/* Recebimentos */}
      <div className={card}>
        <button onClick={() => setShowWallet(v => !v)} className="w-full flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-pitch flex items-center gap-2"><Wallet className="w-4 h-4" /> Recebimentos (taxa dos jogos em casa)</span>
          <span className="text-[9px] font-black uppercase text-gray-400">{showWallet ? 'Fechar' : 'Abrir'}</span>
        </button>
        {showWallet && <WalletSetup ownerName={currentUser.name} />}
      </div>

      {/* Modal: novo jogo em casa */}
      {showNewHome && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[90vh] overflow-y-auto pb-safe space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase text-pitch">Novo jogo em casa</h3>
              <button onClick={() => setShowNewHome(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['ARENA', 'OWN'] as const).map(m => (
                <button key={m} onClick={() => setHomeMode(m)} className={`py-3 rounded-xl text-[10px] font-black uppercase border ${homeMode === m ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-400'}`}>
                  {m === 'ARENA' ? 'Arena do app' : 'Local próprio'}
                </button>
              ))}
            </div>

            {homeMode === 'ARENA' && (
              myArenas.length === 0 ? (
                <p className="text-[10px] font-bold text-orange-600 bg-orange-50 p-4 rounded-2xl uppercase">
                  Seu time ainda não é time da casa nem mensalista em nenhuma arena do app. Peça para o dono da arena cadastrar o {team.name} e te mandar o convite, ou use "Local próprio".
                </p>
              ) : (
                <>
                  <div>
                    <label className={label}>Arena</label>
                    <select className={input} value={arenaId} onChange={e => { setArenaId(e.target.value); setArenaSlotId(''); }}>
                      <option value="">Escolha a arena</option>
                      {myArenas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  {arenaId && (
                    <div>
                      <label className={label}>Horário livre da arena</label>
                      <select className={input} value={arenaSlotId} onChange={e => setArenaSlotId(e.target.value)}>
                        <option value="">{arenaSlots.length === 0 ? 'Nenhum horário livre nesta arena' : 'Escolha o horário'}</option>
                        {arenaSlots.map(s => <option key={s.id} value={s.id}>{dateLabel(s.date)} às {s.time} • {s.courtName} • {s.sport}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )
            )}

            {homeMode === 'OWN' && (
              <>
                <div>
                  <label className={label}>Endereço do local</label>
                  <input className={input} value={hgLocation} onChange={e => setHgLocation(e.target.value)} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={label}>Data</label><input type="date" className={input} value={hgDate} onChange={e => setHgDate(e.target.value)} /></div>
                  <div><label className={label}>Hora</label><input type="time" className={input} value={hgTime} onChange={e => setHgTime(e.target.value)} /></div>
                  <div><label className={label}>Duração</label><input type="number" className={input} value={hgDuration} onChange={e => setHgDuration(Number(e.target.value))} /></div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Categoria</label>
                <select className={input} value={hgCategory} onChange={e => setHgCategory(e.target.value)}>
                  {(team.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Tipo</label>
                <select className={input} value={hgType} onChange={e => setHgType(e.target.value as any)}>
                  <option value="NORMAL">Partida normal</option>
                  <option value="FESTIVAL">Festival</option>
                  <option value="AMISTOSO">Amistoso (sem taxa)</option>
                </select>
              </div>
            </div>
            {hgType !== 'AMISTOSO' && (
              <div>
                <label className={label}>Taxa do adversário (R$) — você recebe</label>
                <input type="number" min={0} className={input} value={hgFee} onChange={e => setHgFee(e.target.value)} placeholder={homeMode === 'ARENA' ? 'Em branco: valor da arena' : 'Em branco: sem taxa'} />
              </div>
            )}
            <p className="text-[9px] font-bold text-gray-400 uppercase">Você é o mandante: aprova o adversário, define a taxa e recebe o valor (o repasse ao campo você combina direto com ele).</p>
            <Button onClick={saveHomeGame} isLoading={saving} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs">Criar jogo em casa</Button>
          </div>
        </div>
      )}

      {/* Modal: disponível para jogar fora */}
      {showNewAway && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-8 max-h-[90vh] overflow-y-auto pb-safe space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase text-pitch">Quero jogar fora</h3>
              <button onClick={() => setShowNewAway(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={label}>Data</label><input type="date" className={input} value={awDate} onChange={e => setAwDate(e.target.value)} /></div>
              <div><label className={label}>Das</label><input type="time" className={input} value={awStart} onChange={e => setAwStart(e.target.value)} /></div>
              <div><label className={label}>Até</label><input type="time" className={input} value={awEnd} onChange={e => setAwEnd(e.target.value)} /></div>
            </div>
            <div>
              <label className={label}>Categoria</label>
              <select className={input} value={awCategory} onChange={e => setAwCategory(e.target.value)}>
                {(team.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Observação (opcional)</label>
              <input className={input} value={awNotes} onChange={e => setAwNotes(e.target.value)} placeholder="Ex.: até 30 km, região norte" />
            </div>
            <Button onClick={saveAway} isLoading={saving} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs">Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
};
