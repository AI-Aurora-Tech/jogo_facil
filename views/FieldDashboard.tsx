
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, X, Swords, Edit3, MessageCircle, TrendingUp, CheckCircle2, User as UserIcon, CalendarDays, History as HistoryIcon, UserCheck, Phone } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam } from '../types';
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
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  
  // Modals
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);

  // New Slot State
  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState('18:00');
  const [newSlotType, setNewSlotType] = useState<MatchType>('AMISTOSO');
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate || 0);
  const [isLocalTeamChecked, setIsLocalTeamChecked] = useState(false);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');

  // New Mensalista State
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1); // Segunda
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState('');

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
    const idx = CATEGORY_ORDER.indexOf(cat);
    if (idx === -1) return [cat];
    const range = [];
    if (idx > 0) range.push(CATEGORY_ORDER[idx - 1]);
    range.push(CATEGORY_ORDER[idx]);
    if (idx < CATEGORY_ORDER.length - 1) range.push(CATEGORY_ORDER[idx + 1]);
    return range;
  };

  const handleSaveSlot = async () => {
    setIsLoading(true);
    try {
      const allowedCats = selectedCategory ? calculateAllowedRange(selectedCategory) : [];
      const team = currentUser.teams[selectedTeamIdx];

      const payload: Omit<MatchSlot, 'id'> = {
        fieldId: field.id,
        date: newSlotDate,
        time: newSlotTime,
        durationMinutes: 60,
        matchType: newSlotType,
        isBooked: false,
        hasLocalTeam: isLocalTeamChecked,
        localTeamName: isLocalTeamChecked ? team.name : undefined,
        localTeamCategory: isLocalTeamChecked ? selectedCategory : undefined,
        localTeamPhone: isLocalTeamChecked ? currentUser.phoneNumber : undefined,
        allowedOpponentCategories: allowedCats,
        price: newSlotPrice,
        status: 'available'
      };
      await onAddSlot([payload]);
      setShowAddSlotModal(false);
    } catch (e) {
      alert("Erro ao salvar horário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    if (!mensalistaName || !mensalistaCategory) return;
    setIsLoading(true);
    try {
      // 1. Salva o registro do mensalista
      await api.addRegisteredTeam({
        fieldId: field.id,
        name: mensalistaName,
        fixedDay: String(mensalistaDay),
        fixedTime: mensalistaTime,
        categories: [mensalistaCategory]
      });

      // 2. Gera 12 semanas de horários
      const newSlots: Omit<MatchSlot, 'id'>[] = [];
      const today = new Date();
      let count = 0;
      let dayOffset = 0;

      while (count < 12) {
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        
        if (date.getDay() === mensalistaDay) {
          const dateStr = date.toISOString().split('T')[0];
          newSlots.push({
            fieldId: field.id,
            date: dateStr,
            time: mensalistaTime,
            durationMinutes: 60,
            matchType: 'FIXO',
            isBooked: false,
            hasLocalTeam: true,
            localTeamName: mensalistaName,
            localTeamCategory: mensalistaCategory,
            localTeamPhone: mensalistaPhone,
            allowedOpponentCategories: calculateAllowedRange(mensalistaCategory),
            price: field.hourlyRate,
            status: 'available'
          });
          count++;
        }
        dayOffset++;
      }

      await onAddSlot(newSlots);
      setShowAddMensalistaModal(false);
      loadMensalistas();
      onRefreshData();
      alert("Mensalista cadastrado e 12 semanas de agenda geradas!");
    } catch (e) {
      alert("Erro ao salvar mensalista.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDayName = (dateStr: string) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][new Date(`${dateStr}T00:00:00`).getDay()];

  // Filter Logic
  const today = new Date().toISOString().split('T')[0];
  const agendaSlots = slots.filter(s => s.status === 'available' && s.date >= today);
  const pendingSlots = slots.filter(s => s.status === 'pending_verification' && s.date >= today);
  const confirmedSlots = slots.filter(s => s.status === 'confirmed' && s.date >= today);
  const pastSlots = slots.filter(s => s.date < today);

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
            <button onClick={() => activeTab === 'MENSALISTAS' ? setShowAddMensalistaModal(true) : setShowAddSlotModal(true)} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md">
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
            <CalendarDays className="w-3 h-3 inline-block mr-1 mb-0.5" /> Agenda
          </button>
          <button onClick={() => setActiveTab('HISTORICO')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'HISTORICO' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
             {pendingSlots.length > 0 && <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1" />}
             <HistoryIcon className="w-3 h-3 inline-block mr-1 mb-0.5" /> Histórico
          </button>
          <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
            <UserCheck className="w-3 h-3 inline-block mr-1 mb-0.5" /> Mensalistas
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'AGENDA' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Horários em Aberto
            </h3>
            {agendaSlots.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center gap-4 text-gray-300">
                <Calendar className="w-12 h-12 opacity-10" />
                <p className="font-black uppercase text-xs">Nenhum horário aberto</p>
              </div>
            )}
            {agendaSlots.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                      <span className="text-[8px] font-black uppercase opacity-60 leading-none">{getDayName(s.date)}</span>
                      <span className="text-[11px] font-black">{s.time}</span>
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-grass-100 text-grass-600'}`}>{s.matchType}</span>
                        <span className="text-[8px] font-black text-gray-400 uppercase italic">Para: {s.allowedOpponentCategories.join(', ')}</span>
                      </div>
                      <p className="font-black text-pitch text-sm mt-1">{s.localTeamName || 'Vaga Aberta'} ({s.localTeamCategory || 'Livre'})</p>
                   </div>
                </div>
                <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'HISTORICO' && (
          <div className="space-y-8">
            {pendingSlots.length > 0 && (
              <section className="space-y-4">
                 <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                   <TrendingUp className="w-4 h-4" /> Aprovações Pendentes
                 </h3>
                 {pendingSlots.map(s => (
                   <div key={s.id} className="bg-orange-50 p-5 rounded-[2.5rem] border-2 border-orange-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center border text-orange-500">
                           <Clock className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="font-black text-pitch text-sm">{s.opponentTeamName || 'Time Desafiante'}</p>
                           <p className="text-[9px] font-bold text-gray-400 uppercase">{getDayName(s.date)}, {s.date.split('-').reverse().join('/')} às {s.time}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => onRejectBooking(s.id)} className="p-2 text-red-500 bg-white rounded-xl shadow-sm border"><X className="w-5 h-5"/></button>
                         <button onClick={() => onConfirmBooking(s.id)} className="p-2 text-white bg-orange-500 rounded-xl shadow-md"><CheckCircle2 className="w-5 h-5"/></button>
                      </div>
                   </div>
                 ))}
              </section>
            )}

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-pitch uppercase tracking-widest flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4 text-grass-500" /> Confirmados / Passados
              </h3>
              {confirmedSlots.length === 0 && pastSlots.length === 0 && (
                <div className="p-10 text-center text-gray-300 font-bold uppercase text-xs">Nenhum registro histórico</div>
              )}
              {[...confirmedSlots, ...pastSlots].map(s => (
                <div key={s.id} className={`bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between ${s.date < today ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                       <span className="text-[8px] font-black uppercase opacity-60 leading-none">{getDayName(s.date)}</span>
                       <span className="text-[11px] font-black">{s.time}</span>
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                          <span className="font-black text-pitch text-sm">{s.localTeamName || 'Mandante'}</span>
                          <Swords className="w-3 h-3 text-gray-300" />
                          <span className="font-black text-pitch text-sm">{s.opponentTeamName || 'Visitante'}</span>
                       </div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">{s.date.split('-').reverse().join('/')} • R$ {s.price}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.date < today ? 'bg-gray-100 text-gray-500' : 'bg-grass-100 text-grass-600'}`}>
                    {s.date < today ? 'Concluído' : 'Confirmado'}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             <div className="p-8 bg-pitch rounded-[2.5rem] text-white flex items-center justify-between shadow-xl mb-6">
                <div>
                   <h2 className="text-lg font-black italic uppercase tracking-tighter">Meus Mensalistas</h2>
                   <p className="text-[9px] font-bold text-grass-500 uppercase tracking-widest mt-1">Times de Horário Fixo</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                   <UserCheck className="w-6 h-6 text-grass-500" />
                </div>
             </div>

             {registeredTeams.length === 0 && (
               <button onClick={() => setShowAddMensalistaModal(true)} className="w-full py-16 border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center gap-4 text-gray-400 hover:border-pitch hover:text-pitch transition-all active:scale-95">
                 <Plus className="w-10 h-10" />
                 <span className="font-black uppercase text-xs">Cadastrar Primeiro Mensalista</span>
               </button>
             )}

             <div className="grid gap-3">
               {registeredTeams.map(t => (
                 <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-pitch text-xl border">
                         {t.name.charAt(0)}
                       </div>
                       <div>
                          <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                          <div className="flex items-center gap-3 mt-2">
                             <span className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime}</span>
                             <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-0.5 rounded uppercase">{t.categories[0]}</span>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => api.deleteRegisteredTeam(t.id).then(loadMensalistas)} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {/* Modal Criar Horário Avulso */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase text-pitch">Novo Horário</h2>
               <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
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

                <div className="p-4 bg-gray-50 rounded-2xl border">
                   <div className="flex items-center gap-3 mb-4">
                      <input type="checkbox" id="local" className="w-5 h-5 rounded-lg" checked={isLocalTeamChecked} onChange={e => setIsLocalTeamChecked(e.target.checked)} />
                      <label htmlFor="local" className="text-[10px] font-black text-pitch uppercase">Incluir meu time Mandante</label>
                   </div>
                   
                   {isLocalTeamChecked && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Qual seu time?</label>
                            <div className="flex gap-2">
                               {currentUser.teams.map((t, i) => (
                                  <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{t.name}</button>
                               ))}
                            </div>
                         </div>
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria Mandante</label>
                            <div className="flex flex-wrap gap-2">
                               {currentUser.teams[selectedTeamIdx]?.categories.map(c => (
                                  <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${selectedCategory === c ? 'bg-grass-500 text-pitch' : 'bg-white border text-gray-400'}`}>{c}</button>
                               ))}
                            </div>
                         </div>
                         {selectedCategory && (
                            <div className="p-3 bg-grass-50 rounded-xl border border-grass-100">
                               <p className="text-[9px] font-black text-grass-700 uppercase">Aceita adversários: {calculateAllowedRange(selectedCategory).join(', ')}</p>
                            </div>
                         )}
                      </div>
                   )}
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Valor do Horário (R$)</label>
                   <input type="number" className="w-full bg-transparent font-black text-xl outline-none" value={newSlotPrice} onChange={e => setNewSlotPrice(Number(e.target.value))} />
                </div>

                <Button onClick={handleSaveSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Publicar Agenda</Button>
             </div>
           </div>
        </div>
      )}

      {/* Modal Novo Mensalista */}
      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">Novo Mensalista</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>

              <div className="space-y-4">
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                    <input className="w-full bg-transparent font-black outline-none text-pitch" placeholder="Ex: Time dos Amigos FC" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} />
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp do Capitão</label>
                    <div className="flex items-center gap-2">
                       <Phone className="w-4 h-4 text-gray-400" />
                       <input className="w-full bg-transparent font-black outline-none text-pitch" placeholder="(00) 00000-0000" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia Fixo</label>
                       <select className="w-full bg-transparent font-black outline-none" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          <option value={0}>Domingo</option>
                          <option value={1}>Segunda</option>
                          <option value={2}>Terça</option>
                          <option value={3}>Quarta</option>
                          <option value={4}>Quinta</option>
                          <option value={5}>Sexta</option>
                          <option value={6}>Sábado</option>
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário Fixo</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                 </div>

                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria do Mensalista</label>
                    <div className="flex flex-wrap gap-2">
                       {CATEGORY_ORDER.map(c => (
                          <button key={c} onClick={() => setMensalistaCategory(c)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${mensalistaCategory === c ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{c}</button>
                       ))}
                    </div>
                 </div>

                 <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex gap-3">
                    <RefreshCcw className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <p className="text-[10px] font-black text-orange-900 uppercase">Atenção: O sistema gerará automaticamente os próximos 3 meses de agenda para este time.</p>
                 </div>

                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Salvar e Gerar Agenda</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
