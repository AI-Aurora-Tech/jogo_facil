
import React, { useState } from 'react';
import { Plus, Calendar, Settings, Trash2, Shield, MapPin, Key, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, CircleSlash, Swords, PartyPopper, Star } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User } from '../types';

interface FieldDashboardProps {
  categories: string[];
  field: Field;
  slots: MatchSlot[];
  currentUser: User;
  onAddSlot: (slots: Omit<MatchSlot, 'id'>[]) => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
  onRateTeam: (userId: string, slotId: string, rating: number) => void;
}

const DAYS_OF_WEEK = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  categories, field, slots, currentUser, onAddSlot, onDeleteSlot, onConfirmBooking, onRejectBooking, onUpdateField, onRateTeam
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // States for new slot
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('19:00');
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || "Principal");
  const [price, setPrice] = useState(field.hourlyRate.toString());
  const [hostType, setHostType] = useState<'NONE' | 'OWNER'>('NONE');
  const [selectedHostCategory, setSelectedHostCategory] = useState<string>('');
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  // Settings states
  const [editName, setEditName] = useState(field.name);
  const [editLoc, setEditLoc] = useState(field.location);
  const [editRate, setEditRate] = useState(field.hourlyRate.toString());
  const [editPixKey, setEditPixKey] = useState(field.pixConfig.key || '');
  const [editPixName, setEditPixName] = useState(field.pixConfig.name || '');

  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSlots = slots
    .filter(s => s.date >= todayStr)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleSaveSettings = async () => {
    const success = await onUpdateField(field.id, {
        name: editName,
        location: editLoc,
        hourlyRate: Number(editRate),
        pixConfig: { key: editPixKey, name: editPixName }
    });
    if (success) setShowSettingsModal(false);
  };

  const getNextOccurrence = (dayOfWeek: number, weeksAhead: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + (dayOfWeek + 7 - d.getDay()) % 7 + (weeksAhead * 7));
    return d.toISOString().split('T')[0];
  };

  const handlePublishSlots = () => {
    if (selectedDay === null || !newTime) return alert("Selecione o dia e a hora");

    const newSlots: Omit<MatchSlot, 'id'>[] = [];
    
    for (let i = 0; i < repeatWeeks; i++) {
      newSlots.push({
        fieldId: field.id,
        date: getNextOccurrence(selectedDay, i),
        time: newTime,
        price: Number(price) || field.hourlyRate,
        matchType,
        durationMinutes: 60,
        isBooked: false,
        hasLocalTeam: hostType === 'OWNER',
        localTeamName: hostType === 'OWNER' ? currentUser.teamName : undefined,
        allowedCategories: [hostType === 'OWNER' ? selectedHostCategory : selectedCategory],
        status: 'available'
      });
    }

    onAddSlot(newSlots);
    setShowAddModal(false);
    // Reset fields
    setSelectedDay(null);
    setRepeatWeeks(1);
    setHostType('NONE');
    setMatchType('AMISTOSO');
  };

  const StarRating = ({ rating, onRate, readonly = false }: { rating: number, onRate?: (r: number) => void, readonly?: boolean }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star} 
            onClick={() => !readonly && onRate?.(star)}
            className={`w-5 h-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} ${!readonly ? 'cursor-pointer hover:scale-110 active:scale-90' : ''} transition-all`} 
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full pb-20">
      <div className="p-5 bg-white border-b sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black text-pitch">Minha Arena</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-tighter">{field.name}</p>
        </div>
        <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-transform"><Settings className="w-5 h-5" /></button>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-pitch text-white rounded-[2rem] p-6 shadow-xl flex justify-between items-center">
            <div>
                <p className="text-grass-400 text-[10px] font-black uppercase tracking-widest mb-1">Agenda de Jogos</p>
                <h2 className="text-3xl font-black">{sortedSlots.length} {sortedSlots.length === 1 ? 'Horário' : 'Horários'}</h2>
            </div>
            <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-grass-500 rounded-2xl flex items-center justify-center text-pitch shadow-lg active:scale-90 transition-transform">
                <Plus className="w-8 h-8" />
            </button>
        </div>

        <div className="space-y-4">
            {sortedSlots.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-bold text-xs uppercase">Nenhum horário criado</p>
              </div>
            )}
            {sortedSlots.map(slot => (
                <div key={slot.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-50 w-12 h-12 rounded-2xl flex flex-col items-center justify-center border">
                                <span className="text-lg font-black text-pitch">{slot.date.split('-')[2]}</span>
                                <span className="text-[8px] font-black text-gray-400 uppercase">{slot.time}</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-pitch text-sm">{slot.allowedCategories[0]}</h4>
                                <div className="flex gap-1 mt-1">
                                  <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-black uppercase">{slot.matchType}</span>
                                  <span className="text-[8px] bg-grass-50 text-grass-700 px-1.5 py-0.5 rounded-md font-black uppercase">R$ {slot.price}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-gray-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {slot.status === 'available' ? (
                        <div className="text-[9px] text-gray-400 font-black uppercase flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${slot.hasLocalTeam ? 'bg-orange-500' : 'bg-grass-500'}`}></div>
                             {slot.hasLocalTeam ? `Aguardando Adversário (${slot.localTeamName})` : 'Campo Livre'}
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-4 border border-gray-100">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-pitch text-white rounded-full flex items-center justify-center font-black text-[10px]">
                                        {slot.bookedByTeamName?.charAt(0)}
                                    </div>
                                    <p className="text-xs font-black text-pitch">{slot.bookedByTeamName}</p>
                                </div>
                                {slot.status === 'pending_verification' && (
                                    <div className="flex gap-1">
                                        <button onClick={() => onConfirmBooking(slot.id)} className="p-2.5 bg-grass-500 text-pitch rounded-xl shadow-md active:scale-90 transition-transform"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => onRejectBooking(slot.id)} className="p-2.5 bg-red-100 text-red-600 rounded-xl active:scale-90 transition-transform"><X className="w-4 h-4" /></button>
                                    </div>
                                )}
                                {slot.status === 'confirmed' && (
                                    <span className="text-[9px] font-black uppercase bg-grass-100 text-grass-700 px-2 py-1 rounded-md">Confirmado</span>
                                )}
                            </div>
                            
                            {slot.status === 'confirmed' && slot.bookedByUserId && (
                                <div className="pt-2 border-t border-gray-200/50 flex flex-col gap-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Avaliar comportamento do time:</p>
                                    <StarRating 
                                        rating={slot.ratingGiven || 0} 
                                        readonly={!!slot.ratingGiven}
                                        onRate={(r) => onRateTeam(slot.bookedByUserId!, slot.id, r)} 
                                    />
                                    {slot.ratingGiven ? (
                                        <p className="text-[8px] font-bold text-grass-600 uppercase">Avaliação enviada!</p>
                                    ) : (
                                        <p className="text-[8px] font-bold text-gray-300 uppercase italic">Toque nas estrelas para avaliar</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[150] flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 overflow-y-auto max-h-[85vh]">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-pitch">Ajustes da Arena</h2>
                    <button onClick={() => setShowSettingsModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>
                <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Nome Comercial</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent font-bold outline-none text-lg text-pitch" />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Endereço Público</label>
                        <input type="text" value={editLoc} onChange={e => setEditLoc(e.target.value)} className="w-full bg-transparent font-bold outline-none text-pitch" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Preço Padrão (R$)</label>
                            <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-full bg-transparent font-bold outline-none text-pitch" />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Chave PIX</label>
                            <input type="text" value={editPixKey} onChange={e => setEditPixKey(e.target.value)} placeholder="Celular, CPF ou E-mail" className="w-full bg-transparent font-bold outline-none text-pitch" />
                        </div>
                    </div>
                    <Button className="w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest" onClick={handleSaveSettings}>Atualizar Arena</Button>
                </div>
            </div>
        </div>
      )}

      {showAddModal && (
          <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[150] flex items-end">
            <div className="bg-white w-full rounded-t-[3.5rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
                <h2 className="text-3xl font-black text-pitch mb-8 flex items-center gap-3">
                  <CalendarDays className="w-8 h-8 text-grass-500" /> Novo Horário
                </h2>
                
                <div className="space-y-8">
                    {/* Seleção de Dia da Semana */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Qual dia da semana?</label>
                        <div className="grid grid-cols-7 gap-1.5">
                            {DAYS_OF_WEEK.map((day) => (
                                <button 
                                  key={day.value}
                                  onClick={() => setSelectedDay(day.value)}
                                  className={`py-3 rounded-xl text-[10px] font-black transition-all border ${selectedDay === day.value ? 'bg-pitch border-pitch text-white scale-110' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Horário de Início</label>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-300" />
                              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="bg-transparent font-black outline-none text-pitch w-full" />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Valor Deste Horário (R$)</label>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-transparent font-black outline-none text-pitch w-full" />
                        </div>
                    </div>

                    {/* SELEÇÃO DE TIPO DE JOGO */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Tipo de Jogo</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setMatchType('AMISTOSO')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${matchType === 'AMISTOSO' ? 'bg-pitch border-pitch text-white' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                <Swords className={`w-6 h-6 ${matchType === 'AMISTOSO' ? 'text-grass-500' : 'text-gray-300'}`} />
                                <span className="font-black text-[11px] uppercase">Amistoso</span>
                            </button>
                            <button 
                                onClick={() => setMatchType('FESTIVAL')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${matchType === 'FESTIVAL' ? 'bg-pitch border-pitch text-white' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                <PartyPopper className={`w-6 h-6 ${matchType === 'FESTIVAL' ? 'text-grass-500' : 'text-gray-300'}`} />
                                <span className="font-black text-[11px] uppercase">Festival</span>
                            </button>
                        </div>
                    </div>

                    {/* SELEÇÃO DE MANDANTE */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Quem é o Mandante?</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button 
                                onClick={() => { setHostType('NONE'); setSelectedHostCategory(''); }}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${hostType === 'NONE' ? 'bg-pitch border-pitch text-white' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                <CircleSlash className={`w-6 h-6 ${hostType === 'NONE' ? 'text-grass-500' : 'text-gray-300'}`} />
                                <div className="text-left">
                                    <p className="font-black text-sm">Campo Aberto</p>
                                    <p className="text-[9px] font-bold uppercase opacity-60 text-grass-500">Qualquer time pode agendar</p>
                                </div>
                            </button>

                            {currentUser.teamName && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase pl-1">Meu Time: {currentUser.teamName}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {currentUser.teamCategories.map(cat => (
                                            <button 
                                                key={cat}
                                                onClick={() => { setHostType('OWNER'); setSelectedHostCategory(cat); }}
                                                className={`flex-1 min-w-[120px] p-3 rounded-xl border transition-all text-center ${hostType === 'OWNER' && selectedHostCategory === cat ? 'bg-grass-500 border-grass-500 text-pitch scale-105 shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                                            >
                                                <p className="font-black text-[11px]">{cat}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {hostType === 'NONE' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Categoria de Preferência</label>
                            <select 
                                value={selectedCategory} 
                                onChange={e => setSelectedCategory(e.target.value)} 
                                className="w-full p-4 bg-gray-50 rounded-2xl font-black border border-gray-100 appearance-none text-pitch text-sm"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Recorrência (Mensalistas?)</label>
                        <select 
                          value={repeatWeeks} 
                          onChange={e => setRepeatWeeks(Number(e.target.value))} 
                          className="w-full p-4 bg-gray-50 rounded-2xl font-black border border-gray-100 appearance-none text-pitch text-sm"
                        >
                            <option value={1}>Horário Único (Apenas esta semana)</option>
                            <option value={4}>Repetir por 4 Semanas (Mensalista)</option>
                            <option value={8}>Repetir por 8 Semanas</option>
                            <option value={12}>Repetir por 12 Semanas</option>
                        </select>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-gray-400 uppercase text-xs tracking-widest">Cancelar</button>
                        <Button className="flex-[2] py-5 rounded-[2rem] text-sm font-black shadow-xl uppercase tracking-widest" onClick={handlePublishSlots}>
                          Publicar Agenda
                        </Button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
