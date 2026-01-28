
import React, { useState } from 'react';
import { Search, MapPin, Clock, Tag, Swords, CalendarCheck, CheckCircle2, XCircle, Upload, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User } from '../types';
import { verifyPixReceipt } from '../services/aiService';
import { api } from '../services/api';
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
  const [verifyingSlot, setVerifyingSlot] = useState<MatchSlot | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    // Não pode desafiar se você é o dono da arena
    if (field.ownerId === currentUser.id) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || slot.status === 'confirmed') return false;
      // Se já tem oponente, não aparece na busca
      if (slot.opponentTeamName) return false;
      
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    } else {
      return (slot.bookedByUserId === currentUser.id || slot.opponentTeamName === currentUser.teamName) && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleBookingConfirm = async () => {
    if (!selectedSlot) return;
    
    const isSlotEmpty = !selectedSlot.hasLocalTeam && !selectedSlot.bookedByTeamName;

    if (isSlotEmpty) {
      // Primeiro a entrar vira Mandante
      await api.updateSlot(selectedSlot.id, {
        bookedByUserId: currentUser.id,
        bookedByTeamName: currentUser.teamName,
        bookedByCategory: currentUser.teamCategories[0],
        status: 'pending_verification'
      });
    } else {
      // Já tem alguém, entra como Oponente
      await api.updateSlot(selectedSlot.id, {
        opponentTeamName: currentUser.teamName,
        status: 'pending_verification'
      });
    }
    
    setSelectedSlot(null);
    onRefresh();
    alert("Reserva solicitada! Envie o comprovante na aba 'Meus Jogos'.");
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !verifyingSlot) return;
    setIsAiLoading(true);
    try {
      const field = fields.find(f => f.id === verifyingSlot.fieldId);
      const result = await verifyPixReceipt(file, verifyingSlot.price, field?.pixConfig.name || field?.name || '');
      setAiResult(result);
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
        {filteredSlots.map(slot => {
          const field = fields.find(f => f.id === slot.fieldId);
          if (!field) return null;
          const isChallenge = slot.hasLocalTeam || slot.bookedByTeamName;

          return (
            <div key={slot.id} className="bg-white rounded-[2.5rem] overflow-hidden border shadow-sm transition-all hover:border-grass-500">
              <div className="p-6 flex gap-5">
                  <img src={field.imageUrl} className="w-20 h-20 rounded-3xl object-cover border" />
                  <div className="flex-1">
                      <h3 className="font-black text-pitch text-lg uppercase leading-none">{field.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1" /> {field.location}</p>
                      <div className="flex gap-2 mt-3">
                           <div className="bg-gray-100 px-3 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                           </div>
                           <div className="bg-grass-50 px-3 py-1 rounded-xl text-grass-600 text-[9px] font-black uppercase">
                                {slot.bookedByCategory || 'Aberto'}
                           </div>
                      </div>
                  </div>
              </div>
              <div className="bg-gray-50 p-5 flex items-center justify-between border-t border-dashed">
                  <p className="text-xl font-black text-pitch italic">R$ {slot.price.toFixed(0)}</p>
                  {viewMode === 'MY_BOOKINGS' ? (
                      <div className="flex gap-2">
                        {!slot.receiptUrl && <button onClick={() => setVerifyingSlot(slot)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Pagar Pix</button>}
                        <button onClick={() => onCancelBooking(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><XCircle className="w-6 h-6"/></button>
                      </div>
                  ) : (
                      <Button className={`rounded-2xl px-8 py-3 text-[10px] font-black uppercase ${isChallenge ? 'bg-orange-500' : 'bg-pitch'}`} onClick={() => setSelectedSlot(slot)}>
                        {isChallenge ? 'Desafiar' : 'Reservar'}
                      </Button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[4rem] p-12">
                <div className="flex items-center gap-5 mb-8">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-pitch ${selectedSlot.bookedByTeamName ? 'bg-orange-500' : 'bg-grass-500'}`}>
                        {selectedSlot.bookedByTeamName ? <Swords className="w-10 h-10"/> : <CalendarCheck className="w-10 h-10"/>}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch uppercase tracking-tighter italic">
                          {selectedSlot.bookedByTeamName ? 'Desafiar Time' : 'Ser Mandante'}
                        </h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase mt-1">
                          {selectedSlot.bookedByTeamName ? `Adversário: ${selectedSlot.bookedByTeamName}` : 'Você iniciará o jogo como mandante'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-300 uppercase text-[10px]">Cancelar</button>
                    <Button className="flex-[2] py-5 rounded-[2.5rem] font-black uppercase shadow-2xl" onClick={handleBookingConfirm}>Confirmar</Button>
                </div>
            </div>
        </div>
      )}

      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/95 z-[200] flex items-end">
             <div className="bg-white w-full rounded-t-[4rem] p-12">
                {isAiLoading && <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 text-grass-500 animate-spin mb-4"/><p className="font-black uppercase text-xs">Validando PIX...</p></div>}
                <div className="flex justify-between items-start mb-8">
                    <h2 className="text-2xl font-black text-pitch uppercase italic">Enviar Comprovante</h2>
                    <button onClick={() => setVerifyingSlot(null)} className="p-2 bg-gray-100 rounded-full"><XCircle className="w-6 h-6"/></button>
                </div>
                <div className="bg-gray-50 p-12 rounded-[3.5rem] border-4 border-dashed border-gray-100 text-center relative hover:border-pitch transition-all">
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleReceiptUpload} />
                    <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                    <p className="text-pitch font-black uppercase text-sm">Selecionar Imagem</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-2">Valor: R$ {verifyingSlot.price.toFixed(0)}</p>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
