
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Settings, Trash2, Shield, MapPin, Key, X, Save, Trophy, Check, CalendarDays, Clock, Repeat, Users, CircleSlash, Swords, PartyPopper, Star, UsersRound, BookOpenCheck, ChevronRight, AlertCircle, Tag, Upload, ImageIcon, Edit2, Loader2, Info } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, RegisteredTeam } from '../types';
import { api } from '../services/api';
import { convertFileToBase64 } from '../utils';

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
  const [editingTeam, setEditingTeam] = useState<RegisteredTeam | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states for adding/editing teams
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDay, setNewTeamDay] = useState<number>(1);
  const [newTeamTime, setNewTeamTime] = useState('20:00');
  const [newTeamSelectedCategories, setNewTeamSelectedCategories] = useState<string[]>([]);
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [teamError, setTeamError] = useState('');

  // States for new single slot
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        setNewTeamLogo(base64);
      } catch (err) {
        setTeamError('Erro ao processar imagem do brasão.');
      }
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

    setIsProcessing(true);
    try {
        if (editingTeam) {
            const oldName = editingTeam.name;
            const newName = newTeamName.trim();
            
            await api.updateRegisteredTeam(field.id, editingTeam.id, {
                name: newName,
                fixedDay: newTeamDay,
                fixedTime: newTeamTime,
                categories: newTeamSelectedCategories,
                logoUrl: newTeamLogo
            });

            // Sincronizar slots futuros
            const today = new Date().toISOString().split('T')[0];
            const futureSlots = slots.filter(s => s.bookedByTeamName === oldName && s.date >= today);
            
            for (const slot of futureSlots) {
                await api.updateSlot(slot.id, {
                    bookedByTeamName: newName,
                    localTeamName: slot.hasLocalTeam ? newName : undefined,
                    allowedCategories: newTeamSelectedCategories,
                    customImageUrl: newTeamLogo || undefined
                });
            }
            setEditingTeam(null);
        } else {
            const newTeam = await api.addRegisteredTeam(field.id, newTeamName.trim(), newTeamDay, newTeamTime, newTeamSelectedCategories, newTeamLogo);
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
                    allowedCategories: newTeamSelectedCategories,
                    bookedByTeamName: newTeamName.trim(),
                    status: 'confirmed',
                    customImageUrl: newTeamLogo || undefined
                });
            }
            onAddSlot(lifetimeSlots);
        }
        
        setNewTeamName('');
        setNewTeamSelectedCategories([]);
        setNewTeamLogo('');
        setTeamError('');
        await loadTeams();
        if (editingTeam) window.location.reload();
    } catch (err) {
        setTeamError('Erro ao salvar equipe mensalista.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleEditTeam = (team: RegisteredTeam) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamDay(team.fixedDay);
    setNewTeamTime(team.fixedTime);
    setNewTeamSelectedCategories(team.categories || []);
    setNewTeamLogo(team.logoUrl || '');
    setTeamError('');
    setShowTeamsModal(true);
  };

  const handleDeleteRegisteredTeam = async (team: RegisteredTeam) => {
    if (confirm(`AVISO CRÍTICO: Deseja excluir a equipe "${team.name}"? Isso removerá permanentemente TODA A AGENDA (todos os horários futuros) vinculada a este time.`)) {
      setIsProcessing(true);
      try {
          await api.deleteRegisteredTeam(field.id, team.id);
          const today = new Date().toISOString().split('T')[0];
          const slotsToDelete = slots.filter(s => s.bookedByTeamName === team.name && s.date >= today);
          
          for (const slot of slotsToDelete) {
              await api.deleteSlot(slot.id);
          }
          
          await loadTeams();
          window.location.reload();
      } catch (err) {
          alert('Erro ao excluir equipe e agenda.');
      } finally {
          setIsProcessing(false);
      }
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
  };

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
        {/* Card de Atalho para Mensalistas */}
        <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setShowTeamsModal(true)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform group">
                <div className="bg-grass-100 p-3 rounded-2xl text-grass-600 mb-2 group-hover:scale-110 transition-transform">
                    <UsersRound className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase">Mensalistas</p>
                <p className="text-xl font-black text-pitch">{registeredTeams.length}</p>
            </div>
            <div onClick={() => setShowAddModal(true)} className="bg-pitch p-5 rounded-[2rem] shadow-lg flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform group">
                <div className="bg-grass-500 p-3 rounded-2xl text-pitch mb-2 group-hover:rotate-90 transition-transform">
                    <Plus className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-black text-grass-400 uppercase">Novo Horário</p>
                <p className="text-xs font-black text-white uppercase">Abrir Agenda</p>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Agenda Próximos Dias</p>
                    <h2 className="text-2xl font-black text-pitch">{sortedSlots.length} Slots Criados</h2>
                </div>
                <Calendar className="w-8 h-8 text-gray-100" />
            </div>

            <div className="space-y-3">
                {sortedSlots.length === 0 && (
                  <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold text-xs uppercase">Agenda Vazia</p>
                  </div>
                )}
                {sortedSlots.slice(0, 10).map(slot => (
                    <div key={slot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                        <div className="flex items-center gap-3">
                            <div className="text-center bg-white w-10 h-10 rounded-xl flex flex-col items-center justify-center border shadow-sm">
                                <span className="text-[8px] font-black text-gray-400 uppercase">{slot.date.split('-')[2]}</span>
                                <span className="text-[10px] font-black text-pitch">{slot.time}</span>
                            </div>
                            <div>
                                <p className="text-xs font-black text-pitch truncate max-w-[120px]">{slot.isBooked ? slot.bookedByTeamName : 'Disponível'}</p>
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${slot.matchType === 'FIXO' ? 'bg-orange-100 text-orange-600' : 'bg-grass-100 text-grass-600'}`}>{slot.matchType}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             {slot.status === 'pending_verification' && (
                                 <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                             )}
                             <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
                {sortedSlots.length > 10 && (
                    <p className="text-center text-[10px] font-black text-gray-400 uppercase py-2">+ {sortedSlots.length - 10} outros horários</p>
                )}
            </div>
        </div>
      </div>

      {/* MODAL GESTÃO DE MENSALISTAS - COMPLETO */}
      {showTeamsModal && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[150] flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] relative overflow-hidden">
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                      <Loader2 className="w-10 h-10 text-pitch animate-spin mb-2" />
                      <p className="text-xs font-black uppercase text-pitch">Processando Alterações...</p>
                  </div>
                )}
                
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-pitch flex items-center gap-3">
                            <UsersRound className="w-7 h-7 text-grass-500" /> Centro de Mensalistas
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase mt-1">Times fixos com renovação automática</p>
                    </div>
                    <button onClick={() => { setShowTeamsModal(false); setEditingTeam(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 mb-8 space-y-4 shrink-0">
                    <h4 className="text-[11px] font-black text-pitch uppercase tracking-widest px-1">
                        {editingTeam ? '📝 Editando Dados da Equipe' : '✨ Novo Mensalista Vitalício'}
                    </h4>
                    
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-white rounded-[1.5rem] border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden shrink-0 relative group">
                            {newTeamLogo ? <img src={newTeamLogo} className="w-full h-full object-cover"/> : <Upload className="w-6 h-6 text-gray-300"/>}
                            <input type="file" accept="image/*" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" title="Brasão do Time" />
                        </div>
                        <div className="flex-grow space-y-3">
                            <input 
                                type="text" 
                                placeholder="Nome da Equipe (Ex: Amigos da Segunda)" 
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                className="w-full p-4 bg-white border rounded-2xl font-black outline-none focus:ring-2 focus:ring-grass-500"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <select value={newTeamDay} onChange={e => setNewTeamDay(Number(e.target.value))} className="p-3 bg-white border rounded-xl font-bold text-xs outline-none">
                                    {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </select>
                                <input type="time" value={newTeamTime} onChange={e => setNewTeamTime(e.target.value)} className="p-3 bg-white border rounded-xl font-bold text-xs outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[9px] font-black text-gray-400 uppercase pl-1">Categorias Elegíveis (Selecione 2):</p>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => handleToggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${newTeamSelectedCategories.includes(cat) ? 'bg-pitch border-pitch text-white' : 'bg-white text-gray-400 border-gray-100'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleAddRegisteredTeam} className="w-full py-4 rounded-2xl font-black shadow-lg">
                        {editingTeam ? 'Sincronizar Alterações' : 'Salvar e Gerar Agenda Anual'}
                    </Button>
                </div>

                <div className="overflow-y-auto space-y-3 flex-grow pr-2 custom-scrollbar">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">Equipes Registradas ({registeredTeams.length})</h4>
                    {registeredTeams.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-100 mx-auto mb-3" />
                            <p className="text-gray-300 font-bold text-xs uppercase italic">Nenhum mensalista ainda.</p>
                        </div>
                    )}
                    {registeredTeams.map(team => (
                        <div key={team.id} className="p-5 bg-white rounded-2xl border border-gray-100 flex justify-between items-center group hover:border-grass-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-pitch rounded-2xl overflow-hidden flex items-center justify-center text-grass-500 font-black text-xs">
                                    {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : team.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-black text-pitch text-sm">{team.name}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Toda {DAYS_OF_WEEK.find(d => d.value === team.fixedDay)?.label} • {team.fixedTime}</p>
                                    <div className="flex gap-1 mt-1">
                                        {team.categories.map(c => <span key={c} className="text-[7px] bg-gray-50 px-1 py-0.5 rounded font-black text-gray-400 border border-gray-100 uppercase">{c}</span>)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditTeam(team)} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-pitch transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteRegisteredTeam(team)} className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
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
                      <label className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">Selecione o Time:</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                          {registeredTeams.map(team => (
                              <button 
                                key={team.id}
                                onClick={() => handleManualBooking(showManualBookingModal.id, team.name)}
                                className="p-4 bg-gray-50 rounded-2xl border font-black text-pitch text-left hover:bg-grass-500 hover:border-grass-600 transition-all flex items-center justify-between group"
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-pitch rounded-lg overflow-hidden flex items-center justify-center">
                                          {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] text-white">{team.name.charAt(0)}</span>}
                                      </div>
                                      {team.name}
                                  </div>
                                  <ChevronRight className="w-4 h-4" />
                              </button>
                          ))}
                      </div>
                      <button onClick={() => setShowManualBookingModal(null)} className="w-full py-4 font-black text-gray-400 uppercase text-xs">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL CONFIGURAÇÕES */}
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
                            <input type="text" value={editPixKey} onChange={e => setEditPixKey(e.target.value)} className="w-full bg-transparent font-bold outline-none text-pitch" />
                        </div>
                    </div>
                    <Button className="w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest" onClick={handleSaveSettings}>Atualizar Arena</Button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL ADICIONAR SLOTS */}
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

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Recorrência Extra (Semanal)</label>
                        <select value={repeatWeeks} onChange={e => setRepeatWeeks(Number(e.target.value))} className="w-full p-4 bg-gray-50 rounded-2xl font-black border border-gray-100 appearance-none text-pitch text-sm">
                            <option value={1}>Horário Único</option>
                            <option value={4}>4 Semanas</option>
                            <option value={8}>8 Semanas</option>
                        </select>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 font-black text-gray-400 uppercase text-xs tracking-widest">Cancelar</button>
                        <Button className="flex-[2] py-5 rounded-[2rem] text-sm font-black shadow-xl uppercase tracking-widest" onClick={handlePublishSlots}>Publicar Agenda</Button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
