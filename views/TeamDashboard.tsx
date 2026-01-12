
import React, { useState } from 'react';
import { Search, MapPin, Clock, MessageCircle, Filter, Trophy, Users, CalendarCheck, Phone, Navigation, ExternalLink, XCircle, Share2, DollarSign } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User, SubTeam, COMMON_CATEGORIES } from '../types';
import { calculateDistance } from '../utils';

interface TeamDashboardProps {
  currentUser: User;
  fields: Field[];
  slots: MatchSlot[];
  onBookSlot: (slotId: string, team: SubTeam) => void;
  onCancelBooking: (slotId: string) => void;
  userLocation?: { lat: number, lng: number };
  viewMode: 'EXPLORE' | 'MY_BOOKINGS';
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentUser, fields, slots, onBookSlot, onCancelBooking, userLocation, viewMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [radiusFilter, setRadiusFilter] = useState<number>(30);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr) return false;
      if (slot.status !== 'available') return false;
      if (slot.bookedByUserId === 'DELETED') return false;

      const field = fields.find(f => f.id === slot.fieldId);
      if (!field) return false;
      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      if (userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude);
        if (dist > radiusFilter) return false;
      }
      if (categoryFilter && !slot.allowedCategories.includes(categoryFilter) && !slot.allowedCategories.includes('Livre')) return false;
      return true;
    } else {
      return slot.bookedByUserId === currentUser.id && slot.date >= todayStr;
    }
  }).sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleWhatsApp = (field: Field, slot: MatchSlot) => {
    const cleanPhone = field.contactPhone.replace(/\D/g, '');
    const text = `Olá, estou no Jogo Fácil. Vi o horário em ${field.name} para o dia ${slot.date.split('-').reverse().join('/')} às ${slot.time}.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {viewMode === 'EXPLORE' && (
        <div className="p-5 space-y-4 bg-white shadow-sm border-b sticky top-0 z-10">
            <div className="relative group">
                <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-grass-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Buscar arena ou quadra..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-grass-500 outline-none font-medium"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center justify-between">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${showFilters ? 'bg-grass-50 text-grass-700 border-grass-200' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                    <Filter className="w-4 h-4" /> Filtros
                </button>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                   <Navigation className="w-3 h-3 text-grass-500" />
                   {userLocation ? 'Perto de você' : 'Ative o GPS'}
                </div>
            </div>

            {showFilters && (
              <div className="pt-2 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Raio: {radiusFilter}km</label>
                        <input type="range" min="5" max="100" step="5" value={radiusFilter} onChange={e => setRadiusFilter(Number(e.target.value))} className="w-full accent-grass-500" />
                      </div>
                      <div className="col-span-2">
                        <select className="w-full p-3 bg-gray-100 border-none rounded-xl text-sm font-semibold" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">Todas Categorias</option>
                            {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                  </div>
              </div>
            )}
        </div>
      )}

      {viewMode === 'MY_BOOKINGS' && (
        <div className="p-5 border-b bg-white">
            <h1 className="text-2xl font-black text-pitch">Meus Agendamentos</h1>
            <p className="text-gray-500 text-sm">Acompanhe suas partidas confirmadas e pendentes.</p>
        </div>
      )}

      <div className="p-5 space-y-4">
        {filteredSlots.length === 0 ? (
          <div className="text-center py-20">
             <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-400 w-8 h-8" />
             </div>
             <p className="text-gray-500 font-medium">Nenhum jogo encontrado para hoje em diante.</p>
          </div>
        ) : (
          filteredSlots.map(slot => {
            const field = fields.find(f => f.id === slot.fieldId);
            if (!field) return null;
            const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude) : null;
            const isOwner = field.ownerId === currentUser.id;

            return (
              <div key={slot.id} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4 active:scale-[0.98] transition-transform">
                <div className="flex gap-4">
                    <div className="relative">
                        <img src={field.imageUrl} className="w-20 h-20 rounded-2xl object-cover" />
                        <span className="absolute -top-2 -right-2 bg-grass-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg border-2 border-white">
                            {slot.matchType}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-pitch text-lg truncate">{field.name}</h3>
                        <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{field.location}</span>
                            {distance !== null && <span className="text-grass-600 font-bold ml-1">({distance}km)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-600" />
                                <span className="text-xs font-bold text-gray-600">{slot.time}</span>
                             </div>
                             <div className="bg-gray-100 px-2 py-1 rounded-lg">
                                <span className="text-xs font-bold text-gray-600">{slot.date.split('-').reverse().join('/')}</span>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <div className="flex items-center gap-1 text-grass-700 font-black text-xl">
                        <span className="text-xs font-normal text-gray-400 self-center mr-1">R$</span>
                        {slot.price}
                    </div>
                    <div className="flex gap-2">
                         {viewMode === 'MY_BOOKINGS' ? (
                             <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${slot.status === 'confirmed' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                    {slot.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                                </span>
                                <button onClick={() => onCancelBooking(slot.id)} className="text-[10px] text-red-500 font-bold underline">Cancelar</button>
                             </div>
                         ) : (
                             <Button 
                                size="sm" 
                                className="rounded-xl px-6" 
                                disabled={isOwner}
                                onClick={() => setSelectedSlot(slot)}
                            >
                                {isOwner ? 'Meu Campo' : 'Agendar'}
                             </Button>
                         )}
                    </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Booking Modal Redesigned for Mobile */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/90 backdrop-blur-md z-[100] flex items-end">
            <div className="bg-white w-full rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300 pb-safe">
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
                <h2 className="text-2xl font-black text-pitch mb-2">Confirmar Reserva</h2>
                <p className="text-gray-500 text-sm mb-6">Arena {fields.find(f => f.id === selectedSlot.fieldId)?.name} às {selectedSlot.time}</p>
                
                <div className="space-y-4 mb-8">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Time Pagante</label>
                        <select className="w-full p-4 bg-gray-50 border-none rounded-2xl text-lg font-bold outline-none" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                            <option value="">Escolha seu time</option>
                            {currentUser.subTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                        <MessageCircle className="w-5 h-5 text-blue-500 shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed">Você será levado ao WhatsApp do campo para enviar o PIX após confirmar.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setSelectedSlot(null)} className="flex-1 py-4 font-bold text-gray-400">Voltar</button>
                    <Button className="flex-[2] py-4 rounded-2xl text-lg" disabled={!selectedTeamId} onClick={() => {
                        const team = currentUser.subTeams.find(t => t.id === selectedTeamId);
                        if (team) {
                            onBookSlot(selectedSlot.id, team);
                            const field = fields.find(f => f.id === selectedSlot.fieldId);
                            if (field) handleWhatsApp(field, selectedSlot);
                        }
                        setSelectedSlot(null);
                    }}>Confirmar</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
