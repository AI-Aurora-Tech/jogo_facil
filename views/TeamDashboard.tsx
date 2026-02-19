
import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Clock, Swords, Filter, X, Check, MessageCircle, Phone, Navigation, Trophy, ChevronDown, Smartphone, Settings, AlertTriangle, ExternalLink, Activity, History as HistoryIcon, CalendarCheck, CalendarX, Locate, MapPinOff, Calendar, RotateCcw, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User, CATEGORY_ORDER, SPORTS, Gender } from '../types';
import { api } from '../api';
import { calculateDistance, getCurrentPosition, formatDistance, LatLng, getNeighboringCategories, geocodeAddress } from '../utils';

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

type SortOption = 'DISTANCE_ASC' | 'DISTANCE_DESC' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME_ASC' | 'NAME_DESC';

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentUser, fields, slots, viewMode, onRefresh, onCancelBooking }) => {
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Estado de GPS e Distâncias
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [fieldDistances, setFieldDistances] = useState<Record<string, number>>({});
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  // Filtros
  const [filterRange, setFilterRange] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  // Padrão 100km conforme solicitado pelo usuário
  const [filterMaxDistance, setFilterMaxDistance] = useState<number | ''>(100); 
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('DISTANCE_ASC');
  
  const [myGamesSubTab, setMyGamesSubTab] = useState<'FUTUROS' | 'HISTORICO'>('FUTUROS');

  // Ao montar ou mudar fields, tenta calcular distâncias se já tiver userCoords
  useEffect(() => {
    if (userCoords) {
      calculateAllDistances(userCoords);
    }
  }, [userCoords, fields]);

  const activateGPS = async () => {
    setIsCalculatingDistances(true);
    setGpsError(false);
    try {
      const coords = await getCurrentPosition();
      setUserCoords(coords);
    } catch (error: any) {
      console.error(error);
      setGpsError(true);
      alert("Não foi possível obter sua localização. Verifique as permissões do navegador.");
      setIsCalculatingDistances(false);
    }
  };

  const calculateAllDistances = async (origin: LatLng) => {
    setIsCalculatingDistances(true);
    const newDistances: Record<string, number> = {};
    const uniqueFieldIds: string[] = Array.from(new Set(slots.map(s => s.fieldId)));
    
    for (const fieldId of uniqueFieldIds) {
      const field = fields.find(f => f.id === fieldId);
      if (!field) continue;

      let lat = field.latitude;
      let lng = field.longitude;

      if ((!lat || !lng || (Math.abs(lat) < 0.0001)) && field.location && field.location.length > 5) {
         try {
            const geo = await geocodeAddress(field.location);
            if (geo) {
              lat = geo.lat;
              lng = geo.lng;
            }
         } catch (e) {
           console.warn(`Falha ao geocodificar ${field.name}`);
         }
      }

      if (lat && lng && Math.abs(lat) > 0.0001) {
        const dist = calculateDistance(origin.lat, origin.lng, lat, lng);
        if (dist >= 0) {
          newDistances[fieldId] = dist;
        }
      }
    }

    setFieldDistances(prev => ({ ...prev, ...newDistances }));
    setIsCalculatingDistances(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const userAllCategories = currentUser.teams?.flatMap(t => t.categories) || [];
  const myTeamsNames = currentUser.teams?.map(t => t.name.toLowerCase()) || [];

  const processedSlots = useMemo(() => {
    let result = slots.filter(slot => {
      const field = fields.find(f => f.id === slot.fieldId);
      if (!field) return false;

      if (searchQuery && !field.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterSport && slot.sport !== filterSport) return false;
      if (filterCategory) {
          const baseCat = slot.localTeamCategory || slot.bookedByTeamCategory;
          if (baseCat && baseCat !== filterCategory) return false;
      }

      if (filterRange === 'SPECIFIC') {
          if (filterDate && slot.date !== filterDate) return false;
      } else if (filterRange === 'TODAY') {
          if (slot.date !== todayStr) return false;
      } else if (filterRange === 'TOMORROW') {
          if (slot.date !== tomorrowStr) return false;
      } else if (filterRange === '7DAYS') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 7);
          const limitStr = limit.toISOString().split('T')[0];
          if (slot.date < todayStr || slot.date > limitStr) return false;
      } else if (filterRange === '15DAYS') {
          const limit = new Date();
          limit.setDate(limit.getDate() + 15);
          const limitStr = limit.toISOString().split('T')[0];
          if (slot.date < todayStr || slot.date > limitStr) return false;
      }

      if (filterMaxDistance !== '') {
        const dist = fieldDistances[field.id as string];
        if (dist !== undefined && (dist / 1000) > Number(filterMaxDistance)) return false;
      }

      if (viewMode === 'EXPLORE') {
        if (slot.date < todayStr) return false;
        if (field.ownerId === currentUser.id) return false;
        const hasFirstTeam = (slot.bookedByTeamName || slot.hasLocalTeam);
        const hasOpponent = !!slot.opponentTeamName;
        if (hasFirstTeam && hasOpponent) return false;
        const isAwaitingAdversary = hasFirstTeam && !hasOpponent;
        const isFullyAvailable = slot.status === 'available' && !hasFirstTeam;
        if (!isAwaitingAdversary && !isFullyAvailable) return false;
        const allowedCats = slot.allowedOpponentCategories || [];
        const baseCategory = slot.localTeamCategory || slot.bookedByTeamCategory;
        if (baseCategory || allowedCats.length > 0) {
            const canMatch = userAllCategories.some(cat => allowedCats.includes(cat) || cat === baseCategory);
            if (!canMatch) return false;
        }
      } else {
        const isMyTeamInSlot = (slot.bookedByTeamName && myTeamsNames.includes(slot.bookedByTeamName.toLowerCase())) ||
                               (slot.opponentTeamName && myTeamsNames.includes(slot.opponentTeamName.toLowerCase()));
        const isMyBooking = slot.bookedByUserId === currentUser.id || isMyTeamInSlot;
        if (!isMyBooking) return false;
        if (myGamesSubTab === 'FUTUROS' && slot.date < todayStr) return false;
        if (myGamesSubTab === 'HISTORICO' && slot.date >= todayStr) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const distA = fieldDistances[a.fieldId] ?? 99999999;
      const distB = fieldDistances[b.fieldId] ?? 99999999;

      switch (sortBy) {
        case 'PRICE_ASC': return a.price - b.price;
        case 'PRICE_DESC': return b.price - a.price;
        case 'DISTANCE_ASC': return distA - distB;
        case 'DISTANCE_DESC': return distB - distA;
        default: return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      }
    });

    return result;
  }, [slots, fields, searchQuery, filterSport, filterCategory, filterRange, filterDate, filterMaxDistance, sortBy, viewMode, myGamesSubTab, userAllCategories, currentUser, fieldDistances]);

  const getStatusBadge = (slot: MatchSlot) => {
    if (slot.status === 'confirmed') {
       if (slot.opponentTeamName) return { label: 'JOGO CONFIRMADO', color: 'bg-grass-500 text-white', icon: <CalendarCheck className="w-3 h-3"/> };
       return { label: 'AGUARDANDO ADVERSÁRIO', color: 'bg-yellow-100 text-yellow-700 font-bold', icon: <Swords className="w-3 h-3"/> };
    }
    if (slot.status === 'pending_verification') return { label: 'PENDENTE', color: 'bg-orange-100 text-orange-600', icon: <Clock className="w-3 h-3"/> };
    return { label: 'DISPONÍVEL', color: 'bg-gray-100 text-gray-500', icon: <Clock className="w-3 h-3"/> };
  };

  const handleOpenMap = (location: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
  };

  const handleBookingConfirm = async () => {
    if (!selectedSlot || !selectedCategory) return;
    const team = currentUser.teams[selectedTeamIdx];
    const field = fields.find(f => f.id === selectedSlot.fieldId);
    
    try {
      const isFirstTeam = !selectedSlot.bookedByTeamName && !selectedSlot.hasLocalTeam;
      const updateData: any = {
        bookedByUserId: currentUser.id,
        status: 'pending_verification'
      };

      if (isFirstTeam) {
          updateData.bookedByTeamName = team.name;
          updateData.bookedByTeamCategory = selectedCategory;
          updateData.bookedByUserPhone = currentUser.phoneNumber;
          updateData.bookedByTeamLogoUrl = team.logoUrl;
          updateData.allowedOpponentCategories = getNeighboringCategories(selectedCategory);
      } else {
          updateData.opponentTeamName = team.name;
          updateData.opponentTeamCategory = selectedCategory;
          updateData.opponentTeamPhone = currentUser.phoneNumber;
          updateData.opponentTeamLogoUrl = team.logoUrl;
          updateData.opponentTeamGender = team.gender;
      }

      await api.updateSlot(selectedSlot.id, updateData);
      if (field) {
        await api.createNotification({
          userId: field.ownerId,
          title: "Novo Agendamento! ⚽",
          description: `O time ${team.name} quer jogar no dia ${selectedSlot.date.split('-').reverse().join('/')} às ${selectedSlot.time}.`,
          type: 'info'
        });
      }
      setSelectedSlot(null);
      onRefresh();
      alert("Solicitação enviada!");
    } catch (e) { 
      alert("Erro ao solicitar."); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      {viewMode === 'EXPLORE' ? (
        <div className="bg-white border-b p-4 sticky top-0 z-30 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-pitch" />
                <span className="text-xs font-black uppercase text-pitch">Explorar Arenas</span>
             </div>
             <div className="flex gap-2">
                <button onClick={activateGPS} className={`text-[10px] font-black uppercase flex items-center gap-1 p-2 rounded-lg transition-all ${userCoords ? 'bg-grass-100 text-grass-700' : 'bg-gray-100 text-gray-500'}`}>
                   <Locate className={`w-3 h-3 ${isCalculatingDistances ? 'animate-spin' : ''}`} />
                   {userCoords ? 'Localizado' : 'GPS'}
                </button>
                <button onClick={() => setShowFilters(!showFilters)} className="text-[10px] font-black uppercase text-pitch flex items-center gap-1 p-2 bg-gray-100 rounded-lg active:scale-95">
                   <Filter className="w-3 h-3" /> Filtros
                </button>
             </div>
          </div>
          
          {showFilters && (
            <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 bg-gray-50 p-4 rounded-2xl border">
               <input placeholder="Nome da Arena..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white p-3 rounded-xl border font-bold text-[10px] uppercase outline-none" />
               <div className="grid grid-cols-2 gap-2">
                   <div className="bg-white p-3 rounded-xl border flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <select value={filterMaxDistance} onChange={e => setFilterMaxDistance(e.target.value === '' ? '' : Number(e.target.value))} className="bg-transparent w-full font-bold text-[10px] uppercase outline-none">
                         <option value="">Raio: Todos</option>
                         <option value="5">Até 5 km</option>
                         <option value="20">Até 20 km</option>
                         <option value="50">Até 50 km</option>
                         <option value="100">Até 100 km</option>
                         <option value="250">Até 250 km</option>
                      </select>
                   </div>
                   <div className="bg-white p-3 rounded-xl border flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-gray-400" />
                      <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)} className="bg-transparent w-full font-bold text-[10px] uppercase outline-none">
                         <option value="DISTANCE_ASC">Mais Próximos</option>
                         <option value="PRICE_ASC">Menor Preço</option>
                         <option value="NAME_ASC">A - Z</option>
                      </select>
                   </div>
               </div>
               <button onClick={() => { setSearchQuery(''); setFilterMaxDistance(100); setFilterRange('ALL'); }} className="text-[8px] font-black text-red-500 uppercase w-full text-right mt-1">Resetar filtros</button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border-b p-4 sticky top-0 z-30 shadow-sm">
           <div className="flex p-1 bg-gray-100 rounded-2xl">
              <button onClick={() => setMyGamesSubTab('FUTUROS')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${myGamesSubTab === 'FUTUROS' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Próximos</button>
              <button onClick={() => setMyGamesSubTab('HISTORICO')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${myGamesSubTab === 'HISTORICO' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Histórico</button>
           </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {processedSlots.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
             <Activity className="w-12 h-12 text-gray-200 mb-4" />
             <p className="text-gray-300 font-black uppercase text-[10px]">Nenhuma partida encontrada</p>
          </div>
        ) : (
          processedSlots.map(slot => {
            const field = fields.find(f => f.id === slot.fieldId);
            const distMeters = fieldDistances[field?.id || ''] || -1;
            const status = getStatusBadge(slot);

            return (
              <div key={slot.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden group hover:border-pitch transition-all relative">
                <div className="p-6 flex gap-5">
                  <div className="w-16 h-16 bg-pitch rounded-2xl overflow-hidden border border-white shadow-sm flex-shrink-0">
                    <img src={field?.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                        <h3 className="font-black text-pitch text-lg leading-none uppercase truncate mr-2">{field?.name}</h3>
                        {distMeters >= 0 && (
                           <div className="flex items-center gap-1 bg-grass-50 text-grass-700 px-2 py-1 rounded-lg border border-grass-100">
                             <MapPin className="w-3 h-3" />
                             <span className="text-[9px] font-black uppercase">{formatDistance(distMeters)}</span>
                           </div>
                        )}
                     </div>
                     <div className="flex flex-wrap gap-2 mt-2">
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
                  <div className={`rounded-2xl p-4 flex items-center justify-between ${slot.bookedByTeamName ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center font-black text-pitch text-xs">
                           {slot.bookedByTeamName?.charAt(0) || slot.localTeamName?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                           <p className="text-[8px] font-black text-gray-400 uppercase">Mandante</p>
                           <p className="text-sm font-black text-pitch uppercase truncate">{slot.bookedByTeamName || slot.localTeamName || 'Livre'}</p>
                        </div>
                     </div>
                     <Swords className="w-5 h-5 text-gray-300" />
                  </div>
                </div>

                <div className="p-6 flex items-center justify-between border-t mt-2">
                   <div className="flex flex-col">
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase mb-1 ${status.color}`}>
                         {status.label}
                      </span>
                      <span className="text-xs font-black text-pitch">R$ {slot.price}</span>
                   </div>
                   <Button onClick={() => setSelectedSlot(slot)} className="rounded-2xl px-8 py-4 font-black uppercase text-[10px] bg-pitch shadow-lg">
                      {slot.bookedByTeamName || slot.hasLocalTeam ? 'Desafiar' : 'Alugar'}
                   </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-pitch uppercase italic">Confirmar Solicitação</h2>
               <button onClick={() => setSelectedSlot(null)} className="p-3 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
            </div>
            <div className="space-y-8">
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Escolha seu Time</label>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                     {currentUser.teams.map((t, i) => (
                        <button key={i} onClick={() => setSelectedTeamIdx(i)} className={`flex-shrink-0 w-32 py-6 rounded-[2rem] font-black uppercase text-[10px] flex flex-col items-center gap-3 border-2 transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white border-pitch shadow-lg scale-105' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                           <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-pitch overflow-hidden">
                              {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : t.name.charAt(0)}
                           </div>
                           <span className="truncate w-full px-2 text-center">{t.name}</span>
                        </button>
                     ))}
                  </div>
               </div>
               
               {currentUser.teams[selectedTeamIdx] && (
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Categoria para o Jogo</label>
                    <div className="flex flex-wrap gap-2">
                       {currentUser.teams[selectedTeamIdx].categories.map(cat => (
                         <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-3 rounded-full font-black uppercase text-[10px] border-2 transition-all ${selectedCategory === cat ? 'bg-grass-500 text-pitch border-grass-500' : 'bg-gray-50 text-gray-400'}`}>
                            {cat}
                         </button>
                       ))}
                    </div>
                 </div>
               )}

               <Button onClick={handleBookingConfirm} disabled={!selectedCategory} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl active:scale-95">Solicitar Agora</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
