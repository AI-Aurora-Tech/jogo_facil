
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, X, Swords, Edit3, MessageCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER } from '../types';
import { api } from '../api';

interface FieldDashboardProps {
  categories: string[];
  field: Field;
  slots: MatchSlot[];
  currentUser: User;
  onAddSlot: (slots: Omit<MatchSlot, 'id'>[]) => Promise<void>;
  onRefreshData: () => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [newSlotDate, setNewSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState('18:00');
  const [newSlotType, setNewSlotType] = useState<MatchType>('AMISTOSO');
  const [newSlotPrice, setNewSlotPrice] = useState(field.hourlyRate || 0);
  const [isLocalTeamChecked, setIsLocalTeamChecked] = useState(false);
  
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Calculate allowed categories based on ±1 rule
  const calculateAllowedRange = (cat: string): string[] => {
    const idx = CATEGORY_ORDER.indexOf(cat);
    if (idx === -1) return [cat];
    const range = [];
    if (idx > 0) range.push(CATEGORY_ORDER[idx - 1]);
    range.push(CATEGORY_ORDER[idx]);
    if (idx < CATEGORY_ORDER.length - 1) range.push(CATEGORY_ORDER[idx + 1]);
    return range;
  };

  const handleSaveSlot = async () => {
    setIsLoading(true);
    try {
      const allowedCats = selectedCategory ? calculateAllowedRange(selectedCategory) : [];
      const team = currentUser.teams[selectedTeamIdx];

      const payload: Omit<MatchSlot, 'id'> = {
        fieldId: field.id,
        date: newSlotDate,
        time: newSlotTime,
        durationMinutes: 60,
        matchType: newSlotType,
        isBooked: false,
        hasLocalTeam: isLocalTeamChecked,
        localTeamName: isLocalTeamChecked ? team.name : undefined,
        localTeamCategory: isLocalTeamChecked ? selectedCategory : undefined,
        localTeamPhone: isLocalTeamChecked ? currentUser.phoneNumber : undefined,
        allowedOpponentCategories: allowedCats,
        price: newSlotPrice,
        status: 'available'
      };
      await onAddSlot([payload]);
      setShowModal(false);
    } catch (e) {
      alert("Erro ao salvar.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDayName = (dateStr: string) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][new Date(`${dateStr}T00:00:00`).getDay()];

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="p-6 bg-white border-b sticky top-0 z-20 glass">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-pitch rounded-2xl overflow-hidden border-2 border-white shadow-md">
                <img src={field.imageUrl} className="w-full h-full object-cover" />
             </div>
             <div>
                <h1 className="font-black text-pitch italic uppercase tracking-tighter leading-none">{field.name}</h1>
                <p className="text-[9px] font-black text-gray-400 uppercase mt-1">Gestão de Arena</p>
             </div>
          </div>
          <button onClick={() => setShowModal(true)} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md"><Plus className="w-5 h-5"/></button>
        </div>
        <div className="flex p-1 bg-gray-100 rounded-2xl">
          {['AGENDA', 'MENSALISTAS', 'HISTORICO'].map((t: any) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === t ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-3">
          {slots.filter(s => s.status !== 'confirmed').map(s => (
            <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border text-center">
                      <span className="text-[8px] font-black uppercase opacity-60 leading-none">{getDayName(s.date)}</span>
                      <span className="text-[11px] font-black">{s.time}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-grass-100 text-grass-600">{s.matchType}</span>
                       <span className="text-[8px] font-black text-gray-400 uppercase italic">Para: {s.allowedOpponentCategories.join(', ')}</span>
                    </div>
                    <p className="font-black text-pitch text-sm mt-1">{s.localTeamName || 'Vaga Aberta'} ({s.localTeamCategory || 'Sem Filtro'})</p>
                  </div>
               </div>
               <button onClick={() => onDeleteSlot(s.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500">
             <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black italic uppercase text-pitch">Criar Horário</h2>
               <button onClick={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
             </div>
             
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                      <input type="date" className="w-full bg-transparent font-black outline-none" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} />
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border">
                      <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora</label>
                      <input type="time" className="w-full bg-transparent font-black outline-none" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
                   </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border">
                   <div className="flex items-center gap-3 mb-4">
                      <input type="checkbox" id="local" className="w-5 h-5" checked={isLocalTeamChecked} onChange={e => setIsLocalTeamChecked(e.target.checked)} />
                      <label htmlFor="local" className="text-[10px] font-black text-pitch uppercase">Incluir Mandante</label>
                   </div>
                   
                   {isLocalTeamChecked && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Qual Time irá jogar?</label>
                            <div className="flex gap-2">
                               {currentUser.teams.map((t, i) => (
                                  <button key={i} onClick={() => { setSelectedTeamIdx(i); setSelectedCategory(''); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedTeamIdx === i ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{t.name}</button>
                               ))}
                            </div>
                         </div>
                         <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria Mandante</label>
                            <div className="flex flex-wrap gap-2">
                               {currentUser.teams[selectedTeamIdx]?.categories.map(c => (
                                  <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all ${selectedCategory === c ? 'bg-grass-500 text-pitch' : 'bg-white border text-gray-400'}`}>{c}</button>
                               ))}
                            </div>
                         </div>
                         {selectedCategory && (
                            <div className="p-3 bg-grass-50 rounded-xl border border-grass-100">
                               <p className="text-[9px] font-black text-grass-700 uppercase">Regra competitiva: Aceita adversários {calculateAllowedRange(selectedCategory).join(', ')}</p>
                            </div>
                         )}
                      </div>
                   )}
                </div>

                <Button onClick={handleSaveSlot} isLoading={isLoading} className="w-full py-5 rounded-[2rem] font-black uppercase text-xs shadow-xl">Publicar Horário</Button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};
