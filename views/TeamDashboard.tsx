
import React, { useState } from 'react';
import { Search, MapPin, Clock, Swords, CalendarCheck, XCircle, Loader2, MessageCircle, Info, Star } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User } from '../types';
import { api } from '../api';

interface TeamDashboardProps {
  categories: string[];
  currentUser: User;
  fields: Field[];
  slots: MatchSlot[];
  onBookSlot: (slotId: string, bookingData: { teamName: string, category: string }) => void;
  onCancelBooking: (slotId: string) => void;
  viewMode: 'EXPLORE' | 'MY_BOOKINGS';
  onRefresh: () => void;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentUser, fields, slots, onCancelBooking, viewMode, onRefresh }) => {
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field || field.ownerId === currentUser.id) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || slot.status !== 'available') return false;
      // If mandante exists, visitor can only book if any of their team categories fit the range
      if (slot.hasLocalTeam) {
        const canAnyoneFit = currentUser.teams.some(t => t.categories.some(cat => slot.allowedOpponentCategories.includes(cat)));
        if (!canAnyoneFit) return false;
      }
      return true;
    } else {
      return slot.bookedByUserId === currentUser.id || slot.opponentTeamPhone === currentUser.phoneNumber;
    }
  }).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleBookingConfirm = async () => {
    if (!selectedSlot || !selectedCategory) return;
    const team = currentUser.teams[selectedTeamIdx];
    try {
      await api.updateSlot(selectedSlot.id, {
        opponentTeamName: team.name,
        opponentTeamCategory: selectedCategory,
        opponentTeamPhone: currentUser.phoneNumber,
        status: 'pending_verification'
      });
      setSelectedSlot(null);
      onRefresh();
      alert("Solicitação enviada!");
    } catch (e) { alert("Erro ao solicitar."); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 space-y-6">
      {filteredSlots.map(slot => {
        const field = fields.find(f => f.id === slot.fieldId);
        const isChallenge = slot.hasLocalTeam;
        const isConfirmed = slot.status === 'confirmed';
        
        return (
          <div key={slot.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden group hover:border-grass-500 transition-all">
            <div className="p-6 flex gap-5">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl overflow-hidden border">
                <img src={field?.imageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                 <h3 className="font-black text-pitch text-lg leading-none uppercase">{field?.name}</h3>
                 <div className="flex gap-2 mt-2">
                    <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-xl flex items-center gap-1 uppercase"><Clock className="w-3 h-3"/> {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                 </div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                   <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Mandante</p>
                   <p className="text-sm font-black text-pitch">{slot.localTeamName || 'Aluguel Avulso'}</p>
                   <p className="text-[10px] font-bold text-grass-600">{slot.localTeamCategory || 'Sem restrição'}</p>
                </div>
                <Swords className="w-4 h-4 text-gray-300" />
                <div className="text-right">
                   <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Adversário Aceito</p>
                   <p className="text-[10px] font-black text-pitch uppercase">{slot.allowedOpponentCategories.join(', ') || 'Qualquer um'}</p>
                </div>
              </div>
            </div>

            <div className="p-6 flex items-center justify-between border-t mt-2">
               <div>
                  <p className="text-xl font-black text-pitch leading-none italic">R$ {slot.price}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Total Jogo</p>
               </div>
               <Button onClick={() => { setSelectedSlot(slot); setSelectedCategory(''); }} className={`rounded-2xl px-8 py-4 font-black uppercase text-[10px] ${isChallenge ? 'bg-orange-500' : 'bg-pitch'}`}>
                  {isChallenge ? 'Desafiar' : 'Reservar'}
               </Button>
            </div>
          </div>
        );
      })}

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500">
            <h2 className="text-2xl font-black text-pitch uppercase italic mb-8">Confirmar Reserva</h2>
            <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Com qual time você vai?</label>
                  <div className="flex gap-3">
                     {currentUser.teams.map((t, i) => (
                        <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white' : 'bg-gray-50 border text-gray-400'}`}>{t.name}</button>
                     ))}
                  </div>
               </div>
               
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Selecione a Categoria</label>
                  <div className="flex flex-wrap gap-2">
                     {currentUser.teams[selectedTeamIdx]?.categories.map(cat => {
                        const isAllowed = selectedSlot.allowedOpponentCategories.length === 0 || selectedSlot.allowedOpponentCategories.includes(cat);
                        return (
                          <button 
                            key={cat} 
                            disabled={!isAllowed}
                            onClick={() => setSelectedCategory(cat)} 
                            className={`px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all ${!isAllowed ? 'opacity-20 grayscale' : selectedCategory === cat ? 'bg-grass-500 text-pitch' : 'bg-gray-50 border text-gray-400'}`}
                          >
                             {cat}
                          </button>
                        );
                     })}
                  </div>
               </div>

               <div className="flex gap-4 pt-6">
                  <button onClick={() => setSelectedSlot(null)} className="flex-1 font-black uppercase text-[10px] text-gray-400">Voltar</button>
                  <Button onClick={handleBookingConfirm} disabled={!selectedCategory} className="flex-[2] py-5 rounded-[2rem] font-black uppercase text-xs">Confirmar Desafio</Button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
