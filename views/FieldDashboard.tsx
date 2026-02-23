
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, X, Swords, Edit3, MessageCircle, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle, CalendarPlus, Mail, Camera, UserPlus, Smartphone, CalendarDays, History as HistoryIcon, BadgeCheck, Ban, Lock, Search, Filter, Sparkles, ChevronDown, CalendarRange, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam, SPORTS, Gender } from '../types';
import { api } from '../api';
import { convertFileToBase64, getNeighboringCategories } from '../utils';

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
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  
  // States Criação/Edição Slot
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotMatchType, setSlotMatchType] = useState<MatchType>('ALUGUEL');
  const [slotCourt, setSlotCourt] = useState(field.courts?.[0] || 'Principal');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate);
  const [slotSport, setSlotSport] = useState('Society');
  
  const [isLocalTeamSlot, setIsLocalTeamSlot] = useState(false);
  const [manualLocalTeamName, setManualLocalTeamName] = useState(field.name || 'Time da Casa');
  const [manualLocalCategory, setManualLocalCategory] = useState(CATEGORY_ORDER[0]);
  const [acceptNeighbors, setAcceptNeighbors] = useState(true);
  const [selectedRegisteredTeamId, setSelectedRegisteredTeamId] = useState<string>('');

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
  const [mensalistaCategory, setMensalistaCategory] = useState(CATEGORY_ORDER[0]);
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

  useEffect(() => {
    // Atualiza nome padrão se o nome da arena carregar depois
    // Fix: Verifica se o nome atual é 'Carregando...' para substituir pelo nome real
    if (field.name && field.name !== 'Carregando...') {
       setManualLocalTeamName(prev => {
          if (prev === 'Time da Casa' || prev === 'Carregando...') return field.name;
          return prev;
       });
    }
  }, [field.name]);

  useEffect(() => {
    if (field.courts && field.courts.length > 0) {
      if (!field.courts.includes(slotCourt)) setSlotCourt(field.courts[0]);
      if (!field.courts.includes(mensalistaCourt)) setMensalistaCourt(field.courts[0]);
    }
  }, [field.courts]);

  const loadMensalistas = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (e) { console.error(e); }
  };

  const handleEditSlot = (slot: MatchSlot) => {
    setEditingSlotId(slot.id);
    setSlotDate(slot.date);
    setSlotTime(slot.time);
    setSlotDuration(slot.durationMinutes);
    setSlotMatchType(slot.matchType);
    setSlotCourt(slot.courtName || field.courts[0]);
    setSlotPrice(slot.price);
    setSlotSport(slot.sport);
    setIsLocalTeamSlot(slot.hasLocalTeam);
    
    // Se o nome salvo for 'Carregando...', usa o nome atual da arena
    const displayTeamName = (slot.localTeamName === 'Carregando...' ? field.name : slot.localTeamName) || field.name || 'Time da Casa';
    setManualLocalTeamName(displayTeamName);
    
    setManualLocalCategory(slot.localTeamCategory || CATEGORY_ORDER[0]);
    setShowAddSlotModal(true);
  };

  const handleAction = async (slot: MatchSlot, action: 'confirm' | 'reject') => {
    setIsLoading(true);
    try {
      if (action === 'confirm') {
        // Se for pending_verification, o dono do campo está confirmando o PIX
        // Se for pending_field_approval, o dono do campo está confirmando o jogo (após o mandante aprovar ou se for time local)
        // Se for pending_home_approval, o dono do campo está forçando a aprovação pelo mandante
        const newStatus = slot.status === 'pending_verification' ? 'confirmed' : 'pending_payment';
        
        await api.updateSlot(slot.id, { status: newStatus });
        
        if (slot.bookedByUserId) {
          const title = newStatus === 'confirmed' ? "Pagamento Confirmado! ⚽" : "Desafio Aceito! 💸";
          const desc = newStatus === 'confirmed' 
            ? `Seu pagamento para o jogo na arena ${field.name} foi validado!` 
            : `A arena ${field.name} aceitou seu desafio. Realize o pagamento via PIX para confirmar.`;
            
          await api.createNotification({
            userId: slot.bookedByUserId,
            title,
            description: desc,
            type: 'success'
          });
        }
        alert(newStatus === 'confirmed' ? "Pagamento confirmado!" : "Desafio aceito! Aguardando pagamento.");
      } else {
        await api.updateSlot(slot.id, { 
          status: 'available', 
          bookedByUserId: null, 
          bookedByTeamName: null, 
          bookedByTeamCategory: null,
          opponentTeamName: null,
          opponentTeamCategory: null,
          opponentTeamPhone: null,
          opponentTeamLogoUrl: null,
          opponentTeamGender: null,
          receiptUrl: null,
          receiptUploadedAt: null,
          isBooked: false
        });
        
        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title: "Desafio Recusado ❌",
            description: `A arena ${field.name} não pôde aceitar seu desafio para o dia ${slot.date}.`,
            type: 'error'
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

  const handleCreateOrUpdateSlot = async () => {
    setIsLoading(true);
    try {
      let teamName = null;
      let teamCategory = null;
      let teamPhone = null;
      let teamGender = null;
      let teamLogo = null;
      let homeTeamType = 'LOCAL';

      if (isLocalTeamSlot) {
        if (selectedRegisteredTeamId) {
          const regTeam = registeredTeams.find(t => t.id === selectedRegisteredTeamId);
          if (regTeam) {
            teamName = regTeam.name;
            teamCategory = regTeam.categories[0] || manualLocalCategory;
            teamPhone = regTeam.captainPhone;
            teamGender = regTeam.gender;
            teamLogo = regTeam.logoUrl;
            homeTeamType = 'MENSALISTA';
          }
        } else {
          teamName = manualLocalTeamName || field.name || 'Time da Casa';
          if (teamName === 'Carregando...') {
              teamName = field.name !== 'Carregando...' ? field.name : 'Time da Casa';
          }
          teamCategory = manualLocalCategory;
          teamPhone = field.contactPhone;
          teamGender = 'MASCULINO';
          homeTeamType = 'LOCAL';
        }
      }

      const allowedCats = acceptNeighbors && teamCategory
        ? getNeighboringCategories(teamCategory)
        : (teamCategory ? [teamCategory] : []);

      const slotData = {
        fieldId: field.id,
        date: slotDate,
        time: slotTime,
        durationMinutes: slotDuration,
        matchType: isLocalTeamSlot ? 'AMISTOSO' : slotMatchType,
        isBooked: editingSlotId ? undefined : isLocalTeamSlot,
        hasLocalTeam: isLocalTeamSlot,
        localTeamName: teamName,
        localTeamCategory: teamCategory,
        localTeamPhone: teamPhone,
        localTeamGender: teamGender,
        localTeamLogoUrl: teamLogo,
        homeTeamType: homeTeamType,
        price: slotPrice,
        status: editingSlotId ? undefined : (isLocalTeamSlot ? 'confirmed' : 'available'),
        courtName: slotCourt,
        sport: slotSport,
        allowedOpponentCategories: isLocalTeamSlot ? allowedCats : []
      } as any;

      if (editingSlotId) {
        await api.updateSlot(editingSlotId, slotData);
        alert("Horário atualizado com sucesso!");
      } else {
        await api.createSlots([slotData]);
        alert("Horário criado com sucesso!");
      }

      setShowAddSlotModal(false);
      setEditingSlotId(null);
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar horário.");
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
       return true;
    })
    .sort((a,b) => {
       if (a.date !== b.date) return a.date.localeCompare(b.date);
       return a.time.localeCompare(b.time);
    });

  const getSlotBadges = (slot: MatchSlot) => {
    const badges = [];
    const isLocal = slot.hasLocalTeam || slot.matchType === 'FIXO';
    const hasOpponent = !!slot.opponentTeamName;
    const hasAtLeastOneTeam = !!(slot.bookedByTeamName || slot.hasLocalTeam);

    if (slot.status === 'confirmed') {
      badges.push({ label: 'JOGO CONFIRMADO', color: 'bg-grass-500 text-white', icon: <CheckCircle className="w-3 h-3"/> });
    } else if (slot.status === 'pending_verification') {
      badges.push({ label: 'AGUARDANDO VALIDAÇÃO PIX', color: 'bg-orange-500 text-white', icon: <AlertCircle className="w-3 h-3"/> });
    } else if (slot.status === 'pending_payment') {
      badges.push({ label: 'AGUARDANDO PAGAMENTO', color: 'bg-blue-500 text-white', icon: <Clock className="w-3 h-3"/> });
    } else if (slot.status === 'pending_field_approval') {
      badges.push({ label: 'AGUARDANDO SUA APROVAÇÃO', color: 'bg-orange-400 text-white', icon: <UserCheck className="w-3 h-3"/> });
    } else if (slot.status === 'pending_home_approval') {
      badges.push({ label: 'AGUARDANDO APROVAÇÃO DO MANDANTE', color: 'bg-yellow-400 text-pitch', icon: <Clock className="w-3 h-3"/> });
    } else if (hasAtLeastOneTeam) {
      badges.push({ label: 'AGUARDANDO ADVERSÁRIO', color: 'bg-yellow-400 text-pitch font-black', icon: <Swords className="w-3 h-3"/> });
    } else {
      badges.push({ label: 'DISPONÍVEL', color: 'bg-gray-100 text-gray-400', icon: <Clock className="w-3 h-3"/> });
    }

    if (isLocal) {
      badges.push({ label: 'TIME LOCAL', color: 'bg-indigo-100 text-indigo-700', icon: <UserPlus className="w-3 h-3"/> });
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
                <h1 className="font-black text-pitch italic uppercase tracking-tighter leading-none">{field.name === 'Carregando...' ? 'Carregando...' : field.name}</h1>
                <p className="text-[9px] font-black text-gray-400 uppercase mt-1">Gestão de Arena</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingSlotId(null); setSlotDate(todayStr); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md flex items-center gap-2">
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
                {slots.some(s => s.status === 'pending_verification' || s.status === 'pending_field_approval') && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
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

            <div className="grid gap-4">
              {agendaSlots.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum horário disponível.</div>
              ) : (
                agendaSlots.map(slot => {
                  const badges = getSlotBadges(slot);
                  
                  // Lógica visual para corrigir nome "CARREGANDO..."
                  const displayLocalName = (slot.localTeamName === 'Carregando...' ? field.name : slot.localTeamName) || slot.bookedByTeamName || 'Horário Livre';
                  const displayLocalNameSafe = displayLocalName === 'Carregando...' ? 'Time da Casa' : displayLocalName;

                  return (
                    <div key={slot.id} className="bg-white p-5 rounded-[2.5rem] border flex flex-col gap-4 shadow-sm relative group overflow-hidden">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${slot.isBooked ? 'bg-pitch text-white' : 'bg-gray-100 text-gray-400'}`}>
                               <Flag className="w-5 h-5"/>
                            </div>
                            <div>
                               <h4 className="font-black text-pitch text-sm uppercase leading-tight">
                                  {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                               </h4>
                               <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate">
                                  {displayLocalNameSafe} vs {slot.opponentTeamName || '?'}
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
                      <div className="flex gap-2 pt-2 border-t mt-1 justify-between items-center">
                        <div className="flex gap-2">
                           <button onClick={() => handleEditSlot(slot)} className="p-3 bg-gray-50 text-pitch rounded-xl hover:bg-pitch hover:text-white transition-all"><Edit className="w-4 h-4"/></button>
                           <button onClick={() => { if(confirm("Remover este horário?")) onDeleteSlot(slot.id); }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl bg-gray-50"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        {slot.status === 'confirmed' && (
                           <button 
                             onClick={() => {
                               const msg = `Olá! Confirmando a partida na arena ${field.name} dia ${slot.date.split('-').reverse().join('/')} às ${slot.time}. Bom jogo!`;
                               const phone = slot.opponentTeamPhone || slot.bookedByUserPhone || slot.localTeamPhone;
                               if (phone) window.open(api.getWhatsAppLink(phone, msg), '_blank');
                             }} 
                             className="p-3 bg-grass-50 text-grass-600 rounded-xl hover:bg-grass-500 hover:text-white transition-all flex items-center gap-2"
                           >
                             <MessageCircle className="w-4 h-4"/>
                             <span className="text-[8px] font-black uppercase">Notificar WhatsApp</span>
                           </button>
                        )}
                        {(slot.status === 'pending_verification' || slot.status === 'pending_field_approval') && (
                           <button onClick={() => setActiveTab('SOLICITACOES')} className="bg-orange-500 text-white text-[8px] font-black uppercase px-3 py-2 rounded-lg animate-pulse">Ver Solicitação</button>
                        )}
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
              {slots.filter(s => s.status === 'pending_verification' || s.status === 'pending_field_approval' || s.status === 'pending_home_approval').map(slot => (
                 <div key={slot.id} className="bg-white rounded-[2.5rem] border-2 border-orange-100 shadow-md p-6 space-y-6">
                    <div className="flex justify-between items-start">
                       <div>
                          <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">
                            {slot.status === 'pending_verification' ? 'Comprovante PIX Enviado' : slot.status === 'pending_home_approval' ? 'Aguardando Mandante' : 'Novo Desafio Recebido'}
                          </span>
                          <h4 className="text-lg font-black text-pitch uppercase mt-2">{slot.date.split('-').reverse().join('/')} às {slot.time}</h4>
                       </div>
                       <div className="p-3 bg-gray-50 rounded-xl text-pitch"><Swords className="w-5 h-5" /></div>
                    </div>
                    
                    {slot.status === 'pending_verification' && slot.receiptUrl && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Comprovante PIX:</p>
                        <a href={slot.receiptUrl} target="_blank" rel="noreferrer" className="block w-full h-40 bg-gray-100 rounded-2xl overflow-hidden border">
                          <img src={slot.receiptUrl} className="w-full h-full object-contain" />
                        </a>
                      </div>
                    )}

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
                       <Button onClick={() => handleAction(slot, 'confirm')} className="py-4 rounded-2xl bg-pitch text-white font-black uppercase text-[10px]">
                         {slot.status === 'pending_verification' ? 'Confirmar PIX' : 'Aceitar Jogo'}
                       </Button>
                    </div>
                 </div>
              ))}
              {slots.filter(s => s.status === 'pending_verification' || s.status === 'pending_field_approval').length === 0 && (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhuma solicitação pendente.</div>
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

      {/* Modal Add/Edit Slot */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[400] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black italic uppercase text-pitch">{editingSlotId ? 'Editar Horário' : 'Novo Horário de Agenda'}</h2>
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
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local (Quadra)</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotCourt} onChange={e => setSlotCourt(e.target.value)}>
                          {field.courts.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Preço Locação (R$)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none" value={slotPrice} onChange={e => setSlotPrice(Number(e.target.value))} />
                    </div>
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between cursor-pointer" onClick={() => setIsLocalTeamSlot(!isLocalTeamSlot)}>
                    <div>
                        <h4 className="font-black text-pitch text-xs uppercase">Vincular Mandante?</h4>
                        <p className="text-[8px] text-gray-400">Define um time fixo para este horário.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-all ${isLocalTeamSlot ? 'bg-pitch' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all transform ${isLocalTeamSlot ? 'translate-x-6' : ''}`} />
                    </div>
                 </div>

                 {isLocalTeamSlot && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 bg-gray-50 p-4 rounded-2xl border">
                        <div>
                           <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Selecione o Mandante</label>
                           <select 
                             className="w-full p-4 bg-white border rounded-xl text-xs font-bold" 
                             value={selectedRegisteredTeamId} 
                             onChange={e => setSelectedRegisteredTeamId(e.target.value)}
                           >
                              <option value="">Time da Casa (Avulso)</option>
                              {registeredTeams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                           </select>
                        </div>
                        
                        {!selectedRegisteredTeamId && (
                          <>
                            <input className="w-full p-4 bg-white border rounded-xl text-xs font-bold" placeholder="Nome do Mandante" value={manualLocalTeamName} onChange={e => setManualLocalTeamName(e.target.value)} />
                            <div>
                               <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Categoria Principal</label>
                               <select className="w-full p-4 bg-white border rounded-xl text-xs font-bold" value={manualLocalCategory} onChange={e => setManualLocalCategory(e.target.value)}>
                                  {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                            </div>
                          </>
                        )}
                        
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAcceptNeighbors(!acceptNeighbors)}>
                           <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${acceptNeighbors ? 'bg-pitch border-pitch text-white' : 'bg-white border-gray-300'}`}>
                              {acceptNeighbors && <Check className="w-3 h-3" />}
                           </div>
                           <span className="text-[10px] font-black text-pitch uppercase">Aceitar categorias vizinhas (Matchmaking)</span>
                        </div>
                        {acceptNeighbors && (
                           <p className="text-[8px] text-gray-400 font-bold uppercase italic">* Permitirá desafios de uma categoria acima e uma abaixo.</p>
                        )}
                    </div>
                 )}

                 <Button onClick={handleCreateOrUpdateSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">
                   {editingSlotId ? 'Atualizar Horário' : 'Criar Horário'}
                 </Button>
              </div>
           </div>
        </div>
      )}

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
    </div>
  );
};
