
import React, { useState } from 'react';
import { Plus, Users, Calendar, DollarSign, Clock, Settings, Trash2, Edit3, MessageCircle, MoreVertical, Shield, MapPin, Key, Phone, X, Save, Trophy, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, COMMON_CATEGORIES, MatchType } from '../types';

interface FieldDashboardProps {
  field: Field;
  slots: MatchSlot[];
  onAddSlot: (slot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => void;
  onEditSlot: (slotId: string, updates: Partial<MatchSlot>) => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onDeleteSlot, onConfirmBooking, onRejectBooking, onUpdateField
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Slot creation state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [price, setPrice] = useState(field.hourlyRate.toString());
  const [selectedLocalTeam, setSelectedLocalTeam] = useState('');

  // Field Settings state
  const [editName, setEditName] = useState(field.name);
  const [editLoc, setEditLoc] = useState(field.location);
  const [editRate, setEditRate] = useState(field.hourlyRate.toString());
  const [editPixKey, setEditPixKey] = useState(field.pixConfig.key);
  const [editPixName, setEditPixName] = useState(field.pixConfig.name);
  const [editPhone, setEditPhone] = useState(field.contactPhone);
  const [editLocalTeams, setEditLocalTeams] = useState<string[]>(field.localTeams || []);
  const [newLocalTeam, setNewLocalTeam] = useState('');
  
  // Home Team Editing state
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [editingTeamValue, setEditingTeamValue] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSlots = slots
    .filter(s => s.date >= todayStr)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const success = await onUpdateField(field.id, {
          name: editName,
          location: editLoc,
          hourlyRate: Number(editRate),
          contactPhone: editPhone,
          pixConfig: { key: editPixKey, name: editPixName },
          localTeams: editLocalTeams
      });
      
      if (success) {
        setShowSettingsModal(false);
      } else {
        alert("Não foi possível salvar as alterações. Verifique sua conexão e tente novamente.");
      }
    } catch (err) {
      alert("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const addLocalTeam = () => {
    if (newLocalTeam.trim() && !editLocalTeams.includes(newLocalTeam.trim())) {
        setEditLocalTeams([...editLocalTeams, newLocalTeam.trim()]);
        setNewLocalTeam('');
    }
  };

  const removeLocalTeam = (name: string) => {
    setEditLocalTeams(editLocalTeams.filter(t => t !== name));
  };

  const startEditingTeam = (index: number) => {
    setEditingTeamIndex(index);
    setEditingTeamValue(editLocalTeams[index]);
  };

  const saveEditedTeam = () => {
    if (editingTeamIndex !== null && editingTeamValue.trim()) {
      const updated = [...editLocalTeams];
      updated[editingTeamIndex] = editingTeamValue.trim();
      setEditLocalTeams(updated);
      setEditingTeamIndex(null);
      setEditingTeamValue('');
    }
  };

  const handlePublishSlot = () => {
    if (!newDate || !newTime) {
      alert("Selecione data e hora");
      return;
    }

    onAddSlot({
        fieldId: field.id,
        date: newDate,
        time: newTime,
        price: Number(price),
        matchType,
        durationMinutes: 60,
        isBooked: false,
        hasLocalTeam: !!selectedLocalTeam,
        localTeamName: selectedLocalTeam || undefined,
        allowedCategories: ['Livre'],
        status: 'available'
    }, false);
    
    // Reset modal
    setNewDate('');
    setNewTime('');
    setSelectedLocalTeam('');
    setShowAddModal(false);
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="p-5 bg-white border-b shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black text-pitch">Gestão da Arena</h1>
            <p className="text-gray-500 text-xs">Administre seus horários e reservas.</p>
        </div>
        <button onClick={() => {
          setEditName(field.name);
          setEditLoc(field.location);
          setEditRate(field.hourlyRate.toString());
          setEditPhone(field.contactPhone);
          setEditPixKey(field.pixConfig.key);
          setEditPixName(field.pixConfig.name);
          setEditLocalTeams(field.localTeams || []);
          setShowSettingsModal(true);
        }} className="p-2 bg-gray-100 rounded-xl text-gray-500 hover:text-grass-600 transition-colors">
            <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-pitch text-white rounded-[2rem] p-6 shadow-xl flex justify-between items-center">
            <div>
                <p className="text-grass-400 text-[10px] font-black uppercase tracking-widest mb-1">Agenda de Hoje</p>
                <h2 className="text-3xl font-black">{sortedSlots.filter(s => s.date === todayStr).length} <span className="text-sm font-normal text-gray-400">Jogos</span></h2>
            </div>
            <button onClick={() => {
              setPrice(field.hourlyRate.toString());
              setShowAddModal(true);
            }} className="w-14 h-14 bg-grass-500 rounded-2xl flex items-center justify-center text-pitch shadow-lg shadow-grass-500/20 active:scale-90 transition-transform">
                <Plus className="w-8 h-8" />
            </button>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Próximas Partidas</h3>
                <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded-full font-bold">{sortedSlots.length} Total</span>
            </div>

            {sortedSlots.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-300">
                    <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Nenhum horário criado.</p>
                </div>
            ) : (
                sortedSlots.map(slot => (
                    <div key={slot.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-50 w-12 h-12 rounded-2xl flex flex-col items-center justify-center border">
                                    <span className="text-[10px] font-bold text-gray-400">{slot.date.split('-')[1]}</span>
                                    <span className="text-lg font-black text-pitch -mt-1">{slot.date.split('-')[2]}</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-pitch leading-none mb-1">{slot.time}</h4>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${slot.status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' : slot.status === 'pending_verification' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                        {slot.status === 'confirmed' ? 'Confirmado' : slot.status === 'pending_verification' ? 'Solicitado' : 'Vago'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-gray-300 hover:text-red-500">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        {slot.status !== 'available' && (
                            <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-grass-100 rounded-full flex items-center justify-center font-black text-grass-700">
                                        {slot.bookedByTeamName?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-pitch">{slot.bookedByTeamName}</p>
                                        <p className="text-[10px] text-gray-400">{slot.bookedByCategory}</p>
                                    </div>
                                </div>
                                {slot.status === 'pending_verification' && (
                                    <div className="flex gap-1">
                                        <button onClick={() => onConfirmBooking(slot.id)} className="p-2 bg-grass-500 text-pitch rounded-xl shadow-md"><Shield className="w-4 h-4" /></button>
                                        <button onClick={() => onRejectBooking(slot.id)} className="p-2 bg-red-100 text-red-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        )}
                        {slot.hasLocalTeam && slot.status === 'available' && (
                            <div className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-2 rounded-xl flex items-center gap-2">
                                <Trophy className="w-3 h-3"/> Time da Casa: {slot.localTeamName}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Modal de Configurações da Arena */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[110] flex items-end">
            <div className="bg-white w-full h-[90vh] rounded-t-[2.5rem] p-6 animate-in slide-in-from-bottom duration-300 overflow-y-auto pb-safe">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-pitch">Ajustes da Arena</h2>
                    <button onClick={() => setShowSettingsModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>

                <div className="space-y-6">
                    <section>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Informações Básicas</h3>
                        <div className="space-y-3">
                            <div className="bg-gray-50 p-3 rounded-2xl border">
                                <label className="text-[10px] font-bold text-gray-400">Nome da Arena</label>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                            </div>
                            <div className="bg-gray-50 p-3 rounded-2xl border">
                                <label className="text-[10px] font-bold text-gray-400">Endereço</label>
                                <div className="flex gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                                    <input type="text" value={editLoc} onChange={e => setEditLoc(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-2xl border">
                                    <label className="text-[10px] font-bold text-gray-400">Valor/Hora (R$)</label>
                                    <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                                </div>
                                <div className="bg-gray-50 p-3 rounded-2xl border">
                                    <label className="text-[10px] font-bold text-gray-400">WhatsApp</label>
                                    <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Dados de Pagamento (PIX)</h3>
                        <div className="space-y-3 bg-grass-50/50 p-4 rounded-[2rem] border border-grass-100">
                             <div className="bg-white p-3 rounded-2xl border">
                                <label className="text-[10px] font-bold text-gray-400">Chave PIX</label>
                                <div className="flex gap-2">
                                    <Key className="w-4 h-4 text-grass-500 shrink-0 mt-1" />
                                    <input type="text" value={editPixKey} onChange={e => setEditPixKey(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border">
                                <label className="text-[10px] font-bold text-gray-400">Titular da Conta</label>
                                <input type="text" value={editPixName} onChange={e => setEditPixName(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Nossos Times (Times da Casa)</h3>
                        <div className="space-y-3">
                            <div className="flex gap-2 mb-4">
                                <input 
                                  type="text" 
                                  placeholder="Nome do time..." 
                                  value={newLocalTeam} 
                                  onChange={e => setNewLocalTeam(e.target.value)} 
                                  className="flex-grow p-3 bg-gray-50 rounded-2xl border font-bold outline-none" 
                                />
                                <button onClick={addLocalTeam} className="bg-grass-600 text-white px-4 rounded-2xl font-bold active:scale-95 transition-transform">Add</button>
                            </div>
                            <div className="space-y-2">
                                {editLocalTeams.map((name, index) => (
                                    <div key={index} className="bg-white border rounded-2xl p-3 flex items-center justify-between shadow-sm">
                                        {editingTeamIndex === index ? (
                                          <div className="flex-grow flex gap-2">
                                            <input 
                                              autoFocus
                                              type="text" 
                                              value={editingTeamValue} 
                                              onChange={e => setEditingTeamValue(e.target.value)} 
                                              className="flex-grow bg-gray-50 p-2 rounded-xl font-bold outline-none border border-grass-200"
                                            />
                                            <button onClick={saveEditedTeam} className="p-2 bg-grass-100 text-grass-600 rounded-xl">
                                              <Check className="w-5 h-5"/>
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex items-center gap-2">
                                              <Trophy className="w-4 h-4 text-grass-500 shrink-0" />
                                              <span className="font-bold text-pitch">{name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                              <button onClick={() => startEditingTeam(index)} className="p-2 text-gray-400 hover:text-blue-500">
                                                <Edit3 className="w-4 h-4" />
                                              </button>
                                              <button onClick={() => removeLocalTeam(name)} className="p-2 text-gray-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <Button 
                      isLoading={isSaving}
                      className="w-full py-4 rounded-[2rem] text-lg shadow-xl" 
                      onClick={handleSaveSettings}
                    >
                        <Save className="w-5 h-5" /> Salvar Alterações
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Modal Abrir Horário */}
      {showAddModal && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300 pb-safe">
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
                <h2 className="text-2xl font-black text-pitch mb-6">Abrir Horário</h2>
                
                <div className="space-y-5 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</label>
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora</label>
                            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Time da Casa (Se houver)</label>
                        <select value={selectedLocalTeam} onChange={e => setSelectedLocalTeam(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none">
                            <option value="">Sem Time da Casa (Aluguel/Vago)</option>
                            {(field.localTeams || []).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preço (R$)</label>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</label>
                            <select value={matchType} onChange={e => setMatchType(e.target.value as MatchType)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold outline-none appearance-none">
                                <option value="AMISTOSO">Amistoso</option>
                                <option value="FESTIVAL">Festival</option>
                                <option value="ALUGUEL">Aluguel</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancelar</button>
                    <Button className="flex-[2] py-4 rounded-2xl text-lg shadow-xl shadow-grass-500/20" onClick={handlePublishSlot}>
                      Publicar
                    </Button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
