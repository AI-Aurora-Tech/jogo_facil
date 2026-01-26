
import React, { useState } from 'react';
import { Search, MapPin, Clock, MessageCircle, Filter, Trophy, Calendar, Navigation, CalendarDays, ChevronRight, AlertCircle, Tag, XCircle, CalendarCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User } from '../types';
import { calculateDistance } from '../utils';

interface TeamDashboardProps {
  categories: string[];
  currentUser: User;
  fields: Field[];
  slots: MatchSlot[];
  onBookSlot: (slotId: string, bookingData: { teamName: string, category: string }) => void;
  onCancelBooking: (slotId: string) => void;
  userLocation?: { lat: number, lng: number };
  viewMode: 'EXPLORE' | 'MY_BOOKINGS';
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ categories, currentUser, fields, slots, onBookSlot, onCancelBooking, userLocation, viewMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [radiusFilter, setRadiusFilter] = useState<number>(30);
  // Inicializa o filtro vazio para mostrar tudo que é compatível por padrão
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedBookingCategory, setSelectedBookingCategory] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr) return false;
      if (slot.status !== 'available') return false;
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      if (userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude);
        if (dist > radiusFilter) return false;
      }

      // Lógica de Categoria Corrigida:
      const slotAllowedCats = slot.allowedCategories || [];
      const userTeamCats = currentUser.teamCategories || [];

      if (categoryFilter) {
        // Se houver um filtro manual, o slot deve permitir essa categoria específica ou ser Livre
        if (!slotAllowedCats.includes(categoryFilter) && !slotAllowedCats.includes('Livre')) return false;
      } else {
        // Se não houver filtro, mostra slots que permitem QUALQUER uma das categorias do time do usuário ou sejam Livre
        const isCompatible = slotAllowedCats.some(cat => userTeamCats.includes(cat)) || slotAllowedCats.includes('Livre');
        if (!isCompatible) return false;
      }

      if (dateFilter && slot.date !== dateFilter) return false;
      return true;
    } else {
      return slot.bookedByUserId === currentUser.id && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleWhatsApp = (field: Field, slot: MatchSlot) => {
    const cleanPhone = field.contactPhone.replace(/\D/g, '');
    const allowedText = (slot.allowedCategories || []).join(' ou ');
    const text = `Olá, vi o horário em ${field.name} (${allowedText}) para o dia ${slot.date.split('-').reverse().join('/')} às ${slot.time} no Jogo Fácil.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmBooking = () => {
    if (!selectedSlot || !currentUser.teamName) return;
    const finalCategory = selectedBookingCategory || currentUser.teamCategories[0] || "Principal";
    onBookSlot(selectedSlot.id, { teamName: currentUser.teamName, category: finalCategory });
    const field = fields.find(f => f.id === selectedSlot.fieldId);
    if (field) handleWhatsApp(field, selectedSlot);
    setSelectedSlot(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {viewMode === 'EXPLORE' && (
        <div className="p-5 space-y-4 bg-white shadow-sm border-b sticky top-0 z-10">
            <div className="relative group">
                <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-grass-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Arena, bairro ou cidade..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-grass-500 outline-none font-bold"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border transition-all shrink-0 ${showFilters ? 'bg-pitch text-white border-pitch' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                    <Filter className="w-3.5 h-3.5" /> FILTROS {(categoryFilter || dateFilter) && "•"}
                </button>
                {categoryFilter && (
                    <button onClick={() => setCategoryFilter('')} className="bg-grass-100 text-grass-700 px-3 py-2 rounded-xl text-xs font-black border border-grass-200 shrink-0 flex items-center gap-1">
                        {categoryFilter} <XCircle className="w-3 h-3 opacity-50" />
                    </button>
                )}
                {dateFilter && (
                    <button onClick={() => setDateFilter('')} className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-black border border-blue-200 shrink-0 flex items-center gap-1">
                        {dateFilter.split('-').reverse().join('/')} <XCircle className="w-3 h-3 opacity-50" />
                    </button>
                )}
                {!categoryFilter && !dateFilter && currentUser.teamCategories.length > 0 && (
                  <div className="px-3 py-2 rounded-xl text-[10px] font-black text-gray-400 uppercase bg-gray-50 border border-gray-100 shrink-0">
                    Filtro Automático: {currentUser.teamCategories.join(' / ')}
                  </div>
                )}
            </div>

            {showFilters && (
              <div className="pt-2 animate-in slide-in-from-top duration-200 space-y-4 border-t mt-2">
                  <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Data do Jogo</label>
                        <input type="date" value={dateFilter} min={todayStr} onChange={e => setDateFilter(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Categoria</label>
                        <select className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold outline-none appearance-none" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">Todas (Compatíveis)</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Distância: {radiusFilter}km</label>
                        <input type="range" min="5" max="100" step="5" value={radiusFilter} onChange={e => setRadiusFilter(Number(e.target.value))} className="w-full accent-pitch" />
                      </div>
                  </div>
              </div>
            )}
        </div>
      )}

      <div className="p-5 space-y-5">
        {filteredSlots.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-gray-200">
             <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="text-gray-200 w-10 h-10" />
             </div>
             <p className="text-gray-400 font-black text-sm px-10 uppercase tracking-tight">
                Nenhum horário disponível para {categoryFilter || currentUser.teamCategories.join(' ou ')}
             </p>
             <button onClick={() => { setCategoryFilter(''); setDateFilter(''); setSearchTerm(''); }} className="mt-4 text-grass-600 font-bold text-xs underline">Limpar todos os filtros</button>
          </div>
        ) : (
          filteredSlots.map(slot => {
            const field = fields.find(f => f.id === slot.fieldId);
            if (!field) return null;
            const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude) : null;
            const isOwner = field.ownerId === currentUser.id;
            const slotCats = slot.allowedCategories || [];

            return (
              <div key={slot.id} className="bg-white rounded-[2.5rem] p-5 shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden group">
                <div className="flex gap-4">
                    <div className="relative shrink-0">
                        <img src={field.imageUrl} className="w-24 h-24 rounded-3xl object-cover" />
                        <div className="absolute -bottom-2 -right-2 bg-pitch text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-xl border-2 border-white uppercase">
                            {slot.matchType}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                             {slotCats.map(cat => (
                               <div key={cat} className={`text-pitch text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${cat === 'Livre' ? 'bg-gray-200' : 'bg-grass-500'}`}>
                                  {cat}
                               </div>
                             ))}
                             {distance !== null && <span className="text-[9px] font-black text-grass-600 ml-auto">{distance}km</span>}
                        </div>
                        <h3 className="font-black text-pitch text-lg truncate leading-none mb-2">{field.name}</h3>
                        <div className="flex items-center gap-1 text-gray-400 text-[10px] font-bold mb-3 truncate">
                            <MapPin className="w-3 h-3 text-gray-300" />
                            {field.location}
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <div className="bg-gray-50 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-gray-100">
                                <Clock className="w-3.5 h-3.5 text-pitch" />
                                <span className="text-xs font-black text-pitch">{slot.time}</span>
                             </div>
                             <div className="bg-gray-50 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-gray-100">
                                <CalendarDays className="w-3.5 h-3.5 text-pitch" />
                                <span className="text-xs font-black text-pitch">{slot.date.split('-').reverse().slice(0,2).join('/')}</span>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 -mx-5 -mb-5 p-5 mt-2 border-t border-gray-100">
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase mr-1">R$</span>
                        <span className="text-2xl font-black text-pitch">{slot.price}</span>
                    </div>
                    
                    {viewMode === 'MY_BOOKINGS' ? (
                        <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border shadow-sm ${slot.status === 'confirmed' ? 'bg-green-500 text-white border-green-600' : 'bg-orange-400 text-white border-orange-500'}`}>
                                {slot.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                            </span>
                            <button onClick={() => onCancelBooking(slot.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <Button 
                            className="rounded-[1.5rem] px-8 py-3.5 text-xs font-black shadow-lg shadow-grass-500/20 active:scale-95 transition-transform" 
                            disabled={isOwner}
                            onClick={() => {
                                if (!currentUser.teamName) {
                                    alert("Por favor, cadastre o nome do seu time no Perfil antes de agendar!");
                                } else {
                                    setSelectedSlot(slot);
                                    // Tenta encontrar uma categoria compatível entre o time e o slot
                                    const userMatch = currentUser.teamCategories.find(c => slotCats.includes(c));
                                    setSelectedBookingCategory(userMatch || currentUser.teamCategories[0] || '');
                                }
                            }}
                        >
                            {isOwner ? 'Minha Arena' : 'AGENDAR AGORA'}
                        </Button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[200] flex items-end">
            <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl">
                <div className="w-16 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-grass-500 rounded-3xl flex items-center justify-center text-pitch shadow-lg">
                        <CalendarCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-pitch">Confirmar Jogo</h2>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                            {fields.find(f => f.id === selectedSlot.fieldId)?.name} • {selectedSlot.time}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 mb-10">
                    <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-tighter">Seu Time (Visitante)</label>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-pitch rounded-2xl flex items-center justify-center text-white font-black text-xl">
                                {currentUser.teamName?.charAt(0)}
                            </div>
                            <span className="text-xl font-black text-pitch">{currentUser.teamName}</span>
                        </div>
                    </div>

                    {currentUser.teamCategories.length > 1 && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase block tracking-tighter">Representando qual categoria?</label>
                            <div className="flex flex-wrap gap-2">
                                {currentUser.teamCategories.map(cat => {
                                    const isAllowedInSlot = selectedSlot.allowedCategories.includes(cat) || selectedSlot.allowedCategories.includes('Livre');
                                    return (
                                        <button 
                                            key={cat}
                                            disabled={!isAllowedInSlot}
                                            onClick={() => setSelectedBookingCategory(cat)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${selectedBookingCategory === cat ? 'bg-grass-500 border-grass-500 text-pitch' : isAllowedInSlot ? 'bg-white text-gray-400 border-gray-200' : 'bg-gray-50 text-gray-200 border-gray-100 opacity-50 cursor-not-allowed'}`}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 p-5 rounded-2xl flex gap-4 items-start border border-blue-100">
                        <MessageCircle className="w-6 h-6 text-blue-600 shrink-0" />
                        <p className="text-xs text-blue-800 font-bold leading-relaxed">
                            Ao confirmar, abriremos o WhatsApp do campo para você enviar o comprovante de pagamento.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-5 font-black text-gray-400 uppercase text-xs tracking-widest">Desistir</button>
                    <Button className="flex-[2] py-5 rounded-[2rem] text-sm font-black shadow-xl" onClick={handleConfirmBooking}>CONFIRMAR E ENVIAR PIX</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
