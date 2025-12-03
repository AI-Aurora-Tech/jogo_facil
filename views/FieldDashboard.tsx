import React, { useState } from 'react';
import { Plus, Users, DollarSign, Calendar as CalendarIcon, CheckCircle, XCircle, Repeat, MessageCircle, Tag, AlertCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, COMMON_CATEGORIES } from '../types';

interface FieldDashboardProps {
  field: Field;
  slots: MatchSlot[];
  onAddSlot: (slot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, 
  slots, 
  onAddSlot,
  onConfirmBooking,
  onRejectBooking
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form State
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [hasLocalTeam, setHasLocalTeam] = useState(false);
  const [localTeamName, setLocalTeamName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleCreateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime) return;

    onAddSlot({
      fieldId: field.id,
      date: newDate,
      time: newTime,
      isBooked: false,
      hasLocalTeam: hasLocalTeam,
      localTeamName: hasLocalTeam ? localTeamName : undefined,
      allowedCategories: selectedCategories.length > 0 ? selectedCategories : ["Livre"],
      status: 'available',
      price: field.hourlyRate
    }, isRecurring);

    setSuccessMsg('Horário criado com sucesso!');
    setTimeout(() => {
      setSuccessMsg('');
      setShowAddModal(false);
      // Reset form
      setNewDate('');
      setNewTime('');
      setHasLocalTeam(false);
      setLocalTeamName('');
      setIsRecurring(false);
      setSelectedCategories([]);
    }, 1500);
  };

  const handleWhatsAppClick = (phone: string, teamName: string, date: string, time: string) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const text = `Olá ${teamName}, sou da ${field.name}. Estou entrando em contato sobre o jogo marcado para ${date} às ${time}.`;
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleConfirmAndNotify = (slot: MatchSlot) => {
    onConfirmBooking(slot.id);
    // Open WhatsApp to notify team
    if (slot.bookedByPhone) {
        const cleanPhone = slot.bookedByPhone.replace(/\D/g, '');
        const text = `Olá ${slot.bookedByTeamName}, confirmei seu agendamento no ${field.name} para o dia ${slot.date} às ${slot.time}. Tudo certo!`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }
  };

  const sortedSlots = [...slots].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  
  const inputClass = "w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-grass-500 outline-none";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <h2 className="text-3xl font-bold text-pitch">{field.name}</h2>
          <p className="text-gray-500 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Taxa: R$ {field.hourlyRate}/hr</p>
          <div className="flex gap-2 mt-2">
             <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Multa: {field.cancellationFeePercent}%</span>
             <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{field.location}</span>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" /> Novo Horário
        </Button>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <h3 className="font-bold text-xl text-pitch">Meus Horários Disponibilizados</h3>
        <span className="bg-grass-100 text-grass-700 text-xs font-bold px-2 py-1 rounded-full">{sortedSlots.length}</span>
      </div>

