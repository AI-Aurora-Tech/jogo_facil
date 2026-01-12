
import React, { useState } from 'react';
import { Plus, Users, Calendar, DollarSign, Clock, Settings, Trash2, Edit3, MessageCircle, MoreVertical, Shield } from 'lucide-react';
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
  field, slots, onAddSlot, onDeleteSlot, onConfirmBooking, onRejectBooking 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Slot creation state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [price, setPrice] = useState(field.hourlyRate.toString());

  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSlots = slots
    .filter(s => s.date >= todayStr)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="p-5 bg-white border-b shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black text-pitch">Gestão da Arena</h1>
            <p className="text-gray-500 text-xs">Administre seus horários e reservas.</p>
        </div>
        <button className="p-2 bg-gray-100 rounded-xl text-gray-500">
            <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Arena Summary */}
        <div className="bg-pitch text-white rounded-[2rem] p-6 shadow-xl flex justify-between items-center">
            <div>
                <p className="text-grass-400 text-[10px] font-black uppercase tracking-widest mb-1">Agenda de Hoje</p>
                <h2 className="text-3xl font-black">{sortedSlots.filter(s => s.date === todayStr).length} <span className="text-sm font-normal text-gray-400">Jogos</span></h2>
            </div>
            <button onClick={() => setShowAddModal(true)} className="w-14 h-14 bg-grass-500 rounded-2xl flex items-center justify-center text-pitch shadow-lg shadow-grass-500/20 active:scale-90 transition-transform">
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
                                        <button onClick={() => onRejectBooking(slot.id)} className="p-2 bg-red-100 text-red-500 rounded-xl"><XCircle className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Add Slot Modal */}
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
                    <Button className="flex-[2] py-4 rounded-2xl text-lg shadow-xl shadow-grass-500/20" onClick={() => {
                        onAddSlot({
                            fieldId: field.id,
                            date: newDate,
                            time: newTime,
                            price: Number(price),
                            matchType,
                            durationMinutes: 60,
                            isBooked: false,
                            hasLocalTeam: false,
                            allowedCategories: ['Livre'],
                            status: 'available'
                        }, false);
                        setShowAddModal(false);
                    }}>Publicar</Button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

const XCircle = ({className}: {className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
);
