
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, Sparkles, X, ChevronRight, Swords, Edit3, Save, Tag, User as UserIcon, Award, CheckCircle2, MessageCircle, TrendingUp, History as HistoryIcon, UserCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, RegisteredTeam } from '../types';
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
  onRateTeam: (userId: string, slotId: string, rating: number) => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDay, setNewTeamDay] = useState(1);
  const [newTeamTime, setNewTeamTime] = useState('19:00');
  const [newTeamCat, setNewTeamCat] = useState('');

  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState('18:00');
  const [newSlotDuration, setNewSlotDuration] = useState(60);
  const [newSlotType, setNewSlotType] = useState<MatchType>('AMISTOSO');
  const [newSlotReward, setNewSlotReward] = useState('');
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate || 0);
  const [isLocalTeamChecked, setIsLocalTeamChecked] = useState(false);
  const [selectedLocalCategory, setSelectedLocalCategory] = useState(currentUser.teamCategories[0] || '');

  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [confirmationSuccess, setConfirmationSuccess] = useState<MatchSlot | null>(null);

  useEffect(() => { loadRegisteredTeams(); }, [field.id]);

  const loadRegisteredTeams = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (e) { console.error(e); }
  };

  const handleGenerate10Weeks = async () => {
    if (registeredTeams.length === 0) {
      alert("Adicione mensalistas primeiro.");
      return;
    }
    setIsLoading(true);
    try {
      const newSlots: Omit<MatchSlot, 'id'>[] = [];
      const today = new Date();
      
      for (const team of registeredTeams) {
        let count = 0;
        let dayOffset = 0;
        while (count < 10) {
          const date = new Date(today);
          date.setDate(today.getDate() + dayOffset);
          if (date.getDay() === team.fixedDay) {
            const dateStr = date.toISOString().split('T')[0];
            const exists = slots.some(s => s.date === dateStr && s.time === team.fixedTime);
            if (!exists) {
              newSlots.push({
                fieldId: field.id,
                date: dateStr,
                time: team.fixedTime,
                durationMinutes: 60,
                matchType: 'FIXO',
                isBooked: false,
                hasLocalTeam: true,
                localTeamName: team.name,
                localTeamPhone: currentUser.phoneNumber,
                bookedByTeamName: team.name,
                bookedByCategory: team.categories[0],
                allowedCategories: team.categories,
                price: field.hourlyRate,
                status: 'available'
              });
            }
            count++;
          }
          dayOffset++;
        }
      }

      if (newSlots.length > 0) {
        await onAddSlot(newSlots);
        alert(`${newSlots.length} horários gerados com sucesso!`);
      } else {
        alert("A agenda já está completa para os próximos meses.");
      }
    } catch (e) {
      alert("Erro ao gerar agenda.");
    } finally {
      setIsLoading(false);
      onRefreshData();
    }
  };

  const handleCreateSingleSlot = async () => {
    setIsLoading(true);
    try {
      const payload: Omit<MatchSlot, 'id'> = {
        fieldId: field.id,
        date: newSlotDate,
        time: newSlotTime,
        durationMinutes: newSlotDuration,
        matchType: newSlotType,
        rewardDescription: newSlotReward,
        isBooked: false,
        hasLocalTeam: isLocalTeamChecked,
        localTeamName: isLocalTeamChecked ? currentUser.teamName : undefined,
        localTeamPhone: isLocalTeamChecked ? currentUser.phoneNumber : undefined,
        bookedByTeamName: isLocalTeamChecked ? currentUser.teamName : undefined,
        bookedByCategory: isLocalTeamChecked ? selectedLocalCategory : undefined,
        bookedByUserId: isLocalTeamChecked ? currentUser.id : undefined,
        bookedByUserPhone: isLocalTeamChecked ? currentUser.phoneNumber : undefined,
        price: newSlotPrice,
        status: 'available',
        allowedCategories: []
      };
      await onAddSlot([payload]);
      setShowAddSlotModal(false);
      setIsLocalTeamChecked(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (slot: MatchSlot) => {
    setIsLoading(true);
    try {
      await onConfirmBooking(slot.id);
      
      if (slot.bookedByUserId) {
        await api.createNotification({
          userId: slot.bookedByUserId,
          title: "Partida Confirmada!",
          description: `Seu jogo na arena ${field.name} dia ${slot.date.split('-').reverse().join('/')} às ${slot.time} foi confirmado!`,
          type: 'success'
        });
      }
      
      setConfirmationSuccess(slot);
    } catch (e) {
      alert("Erro ao confirmar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectAction = async (slot: MatchSlot) => {
    if (!confirm("Deseja recusar esta reserva? O horário voltará a ficar disponível.")) return;
    setIsLoading(true);
    try {
      await onRejectBooking(slot.id);
      if (slot.bookedByUserId) {
        await api.createNotification({
          userId: slot.bookedByUserId,
          title: "Reserva Recusada",
          description: `Infelizmente sua reserva para o dia ${slot.date} na ${field.name} foi recusada. O valor já está disponível para estorno/novo agendamento.`,
          type: 'warning'
        });
      }
      onRefreshData();
      alert("Reserva recusada e cliente notificado.");
    } catch (e) {
      alert("Erro ao recusar.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDayName = (dateStr: string) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const date = new Date(`${dateStr}T00:00:00`);
    return days[date.getDay()];
  };

  const getWhatsappLink = (phone: string, message: string) => {
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const agendaSlots = slots.filter(s => s.date >= todayStr).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  const historySlots = slots.filter(s => s.date < todayStr && s.status === 'confirmed').sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  const pendingSlots = slots.filter(s => s.status === 'pending_verification' && s.date >= todayStr);

  const totalHistoryEarnings = historySlots.reduce((acc, s) => acc + s.price, 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="p-6 bg-white border-b sticky top-0 z-20 glass">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-pitch rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                <img src={field.imageUrl} className="w-full h-full object-cover" />
             </div>
             <div>
                <h1 className="font-black text-pitch italic uppercase tracking-tighter leading-none">{field.name}</h1>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Gestão de Arena</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddSlotModal(true)} className="p-2 bg-pitch text-white rounded-xl active:scale-95 shadow-md">
               <Plus className="w-5 h-5"/>
            </button>
            <button onClick={handleGenerate10Weeks} disabled={isLoading} className="bg-[#10b981] text-[#022c22] px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50">
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCcw className="w-4 h-4"/>} 10 Semanas
            </button>
          </div>
        </div>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Agenda</button>
          <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Mensalistas</button>
          <button onClick={() => setActiveTab('HISTORICO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'HISTORICO' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Histórico</button>
        </div>
      </div>

      <div className="p-6 pb-32">
        {activeTab === 'AGENDA' && (
          <div className="space-y-4">
            {pendingSlots.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" /> Aprovações Pendentes</h3>
                {pendingSlots.map(s => (
                  <div key={s.id} className="bg-orange-50 p-5 rounded-[2.5rem] border-2 border-orange-100 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-sm font-black text-pitch">{s.bookedByTeamName || 'Time'} vs {s.opponentTeamName || 'Vaga'}</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase mt-1">{getDayName(s.date)}, {s.date.split('-').reverse().join('/')} às {s.time}</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleRejectAction(s)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><X className="w-6 h-6"/></button>
                       <button onClick={() => handleConfirmAction(s)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95">Confirmar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-4"><Calendar className="w-4 h-4" /> Agenda Próximos Dias</h3>
              {agendaSlots.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                  <Calendar className="w-12 h-12 text-gray-200" />
                  <p className="text-gray-400 font-bold uppercase text-xs">Nenhum horário futuro</p>
                </div>
              )}
              {agendaSlots.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all relative overflow-hidden">
                  {s.matchType === 'FIXO' && <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border group-hover:bg-pitch group-hover:text-white transition-colors text-center p-1">
                      <span className="text-[8px] font-black uppercase opacity-60 leading-none mb-1">{getDayName(s.date).slice(0,3)}</span>
                      <span className="text-[11px] font-black">{s.time}</span>
                      <span className="text-[7px] font-bold uppercase opacity-40">{s.date.split('-').reverse().slice(0,2).join('/')}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-grass-100 text-grass-600'}`}>{s.matchType}</span>
                        {s.isBooked && <span className="bg-pitch text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><CheckCircle2 className="w-2 h-2"/> Confirmado</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-black text-pitch text-sm">{s.localTeamName || s.bookedByTeamName || 'Vaga Aberta'}</span>
                        <Swords className="w-3 h-3 text-gray-300 mx-1" />
                        <span className="font-black text-pitch text-sm opacity-40">{s.opponentTeamName || 'Aguardando...'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingSlot(s)} className="p-2 text-gray-300 hover:text-pitch"><Edit3 className="w-4 h-4"/></button>
                    <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             <button onClick={() => setShowAddTeamModal(true)} className="w-full py-10 bg-white border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-gray-400 font-black uppercase text-xs hover:border-pitch hover:text-pitch transition-all active:scale-95">
               <Plus className="w-8 h-8" /> Cadastrar Mensalista
             </button>
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pitch rounded-2xl flex items-center justify-center text-2xl font-black text-grass-500">{t.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-black text-pitch text-lg leading-tight">{t.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <UserCheck className="w-3 h-3 text-grass-500" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][t.fixedDay]} às {t.fixedTime}</span>
                      </div>
                    </div>
                 </div>
                 <button onClick={() => api.deleteRegisteredTeam(t.id).then(loadRegisteredTeams)} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'HISTORICO' && (
          <div className="space-y-4">
             <div className="bg-pitch rounded-[2.5rem] p-8 text-white flex items-center justify-between shadow-xl">
                <div>
                   <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-grass-500 mb-2">Faturamento de Confirmados</h2>
                   <p className="text-4xl font-black italic tracking-tighter leading-none">R$ {totalHistoryEarnings.toFixed(0)}</p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                   <TrendingUp className="w-8 h-8 text-grass-500" />
                </div>
             </div>

             <div className="grid gap-3">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-4"><HistoryIcon className="w-4 h-4" /> Jogos Anteriores</h3>
                {historySlots.length === 0 && (
                  <div className="p-20 text-center text-gray-300 font-black uppercase text-xs">Nenhum registro no histórico</div>
                )}
                {historySlots.map(s => (
                  <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border flex items-center justify-between opacity-80 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                        <span className="text-[10px] font-black">{s.time}</span>
                        <span className="text-[7px] font-bold uppercase opacity-40">{s.date.split('-').reverse().slice(0,2).join('/')}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <span className="font-black text-pitch text-sm">{s.bookedByTeamName || s.localTeamName}</span>
                           <Swords className="w-3 h-3 text-gray-300" />
                           <span className="font-black text-pitch text-sm">{s.opponentTeamName || 'Avulso'}</span>
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">R$ {s.price} • {s.matchType}</p>
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {confirmationSuccess && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 text-center animate-in zoom-in-95 duration-300 shadow-2xl">
              <div className="w-20 h-20 bg-grass-100 text-grass-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-pitch uppercase italic leading-tight">Confirmado!</h2>
              <p className="text-gray-500 text-xs font-medium mt-2">Horário oficializado. Envie agora a confirmação no WhatsApp do capitão:</p>
              
              <div className="mt-8">
                 <a 
                   href={getWhatsappLink(confirmationSuccess.bookedByUserPhone || confirmationSuccess.opponentTeamPhone || confirmationSuccess.localTeamPhone || '', `Olá! Confirmamos sua partida para o dia ${confirmationSuccess.date.split('-').reverse().join('/')} às ${confirmationSuccess.time} na arena ${field.name}. Bom jogo!`)}
                   target="_blank"
                   className="w-full bg-grass-500 text-pitch py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg hover:bg-grass-600 transition-colors"
                 >
                   <MessageCircle className="w-4 h-4" /> Enviar no WhatsApp
                 </a>
              </div>

              <button onClick={() => { setConfirmationSuccess(null); onRefreshData(); }} className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-2 hover:text-pitch transition-colors">Fechar Janela</button>
           </div>
        </div>
      )}

      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-pitch">Criar Horário</h2>
               <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Tipo de Jogo</label>
                      <select className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotType} onChange={e => setNewSlotType(e.target.value as MatchType)}>
                        <option value="AMISTOSO">Amistoso</option>
                        <option value="FESTIVAL">Festival</option>
                        <option value="ALUGUEL">Aluguel</option>
                      </select>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Data da Partida</label>
                      <input type="date" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Horário de Início</label>
                    <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Preço (R$)</label>
                    <input type="number" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotPrice} onChange={e => setNewSlotPrice(Number(e.target.value))} />
                  </div>
                </div>
                <Button onClick={handleCreateSingleSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest mt-4">Publicar Horário</Button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