      {sortedSlots.length === 0 ? (
        <div className="text-center py-20 bg-gray-100 rounded-xl border-dashed border-2 border-gray-300">
          <p className="text-gray-500 mb-4">Você ainda não criou nenhum horário.</p>
          <Button variant="outline" onClick={() => setShowAddModal(true)}>Criar Agenda</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSlots.map(slot => (
            <div key={slot.id} className={`border rounded-xl p-5 relative shadow-sm transition-all flex flex-col justify-between ${
              slot.status === 'confirmed' ? 'bg-green-50 border-green-200' :
              slot.status === 'pending_verification' ? 'bg-orange-50 border-orange-200' : 'bg-white'
            }`}>
              <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <span className="font-bold text-lg block">{slot.time}</span>
                        <span className="text-sm text-gray-500">{slot.date.split('-').reverse().join('/')}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      slot.status === 'available' ? 'bg-blue-100 text-blue-700' :
                      slot.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {slot.status === 'available' ? 'Disponível' : 
                       slot.status === 'confirmed' ? 'Agendado' : 'Solicitação'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {slot.allowedCategories.map(cat => (
                      <span key={cat} className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300">
                        {cat}
                      </span>
                    ))}
                  </div>

                  {slot.hasLocalTeam && (
                    <div className="mb-3 flex items-start gap-2 text-indigo-700 bg-indigo-50 p-2 rounded-lg text-sm border border-indigo-100">
                      <Users className="w-4 h-4 mt-0.5" />
                      <div>
                        <span className="font-bold block">Time da Casa:</span>
                        <span>{slot.localTeamName || "Time Local"}</span>
                      </div>
                    </div>
                  )}

                  {(slot.bookedByTeamName) && (
                      <div className="mb-3 p-2 bg-white/50 rounded text-sm border border-gray-100">
                          <p className="text-gray-500 text-xs uppercase font-bold">Adversário:</p>
                          <p className="font-semibold">{slot.bookedByTeamName} <span className="text-xs font-normal text-gray-500">({slot.bookedByCategory})</span></p>
                          {slot.bookedByPhone && (
                             <button 
                                onClick={() => handleWhatsAppClick(slot.bookedByPhone!, slot.bookedByTeamName!, slot.date, slot.time)}
                                className="text-green-600 hover:text-green-800 text-xs flex items-center gap-1 mt-1 font-semibold"
                             >
                                 <MessageCircle className="w-3 h-3" /> Falar no WhatsApp
                             </button>
                          )}
                      </div>
                  )}
              </div>

              <div className="border-t pt-3 mt-2">
                {slot.status === 'pending_verification' && (
                  <div>
                     <p className="text-sm font-semibold mb-2 text-orange-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Aprovar Solicitação?
                     </p>
                     <div className="flex gap-2">
                        <Button size="sm" variant="primary" className="flex-1 text-xs" onClick={() => handleConfirmAndNotify(slot)}>
                           <CheckCircle className="w-3 h-3" /> Sim, Avisar
                        </Button>
                        <Button size="sm" variant="danger" className="flex-1 text-xs" onClick={() => onRejectBooking(slot.id)}>
                           <XCircle className="w-3 h-3" /> Recusar
                        </Button>
                     </div>
                  </div>
                )}
                {slot.status === 'available' && (
                  <p className="text-sm text-gray-400 text-center">Aguardando reservas...</p>
                )}
                {slot.status === 'confirmed' && (
                  <p className="text-sm text-green-600 font-medium text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Confirmado
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Slot */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto py-10">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white my-auto">
            <h3 className="text-xl font-bold mb-4">Adicionar Horário</h3>
            
            {successMsg ? (
               <div className="bg-green-500/20 text-green-400 p-4 rounded text-center font-bold border border-green-500 mb-4">
                  {successMsg}
               </div>
            ) : (
              <form onSubmit={handleCreateSlot} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Data</label>
                    <input 
                      type="date" 
                      required
                      className={inputClass}
                      style={{ colorScheme: 'dark' }}
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Horário</label>
                    <input 
                      type="time" 
                      required
                      className={inputClass}
                      style={{ colorScheme: 'dark' }}
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Categorias Permitidas (Adversário)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-xs px-2 py-1 rounded-full border transition ${
                          selectedCategories.includes(cat) 
                            ? 'bg-grass-600 border-grass-500 text-white shadow-lg' 
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Se nenhuma for selecionada, será considerado "Livre".</p>
                </div>

                <div className="border-t border-gray-600 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="localTeam"
                      checked={hasLocalTeam}
                      onChange={e => setHasLocalTeam(e.target.checked)}
                      className="w-5 h-5 text-grass-600 rounded focus:ring-grass-500 bg-gray-700 border-gray-500"
                    />
                    <label htmlFor="localTeam" className="text-sm font-medium text-gray-300">
                      Tenho time local (Procurando adversário)
                    </label>
                  </div>

                  {hasLocalTeam && (
                    <div className="pl-7 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="block text-xs text-gray-400 mb-1">Nome do Time da Casa</label>
                      <input 
                          type="text"
                          className={inputClass}
                          placeholder="Ex: Real Matismo FC"
                          value={localTeamName}
                          onChange={e => setLocalTeamName(e.target.value)}
                          required={hasLocalTeam}
                      />
                    </div>
                  )}
                </div>

                <div className="bg-gray-700/50 border border-gray-600 p-3 rounded-lg flex items-center gap-3">
                  <input 
                      type="checkbox"
                      id="recurring"
                      checked={isRecurring}
                      onChange={e => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 text-blue-500 rounded bg-gray-700 border-gray-500"
                  />
                  <label htmlFor="recurring" className="text-sm text-blue-300 flex items-center gap-2">
                    <Repeat className="w-4 h-4" /> Repetir por 4 semanas?
                  </label>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <Button type="button" variant="secondary" className="flex-1 bg-gray-700 hover:bg-gray-600 border border-gray-600" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1">Criar</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};