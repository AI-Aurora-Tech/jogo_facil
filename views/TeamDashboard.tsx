
import React, { useState } from 'react';
import { Search, MapPin, Clock, Check, AlertTriangle, X, MessageCircle, Filter, Trophy, Users, AlertCircle, CalendarCheck, Copy, Share2, Phone, Navigation } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, User, SubTeam, COMMON_CATEGORIES } from '../types';
import { calculateDistance } from '../utils';

interface TeamDashboardProps {
  currentUser: User;
  fields: Field[];
  slots: MatchSlot[];
  onBookSlot: (slotId: string, team: SubTeam) => void;
  userLocation?: { lat: number, lng: number };
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ currentUser, fields, slots, onBookSlot, userLocation }) => {
  // Tabs: 'SEARCH' | 'MY_BOOKINGS'
  const [activeTab, setActiveTab] = useState<'SEARCH' | 'MY_BOOKINGS'>('SEARCH');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [radiusFilter, setRadiusFilter] = useState<number>(50); // km
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'NIGHT'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Booking State
  const [selectedSlot, setSelectedSlot] = useState<MatchSlot | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Extra Info for Rentals
  const [opponentName, setOpponentName] = useState('');
  const [opponentPhone, setOpponentPhone] = useState('');

  const handleFinalizeBooking = () => {
    const team = currentUser.subTeams.find(t => t.id === selectedTeamId);
    if (selectedSlot && team) {
      
      // Inject opponent info into the slot object if it's a rental (hacky for this frontend-only mock, normally sent in payload)
      if (selectedSlot.matchType === 'ALUGUEL') {
          (selectedSlot as any).opponentTeamName = opponentName;
          (selectedSlot as any).opponentTeamPhone = opponentPhone;
      }

      onBookSlot(selectedSlot.id, team);
      
      // Notificar Dono do Campo via WhatsApp
      const field = fields.find(f => f.id === selectedSlot?.fieldId);
      if (field?.contactPhone) {
         const cleanPhone = field.contactPhone.replace(/\D/g, '');
         let text = `Olá, sou do time ${team.name}. Solicitei o agendamento (${selectedSlot.matchType}) no App Jogo Fácil para o dia ${selectedSlot.date.split('-').reverse().join('/')} às ${selectedSlot.time}.`;
         if (selectedSlot.matchType === 'ALUGUEL' && opponentName) {
            text += ` Jogo contra: ${opponentName}.`;
         }
         text += ` Aguardo a chave PIX.`;
         
         const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
         window.open(url, '_blank');
      }

      setSelectedSlot(null);
      setSelectedTeamId('');
      setOpponentName('');
      setOpponentPhone('');
    }
  };

  const handleWhatsAppField = (field: Field) => {
     if(!field.contactPhone) return;
     const cleanPhone = field.contactPhone.replace(/\D/g, '');
     const text = `Olá, vi seu campo ${field.name} no Jogo Fácil e tenho uma dúvida.`;
     const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
     window.open(url, '_blank');
  };

  // --- Filtering Logic ---
  const getFilteredSlots = () => {
    return slots.filter(slot => {
      const field = fields.find(f => f.id === slot.fieldId);
      if (!field) return false;
      if (slot.status !== 'available') return false;

      if (searchTerm && !field.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      if (userLocation) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude);
        if (dist > radiusFilter) return false;
      }

      // Check intersection of allowed categories if filter is applied
      if (categoryFilter && !slot.allowedCategories.includes(categoryFilter) && !slot.allowedCategories.includes('Livre')) return false;

      const hour = parseInt(slot.time.split(':')[0]);
      if (timeFilter === 'MORNING' && hour >= 12) return false;
      if (timeFilter === 'AFTERNOON' && (hour < 12 || hour >= 18)) return false;
      if (timeFilter === 'NIGHT' && hour < 18) return false;

      return true;
    });
  };

  const getMyBookings = () => {
    return slots.filter(slot => slot.bookedByUserId === currentUser.id);
  };

  const filteredSlots = getFilteredSlots();
  const myBookings = getMyBookings();
  const inputClass = "w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-grass-500 outline-none";

  // Calculate available teams for the selected slot
  const getEligibleTeams = () => {
    if (!selectedSlot) return [];
    if (selectedSlot.allowedCategories.includes('Livre')) return currentUser.subTeams;
    
    return currentUser.subTeams.filter(team => 
      selectedSlot.allowedCategories.includes(team.category)
    );
  };

  const eligibleTeams = getEligibleTeams();

  const getFieldInfo = (slot: MatchSlot) => fields.find(f => f.id === slot.fieldId);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      
      {/* Sub-Nav Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-300 pb-1 overflow-x-auto justify-between items-center">
        <div className="flex gap-4">
            <button 
            onClick={() => setActiveTab('SEARCH')}
            className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'SEARCH' ? 'text-grass-600 border-b-2 border-grass-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
            Buscar Jogos
            </button>
            <button 
            onClick={() => setActiveTab('MY_BOOKINGS')}
            className={`pb-2 px-4 font-bold transition whitespace-nowrap ${activeTab === 'MY_BOOKINGS' ? 'text-grass-600 border-b-2 border-grass-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
            Meus Agendamentos
            </button>
        </div>
        
        {/* GPS Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold ${userLocation ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50 animate-pulse'}`}>
            <Navigation className="w-3 h-3" />
            {userLocation ? 'LOCALIZAÇÃO ATIVA' : 'OBTENDO GPS...'}
        </div>
      </div>

      {activeTab === 'SEARCH' && (
        <>
          <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border space-y-4">
             <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome da arena..." 
                    className="w-full pl-10 p-3 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:ring-2 focus:ring-grass-500" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className="w-full md:w-auto">
                  <Filter className="w-4 h-4" /> Filtros
                </Button>
             </div>

             {showFilters && (
               <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Raio de Distância</label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="range" min="1" max="100" 
                         value={radiusFilter} onChange={e => setRadiusFilter(Number(e.target.value))}
                         className="flex-1"
                       />
                       <span className="text-sm font-bold w-16">{radiusFilter} km</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Categoria</label>
                    <select 
                      className="w-full p-2 rounded border bg-white"
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                    >
                       <option value="">Todas</option>
                       {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Período</label>
                    <select 
                      className="w-full p-2 rounded border bg-white"
                      value={timeFilter}
                      onChange={e => setTimeFilter(e.target.value as any)}
                    >
                       <option value="ALL">Qualquer horário</option>
                       <option value="MORNING">Manhã (Até 12h)</option>
                       <option value="AFTERNOON">Tarde (12h - 18h)</option>
                       <option value="NIGHT">Noite (Após 18h)</option>
                    </select>
                  </div>
               </div>
             )}
          </div>

          <div className="grid gap-4">
            {filteredSlots.map(slot => {
              const field = fields.find(f => f.id === slot.fieldId);
              if (!field) return null;
              
              const dist = userLocation 
                ? calculateDistance(userLocation.lat, userLocation.lng, field.latitude, field.longitude)
                : null;

              const isOwner = field.ownerId === currentUser.id;

              return (
                <div key={slot.id} className="bg-white p-4 rounded-xl border hover:shadow-md transition flex flex-col md:flex-row justify-between items-stretch gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={field.imageUrl} alt={field.name} className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover bg-gray-200" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-pitch leading-tight">{field.name}</h3>
                      <div className="flex flex-col text-sm text-gray-500 gap-1 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {field.location} 
                          {dist !== null && <span className="text-grass-600 font-bold ml-1">({dist} km)</span>}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-gray-700">
                          <Clock className="w-3 h-3" /> {slot.date.split('-').reverse().join('/')} às {slot.time} <span className="text-gray-400 font-normal">({slot.durationMinutes} min)</span>
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {slot.allowedCategories.map(cat => (
                           <span key={cat} className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                             {cat}
                           </span>
                        ))}
                      </div>
                        
                      <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                            slot.matchType === 'FESTIVAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            slot.matchType === 'ALUGUEL' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                            'bg-gray-100 text-gray-800 border-gray-200'
                          }`}>
                            {slot.matchType}
                          </span>

                          {slot.hasLocalTeam && (
                            <div className="text-indigo-700 text-xs font-bold flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> vs {slot.localTeamName || 'Time da Casa'}
                            </div>
                          )}
                          {!slot.hasLocalTeam && slot.matchType === 'ALUGUEL' && (
                            <div className="text-purple-700 text-xs font-bold flex items-center gap-1">
                              <Share2 className="w-3 h-3" /> 2 Times de Fora
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col justify-between items-center md:items-end min-w-[140px] border-t md:border-t-0 md:border-l pt-3 md:pt-0 pl-0 md:pl-4 border-gray-100 mt-2 md:mt-0">
                     <div className="text-left md:text-right">
                        <span className="text-xs text-gray-400 uppercase">Valor</span>
                        <p className="text-xl md:text-2xl font-bold text-grass-700">R$ {slot.price}</p>
                     </div>
                     <div className="flex flex-col gap-2 w-1/2 md:w-full">
                       {field.contactPhone && !isOwner && (
                        <button onClick={() => handleWhatsAppField(field)} className="text-green-600 text-xs font-bold hover:underline flex items-center justify-end gap-1 hidden md:flex">
                            <MessageCircle className="w-3 h-3" /> Dúvidas?
                        </button>
                       )}
                       <Button 
                          size="sm" 
                          className={`w-full ${isOwner ? 'bg-gray-400 cursor-not-allowed hover:bg-gray-400 shadow-none' : ''}`} 
                          onClick={() => setSelectedSlot(slot)}
                          disabled={isOwner}
                       >
                         {isOwner ? 'Seu Campo' : 'Solicitar'}
                       </Button>
                     </div>
                  </div>
                </div>
              );
            })}
            {filteredSlots.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                Nenhum jogo encontrado com esses filtros. Tente aumentar o raio de distância.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'MY_BOOKINGS' && (
        <div className="space-y-4">
           {myBookings.length === 0 ? (
             <div className="text-center py-12 bg-gray-100 rounded-xl">
               <p className="text-gray-500">Você ainda não agendou nenhum jogo.</p>
               <Button variant="outline" className="mt-4" onClick={() => setActiveTab('SEARCH')}>Buscar Jogos</Button>
             </div>
           ) : (
             myBookings.map(slot => {
               const field = fields.find(f => f.id === slot.fieldId);
               return (
                 <div key={slot.id} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1">
                       <h3 className="font-bold text-lg">{field?.name}</h3>
                       <p className="text-gray-600 flex items-center gap-2">
                         <Clock className="w-4 h-4"/> {slot.date.split('-').reverse().join('/')} - {slot.time} <span className="text-xs bg-gray-200 px-1 rounded">{slot.durationMinutes} min</span>
                       </p>
                       <div className="mt-2 flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            slot.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {slot.status === 'confirmed' ? 'Confirmado' : 'Aguardando Pagamento'}
                          </span>
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                             <Users className="w-3 h-3"/> {slot.bookedByTeamName} ({slot.bookedByCategory})
                          </span>
                       </div>
                       
                       {slot.status === 'pending_verification' && (
                          <div className="mt-2 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-100">
                              ℹ️ Faça o PIX para o dono do campo e aguarde a confirmação dele.
                          </div>
                       )}
                    </div>
                    
                    {field?.contactPhone && (
                        <button 
                            onClick={() => handleWhatsAppField(field)} 
                            className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-200 transition w-full md:w-auto justify-center"
                        >
                             <MessageCircle className="w-4 h-4" /> Falar com Campo
                        </button>
                    )}
                 </div>
               )
             })
           )}
        </div>
      )}

      {/* Booking Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto text-white">
            <div className="bg-pitch p-4 flex justify-between items-center sticky top-0 z-10 border-b border-gray-700">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-grass-400" /> Solicitar Agendamento
              </h3>
              <button onClick={() => setSelectedSlot(null)} className="text-white/70 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6 bg-gray-700 p-4 rounded-lg border border-gray-600">
                <p className="text-sm text-gray-400 mb-1">Detalhes do Jogo</p>
                <div className="flex justify-between font-semibold text-lg">
                   <span>{getFieldInfo(selectedSlot)?.name}</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-gray-300">
                    <span>{selectedSlot.date.split('-').reverse().join('/')}</span>
                    <span>{selectedSlot.time} <span className="text-sm text-gray-500">({selectedSlot.durationMinutes} min)</span></span>
                </div>
                <div className="mt-2">
                    <span className="text-xs font-bold text-yellow-500 border border-yellow-500 px-2 py-0.5 rounded">{selectedSlot.matchType}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-600 flex justify-between items-center">
                    <span className="text-sm text-gray-400">Valor a pagar no local</span>
                    <span className="text-xl font-bold text-grass-400">R$ {selectedSlot.price},00</span>
                </div>
                
                {getFieldInfo(selectedSlot)?.pixConfig.key && (
                    <div className="mt-3 bg-gray-900/50 p-2 rounded border border-gray-600">
                        <p className="text-xs text-gray-400 mb-1">Chave PIX do Campo:</p>
                        <div className="flex justify-between items-center">
                            <code className="text-sm text-grass-300">{getFieldInfo(selectedSlot)?.pixConfig.key}</code>
                            <button 
                                onClick={() => navigator.clipboard.writeText(getFieldInfo(selectedSlot)?.pixConfig.key || '')}
                                className="text-xs bg-gray-700 p-1 rounded hover:bg-gray-600"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{getFieldInfo(selectedSlot)?.pixConfig.name}</p>
                    </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Qual time vai jogar (Pagante)?</label>
                  
                  {eligibleTeams.length > 0 ? (
                    <select 
                      className={inputClass}
                      value={selectedTeamId}
                      onChange={e => setSelectedTeamId(e.target.value)}
                    >
                       <option value="" disabled>Selecione um time</option>
                       {eligibleTeams.map(t => (
                         <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                       ))}
                    </select>
                  ) : (
                    <div className="bg-red-900/20 border border-red-500/50 p-3 rounded text-red-200 text-sm flex items-start gap-2">
                       <AlertTriangle className="w-5 h-5 shrink-0" />
                       <p>Você não tem nenhum time nas categorias permitidas para este jogo ({selectedSlot.allowedCategories.join(', ')}). Cadastre um time compatível no seu perfil.</p>
                    </div>
                  )}
                </div>

                {selectedSlot.matchType === 'ALUGUEL' && (
                    <div className="space-y-4 border-t border-gray-600 pt-4">
                        <p className="text-sm font-bold text-purple-300 flex items-center gap-2">
                            <Share2 className="w-4 h-4" /> Dados do 2º Time (Adversário)
                        </p>
                        <p className="text-xs text-gray-400">Como não há time da casa, precisamos dos dados do seu adversário para que o campo possa notificar a ambos.</p>
                        <div>
                             <label className="block text-xs font-medium mb-1 text-gray-400">Nome do Adversário</label>
                             <input 
                                type="text"
                                className={inputClass}
                                placeholder="Nome do outro time"
                                value={opponentName}
                                onChange={e => setOpponentName(e.target.value)}
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium mb-1 text-gray-400">WhatsApp do Adversário</label>
                             <div className="relative">
                                <Phone className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                                <input 
                                    type="tel"
                                    className={inputClass}
                                    placeholder="(11) 99999-9999"
                                    value={opponentPhone}
                                    onChange={e => setOpponentPhone(e.target.value)}
                                />
                             </div>
                        </div>
                    </div>
                )}
                
                <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg">
                    <p className="text-sm text-blue-200 flex items-start gap-2">
                        <MessageCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        Ao confirmar, você será redirecionado para o WhatsApp do dono do campo para enviar o comprovante.
                    </p>
                </div>

                <div className="mt-4">
                  <Button 
                    className="w-full py-3 text-lg" 
                    disabled={!selectedTeamId || (selectedSlot.matchType === 'ALUGUEL' && (!opponentName || !opponentPhone))}
                    onClick={handleFinalizeBooking}
                  >
                    Confirmar Solicitação
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
