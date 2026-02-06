
import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Swords, Filter, X, Check, MessageCircle, Phone, Navigation, Trophy, ChevronDown, Smartphone, Settings, AlertTriangle, ExternalLink, Activity } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User, CATEGORY_ORDER, SPORTS, Gender } from '../types';
import { api } from '../api';
import { calculateDistance } from '../utils';

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

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentUser, fields, slots, viewMode, onRefresh }) => {
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  // Filter States
  const [filterCat, setFilterCat] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [filterGender, setFilterGender] = useState<Gender | ''>('');
  const [filterDist, setFilterDist] = useState<number>(100);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Erro ao obter localização", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const userAllCategories = currentUser.teams?.flatMap(t => t.categories) || [];
  const hasRegisteredCategories = userAllCategories.length > 0;

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || slot.status !== 'available') return false;
      if (field.ownerId === currentUser.id) return false;

      // LÓGICA DE CATEGORIA:
      // Se já tem um mandante (mensalista ou time que agendou primeiro)
      const baseCategory = slot.localTeamCategory || slot.bookedByTeamCategory;
      if (baseCategory) {
          // O desafiante TEM que ter a mesma categoria base
          if (!userAllCategories.includes(baseCategory)) return false;
      }
    } else {
      const isMyBooking = slot.bookedByUserId === currentUser.id || slot.opponentTeamPhone === currentUser.phoneNumber;
      if (!isMyBooking) return false;
    }

    if (filterCat && !slot.allowedOpponentCategories.includes(filterCat) && slot.localTeamCategory !== filterCat) return false;
    if (filterSport && slot.sport !== filterSport) return false;
    
    if (userCoords && field.latitude && field.longitude) {
      const dist = calculateDistance(userCoords.lat, userCoords.lng, field.latitude, field.longitude);
      if (dist > filterDist) return false;
    }

    return true;
  }).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleOpenMap = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
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
          title: "Novo Agendamento! ⚽",
          description: `O time ${team.name} quer jogar no dia ${selectedSlot.date.split('-').reverse().join('/')} às ${selectedSlot.time}.`,
          type: 'info'
        });
      }

      setSelectedSlot(null);
      onRefresh();
      alert("Solicitação enviada com sucesso!");
    } catch (e) { 
      alert("Erro ao solicitar agendamento."); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      {viewMode === 'EXPLORE' && (
        <div className="bg-white border-b p-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-pitch" />
                <span className="text-[10px] font-black uppercase text-pitch">Buscar Partidas</span>
             </div>
             <button onClick={() => setShowFilters(!showFilters)} className="text-[10px] font-black uppercase text-grass-600 flex items-center gap-1">
                Filtros <ChevronDown className={`w-3 h-3 ${showFilters ? 'rotate-180' : ''}`} />
             </button>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase">Esporte</label>
                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black uppercase" value={filterSport} onChange={e => setFilterSport(e.target.value)}>
                      <option value="">Todos</option>
                      {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase">Distância ({filterDist}km)</label>
                    <input type="range" min="1" max="200" value={filterDist} onChange={e => setFilterDist(Number(e.target.value))} className="w-full accent-pitch" />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-6">
        {filteredSlots.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
             <Activity className="w-12 h-12 text-gray-200 mb-4" />
             <p className="text-gray-300 font-black uppercase text-[10px]">Sem horários compatíveis no momento</p>
          </div>
        ) : (
          filteredSlots.map(slot => {
            const field = fields.find(f => f.id === slot.fieldId);
            const dist = (userCoords && field?.latitude && field?.longitude) 
              ? calculateDistance(userCoords.lat, userCoords.lng, field.latitude, field.longitude) 
              : null;
            
            return (
              <div key={slot.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden group hover:border-pitch transition-all relative">
                <div className="p-6 flex gap-5">
                  <div className="w-16 h-16 bg-pitch rounded-2xl overflow-hidden border border-white shadow-sm flex-shrink-0">
                    <img src={field?.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                        <h3 className="font-black text-pitch text-lg leading-none uppercase truncate mr-2">{field?.name}</h3>
                        <div className="flex flex-col items-end gap-1">
                           <span className="text-[9px] font-black text-grass-600 uppercase flex items-center gap-1">
                             <MapPin className="w-3 h-3"/> {dist ? `${dist}km` : '--'}
                           </span>
                           <button onClick={() => handleOpenMap(field!.latitude, field!.longitude)} className="text-[8px] font-bold text-blue-500 uppercase flex items-center gap-1 underline">
                             <ExternalLink className="w-2.5 h-2.5"/> Ver Mapa
                           </button>
                        </div>
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
                  <div className={`rounded-2xl p-4 flex items-center justify-between ${slot.hasLocalTeam || slot.bookedByTeamName ? 'bg-indigo-50 border-indigo-100 border' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-white rounded-xl border flex items-center justify-center overflow-hidden font-black text-xs text-pitch">
                          {slot.localTeamName?.charAt(0) || slot.bookedByTeamName?.charAt(0) || '?'}
                       </div>
                       <div>
                          <p className="text-[8px] font-black uppercase text-gray-400">Mandante</p>
                          <p className="text-sm font-black text-pitch uppercase truncate w-32">{slot.localTeamName || slot.bookedByTeamName || 'Vaga p/ Mandante'}</p>
                          <span className="text-[8px] font-bold text-indigo-600 uppercase">Categoria: {slot.localTeamCategory || slot.bookedByTeamCategory || 'Qualquer'}</span>
                       </div>
                    </div>
                    {(slot.hasLocalTeam || slot.bookedByTeamName) && <Swords className="w-5 h-5 text-indigo-400" />}
                  </div>
                </div>

                <div className="p-6 flex items-center justify-between border-t mt-2">
                   <div className="flex flex-col">
                      <span className="text-xs font-black text-pitch">R$ {slot.price}</span>
                      <span className="text-[8px] font-bold text-gray-400 uppercase">{slot.courtName} • {slot.durationMinutes} min</span>
                   </div>
                   
                   <Button onClick={() => { setSelectedSlot(slot); setSelectedCategory(''); }} className="rounded-2xl px-8 py-4 font-black uppercase text-[10px] bg-pitch shadow-lg">
                      {slot.hasLocalTeam || slot.bookedByTeamName ? 'Desafiar Partida' : 'Alugar Horário'}
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
               <button onClick={() => setSelectedSlot(null)} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-8">
               {/* Restrição de Categoria */}
               {(selectedSlot.localTeamCategory || selectedSlot.bookedByTeamCategory) && (
                 <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Este horário exige a categoria:</p>
                    <span className="bg-white px-3 py-1 rounded-md text-[10px] font-black text-indigo-700 border border-indigo-200">
                      {selectedSlot.localTeamCategory || selectedSlot.bookedByTeamCategory}
                    </span>
                 </div>
               )}

               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Seu Time Desafiante</label>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                     {currentUser.teams
                        .filter(t => {
                          const reqCat = selectedSlot.localTeamCategory || selectedSlot.bookedByTeamCategory;
                          return !reqCat || t.categories.includes(reqCat);
                        })
                        .map((t, i) => (
                        <button key={i} onClick={() => { setSelectedTeamIdx(currentUser.teams.indexOf(t)); setSelectedCategory(''); }} className={`flex-shrink-0 w-32 py-6 rounded-[2rem] font-black uppercase text-[10px] transition-all flex flex-col items-center gap-3 border-2 ${selectedTeamIdx === currentUser.teams.indexOf(t) ? 'bg-pitch text-white border-pitch shadow-lg scale-105' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                           <span className="truncate w-full px-2">{t.name}</span>
                        </button>
                     ))}
                  </div>
               </div>
               
               {currentUser.teams[selectedTeamIdx] && (
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Confirme sua Categoria</label>
                    <div className="flex flex-wrap gap-2">
                       {currentUser.teams[selectedTeamIdx].categories.map(cat => {
                         const reqCat = selectedSlot.localTeamCategory || selectedSlot.bookedByTeamCategory;
                         const isAllowed = !reqCat || reqCat === cat;
                         return (
                          <button key={cat} disabled={!isAllowed} onClick={() => setSelectedCategory(cat)} className={`px-6 py-3 rounded-full font-black uppercase text-[10px] border-2 ${!isAllowed ? 'opacity-20 cursor-not-allowed' : selectedCategory === cat ? 'bg-grass-500 text-pitch border-grass-500' : 'bg-gray-50 text-gray-400'}`}>
                             {cat}
                          </button>
                         );
                       })}
                    </div>
                 </div>
               )}

               <Button onClick={handleBookingConfirm} disabled={!selectedCategory} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">Solicitar Agora</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
