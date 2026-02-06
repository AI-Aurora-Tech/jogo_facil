
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, X, Swords, Edit3, MessageCircle, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle, CalendarPlus, Mail, Camera, UserPlus, Smartphone, CalendarDays, History as HistoryIcon, BadgeCheck, Ban, Lock, Search, Filter, Sparkles, ChevronDown, CalendarRange } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam, SPORTS, Gender } from '../types';
import { api } from '../api';
import { convertFileToBase64 } from '../utils';

interface FieldDashboardProps {
  categories: string[];
  field: Field;
  slots: MatchSlot[];
  currentUser: User;
  onAddSlot: (slots: Omit<MatchSlot, 'id'>[]) => Promise<void>;
  onRefreshData: () => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
  onRateTeam: () => void;
  forceTab?: 'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO';
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser, categories, onUpdateField, onRateTeam, forceTab
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  
  // States Modais
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  
  // States Criação Slot
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotMatchType, setSlotMatchType] = useState<MatchType>('ALUGUEL');
  const [slotCourt, setSlotCourt] = useState(field.courts?.[0] || 'Principal');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate);
  const [slotSport, setSlotSport] = useState('Society');
  
  // Novos States para Criação Manual de Time Local
  const [isLocalTeamSlot, setIsLocalTeamSlot] = useState(false);
  const [manualLocalTeamName, setManualLocalTeamName] = useState(field.name || 'Time da Casa');
  const [manualLocalCategory, setManualLocalCategory] = useState('Livre');

  // States Filtros Agenda
  const [filterRange, setFilterRange] = useState<string>('7'); 
  const [filterSpecificDate, setFilterSpecificDate] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterTag, setFilterTag] = useState('TODOS');
  const [showFilters, setShowFilters] = useState(false);

  // States Mensalista
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaEmail, setMensalistaEmail] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState('Livre');
  const [mensalistaLogo, setMensalistaLogo] = useState('');
  const [mensalistaGender, setMensalistaGender] = useState<Gender>('MASCULINO');
  const [mensalistaSport, setMensalistaSport] = useState('Society');
  const [mensalistaCourt, setMensalistaCourt] = useState(field.courts?.[0] || 'Principal');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (forceTab) setActiveTab(forceTab);
  }, [forceTab]);

  useEffect(() => {
    loadMensalistas();
  }, [field.id]);

  const loadMensalistas = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (e) { console.error(e); }
  };

  const handleAction = async (slot: MatchSlot, action: 'confirm' | 'reject') => {
    setIsLoading(true);
    try {
      if (action === 'confirm') {
        await onConfirmBooking(slot.id);
        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title: "Desafio Confirmado! ⚽",
            description: `Seu jogo na arena ${field.name} dia ${slot.date.split('-').reverse().join('/')} foi confirmado!`,
            type: 'success'
          });
        }
        alert("Agendamento confirmado com sucesso!");
      } else {
        await onRejectBooking(slot.id);
        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title: "Desafio Recusado ❌",
            description: `A arena ${field.name} não pôde aceitar seu desafio para o dia ${slot.date}.`,
            type: 'warning'
          });
        }
        alert("Solicitação recusada.");
      }
      onRefreshData();
    } catch (e) { 
      console.error(e);
      alert("Erro ao processar ação."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleCreateSlot = async () => {
    setIsLoading(true);
    try {
      await api.createSlots([{
        fieldId: field.id,
        date: slotDate,
        time: slotTime,
        durationMinutes: slotDuration,
        matchType: isLocalTeamSlot ? 'AMISTOSO' : slotMatchType,
        isBooked: false,
        hasLocalTeam: isLocalTeamSlot,
        localTeamName: isLocalTeamSlot ? manualLocalTeamName : null,
        localTeamCategory: isLocalTeamSlot ? manualLocalCategory : null,
        localTeamPhone: isLocalTeamSlot ? field.contactPhone : null,
        localTeamGender: 'MASCULINO',
        price: slotPrice,
        status: 'available',
        courtName: slotCourt,
        sport: slotSport,
        allowedOpponentCategories: isLocalTeamSlot ? [manualLocalCategory] : []
      }]);

      setShowAddSlotModal(false);
      onRefreshData();
      alert("Horário criado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao criar horário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    if (!mensalistaName || !mensalistaPhone) {
      alert("Nome e WhatsApp são obrigatórios.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<RegisteredTeam> = {
        name: mensalistaName,
        captainName: mensalistaCaptain,
        captainPhone: mensalistaPhone,
        email: mensalistaEmail,
        fixedDay: String(mensalistaDay),
        fixedTime: mensalistaTime,
        categories: [mensalistaCategory],
        logoUrl: mensalistaLogo,
        gender: mensalistaGender,
        sport: mensalistaSport,
        courtName: mensalistaCourt,
        fieldId: field.id
      };

      if (editingMensalista) {
        await api.updateRegisteredTeam(editingMensalista.id, payload);
      } else {
        await api.addRegisteredTeam(payload);
      }
      
      setShowAddMensalistaModal(false);
      loadMensalistas();
      alert("Mensalista salvo com sucesso!");
    } catch (e) {
      alert("Erro ao salvar mensalista.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateRecurringSlots = async (team: RegisteredTeam) => {
    if (!confirm(`Gerar próximos 10 jogos para ${team.name}?`)) return;
    setIsLoading(true);
    try {
      const slotsToCreate: Omit<MatchSlot, 'id'>[] = [];
      const targetDay = Number(team.fixedDay);
      let currentDate = new Date();
      currentDate.setHours(12, 0, 0, 0);
      let count = 0;
      while (count < 10) {
        if (currentDate.getDay() === targetDay) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (!slots.some(s => s.date === dateStr && s.time === team.fixedTime && s.courtName === team.courtName)) {
            slotsToCreate.push({
              fieldId: field.id, date: dateStr, time: team.fixedTime, durationMinutes: 60, matchType: 'FIXO', isBooked: true, hasLocalTeam: true, localTeamName: team.name, localTeamCategory: team.categories[0], localTeamPhone: team.captainPhone, localTeamLogoUrl: team.logoUrl, localTeamGender: team.gender, allowedOpponentCategories: team.categories, status: 'confirmed', price: field.hourlyRate, sport: team.sport, courtName: team.courtName
            });
            count++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      if (slotsToCreate.length > 0) {
        await api.createSlots(slotsToCreate);
        onRefreshData();
        alert("Agenda gerada com sucesso!");
      }
    } catch (e) { alert("Erro ao gerar."); }
    finally { setIsLoading(false); }
  };

  const handleWhatsApp = (phone?: string, message?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message || '')}`, '_blank');
  };

  const agendaSlots = slots
    .filter(s => {
       if (s.date < todayStr) return false;
       if (filterRange === 'SPECIFIC') {
          if (filterSpecificDate && s.date !== filterSpecificDate) return false;
       } else if (filterRange !== 'ALL') {
          const daysToAdd = parseInt(filterRange);
          if (!isNaN(daysToAdd)) {
             const limitDate = new Date();
             limitDate.setDate(limitDate.getDate() + daysToAdd);
             const limitStr = limitDate.toISOString().split('T')[0];
             if (s.date > limitStr) return false;
          }
       }
       if (filterTerm) {
         const term = filterTerm.toLowerCase();
         const matchLocal = s.localTeamName?.toLowerCase().includes(term);
         const matchOpponent = s.opponentTeamName?.toLowerCase().includes(term);
         if (!matchLocal && !matchOpponent) return false;
       }
       if (filterTag !== 'TODOS') {
          if (filterTag === 'TIME LOCAL' && (!s.hasLocalTeam && s.matchType !== 'FIXO')) return false;
          if (filterTag === 'DISPONÍVEL' && (s.hasLocalTeam || s.matchType === 'FIXO' || s.status !== 'available')) return false;
          if (filterTag === 'AGENDADO' && !s.opponentTeamName) return false;
          if (filterTag === 'PROCURANDO ADVERSÁRIO' && (s.opponentTeamName || (!s.hasLocalTeam && s.matchType !== 'FIXO'))) return false;
       }
       return true;
    })
    .sort((a,b) => {
       if (a.date !== b.date) return a.date.localeCompare(b.date);
       return a.time.localeCompare(b.time);
    });

  const nextMatchSlot = agendaSlots[0];
  const listSlots = nextMatchSlot ? agendaSlots.slice(1) : agendaSlots;
  const historySlots = slots.filter(s => s.date < todayStr);

  const getSlotBadges = (slot: MatchSlot) => {
    const badges = [];
    if (slot.matchType === 'FIXO' || slot.hasLocalTeam) {
      badges.push({ label: 'TIME LOCAL', color: 'bg-indigo-100 text-indigo-700', icon: <Flag className="w-3 h-3"/> });
    } else if (slot.status === 'available') {
      badges.push({ label: 'DISPONÍVEL', color: 'bg-grass-100 text-grass-700', icon: <Clock className="w-3 h-3"/> });
    }
    if (slot.opponentTeamName) {
        badges.push({ label: 'AGENDADO', color: 'bg-blue-100 text-blue-700', icon: <BadgeCheck className="w-3 h-3"/> });
    } else if (slot.matchType === 'FIXO' || slot.hasLocalTeam) {
        badges.push({ label: 'PROCURANDO ADVERSÁRIO', color: 'bg-yellow-100 text-yellow-700', icon: <Swords className="w-3 h-3"/> });
    } else if (slot.status === 'pending_verification') {
        badges.push({ label: 'SOLICITAÇÃO', color: 'bg-orange-100 text-orange-600', icon: <AlertCircle className="w-3 h-3"/> });
    }
    return badges;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="p-6 bg-white border-b sticky top-0 z-20 glass">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-pitch rounded-2xl overflow-hidden border-2 border-white shadow-md">
                <img src={field.imageUrl} className="w-full h-full object-cover" />
             </div>
             <div>
                <h1 className="font-black text-pitch italic uppercase tracking-tighter leading-none">{field.name}</h1>
                <p className="text-[9px] font-black text-gray-400 uppercase mt-1">Gestão de Arena</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSlotDate(todayStr); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md flex items-center gap-2">
               <Plus className="w-5 h-5"/>
               <span className="text-[10px] font-black uppercase">Novo Horário</span>
            </button>
          </div>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl overflow-x-auto scrollbar-hide">
          {['AGENDA', 'SOLICITACOES', 'MENSALISTAS', 'HISTORICO'].map((tab: any) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
              {tab === 'AGENDA' && <CalendarDays className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'SOLICITACOES' && <div className="relative inline-block">
                <MessageCircle className="w-3 h-3 inline-block mr-1 mb-0.5" />
                {slots.some(s => s.status === 'pending_verification') && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </div>}
              {tab === 'MENSALISTAS' && <UserCheck className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'HISTORICO' && <HistoryIcon className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'AGENDA' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-[2rem] border shadow-sm space-y-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
                <div className="flex items-center gap-2 text-pitch font-black uppercase text-xs">
                  <Filter className="w-4 h-4 text-grass-500" />
                  Filtros de Agenda
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </div>

              {showFilters && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 pt-2">
                   <div className="grid grid-cols-2 gap-2">
                     <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border">
                        <select 
                          value={filterRange} 
                          onChange={e => setFilterRange(e.target.value)} 
                          className="bg-transparent font-bold text-[10px] outline-none w-full uppercase text-gray-600 appearance-none p-1"
                        >
                           <option value="7">Próximos 7 Dias</option>
                           <option value="30">Próximos 30 Dias</option>
                           <option value="ALL">Ver Todos</option>
                           <option value="SPECIFIC">Data Específica</option>
                        </select>
                     </div>
                     {filterRange === 'SPECIFIC' && (
                       <input type="date" value={filterSpecificDate} onChange={e => setFilterSpecificDate(e.target.value)} className="bg-gray-50 p-2 rounded-xl border font-bold text-[10px] uppercase text-gray-600" />
                     )}
                   </div>
                   <input 
                      placeholder="Buscar por nome do time..." 
                      value={filterTerm} 
                      onChange={e => setFilterTerm(e.target.value)} 
                      className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-[10px] uppercase"
                    />
                </div>
              )}
            </div>

            {nextMatchSlot && (
              <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-pitch via-pitch to-grass-900 text-white shadow-xl p-6 border-2 border-white/10">
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                       <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-grass-400">Próximo Jogo • {nextMatchSlot.date.split('-').reverse().join('/')}</span>
                    </div>
                    <div className="flex items-center justify-between mb-6">
                       <div className="text-center flex-1">
                          <h3 className="text-xl font-black italic uppercase leading-none truncate">{nextMatchSlot.localTeamName || 'DISPONÍVEL'}</h3>
                          <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">{nextMatchSlot.courtName}</p>
                       </div>
                       <div className="bg-white/10 p-3 rounded-full backdrop-blur-md flex flex-col items-center justify-center min-w-[70px]">
                          <span className="font-black text-xl">{nextMatchSlot.time}</span>
                       </div>
                       <div className="text-center flex-1">
                          <h3 className="text-xl font-black italic uppercase leading-none text-gray-300 truncate">{nextMatchSlot.opponentTeamName || '?'}</h3>
                          <p className="text-[8px] font-bold text-gray-500 uppercase mt-1">Desafiante</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            <div className="grid gap-4">
              {agendaSlots.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum horário disponível.</div>
              ) : (
                listSlots.map(slot => {
                  const badges = getSlotBadges(slot);
                  return (
                    <div key={slot.id} className="bg-white p-5 rounded-[2.5rem] border flex flex-col gap-4 shadow-sm relative">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${badges[0]?.color || 'bg-gray-100'}`}>
                               <Flag className="w-5 h-5"/>
                            </div>
                            <div>
                               <h4 className="font-black text-pitch text-sm uppercase leading-tight">
                                  {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                               </h4>
                               <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate">
                                  {slot.localTeamName || 'Horário Livre'} vs {slot.opponentTeamName || '?'}
                               </p>
                               <span className="text-[8px] font-black text-grass-600 uppercase mt-1 inline-block">{slot.sport} • {slot.courtName}</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="block font-black text-pitch text-sm">R$ {slot.price}</span>
                            <span className="text-[8px] font-bold text-gray-300 uppercase">{slot.durationMinutes} min</span>
                         </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         {badges.map((badge, i) => (
                           <span key={i} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 ${badge.color}`}>
                             {badge.icon} {badge.label}
                           </span>
                         ))}
                      </div>
                      <div className="flex gap-2 pt-2 border-t mt-1">
                        <button onClick={() => { if(confirm("Remover este horário?")) onDeleteSlot(slot.id); }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl bg-gray-50"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'SOLICITACOES' && (
          <div className="space-y-4">
             {slots.filter(s => s.status === 'pending_verification').length === 0 ? (
               <div className="text-center py-20 flex flex-col items-center">
                  <CheckCircle className="w-12 h-12 text-gray-200 mb-4" />
                  <p className="text-[10px] font-black text-gray-300 uppercase">Tudo em dia! Nenhuma solicitação.</p>
               </div>
             ) : (
               slots.filter(s => s.status === 'pending_verification').map(slot => (
                 <div key={slot.id} className="bg-white rounded-[2.5rem] border-2 border-orange-100 shadow-md p-6 space-y-6">
                    <div className="flex justify-between items-start">
                       <div>
                          <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">Novo Desafio Recebido</span>
                          <h4 className="text-lg font-black text-pitch uppercase mt-2">{slot.date.split('-').reverse().join('/')} às {slot.time}</h4>
                       </div>
                       <div className="p-3 bg-gray-50 rounded-xl text-pitch"><Swords className="w-5 h-5" /></div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center overflow-hidden">
                             {slot.opponentTeamLogoUrl ? <img src={slot.opponentTeamLogoUrl} className="w-full h-full object-cover" /> : <div className="font-black">{slot.opponentTeamName?.charAt(0)}</div>}
                          </div>
                          <div>
                             <p className="text-[8px] font-black text-gray-400 uppercase">Desafiante</p>
                             <p className="font-black text-pitch uppercase">{slot.opponentTeamName}</p>
                             <p className="text-[9px] font-bold text-grass-600 uppercase">{slot.opponentTeamCategory}</p>
                          </div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <Button onClick={() => handleAction(slot, 'reject')} variant="outline" className="py-4 rounded-2xl text-red-500 font-black uppercase text-[10px]">Recusar</Button>
                       <Button onClick={() => handleAction(slot, 'confirm')} className="py-4 rounded-2xl bg-pitch text-white font-black uppercase text-[10px]">Aceitar Jogo</Button>
                    </div>
                 </div>
               ))
             )}
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border overflow-hidden">
                        {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xl">{t.name.charAt(0)}</div>}
                      </div>
                      <div>
                          <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                          <p className="text-[9px] font-black text-gray-400 uppercase mt-2 flex items-center gap-1">
                             {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime}
                          </p>
                          <p className="text-[8px] font-bold text-grass-600 uppercase mt-1">{t.sport} • {t.courtName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingMensalista(t); setMensalistaName(t.name); setMensalistaPhone(t.captainPhone || ''); setShowAddMensalistaModal(true); }} className="p-3 text-gray-300 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                      <button onClick={() => { if(confirm("Remover mensalista?")) api.deleteRegisteredTeam(t.id).then(loadMensalistas); }} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleGenerateRecurringSlots(t)} isLoading={isLoading} className="w-full py-4 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border-dashed">
                    <CalendarPlus className="w-4 h-4" /> Gerar Agenda Mensalista
                  </Button>
               </div>
             ))}
             <button onClick={() => { setEditingMensalista(null); setMensalistaName(''); setMensalistaPhone(''); setShowAddMensalistaModal(true); }} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px]">Adicionar Novo Mensalista</button>
          </div>
        )}
      </div>

      {/* Modal Add Mensalista */}
      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar' : 'Novo Mensalista'}</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome Time</label>
                       <input className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaCategory} onChange={e => setMensalistaCategory(e.target.value)}>
                          {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaSport} onChange={e => setMensalistaSport(e.target.value)}>
                          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local (Quadra)</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaCourt} onChange={e => setMensalistaCourt(e.target.value)}>
                          {field.courts.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia da Semana</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs uppercase" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                 </div>
                 <div className="bg-pitch/5 p-6 rounded-[2.5rem] border border-pitch/10 space-y-4">
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="WhatsApp Capitão" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} />
                 </div>
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl">Salvar Mensalista</Button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Add Slot */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black italic uppercase text-pitch">Novo Horário de Agenda</h2>
                 <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                       <input type="date" className="w-full bg-transparent font-black outline-none" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora Início</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none" value={slotTime} onChange={e => setSlotTime(e.target.value)} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Duração (min)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Preço Locação (R$)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none" value={slotPrice} onChange={e => setSlotPrice(Number(e.target.value))} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotSport} onChange={e => setSlotSport(e.target.value)}>
                          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Tipo de Partida</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotMatchType} onChange={e => setSlotMatchType(e.target.value as MatchType)}>
                          <option value="ALUGUEL">Aluguel Comum</option>
                          <option value="AMISTOSO">Amistoso (Desafio)</option>
                          <option value="FESTIVAL">Festival</option>
                       </select>
                    </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local (Quadra)</label>
                    <select className="w-full bg-transparent font-black outline-none text-xs" value={slotCourt} onChange={e => setSlotCourt(e.target.value)}>
                       {field.courts.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>

                 <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between cursor-pointer" onClick={() => setIsLocalTeamSlot(!isLocalTeamSlot)}>
                    <div>
                        <h4 className="font-black text-pitch text-xs uppercase">Vincular Time da Casa?</h4>
                        <p className="text-[8px] text-gray-400">O horário já inicia com um mandante definido.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-all ${isLocalTeamSlot ? 'bg-pitch' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all transform ${isLocalTeamSlot ? 'translate-x-6' : ''}`} />
                    </div>
                 </div>

                 {isLocalTeamSlot && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                        <input className="w-full p-4 bg-gray-50 border rounded-xl text-xs font-bold" placeholder="Nome do Mandante" value={manualLocalTeamName} onChange={e => setManualLocalTeamName(e.target.value)} />
                        <select className="w-full p-4 bg-gray-50 border rounded-xl text-xs font-bold" value={manualLocalCategory} onChange={e => setManualLocalCategory(e.target.value)}>
                           {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                 )}

                 <Button onClick={handleCreateSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">Salvar na Agenda</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
