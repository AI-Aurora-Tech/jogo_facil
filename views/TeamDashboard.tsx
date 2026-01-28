
import React, { useState } from 'react';
import { Search, MapPin, Clock, Filter, Tag, Swords, CalendarCheck, CheckCircle2, XCircle, Upload, Loader2, Sparkles, ChevronRight } from 'lucide-react';
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

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ categories, currentUser, fields, slots, onBookSlot, onCancelBooking, viewMode, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [verifyingSlot, setVerifyingSlot] = useState<MatchSlot | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || (slot.hasLocalTeam && slot.opponentTeamName)) return false;
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      const userTeamCats = currentUser.teamCategories || [];
      const gameCategory = slot.bookedByCategory;

      if (gameCategory && gameCategory !== 'Livre') {
        if (!userTeamCats.includes(gameCategory)) return false;
      }
      return true;
    } else {
      return (slot.bookedByUserId === currentUser.id || slot.opponentTeamName === currentUser.teamName) && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleBookingConfirm = async () => {
    if (!selectedSlot) return;
    
    // Se o slot estiver vazio, o time que reserva vira MANDANTE
    if (!selectedSlot.hasLocalTeam && !selectedSlot.bookedByTeamName) {
      await api.updateSlot(selectedSlot.id, {
        bookedByUserId: currentUser.id,
        bookedByTeamName: currentUser.teamName,
        bookedByCategory: currentUser.teamCategories[0],
        status: 'pending_verification'
      });
    } else {
      // Se já tem Mandante, entra como OPONENTE
      await api.updateSlot(selectedSlot.id, {
        opponentTeamName: currentUser.teamName,
        status: 'pending_verification'
      });
    }
    
    setSelectedSlot(null);
    onRefresh();
    alert("Solicitação de reserva enviada! Agora envie o comprovante PIX.");
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
        aiVerificationResult: JSON.stringify(result),
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
            <div key={slot.id} className="bg-white rounded-[2.5rem] overflow-hidden border shadow-sm relative transition-all active:scale-[0.98] hover:border-grass-500">
              {isChallenge && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 z-10">
                    <Swords className="w-3.5 h-3.5 animate-bounce" /> Desafio Aberto
                </div>
              )}
              
              <div className="p-6 flex gap-5">
                  <div className="relative">
                    <img src={field.imageUrl} className="w-24 h-24 rounded-3xl object-cover shadow-inner border" />
                  </div>
                  <div className="flex-1">
                      <h3 className="font-black text-pitch text-xl italic uppercase tracking-tighter leading-none mb-1">{field.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mb-3 flex items-center"><MapPin className="w-3 h-3 mr-1 text-grass-600" /> {field.location}</p>
                      
                      <div className="flex flex-wrap gap-2">
                           <div className="bg-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-[10px] font-black">{slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                           </div>
                           <div className="bg-grass-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-grass-600 border border-grass-100">
                                <Tag className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase">{slot.bookedByCategory || 'Livre'}</span>
                           </div>
                      </div>
                  </div>
              </div>

              <div className="bg-gray-50 p-6 flex items-center justify-between border-t border-dashed">
                  <div>
                      <span className="text-[8px] font-black text-gray-400 uppercase">Investimento</span>
                      <p className="text-2xl font-black text-pitch italic leading-none mt-1">R$ {slot.price.toFixed(0)}</p>
                  </div>
                  {viewMode === 'MY_BOOKINGS' ? (
                      <div className="flex gap-2">
                        {slot.status !== 'confirmed' && !slot.receiptUrl ? (
                            <button onClick={() => setVerifyingSlot(slot)} className="bg-orange-500 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg">Pagar Pix</button>
                        ) : (
                            <div className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 ${slot.status === 'confirmed' ? 'bg-grass-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                {slot.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {slot.status === 'confirmed' ? 'Confirmado' : 'Validando...'}
                            </div>
                        )}
                        <button onClick={() => onCancelBooking(slot.id)} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><XCircle className="w-6 h-6"/></button>
                      </div>
                  ) : (
                      <Button className={`rounded-2xl px-12 py-4 text-xs font-black uppercase shadow-xl ${isChallenge ? 'bg-orange-500' : 'bg-pitch'}`} onClick={() => setSelectedSlot(slot)}>
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
            <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center gap-5 mb-8">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-pitch shadow-xl ${selectedSlot.hasLocalTeam || selectedSlot.bookedByTeamName ? 'bg-orange-500' : 'bg-grass-500'}`}>
                        {selectedSlot.hasLocalTeam || selectedSlot.bookedByTeamName ? <Swords className="w-10 h-10"/> : <CalendarCheck className="w-10 h-10"/>}
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-pitch uppercase tracking-tighter italic leading-none">
                          {selectedSlot.hasLocalTeam || selectedSlot.bookedByTeamName ? 'Desafiar Time' : 'Fazer Reserva'}
                        </h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Você será o {selectedSlot.bookedByTeamName ? 'Desafiante' : 'Mandante'}</p>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-8 rounded-[3rem] border-2 border-gray-100 mb-10 space-y-4">
                    <div className="flex justify-between font-black uppercase text-xs">
                      <span className="text-gray-400">Mandante:</span>
                      <span className="text-pitch">{selectedSlot.localTeamName || selectedSlot.bookedByTeamName || currentUser.teamName}</span>
                    </div>
                    <div className="flex justify-between font-black uppercase text-xs">
                      <span className="text-gray-400">Categoria:</span>
                      <span className="bg-pitch text-white px-3 py-1 rounded-lg text-[10px]">{selectedSlot.bookedByCategory || currentUser.teamCategories[0]}</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-300 uppercase text-[10px] tracking-widest">Voltar</button>
                    <Button className="flex-[2] py-5 rounded-[2.5rem] font-black uppercase shadow-2xl" onClick={handleBookingConfirm}>Confirmar Agora</Button>
                </div>
            </div>
        </div>
      )}

      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/95 z-[200] flex items-end">
             <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500">
                {isAiLoading && <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center p-10"><Loader2 className="w-16 h-16 text-grass-500 animate-spin mb-6"/><h3 className="font-black text-xl italic uppercase">Validando com IA Jogo Fácil...</h3></div>}
                <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-3xl font-black text-pitch uppercase tracking-tighter italic leading-none">Enviar PIX</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Sua reserva será confirmada automaticamente</p>
                    </div>
                    <button onClick={() => setVerifyingSlot(null)} className="p-3 bg-gray-100 rounded-full"><XCircle className="w-8 h-8"/></button>
                </div>
                
                {aiResult ? (
                    <div className="text-center py-10">
                        <div className={`w-24 h-24 rounded-[3rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${aiResult.isValid ? 'bg-grass-500' : 'bg-red-500'} text-white`}>
                            {aiResult.isValid ? <CheckCircle2 className="w-12 h-12"/> : <XCircle className="w-12 h-12"/>}
                        </div>
                        <h4 className="font-black text-pitch text-2xl uppercase italic">{aiResult.isValid ? 'Pagamento Validado!' : 'Pagamento Inválido'}</h4>
                        <p className="text-xs text-gray-500 mt-4 mb-10 font-bold">{aiResult.reason}</p>
                        <Button className="w-full py-6 rounded-[2.5rem] font-black uppercase" onClick={() => { setAiResult(null); setVerifyingSlot(null); }}>Entendido</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-16 rounded-[3.5rem] border-4 border-dashed border-gray-100 text-center relative hover:border-pitch transition-all cursor-pointer group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleReceiptUpload} />
                            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                            <p className="text-pitch font-black uppercase tracking-tighter text-xl italic">Selecionar Comprovante</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">Valor: R$ {verifyingSlot.price.toFixed(0)}</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
      )}
    </div>
  );
};
