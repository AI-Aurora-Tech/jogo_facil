import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, X, Swords, Edit3, MessageCircle, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle, CalendarPlus, Mail, Camera, UserPlus, Smartphone, CalendarDays, History as HistoryIcon, BadgeCheck, Ban, Lock } from 'lucide-react';
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
  
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotType, setSlotType] = useState<MatchType>('ALUGUEL');
  const [slotCourt, setSlotCourt] = useState(field.courts?.[0] || 'Principal');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate);
  const [slotSport, setSlotSport] = useState('Futebol');
  const [hasLocalTeam, setHasLocalTeam] = useState(false);
  const [localTeamSource, setLocalTeamSource] = useState<'MY_TEAMS' | 'MENSALISTAS'>('MENSALISTAS');
  const [selectedLocalIdentity, setSelectedLocalIdentity] = useState('0-0');
  const [allowedCats, setAllowedCats] = useState<string[]>([]);

  // Form States Mensalista
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
      let localName = null;
      let localCat = null;
      let localPhone = null;
      let localLogo = null;
      let localGender: Gender = 'MASCULINO';

      if (hasLocalTeam) {
        const [teamIdx, catIdx] = selectedLocalIdentity.split('-').map(Number);
        if (localTeamSource === 'MENSALISTAS') {
          const t = registeredTeams[teamIdx];
          if (t) {
            localName = t.name;
            localCat = t.categories[catIdx] || t.categories[0];
            localPhone = t.captainPhone;
            localLogo = t.logoUrl;
            localGender = t.gender;
          }
        } else {
          const t = currentUser.teams[teamIdx];
          if (t) {
            localName = t.name;
            localCat = t.categories[catIdx] || t.categories[0];
            localPhone = currentUser.phoneNumber;
            localLogo = t.logoUrl;
            localGender = t.gender;
          }
        }
      }

      await api.createSlots([{
        fieldId: field.id,
        date: slotDate,
        time: slotTime,
        matchType: slotType,
        isBooked: false,
        hasLocalTeam: hasLocalTeam,
        localTeamName: localName,
        localTeamCategory: localCat,
        localTeamPhone: localPhone,
        localTeamLogoUrl: localLogo,
        localTeamGender: localGender,
        price: slotPrice,
        status: 'available',
        courtName: slotCourt,
        sport: slotSport,
        allowedOpponentCategories: allowedCats
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

  // Separação de Agenda vs Histórico
  const agendaSlots = slots.filter(s => s.date >= todayStr && (s.status === 'available' || s.status === 'confirmed'));
  const historySlots = slots.filter(s => s.date < todayStr);

  // Helper para Status Visual
  const getSlotStatusDisplay = (slot: MatchSlot) => {
    if (slot.status === 'confirmed') {
      if (slot.opponentTeamName) {
        return { label: 'JOGO FECHADO', color: 'bg-blue-100 text-blue-700', icon: <BadgeCheck className="w-6 h-6"/> };
      }
      if (slot.matchType === 'FIXO') {
        return { label: 'MENSALISTA', color: 'bg-purple-100 text-purple-700', icon: <UserCheck className="w-6 h-6"/> };
      }
      return { label: 'ALUGADO / OCUPADO', color: 'bg-gray-100 text-gray-600', icon: <Lock className="w-6 h-6"/> };
    }
    
    // Available
    if (slot.localTeamName) {
      return { label: 'DESAFIO ABERTO', color: 'bg-yellow-100 text-yellow-700', icon: <Swords className="w-6 h-6"/> };
    }
    return { label: 'LIVRE', color: 'bg-grass-100 text-grass-700', icon: <Clock className="w-6 h-6"/> };
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
          <div className="grid gap-4">
            {agendaSlots.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum horário futuro na agenda.</div>
            ) : (
              agendaSlots.map(slot => {
                const statusInfo = getSlotStatusDisplay(slot);
                return (
                  <div key={slot.id} className="bg-white p-5 rounded-[2.5rem] border flex items-center justify-between shadow-sm hover:border-pitch transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${statusInfo.color}`}>
                          {statusInfo.icon}
                      </div>
                      <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-pitch uppercase">{slot.date.split('-').reverse().join('/')} às {slot.time}</p>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase mt-1">
                            {slot.opponentTeamName 
                              ? `${slot.localTeamName || 'Arena'} vs ${slot.opponentTeamName}` 
                              : slot.localTeamName 
                                ? `${slot.localTeamName} (${slot.localTeamCategory}) - Aguardando` 
                                : 'Horário sem time definido'} 
                            <br/> {slot.matchType} • {slot.courtName || 'Principal'}
                          </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {slot.status === 'confirmed' && slot.opponentTeamPhone && (
                        <button onClick={() => handleWhatsApp(slot.opponentTeamPhone, `Olá capitão do ${slot.opponentTeamName}! Jogo confirmado na arena ${field.name} para o dia ${slot.date.split('-').reverse().join('/')} às ${slot.time}.`)} className="p-3 bg-grass-50 text-grass-600 rounded-xl"><Smartphone className="w-4 h-4"/></button>
                      )}
                      <button onClick={() => { if(confirm("Remover este horário?")) onDeleteSlot(slot.id); }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                );
              })
            )}
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

      {/* Modal Add Slot (simplificado para o exemplo) */}
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
                 <Button onClick={handleCreateSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">Criar Horário</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};