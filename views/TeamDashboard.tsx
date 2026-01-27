
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

      const userTeamCats = currentUser.teamCategories || [];
      const gameCategory = slot.bookedByCategory;

      if (gameCategory && gameCategory !== 'Livre') {
        if (!userTeamCats.includes(gameCategory)) return false;
      } else {
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
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase text-gray-400 ml-1">Data</label>
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase text-gray-400 ml-1">Categoria</label>
                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                      <option value="">Todas</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
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
            <div key={slot.id} className="bg-white rounded-[2rem] overflow-hidden border shadow-sm relative transition-all active:scale-[0.98] hover:border-grass-500">
              {isChallenge && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 z-10">
                    <Swords className="w-3.5 h-3.5 animate-bounce" /> Desafio Aberto
                </div>
              )}
              
              <div className="p-5 flex gap-4">
                  <div className="relative">
                    <img src={field.imageUrl} className="w-20 h-20 rounded-2xl object-cover shadow-inner border border-gray-100" />
                    {slot.matchType === 'FIXO' && (
                      <div className="absolute -bottom-1 -right-1 bg-pitch text-white p-1 rounded-lg border-2 border-white shadow-lg">
                        <CalendarDays className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                      <h3 className="font-black text-pitch text-lg truncate leading-tight mb-1">{field.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 mb-3 truncate flex items-center"><MapPin className="w-3 h-3 mr-1 text-grass-600" /> {field.location}</p>
                      
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

              {/* Home Team Info */}
              {(slot.hasLocalTeam || slot.bookedByTeamName) && (
                <div className="px-5 pb-4">
                   <div className="bg-gray-50/50 rounded-2xl p-3 border border-dashed flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 bg-pitch text-grass-500 rounded-xl flex items-center justify-center font-black text-xs">
                            {(slot.localTeamName || slot.bookedByTeamName || 'T').charAt(0)}
                         </div>
                         <div>
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Mandante</span>
                            <span className="text-[10px] font-black text-pitch">{slot.localTeamName || slot.bookedByTeamName}</span>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Categoria</span>
                         <span className="text-[10px] font-black text-grass-600 uppercase">{slot.bookedByCategory || 'Principal'}</span>
                      </div>
                   </div>
                </div>
              )}

              <div className="bg-gray-50 p-5 flex items-center justify-between border-t">
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-gray-400 uppercase">Investimento</span>
                      <span className="text-xl font-black text-pitch italic">R$ {price.toFixed(0)}</span>
                  </div>
                  {viewMode === 'MY_BOOKINGS' ? (
                      <div className="flex gap-2">
                        {slot.status === 'available' && !slot.receiptUrl ? (
                            <button onClick={() => setVerifyingSlot(slot)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Pagar Pix</button>
                        ) : (
                            <div className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 ${slot.status === 'confirmed' ? 'bg-grass-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                {slot.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {slot.status === 'confirmed' ? 'Confirmado' : 'Validando...'}
                            </div>
                        )}
                        <button onClick={() => onCancelBooking(slot.id)} className="p-2.5 text-gray-300 hover:text-red-500 transition-colors"><XCircle className="w-5 h-5"/></button>
                      </div>
                  ) : (
                      <Button className={`rounded-2xl px-10 py-3.5 text-xs font-black uppercase shadow-xl ${isChallenge ? 'bg-orange-500 shadow-orange-500/20 hover:bg-orange-600' : 'bg-pitch'}`} onClick={() => setSelectedSlot(slot)}>
                        {isChallenge ? 'Desafiar' : 'Reservar'}
                      </Button>
                  )}
              </div>
            </div>
          );
        })}
        {filteredSlots.length === 0 && (
          <div className="py-20 text-center">
             <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-300" />
             </div>
             <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest italic">Nenhum desafio encontrado</p>
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[4xl] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl">
                <div className="flex items-center gap-5 mb-8">
                    <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-pitch shadow-lg ${selectedSlot.hasLocalTeam ? 'bg-orange-500' : 'bg-grass-500'}`}>
                        {selectedSlot.hasLocalTeam ? <Swords className="w-10 h-10"/> : <CalendarCheck className="w-10 h-10"/>}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch leading-none italic uppercase tracking-tighter">
                          {selectedSlot.hasLocalTeam ? 'Aceitar Desafio' : 'Reservar Agenda'}
                        </h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 text-orange-500" /> Cancelamentos geram custos.
                        </p>
                    </div>
                </div>
                <div className="bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-100 mb-8 space-y-5">
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span className="text-gray-400">Mandante:</span>
                        <span className="text-pitch">{selectedSlot.localTeamName || currentUser.teamName}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span className="text-gray-400">Desafiante:</span>
                        <span className="text-grass-600">{selectedSlot.hasLocalTeam ? currentUser.teamName : '?'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span className="text-gray-400">Categoria:</span>
                        <span className="bg-pitch text-white px-4 py-1.5 rounded-xl text-[10px]">{selectedSlot.bookedByCategory || currentUser.teamCategories[0]}</span>
                    </div>
                    <div className="border-t border-dashed pt-5 flex justify-between items-center">
                        <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Total a Pagar:</span>
                        <span className="text-3xl font-black text-pitch italic">R$ {(selectedSlot.hasLocalTeam ? (selectedSlot.price / 2) : selectedSlot.price).toFixed(0)}</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-300 uppercase text-[10px] tracking-widest hover:text-red-500 transition-colors">Voltar</button>
                    <Button className={`flex-[2] py-5 rounded-[2.5rem] font-black uppercase tracking-widest shadow-xl shadow-grass-500/20 ${selectedSlot.hasLocalTeam ? 'bg-orange-500 hover:bg-orange-600' : 'bg-pitch'}`} onClick={() => {
                        onBookSlot(selectedSlot.id, { 
                            teamName: currentUser.teamName!, 
                            category: selectedSlot.bookedByCategory || currentUser.teamCategories[0] 
                        });
                        setSelectedSlot(null);
                    }}>Confirmar Reserva</Button>
                </div>
            </div>
        </div>
      )}

      {/* COMPROVANTE MODAL */}
      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/90 z-[200] flex items-end">
             <div className="bg-white w-full rounded-t-[4xl] p-10 animate-in slide-in-from-bottom duration-500">
                {isAiLoading && <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center p-10 backdrop-blur-sm"><Loader2 className="w-16 h-16 text-grass-500 animate-spin mb-6"/><h3 className="font-black text-xl italic uppercase tracking-tighter">Validando com IA Jogo Fácil...</h3></div>}
                <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-pitch uppercase tracking-tighter italic leading-none">Pagar via Pix</h2>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Envie o comprovante para liberação automática</p>
                    </div>
                    <button onClick={() => setVerifyingSlot(null)} className="p-3 bg-gray-100 rounded-full hover:bg-red-50 transition-colors"><XCircle className="w-7 h-7"/></button>
                </div>
                {aiResult ? (
                    <div className="text-center py-10 animate-in zoom-in-95">
                        <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl ${aiResult.isValid ? 'bg-grass-500' : 'bg-red-500'} text-white`}>
                            {aiResult.isValid ? <CheckCircle2 className="w-12 h-12"/> : <AlertCircle className="w-12 h-12"/>}
                        </div>
                        <h4 className="font-black text-pitch text-2xl uppercase tracking-tighter">{aiResult.isValid ? 'Pagamento Enviado!' : 'Problema Detectado'}</h4>
                        <p className="text-xs text-gray-500 mt-3 mb-10 font-bold max-w-xs mx-auto">{aiResult.reason}</p>
                        <Button className="w-full py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl" onClick={() => { setAiResult(null); setVerifyingSlot(null); }}>Entendido</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-16 rounded-[3rem] border-4 border-dashed border-gray-100 text-center relative hover:border-grass-500 hover:bg-grass-50 transition-all cursor-pointer group">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleReceiptUpload} />
                            <div className="relative z-0">
                              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-grass-500" />
                              </div>
                              <p className="text-pitch font-black uppercase tracking-tighter text-xl">Selecionar Comprovante</p>
                              <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest">Valor exato: R$ {verifyingSlot.price.toFixed(0)}</p>
                            </div>
                        </div>
                    </div>
                )}
             </div>
          </div>
      )}
    </div>
  );
};
