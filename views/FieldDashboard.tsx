import React, { useState } from 'react';
import { Plus, Users, DollarSign, Calendar as CalendarIcon, CheckCircle, XCircle, Repeat, MessageCircle, Tag, AlertCircle, Wallet, Clock, Trophy, Share2, Image as ImageIcon, Pencil, Upload, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, COMMON_CATEGORIES, MatchType } from '../types';
import { convertFileToBase64 } from '../utils';

interface FieldDashboardProps {
  field: Field;
  slots: MatchSlot[];
  onAddSlot: (slot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => void;
  onEditSlot: (slotId: string, updates: Partial<MatchSlot>) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, 
  slots, 
  onAddSlot,
  onEditSlot,
  onConfirmBooking,
  onRejectBooking
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [showNotifyModal, setShowNotifyModal] = useState<MatchSlot | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form State (Create)
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [matchType, setMatchType] = useState<MatchType>('AMISTOSO');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  
  const [hasLocalTeam, setHasLocalTeam] = useState(true);
  const [localTeamName, setLocalTeamName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Quando muda o tipo de jogo, ajusta defaults
  const handleTypeChange = (type: MatchType) => {
    setMatchType(type);
    if (type === 'ALUGUEL') {
        setHasLocalTeam(false);
        setLocalTeamName('');
    } else {
        setHasLocalTeam(true);
    }
  };

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await convertFileToBase64(file);
        setCustomImageUrl(base64);
      } catch (err) {
        alert('Erro ao processar imagem.');
      }
    }
  };

  const handleCreateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime) return;

    // Se o usuário não digitar preço, usa o padrão do campo (proporcional à hora seria ideal, mas usaremos a taxa base ou o input)
    const finalPrice = customPrice ? Number(customPrice) : field.hourlyRate;

    onAddSlot({
      fieldId: field.id,
      date: newDate,
      time: newTime,
      durationMinutes: duration,
      matchType: matchType,
      customImageUrl: customImageUrl || undefined,
      isBooked: false,
      hasLocalTeam: hasLocalTeam,
      localTeamName: hasLocalTeam ? localTeamName : undefined,
      allowedCategories: selectedCategories.length > 0 ? selectedCategories : ["Livre"],
      status: 'available',
      price: finalPrice
    }, isRecurring);

    setSuccessMsg('Horário criado com sucesso!');
    setTimeout(() => {
      setSuccessMsg('');
      setShowAddModal(false);
      resetForm();
    }, 1500);
  };

  const resetForm = () => {
      setNewDate('');
      setNewTime('');
      setDuration(60);
      setCustomPrice('');
      setCustomImageUrl('');
      setHasLocalTeam(true);
      setLocalTeamName('');
      setIsRecurring(false);
      setSelectedCategories([]);
  };

  // --- Edit Logic ---
  const handleEditClick = (slot: MatchSlot) => {
      setEditingSlot(slot);
      // Pre-fill fields for edit form logic (using a separate simple form inside modal for clarity)
  };

  const handleSaveEdit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSlot) return;
      
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      const updates: Partial<MatchSlot> = {
          price: Number(formData.get('price')),
          durationMinutes: Number(formData.get('duration')),
          matchType: formData.get('matchType') as MatchType,
          hasLocalTeam: formData.get('hasLocalTeam') === 'on',
          localTeamName: formData.get('localTeamName') as string,
      };

      if (updates.matchType === 'ALUGUEL') {
          updates.hasLocalTeam = false;
          updates.localTeamName = '';
      }

      onEditSlot(editingSlot.id, updates);
      setEditingSlot(null);
  };

  const handleWhatsAppClick = (phone: string, text: string) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleConfirmPayment = (slot: MatchSlot) => {
    onConfirmBooking(slot.id);
    // Abre modal para o dono escolher quem notificar (browsers bloqueiam múltiplos popups automáticos)
    setShowNotifyModal(slot);
  };

  const sortedSlots = [...slots].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  
  const inputClass = "w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-grass-500 outline-none";

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <h2 className="text-3xl font-bold text-pitch">{field.name}</h2>
          <p className="text-gray-500 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Taxa Base: R$ {field.hourlyRate}/hr</p>
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
              
              {/* Edit Icon */}
              <button 
                onClick={() => handleEditClick(slot)}
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition z-10"
                title="Editar horário"
              >
                  <Pencil className="w-4 h-4" />
              </button>

              {/* Header do Card */}
              <div>
                  <div className="flex justify-between items-start mb-2 pr-6">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                      <div>
                        <span className="font-bold text-lg block">{slot.time}</span>
                        <span className="text-xs text-gray-500">{slot.date.split('-').reverse().join('/')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status & Info */}
                  <div className="flex justify-between items-center mb-2">
                       <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        slot.status === 'available' ? 'bg-blue-100 text-blue-700' :
                        slot.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {slot.status === 'available' ? 'Disponível' : 
                         slot.status === 'confirmed' ? 'Confirmado' : 'Aguardando'}
                      </span>
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {slot.durationMinutes} min
                      </span>
                  </div>
                  
                  {/* Tipo de Jogo Badge */}
                  <div className="mb-3 flex justify-between items-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        slot.matchType === 'FESTIVAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        slot.matchType === 'ALUGUEL' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                    }`}>
                        {slot.matchType}
                    </span>
                    <span className="text-sm font-bold text-green-700">R$ {slot.price}</span>
                  </div>

                  {slot.customImageUrl && (
                      <div className="mb-3 h-24 w-full rounded-lg bg-gray-100 overflow-hidden relative">
                          <img src={slot.customImageUrl} alt="Foto do evento" className="w-full h-full object-cover" />
                      </div>
                  )}

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

                  {!slot.hasLocalTeam && slot.matchType === 'ALUGUEL' && (
                     <div className="mb-3 flex items-start gap-2 text-purple-700 bg-purple-50 p-2 rounded-lg text-sm border border-purple-100">
                        <Share2 className="w-4 h-4 mt-0.5" />
                        <div>
                           <span className="font-bold block">Aluguel de Quadra</span>
                           <span className="text-xs">2 Times de Fora</span>
                        </div>
                     </div>
                  )}

                  {(slot.bookedByTeamName) && (
                      <div className="mb-3 p-2 bg-white/50 rounded text-sm border border-gray-100 space-y-1">
                          <p className="text-gray-500 text-xs uppercase font-bold">Solicitante (Pagante):</p>
                          <div className="flex justify-between items-center">
                              <p className="font-semibold">{slot.bookedByTeamName} <span className="text-xs font-normal text-gray-500">({slot.bookedByCategory})</span></p>
                              {slot.bookedByPhone && (
                                <button 
                                    onClick={() => handleWhatsAppClick(slot.bookedByPhone!, `Olá ${slot.bookedByTeamName}, sobre o jogo...`)}
                                    className="text-green-600 hover:text-green-800"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                </button>
                              )}
                          </div>
                          
                          {slot.opponentTeamName && (
                             <div className="pt-1 border-t border-gray-100 mt-1">
                                <p className="text-gray-500 text-xs uppercase font-bold">Adversário:</p>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{slot.opponentTeamName}</p>
                                    {slot.opponentTeamPhone && (
                                        <button 
                                            onClick={() => handleWhatsAppClick(slot.opponentTeamPhone!, `Olá, sobre o jogo contra o ${slot.bookedByTeamName}...`)}
                                            className="text-green-600 hover:text-green-800"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                             </div>
                          )}
                      </div>
                  )}
              </div>

              <div className="border-t pt-3 mt-2">
                {slot.status === 'pending_verification' && (
                  <div>
                     <p className="text-sm font-semibold mb-2 text-orange-700 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Pagamento Recebido?
                     </p>
                     <div className="flex gap-2 flex-col">
                        <Button size="sm" variant="primary" className="flex-1 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleConfirmPayment(slot)}>
                           <CheckCircle className="w-3 h-3" /> Confirmar & Notificar
                        </Button>
                        <Button size="sm" variant="danger" className="flex-1 text-xs" onClick={() => onRejectBooking(slot.id)}>
                           <XCircle className="w-3 h-3" /> Não recebi, Cancelar
                        </Button>
                     </div>
                  </div>
                )}
                {slot.status === 'available' && (
                  <p className="text-sm text-gray-400 text-center">Aguardando reservas...</p>
                )}
                {slot.status === 'confirmed' && (
                  <div className="text-center">
                      <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4" /> Jogo Confirmado
                      </p>
                      <button 
                         onClick={() => setShowNotifyModal(slot)}
                         className="text-xs text-blue-500 underline"
                      >
                        Reenviar Notificações
                      </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Slot */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Adicionar Horário na Agenda</h3>
            
            {successMsg ? (
               <div className="bg-green-500/20 text-green-400 p-4 rounded text-center font-bold border border-green-500 mb-4">
                  {successMsg}
               </div>
            ) : (
              <form onSubmit={handleCreateSlot} className="space-y-4">
                
                {/* Linha 1: Data e Hora */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Data</label>
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
                    <label className="block text-xs font-medium text-gray-300 mb-1">Início</label>
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

                {/* Linha 2: Duração e Tipo */}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Duração</label>
                      <select 
                         className={inputClass}
                         value={duration}
                         onChange={e => setDuration(Number(e.target.value))}
                      >
                         <option value={60}>1 hora (60 min)</option>
                         <option value={90}>1h 30min (90 min)</option>
                         <option value={120}>2 horas (120 min)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Tipo de Jogo</label>
                      <select 
                         className={inputClass}
                         value={matchType}
                         onChange={e => handleTypeChange(e.target.value as MatchType)}
                      >
                         <option value="AMISTOSO">Amistoso (Comum)</option>
                         <option value="FESTIVAL">Festival (Troféu)</option>
                         <option value="ALUGUEL">Aluguel (Sem time local)</option>
                      </select>
                   </div>
                </div>

                {/* Linha 3: Preço Específico */}
                <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Valor para este jogo (R$)</label>
                    <div className="relative">
                       <DollarSign className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                       <input 
                          type="number"
                          className={inputClass}
                          placeholder={`Padrão: ${field.hourlyRate}`}
                          value={customPrice}
                          onChange={e => setCustomPrice(e.target.value)}
                       />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Deixe em branco para usar a taxa padrão ({field.hourlyRate}).</p>
                </div>
                
                {/* Linha 4: Imagem Opcional */}
                <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Foto/Banner (Opcional)</label>
                   
                   {!customImageUrl ? (
                        <div className="relative border border-dashed border-gray-500 rounded bg-gray-700/50 p-4 hover:bg-gray-700 transition">
                            <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex items-center justify-center gap-2 text-gray-400">
                                <Upload className="w-5 h-5" />
                                <span className="text-sm">Carregar imagem</span>
                            </div>
                        </div>
                   ) : (
                        <div className="relative h-24 rounded overflow-hidden group border border-gray-600">
                            <img src={customImageUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setCustomImageUrl('')} className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white hover:bg-red-500">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                   )}
                </div>

                {/* Categorias */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Categorias Aceitas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition ${
                          selectedCategories.includes(cat) 
                            ? 'bg-grass-600 border-grass-500 text-white shadow-lg' 
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time da Casa (Se não for Aluguel) */}
                {matchType !== 'ALUGUEL' && (
                    <div className="border-t border-gray-600 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input 
                          type="checkbox" 
                          id="localTeam"
                          checked={hasLocalTeam}
                          onChange={e => setHasLocalTeam(e.target.checked)}
                          className="w-4 h-4 text-grass-600 rounded focus:ring-grass-500 bg-gray-700 border-gray-500"
                        />
                        <label htmlFor="localTeam" className="text-sm font-medium text-gray-300">
                          Tenho time local
                        </label>
                      </div>

                      {hasLocalTeam && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                          <input 
                              type="text"
                              className={inputClass}
                              placeholder="Nome do Time da Casa (Ex: Real Matismo)"
                              value={localTeamName}
                              onChange={e => setLocalTeamName(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                )}

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

      {/* Modal EDIT Slot */}
      {editingSlot && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
           <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white my-auto max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h3 className="text-xl font-bold">Editar Horário</h3>
                <button onClick={() => setEditingSlot(null)}><XCircle className="text-gray-400 hover:text-white" /></button>
             </div>
             
             <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                   <label className="block text-xs font-medium text-gray-300 mb-1">Preço (R$)</label>
                   <input type="number" name="price" defaultValue={editingSlot.price} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Duração (min)</label>
                      <select name="duration" defaultValue={editingSlot.durationMinutes} className={inputClass}>
                          <option value={60}>60 min</option>
                          <option value={90}>90 min</option>
                          <option value={120}>120 min</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Tipo</label>
                      <select name="matchType" defaultValue={editingSlot.matchType} className={inputClass}>
                          <option value="AMISTOSO">Amistoso</option>
                          <option value="FESTIVAL">Festival</option>
                          <option value="ALUGUEL">Aluguel</option>
                      </select>
                   </div>
                </div>

                <div className="border-t border-gray-600 pt-3">
                   <div className="flex items-center gap-2 mb-2">
                     <input type="checkbox" name="hasLocalTeam" defaultChecked={editingSlot.hasLocalTeam} className="w-4 h-4 bg-gray-700" />
                     <label className="text-sm font-medium text-gray-300">Tem Time Local?</label>
                   </div>
                   <input type="text" name="localTeamName" defaultValue={editingSlot.localTeamName || ''} placeholder="Nome do time local" className={inputClass} />
                </div>

                <Button type="submit" className="w-full mt-4">Salvar Alterações</Button>
             </form>
           </div>
         </div>
      )}

      {/* Modal Notification (Confirmation) */}
      {showNotifyModal && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
               <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h3>
               <p className="text-gray-600 mb-6 text-sm">
                  O horário está reservado. Clique abaixo para avisar os times via WhatsApp.
               </p>

               <div className="space-y-3">
                  {showNotifyModal.bookedByPhone && (
                     <Button 
                        onClick={() => handleWhatsAppClick(
                            showNotifyModal.bookedByPhone!, 
                            `Olá ${showNotifyModal.bookedByTeamName}, seu jogo no ${field.name} dia ${showNotifyModal.date.split('-').reverse().join('/')} foi CONFIRMADO!`
                        )}
                        className="w-full bg-green-600 hover:bg-green-700"
                     >
                        <MessageCircle className="w-4 h-4" /> Avisar {showNotifyModal.bookedByTeamName} (Pagante)
                     </Button>
                  )}

                  {showNotifyModal.opponentTeamPhone && (
                      <Button 
                        onClick={() => handleWhatsAppClick(
                            showNotifyModal.opponentTeamPhone!, 
                            `Olá ${showNotifyModal.opponentTeamName}, o jogo contra ${showNotifyModal.bookedByTeamName} no ${field.name} dia ${showNotifyModal.date.split('-').reverse().join('/')} foi CONFIRMADO!`
                        )}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                     >
                        <MessageCircle className="w-4 h-4" /> Avisar {showNotifyModal.opponentTeamName} (Adversário)
                     </Button>
                  )}
               </div>

               <button 
                 onClick={() => setShowNotifyModal(null)}
                 className="mt-6 text-gray-400 text-sm hover:text-gray-600"
               >
                 Fechar
               </button>
            </div>
         </div>
      )}
    </div>
  );
};