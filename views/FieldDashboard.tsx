
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, X, Swords, Edit3, MessageCircle, TrendingUp, CheckCircle2, User as UserIcon, CalendarDays, History as HistoryIcon, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam, SPORTS } from '../types';
import { api } from '../api';

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
  
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);

  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState('18:00');
  const [newSlotType, setNewSlotType] = useState<MatchType>('AMISTOSO');
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate || 0);
  const [isLocalTeamChecked, setIsLocalTeamChecked] = useState(false);
  const [mandanteSource, setMandanteSource] = useState<'MY_TEAMS' | 'MENSALISTAS'>('MY_TEAMS');
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedMensalistaId, setSelectedMensalistaId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCourt, setSelectedCourt] = useState(field.courts?.[0] || 'Principal');
  const [selectedSport, setSelectedSport] = useState('Futebol');

  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState('');

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

  const calculateAllowedRange = (cat: string): string[] => {
    if (!cat) return [];
    const subMatch = cat.match(/Sub-(\d+)/i);
    if (subMatch) {
      const num = parseInt(subMatch[1]);
      return [`Sub-${num - 1}`, `Sub-${num}`, `Sub-${num + 1}`];
    }
    const idx = CATEGORY_ORDER.indexOf(cat);
    if (idx === -1) return [cat];
    const range = [];
    if (idx > 0) range.push(CATEGORY_ORDER[idx - 1]);
    range.push(CATEGORY_ORDER[idx]);
    if (idx < CATEGORY_ORDER.length - 1) range.push(CATEGORY_ORDER[idx + 1]);
    return range;
  };

  const openEditSlot = (slot: MatchSlot) => {
    setEditingSlot(slot);
    setNewSlotDate(slot.date);
    setNewSlotTime(slot.time);
    setNewSlotType(slot.matchType);
    setNewSlotPrice(slot.price);
    setIsLocalTeamChecked(slot.hasLocalTeam);
    setSelectedCategory(slot.localTeamCategory || '');
    setSelectedCourt(slot.courtName || field.courts?.[0] || 'Principal');
    setSelectedSport(slot.sport || 'Futebol');
    setShowAddSlotModal(true);
  };

  const openEditMensalista = (m: RegisteredTeam) => {
    setEditingMensalista(m);
    setMensalistaName(m.name);
    setMensalistaDay(Number(m.fixedDay));
    setMensalistaTime(m.fixedTime);
    setMensalistaCategory(m.categories[0] || '');
    setShowAddMensalistaModal(true);
  };

  const handleSaveSlot = async () => {
    if (isLocalTeamChecked && !selectedCategory) {
      alert("Selecione uma categoria para o mandante.");
      return;
    }
    setIsLoading(true);
    try {
      let teamName = '';
      let teamPhone = '';
      
      if (isLocalTeamChecked) {
        if (mandanteSource === 'MY_TEAMS') {
          const team = currentUser.teams[selectedTeamIdx];
          teamName = team?.name || '';
          teamPhone = currentUser.phoneNumber;
        } else {
          const mensa = registeredTeams.find(t => t.id === selectedMensalistaId);
          teamName = mensa?.name || '';
          teamPhone = mensa?.captainPhone || '';
        }
      }

      const allowedCats = selectedCategory ? calculateAllowedRange(selectedCategory) : [];

      if (editingSlot) {
        await api.updateSlot(editingSlot.id, {
          date: newSlotDate,
          time: newSlotTime,
          matchType: newSlotType,
          price: Number(newSlotPrice),
          localTeamCategory: isLocalTeamChecked ? selectedCategory : '',
          localTeamName: isLocalTeamChecked ? teamName : '',
          localTeamPhone: isLocalTeamChecked ? teamPhone : '',
          allowedOpponentCategories: allowedCats,
          hasLocalTeam: isLocalTeamChecked,
          courtName: selectedCourt,
          sport: selectedSport
        });
        setEditingSlot(null);
      } else {
        const payload: Omit<MatchSlot, 'id'> = {
          fieldId: field.id,
          date: newSlotDate,
          time: newSlotTime,
          durationMinutes: 60,
          matchType: newSlotType,
          isBooked: false,
          hasLocalTeam: isLocalTeamChecked,
          localTeamName: isLocalTeamChecked ? teamName : undefined,
          localTeamCategory: isLocalTeamChecked ? selectedCategory : undefined,
          localTeamPhone: isLocalTeamChecked ? teamPhone : undefined,
          allowedOpponentCategories: allowedCats,
          price: Number(newSlotPrice) || 0,
          status: 'available',
          courtName: selectedCourt,
          sport: selectedSport
        };
        await onAddSlot([payload]);
      }
      setShowAddSlotModal(false);
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar horário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (slotId: string, action: 'confirm' | 'reject') => {
    setIsLoading(true);
    try {
      if (action === 'confirm') {
        await onConfirmBooking(slotId);
        alert("Desafio confirmado com sucesso!");
      } else {
        await onRejectBooking(slotId);
        alert("Solicitação recusada.");
      }
      onRefreshData();
    } catch (e) {
      alert("Erro ao processar solicitação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    setIsLoading(true);
    try {
      if (editingMensalista) {
        await api.updateRegisteredTeam(editingMensalista.id, {
          name: mensalistaName,
          fixedDay: String(mensalistaDay),
          fixedTime: mensalistaTime,
          categories: [mensalistaCategory]
        });
        setEditingMensalista(null);
      } else {
        await api.addRegisteredTeam({
          fieldId: field.id,
          name: mensalistaName,
          fixedDay: String(mensalistaDay),
          fixedTime: mensalistaTime,
          categories: [mensalistaCategory]
        });
      }
      setShowAddMensalistaModal(false);
      loadMensalistas();
    } catch (e) {
      alert("Erro ao salvar mensalista.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDayName = (dateStr: string) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][new Date(`${dateStr}T00:00:00`).getDay()];

  const today = new Date().toISOString().split('T')[0];
  // Mudança: Agenda agora inclui disponíveis E confirmados para o dono ver quem joga
  const agendaSlots = slots.filter(s => (s.status === 'available' || s.status === 'confirmed') && s.date >= today);
  const pendingSlots = slots.filter(s => s.status === 'pending_verification' && s.date >= today);
  const pastSlots = slots.filter(s => s.date < today);

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      {/* Header Gestão */}
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
            <button onClick={() => { setEditingSlot(null); setIsLocalTeamChecked(false); setSelectedCategory(''); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md">
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
            <CalendarDays className="w-3 h-3 inline-block mr-1 mb-0.5" /> Agenda
          </button>
          <button onClick={() => setActiveTab('SOLICITACOES')} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap relative ${activeTab === 'SOLICITACOES' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
             {pendingSlots.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full border border-white" />}
             <MessageCircle className="w-3 h-3 inline-block mr-1 mb-0.5" /> Pedidos
          </button>
          <button onClick={() => setActiveTab('HISTORICO')} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'HISTORICO' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
             <HistoryIcon className="w-3 h-3 inline-block mr-1 mb-0.5" /> Histórico
          </button>
          <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
            <UserCheck className="w-3 h-3 inline-block mr-1 mb-0.5" /> Mensalistas
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'AGENDA' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Horários Programados
            </h3>
            {agendaSlots.map(s => (
              <div key={s.id} className={`bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all ${s.status === 'confirmed' ? 'border-grass-200 bg-grass-50/20' : ''}`}>
                <div className="flex items-center gap-4">
                   <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border text-center transition-colors ${s.status === 'confirmed' ? 'bg-grass-500 text-white border-grass-500' : 'bg-gray-50'}`}>
                      <span className={`text-[8px] font-black uppercase leading-none opacity-60 ${s.status === 'confirmed' ? 'opacity-100' : ''}`}>{getDayName(s.date)}</span>
                      <span className="text-[11px] font-black">{s.time}</span>
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.status === 'confirmed' ? 'bg-grass-100 text-grass-600' : s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {s.status === 'confirmed' ? 'Confirmado' : s.matchType}
                        </span>
                        <span className="text-[8px] font-black text-gray-400 uppercase italic">{s.courtName || 'Principal'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-black text-pitch text-sm">{s.localTeamName || 'Aluguel Avulso'}</p>
                        {s.opponentTeamName && (
                          <>
                            <Swords className="w-3 h-3 text-gray-300" />
                            <p className="font-black text-grass-600 text-sm">{s.opponentTeamName}</p>
                          </>
                        )}
                        {!s.opponentTeamName && s.status === 'available' && (
                           <span className="text-[8px] font-black text-orange-400 uppercase italic ml-1">(Aguardando Adversário)</span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{s.localTeamCategory || 'Livre'}</p>
                   </div>
                </div>
                <div className="flex gap-2">
                   {s.status === 'available' && (
                     <>
                        <button onClick={() => openEditSlot(s)} className="p-2 text-gray-300 hover:text-pitch"><Edit3 className="w-4 h-4"/></button>
                        <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                     </>
                   )}
                </div>
              </div>
            ))}
            {agendaSlots.length === 0 && <p className="text-center py-20 text-gray-300 font-black uppercase text-[10px]">Nenhum horário aberto ou confirmado</p>}
          </div>
        )}

        {activeTab === 'SOLICITACOES' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Desafios Pendentes
            </h3>
            {pendingSlots.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-orange-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex flex-col items-center justify-center text-orange-600 font-black">
                         <span className="text-[8px] uppercase">{getDayName(s.date)}</span>
                         <span className="text-[10px]">{s.time}</span>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-gray-400 uppercase">{s.date.split('-').reverse().join('/')}</p>
                         <p className="text-sm font-black text-pitch uppercase">{s.courtName || 'Principal'}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-orange-600 uppercase italic">Aguardando Você</p>
                      <p className="text-lg font-black text-pitch leading-none">R$ {s.price}</p>
                   </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                   <div className="flex-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase">Mandante</p>
                      <p className="text-xs font-black text-pitch">{s.localTeamName || 'Arena'}</p>
                   </div>
                   <Swords className="w-4 h-4 text-orange-200 mx-4" />
                   <div className="flex-1 text-right">
                      <p className="text-[8px] font-black text-gray-400 uppercase">Desafiante</p>
                      <p className="text-xs font-black text-orange-600 underline">{s.opponentTeamName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{s.opponentTeamCategory}</p>
                   </div>
                </div>

                <div className="flex gap-3">
                   <button 
                    disabled={isLoading}
                    onClick={() => handleAction(s.id, 'reject')}
                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95"
                   >
                     <XCircle className="w-4 h-4"/> Recusar
                   </button>
                   <button 
                    disabled={isLoading}
                    onClick={() => handleAction(s.id, 'confirm')}
                    className="flex-1 py-4 bg-pitch text-grass-500 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg active:scale-95"
                   >
                     <CheckCircle className="w-4 h-4"/> Aceitar Jogo
                   </button>
                </div>
              </div>
            ))}
            {pendingSlots.length === 0 && <p className="text-center py-20 text-gray-300 font-black uppercase text-[10px]">Sem solicitações novas</p>}
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-pitch text-xl border">{t.name.charAt(0)}</div>
                     <div>
                        <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Capitão: {t.captainName || 'Não Inf.'}</p>
                        <div className="flex items-center gap-3 mt-2">
                           <span className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime}</span>
                           <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-0.5 rounded uppercase">{t.categories[0]}</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => openEditMensalista(t)} className="p-3 text-gray-300 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                     <button onClick={() => { if(confirm("Remover mensalista?")) api.deleteRegisteredTeam(t.id).then(loadMensalistas); }} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                  </div>
               </div>
             ))}
             <button onClick={() => { setEditingMensalista(null); setMensalistaName(''); setMensalistaCategory(''); setShowAddMensalistaModal(true); }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px] hover:border-pitch transition-all">Adicionar Novo Mensalista</button>
          </div>
        )}

        {activeTab === 'HISTORICO' && (
           <div className="space-y-4">
              {pastSlots.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                       <span className="text-[8px] font-black uppercase leading-none">{getDayName(s.date)}</span>
                       <span className="text-[11px] font-black">{s.time}</span>
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                          <span className="font-black text-pitch text-sm">{s.localTeamName}</span>
                          <Swords className="w-3 h-3 text-gray-300" />
                          <span className="font-black text-pitch text-sm">{s.opponentTeamName || 'Nenhum'}</span>
                       </div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">{s.date.split('-').reverse().join('/')} • R$ {s.price} • {s.courtName}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase bg-gray-100 text-gray-500`}>
                    Encerrado
                  </div>
                </div>
              ))}
           </div>
        )}
      </div>

      {/* Modal Criar/Editar Horário */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase text-pitch">{editingSlot ? 'Editar Horário' : 'Novo Horário'}</h2>
               <button onClick={() => { setShowAddSlotModal(false); setEditingSlot(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                      <input type="date" className="w-full bg-transparent font-black outline-none" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                      <input type="time" className="w-full bg-transparent font-black outline-none" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><Trophy className="w-3 h-3"/> Tipo de Jogo</label>
                      <select className="w-full bg-transparent font-black outline-none uppercase text-xs" value={newSlotType} onChange={e => setNewSlotType(e.target.value as MatchType)}>
                         <option value="AMISTOSO">Amistoso</option>
                         <option value="FESTIVAL">Festival</option>
                         <option value="ALUGUEL">Aluguel Avulso</option>
                      </select>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                      <select className="w-full bg-transparent font-black outline-none uppercase text-xs" value={selectedSport} onChange={e => setSelectedSport(e.target.value)}>
                         {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1 flex items-center gap-1"><LayoutGrid className="w-3 h-3"/> Qual Quadra / Campo?</label>
                   <select className="w-full bg-transparent font-black outline-none uppercase text-xs" value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)}>
                      {field.courts?.length > 0 ? field.courts.map(c => <option key={c} value={c}>{c}</option>) : <option value="Principal">Campo Principal</option>}
                   </select>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border">
                   <div className="flex items-center gap-3 mb-4">
                      <input type="checkbox" id="local" className="w-5 h-5 accent-pitch rounded-lg" checked={isLocalTeamChecked} onChange={e => setIsLocalTeamChecked(e.target.checked)} />
                      <label htmlFor="local" className="text-[10px] font-black text-pitch uppercase">Possui Mandante?</label>
                   </div>
                   
                   {isLocalTeamChecked && (
                      <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4">
                         <div className="flex p-1 bg-white rounded-xl border">
                            <button onClick={() => setMandanteSource('MY_TEAMS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${mandanteSource === 'MY_TEAMS' ? 'bg-pitch text-white' : 'text-gray-400'}`}>Meus Times</button>
                            <button onClick={() => setMandanteSource('MENSALISTAS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${mandanteSource === 'MENSALISTAS' ? 'bg-pitch text-white' : 'text-gray-400'}`}>Meus Mensalistas</button>
                         </div>
                         
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Selecione o Time</label>
                            {mandanteSource === 'MY_TEAMS' ? (
                               <div className="flex flex-wrap gap-2">
                                  {currentUser.teams.map((t, i) => (
                                     <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{t.name}</button>
                                  ))}
                               </div>
                            ) : (
                               <select className="w-full p-3 bg-white border rounded-xl font-black uppercase text-[10px] outline-none" value={selectedMensalistaId} onChange={e => {
                                  setSelectedMensalistaId(e.target.value);
                                  const m = registeredTeams.find(t => t.id === e.target.value);
                                  if (m) setSelectedCategory(m.categories[0] || '');
                               }}>
                                  <option value="">Selecione um Mensalista</option>
                                  {registeredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                               </select>
                            )}
                         </div>

                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria Mandante</label>
                            <div className="flex flex-wrap gap-2">
                               {(mandanteSource === 'MY_TEAMS' ? currentUser.teams[selectedTeamIdx]?.categories : registeredTeams.find(t => t.id === selectedMensalistaId)?.categories)?.map(c => (
                                  <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${selectedCategory === c ? 'bg-grass-500 text-pitch border-grass-500' : 'bg-white border text-gray-400'}`}>{c}</button>
                               ))}
                            </div>
                         </div>
                      </div>
                   )}
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Valor do Horário (R$)</label>
                   <input type="number" className="w-full bg-transparent font-black text-2xl outline-none text-pitch" value={newSlotPrice} onChange={e => setNewSlotPrice(Number(e.target.value))} />
                </div>

                <Button onClick={handleSaveSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl active:scale-95">
                  {editingSlot ? 'Atualizar Horário' : 'Publicar Horário'}
                </Button>
             </div>
           </div>
        </div>
      )}

      {/* Modal Mensalista */}
      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar Mensalista' : 'Novo Mensalista'}</h2>
                 <button onClick={() => { setShowAddMensalistaModal(false); setEditingMensalista(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-4">
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
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

                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria</label>
                    <div className="flex flex-wrap gap-2">
                       {CATEGORY_ORDER.map(c => (
                          <button key={c} onClick={() => setMensalistaCategory(c)} className={`px-3 py-2 rounded-full text-[9px] font-black uppercase transition-all ${mensalistaCategory === c ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{c}</button>
                       ))}
                    </div>
                 </div>
                 
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl">
                   {editingMensalista ? 'Atualizar Mensalista' : 'Salvar Mensalista'}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
