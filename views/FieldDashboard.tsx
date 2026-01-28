
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, Sparkles, X, ChevronRight, Swords, Edit3, Save, Tag, User as UserIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, RegisteredTeam } from '../types';
import { api } from '../api';
import { formatCategory } from '../utils';

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
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS'>('AGENDA');
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
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate || 0);
  const [isLocalTeamChecked, setIsLocalTeamChecked] = useState(false);
  const [selectedLocalCategory, setSelectedLocalCategory] = useState(currentUser.teamCategories[0] || '');

  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);

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
        alert(`${newSlots.length} horários gerados para os mensalistas!`);
      } else {
        alert("A agenda já está atualizada.");
      }
    } catch (e) {
      alert("Erro ao gerar agenda.");
    } finally {
      setIsLoading(false);
      onRefreshData();
    }
  };

  const handleCreateSingleSlot = async () => {
    if (isLocalTeamChecked && !selectedLocalCategory) {
      alert("Selecione a categoria do time local.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Omit<MatchSlot, 'id'> = {
        fieldId: field.id,
        date: newSlotDate,
        time: newSlotTime,
        durationMinutes: 60,
        matchType: 'ALUGUEL',
        isBooked: false,
        hasLocalTeam: isLocalTeamChecked,
        localTeamName: isLocalTeamChecked ? currentUser.teamName : undefined,
        bookedByTeamName: isLocalTeamChecked ? currentUser.teamName : undefined,
        bookedByCategory: isLocalTeamChecked ? selectedLocalCategory : undefined,
        bookedByUserId: isLocalTeamChecked ? currentUser.id : undefined,
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

  const handleUpdateSlot = async () => {
    if (!editingSlot) return;
    setIsLoading(true);
    try {
      await api.updateSlot(editingSlot.id, {
        time: editingSlot.time,
        date: editingSlot.date,
        price: editingSlot.price,
        hasLocalTeam: editingSlot.hasLocalTeam,
        localTeamName: editingSlot.localTeamName,
        bookedByTeamName: editingSlot.hasLocalTeam ? editingSlot.localTeamName : editingSlot.bookedByTeamName,
        bookedByCategory: editingSlot.bookedByCategory
      });
      setEditingSlot(null);
      onRefreshData();
    } catch (e) {
      alert("Erro ao salvar alterações.");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingSlots = slots.filter(s => s.status === 'pending_verification');

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
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCcw className="w-4 h-4"/>} Agenda
            </button>
          </div>
        </div>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Agenda</button>
          <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Mensalistas</button>
        </div>
      </div>

      <div className="p-6 pb-32">
        {activeTab === 'AGENDA' ? (
          <div className="space-y-4">
            {pendingSlots.map(s => (
              <div key={s.id} className="bg-orange-50 p-4 rounded-3xl border-2 border-orange-100 flex items-center justify-between animate-pulse">
                <div>
                  <p className="text-[10px] font-black text-orange-800 uppercase">Validar Pagamento</p>
                  <p className="text-xs font-black text-pitch">{s.bookedByTeamName} vs {s.opponentTeamName || '?'}</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => onRejectBooking(s.id)} className="p-2 text-red-500"><X className="w-5 h-5"/></button>
                   <button onClick={() => onConfirmBooking(s.id)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Aprovar</button>
                </div>
              </div>
            ))}

            <div className="grid gap-3">
              {slots.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                  <Calendar className="w-12 h-12 text-gray-200" />
                  <p className="text-gray-400 font-bold uppercase text-xs">Nenhum horário cadastrado</p>
                  <Button size="sm" onClick={() => setShowAddSlotModal(true)}>Criar Primeiro Horário</Button>
                </div>
              )}
              {slots.filter(s => s.date >= new Date().toISOString().split('T')[0]).slice(0, 40).map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border group-hover:bg-pitch group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black">{s.time}</span>
                      <span className="text-[7px] font-bold uppercase opacity-40">{s.date.split('-').reverse().slice(0,2).join('/')}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-grass-100 text-grass-600'}`}>{s.matchType}</span>
                        {s.isBooked && <span className="bg-pitch text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Confirmado</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-black text-pitch text-sm">{s.localTeamName || s.bookedByTeamName || 'Vaga de Jogo'}</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">({s.bookedByCategory || 'Aberto'})</span>
                        <Swords className="w-3 h-3 text-gray-300" />
                        <span className="font-black text-pitch text-sm opacity-40">{s.opponentTeamName || 'Aguardando...'}</span>
                        {s.opponentTeamCategory && <span className="text-[8px] font-bold text-gray-300 uppercase">({s.opponentTeamCategory})</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingSlot(s)} className="p-2 text-gray-300 hover:text-pitch"><Edit3 className="w-4 h-4"/></button>
                    <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <button onClick={() => setShowAddTeamModal(true)} className="w-full py-10 bg-white border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-gray-400 font-black uppercase text-xs hover:border-pitch hover:text-pitch transition-all active:scale-95">
               <Plus className="w-8 h-8" /> Novo Mensalista
             </button>
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pitch rounded-2xl flex items-center justify-center text-2xl font-black text-grass-500">{t.name.charAt(0)}</div>
                    <div>
                      <h4 className="font-black text-pitch text-lg leading-tight">{t.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][t.fixedDay]} às {t.fixedTime}</span>
                      </div>
                    </div>
                 </div>
                 <button onClick={() => api.deleteRegisteredTeam(t.id).then(loadRegisteredTeams)} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
               </div>
             ))}
          </div>
        )}
      </div>

      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-pitch">Criar Horário Avulso</h2>
               <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Data</label>
                    <input type="date" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                    <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Preço Sugerido (R$)</label>
                  <input type="number" className="w-full bg-transparent font-black outline-none text-pitch" value={newSlotPrice} onChange={e => setNewSlotPrice(Number(e.target.value))} />
                </div>
                
                <div className="bg-gray-50 p-6 rounded-3xl border flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Time da Casa?</label>
                    <input type="checkbox" className="w-5 h-5 accent-pitch" checked={isLocalTeamChecked} onChange={e => setIsLocalTeamChecked(e.target.checked)} />
                  </div>
                  {isLocalTeamChecked && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                       <p className="text-[10px] font-black text-pitch uppercase italic">Mandante: {currentUser.teamName}</p>
                       <label className="text-[8px] font-black text-gray-400 uppercase block">Escolha a Categoria</label>
                       <div className="flex flex-wrap gap-2">
                         {currentUser.teamCategories.map(cat => (
                           <button key={cat} onClick={() => setSelectedLocalCategory(cat)} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${selectedLocalCategory === cat ? 'bg-pitch text-white shadow-md' : 'bg-white text-gray-400 border'}`}>
                              {cat}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleCreateSingleSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest mt-4">Criar Horário</Button>
             </div>
           </div>
        </div>
      )}

      {editingSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-pitch">Editar Horário</h2>
               <button onClick={() => setEditingSlot(null)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Data</label>
                    <input type="date" className="w-full bg-transparent font-black outline-none text-pitch" value={editingSlot.date} onChange={e => setEditingSlot({...editingSlot, date: e.target.value})} />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                    <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={editingSlot.time} onChange={e => setEditingSlot({...editingSlot, time: e.target.value})} />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Preço (R$)</label>
                  <input type="number" className="w-full bg-transparent font-black outline-none text-pitch" value={editingSlot.price} onChange={e => setEditingSlot({...editingSlot, price: Number(e.target.value)})} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Time Local</label>
                      <p className="font-black text-pitch text-sm">{editingSlot.localTeamName || 'Nenhum'}</p>
                    </div>
                    <button 
                      onClick={() => setEditingSlot({...editingSlot, hasLocalTeam: !editingSlot.hasLocalTeam, localTeamName: editingSlot.hasLocalTeam ? '' : currentUser.teamName, bookedByTeamName: editingSlot.hasLocalTeam ? '' : currentUser.teamName})} 
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${editingSlot.hasLocalTeam ? 'bg-red-50 text-red-600' : 'bg-grass-50 text-grass-600'}`}
                    >
                      {editingSlot.hasLocalTeam ? 'Remover' : 'Adicionar'}
                    </button>
                  </div>
                  {editingSlot.hasLocalTeam && (
                    <div className="space-y-2">
                       <label className="text-[8px] font-black text-gray-400 uppercase block">Categoria Local</label>
                       <div className="flex flex-wrap gap-2">
                         {currentUser.teamCategories.map(cat => (
                           <button key={cat} onClick={() => setEditingSlot({...editingSlot, bookedByCategory: cat})} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${editingSlot.bookedByCategory === cat ? 'bg-pitch text-white' : 'bg-white text-gray-400 border'}`}>
                              {cat}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
                <Button onClick={handleUpdateSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest mt-4">
                  <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
