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
  const [slotCourt, setSlotCourt] = useState(field.courts?.[0] || 'Principal');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate);
  const [slotSport, setSlotSport] = useState('Futebol');
  
  // Novos States para Criação Manual de Time Local
  const [isLocalTeamSlot, setIsLocalTeamSlot] = useState(false);
  const [manualLocalTeamName, setManualLocalTeamName] = useState(field.name || 'Time da Casa');
  const [manualLocalCategory, setManualLocalCategory] = useState(categories[0] || 'Livre');

  // States Filtros Agenda
  // Padrão: Próximos 7 dias para não ficar vazio, mas sem filtrar estritamente pelo "dia de hoje"
  const [filterRange, setFilterRange] = useState<string>('7'); 
  const [filterSpecificDate, setFilterSpecificDate] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterTag, setFilterTag] = useState('TODOS');
  const [showFilters, setShowFilters] = useState(true); // Começar expandido para facilitar

  // States Mensalista
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaEmail, setMensalistaEmail] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState('');
  const [mensalistaLogo, setMensalistaLogo] = useState('');
  const [mensalistaGender, setMensalistaGender] = useState<Gender>('MASCULINO');
  const [mensalistaSport, setMensalistaSport] = useState('Futebol');
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
        matchType: isLocalTeamSlot ? 'AMISTOSO' : 'ALUGUEL', // Se for time local, é Amistoso/Desafio, senão é Aluguel
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

  // --- LÓGICA DE FILTROS E TAGS ---

  // Filtra slots
  const agendaSlots = slots
    .filter(s => {
       // Filtro Básico: Apenas jogos futuros (Histórico é outra aba)
       if (s.date < todayStr) return false;
       
       // Filtro de PERÍODO (Data Range)
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

       // Filtro por Nome (Busca)
       if (filterTerm) {
         const term = filterTerm.toLowerCase();
         const matchLocal = s.localTeamName?.toLowerCase().includes(term);
         const matchOpponent = s.opponentTeamName?.toLowerCase().includes(term);
         if (!matchLocal && !matchOpponent) return false;
       }

       // Filtro por Tag (Lógica Simplificada)
       if (filterTag !== 'TODOS') {
          // TIME LOCAL: Inclui tanto Mensalistas (FIXO) quanto Times Locais da Arena
          if (filterTag === 'TIME LOCAL') {
             if (!s.hasLocalTeam && s.matchType !== 'FIXO') return false;
          }

          // DISPONÍVEL: Horário sem dono (nem mensalista nem local)
          if (filterTag === 'DISPONÍVEL') {
             if (s.hasLocalTeam || s.matchType === 'FIXO') return false;
             if (s.status !== 'available') return false; // Deve estar livre
          }
          
          // AGENDADO: Tem que ter adversário confirmado
          if (filterTag === 'AGENDADO' && !s.opponentTeamName) return false;
          
          // PROCURANDO ADVERSÁRIO: Tem time local/mensalista mas NÃO tem adversário
          if (filterTag === 'PROCURANDO ADVERSÁRIO') {
             // Se já tem adversário, não está procurando
             if (s.opponentTeamName) return false;
             // Se não tem ninguém (é livre para aluguel), não está procurando desafio
             if (!s.hasLocalTeam && s.matchType !== 'FIXO') return false;
          }
       }

       return true;
    })
    .sort((a,b) => {
       // Sort by date then time
       if (a.date !== b.date) return a.date.localeCompare(b.date);
       return a.time.localeCompare(b.time);
    });

  // Próximo jogo (para a arte de destaque) - Pega o primeiro da lista filtrada
  const nextMatchSlot = agendaSlots[0];
  
  // Lista para renderização (Remove o primeiro item se ele for o destaque)
  const listSlots = nextMatchSlot ? agendaSlots.slice(1) : agendaSlots;

  const historySlots = slots.filter(s => s.date < todayStr);

  // Helper para gerar as Tags (Badges) Múltiplas com Lógica Unificada
  const getSlotBadges = (slot: MatchSlot) => {
    const badges = [];

    // Tag 1: Origem do Time (Unificado: Mensalista e Local viram "TIME LOCAL")
    // Se tiver dono (Mensalista ou Local), mostramos "TIME LOCAL"
    if (slot.matchType === 'FIXO' || slot.hasLocalTeam) {
      badges.push({ label: 'TIME LOCAL', color: 'bg-indigo-100 text-indigo-700', icon: <Flag className="w-3 h-3"/> });
    } else if (slot.status === 'available') {
      // Se não tem dono e está livre -> DISPONÍVEL
      badges.push({ label: 'DISPONÍVEL', color: 'bg-grass-100 text-grass-700', icon: <Clock className="w-3 h-3"/> });
    }

    // Tag 2: Status do Jogo
    if (slot.opponentTeamName) {
        // Se tem adversário, está FECHADO/AGENDADO
        badges.push({ label: 'AGENDADO', color: 'bg-blue-100 text-blue-700', icon: <BadgeCheck className="w-3 h-3"/> });
    } else if (slot.matchType === 'FIXO' || slot.hasLocalTeam) {
        // Se tem dono mas não tem adversário, está PROCURANDO
        badges.push({ label: 'PROCURANDO ADVERSÁRIO', color: 'bg-yellow-100 text-yellow-700', icon: <Swords className="w-3 h-3"/> });
    } else if (slot.status === 'pending_verification') {
        badges.push({ label: 'SOLICITAÇÃO', color: 'bg-orange-100 text-orange-600', icon: <AlertCircle className="w-3 h-3"/> });
    }

    return badges;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      {/* Header Fixo */}
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
            <button onClick={() => onRefreshData()} className="p-3 bg-gray-100 rounded-xl active:rotate-180 transition-transform"><RefreshCcw className="w-5 h-5"/></button>
            <button onClick={() => { setSlotDate(todayStr); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md"><Plus className="w-5 h-5"/></button>
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
            
            {/* Filtros da Agenda */}
            <div className="bg-white p-4 rounded-[2rem] border shadow-sm space-y-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
                <div className="flex items-center gap-2 text-pitch font-black uppercase text-xs">
                  <Filter className="w-4 h-4 text-grass-500" />
                  Filtros e Busca
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </div>

              {showFilters && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 pt-2">
                   {/* Linha de Período e Data */}
                   <div className="grid grid-cols-2 gap-2">
                     {/* Seletor de Período */}
                     <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border">
                        <CalendarRange className="w-4 h-4 text-gray-400 ml-2" />
                        <select 
                          value={filterRange} 
                          onChange={e => setFilterRange(e.target.value)} 
                          className="bg-transparent font-bold text-[10px] outline-none w-full uppercase text-gray-600 appearance-none"
                        >
                           <option value="7">Próximos 7 Dias</option>
                           <option value="14">Próximos 14 Dias</option>
                           <option value="21">Próximos 21 Dias</option>
                           <option value="30">Próximos 30 Dias</option>
                           <option value="ALL">Todos os Futuros</option>
                           <option value="SPECIFIC">Data Específica</option>
                        </select>
                     </div>

                     {/* Data Específica (Só aparece se selecionado) */}
                     {filterRange === 'SPECIFIC' ? (
                       <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border animate-in fade-in">
                          <input 
                            type="date" 
                            value={filterSpecificDate} 
                            onChange={e => setFilterSpecificDate(e.target.value)} 
                            className="bg-transparent font-bold text-[10px] outline-none w-full uppercase text-gray-600"
                          />
                       </div>
                     ) : (
                       <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border opacity-50 cursor-not-allowed">
                          <span className="text-[9px] font-black text-gray-400 ml-2 uppercase">Data Automática</span>
                       </div>
                     )}
                   </div>
                   
                   {/* Busca por Nome */}
                   <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border">
                      <Search className="w-4 h-4 text-gray-400 ml-2" />
                      <input 
                        placeholder="Buscar por nome do time..." 
                        value={filterTerm} 
                        onChange={e => setFilterTerm(e.target.value)} 
                        className="bg-transparent font-bold text-[10px] outline-none w-full uppercase placeholder:text-gray-300"
                      />
                   </div>

                   {/* Tags Simplificadas - Removido MENSALISTA, Adicionado DISPONÍVEL */}
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide pt-2">
                      {['TODOS', 'TIME LOCAL', 'AGENDADO', 'PROCURANDO ADVERSÁRIO', 'DISPONÍVEL'].map(tag => (
                        <button 
                          key={tag}
                          onClick={() => setFilterTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all border ${filterTag === tag ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-400 border-gray-100'}`}
                        >
                          {tag}
                        </button>
                      ))}
                   </div>
                </div>
              )}
            </div>

            {/* Arte Especial: Próximo Jogo (Hero) */}
            {nextMatchSlot && (
              <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-pitch via-pitch to-grass-900 text-white shadow-xl p-6 border-2 border-white/10">
                 <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Trophy className="w-32 h-32 transform rotate-12" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                       <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-grass-400">Destaque • {nextMatchSlot.date.split('-').reverse().join('/')}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-6">
                       <div className="text-center flex-1">
                          <h3 className="text-2xl font-black italic uppercase leading-none truncate">{nextMatchSlot.localTeamName || 'DISPONÍVEL'}</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">{nextMatchSlot.localTeamCategory || 'Quadra'}</p>
                       </div>
                       <div className="bg-white/10 p-3 rounded-full backdrop-blur-md flex flex-col items-center justify-center min-w-[70px]">
                          <span className="font-black text-xl">{nextMatchSlot.time}</span>
                       </div>
                       <div className="text-center flex-1">
                          <h3 className="text-2xl font-black italic uppercase leading-none text-gray-300 truncate">{nextMatchSlot.opponentTeamName || '?'}</h3>
                          <p className="text-[9px] font-bold text-gray-500 uppercase mt-1">Adversário</p>
                       </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                       {getSlotBadges(nextMatchSlot).map((badge, idx) => (
                         <span key={idx} className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1 bg-white/10 backdrop-blur-md border border-white/20 text-white`}>
                           {badge.icon} {badge.label}
                         </span>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {/* Lista de Jogos Filtrada (Sem duplicidade) */}
            <div className="grid gap-4">
              {agendaSlots.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum horário encontrado para os filtros.</div>
              ) : (
                listSlots.map(slot => {
                  const badges = getSlotBadges(slot);
                  return (
                    <div key={slot.id} className="bg-white p-5 rounded-[2.5rem] border flex flex-col gap-4 shadow-sm hover:border-pitch transition-all relative">
                      {/* Top Row: Time, Data, Preço */}
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${badges[0]?.color || 'bg-gray-100 text-gray-400'}`}>
                               <Clock className="w-6 h-6"/>
                            </div>
                            <div>
                               <h4 className="font-black text-pitch text-sm uppercase leading-tight">
                                  {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                               </h4>
                               <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate max-w-[150px]">
                                  {slot.localTeamName || 'Horário Disponível'} 
                                  {slot.opponentTeamName ? ` vs ${slot.opponentTeamName}` : ''}
                               </p>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="block font-black text-pitch text-sm">R$ {slot.price}</span>
                            <span className="text-[8px] font-bold text-gray-300 uppercase">{slot.courtName}</span>
                         </div>
                      </div>

                      {/* Middle Row: Tags Múltiplas */}
                      <div className="flex flex-wrap gap-2">
                         {badges.map((badge, i) => (
                           <span key={i} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 ${badge.color}`}>
                             {badge.icon} {badge.label}
                           </span>
                         ))}
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="flex gap-2 pt-2 border-t mt-1">
                        {slot.status === 'confirmed' && slot.opponentTeamPhone && (
                          <button onClick={() => handleWhatsApp(slot.opponentTeamPhone, `Olá capitão do ${slot.opponentTeamName}! Jogo confirmado na arena ${field.name} para o dia ${slot.date.split('-').reverse().join('/')} às ${slot.time}.`)} className="flex-1 py-2 bg-grass-50 text-grass-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Smartphone className="w-3 h-3"/> Avisar Time</button>
                        )}
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
                  <p className="text-[10px] font-black text-gray-300 uppercase">Tudo em dia! Nenhuma solicitação pendente.</p>
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
                       <button onClick={() => handleWhatsApp(slot.opponentTeamPhone, `Olá capitão do ${slot.opponentTeamName}! Recebi seu desafio para o dia ${slot.date}.`)} className="p-3 bg-grass-50 text-grass-600 rounded-xl border border-grass-200"><Smartphone className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <Button onClick={() => handleAction(slot, 'reject')} variant="outline" className="py-4 rounded-2xl border-red-200 text-red-500 font-black uppercase text-[10px]">Recusar</Button>
                       <Button onClick={() => handleAction(slot, 'confirm')} className="py-4 rounded-2xl bg-pitch text-white font-black uppercase text-[10px]">Aceitar Jogo</Button>
                    </div>
                 </div>
               ))
             )}
          </div>
        )}

        {activeTab === 'HISTORICO' && (
          <div className="grid gap-4">
            {historySlots.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum jogo no histórico.</div>
            ) : (
              historySlots.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(slot => (
                <div key={slot.id} className="bg-gray-100/50 p-5 rounded-[2.5rem] border flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-4">
                     <div className="p-4 rounded-2xl bg-gray-200 text-gray-400">
                        <HistoryIcon className="w-6 h-6"/>
                     </div>
                     <div>
                        <p className="text-sm font-black text-pitch uppercase">{slot.date.split('-').reverse().join('/')} • {slot.time}</p>
                        <p className="text-[9px] font-black text-gray-500 uppercase mt-1">
                          {slot.opponentTeamName ? `${slot.localTeamName || 'Arena'} vs ${slot.opponentTeamName}` : 'Horário Livre (Não reservado)'}
                        </p>
                        <span className="text-[8px] font-black bg-white px-2 py-0.5 rounded-full text-gray-400 uppercase mt-1 inline-block">Valor: R$ {slot.price}</span>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm space-y-4 group hover:border-pitch transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border overflow-hidden">
                        {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xl">{t.name.charAt(0)}</div>}
                      </div>
                      <div>
                          <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                          <p className="text-[9px] font-black text-gray-400 uppercase mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3"/> {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime}
                          </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleWhatsApp(t.captainPhone, `Olá capitão do ${t.name}!`)} className="p-3 text-grass-500 hover:bg-grass-50 rounded-xl"><Smartphone className="w-5 h-5"/></button>
                      <button onClick={() => { setEditingMensalista(t); setMensalistaName(t.name); setMensalistaPhone(t.captainPhone || ''); setShowAddMensalistaModal(true); }} className="p-3 text-gray-300 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                      <button onClick={() => { if(confirm("Remover mensalista?")) api.deleteRegisteredTeam(t.id).then(loadMensalistas); }} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleGenerateRecurringSlots(t)} isLoading={isLoading} className="w-full py-4 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border-dashed">
                    <CalendarPlus className="w-4 h-4" /> Gerar Agenda Recorrente
                  </Button>
               </div>
             ))}
             <button onClick={() => { setEditingMensalista(null); setMensalistaName(''); setMensalistaPhone(''); setShowAddMensalistaModal(true); }} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px]">Adicionar Novo Mensalista</button>
          </div>
        )}
      </div>

      {/* Modals permanecem iguais, apenas corrigindo a referência setPhone para setMensalistaPhone */}
      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar' : 'Novo Mensalista'}</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-6">
                 <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden">
                       {mensalistaLogo ? <img src={mensalistaLogo} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                       <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setMensalistaLogo(await convertFileToBase64(f)); }} />
                    </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome Time</label>
                    <input className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs uppercase" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                 </div>
                 <div className="bg-pitch/5 p-6 rounded-[2.5rem] border border-pitch/10 space-y-4">
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="WhatsApp Capitão" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} />
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="Nome Capitão" value={mensalistaCaptain} onChange={e => setMensalistaCaptain(e.target.value)} />
                 </div>
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl">Salvar Mensalista</Button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Add Slot (Atualizado para permitir Time Local) */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black italic uppercase text-pitch">Novo Agendamento</h2>
                 <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-red-50 transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                       <input type="date" className="w-full bg-transparent font-black outline-none" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none" value={slotTime} onChange={e => setSlotTime(e.target.value)} />
                    </div>
                 </div>

                 {/* Toggle para Time Local */}
                 <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between cursor-pointer" onClick={() => setIsLocalTeamSlot(!isLocalTeamSlot)}>
                    <div>
                        <h4 className="font-black text-pitch text-xs uppercase">É Time Local?</h4>
                        <p className="text-[9px] text-gray-400">Marque se o dono do horário é um time da casa.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-all ${isLocalTeamSlot ? 'bg-pitch' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all transform ${isLocalTeamSlot ? 'translate-x-6' : ''}`} />
                    </div>
                 </div>

                 {isLocalTeamSlot && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                           <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Mandante</label>
                           <input className="w-full bg-transparent font-black outline-none text-pitch" value={manualLocalTeamName} onChange={e => setManualLocalTeamName(e.target.value)} />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                           <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                           <select className="w-full bg-transparent font-black outline-none text-xs uppercase" value={manualLocalCategory} onChange={e => setManualLocalCategory(e.target.value)}>
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                    </div>
                 )}

                 <Button onClick={handleCreateSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">
                   {isLocalTeamSlot ? 'Criar Jogo (Time Local)' : 'Criar Horário para Aluguel'}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};