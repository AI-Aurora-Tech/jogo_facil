
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, MapPin, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, Swords, Star, UsersRound, ChevronRight, AlertCircle, Tag, Upload, Edit2, Loader2, Sparkles, CheckCircle2, Eye, FileText, Calendar, Info, RefreshCcw } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, RegisteredTeam } from '../types';
import { api } from '../services/api';

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
  categories = [], field, slots = [], currentUser, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, onUpdateField, onRateTeam
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS'>('AGENDA');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [viewingSlot, setViewingSlot] = useState<MatchSlot | null>(null);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados Novo Slot
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate.toString());
  const [slotType, setSlotType] = useState<MatchType>('ALUGUEL');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  // Estados Novo Time Fixo
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDay, setNewTeamDay] = useState(1);
  const [newTeamTime, setNewTeamTime] = useState('20:00');
  const [newTeamCat, setNewTeamCat] = useState(categories[0] || 'Livre');

  useEffect(() => {
    loadRegisteredTeams();
  }, [field.id]);

  const loadRegisteredTeams = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (err) {
      console.error("Erro ao carregar times:", err);
    }
  };

  const handleAddFixedTeam = async () => {
    if (!newTeamName) {
      setError('O nome do time é obrigatório');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      await api.addRegisteredTeam({
        fieldId: field.id,
        name: newTeamName,
        fixedDay: newTeamDay,
        fixedTime: newTeamTime,
        categories: [newTeamCat],
        createdAt: new Date().toISOString()
      });
      
      setNewTeamName('');
      setShowAddTeamModal(false);
      await loadRegisteredTeams();
      alert('Time mensalista cadastrado com sucesso!');
    } catch (err: any) {
      console.error("Erro ao salvar time:", err);
      setError(err.message || 'Erro ao salvar time mensalista.');
    } finally {
      setIsLoading(false);
    }
  };

  const replicateFixedSlots = async () => {
    if (registeredTeams.length === 0) {
      alert("Cadastre times fixos primeiro na aba Mensalistas.");
      return;
    }
    
    setIsLoading(true);
    try {
        const newSlots: Omit<MatchSlot, 'id'>[] = [];
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
            const current = new Date();
            current.setDate(today.getDate() + i);
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];

            registeredTeams.filter(t => t.fixedDay === dayOfWeek).forEach(team => {
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
                        bookedByTeamName: team.name,
                        bookedByCategory: team.categories[0],
                        allowedCategories: team.categories,
                        price: field.hourlyRate,
                        status: 'available'
                    });
                }
            });
        }
        if (newSlots.length > 0) await onAddSlot(newSlots);
        alert(`${newSlots.length} horários fixos gerados para a semana!`);
    } catch (err) {
      alert("Erro ao gerar agenda. Tente novamente.");
    } finally { setIsLoading(false); onRefreshData(); }
  };

  const handleSaveSlot = async () => {
    setIsLoading(true);
    try {
      const selectedTeam = registeredTeams.find(t => t.id === selectedTeamId);
      const slotData: Omit<MatchSlot, 'id'> = {
        fieldId: field.id,
        date: slotDate,
        time: slotTime,
        durationMinutes: 60,
        matchType: slotType,
        isBooked: false,
        hasLocalTeam: slotType === 'FIXO',
        localTeamName: selectedTeam?.name,
        bookedByTeamName: selectedTeam?.name,
        bookedByCategory: selectedTeam?.categories[0] || 'Livre',
        allowedCategories: selectedTeam?.categories || ['Livre'],
        price: parseFloat(slotPrice),
        status: 'available'
      };
      await onAddSlot([slotData]);
      setShowAddModal(false);
      onRefreshData();
    } catch (err) {
      alert("Erro ao publicar horário.");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingSlots = slots.filter(s => s.status === 'pending_verification' && s.receiptUrl);

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="p-6 bg-white border-b sticky top-0 z-20 flex flex-col gap-4 glass">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pitch rounded-xl overflow-hidden shadow-inner border border-gray-100">
                    <img src={field.imageUrl} className="w-full h-full object-cover" alt="Arena" />
                </div>
                <div>
                    <h1 className="text-lg font-black text-pitch tracking-tight leading-none">{field.name}</h1>
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">Gestão de Arena</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setShowAddModal(true)} className="p-2.5 bg-pitch rounded-xl text-white active:scale-95 transition-transform"><Plus className="w-5 h-5"/></button>
            </div>
        </div>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Agenda Ativa</button>
            <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Mensalistas</button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'AGENDA' ? (
          <div className="space-y-6">
            {pendingSlots.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-100 rounded-[2rem] p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-orange-600" />
                        <h3 className="text-[10px] font-black text-orange-900 uppercase tracking-widest">Validar Pix ({pendingSlots.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {pendingSlots.map(s => (
                          <div key={s.id} onClick={() => setViewingSlot(s)} className="bg-white p-4 rounded-2xl border border-orange-200 flex justify-between items-center shadow-sm active:scale-95 transition-transform">
                              <span className="text-xs font-black text-pitch truncate">
                                {s.opponentTeamName ? `${s.bookedByTeamName} vs ${s.opponentTeamName}` : s.bookedByTeamName}
                              </span>
                              <ChevronRight className="w-4 h-4 text-orange-400" />
                          </div>
                      ))}
                    </div>
                </div>
            )}

            <div className="bg-pitch rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-grass-500 italic">Grade da Semana</h3>
                    <button onClick={replicateFixedSlots} disabled={isLoading} className="flex items-center gap-2 text-[8px] font-black uppercase bg-white/10 px-3 py-2 rounded-xl active:scale-95 disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCcw className="w-3 h-3"/>} Atualizar Agenda
                    </button>
                </div>
                <div className="relative z-10 space-y-3">
                    {slots.filter(s => s.date >= new Date().toISOString().split('T')[0]).slice(0, 15).map(slot => (
                        <div key={slot.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-grass-500">{slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${slot.matchType === 'FIXO' ? 'bg-orange-500/20 text-orange-400' : 'bg-grass-500/20 text-grass-400'}`}>{slot.matchType}</span>
                                </div>
                                <div className="text-xs font-black mt-1 flex items-center gap-1.5">
                                    {slot.hasLocalTeam ? (
                                      <>
                                        <span className="text-white">{slot.localTeamName}</span>
                                        <Swords className="w-3 h-3 text-white/40" />
                                        <span className={slot.opponentTeamName ? "text-white" : "text-white/30 italic"}>{slot.opponentTeamName || '?'}</span>
                                      </>
                                    ) : (
                                      <span className={slot.bookedByTeamName ? "text-white" : "text-white/30 italic"}>
                                        {slot.bookedByTeamName || 'Horário Disponível'}
                                      </span>
                                    )}
                                </div>
                                {slot.bookedByCategory && (
                                  <span className="text-[8px] font-bold text-white/40 uppercase mt-0.5 tracking-tighter">Categoria: {slot.bookedByCategory}</span>
                                )}
                            </div>
                            <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                    {slots.length === 0 && (
                      <div className="py-10 text-center text-white/20 font-black uppercase text-[10px] tracking-widest italic">Nenhum horário publicado</div>
                    )}
                </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
             <button onClick={() => setShowAddTeamModal(true)} className="w-full py-6 bg-white border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black text-xs uppercase flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform hover:border-pitch hover:text-pitch">
                <Plus className="w-6 h-6" /> Novo Mensalista
             </button>

             <div className="grid grid-cols-1 gap-4">
                {registeredTeams.map(team => (
                    <div key={team.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-pitch text-grass-500 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg group-hover:scale-110 transition-transform">
                                {team.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-black text-pitch">{team.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                      {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][team.fixedDay]} às {team.fixedTime}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Tag className="w-3 h-3 text-grass-600" />
                                  <span className="text-[8px] font-black text-grass-600 uppercase border border-grass-100 bg-grass-50 px-1.5 py-0.5 rounded">{team.categories[0]}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => { if(confirm('Remover este mensalista?')) api.deleteRegisteredTeam(team.id).then(loadRegisteredTeams) }} className="p-3 text-gray-200 hover:text-red-500 transition-colors">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                ))}
                {registeredTeams.length === 0 && (
                  <div className="py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest italic">Nenhum mensalista cadastrado</div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* MODAL: NOVO TIME FIXO */}
      {showAddTeamModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-pitch uppercase tracking-tighter italic">Novo Mensalista</h2>
                  <button onClick={() => setShowAddTeamModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-2xl border border-red-100 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border focus-within:border-grass-500 transition-colors">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                        <input className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Galáticos FC" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Dia da Semana</label>
                            <select className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamDay} onChange={e => setNewTeamDay(parseInt(e.target.value))}>
                                {['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                            </select>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hora do Jogo</label>
                            <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamTime} onChange={e => setNewTeamTime(e.target.value)} />
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Categoria Principal</label>
                        <select className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamCat} onChange={e => setNewTeamCat(e.target.value)}>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <Button onClick={handleAddFixedTeam} isLoading={isLoading} className="w-full py-5 rounded-2xl font-black uppercase text-xs tracking-widest mt-4">Salvar Mensalista</Button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: NOVO SLOT AVULSO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black text-pitch uppercase tracking-tighter italic">Novo Horário</h2>
                  <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Data</label>
                            <input type="date" className="w-full bg-transparent font-black outline-none text-pitch" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                            <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={slotTime} onChange={e => setSlotTime(e.target.value)} />
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">Tipo de Reserva</label>
                        <div className="flex gap-2">
                            <button onClick={() => setSlotType('ALUGUEL')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${slotType === 'ALUGUEL' ? 'bg-pitch text-white border-pitch' : 'border-gray-100 text-gray-300'}`}>Aluguel Livre</button>
                            <button onClick={() => setSlotType('FIXO')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${slotType === 'FIXO' ? 'bg-pitch text-white border-pitch' : 'border-gray-100 text-gray-300'}`}>Mensalista</button>
                        </div>
                    </div>
                    {slotType === 'FIXO' && (
                        <div className="bg-gray-50 p-4 rounded-2xl border animate-in zoom-in-95">
                            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Selecionar Mensalista</label>
                            <select className="w-full bg-transparent font-black outline-none text-pitch" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                                <option value="">Escolha o Time Fixo</option>
                                {registeredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <Button onClick={handleSaveSlot} isLoading={isLoading} className="w-full py-5 rounded-2xl font-black uppercase text-xs tracking-widest mt-4">Publicar na Agenda</Button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: VER COMPROVANTE */}
      {viewingSlot && (
          <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
             <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-black text-pitch uppercase tracking-tighter">Validar Comprovante</h3>
                    <button onClick={() => setViewingSlot(null)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>
                <div className="bg-gray-50 rounded-[2rem] border overflow-hidden mb-6">
                    <img src={viewingSlot.receiptUrl} className="w-full h-64 object-contain" />
                    <div className="p-4 bg-white border-t">
                        <div className="flex items-center gap-2 text-grass-600 mb-2">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[9px] font-black uppercase">Análise da IA</span>
                        </div>
                        <p className="text-xs font-bold text-gray-500">{JSON.parse(viewingSlot.aiVerificationResult || '{}').reason || 'Sem análise disponível'}</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => onRejectBooking(viewingSlot.id)} className="flex-1 py-4 font-black text-red-500 uppercase text-[10px] tracking-widest">Recusar</button>
                    <Button className="flex-[2] py-4 rounded-2xl font-black shadow-lg" onClick={() => { onConfirmBooking(viewingSlot.id); setViewingSlot(null); }}>APROVAR PIX</Button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
