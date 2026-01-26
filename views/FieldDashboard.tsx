
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, MapPin, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, Swords, Star, UsersRound, ChevronRight, AlertCircle, Tag, Upload, Edit2, Loader2, Sparkles, CheckCircle2, Eye, FileText, Calendar } from 'lucide-react';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [viewingSlot, setViewingSlot] = useState<MatchSlot | null>(null);

  // Estados para Novo Horário
  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState('19:00');
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate.toString());
  const [newSlotType, setNewSlotType] = useState<MatchType>('ALUGUEL');
  const [newSlotLocalTeam, setNewSlotLocalTeam] = useState('');
  const [newSlotCats, setNewSlotCats] = useState<string[]>(['Livre']);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);

  useEffect(() => {
    if (showTeamsModal) {
      api.getRegisteredTeams(field.id).then(setRegisteredTeams);
    }
  }, [showTeamsModal, field.id]);

  const handleCreateSlot = async () => {
    const slot: Omit<MatchSlot, 'id'> = {
      fieldId: field.id,
      date: newSlotDate,
      time: newSlotTime,
      durationMinutes: 60,
      matchType: newSlotType,
      isBooked: false,
      hasLocalTeam: newSlotType === 'FIXO',
      localTeamName: newSlotType === 'FIXO' ? newSlotLocalTeam : undefined,
      allowedCategories: newSlotCats,
      status: 'available',
      price: parseFloat(newSlotPrice)
    };
    await onAddSlot([slot]);
    setShowAddModal(false);
  };

  const pendingSlots = (slots || []).filter(s => s.status === 'pending_verification' && s.receiptUrl);
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSlots = (slots || [])
    .filter(s => s.date >= todayStr)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="p-6 bg-white border-b sticky top-0 z-20 flex justify-between items-center glass">
        <div>
            <h1 className="text-2xl font-black text-pitch tracking-tight">Gestão Arena</h1>
            <p className="text-[10px] font-black text-grass-600 uppercase tracking-[0.2em]">{field?.name}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowTeamsModal(true)} className="p-3 bg-gray-100 rounded-2xl text-pitch active:scale-95 transition-transform">
              <UsersRound className="w-5 h-5" />
            </button>
            <button onClick={() => setShowAddModal(true)} className="p-3 bg-pitch rounded-2xl text-white active:scale-95 transition-transform">
              <Plus className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Task Center */}
        {pendingSlots.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-6 animate-in slide-in-from-left duration-500">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-black text-orange-900 uppercase tracking-widest">Aguardando Aprovação ({pendingSlots.length})</h3>
            </div>
            <div className="space-y-3">
                {pendingSlots.map(slot => (
                    <div key={slot.id} className="bg-white p-4 rounded-3xl border border-orange-200 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 shrink-0">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-pitch truncate">{slot.bookedByTeamName || slot.opponentTeamName}</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{slot.time} • R$ {slot.price}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setViewingSlot(slot)} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-pitch"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => onConfirmBooking(slot.id)} className="p-2.5 bg-orange-500 text-white rounded-xl shadow-lg active:scale-90 transition-transform"><Check className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center">
                <div className="bg-grass-50 p-4 rounded-2xl text-grass-600 mb-2">
                    <Trophy className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ocupação</span>
                <span className="text-2xl font-black text-pitch">
                    {slots.length > 0 ? ((slots.filter(s => s.status === 'confirmed').length / slots.length) * 100).toFixed(0) : 0}%
                </span>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center">
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-2">
                    <Star className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avaliação</span>
                <span className="text-2xl font-black text-pitch">4.9</span>
            </div>
        </div>

        <div className="bg-pitch rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-grass-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <h3 className="text-3xl font-black mb-1">Grade Ativa</h3>
                    <p className="text-[10px] font-black text-grass-500 uppercase tracking-[0.3em]">Gerenciar Próximos Jogos</p>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-black text-gray-400 uppercase">Hoje</span>
                    <span className="text-3xl font-black">{sortedSlots.filter(s => s.date === todayStr).length}</span>
                </div>
            </div>
            
            <div className="mt-8 space-y-4">
                {sortedSlots.slice(0, 5).map(slot => (
                    <div key={slot.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <span className="block text-[10px] font-black text-grass-500 uppercase">{slot.time}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div>
                                <p className="text-sm font-black truncate max-w-[120px]">{slot.isBooked ? slot.bookedByTeamName : slot.opponentTeamName ? `${slot.localTeamName} vs ${slot.opponentTeamName}` : 'Livre'}</p>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${slot.status === 'confirmed' ? 'bg-grass-500 text-pitch' : 'bg-white/10 text-gray-400'}`}>
                                    {slot.status === 'confirmed' ? 'Confirmado' : 'Disponível'}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* MODAL: Adicionar Novo Horário */}
      {showAddModal && (
        <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[100] flex items-end animate-in fade-in duration-300">
          <div className="bg-white w-full rounded-t-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-pitch">Abrir Horário</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Data</label>
                  <input type="date" className="w-full p-4 bg-gray-50 border rounded-2xl font-bold outline-none" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                  <input type="time" className="w-full p-4 bg-gray-50 border rounded-2xl font-bold outline-none" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo de Match</label>
                <div className="flex gap-2">
                  {(['ALUGUEL', 'FIXO'] as MatchType[]).map(t => (
                    <button key={t} onClick={() => setNewSlotType(t)} className={`flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all ${newSlotType === t ? 'border-grass-500 bg-grass-50 text-grass-700' : 'border-gray-100 text-gray-400'}`}>
                      {t === 'ALUGUEL' ? 'Aluguel Avulso' : 'Mensalista / Fixo'}
                    </button>
                  ))}
                </div>
              </div>

              {newSlotType === 'FIXO' && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Time da Casa (Mensalista)</label>
                  <input type="text" className="w-full p-4 bg-gray-50 border rounded-2xl font-bold outline-none" placeholder="Ex: Galáticos FC" value={newSlotLocalTeam} onChange={e => setNewSlotLocalTeam(e.target.value)} />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Valor (Total)</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 font-black text-gray-400 text-sm">R$</span>
                  <input type="number" className="w-full pl-12 p-4 bg-gray-50 border rounded-2xl font-bold outline-none" value={newSlotPrice} onChange={e => setNewSlotPrice(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleCreateSlot} className="w-full py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-grass-500/20">CRIAR HORÁRIO</Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Gestão de Mensalistas */}
      {showTeamsModal && (
        <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[100] flex items-end animate-in fade-in duration-300">
          <div className="bg-white w-full rounded-t-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[85vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-pitch">Mensalistas</h2>
              <button onClick={() => setShowTeamsModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-4">
              {registeredTeams.length === 0 ? (
                <div className="text-center py-10 text-gray-400">Nenhum mensalista cadastrado.</div>
              ) : (
                registeredTeams.map(team => (
                  <div key={team.id} className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pitch rounded-lg flex items-center justify-center text-white font-black">{team.name.charAt(0)}</div>
                      <div>
                        <p className="font-black text-pitch text-sm">{team.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Dia {team.fixedDay} às {team.fixedTime}</p>
                      </div>
                    </div>
                    <button className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full border-dashed rounded-2xl py-4 mt-4">CADASTRAR NOVO MENSALISTA</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualização Comprovante */}
      {viewingSlot && (
          <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
             <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-pitch">Análise de Pagamento</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Validação IA Inteligente</p>
                    </div>
                    <button onClick={() => setViewingSlot(null)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>

                <div className="bg-gray-50 rounded-[2rem] border overflow-hidden mb-8">
                    <img src={viewingSlot.receiptUrl} className="w-full h-48 object-contain bg-white" alt="Comprovante" />
                    <div className="p-6">
                        {viewingSlot.aiVerificationResult && (
                            <div className="bg-white p-5 rounded-2xl border mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-grass-600" />
                                    <span className="text-[10px] font-black text-grass-600 uppercase tracking-widest">Resultado Gemini AI</span>
                                </div>
                                <p className="text-xs font-bold text-pitch italic">
                                    {JSON.parse(viewingSlot.aiVerificationResult).reason}
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Valor Esperado:</span>
                            <span className="text-lg font-black text-pitch">R$ {viewingSlot.price}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => onRejectBooking(viewingSlot.id)} className="flex-1 py-4 font-black text-red-500 uppercase text-[10px] tracking-widest hover:bg-red-50 rounded-2xl transition-colors">Invalidar</button>
                    <Button className="flex-[2] py-4 rounded-2xl font-black" onClick={() => {
                        onConfirmBooking(viewingSlot.id);
                        setViewingSlot(null);
                    }}>APROVAR RESERVA</Button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
