
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, MapPin, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, Swords, Star, UsersRound, ChevronRight, AlertCircle, Tag, Upload, Edit2, Loader2, Sparkles, CheckCircle2, Eye, FileText, Calendar, Info } from 'lucide-react';
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
  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [viewingSlot, setViewingSlot] = useState<MatchSlot | null>(null);
  const [isEditingArena, setIsEditingArena] = useState(false);

  // Estados para Novo/Editando Horário
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate.toString());
  const [slotType, setSlotType] = useState<MatchType>('ALUGUEL');
  const [slotLocalTeam, setSlotLocalTeam] = useState('');
  const [slotCats, setSlotCats] = useState<string[]>(['Livre']);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);

  // Estados para Arena
  const [arenaName, setArenaName] = useState(field.name);
  const [arenaLocation, setArenaLocation] = useState(field.location);

  useEffect(() => {
    if (showTeamsModal) {
      api.getRegisteredTeams(field.id).then(setRegisteredTeams);
    }
  }, [showTeamsModal, field.id]);

  const handleOpenAdd = () => {
    setEditingSlot(null);
    setSlotDate(new Date().toISOString().split('T')[0]);
    setSlotTime('19:00');
    setSlotPrice(field.hourlyRate.toString());
    setSlotType('ALUGUEL');
    setSlotLocalTeam('');
    setSlotCats(['Livre']);
    setShowAddModal(true);
  };

  const handleOpenEditSlot = (slot: MatchSlot) => {
    setEditingSlot(slot);
    setSlotDate(slot.date);
    setSlotTime(slot.time);
    setSlotPrice(slot.price.toString());
    setSlotType(slot.matchType);
    setSlotLocalTeam(slot.localTeamName || '');
    setSlotCats(slot.allowedCategories || ['Livre']);
    setShowAddModal(true);
  };

  const handleSaveSlot = async () => {
    const slotData: Partial<MatchSlot> = {
      date: slotDate,
      time: slotTime,
      matchType: slotType,
      hasLocalTeam: slotType === 'FIXO',
      localTeamName: slotType === 'FIXO' ? slotLocalTeam : undefined,
      allowedCategories: slotCats,
      price: parseFloat(slotPrice)
    };

    if (editingSlot) {
      await api.updateSlot(editingSlot.id, slotData);
    } else {
      await onAddSlot([{
        fieldId: field.id,
        durationMinutes: 60,
        status: 'available',
        isBooked: false,
        ...slotData
      } as Omit<MatchSlot, 'id'>]);
    }
    setShowAddModal(false);
    onRefreshData();
  };

  const handleSaveArena = async () => {
    await onUpdateField(field.id, { name: arenaName, location: arenaLocation });
    setIsEditingArena(false);
  };

  const pendingSlots = (slots || []).filter(s => s.status === 'pending_verification' && s.receiptUrl);
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSlots = (slots || [])
    .filter(s => s.date >= todayStr)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      <div className="p-6 bg-white border-b sticky top-0 z-20 flex justify-between items-center glass">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pitch rounded-2xl overflow-hidden shadow-inner">
                <img src={field.imageUrl} className="w-full h-full object-cover" />
            </div>
            <div>
                <h1 className="text-xl font-black text-pitch tracking-tight leading-none mb-1">{field.name}</h1>
                <button onClick={() => setIsEditingArena(true)} className="flex items-center gap-1 text-[9px] font-black text-grass-600 uppercase tracking-widest">
                    <Edit2 className="w-2.5 h-2.5" /> Editar Local
                </button>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowTeamsModal(true)} className="p-3 bg-gray-100 rounded-2xl text-pitch active:scale-95 transition-transform">
              <UsersRound className="w-5 h-5" />
            </button>
            <button onClick={handleOpenAdd} className="p-3 bg-pitch rounded-2xl text-white active:scale-95 transition-transform">
              <Plus className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Arena Quick Edit Modal */}
        {isEditingArena && (
            <div className="bg-white border p-6 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-pitch uppercase tracking-widest">Dados do Campo</h3>
                    <button onClick={() => setIsEditingArena(false)} className="text-gray-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nome da Arena</label>
                        <input value={arenaName} onChange={e => setArenaName(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Endereço</label>
                        <input value={arenaLocation} onChange={e => setArenaLocation(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                    </div>
                    <Button onClick={handleSaveArena} className="w-full py-4 rounded-2xl font-black uppercase text-xs">Salvar Alterações</Button>
                </div>
            </div>
        )}

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

        {/* Stats Grid */}
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
                <span className="text-2xl font-black text-pitch">{(currentUser.teamRating || 4.9).toFixed(1)}</span>
            </div>
        </div>

        {/* Active Grid List */}
        <div className="bg-pitch rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-grass-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <h3 className="text-3xl font-black mb-1 italic">GRADE ATIVA</h3>
                    <p className="text-[10px] font-black text-grass-500 uppercase tracking-[0.3em]">Gestão de Próximos Jogos</p>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-black text-gray-400 uppercase">Hoje</span>
                    <span className="text-3xl font-black">{sortedSlots.filter(s => s.date === todayStr).length}</span>
                </div>
            </div>
            
            <div className="mt-8 space-y-4">
                {sortedSlots.length === 0 ? (
                    <div className="py-10 text-center text-white/20 font-black uppercase text-xs tracking-widest border border-white/5 rounded-3xl">Nenhum horário criado</div>
                ) : (
                    sortedSlots.map(slot => (
                        <div key={slot.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="text-center shrink-0">
                                    <span className="block text-[10px] font-black text-grass-500 uppercase">{slot.time}</span>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                                </div>
                                <div className="w-px h-8 bg-white/10 shrink-0"></div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black truncate">{slot.isBooked ? slot.bookedByTeamName : slot.opponentTeamName ? `${slot.localTeamName} vs ${slot.opponentTeamName}` : 'Disponível'}</p>
                                    <div className="flex gap-2 items-center mt-1">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${slot.status === 'confirmed' ? 'bg-grass-500 text-pitch' : 'bg-white/10 text-gray-400'}`}>
                                            {slot.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                                        </span>
                                        <span className="text-[8px] font-black text-gray-500 uppercase">{slot.allowedCategories?.[0] || 'Livre'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenEditSlot(slot)} className="p-2 text-white hover:text-grass-500 transition-colors"><Edit2 className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-white hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* MODAL: Adicionar/Editar Horário */}
      {showAddModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end animate-in fade-in duration-300">
          <div className="bg-white w-full rounded-t-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-pitch">{editingSlot ? 'Editar Horário' : 'Novo Horário'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Data</label>
                  <input type="date" className="w-full bg-transparent font-bold outline-none" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                  <input type="time" className="w-full bg-transparent font-bold outline-none" value={slotTime} onChange={e => setSlotTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Tipo de Reserva</label>
                <div className="flex gap-2">
                  {(['ALUGUEL', 'FIXO'] as MatchType[]).map(t => (
                    <button key={t} onClick={() => setSlotType(t)} className={`flex-1 py-4 rounded-2xl font-black text-xs border-2 transition-all ${slotType === t ? 'border-grass-500 bg-grass-50 text-pitch' : 'border-gray-100 text-gray-300'}`}>
                      {t === 'ALUGUEL' ? 'Aluguel Avulso' : 'Mensalista / Desafio'}
                    </button>
                  ))}
                </div>
              </div>

              {slotType === 'FIXO' && (
                <div className="bg-orange-50 border border-orange-100 p-5 rounded-3xl animate-in zoom-in-95">
                  <label className="text-[10px] font-black text-orange-600 uppercase block mb-2">Time Mensalista (Casa)</label>
                  <input type="text" className="w-full p-4 bg-white border border-orange-200 rounded-2xl font-black outline-none placeholder:text-orange-200" placeholder="Nome do Time Fixo" value={slotLocalTeam} onChange={e => setSlotLocalTeam(e.target.value)} />
                  <p className="text-[9px] text-orange-400 font-bold mt-2 uppercase">Outros times poderão desafiar este mensalista.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Categoria Permitida</label>
                  <select className="w-full bg-transparent font-bold outline-none" value={slotCats[0]} onChange={e => setSlotCats([e.target.value])}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border">
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Preço Total (R$)</label>
                  <input type="number" className="w-full bg-transparent font-bold outline-none" value={slotPrice} onChange={e => setSlotPrice(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleSaveSlot} className="w-full py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-grass-500/20 uppercase tracking-widest">
                {editingSlot ? 'ATUALIZAR HORÁRIO' : 'PUBLICAR HORÁRIO'}
              </Button>
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
                        <h3 className="text-2xl font-black text-pitch">Validar Pix</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1 italic">Processado pela IA Jogo Fácil</p>
                    </div>
                    <button onClick={() => setViewingSlot(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X className="w-6 h-6"/></button>
                </div>

                <div className="bg-gray-50 rounded-[2rem] border overflow-hidden mb-8">
                    <img src={viewingSlot.receiptUrl} className="w-full h-64 object-contain bg-white" alt="Comprovante" />
                    <div className="p-6">
                        {viewingSlot.aiVerificationResult && (
                            <div className="bg-white p-5 rounded-2xl border mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-grass-600 animate-pulse" />
                                    <span className="text-[10px] font-black text-grass-600 uppercase tracking-widest">Análise do Sistema</span>
                                </div>
                                <p className="text-xs font-bold text-pitch leading-relaxed">
                                    {JSON.parse(viewingSlot.aiVerificationResult).reason}
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-between px-2">
                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Valor Recebido:</span>
                            <span className="text-2xl font-black text-pitch italic">R$ {viewingSlot.price}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => onRejectBooking(viewingSlot.id)} className="flex-1 py-4 font-black text-red-500 uppercase text-[10px] tracking-widest hover:bg-red-50 rounded-2xl transition-all">Recusar</button>
                    <Button className="flex-[2] py-4 rounded-2xl font-black shadow-lg" onClick={() => {
                        onConfirmBooking(viewingSlot.id);
                        setViewingSlot(null);
                    }}>APROVAR PAGAMENTO</Button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
