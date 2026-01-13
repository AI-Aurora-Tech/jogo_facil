
import React, { useState } from 'react';
import { Plus, Calendar, Settings, Trash2, Shield, MapPin, Key, X, Save, Trophy, Check } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, COMMON_CATEGORIES, MatchType, User } from '../types';

interface FieldDashboardProps {
  field: Field;
  slots: MatchSlot[];
  currentUser: User;
  onAddSlot: (slot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, currentUser, onAddSlot, onDeleteSlot, onConfirmBooking, onRejectBooking, onUpdateField
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [selectedCategory, setSelectedCategory] = useState(COMMON_CATEGORIES[0]);
  const [price, setPrice] = useState(field.hourlyRate.toString());
  const [useOwnerTeam, setUseOwnerTeam] = useState(false);

  const [editName, setEditName] = useState(field.name);
  const [editLoc, setEditLoc] = useState(field.location);
  const [editRate, setEditRate] = useState(field.hourlyRate.toString());
  const [editPixKey, setEditPixKey] = useState(field.pixConfig.key);
  const [editPixName, setEditPixName] = useState(field.pixConfig.name);

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

  const handlePublishSlot = () => {
    if (!newDate || !newTime) return alert("Selecione data e hora");

    onAddSlot({
        fieldId: field.id,
        date: newDate,
        time: newTime,
        price: Number(price),
        matchType,
        durationMinutes: 60,
        isBooked: false,
        hasLocalTeam: useOwnerTeam,
        localTeamName: useOwnerTeam ? currentUser.teamName : undefined,
        allowedCategories: [selectedCategory],
        status: 'available'
    }, false);
    setShowAddModal(false);
  };

  return (
    <div className="bg-gray-50 min-h-full pb-20">
      <div className="p-5 bg-white border-b sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black text-pitch">Minha Arena</h1>
            <p className="text-gray-500 text-xs">{field.name}</p>
        </div>
        <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-gray-100 rounded-xl text-gray-500"><Settings className="w-5 h-5" /></button>
      </div>

      <div className="p-5 space-y-6">
        <div className="bg-pitch text-white rounded-[2rem] p-6 shadow-xl flex justify-between items-center">
            <div>
                <p className="text-grass-400 text-[10px] font-black uppercase tracking-widest mb-1">Grade de Jogos</p>
                <h2 className="text-3xl font-black">{sortedSlots.length} Horários</h2>
            </div>
            <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-grass-500 rounded-2xl flex items-center justify-center text-pitch shadow-lg">
                <Plus className="w-8 h-8" />
            </button>
        </div>

        <div className="space-y-4">
            {sortedSlots.map(slot => (
                <div key={slot.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-50 w-12 h-12 rounded-2xl flex flex-col items-center justify-center border">
                                <span className="text-lg font-black text-pitch">{slot.date.split('-')[2]}</span>
                                <span className="text-[8px] font-black text-gray-400 uppercase">{slot.time}</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-pitch">{slot.allowedCategories[0]}</h4>
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold uppercase">{slot.matchType}</span>
                            </div>
                        </div>
                        <button onClick={() => onDeleteSlot(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
                    </div>

                    {slot.status === 'available' ? (
                        <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-2">
                             <div className="w-2 h-2 bg-grass-500 rounded-full"></div>
                             Vago {slot.hasLocalTeam && `• Mandante: ${slot.localTeamName}`}
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center border">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-grass-100 rounded-full flex items-center justify-center font-black text-grass-700 text-xs">
                                    {slot.bookedByTeamName?.charAt(0)}
                                </div>
                                <p className="text-xs font-bold text-pitch">{slot.bookedByTeamName}</p>
                            </div>
                            {slot.status === 'pending_verification' && (
                                <div className="flex gap-1">
                                    <button onClick={() => onConfirmBooking(slot.id)} className="p-2 bg-grass-500 text-pitch rounded-xl shadow-md"><Shield className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[150] flex items-end">
            <div className="bg-white w-full h-[80vh] rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300 overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black">Ajustes da Arena</h2>
                    <button onClick={() => setShowSettingsModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
                </div>
                <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[10px] font-black text-gray-400 uppercase">Nome da Arena</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-transparent font-bold outline-none text-lg" />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                        <label className="text-[10px] font-black text-gray-400 uppercase">Endereço</label>
                        <input type="text" value={editLoc} onChange={e => setEditLoc(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Chave PIX</label>
                            <input type="text" value={editPixKey} onChange={e => setEditPixKey(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border">
                            <label className="text-[10px] font-black text-gray-400 uppercase">Valor Hora</label>
                            <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="w-full bg-transparent font-bold outline-none" />
                        </div>
                    </div>
                    <Button className="w-full py-5 rounded-[2rem] text-lg" onClick={handleSaveSettings}>Salvar Ajustes</Button>
                </div>
            </div>
        </div>
      )}

      {showAddModal && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[150] flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-300">
                <h2 className="text-2xl font-black mb-8">Novo Horário</h2>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold border" />
                        <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold border" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase">Categoria Obrigatória</label>
                        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl font-bold border appearance-none">
                            {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-grass-50 rounded-2xl border border-grass-100">
                        <div>
                            <p className="text-sm font-bold text-pitch">Time da Casa</p>
                            <p className="text-[10px] text-gray-500">Meu time ({currentUser.teamName || 'Sem time'}) jogará?</p>
                        </div>
                        <input type="checkbox" checked={useOwnerTeam} onChange={e => setUseOwnerTeam(e.target.checked)} className="w-6 h-6 accent-grass-500" disabled={!currentUser.teamName} />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowAddModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancelar</button>
                        <Button className="flex-[2] py-4 rounded-2xl" onClick={handlePublishSlot}>Publicar</Button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
