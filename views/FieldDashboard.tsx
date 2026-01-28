
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, Sparkles, X, ChevronRight, Swords, Building2, MapPin } from 'lucide-react';
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
  categories, field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS'>('AGENDA');
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDay, setNewTeamDay] = useState(1);
  const [newTeamTime, setNewTeamTime] = useState('19:00');
  const [newTeamCat, setNewTeamCat] = useState('Principal');

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
        alert(`${newSlots.length} horários gerados com sucesso para os próximos meses!`);
      } else {
        alert("Todos os horários já estão na agenda.");
      }
    } catch (e) {
      alert("Erro ao gerar agenda.");
    } finally {
      setIsLoading(false);
      onRefreshData();
    }
  };

  const handleAddFixedTeam = async () => {
    if (!newTeamName) return;
    setIsLoading(true);
    try {
      await api.addRegisteredTeam({
        fieldId: field.id,
        name: newTeamName,
        fixedDay: newTeamDay,
        fixedTime: newTeamTime,
        categories: [newTeamCat]
      });
      setNewTeamName('');
      setShowAddTeamModal(false);
      loadRegisteredTeams();
    } finally { setIsLoading(false); }
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
          <button onClick={handleGenerate10Weeks} disabled={isLoading} className="bg-[#10b981] text-[#022c22] px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50">
             {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCcw className="w-4 h-4"/>} Gerar 10 Semanas
          </button>
        </div>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          <button onClick={() => setActiveTab('AGENDA')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'AGENDA' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Agenda Ativa</button>
          <button onClick={() => setActiveTab('MENSALISTAS')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MENSALISTAS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Mensalistas</button>
        </div>
      </div>

      <div className="p-6 pb-32">
        {activeTab === 'AGENDA' ? (
          <div className="space-y-6">
            {pendingSlots.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <h3 className="text-[10px] font-black text-orange-900 uppercase tracking-widest">Validar Pagamentos ({pendingSlots.length})</h3>
                </div>
                <div className="space-y-2">
                  {pendingSlots.map(s => (
                    <div key={s.id} className="bg-white p-4 rounded-2xl border flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-pitch">{s.bookedByTeamName}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{s.date} • {s.time}</p>
                      </div>
                      <button onClick={() => onConfirmBooking(s.id)} className="bg-pitch text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Aprovar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {slots.filter(s => s.date >= new Date().toISOString().split('T')[0]).slice(0, 30).map(s => (
                <div key={s.id} className="bg-white p-5 rounded-[2rem] border shadow-sm flex items-center justify-between group hover:border-pitch transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border group-hover:bg-pitch group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black leading-none">{s.time}</span>
                      <span className="text-[7px] font-bold uppercase mt-1 opacity-40">{s.date.split('-')[2]}/{s.date.split('-')[1]}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${s.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-grass-100 text-grass-600'}`}>{s.matchType}</span>
                        {s.isBooked && <span className="bg-pitch text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Confirmado</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-black text-pitch text-sm">{s.localTeamName || s.bookedByTeamName || 'Disponível'}</span>
                        <Swords className="w-3 h-3 text-gray-300" />
                        <span className="font-black text-pitch text-sm opacity-40">{s.opponentTeamName || 'Aguardando...'}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onDeleteSlot(s.id)} className="p-3 text-gray-200 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
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

      {showAddTeamModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-pitch">Novo Mensalista</h2>
               <button onClick={() => setShowAddTeamModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                  <input className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Galáticos FC" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Dia da Semana</label>
                    <select className="w-full bg-transparent font-black outline-none text-pitch" value={newTeamDay} onChange={e => setNewTeamDay(Number(e.target.value))}>
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
                <Button onClick={handleAddFixedTeam} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest mt-4">Salvar Mensalista</Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
