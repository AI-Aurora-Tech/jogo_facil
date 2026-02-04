
import React, { useState } from 'react';
import { Search, MapPin, Clock, Swords, CalendarCheck, XCircle, Loader2, MessageCircle, Info, Star, AlertCircle, Phone } from 'lucide-react';
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

  const handleWhatsApp = (phone?: string, message?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message || '')}`, '_blank');
  };

  const handleBookingConfirm = async () => {
    if (!selectedSlot || !selectedCategory) return;
    const team = currentUser.teams[selectedTeamIdx];
    const field = fields.find(f => f.id === selectedSlot.fieldId);
    
    try {
      await api.updateSlot(selectedSlot.id, {
        opponentTeamName: team.name,
        opponentTeamCategory: selectedCategory,
        opponentTeamPhone: currentUser.phoneNumber,
        opponentTeamLogoUrl: team.logoUrl,
        opponentTeamGender: team.gender,
        bookedByUserId: currentUser.id,
        status: 'pending_verification'
      });

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
      alert("Solicitação enviada! O dono da arena foi notificado.");
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
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center overflow-hidden">
                      {slot.localTeamLogoUrl ? <img src={slot.localTeamLogoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xs">{slot.localTeamName?.charAt(0) || 'H'}</div>}
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase">Mandante</p>
                      <p className="text-sm font-black text-pitch leading-tight">{slot.localTeamName || 'Horário Livre'}</p>
                      <span className="text-[8px] font-bold text-grass-600 uppercase">{slot.localTeamCategory || 'Livre'} • {slot.localTeamGender || 'MASC'}</span>
                   </div>
                </div>
                {isChallenge && <Swords className="w-5 h-5 text-gray-300 mx-2" />}
                {slot.opponentTeamName && (
                  <div className="text-right flex items-center gap-3">
                     <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase">Desafiante</p>
                        <p className="text-sm font-black text-pitch leading-tight">{slot.opponentTeamName}</p>
                        <span className="text-[8px] font-bold text-orange-600 uppercase">{slot.opponentTeamCategory}</span>
                     </div>
                     <div className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center overflow-hidden">
                        {slot.opponentTeamLogoUrl ? <img src={slot.opponentTeamLogoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xs">{slot.opponentTeamName.charAt(0)}</div>}
                     </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 flex items-center justify-between border-t mt-2">
               <div className="flex gap-2">
                  <button 
                    onClick={() => handleWhatsApp(field?.contactPhone, `Olá! Vi o horário de ${slot.time} no dia ${slot.date} na arena ${field?.name} e gostaria de mais informações.`)}
                    className="p-3 bg-grass-50 text-grass-600 rounded-xl active:scale-95"
                  >
                    <MessageCircle className="w-5 h-5"/>
                  </button>
                  {slot.opponentTeamPhone && (
                    <button 
                      onClick={() => handleWhatsApp(slot.opponentTeamPhone, `Olá ${slot.opponentTeamName}! Sou o mandante do jogo na arena ${field?.name} no dia ${slot.date}. Bora pro jogo?`)}
                      className="p-3 bg-blue-50 text-blue-600 rounded-xl active:scale-95"
                    >
                      <Phone className="w-5 h-5"/>
                    </button>
                  )}
               </div>
               
               {viewMode === 'EXPLORE' ? (
                 <Button onClick={() => { setSelectedSlot(slot); setSelectedCategory(''); }} className="rounded-2xl px-8 py-4 font-black uppercase text-[10px] bg-pitch">
                    {isChallenge ? 'Desafiar Time' : 'Reservar Horário'}
                 </Button>
               ) : (
                 <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase ${slot.status === 'confirmed' ? 'bg-grass-500 text-pitch' : 'bg-orange-100 text-orange-600'}`}>
                      {slot.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                    </span>
                 </div>
               )}
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
                        <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black uppercase text-[10px] transition-all flex flex-col items-center gap-2 ${selectedTeamIdx === i ? 'bg-pitch text-white border-pitch' : 'bg-gray-50 border text-gray-400'}`}>
                           {t.logoUrl && <img src={t.logoUrl} className="w-8 h-8 rounded-lg object-cover mb-1" />}
                           {t.name}
                        </button>
                     ))}
                  </div>
               </div>
               
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block">Escolha a Categoria</label>
                  <div className="flex flex-wrap gap-2">
                     {currentUser.teams[selectedTeamIdx]?.categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => setSelectedCategory(cat)} 
                          className={`px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all ${selectedCategory === cat ? 'bg-grass-500 text-pitch border-grass-500' : 'bg-gray-50 border text-gray-400'}`}
                        >
                           {cat}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex flex-col gap-4 pt-6 pb-safe">
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
