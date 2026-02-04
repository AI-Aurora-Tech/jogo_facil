
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, Loader2, X, Swords, Edit3, MessageCircle, TrendingUp, CheckCircle2, User as UserIcon, CalendarDays, History as HistoryIcon, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle, CalendarPlus, Mail, Camera, UserPlus } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam, SPORTS, Gender } from '../types';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { convertFileToBase64 } from '../utils';

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
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
  onRateTeam: () => void;
  forceTab?: 'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO';
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser, categories, onUpdateField, onRateTeam, forceTab
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<MatchSlot | null>(null);
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);

  // Form States Mensalista
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaEmail, setMensalistaEmail] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState('');
  const [mensalistaLogo, setMensalistaLogo] = useState('');
  const [mensalistaGender, setMensalistaGender] = useState<Gender>('MASCULINO');
  const [mensalistaSport, setMensalistaSport] = useState('Futebol');
  const [mensalistaCourt, setMensalistaCourt] = useState(field.courts?.[0] || 'Principal');

  useEffect(() => {
    if (forceTab) setActiveTab(forceTab);
  }, [forceTab]);

  useEffect(() => {
    loadMensalistas();
  }, [field.id]);

  const loadMensalistas = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (e) { console.error(e); }
  };

  const handleGenerateRecurringSlots = async (team: RegisteredTeam) => {
    if (!confirm(`Deseja gerar os próximos 10 jogos para ${team.name}?`)) return;
    
    setIsLoading(true);
    try {
      const targetDay = Number(team.fixedDay);
      const newSlots: Partial<MatchSlot>[] = [];
      
      const teamSlots = slots.filter(s => s.localTeamName === team.name && s.fieldId === field.id).sort((a,b) => b.date.localeCompare(a.date));
      let startDate = new Date();
      if (teamSlots.length > 0) {
        startDate = new Date(`${teamSlots[0].date}T12:00:00`);
        startDate.setDate(startDate.getDate() + 1);
      }

      let current = new Date(startDate);
      while (current.getDay() !== targetDay) {
        current.setDate(current.getDate() + 1);
      }

      for (let i = 0; i < 10; i++) {
        const dateStr = current.toISOString().split('T')[0];
        const exists = slots.find(s => s.date === dateStr && s.time === team.fixedTime && s.fieldId === field.id && s.courtName === team.courtName);
        
        if (!exists) {
          newSlots.push({
            fieldId: field.id,
            date: dateStr,
            time: team.fixedTime,
            durationMinutes: 60,
            matchType: 'FIXO',
            isBooked: false, 
            hasLocalTeam: true,
            localTeamName: team.name,
            localTeamCategory: team.categories?.[0] || 'Livre',
            localTeamPhone: team.captainPhone,
            localTeamLogoUrl: team.logoUrl,
            localTeamGender: team.gender,
            allowedOpponentCategories: team.categories?.[0] ? [team.categories[0]] : [],
            price: field.hourlyRate,
            status: 'available',
            courtName: team.courtName,
            sport: team.sport
          });
        }
        current.setDate(current.getDate() + 7);
      }

      if (newSlots.length > 0) {
        await api.createSlots(newSlots);
        alert(`${newSlots.length} novos horários foram gerados.`);
        onRefreshData();
      } else {
        alert("Sua agenda para este mensalista já está atualizada.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar agenda. Certifique-se de que as colunas do banco foram criadas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    if (!mensalistaName || !mensalistaPhone || !mensalistaEmail || !mensalistaCategory) {
      alert("Campos obrigatórios: Nome do Time, Categoria, Telefone e E-mail.");
      return;
    }
    setIsLoading(true);
    try {
      const payload: Partial<RegisteredTeam> = {
        fieldId: field.id,
        name: mensalistaName,
        fixedDay: String(mensalistaDay),
        fixedTime: mensalistaTime,
        categories: [mensalistaCategory],
        captainName: mensalistaCaptain,
        captainPhone: mensalistaPhone,
        email: mensalistaEmail,
        logoUrl: mensalistaLogo,
        gender: mensalistaGender,
        sport: mensalistaSport,
        courtName: mensalistaCourt
      };

      if (editingMensalista) {
        await api.updateRegisteredTeam(editingMensalista.id, payload);
      } else {
        await api.addRegisteredTeam(payload);
      }
      setShowAddMensalistaModal(false);
      loadMensalistas();
      alert("Mensalista salvo!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar mensalista.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="flex gap-2">
            <button onClick={() => onRefreshData()} className="p-3 bg-gray-100 rounded-xl active:rotate-180 transition-transform"><RefreshCcw className="w-5 h-5"/></button>
            <button onClick={() => setShowAddSlotModal(true)} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md">
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl overflow-x-auto scrollbar-hide">
          {['AGENDA', 'SOLICITACOES', 'MENSALISTAS', 'HISTORICO'].map((tab: any) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
              {tab === 'AGENDA' && <CalendarDays className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'SOLICITACOES' && <MessageCircle className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'MENSALISTAS' && <UserCheck className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'HISTORICO' && <HistoryIcon className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm space-y-4 group hover:border-pitch transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border overflow-hidden">
                        {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xl">{t.name.charAt(0)}</div>}
                      </div>
                      <div>
                          <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                          <div className="flex items-center gap-2 mt-2">
                             <span className="text-[8px] font-black bg-pitch text-grass-500 px-2 py-0.5 rounded uppercase">{t.gender}</span>
                             <span className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">{t.sport}</span>
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3"/> {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime} • {t.courtName}
                          </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setEditingMensalista(t);
                        setMensalistaName(t.name);
                        setMensalistaEmail(t.email || '');
                        setMensalistaPhone(t.captainPhone || '');
                        setMensalistaCaptain(t.captainName || '');
                        setMensalistaDay(Number(t.fixedDay));
                        setMensalistaTime(t.fixedTime);
                        setMensalistaCategory(t.categories[0] || '');
                        setMensalistaLogo(t.logoUrl || '');
                        setMensalistaGender(t.gender);
                        setMensalistaSport(t.sport);
                        setMensalistaCourt(t.courtName);
                        setShowAddMensalistaModal(true);
                      }} className="p-3 text-gray-300 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                      <button onClick={() => { if(confirm("Remover mensalista?")) api.deleteRegisteredTeam(t.id).then(loadMensalistas); }} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => handleGenerateRecurringSlots(t)} isLoading={isLoading} className="w-full py-4 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border-dashed">
                    <CalendarPlus className="w-4 h-4" /> Gerar Próximos 10 Jogos
                  </Button>
               </div>
             ))}
             <button onClick={() => { 
               setEditingMensalista(null); 
               setMensalistaName(''); 
               setMensalistaLogo('');
               setMensalistaCategory('');
               setShowAddMensalistaModal(true); 
             }} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px] hover:border-pitch transition-all">
               Adicionar Novo Mensalista
             </button>
          </div>
        )}
      </div>

      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar Mensalista' : 'Novo Mensalista'}</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>

              <div className="space-y-6">
                 <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
                       {mensalistaLogo ? (
                         <img src={mensalistaLogo} className="w-full h-full object-cover" />
                       ) : (
                         <Camera className="w-8 h-8 text-gray-300" />
                       )}
                       <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                           const base64 = await convertFileToBase64(file);
                           setMensalistaLogo(base64);
                         }
                       }} />
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase">Logo do Time (Opcional)</span>
                 </div>

                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome do Time</label>
                    <input className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} placeholder="Ex: Galácticos FC" />
                 </div>

                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Categoria</label>
                    <div className="flex flex-wrap gap-2">
                       {CATEGORY_ORDER.map(c => (
                          <button key={c} onClick={() => setMensalistaCategory(c)} className={`px-3 py-2 rounded-full text-[9px] font-black uppercase transition-all ${mensalistaCategory === c ? 'bg-pitch text-white' : 'bg-white border text-gray-400'}`}>{c}</button>
                       ))}
                    </div>
                 </div>

                 <div className="bg-gray-50 p-4 rounded-2xl border">
                    <label className="text-[8px] font-black text-gray-400 uppercase block mb-2">Gênero</label>
                    <div className="flex p-1 bg-white rounded-xl border">
                       {['MASCULINO', 'FEMININO', 'MISTO'].map((g: any) => (
                         <button key={g} onClick={() => setMensalistaGender(g)} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${mensalistaGender === g ? 'bg-pitch text-white' : 'text-gray-300'}`}>{g}</button>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia Fixo</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs uppercase" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário Fixo</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                 </div>

                 <div className="bg-pitch/5 p-6 rounded-[2.5rem] border border-pitch/10 space-y-4">
                    <p className="text-[10px] font-black text-pitch uppercase italic mb-2">Dados de Acesso do Capitão</p>
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="E-mail do Capitão" type="email" value={mensalistaEmail} onChange={e => setMensalistaEmail(e.target.value)} />
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="WhatsApp (Senha)" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} />
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="Nome do Capitão" value={mensalistaCaptain} onChange={e => setMensalistaCaptain(e.target.value)} />
                 </div>
                 
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl">
                   {editingMensalista ? 'Atualizar Dados' : 'Cadastrar Mensalista'}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
