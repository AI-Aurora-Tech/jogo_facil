
import React, { useState } from 'react';
import { X, Trophy, Check, Calendar, Clock, Activity, MapPin } from 'lucide-react';
import { Button } from './Button';
import { Field, User, CATEGORY_ORDER, SPORTS, Gender } from '../types';
import { api } from '../api';

interface MensalistaSubscriptionModalProps {
  fields: Field[];
  currentUser: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const MensalistaSubscriptionModal: React.FC<MensalistaSubscriptionModalProps> = ({ 
  fields, 
  currentUser, 
  onClose,
  onSuccess 
}) => {
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('19:00');
  const [sport, setSport] = useState('Futebol');
  const [court, setCourt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const team = currentUser.teams?.[selectedTeamIdx];

  const handleRequest = async () => {
    if (!selectedField) {
      alert("Selecione um campo.");
      return;
    }
    if (!team) {
      alert("Selecione um time.");
      return;
    }
    if (!selectedCategory) {
      alert("Selecione uma categoria.");
      return;
    }

    setIsLoading(true);
    try {
      await api.addRegisteredTeam({
        fieldId: selectedField.id,
        name: team.name,
        fixedDay: String(day),
        fixedTime: time,
        fixedDurationMinutes: 60,
        categories: [selectedCategory],
        logoUrl: team.logoUrl,
        captainName: currentUser.name,
        captainPhone: currentUser.phoneNumber,
        captainUserId: currentUser.id,
        email: currentUser.email,
        gender: team.gender,
        sport: sport,
        courtName: court || selectedField.courts[0] || 'Principal',
        status: 'pending'
      });

      await api.createNotification({
        userId: selectedField.ownerId,
        title: "Nova Solicitação de Mensalista! 📅",
        description: `O time ${team.name} quer ser mensalista às ${time} nas ${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][day]}s.`,
        type: 'info'
      });

      onSuccess("Solicitação enviada! O dono da arena irá analisar seu pedido.");
      onClose();
    } catch (e: any) {
      alert("Erro ao enviar solicitação: " + (e.message || "Erro desconhecido"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[500] flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-lg sm:rounded-[3rem] rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl font-black italic uppercase text-pitch">Seja Mensalista</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase">Solicite horários fixos em arenas</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-6 h-6 text-pitch" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Seleção de Arena */}
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">1. Escolha a Arena</label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
              {fields.map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedField(f);
                    setCourt(f.courts[0] || '');
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${selectedField?.id === f.id ? 'border-pitch bg-grass-50 ring-2 ring-pitch/10' : 'bg-gray-50 border-gray-100'}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-pitch overflow-hidden flex-shrink-0">
                    <img src={f.imageUrl} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-pitch uppercase truncate">{f.name}</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase truncate flex items-center gap-1">
                      <MapPin className="w-2 h-2" /> {f.location}
                    </p>
                  </div>
                  {selectedField?.id === f.id && <Check className="w-4 h-4 text-grass-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">2. Seu Time</label>
              <select 
                className="w-full p-4 bg-gray-50 border rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-pitch/10" 
                value={selectedTeamIdx} 
                onChange={e => setSelectedTeamIdx(Number(e.target.value))}
              >
                {currentUser.teams.map((t, i) => (
                  <option key={i} value={i}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-2">3. Categoria</label>
              <select 
                className="w-full p-4 bg-gray-50 border rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-pitch/10" 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="">Selecionar</option>
                {team?.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Detalhes do Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia da Semana</label>
              <select className="w-full bg-transparent font-black outline-none text-[10px] uppercase" value={day} onChange={e => setDay(Number(e.target.value))}>
                {['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário</label>
              <input type="time" className="w-full bg-transparent font-black outline-none text-[10px]" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
              <select className="w-full bg-transparent font-black outline-none text-[10px] uppercase" value={sport} onChange={e => setSport(e.target.value)}>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border">
              <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Quadra/Local</label>
              <select 
                className="w-full bg-transparent font-black outline-none text-[10px] uppercase" 
                value={court} 
                onChange={e => setCourt(e.target.value)}
                disabled={!selectedField}
              >
                <option value="">Principal</option>
                {selectedField?.courts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <Button 
            onClick={handleRequest} 
            isLoading={isLoading}
            className="w-full py-5 rounded-[2rem] bg-pitch hover:bg-pitch/90 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-pitch/20 transition-all active:scale-[0.98]"
          >
            Enviar Solicitação
          </Button>
        </div>
      </div>
    </div>
  );
};
