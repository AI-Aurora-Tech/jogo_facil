
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Settings, Trash2, Shield, MapPin, Key, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, CircleSlash, Swords, PartyPopper, Star, UsersRound, BookOpenCheck, ChevronRight, AlertCircle, Tag } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, RegisteredTeam } from '../types';
import { api } from '../services/api';

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
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showManualBookingModal, setShowManualBookingModal] = useState<MatchSlot | null>(null);
  
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDay, setNewTeamDay] = useState<number>(1);
  const [newTeamTime, setNewTeamTime] = useState('20:00');
  const [newTeamSelectedCategories, setNewTeamSelectedCategories] = useState<string[]>([]);
  const [teamError, setTeamError] = useState('');

  // States for new slot
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('19:00');
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || "Principal");
  const [price, setPrice] = useState(field.hourlyRate.toString());
  
  // Host selection states
  const [hostType, setHostType] = useState<'NONE' | 'OWNER' | 'REGISTERED'>('NONE');
  const [selectedHostTeamName, setSelectedHostTeamName] = useState<string>('');
  const [selectedHostCategory, setSelectedHostCategory] = useState<string>('');
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  // Settings states
  const [editName, setEditName] = useState(field.name);
  const [editLoc, setEditLoc] = useState(field.location);
  const [editRate, setEditRate] = useState(field.hourlyRate.toString());
  const [editPixKey, setEditPixKey] = useState(field.pixConfig.key || '');
  const [editPixName, setEditPixName] = useState(field.pixConfig.name || '');

  useEffect(() => {
    loadTeams();
  }, [field.id]);

  const loadTeams = async () => {
    const teams = await api.getRegisteredTeams(field.id);
    setRegisteredTeams(teams);
  };

  const getNextOccurrence = (dayOfWeek: number, weeksAhead: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + (dayOfWeek + 7 - d.getDay()) % 7 + (weeksAhead * 7));
    return d.toISOString().split('T')[0];
  };

  const handleToggleCategory = (cat: string) => {
    setTeamError('');
    if (newTeamSelectedCategories.includes(cat)) {
      setNewTeamSelectedCategories(newTeamSelectedCategories.filter(c => c !== cat));
    } else {
      if (newTeamSelectedCategories.length >= 2) {
        setTeamError('Selecione exatamente 2 categorias.');
        return;
      }
      setNewTeamSelectedCategories([...newTeamSelectedCategories, cat]);
    }
  };

  const handleAddRegisteredTeam = async () => {
    if (!newTeamName.trim()) {
      setTeamError('Informe o nome da equipe.');
      return;
    }
    if (newTeamSelectedCategories.length !== 2) {
      setTeamError('Você deve informar EXATAMENTE 2 categorias elegíveis.');
      return;
    }

    // 1. Cadastra o time como mensalista nos registros com as 2 categorias
    const newTeam = await api.addRegisteredTeam(field.id, newTeamName.trim(), newTeamDay, newTeamTime, newTeamSelectedCategories);
    
    // 2. Gera automaticamente os horários "vitalícios" (52 semanas) com as categorias informadas
    const lifetimeSlots: Omit<MatchSlot, 'id'>[] = [];
    for (let i = 0; i < 52; i++) {
        lifetimeSlots.push({
            fieldId: field.id,
            date: getNextOccurrence(newTeamDay, i),
            time: newTeamTime,
            price: field.hourlyRate,
            matchType: 'FIXO',
            durationMinutes: 60,
            isBooked: true,
            hasLocalTeam: true,
            localTeamName: newTeamName.trim(),
            allowedCategories: newTeamSelectedCategories, // Aqui usamos as 2 categorias
            bookedByTeamName: newTeamName.trim(),
            status: 'confirmed'
        });
    }
    
    onAddSlot(lifetimeSlots);
    setNewTeamName('');
    setNewTeamSelectedCategories([]);
    setTeamError('');
    loadTeams();
  };

  const handleDeleteRegisteredTeam = async (id: string) => {
    if (confirm("Deseja remover esta equipe? Isso removerá o registro mas os horários já gerados permanecerão.")) {
      await api.deleteRegisteredTeam(field.id, id);
      loadTeams();
    }
  };

  const handleManualBooking = async (slotId: string, teamName: string) => {
    if (!teamName) return;
    await api.updateSlot(slotId, {
      isBooked: true,
      bookedByTeamName: teamName,
      status: 'confirmed',
      bookedByCategory: 'Reserva Arena'
    });
    setShowManualBookingModal(null);
    window.location.reload(); 
  };

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
        hasLocalTeam: hostType !== 'NONE',
        localTeamName: hostType === 'OWNER' ? currentUser.teamName : (hostType === 'REGISTERED' ? selectedHostTeamName : undefined),
        allowedCategories: [hostType !== 'NONE' ? selectedHostCategory : selectedCategory],
        status: 'available'
      });
    }

    onAddSlot(newSlots);
    setShowAddModal(false);
    setSelectedDay(null);
    setRepeatWeeks(1);
    setHostType('NONE');
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
        <div className="flex gap-2">
            <button onClick={() => setShowTeamsModal(true)} className="p-2.5 bg-gray-50 rounded-xl text-gray-500 active:scale-95 transition-transform flex items-center gap-2">
                <UsersRound className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase hidden sm:block">Mensalistas</span>
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2.5 bg-gray-50 rounded-xl text-gray-500 active:scale-95 transition-transform"><Settings className="w-5 h-5" /></button>
        </div>
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
                                <h4 className="font-bold text-pitch text-sm">{slot.isBooked ? slot.bookedByTeamName : slot.allowedCategories[0]}</h4>
                                <div className="flex gap-1 mt-1">
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase ${slot.matchType === 'FIXO' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-600'}`}>{slot.matchType}</span>
                                  <span className="text-[8px] bg-grass-50 text-grass-700 px-1.5 py-0.5 rounded-md font-black uppercase">R$ {slot.price}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-gray-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    {slot.status === 'available' ? (
                        <div className="flex justify-between items-center">
                            <div className="text-[9px] text-gray-400 font-black uppercase flex items-center gap-2">
                                 <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${slot.hasLocalTeam ? 'bg-orange-500' : 'bg-grass-500'}`}></div>
                                 {slot.hasLocalTeam ? `Aguardando Adversário (${slot.localTeamName})` : 'Campo Livre'}
                            </div>
                            <button 
                                onClick={() => setShowManualBookingModal(slot)}
                                className="text-[9px] font-black uppercase bg-pitch text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
                            >
                                <BookOpenCheck className="w-3 h-3 text-grass-500" /> Reserva Manual
                            </button>
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
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${slot.matchType === 'FIXO' ? 'bg-orange-500 text-white' : 'bg-grass-100 text-grass-700'}`}>
                                        {slot.matchType === 'FIXO' ? 'MENSALISTA' : 'Confirmado'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {/* MODAL GESTÃO DE MENSALISTAS */}
      {showTeamsModal && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[150] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-pitch flex items-center gap-3">
                            <UsersRound className="w-7 h-7 text-grass-500" /> Mensalistas Vitalícios
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase mt-1">Gerencie times fixos e suas categorias</p>
                    </div>
                    <button onClick={() => setShowTeamsModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-dashed border-gray-200 mb-8 space-y-4">
                    {teamError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase border border-red-100 animate-in shake duration-300">
                          <AlertCircle className="w-4 h-4" /> {teamError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Nome da Equipe</label>
                            <input 
                                type="text" 
                                placeholder="Ex: Amigos da Segunda FC" 
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                className="w-full p-4 bg-white border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-grass-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Dia da Semana</label>
                            <select 
                                value={newTeamDay} 
                                onChange={e => setNewTeamDay(Number(e.target.value))}
                                className="w-full p-4 bg-white border rounded-2xl font-bold outline-none"
                            >
                                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Horário Fixo</label>
                            <input 
                                type="time" 
                                value={newTeamTime}
                                onChange={e => setNewTeamTime(e.target.value)}
                                className="w-full p-4 bg-white border rounded-2xl font-bold outline-none"
                            />
                        </div>

                        {/* SELEÇÃO DE 2 CATEGORIAS */}
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Informar 2 Categorias Elegíveis para a Agenda:</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border">
                                {categories.map(cat => {
                                  const isSelected = newTeamSelectedCategories.includes(cat);
                                  return (
                                    <button
                                      key={cat}
                                      onClick={() => handleToggleCategory(cat)}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${isSelected ? 'bg-grass-500 border-grass-600 text-pitch shadow-md scale-105' : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100'}`}
                                    >
                                      {cat} {isSelected && <Check className="w-3 h-3" />}
                                    </button>
                                  );
                                })}
                            </div>
                            <p className="text-[8px] font-black text-gray-300 uppercase mt-2 px-1">
                                Selecionadas: {newTeamSelectedCategories.length}/2
                            </p>
                        </div>
                    </div>
                    <Button onClick={handleAddRegisteredTeam} className="w-full py-4 rounded-2xl font-black text-sm uppercase shadow-lg">
                        <Plus className="w-5 h-5" /> Salvar Mensalista
                    </Button>
                </div>

                <div className="overflow-y-auto space-y-3 flex-grow pr-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Equipes Ativas</h4>
                    {registeredTeams.length === 0 && <p className="text-center text-gray-300 font-bold py-10 uppercase text-xs">Nenhuma equipe fixa.</p>}
                    {registeredTeams.map(team => (
                        <div key={team.id} className="flex justify-between items-center p-5 bg-white rounded-2xl border-2 border-gray-50 group hover:border-grass-200 transition-all shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-pitch text-grass-500 rounded-xl flex items-center justify-center font-black text-xs">
                                    {DAYS_OF_WEEK.find(d => d.value === team.fixedDay)?.label}
                                </div>
                                <div>
                                    <p className="font-black text-pitch text-sm">{team.name}</p>
                                    <div className="flex gap-2 mt-0.5">
                                      <p className="text-[9px] font-bold text-gray-400 uppercase">Fixo às {team.fixedTime}</p>
                                      <div className="flex gap-1">
                                         {team.categories?.map(c => (
                                           <span key={c} className="text-[7px] font-black bg-grass-50 text-grass-600 px-1 py-0.5 rounded border border-grass-100 uppercase">{c}</span>
                                         ))}
                                      </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteRegisteredTeam(team.id)} className="p-2 text-gray-200 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
              </div>
          </div>
      )}

      {/* MODAL RESERVA MANUAL */}
      {showManualBookingModal && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-in zoom-in-95 duration-200">
                  <h2 className="text-2xl font-black text-pitch mb-2">Reserva Manual</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-8">Dia {showManualBookingModal.date.split('-').reverse().join('/')} às {showManualBookingModal.time}</p>
                  
                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">Para qual equipe?</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                          {registeredTeams.length === 0 ? (
                              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                                  <p className="text-xs font-bold text-orange-700">Nenhuma equipe cadastrada para seleção rápida.</p>
                                  <button onClick={() => { setShowManualBookingModal(null); setShowTeamsModal(true); }} className="mt-2 text-[10px] font-black text-pitch uppercase underline">Cadastrar Agora</button>
                              </div>
                          ) : (
                              registeredTeams.map(team => (
                                  <button 
                                    key={team.id}
                                    onClick={() => handleManualBooking(showManualBookingModal.id, team.name)}
                                    className="p-4 bg-gray-50 rounded-2xl border font-black text-pitch text-left hover:bg-grass-500 hover:border-grass-600 transition-all flex items-center justify-between group"
                                  >
                                      {team.name}
                                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                              ))
                          )}
                      </div>
                      
                      <div className="flex gap-4 pt-6">
                          <button onClick={() => setShowManualBookingModal(null)} className="flex-1 py-4 font-black text-gray-400 uppercase text-xs">Cancelar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

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
                
                <div className="space-y-8 pb-10">
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

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Quem é o Mandante?</label>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => { setHostType('NONE'); setSelectedHostTeamName(''); setSelectedHostCategory(''); }}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${hostType === 'NONE' ? 'bg-pitch border-pitch text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                            >
                                <CircleSlash className={`w-6 h-6 ${hostType === 'NONE' ? 'text-grass-500' : 'text-gray-300'}`} />
                                <div className="text-left">
                                    <p className="font-black text-sm">Campo Aberto</p>
                                    <p className="text-[9px] font-bold uppercase opacity-60">Qualquer time pode agendar</p>
                                </div>
                            </button>

                            {currentUser.teamName && (
                                <div className={`p-4 rounded-2xl border transition-all ${hostType === 'OWNER' ? 'bg-pitch border-pitch text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                    <div className="flex items-center gap-4 mb-3">
                                        <Trophy className={`w-6 h-6 ${hostType === 'OWNER' ? 'text-grass-500' : 'text-gray-300'}`} />
                                        <p className="font-black text-sm uppercase">{currentUser.teamName} (Meu Time)</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {currentUser.teamCategories.map(cat => (
                                            <button 
                                                key={cat}
                                                onClick={() => { setHostType('OWNER'); setSelectedHostCategory(cat); setSelectedHostTeamName(currentUser.teamName!); }}
                                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all ${hostType === 'OWNER' && selectedHostCategory === cat ? 'bg-grass-500 border-grass-600 text-pitch' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {registeredTeams.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-gray-400 uppercase pl-1">Outras Equipes da Casa</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {registeredTeams.map(team => (
                                            <div key={team.id} className={`p-4 rounded-2xl border transition-all ${hostType === 'REGISTERED' && selectedHostTeamName === team.name ? 'bg-pitch border-pitch text-white shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                                <div 
                                                    onClick={() => { setHostType('REGISTERED'); setSelectedHostTeamName(team.name); setSelectedHostCategory(''); }}
                                                    className="flex items-center gap-4 mb-3 cursor-pointer"
                                                >
                                                    <Shield className={`w-6 h-6 ${hostType === 'REGISTERED' && selectedHostTeamName === team.name ? 'text-grass-500' : 'text-gray-300'}`} />
                                                    <p className="font-black text-sm">{team.name}</p>
                                                </div>
                                                {hostType === 'REGISTERED' && selectedHostTeamName === team.name && (
                                                    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <p className="w-full text-[9px] font-black text-grass-500 uppercase mb-1">Selecione a Categoria:</p>
                                                        {categories.map(cat => (
                                                            <button 
                                                                key={cat}
                                                                onClick={() => setSelectedHostCategory(cat)}
                                                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black transition-all ${selectedHostCategory === cat ? 'bg-grass-500 border-grass-600 text-pitch' : 'bg-white/5 border-white/10 text-gray-400'}`}
                                                            >
                                                                {cat}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Recorrência Extra (Semanal)</label>
                        <select 
                          value={repeatWeeks} 
                          onChange={e => setRepeatWeeks(Number(e.target.value))} 
                          className="w-full p-4 bg-gray-50 rounded-2xl font-black border border-gray-100 appearance-none text-pitch text-sm"
                        >
                            <option value={1}>Horário Único (Apenas esta semana)</option>
                            <option value={4}>Repetir por 4 Semanas</option>
                            <option value={8}>Repetir por 8 Semanas</option>
                            <option value={12}>Repetir por 12 Semanas</option>
                        </select>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-gray-400 uppercase text-xs tracking-widest">Cancelar</button>
                        <Button 
                            className="flex-[2] py-5 rounded-[2rem] text-sm font-black shadow-xl uppercase tracking-widest" 
                            onClick={handlePublishSlots}
                            disabled={hostType !== 'NONE' && !selectedHostCategory}
                        >
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
