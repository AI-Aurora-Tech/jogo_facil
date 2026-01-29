
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, X, Swords, Edit3, MessageCircle, TrendingUp, CheckCircle2, User as UserIcon, CalendarDays, History as HistoryIcon, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag } from 'lucide-react';
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
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser, categories, onUpdateField, onRateTeam
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  
  // Modals
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);

  // New/Edit Slot State
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

  // New/Edit Mensalista State
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
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

  const handleSaveSlot = async () => {
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
          matchType: newSlotType,
          price: Number(newSlotPrice),
          localTeamCategory: isLocalTeamChecked ? selectedCategory : undefined,
          localTeamName: isLocalTeamChecked ? teamName : undefined,
          localTeamPhone: isLocalTeamChecked ? teamPhone : undefined,
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
      alert("Erro ao salvar horário: " + (e.message || "Verifique se todas as colunas existem no seu Supabase."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    if (!mensalistaName || !mensalistaCategory) return;
    setIsLoading(true);
    try {
      if (editingMensalista) {
        await api.updateRegisteredTeam(editingMensalista.id, {
          name: mensalistaName,
          fixedDay: String(mensalistaDay),
          fixedTime: mensalistaTime,
          categories: [mensalistaCategory],
          captainName: mensalistaCaptain,
          captainPhone: mensalistaPhone
        });
        setEditingMensalista(null);
      } else {
        await api.addRegisteredTeam({
          fieldId: field.id,
          name: mensalistaName,
          fixedDay: String(mensalistaDay),
          fixedTime: mensalistaTime,
          categories: [mensalistaCategory],
          captainName: mensalistaCaptain,
          captainPhone: mensalistaPhone
        });
      }
      setShowAddMensalistaModal(false);
      loadMensalistas();
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar mensalista: " + (e.message || "Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  const openEditSlot = (slot: MatchSlot) => {
    setEditingSlot(slot);
    setNewSlotDate(slot.date);
    setNewSlotTime(slot.time);
    setNewSlotType(slot.matchType);
    setNewSlotPrice(slot.price);
    setIsLocalTeamChecked(slot.hasLocalTeam);
    setSelectedCategory(slot.localTeamCategory || '');
    setSelectedCourt(slot.courtName || 'Principal');
    setSelectedSport(slot.sport || 'Futebol');
    setShowAddSlotModal(true);
  };

  const openEditMensalista = (team: RegisteredTeam) => {
    setEditingMensalista(team);
    setMensalistaName(team.name);
    setMensalistaCaptain(team.captainName || '');
    setMensalistaPhone(team.captainPhone || '');
    setMensalistaDay(Number(team.fixedDay));
    setMensalistaTime(team.fixedTime);
    setMensalistaCategory(team.categories[0] || '');
    setShowAddMensalistaModal(true);
  };

  const getDayName = (dateStr: string) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][new Date(`${dateStr}T00:00:00`).getDay()];

  const today = new Date().toISOString().split('T')[0];
  const agendaSlots = slots.filter(s => s.status === 'available' && s.date >= today);
  const pendingSlots = slots.filter(s => s.status === 'pending_verification' && s.date >= today);
  const confirmedSlots = slots.filter(s => s.status === 'confirmed' && s.date >= today);
  const pastSlots = slots.filter(s => s.date < today);

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
            <button onClick={() => { setEditingSlot(null); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md">
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
            {agendaSlots.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                      <span className="text-[8px] font-black uppercase opacity-60 leading-none">{getDayName(s.date)}</span>
                      <span className="text-[11px] font-black">{s.time}</span>
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : s.matchType === 'FESTIVAL' ? 'bg-blue-100 text-blue-600' : 'bg-grass-100 text-grass-600'}`}>{s.matchType}</span>
                        <span className="text-[8px] font-black text-gray-400 uppercase italic">{s.courtName || 'Principal'} • {s.sport}</span>
                      </div>
                      <p className="font-black text-pitch text-sm mt-1">{s.localTeamName || 'Vaga Aberta'} ({s.localTeamCategory || 'Livre'})</p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => openEditSlot(s)} className="p-2 text-gray-400 hover:text-pitch"><Edit className="w-4 h-4"/></button>
                   <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
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
                     <button onClick={() => openEditMensalista(t)} className="p-3 text-gray-400 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                     <button onClick={() => api.deleteRegisteredTeam(t.id).then(loadMensalistas)} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                  </div>
               </div>
             ))}
             <button onClick={() => { setEditingMensalista(null); setShowAddMensalistaModal(true); }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px] hover:border-pitch transition-all">Adicionar Novo Mensalista</button>
          </div>
        )}

        {activeTab === 'HISTORICO' && (
           <div className="space-y-4">
              <h3 className="text-[10px] font-black text-pitch uppercase tracking-widest flex items-center gap-2">Histórico Completo</h3>
              {[...confirmedSlots, ...pastSlots].map(s => (
                <div key={s.id} className={`bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between ${s.date < today ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                       <span className="text-[8px] font-black uppercase leading-none">{getDayName(s.date)}</span>
                       <span className="text-[11px] font-black">{s.time}</span>
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                          <span className="font-black text-pitch text-sm">{s.localTeamName}</span>
                          <Swords className="w-3 h-3 text-gray-300" />
                          <span className="font-black text-pitch text-sm">{s.opponentTeamName || 'Aguardando'}</span>
                       </div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">{s.date.split('-').reverse().join('/')} • R$ {s.price} • {s.courtName}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${s.status === 'confirmed' ? 'bg-grass-100 text-grass-600' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status === 'confirmed' ? 'Confirmado' : 'Encerrado'}
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
               <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className={`bg-gray-50 p-4 rounded-2xl border ${editingSlot ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                      <input type="date" className="w-full bg-transparent font-black outline-none" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                   </div>
                   <div className={`bg-gray-50 p-4 rounded-2xl border ${editingSlot ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                      <input type="time" className="w-full bg-transparent font-black outline-none" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Tipo de Jogo</label>
                      <select className="w-full bg-transparent font-black outline-none" value={newSlotType} onChange={e => setNewSlotType(e.target.value as MatchType)}>
                         <option value="AMISTOSO">Amistoso</option>
                         <option value="FESTIVAL">Festival</option>
                         <option value="ALUGUEL">Aluguel</option>
                      </select>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                      <select className="w-full bg-transparent font-black outline-none" value={selectedSport} onChange={e => setSelectedSport(e.target.value)}>
                         {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local / Quadra</label>
                   <select className="w-full bg-transparent font-black outline-none" value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)}>
                      {field.courts?.length > 0 ? field.courts.map(c => <option key={c} value={c}>{c}</option>) : <option value="Principal">Principal</option>}
                   </select>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border">
                   <div className="flex items-center gap-3 mb-4">
                      <input type="checkbox" id="local" className="w-5 h-5 rounded-lg" checked={isLocalTeamChecked} onChange={e => setIsLocalTeamChecked(e.target.checked)} />
                      <label htmlFor="local" className="text-[10px] font-black text-pitch uppercase">Incluir Mandante</label>
                   </div>
                   {isLocalTeamChecked && (
                      <div className="space-y-4">
                         <div className="flex p-1 bg-white rounded-xl border mb-4">
                            <button onClick={() => setMandanteSource('MY_TEAMS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${mandanteSource === 'MY_TEAMS' ? 'bg-pitch text-white' : 'text-gray-400'}`}>Meus Times</button>
                            <button onClick={() => setMandanteSource('MENSALISTAS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${mandanteSource === 'MENSALISTAS' ? 'bg-pitch text-white' : 'text-gray-400'}`}>Mensalistas</button>
                         </div>
                         
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Selecione o Time</label>
                            {mandanteSource === 'MY_TEAMS' ? (
                               <div className="flex gap-2">
                                  {currentUser.teams.map((t, i) => (
                                     <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{t.name}</button>
                                  ))}
                               </div>
                            ) : (
                               <select className="w-full p-3 bg-white border rounded-xl font-black uppercase text-[10px]" value={selectedMensalistaId} onChange={e => {
                                  setSelectedMensalistaId(e.target.value);
                                  const m = registeredTeams.find(t => t.id === e.target.value);
                                  if (m) setSelectedCategory(m.categories[0]);
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
                                  <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${selectedCategory === c ? 'bg-grass-500 text-pitch' : 'bg-white border text-gray-400'}`}>{c}</button>
                               ))}
                            </div>
                         </div>
                         {selectedCategory && (
                            <div className="p-3 bg-grass-50 rounded-xl border border-grass-100">
                               <p className="text-[9px] font-black text-grass-700 uppercase italic">Aceita adversários (±1): {calculateAllowedRange(selectedCategory).join(', ')}</p>
                            </div>
                         )}
                      </div>
                   )}
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                   <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Valor do Horário (R$)</label>
                   <input type="number" className="w-full bg-transparent font-black text-xl outline-none" value={newSlotPrice} onChange={e => setNewSlotPrice(Number(e.target.value))} />
                </div>
                <Button onClick={handleSaveSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Confirmar</Button>
             </div>
           </div>
        </div>
      )}

      {/* Modal Criar/Editar Mensalista */}
      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar Mensalista' : 'Novo Mensalista'}</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-4">
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                    <input className="w-full bg-transparent font-black outline-none" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Capitão</label>
                       <input className="w-full bg-transparent font-black outline-none" value={mensalistaCaptain} onChange={e => setMensalistaCaptain(e.target.value)} placeholder="Nome do Capitão" />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">WhatsApp Capitão</label>
                       <input className="w-full bg-transparent font-black outline-none" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia Fixo</label>
                       <select className="w-full bg-transparent font-black outline-none" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria</label>
                    <div className="flex flex-wrap gap-2">
                       {CATEGORY_ORDER.map(c => (
                          <button key={c} onClick={() => setMensalistaCategory(c)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${mensalistaCategory === c ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{c}</button>
                       ))}
                    </div>
                 </div>
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Salvar Mensalista</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
