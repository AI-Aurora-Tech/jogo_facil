import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Swords, Filter, X, Check, MessageCircle, Phone, Navigation, Trophy, ChevronDown, Smartphone } from 'lucide-react';
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
  const [filterDist, setFilterDist] = useState<number>(50);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Erro ao obter localização", err)
      );
    }
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSlots = slots.filter(slot => {
    const field = fields.find(f => f.id === slot.fieldId);
    if (!field) return false;

    // Filter rules
    if (viewMode === 'EXPLORE') {
      if (slot.date < todayStr || slot.status !== 'available') return false;
      // Don't show your own field's slots in explore
      if (field.ownerId === currentUser.id) return false;
    } else {
      const isMyBooking = slot.bookedByUserId === currentUser.id || slot.opponentTeamPhone === currentUser.phoneNumber;
      if (!isMyBooking) return false;
    }

    // Active Filters
    if (filterCat && !slot.allowedOpponentCategories.includes(filterCat) && slot.localTeamCategory !== filterCat) return false;
    if (filterSport && slot.sport !== filterSport) return false;
    if (filterGender && slot.localTeamGender !== filterGender) return false;
    
    if (userCoords && field.latitude && field.longitude) {
      const dist = calculateDistance(userCoords.lat, userCoords.lng, field.latitude, field.longitude);
      if (dist > filterDist) return false;
    }

    return true;
  }).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  const handleWhatsApp = (phone?: string, message?: string) => {
    if (!phone) {
      alert("Telefone não disponível.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message || '')}`, '_blank');
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
          title: "Novo Desafio Recebido! ⚽",
          description: `O time ${team.name} (${selectedCategory}) quer jogar contra você no dia ${selectedSlot.date.split('-').reverse().join('/')} às ${selectedSlot.time}.`,
          type: 'info'
        });
      }

      setSelectedSlot(null);
      onRefresh();
      alert("Solicitação enviada! O dono da arena foi notificado via aplicativo.");
    } catch (e) { 
      console.error(e);
      alert("Erro ao solicitar agendamento."); 
    }
  };

  // Validation: filter user teams that have AT LEAST ONE category allowed by the slot host
  const eligibleTeams = currentUser.teams.filter(t => {
    if (!selectedSlot || !selectedSlot.hasLocalTeam) return true; // Friendly matches (aluguel) are open to all
    // Challenge matches (desafio) require category matching
    return t.categories.some(cat => selectedSlot.allowedOpponentCategories.includes(cat));
  });

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-20">
      {/* Search Header & Filters */}
      {viewMode === 'EXPLORE' && (
        <div className="bg-white border-b p-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-pitch" />
                <span className="text-[10px] font-black uppercase text-pitch">Busca Avançada</span>
             </div>
             <button onClick={() => setShowFilters(!showFilters)} className="text-[10px] font-black uppercase text-grass-600 flex items-center gap-1">
                {showFilters ? 'Esconder Filtros' : 'Filtros'} <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
             </button>
          </div>

          {showFilters && (
            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase">Esporte</label>
                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black uppercase" value={filterSport} onChange={e => setFilterSport(e.target.value)}>
                      <option value="">Todos</option>
                      {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase">Gênero</label>
                    <select className="w-full p-3 bg-gray-50 border rounded-xl text-[10px] font-black uppercase" value={filterGender} onChange={e => setFilterGender(e.target.value as Gender)}>
                      <option value="">Todos</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMININO">Feminino</option>
                      <option value="MISTO">Misto</option>
                    </select>
                  </div>
               </div>
               
               <div className="space-y-1">
                  <label className="text-[8px] font-black text-gray-400 uppercase">Categoria</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <button onClick={() => setFilterCat('')} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterCat === '' ? 'bg-pitch text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>Todas</button>
                      {CATEGORY_ORDER.map(c => (
                        <button key={c} onClick={() => setFilterCat(c)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${filterCat === c ? 'bg-pitch text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{c}</button>
                      ))}
                  </div>
               </div>

               <div className="px-2">
                  <div className="flex justify-between text-[9px] font-black uppercase text-gray-400 mb-1">
                     <span>Distância Máxima</span>
                     <span className="text-pitch">{filterDist}km</span>
                  </div>
                  <input type="range" min="1" max="100" value={filterDist} onChange={e => setFilterDist(Number(e.target.value))} className="w-full accent-pitch" />
               </div>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-6">
        {filteredSlots.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center">
             <Search className="w-12 h-12 text-gray-200 mb-4" />
             <p className="text-gray-300 font-black uppercase text-[10px]">Nenhum horário encontrado para sua busca</p>
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
                        <span className="text-[9px] font-black text-grass-600 uppercase flex items-center gap-1 whitespace-nowrap">
                          <MapPin className="w-3 h-3"/> {dist ? `${dist}km` : '--'}
                        </span>
                     </div>
                     <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[9px] font-black bg-gray-100 px-2 py-1 rounded-xl flex items-center gap-1 uppercase">
                          <Clock className="w-3 h-3"/> {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                        </span>
                        <span className="text-[9px] font-black bg-pitch text-grass-500 px-2 py-1 rounded-xl uppercase">
                          {slot.sport}
                        </span>
                        <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-1 rounded-xl uppercase">
                          R$ {slot.price}
                        </span>
                     </div>
                  </div>
                </div>

                <div className="px-6 pb-2">
                  <div className={`rounded-2xl p-4 flex items-center justify-between ${slot.hasLocalTeam ? 'bg-pitch text-white shadow-inner' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden">
                          {slot.localTeamLogoUrl ? <img src={slot.localTeamLogoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-xs">{slot.localTeamName?.charAt(0) || 'H'}</div>}
                       </div>
                       <div>
                          <p className="text-[8px] font-black uppercase opacity-60">Mandante</p>
                          <p className="text-sm font-black leading-tight">{slot.localTeamName || 'Horário Livre'}</p>
                          <span className="text-[8px] font-bold uppercase">{slot.localTeamCategory || 'Livre'} • {slot.localTeamGender || 'MASC'}</span>
                       </div>
                    </div>
                    {slot.hasLocalTeam && <Swords className="w-5 h-5 text-grass-500 mx-2 animate-pulse" />}
                  </div>
                </div>

                <div className="p-6 flex items-center justify-between border-t mt-2">
                   <div className="flex gap-2">
                      <button 
                        onClick={() => handleWhatsApp(field?.contactPhone, `Olá! Vi o horário de ${slot.time} no dia ${slot.date.split('-').reverse().join('/')} na arena ${field?.name} e gostaria de agendar.`)}
                        className="p-3 bg-grass-50 text-grass-600 rounded-xl active:scale-95 border border-grass-100"
                        title="Falar com a Arena"
                      >
                        <MessageCircle className="w-5 h-5"/>
                      </button>
                      {viewMode === 'MY_BOOKINGS' && slot.opponentTeamPhone && (
                        <button 
                          onClick={() => handleWhatsApp(slot.opponentTeamPhone, `Olá! Sou o capitão do time desafiante para a partida na arena ${field?.name} no dia ${slot.date}. Combinado?`)}
                          className="p-3 bg-blue-50 text-blue-600 rounded-xl active:scale-95 border border-blue-100"
                          title="Falar com o Adversário"
                        >
                          <Smartphone className="w-5 h-5"/>
                        </button>
                      )}
                   </div>
                   
                   {viewMode === 'EXPLORE' ? (
                     <Button onClick={() => { setSelectedSlot(slot); setSelectedCategory(''); }} className="rounded-2xl px-8 py-4 font-black uppercase text-[10px] bg-pitch shadow-lg">
                        {slot.hasLocalTeam ? 'Desafiar Time' : 'Reservar Aluguel'}
                     </Button>
                   ) : (
                     <div className="flex items-center gap-2">
                        <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase ${slot.status === 'confirmed' ? 'bg-grass-500 text-pitch' : 'bg-orange-100 text-orange-600'}`}>
                          {slot.status === 'confirmed' ? '✓ Confirmado' : '⌛ Pendente'}
                        </span>
                     </div>
                   )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Booking Modal with Strict Category Validation */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-xl z-[400] flex items-end">
          <div className="bg-white w-full rounded-t-[4rem] p-12 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-pitch uppercase italic">
                 {selectedSlot.hasLocalTeam ? 'Enviar Desafio' : 'Reservar Aluguel'}
               </h2>
               <button onClick={() => setSelectedSlot(null)} className="p-2 bg-gray-100 rounded-full hover:bg-red-50 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-8">
               {selectedSlot.hasLocalTeam && (
                 <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <p className="text-[10px] font-black text-orange-600 uppercase mb-1">Categorias Permitidas pelo Mandante:</p>
                    <div className="flex flex-wrap gap-2">
                       {selectedSlot.allowedOpponentCategories.map(c => <span key={c} className="bg-white px-2 py-0.5 rounded-md text-[9px] font-black border border-orange-200">{c}</span>)}
                    </div>
                 </div>
               )}

               {eligibleTeams.length === 0 ? (
                 <div className="p-10 text-center border-2 border-dashed rounded-[2rem] bg-red-50 border-red-100">
                    <Trophy className="w-12 h-12 text-red-200 mx-auto mb-4" />
                    <p className="text-xs font-black text-red-600 uppercase">Seu time não é elegível para este desafio.</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">A categoria cadastrada no seu perfil deve coincidir com as aceitas pelo mandante.</p>
                    <Button onClick={() => setSelectedSlot(null)} variant="outline" className="mt-6 w-full py-4 rounded-2xl border-red-200 text-red-600 uppercase font-black">Fechar</Button>
                 </div>
               ) : (
                 <>
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Escolha seu Time</label>
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                         {eligibleTeams.map((t, i) => (
                            <button key={i} onClick={() => { setSelectedTeamIdx(currentUser.teams.indexOf(t)); setSelectedCategory(''); }} className={`flex-shrink-0 w-32 py-6 rounded-[2rem] font-black uppercase text-[10px] transition-all flex flex-col items-center gap-3 border-2 ${selectedTeamIdx === currentUser.teams.indexOf(t) ? 'bg-pitch text-white border-pitch shadow-lg scale-105' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                               <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden">
                                  {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <div className="text-xl">{t.name.charAt(0)}</div>}
                               </div>
                               <span className="truncate w-full px-2">{t.name}</span>
                            </button>
                         ))}
                      </div>
                   </div>
                   
                   <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block tracking-widest">Categoria para o Jogo</label>
                      <div className="flex flex-wrap gap-2">
                         {currentUser.teams[selectedTeamIdx]?.categories.map(cat => {
                           const isAllowed = !selectedSlot.hasLocalTeam || selectedSlot.allowedOpponentCategories.includes(cat);
                           return (
                            <button 
                              key={cat} 
                              disabled={!isAllowed}
                              onClick={() => setSelectedCategory(cat)} 
                              className={`px-6 py-3 rounded-full font-black uppercase text-[10px] transition-all border-2 ${!isAllowed ? 'opacity-20 line-through grayscale cursor-not-allowed bg-gray-100 border-gray-200' : selectedCategory === cat ? 'bg-grass-500 text-pitch border-grass-500 shadow-md' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-pitch'}`}
                            >
                               {cat}
                            </button>
                           );
                         })}
                      </div>
                   </div>

                   <div className="pt-6">
                      <Button onClick={handleBookingConfirm} disabled={!selectedCategory} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-sm shadow-xl active:scale-95">Solicitar Partida</Button>
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};