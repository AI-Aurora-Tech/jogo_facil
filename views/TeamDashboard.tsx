
import React, { useState } from 'react';
import { Search, MapPin, Clock, Tag, Swords, CalendarCheck, CheckCircle2, XCircle, Upload, Loader2, ChevronRight, MessageCircle, Info, Award } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User } from '../types';
import { verifyPixReceipt } from '../services/aiService';
import { api } from '../api';
import { convertFileToBase64 } from '../utils';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedCategoryForBooking, setSelectedCategoryForBooking] = useState(currentUser.teamCategories[0] || '');
  const [verifyingSlot, setVerifyingSlot] = useState<MatchSlot | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [bookingSuccessSlot, setBookingSuccessSlot] = useState<MatchSlot | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;
    if (field.ownerId === currentUser.id) return false;

    if (viewMode === 'EXPLORE') {
      // Regra 1: Slot deve estar 'available' e ser futuro
      if (slot.date < todayStr || slot.status !== 'available') return false;
      // Regra 2: Se for aluguel sem mandante e ja tiver 2 times, some
      const renterCount = (slot.bookedByTeamName ? 1 : 0) + (slot.opponentTeamName ? 1 : 0);
      if (!slot.hasLocalTeam && renterCount >= 2) return false;
      // Regra 3: Se for local e ja tiver oponente, some
      if (slot.hasLocalTeam && slot.opponentTeamName) return false;
      
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    } else {
      return (slot.bookedByUserId === currentUser.id || slot.opponentTeamName === currentUser.teamName) && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleBookingConfirm = async () => {
    if (!selectedSlot || !selectedCategoryForBooking) return;
    
    // Se não tem mandante nenhum, o cara vira o mandante (bookedBy)
    const isFirstRenter = !selectedSlot.hasLocalTeam && !selectedSlot.bookedByTeamName;

    try {
      if (isFirstRenter) {
        await api.updateSlot(selectedSlot.id, {
          bookedByUserId: currentUser.id,
          bookedByTeamName: currentUser.teamName,
          bookedByUserPhone: currentUser.phoneNumber,
          bookedByCategory: selectedCategoryForBooking,
          status: 'pending_verification'
        });
      } else {
        await api.updateSlot(selectedSlot.id, {
          opponentTeamName: currentUser.teamName,
          opponentTeamCategory: selectedCategoryForBooking,
          opponentTeamPhone: currentUser.phoneNumber,
          status: 'pending_verification'
        });
      }
      
      const updatedSlot = { ...selectedSlot }; // Mock do update para o modal de sucesso
      setBookingSuccessSlot(updatedSlot);
      setSelectedSlot(null);
      onRefresh();
    } catch (e) {
      alert("Erro ao solicitar reserva.");
    }
  };

  const getWhatsappLink = (phone: string, message: string) => {
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !verifyingSlot) return;
    setIsAiLoading(true);
    try {
      const field = fields.find(f => f.id === verifyingSlot.fieldId);
      const base64 = await convertFileToBase64(file);
      await api.updateSlot(verifyingSlot.id, {
        receiptUrl: base64,
        status: 'pending_verification'
      });
      onRefresh();
    } finally { setIsAiLoading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {viewMode === 'EXPLORE' && (
        <div className="p-6 bg-white border-b sticky top-0 z-20 glass">
            <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Buscar arena..." className="w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-2xl outline-none font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {filteredSlots.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4 text-gray-400">
             <CalendarCheck className="w-12 h-12 opacity-10" />
             <p className="font-bold uppercase text-[10px] tracking-widest">Nenhuma partida disponível</p>
          </div>
        )}
        {filteredSlots.map(slot => {
          const field = fields.find(f => f.id === slot.fieldId);
          if (!field) return null;
          const isChallenge = slot.hasLocalTeam || slot.bookedByTeamName;

          return (
            <div key={slot.id} className="bg-white rounded-[2.5rem] overflow-hidden border shadow-sm transition-all hover:border-grass-500 hover:shadow-xl group">
              <div className="p-6 flex gap-5">
                  <div className="w-20 h-20 rounded-3xl overflow-hidden border bg-gray-100 flex-shrink-0 relative">
                      <img src={field.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      {slot.matchType === 'FESTIVAL' && (
                        <div className="absolute top-1 right-1 bg-yellow-400 text-pitch p-1 rounded-lg shadow-lg">
                          <Award className="w-3 h-3" />
                        </div>
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                      <h3 className="font-black text-pitch text-lg uppercase leading-none truncate">{field.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 flex items-center truncate"><MapPin className="w-3 h-3 mr-1" /> {field.location}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                           <div className="bg-gray-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                           </div>
                           <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${slot.matchType === 'FESTIVAL' ? 'bg-blue-50 text-blue-600' : 'bg-grass-50 text-grass-600'}`}>
                                {slot.matchType} {slot.durationMinutes}min
                           </div>
                      </div>
                  </div>
              </div>
              <div className="px-6 pb-2">
                 <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border shadow-sm">
                       <Swords className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="flex-1">
                       <p className="text-[9px] font-black text-gray-400 uppercase leading-none">Confronto</p>
                       <p className="text-[11px] font-black text-pitch truncate">
                          {slot.localTeamName || slot.bookedByTeamName || 'Mandante Aberto'} vs {slot.opponentTeamName || 'Você'}
                       </p>
                    </div>
                 </div>
              </div>
              <div className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black text-pitch italic leading-none">R$ {slot.price.toFixed(0)}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Valor da Partida</p>
                  </div>
                  {viewMode === 'MY_BOOKINGS' ? (
                      <div className="flex gap-2">
                        {slot.status === 'confirmed' ? (
                           <span className="bg-grass-500 text-pitch px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg">
                              <CheckCircle2 className="w-4 h-4"/> Confirmado
                           </span>
                        ) : !slot.receiptUrl ? (
                           <button onClick={() => setVerifyingSlot(slot)} className="bg-orange-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95">Pagar Pix</button>
                        ) : (
                           <span className="bg-gray-100 text-gray-400 px-5 py-3 rounded-2xl text-[10px] font-black uppercase border">Validando...</span>
                        )}
                        <button onClick={() => onCancelBooking(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                      </div>
                  ) : (
                      <Button className={`rounded-2xl px-10 py-4 text-[11px] font-black uppercase transition-all active:scale-95 shadow-lg ${isChallenge ? 'bg-orange-500 text-white' : 'bg-pitch text-white'}`} onClick={() => { setSelectedSlot(slot); setSelectedCategoryForBooking(currentUser.teamCategories[0] || ''); }}>
                        {isChallenge ? 'Desafiar' : 'Reservar'}
                      </Button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {bookingSuccessSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-grass-100 text-grass-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-pitch uppercase italic leading-tight">Sucesso!</h2>
              <p className="text-gray-500 text-xs font-medium mt-2">Sua reserva foi enviada. Para garantir o horário, mande uma mensagem agora:</p>
              
              <div className="mt-8 space-y-3">
                 <a 
                   href={getWhatsappLink(fields.find(f => f.id === bookingSuccessSlot.fieldId)?.contactPhone || '', `Olá! Acabamos de agendar o horário de ${bookingSuccessSlot.time} no dia ${bookingSuccessSlot.date.split('-').reverse().join('/')} através do Jogo Fácil. Nosso time: ${currentUser.teamName} (${selectedCategoryForBooking}).`)}
                   target="_blank"
                   className="w-full bg-grass-500 text-pitch py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg"
                 >
                   <MessageCircle className="w-4 h-4" /> Notificar Arena
                 </a>
                 
                 {(bookingSuccessSlot.localTeamPhone || bookingSuccessSlot.bookedByUserPhone) && (
                   <a 
                     href={getWhatsappLink(bookingSuccessSlot.localTeamPhone || bookingSuccessSlot.bookedByUserPhone || '', `Olá capitão! Desafiamos vocês para a partida de ${bookingSuccessSlot.time} no dia ${bookingSuccessSlot.date.split('-').reverse().join('/')} no Jogo Fácil. Estão confirmados? Nosso time: ${currentUser.teamName} (${selectedCategoryForBooking}).`)}
                     target="_blank"
                     className="w-full bg-pitch text-white py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg"
                   >
                     <MessageCircle className="w-4 h-4" /> Notificar Adversário
                   </a>
                 )}
              </div>

              <button onClick={() => setBookingSuccessSlot(null)} className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-2">Entendido</button>
           </div>
        </div>
      )}

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center gap-5 mb-8">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-pitch flex-shrink-0 ${selectedSlot.bookedByTeamName || selectedSlot.hasLocalTeam ? 'bg-orange-500 text-white' : 'bg-grass-500 text-pitch shadow-lg'}`}>
                        {selectedSlot.bookedByTeamName || selectedSlot.hasLocalTeam ? <Swords className="w-10 h-10"/> : <CalendarCheck className="w-10 h-10"/>}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch uppercase tracking-tighter italic leading-none">
                          {selectedSlot.bookedByTeamName || selectedSlot.hasLocalTeam ? 'Desafiar Time' : 'Reservar Vaga'}
                        </h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase mt-2">
                          Arena: {fields.find(f => f.id === selectedSlot.fieldId)?.name} • {selectedSlot.time}
                        </p>
                    </div>
                </div>

                <div className="space-y-4 mb-10">
                   <p className="text-[10px] font-black text-pitch uppercase tracking-widest flex items-center gap-2"><Info className="w-3 h-3"/> Escolha a Categoria do {currentUser.teamName}:</p>
                   <div className="flex flex-wrap gap-3">
                      {currentUser.teamCategories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategoryForBooking(cat)} className={`flex-1 min-w-[120px] py-5 rounded-[1.5rem] text-xs font-black uppercase transition-all ${selectedCategoryForBooking === cat ? 'bg-pitch text-white ring-4 ring-pitch/20 shadow-xl' : 'bg-gray-50 text-gray-400 border'}`}>
                           {cat}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-300 uppercase text-[10px]">Cancelar</button>
                    <Button className="flex-[2] py-5 rounded-[2.5rem] font-black uppercase shadow-2xl active:scale-95" onClick={handleBookingConfirm} disabled={!selectedCategoryForBooking}>Solicitar Reserva</Button>
                </div>
            </div>
        </div>
      )}

      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/95 z-[200] flex items-end">
             <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500">
                {isAiLoading && <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center rounded-t-[4rem]"><Loader2 className="w-10 h-10 text-grass-500 animate-spin mb-4"/><p className="font-black uppercase text-xs">Validando PIX...</p></div>}
                <div className="flex justify-between items-start mb-8">
                    <h2 className="text-2xl font-black text-pitch uppercase italic">Enviar Comprovante</h2>
                    <button onClick={() => setVerifyingSlot(null)} className="p-2 bg-gray-100 rounded-full"><XCircle className="w-6 h-6"/></button>
                </div>
                <div className="bg-gray-50 p-12 rounded-[3.5rem] border-4 border-dashed border-gray-100 text-center relative hover:border-pitch transition-all group">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleReceiptUpload} />
                    <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4 group-hover:text-pitch transition-colors" />
                    <p className="text-pitch font-black uppercase text-sm">Selecionar Imagem</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 italic">Valor: R$ {verifyingSlot.price.toFixed(0)}</p>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
