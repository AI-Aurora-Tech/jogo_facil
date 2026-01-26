
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
  const [radiusFilter, setRadiusFilter] = useState<number>(30);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedBookingCategory, setSelectedBookingCategory] = useState<string>('');
  
  const [verifyingSlot, setVerifyingSlot] = useState<MatchSlot | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr) return false;
      
      // LÓGICA CENTRAL: Todo horário criado pelo dono deve estar disponível se:
      // 1. For aluguel (não reservado)
      // 2. For desafio (time local definido, mas sem oponente)
      const isAvailableForRent = !slot.isBooked && !slot.hasLocalTeam;
      const isOpenChallenge = slot.hasLocalTeam && !slot.opponentTeamName && slot.status !== 'confirmed';
      
      if (!isAvailableForRent && !isOpenChallenge) return false;

      // Filtro de busca por nome da Arena
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // Filtro de distância
      if (userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude);
        if (dist > radiusFilter) return false;
      }

      // RESPEITO À REGRA DA CATEGORIA
      const slotAllowedCats = slot.allowedCategories || [];
      const userTeamCats = currentUser.teamCategories || [];

      // Se o usuário filtrou por categoria específica
      if (categoryFilter) {
        if (!slotAllowedCats.includes(categoryFilter) && !slotAllowedCats.includes('Livre')) return false;
      } else {
        // Filtro automático: Mostrar apenas o que o time do capitão pode jogar
        const isCompatible = slotAllowedCats.some(cat => userTeamCats.includes(cat)) || slotAllowedCats.includes('Livre');
        if (!isCompatible) return false;
      }

      if (dateFilter && slot.date !== dateFilter) return false;
      return true;
    } else {
      // Minhas Reservas (como contratante ou como desafiante)
      return slot.bookedByUserId === currentUser.id && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !verifyingSlot) return;
    setIsAiLoading(true);
    setAiResult(null);
    try {
      const field = fields.find(f => f.id === verifyingSlot.fieldId);
      if (!field) throw new Error("Arena não encontrada");
      const result = await verifyPixReceipt(file, verifyingSlot.price, field.pixConfig.name || field.name);
      setAiResult(result);
      const base64Proof = await convertFileToBase64(file);
      await api.updateSlot(verifyingSlot.id, {
        receiptUrl: base64Proof,
        aiVerificationResult: JSON.stringify(result),
        statusUpdatedAt: new Date().toISOString()
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Falha ao analisar comprovante.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {viewMode === 'EXPLORE' && (
        <div className="p-6 bg-white space-y-4 border-b sticky top-0 z-20 shadow-sm glass">
            <div className="flex items-center gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-grass-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Buscar arena ou desafio..." 
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-grass-500 outline-none font-bold placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`p-3.5 rounded-2xl border transition-all ${showFilters ? 'bg-pitch text-white' : 'bg-white text-gray-400 border-gray-200 hover:border-pitch'}`}>
                    <Filter className="w-6 h-6" />
                </button>
            </div>
            {showFilters && (
              <div className="animate-in slide-in-from-top-4 duration-300 space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Data do Jogo</label>
                        <input type="date" value={dateFilter} min={todayStr} onChange={e => setDateFilter(e.target.value)} className="w-full p-3.5 bg-gray-50 border rounded-2xl text-xs font-bold outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Filtrar Categoria</label>
                        <select className="w-full p-3.5 bg-gray-50 border rounded-2xl text-xs font-bold outline-none appearance-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">Todas do meu perfil</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                  </div>
              </div>
            )}
        </div>
      )}

      <div className="p-6 space-y-6">
        {filteredSlots.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
             <Trophy className="text-gray-200 w-12 h-12 mx-auto mb-4" />
             <p className="text-gray-400 font-black text-sm uppercase px-10">Nenhum horário disponível para o perfil do seu time.</p>
             <p className="text-[10px] text-gray-300 font-bold mt-2">Dica: Tente mudar o dia ou remover filtros.</p>
          </div>
        ) : (
          filteredSlots.map(slot => {
            const field = fields.find(f => f.id === slot.fieldId);
            if (!field) return null;
            const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude) : null;
            const isOwner = field.ownerId === currentUser.id;
            const isChallenge = slot.hasLocalTeam && !slot.opponentTeamName;

            return (
              <div key={slot.id} className={`bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm relative transition-all active:scale-[0.98] ${isChallenge ? 'ring-2 ring-orange-500/10' : ''}`}>
                {isChallenge && (
                    <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 z-10 shadow-sm animate-pulse">
                        <Swords className="w-3.5 h-3.5" /> Desafio Aberto
                    </div>
                )}
                
                <div className="p-5 flex gap-4">
                    <div className="relative shrink-0">
                        <img src={field.imageUrl} className="w-20 h-20 rounded-2xl object-cover shadow-inner" />
                        <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-lg text-[8px] font-black border-2 border-white text-white shadow-md ${isChallenge ? 'bg-orange-600' : 'bg-pitch'}`}>
                            {slot.matchType}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-pitch text-lg truncate leading-tight mb-1">{field.name}</h3>
                        
                        {isChallenge ? (
                            <div className="flex items-center gap-2 mb-3 bg-orange-50 p-2 rounded-xl border border-orange-100 w-fit">
                                <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center text-[10px] text-white font-black shadow-sm">
                                    {slot.localTeamName?.charAt(0)}
                                </div>
                                <span className="text-[10px] font-bold text-orange-800">Time da Casa: <span className="font-black uppercase">{slot.localTeamName}</span></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-gray-400 text-[10px] font-bold mb-3">
                                <MapPin className="w-3 h-3 text-grass-500" /> {field.location}
                            </div>
                        )}
                        
                        <div className="flex gap-2">
                             <div className="bg-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-gray-50">
                                <Clock className="w-3.5 h-3.5 text-pitch" />
                                <span className="text-xs font-black text-pitch">{slot.time}</span>
                             </div>
                             <div className="bg-gray-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-gray-50">
                                <CalendarDays className="w-3.5 h-3.5 text-pitch" />
                                <span className="text-xs font-black text-pitch">{slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                             </div>
                             {slot.allowedCategories && slot.allowedCategories.length > 0 && (
                                <div className="bg-grass-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-grass-100">
                                    <Tag className="w-3.5 h-3.5 text-grass-600" />
                                    <span className="text-[9px] font-black text-grass-600 uppercase">{slot.allowedCategories[0]}</span>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-5 flex items-center justify-between border-t border-gray-100">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Valor do {isChallenge ? 'Desafio' : 'Aluguel'}</span>
                        <span className="text-xl font-black text-pitch">R$ {isChallenge ? (slot.price / 2).toFixed(0) : slot.price}</span>
                    </div>

                    {viewMode === 'MY_BOOKINGS' ? (
                        <div className="flex items-center gap-2">
                            {slot.status === 'pending_verification' && !slot.receiptUrl ? (
                                <Button size="sm" className="rounded-xl px-4 py-2 bg-orange-500 text-[10px] font-black" onClick={() => setVerifyingSlot(slot)}>
                                    ENVIAR PIX
                                </Button>
                            ) : (
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase ${slot.status === 'confirmed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                    {slot.status === 'confirmed' ? 'Confirmado' : 'Validando...'}
                                </div>
                            )}
                            <button onClick={() => onCancelBooking(slot.id)} className="p-2 text-gray-300 hover:text-red-500"><XCircle className="w-5 h-5" /></button>
                        </div>
                    ) : (
                        <Button 
                            className={`rounded-2xl px-8 py-3 text-xs font-black shadow-xl active:scale-95 transition-transform ${isChallenge ? 'bg-orange-500 shadow-orange-500/20' : 'shadow-grass-500/20'}`} 
                            disabled={isOwner}
                            onClick={() => {
                                if (!currentUser.teamName) alert("Finalize seu perfil primeiro!");
                                else {
                                    setSelectedSlot(slot);
                                    setSelectedBookingCategory(currentUser.teamCategories[0] || 'Principal');
                                }
                            }}
                        >
                            {isOwner ? 'Minha Arena' : isChallenge ? 'DESAFIAR' : 'RESERVAR'}
                        </Button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[100] flex items-end animate-in fade-in duration-300">
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500">
                <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
                <div className="flex items-center gap-4 mb-8">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-pitch shadow-lg ${selectedSlot.hasLocalTeam ? 'bg-orange-500' : 'bg-grass-500'}`}>
                        {selectedSlot.hasLocalTeam ? <Swords className="w-8 h-8" /> : <CalendarCheck className="w-8 h-8" />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch leading-none mb-1">{selectedSlot.hasLocalTeam ? 'Confirmar Desafio' : 'Confirmar Reserva'}</h2>
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">
                            {fields.find(f => f.id === selectedSlot.fieldId)?.name} • {selectedSlot.time}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 mb-10">
                    <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-100">
                        {selectedSlot.hasLocalTeam ? (
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-gray-200">
                                <span className="text-sm font-bold text-gray-500">Adversário (Casa):</span>
                                <span className="text-sm font-black text-orange-600 uppercase">{selectedSlot.localTeamName}</span>
                            </div>
                        ) : (
                             <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-gray-200">
                                <span className="text-sm font-bold text-gray-500">Tipo:</span>
                                <span className="text-[10px] font-black text-pitch uppercase bg-white px-3 py-1 rounded-full border">Aluguel de Campo</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-gray-500">Sua Equipe:</span>
                            <span className="text-sm font-black text-pitch uppercase">{currentUser.teamName}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-dashed">
                            <span className="text-sm font-bold text-gray-500">Total a Pagar:</span>
                            <span className="text-2xl font-black text-pitch">R$ {selectedSlot.hasLocalTeam ? (selectedSlot.price / 2).toFixed(0) : selectedSlot.price}</span>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                        <p className="text-[10px] text-blue-800 font-bold leading-relaxed uppercase">
                            Respeitando a categoria <span className="text-pitch">{selectedSlot.allowedCategories?.[0] || 'Livre'}</span>.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-400 uppercase text-xs tracking-widest">Desistir</button>
                    <Button className={`flex-[2] py-5 rounded-[2rem] font-black shadow-xl ${selectedSlot.hasLocalTeam ? 'bg-orange-500' : ''}`} onClick={() => {
                        onBookSlot(selectedSlot.id, { teamName: currentUser.teamName!, category: selectedBookingCategory });
                        setSelectedSlot(null);
                    }}>
                        {selectedSlot.hasLocalTeam ? 'ENTRAR NO JOGO' : 'FECHAR RESERVA'}
                    </Button>
                </div>
            </div>
        </div>
      )}

      {/* Reuso do componente de verificação de comprovante */}
      {verifyingSlot && (
          <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[110] flex items-end">
             <div className="bg-white w-full rounded-t-[3rem] p-10 relative overflow-hidden h-fit">
                {isAiLoading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-10 text-center">
                        <Loader2 className="w-12 h-12 text-grass-500 animate-spin mb-4" />
                        <h3 className="text-xl font-black text-pitch mb-2">IA Verificando Pagamento...</h3>
                        <p className="text-xs text-gray-400 font-bold">Aguarde a validação do seu Pix.</p>
                    </div>
                )}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-pitch">Enviar Comprovante</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Validação instantânea</p>
                    </div>
                    <button onClick={() => setVerifyingSlot(null)} className="p-2 bg-gray-100 rounded-full"><XCircle className="w-6 h-6"/></button>
                </div>
                {aiResult ? (
                    <div className={`p-8 rounded-[2.5rem] text-center mb-8 border-2 ${aiResult.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${aiResult.isValid ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                            {aiResult.isValid ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                        </div>
                        <h4 className="text-xl font-black text-pitch mb-2">{aiResult.isValid ? 'Confirmado!' : 'Houve um Problema'}</h4>
                        <p className="text-sm text-gray-500 font-bold mb-6">{aiResult.reason}</p>
                        <Button className="w-full py-4 rounded-2xl font-black" onClick={() => setVerifyingSlot(null)}>FECHAR</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-10 rounded-[2.5rem] border-2 border-dashed border-gray-200 text-center relative group hover:border-grass-500 transition-colors">
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleReceiptUpload} />
                            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                            <p className="text-pitch font-black">Selecionar Comprovante</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Apenas imagem (JPG/PNG)</p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                            <p className="text-[10px] text-orange-800 font-black uppercase">
                                Valor exato: <span className="text-pitch">R$ {verifyingSlot.price}</span>
                            </p>
                        </div>
                    </div>
                )}
             </div>
          </div>
      )}
    </div>
  );
};
