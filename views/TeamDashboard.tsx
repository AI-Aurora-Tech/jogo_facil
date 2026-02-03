
import React, { useState } from 'react';
import { Search, MapPin, Clock, Swords, CalendarCheck, XCircle, Loader2, MessageCircle, Info, Star, AlertCircle } from 'lucide-react';
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
    if (!field) return false;

    if (viewMode === 'EXPLORE' && field.ownerId === currentUser.id) return false;

    if (viewMode === 'EXPLORE') {
      return slot.date >= todayStr && slot.status === 'available';
    } else {
      return slot.bookedByUserId === currentUser.id || slot.opponentTeamPhone === currentUser.phoneNumber;
    }
  }).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleBookingConfirm = async () => {
    if (!selectedSlot || !selectedCategory) return;
    const team = currentUser.teams[selectedTeamIdx];
    const field = fields.find(f => f.id === selectedSlot.fieldId);
    
    try {
      await api.updateSlot(selectedSlot.id, {
        opponentTeamName: team.name,
        opponentTeamCategory: selectedCategory,
        opponentTeamPhone: currentUser.phoneNumber,
        bookedByUserId: currentUser.id,
        status: 'pending_verification'
      });

      // Notificar o dono da arena
      if (field) {
        await api.createNotification({
          userId: field.ownerId,
          title: "Novo Desafio Recebido!",
          description: `O time ${team.name} (${selectedCategory}) solicitou o horário de ${selectedSlot.time} no dia ${selectedSlot.date.split('-').reverse().join('/')}.`,
          type: 'info'
        });
      }

      setSelectedSlot(null);
      onRefresh();
      alert("Solicitação enviada! Aguarde a confirmação da arena na sua aba de Histórico.");
    } catch (e) { alert("Erro ao solicitar agendamento."); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 space-y-6">
      {filteredSlots.length === 0 && (
        <div className="py-20 text-center">
           <p className="text-gray-300 font-black uppercase text-xs">Nenhuma partida encontrada</p>
        </div>
      )}

      {filteredSlots.map(slot => {
        const field = fields.find(f => f.id === slot.fieldId);
        const isChallenge = slot.hasLocalTeam;
        
        return (
          <div key={slot.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden group hover:border-pitch transition-all">
            <div className="p-6 flex gap-5">
              <div className="w-16 h-16 bg-pitch rounded-2xl overflow-hidden border border-white shadow-sm">
                <img src={field?.imageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                 <h3 className="font-black text-pitch text-lg leading-none uppercase">{field?.name}</h3>
                 <div className="flex gap-2 mt-2">
                    <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-xl flex items-center gap-1 uppercase">
                      <Clock className="w-3 h-3"/> {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                    </span>
                    <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-1 rounded-xl uppercase">
                      {slot.sport}
                    </span>
                 </div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                   <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Mandante (Quem joga)</p>
                   <p className="text-base font-black text-pitch">{slot.localTeamName || 'Horário para Aluguel'}</p>
                   <p className="text-[10px] font-bold text-grass-600 uppercase">{slot.localTeamCategory || 'Livre'}</p>
                </div>
                {isChallenge && <Swords className="w-5 h-5 text-gray-300 mx-2" />}
                <div className="text-right flex-1">
                   <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Categorias Aceitas</p>
                   <p className="text-[10px] font-black text-pitch uppercase line-clamp-1">
                     {slot.allowedOpponentCategories.length > 0 ? slot.allowedOpponentCategories.join(', ') : 'Qualquer uma'}
                   </p>
                </div>
              </div>
            </div>

            <div className="p-6 flex items-center justify-between border-t mt-2">
               <div>
                  <p className="text-xl font-black text-pitch leading-none italic">R$ {slot.price}</p>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Valor da Partida</p>
               </div>
               
               <Button 
                onClick={() => { setSelectedSlot(slot); setSelectedCategory(''); }} 
                className={`rounded-2xl px-8 py-4 font-black uppercase text-[10px] ${isChallenge ? 'bg-orange-500' : 'bg-pitch'}`}
               >
                  {isChallenge ? 'Desafiar Time' : 'Reservar Horário'}
               </Button>
            </div>
          </div>
        );
      })}

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-pitch uppercase italic mb-8">
              {selectedSlot.hasLocalTeam ? 'Confirmar Desafio' : 'Reservar Aluguel'}
            </h2>
            
            <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Qual dos seus times vai jogar?</label>
                  <div className="flex flex-wrap gap-3">
                     {currentUser.teams.map((t, i) => (
                        <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white border-pitch' : 'bg-gray-50 border text-gray-400'}`}>{t.name}</button>
                     ))}
                  </div>
               </div>
               
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Escolha a Categoria do Time</label>
                  <div className="flex flex-wrap gap-2">
                     {currentUser.teams[selectedTeamIdx]?.categories.map(cat => {
                        const isAllowed = selectedSlot.allowedOpponentCategories.length === 0 || selectedSlot.allowedOpponentCategories.includes(cat);
                        return (
                          <button 
                            key={cat} 
                            disabled={!isAllowed}
                            onClick={() => setSelectedCategory(cat)} 
                            className={`px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all ${!isAllowed ? 'opacity-20 grayscale border-dashed' : selectedCategory === cat ? 'bg-grass-500 text-pitch border-grass-500' : 'bg-gray-50 border text-gray-400'}`}
                          >
                             {cat}
                          </button>
                        );
                     })}
                  </div>
                  {selectedSlot.hasLocalTeam && selectedSlot.allowedOpponentCategories.length > 0 && (
                    <p className="mt-3 text-[9px] font-bold text-gray-400 flex items-center gap-1 uppercase italic"><Info className="w-3 h-3"/> Categorias permitidas: {selectedSlot.allowedOpponentCategories.join(', ')}</p>
                  )}
               </div>

               <div className="flex flex-col gap-4 pt-6">
                  <Button onClick={handleBookingConfirm} disabled={!selectedCategory} className="w-full py-5 rounded-[2.5rem] font-black uppercase text-xs shadow-xl active:scale-95">Confirmar e Solicitar</Button>
                  <button onClick={() => setSelectedSlot(null)} className="w-full font-black uppercase text-[10px] text-gray-400 py-2">Cancelar</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
