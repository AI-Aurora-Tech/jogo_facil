
import React, { useState } from 'react';
import { Search, MapPin, Clock, MessageCircle, Filter, Trophy, Calendar, Navigation, CalendarDays, ChevronRight, AlertCircle, Tag, XCircle, CalendarCheck, Swords, Users, Upload, FileText, CheckCircle2, Loader2, Sparkles, Navigation2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User } from '../types';
import { calculateDistance, convertFileToBase64 } from '../utils';
import { verifyPixReceipt } from '../services/aiService';
import { api } from '../services/api';

interface TeamDashboardProps {
  categories: string[];
  currentUser: User;
  fields: Field[];
  slots: MatchSlot[];
  onBookSlot: (slotId: string, bookingData: { teamName: string, category: string }) => void;
  onCancelBooking: (slotId: string) => void;
  userLocation?: { lat: number, lng: number };
  viewMode: 'EXPLORE' | 'MY_BOOKINGS';
  onRefresh: () => void;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ categories, currentUser, fields, slots, onBookSlot, onCancelBooking, userLocation, viewMode, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  
  const [verifyingSlot, setVerifyingSlot] = useState<MatchSlot | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || slot.isBooked) return false;
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (dateFilter && slot.date !== dateFilter) return false;

      // REGRA DE OURO: Mandante define a categoria
      const userTeamCats = currentUser.teamCategories || [];
      const gameCategory = slot.bookedByCategory;

      if (gameCategory && gameCategory !== 'Livre') {
        // Horário já tem um mandante, só pode desafiar se for da mesma categoria
        if (!userTeamCats.includes(gameCategory)) return false;
      } else {
        // Horário vazio, pode reservar se o time do usuário for de uma das categorias permitidas na arena
        const isAllowed = slot.allowedCategories.some(c => userTeamCats.includes(c)) || slot.allowedCategories.includes('Livre');
        if (!isAllowed) return false;
      }

      if (categoryFilter && slot.bookedByCategory !== categoryFilter && !slot.allowedCategories.includes(categoryFilter)) return false;
      return true;
    } else {
      return (slot.bookedByUserId === currentUser.id || slot.opponentTeamName === currentUser.teamName) && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

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
        <div className="p-6 bg-white space-y-4 border-b sticky top-0 z-20 glass">
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder="Buscar arena ou desafio..." className="w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-2xl outline-none font-bold text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`p-3.5 rounded-2xl border transition-all ${showFilters ? 'bg-pitch text-white' : 'bg-white text-gray-400'}`}><Filter className="w-5 h-5" /></button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-4 duration-300">
                  <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black" />
                  <select className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="">Todas Categorias</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
            )}
        </div>
      )}

      <div className="p-6 space-y-6">
        {filteredSlots.map(slot => {
          const field = fields.find(f => f.id === slot.fieldId);
          if (!field) return null;
          const isChallenge = slot.hasLocalTeam && !slot.opponentTeamName;
          const price = isChallenge ? slot.price / 2 : slot.price;

          return (
            <div key={slot.id} className="bg-white rounded-[2rem] overflow-hidden border shadow-sm relative transition-all active:scale-[0.98]">
              {isChallenge && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 z-10 animate-pulse">
                    <Swords className="w-3.5 h-3.5" /> Desafio Aberto
                </div>
              )}
              
              <div className="p-5 flex gap-4">
                  <img src={field.imageUrl} className="w-20 h-20 rounded-2xl object-cover shadow-inner" />
                  <div className="flex-1 min-w-0">
                      <h3 className="font-black text-pitch text-lg truncate leading-tight mb-1">{field.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mb-3 truncate"><MapPin className="w-3 h-3 inline mr-1" /> {field.location}</p>
                      
                      <div className="flex flex-wrap gap-2">
                           <div className="bg-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-black">{slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                           </div>
                           <div className="bg-grass-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-grass-600 border border-grass-100">
                                <Tag className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase">{slot.bookedByCategory || slot.allowedCategories[0]}</span>
                           </div>
                      </div>
                  </div>
              </div>

              <div className="bg-gray-50 p-5 flex items-center justify-between border-t">
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-gray-400 uppercase">A Pagar</span>
                      <span className="text-xl font-black text-pitch italic">R$ {price}</span>
                  </div>
                  {viewMode === 'MY_BOOKINGS' ? (
                      <div className="flex gap-2">
                        {slot.status === 'available' && !slot.receiptUrl ? (
                            <button onClick={() => setVerifyingSlot(slot)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Pagar Pix</button>
                        ) : (
                            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${slot.status === 'confirmed' ? 'bg-grass-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                {slot.status === 'confirmed' ? 'Confirmado' : 'Validando...'}
                            </div>
                        )}
                        <button onClick={() => onCancelBooking(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><XCircle className="w-5 h-5"/></button>
                      </div>
                  ) : (
                      <Button className={`rounded-2xl px-8 py-3 text-xs font-black uppercase ${isChallenge ? 'bg-orange-500 shadow-orange-500/20' : ''}`} onClick={() => setSelectedSlot(slot)}>
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
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500">
                <div className="flex items-center gap-4 mb-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-pitch ${selectedSlot.hasLocalTeam ? 'bg-orange-500' : 'bg-grass-500'}`}>
                        {selectedSlot.hasLocalTeam ? <Swords className="w-8 h-8"/> : <CalendarCheck className="w-8 h-8"/>}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch leading-none">{selectedSlot.hasLocalTeam ? 'Confirmar Desafio' : 'Reservar Horário'}</h2>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">CUIDADO: Cancelamento em cima da hora gera multa.</p>
                    </div>
                </div>
                <div className="bg-gray-50 p-6 rounded-[2.5rem] border mb-8 space-y-4">
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span className="text-gray-400">Time Mandante:</span>
                        <span className="text-pitch">{selectedSlot.localTeamName || currentUser.teamName}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span className="text-gray-400">Categoria:</span>
                        <span className="bg-pitch text-white px-3 py-1 rounded-full text-[10px]">{selectedSlot.bookedByCategory || currentUser.teamCategories[0]}</span>
                    </div>
                    <div className="border-t border-dashed pt-4 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-400">Total:</span>
                        <span className="text-2xl font-black text-pitch italic">R$ {selectedSlot.hasLocalTeam ? (selectedSlot.price / 2).toFixed(0) : selectedSlot.price}</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-300 uppercase text-xs tracking-widest">Desistir</button>
                    <Button className={`flex-[2] py-5 rounded-[2.5rem] font-black ${selectedSlot.hasLocalTeam ? 'bg-orange-500' : ''}`} onClick={() => {
                        onBookSlot(selectedSlot.id, { 
                            teamName: currentUser.teamName!, 
                            category: selectedSlot.bookedByCategory || currentUser.teamCategories[0] 
                        });
                        setSelectedSlot(null);
                    }}>Confirmar e Ir para Pagamento</Button>
                </div>
            </div>
        </div>
      )}

      {/* COMPROVANTE MODAL */}
      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/90 z-[200] flex items-end">
             <div className="bg-white w-full rounded-t-[3rem] p-10">
                {isAiLoading && <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center p-10"><Loader2 className="w-12 h-12 text-grass-500 animate-spin mb-4"/><h3 className="font-black">Verificando com IA...</h3></div>}
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-black text-pitch uppercase tracking-tighter italic">Pagar via Pix</h2>
                    <button onClick={() => setVerifyingSlot(null)} className="p-2 bg-gray-100 rounded-full"><XCircle className="w-6 h-6"/></button>
                </div>
                {aiResult ? (
                    <div className="text-center py-8">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${aiResult.isValid ? 'bg-grass-500' : 'bg-red-500'} text-white`}>
                            {aiResult.isValid ? <CheckCircle2 className="w-10 h-10"/> : <AlertCircle className="w-10 h-10"/>}
                        </div>
                        <h4 className="font-black text-pitch text-xl">{aiResult.isValid ? 'Pagamento Enviado!' : 'Problema no Comprovante'}</h4>
                        <p className="text-xs text-gray-500 mt-2 mb-8">{aiResult.reason}</p>
                        <Button className="w-full py-5 rounded-2xl font-black" onClick={() => setVerifyingSlot(null)}>Entendido</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-10 rounded-[2.5rem] border-2 border-dashed border-gray-200 text-center relative hover:border-grass-500 transition-colors">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleReceiptUpload} />
                            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-pitch font-black">Enviar Comprovante de R$ {verifyingSlot.price}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">IA validará em segundos</p>
                        </div>
                    </div>
                )}
             </div>
          </div>
      )}
    </div>
  );
};
