
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Calendar, Clock, RefreshCcw, X, Swords, Edit3, MessageCircle, UserCheck, Phone, Edit, Building2, MapPin, LayoutGrid, Flag, Trophy, CheckCircle, XCircle, AlertCircle, CalendarPlus, Mail, Camera, UserPlus, Smartphone, CalendarDays, History as HistoryIcon, BadgeCheck, Ban, Lock, Search, Filter, Sparkles, ChevronDown, CalendarRange, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, MatchSlot, MatchType, User, CATEGORY_ORDER, RegisteredTeam, SPORTS, Gender, MatchStatus } from '../types';
import { api } from '../api';
import { convertFileToBase64, getNeighboringCategories } from '../utils';

interface FieldDashboardProps {
  categories: string[];
  field: Field;
  slots: MatchSlot[];
  currentUser: User;
  onAddSlot: (slots: Omit<MatchSlot, 'id'>[]) => Promise<void>;
  onUpdateSlot: (slotId: string, updates: Partial<MatchSlot>) => Promise<void>;
  onRefreshData: () => void;
  onDeleteSlot: (slotId: string) => void;
  onConfirmBooking: (slotId: string) => void;
  onRejectBooking: (slotId: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<Field>) => Promise<boolean>;
  onRateTeam: () => void;
  forceTab?: 'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO';
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({ 
  field, slots, onAddSlot, onUpdateSlot, onRefreshData, onDeleteSlot, onConfirmBooking, onRejectBooking, currentUser, categories, onUpdateField, onRateTeam, forceTab
}) => {
  const [activeTab, setActiveTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO'>('AGENDA');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredTeams, setRegisteredTeams] = useState<RegisteredTeam[]>([]);
  const [awayGames, setAwayGames] = useState<MatchSlot[]>([]);
  
  // States Modais
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [showAddMensalistaModal, setShowAddMensalistaModal] = useState(false);
  
  // States Criação/Edição Slot
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('19:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slotMatchType, setSlotMatchType] = useState<MatchType>('AMISTOSO');
  const [slotCourt, setSlotCourt] = useState(field.courts?.[0] || 'Principal');
  const [slotPrice, setSlotPrice] = useState(field.hourlyRate);
  const [slotSport, setSlotSport] = useState('Society');
  
  const [isLocalTeamSlot, setIsLocalTeamSlot] = useState(false);
  const [manualLocalTeamName, setManualLocalTeamName] = useState(field.name || 'Time da Casa');
  const [manualLocalCategory, setManualLocalCategory] = useState(CATEGORY_ORDER[0]);
  const [localTeamGender, setLocalTeamGender] = useState<Gender>('MASCULINO');
  const [acceptsMixed, setAcceptsMixed] = useState(false);
  const [acceptNeighbors, setAcceptNeighbors] = useState(true);
  const [selectedRegisteredTeamId, setSelectedRegisteredTeamId] = useState<string>('');
  const [localTeamCategory, setLocalTeamCategory] = useState<string>('');

  // States Filtros Agenda
  const [filterRange, setFilterRange] = useState<string>('7'); 
  const [filterSpecificDate, setFilterSpecificDate] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterTag, setFilterTag] = useState('TODOS');
  const [showFilters, setShowFilters] = useState(false);
  const [agendaView, setAgendaView] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [calendarBaseDate, setCalendarBaseDate] = useState(new Date());
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [autoGenDate, setAutoGenDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoGenStartTime, setAutoGenStartTime] = useState('08:00');
  const [autoGenEndTime, setAutoGenEndTime] = useState('22:00');
  const [autoGenDuration, setAutoGenDuration] = useState(60);

  // States Mensalista
  const [editingMensalista, setEditingMensalista] = useState<RegisteredTeam | null>(null);
  const [mensalistaName, setMensalistaName] = useState('');
  const [mensalistaCaptain, setMensalistaCaptain] = useState('');
  const [mensalistaPhone, setMensalistaPhone] = useState('');
  const [mensalistaEmail, setMensalistaEmail] = useState('');
  const [mensalistaDay, setMensalistaDay] = useState(1);
  const [mensalistaTime, setMensalistaTime] = useState('19:00');
  const [mensalistaCategory, setMensalistaCategory] = useState(CATEGORY_ORDER[0]);
  const [mensalistaLogo, setMensalistaLogo] = useState('');
  const [mensalistaGender, setMensalistaGender] = useState<Gender>('MASCULINO');
  const [mensalistaSport, setMensalistaSport] = useState('Society');
  const [mensalistaCourt, setMensalistaCourt] = useState(field.courts?.[0] || 'Principal');
  const [mensalistaDuration, setMensalistaDuration] = useState(60);

  const todayStr = new Date().toISOString().split('T')[0];

  const [historicSlots, setHistoricSlots] = useState<MatchSlot[]>([]);

  // States Pagamento Jogo Fora
  const [selectedPaymentSlot, setSelectedPaymentSlot] = useState<MatchSlot | null>(null);
  const [paymentField, setPaymentField] = useState<Field | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const handleOpenPayment = async (slot: MatchSlot) => {
    setIsLoading(true);
    try {
      const allFields = await api.getFields();
      const targetField = allFields.find(f => f.id === slot.fieldId);
      if (targetField) {
        setPaymentField(targetField);
        setSelectedPaymentSlot(slot);
      } else {
        alert("Arena não encontrada.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar dados da arena.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPaymentSlot) return;

    setIsUploadingReceipt(true);
    try {
      const base64 = await convertFileToBase64(file);
      const fileName = `receipts/${selectedPaymentSlot.id}_${Date.now()}.png`;
      const publicUrl = await api.uploadFile('receipts', fileName, base64);

      await onUpdateSlot(selectedPaymentSlot.id, {
        status: 'pending_verification',
        receiptUrl: publicUrl,
        receiptUploadedAt: new Date().toISOString()
      });

      alert("Comprovante enviado com sucesso! Aguarde a validação.");
      setSelectedPaymentSlot(null);
      onRefreshData();
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar comprovante.");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleApproveMensalista = async (teamId: string) => {
    try {
      await api.updateRegisteredTeam(teamId, { status: 'approved' });
      alert('Mensalista aprovado com sucesso!');
      loadMensalistas();
    } catch (error) {
      alert('Erro ao aprovar mensalista.');
    }
  };



  useEffect(() => {
    if (forceTab) setActiveTab(forceTab);
  }, [forceTab]);

  useEffect(() => {
    if (activeTab === 'SOLICITACOES' && field?.id) {
      loadMensalistas();
    }
    if (activeTab === 'HISTORICO' && field?.id) {
      api.getSlotHistory(field.id).then(setHistoricSlots);
    }
  }, [activeTab, field?.id]);

  useEffect(() => {
    loadMensalistas();
  }, [field.id]);

  useEffect(() => {
    const fetchAwayGames = async () => {
      if (!currentUser.teams || currentUser.teams.length === 0) {
        setAwayGames([]);
        return;
      }
      try {
        // Robust way to get away games
        const teamSlots = await api.getSlotsForTeam(currentUser.id);
        
        // Filter out games that are on the current field
        const awaySlots = teamSlots.filter(slot => slot.fieldId !== field.id);
        
        // Ensure we only show games where the user's team is actually playing
        const teamNames = currentUser.teams.map(t => t.name.toLowerCase());
        const trulyAwayGames = awaySlots.filter(slot => {
          const myTeamIsPlaying = 
            (slot.localTeamName && teamNames.includes(slot.localTeamName.toLowerCase())) ||
            (slot.opponentTeamName && teamNames.includes(slot.opponentTeamName.toLowerCase())) ||
            (slot.bookedByTeamName && teamNames.includes(slot.bookedByTeamName.toLowerCase()));
          return myTeamIsPlaying;
        });

        setAwayGames(trulyAwayGames);
      } catch (error) {
        console.error("Could not fetch away games for team.", error);
        setAwayGames([]);
      }
    };

    fetchAwayGames();
  }, [currentUser.teams, field.id, slots]);

  useEffect(() => {
    // Atualiza nome padrão se o nome da arena carregar depois
    // Fix: Verifica se o nome atual é 'Carregando...' para substituir pelo nome real
    if (field.name && field.name !== 'Carregando...') {
       setManualLocalTeamName(prev => {
          if (prev === 'Time da Casa' || prev === 'Carregando...') return field.name;
          return prev;
       });
    }
  }, [field.name]);

  useEffect(() => {
    if (field.courts && field.courts.length > 0) {
      if (!field.courts.includes(slotCourt)) setSlotCourt(field.courts[0]);
      if (!field.courts.includes(mensalistaCourt)) setMensalistaCourt(field.courts[0]);
    }
  }, [field.courts]);

  useEffect(() => {
    if (!selectedRegisteredTeamId) {
      setLocalTeamCategory('');
      return;
    }

    let team;
    if (selectedRegisteredTeamId.startsWith('OWNER_TEAM_')) {
      const idx = parseInt(selectedRegisteredTeamId.split('_')[2]);
      team = currentUser.teams[idx];
    } else {
      team = registeredTeams.find(t => t.id === selectedRegisteredTeamId);
    }

    if (team && team.categories) {
      if (team.categories.length === 1) {
        setLocalTeamCategory(team.categories[0]);
      } else {
        setLocalTeamCategory('');
      }
    }
  }, [selectedRegisteredTeamId, currentUser.teams, registeredTeams]);

  const loadMensalistas = async () => {
    try {
      const teams = await api.getRegisteredTeams(field.id);
      setRegisteredTeams(teams);
    } catch (e) { console.error(e); }
  };



  const handleRejectMensalista = async (teamId: string) => {
    if (!confirm("Deseja realmente recusar esta solicitação?")) return;
    try {
      await api.updateRegisteredTeam(teamId, { status: 'rejected' });
      alert("Solicitação recusada.");
      loadMensalistas();
    } catch (e) {
      alert("Erro ao recusar.");
    }
  };

  const handleEditSlot = (slot: MatchSlot) => {
    setEditingSlotId(slot.id);
    setSlotDate(slot.date);
    setSlotTime(slot.time);
    setSlotDuration(slot.durationMinutes || 60);
    setSlotMatchType(slot.matchType);
    setSlotCourt(slot.courtName || field.courts[0]);
    setSlotPrice(slot.price);
    setSlotSport(slot.sport);
    setIsLocalTeamSlot(slot.hasLocalTeam);
    
    // Se o nome salvo for 'Carregando...', usa o nome atual da arena
    const displayTeamName = (slot.localTeamName === 'Carregando...' ? field.name : slot.localTeamName) || field.name || 'Time da Casa';
    setManualLocalTeamName(displayTeamName);
    
    setManualLocalCategory(slot.localTeamCategory || CATEGORY_ORDER[0]);
    setShowAddSlotModal(true);
  };

  const handleAction = async (slot: MatchSlot, action: 'confirm' | 'reject') => {
    setIsLoading(true);
    try {
      if (action === 'confirm') {
        let newStatus: MatchStatus = 'pending_payment';
        let title = "Desafio Aceito! 💸";
        let desc = `A arena ${field.name} aceitou seu desafio. Realize o pagamento via PIX para confirmar.`;

        if (slot.status === 'pending_verification') {
           newStatus = 'confirmed';
           title = "Pagamento Confirmado! ⚽";
           desc = `Seu pagamento para o jogo na arena ${field.name} foi validado!`;
        } else if (slot.status === 'pending_field_approval') {
           // Se não tem time local (é aluguel de horário livre), vai para waiting_opponent
           if (!slot.hasLocalTeam && !slot.opponentTeamName) {
              newStatus = 'waiting_opponent';
              title = "Reserva Aprovada! ⏳";
              desc = `Sua reserva foi aprovada pela arena. Aguardando um time adversário aceitar o jogo.`;
           } else if (slot.opponentTeamName) {
              // Contexto 3: Aprovação final do confronto
              newStatus = 'pending_payment';
              title = "Confronto Aprovado! 💸";
              desc = `A arena ${field.name} aprovou o confronto. Realizem o pagamento (50% cada) para confirmar.`;
           }
        }

        await api.updateSlot(slot.id, { status: newStatus });
        
        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title,
            description: desc,
            type: 'success'
          });
        }
        alert(newStatus === 'confirmed' ? "Pagamento confirmado!" : newStatus === 'waiting_opponent' ? "Reserva aprovada! Aguardando adversário." : "Desafio aceito! Aguardando pagamento.");
      } else {
        await api.updateSlot(slot.id, { 
          status: 'available', 
          bookedByUserId: undefined, 
          bookedByTeamName: undefined, 
          bookedByTeamCategory: undefined,
          opponentTeamName: undefined,
          opponentTeamCategory: undefined,
          opponentTeamPhone: undefined,
          opponentTeamLogoUrl: undefined,
          opponentTeamGender: undefined,
          receiptUrl: undefined,
          receiptUploadedAt: undefined,
          isBooked: false
        });
        
        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title: "Desafio Recusado ❌",
            description: `A arena ${field.name} não pôde aceitar seu desafio para o dia ${slot.date}.`,
            type: 'warning'
          });
        }
        alert("Solicitação recusada.");
      }
      onRefreshData();
    } catch (e) { 
      console.error(e);
      alert("Erro ao processar ação."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleCreateOrUpdateSlot = async () => {
    setIsLoading(true);
    try {
      if (isLocalTeamSlot && !selectedRegisteredTeamId) {
        alert("Por favor, selecione um time mandante.");
        setIsLoading(false);
        return;
      }

      // Check for overlapping slots
      const newSlotStart = new Date(`${slotDate}T${slotTime}`);
      const newSlotEnd = new Date(newSlotStart.getTime() + slotDuration * 60000);

      const overlappingSlot = slots.find(slot => {
        if (slot.id === editingSlotId) return false; // Don't compare with itself when editing
        if (slot.date !== slotDate || slot.courtName !== slotCourt) return false;

        const existingSlotStart = new Date(`${slot.date}T${slot.time}`);
        const existingSlotEnd = new Date(existingSlotStart.getTime() + slot.durationMinutes * 60000);

        return newSlotStart < existingSlotEnd && newSlotEnd > existingSlotStart;
      });

      if (overlappingSlot) {
        alert(`Este horário conflita com um horário existente (${overlappingSlot.time}) na mesma quadra.`);
        setIsLoading(false);
        return;
      }

      let teamName = null;
      let teamCategory = null;
      let teamPhone = null;
      let teamGender = null;
      let teamLogo = null;
      let homeTeamType = 'LOCAL';

      if (isLocalTeamSlot) {
        if (selectedRegisteredTeamId) {
          if (selectedRegisteredTeamId.startsWith('OWNER_TEAM_')) {
             const idx = parseInt(selectedRegisteredTeamId.split('_')[2]);
             const ownerTeam = currentUser.teams[idx];
             if (ownerTeam) {
                teamName = ownerTeam.name;
                teamCategory = localTeamCategory;
                teamPhone = field.contactPhone; // Owner's phone
                teamGender = ownerTeam.gender;
                teamLogo = ownerTeam.logoUrl;
                homeTeamType = 'LOCAL';
             }
          } else {
             const regTeam = registeredTeams.find(t => t.id === selectedRegisteredTeamId);
             if (regTeam) {
               teamName = regTeam.name;
               teamCategory = localTeamCategory;
               teamPhone = regTeam.captainPhone;
               teamGender = regTeam.gender;
               teamLogo = regTeam.logoUrl;
               homeTeamType = 'MENSALISTA';
             }
          }
        } 
      } else {
        teamGender = localTeamGender;
      }

      const allowedGenders: Gender[] = [teamGender!];
      if (acceptsMixed) {
        allowedGenders.push('MISTO');
      }

      const allowedCats = acceptNeighbors && teamCategory
        ? getNeighboringCategories(teamCategory)
        : (teamCategory ? [teamCategory] : []);

      const slotData = {
        fieldId: field.id,
        date: slotDate,
        time: slotTime,
        durationMinutes: slotDuration,
        matchType: isLocalTeamSlot ? 'AMISTOSO' : slotMatchType,
        isBooked: isLocalTeamSlot, 
        hasLocalTeam: isLocalTeamSlot,
        localTeamName: teamName,
        localTeamCategory: teamCategory,
        localTeamPhone: teamPhone,
        localTeamGender: teamGender,
        localTeamLogoUrl: teamLogo,
        homeTeamType: homeTeamType,
        price: slotPrice,
        status: isLocalTeamSlot ? 'confirmed' : 'available',
        courtName: slotCourt,
        sport: slotSport,
        allowedOpponentCategories: isLocalTeamSlot ? allowedCats : [],
        allowedOpponentGenders: allowedGenders
      } as any;

      if (editingSlotId) {
        // Ao editar, não queremos mudar o status ou isBooked diretamente aqui
        // A menos que a lógica de negócio exija.
        const updateData = { ...slotData };
        delete updateData.isBooked;
        delete updateData.status;
        await onUpdateSlot(editingSlotId, updateData);
        alert("Horário atualizado com sucesso!");

        const originalSlot = slots.find(s => s.id === editingSlotId);
        if (originalSlot && originalSlot.bookedByUserId) {
          await api.createNotification({
            userId: originalSlot.bookedByUserId,
            title: "Jogo Remarcado!  rescheduled️",
            description: `O jogo na arena ${field.name} foi remarcado para ${slotDate.split('-').reverse().join('/')} às ${slotTime}.`,
            type: 'info'
          });
        }
      } else {
        await onAddSlot([slotData]);
        alert("Horário criado com sucesso!");
      }

      setShowAddSlotModal(false);
      setEditingSlotId(null);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erro ao salvar horário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMensalista = async () => {
    if (!mensalistaName || !mensalistaPhone) {
      alert("Nome e WhatsApp são obrigatórios.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<RegisteredTeam> = {
        name: mensalistaName,
        captainName: mensalistaCaptain,
        captainPhone: mensalistaPhone,
        email: mensalistaEmail,
        fixedDay: String(mensalistaDay),
        fixedTime: mensalistaTime,
        fixedDurationMinutes: mensalistaDuration,
        categories: [mensalistaCategory],
        logoUrl: mensalistaLogo,
        gender: mensalistaGender,
        sport: mensalistaSport,
        courtName: mensalistaCourt,
        fieldId: field.id
      };

      if (editingMensalista) {
        await api.updateRegisteredTeam(editingMensalista.id, payload);
      } else {
        await api.addRegisteredTeam(payload);
      }
      
      setShowAddMensalistaModal(false);
      loadMensalistas();
      alert("Mensalista salvo com sucesso!");
    } catch (e) {
      alert("Erro ao salvar mensalista.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAgenda = async () => {
    setIsLoading(true);
    try {
      const slotsToCreate: Omit<MatchSlot, 'id'>[] = [];
      const startDate = new Date(`${autoGenDate}T${autoGenStartTime}`);
      const endDate = new Date(`${autoGenDate}T${autoGenEndTime}`);
      let currentTime = startDate;

      while (currentTime < endDate) {
        const timeStr = currentTime.toTimeString().slice(0, 5);
        if (!slots.some(s => s.date === autoGenDate && s.time === timeStr && s.courtName === slotCourt)) {
          slotsToCreate.push({
            fieldId: field.id,
            date: autoGenDate,
            time: timeStr,
            durationMinutes: autoGenDuration,
            matchType: 'AMISTOSO',
            isBooked: false,
            hasLocalTeam: false,
            price: field.hourlyRate,
            status: 'available',
            courtName: slotCourt,
            sport: slotSport,
            homeTeamType: 'OUTSIDE',
            allowedOpponentCategories: [],
            allowedOpponentGenders: ['MASCULINO', 'FEMININO', 'MISTO'],
          });
        }
        currentTime.setMinutes(currentTime.getMinutes() + autoGenDuration);
      }

      if (slotsToCreate.length > 0) {
        await onAddSlot(slotsToCreate);
        alert(`${slotsToCreate.length} horários criados com sucesso!`);
        setShowAutoGenerateModal(false);
      } else {
        alert("Nenhum horário novo a ser criado. Verifique os conflitos de horário.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erro ao gerar agenda.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSlot = async (slot: MatchSlot) => {
    if (!confirm("Remover este horário?")) return;
    try {
      await onDeleteSlot(slot.id);
      alert("Horário removido com sucesso!");
      if (slot.bookedByUserId) {
        await api.createNotification({
          userId: slot.bookedByUserId,
          title: "Jogo Cancelado ❌",
          description: `O jogo na arena ${field.name} no dia ${slot.date.split('-').reverse().join('/')} foi cancelado.`,
          type: 'warning'
        });
      }
    } catch (e) {
      alert("Erro ao remover horário.");
    }
  };

  const handleGenerateRecurringSlots = async (team: RegisteredTeam) => {
    if (!confirm(`Gerar próximos 10 jogos para ${team.name}?`)) return;
    setIsLoading(true);
    try {
      const slotsToCreate: Omit<MatchSlot, 'id'>[] = [];
      const targetDay = Number(team.fixedDay);
      let currentDate = new Date();
      currentDate.setHours(12, 0, 0, 0);
      let count = 0;
      while (count < 10) {
          if (currentDate.getDay() === targetDay) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (!slots.some(s => s.date === dateStr && s.time === team.fixedTime && s.courtName === team.courtName)) {
            slotsToCreate.push({
              fieldId: field.id, 
              date: dateStr, 
              time: team.fixedTime, 
              durationMinutes: team.fixedDurationMinutes || 60, 
              matchType: 'FIXO', 
              isBooked: true, 
              hasLocalTeam: true, 
              localTeamName: team.name, 
              localTeamCategory: team.categories[0], 
              localTeamPhone: team.captainPhone, 
              localTeamLogoUrl: team.logoUrl, 
              localTeamGender: team.gender, 
              allowedOpponentCategories: team.categories, 
              allowedOpponentGenders: [team.gender],
              status: 'pending_payment', 
              price: field.hourlyRate, 
              sport: team.sport, 
              courtName: team.courtName, 
              homeTeamType: 'MENSALISTA'
            });
            count++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      if (slotsToCreate.length > 0) {
        await onAddSlot(slotsToCreate);
        alert("Agenda gerada com sucesso!");
      }
    } catch (e: any) { 
      console.error(e);
      alert(e.message || "Erro ao gerar."); 
    }
    finally { setIsLoading(false); }
  };

  const getWeekDays = (baseDate: Date) => {
    const days = [];
    const start = new Date(baseDate);
    // Find the previous Monday
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setDate(diff));
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = useMemo(() => getWeekDays(calendarBaseDate), [calendarBaseDate]);
  const calendarHours = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00 to 23:00

  const getSlotColor = (slot: MatchSlot) => {
    if (slot.fieldId !== field.id) return 'bg-blue-500 text-white'; // Jogo Fora
    if (slot.status === 'confirmed') return 'bg-grass-500 text-white'; // Jogo Confirmado
    if (slot.status === 'waiting_opponent' || (slot.bookedByTeamName && !slot.opponentTeamName)) return 'bg-yellow-400 text-pitch'; // Jogo em Aberto
    if (slot.status === 'available') return 'bg-gray-100 text-gray-400';
    return 'bg-gray-200 text-gray-500';
  };

  const combinedSlots = [...slots, ...awayGames]
    .filter(s => {
       // Show all slots from today onwards, or past slots if they are pending something
       if (s.date < todayStr && (s.status === 'confirmed' || s.status === 'available')) return false; 
       
       if (filterRange === 'SPECIFIC') {
          if (filterSpecificDate && s.date !== filterSpecificDate) return false;
       } else if (filterRange !== 'ALL') {
          const daysToAdd = parseInt(filterRange);
          if (!isNaN(daysToAdd)) {
             const limitDate = new Date();
             limitDate.setDate(limitDate.getDate() + daysToAdd);
             const limitStr = limitDate.toISOString().split('T')[0];
             if (s.date > limitStr) return false;
          }
       }
       if (filterTerm) {
         const term = filterTerm.toLowerCase();
         const matchLocal = s.localTeamName?.toLowerCase().includes(term);
         const matchOpponent = s.opponentTeamName?.toLowerCase().includes(term);
         if (!matchLocal && !matchOpponent) return false;
       }
       return true;
    })
    .sort((a,b) => {
       if (a.date !== b.date) return a.date.localeCompare(b.date);
       return a.time.localeCompare(b.time);
    });

  const getSlotBadges = (slot: MatchSlot) => {
    const badges = [];
    const isLocal = slot.hasLocalTeam || slot.matchType === 'FIXO';
    const hasOpponent = !!slot.opponentTeamName;
    const hasAtLeastOneTeam = !!(slot.bookedByTeamName || slot.hasLocalTeam);

    if (slot.status === 'confirmed') {
      badges.push({ label: 'JOGO CONFIRMADO', color: 'bg-grass-500 text-white', icon: <CheckCircle className="w-3 h-3"/> });
    } else if (slot.status === 'pending_verification') {
      badges.push({ label: 'AGUARDANDO VALIDAÇÃO PIX', color: 'bg-orange-500 text-white', icon: <AlertCircle className="w-3 h-3"/> });
    } else if (slot.status === 'pending_payment') {
      badges.push({ label: 'AGUARDANDO PAGAMENTO', color: 'bg-blue-500 text-white', icon: <Clock className="w-3 h-3"/> });
    } else if (slot.status === 'pending_field_approval') {
      badges.push({ label: 'AGUARDANDO SUA APROVAÇÃO', color: 'bg-orange-400 text-white', icon: <UserCheck className="w-3 h-3"/> });
    } else if (slot.status === 'pending_home_approval') {
      badges.push({ label: 'AGUARDANDO APROVAÇÃO DO MANDANTE', color: 'bg-yellow-400 text-pitch', icon: <Clock className="w-3 h-3"/> });
    } else if (slot.status === 'waiting_opponent') {
      badges.push({ label: 'JOGO EM ABERTO', color: 'bg-blue-400 text-white', icon: <Swords className="w-3 h-3"/> });
    } else if (hasAtLeastOneTeam && !hasOpponent) {
      badges.push({ label: 'JOGO EM ABERTO', color: 'bg-yellow-400 text-pitch font-black', icon: <Swords className="w-3 h-3"/> });
    } else {
      badges.push({ label: 'DISPONÍVEL', color: 'bg-gray-100 text-gray-400', icon: <Clock className="w-3 h-3"/> });
    }

    if (isLocal) {
      badges.push({ label: 'TIME LOCAL', color: 'bg-indigo-100 text-indigo-700', icon: <UserPlus className="w-3 h-3"/> });
    }

    return badges;
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
                <h1 className="font-black text-pitch italic uppercase tracking-tighter leading-none">{field.name === 'Carregando...' ? 'Carregando...' : field.name}</h1>
                <p className="text-[9px] font-black text-gray-400 uppercase mt-1">Gestão de Arena</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingSlotId(null); setSlotDate(todayStr); setShowAddSlotModal(true); }} className="p-3 bg-pitch text-white rounded-xl active:scale-95 shadow-md flex items-center gap-2">
               <Plus className="w-5 h-5"/>
               <span className="text-[10px] font-black uppercase">Novo Horário</span>
            </button>
          </div>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl overflow-x-auto scrollbar-hide">
          {['AGENDA', 'SOLICITACOES', 'MENSALISTAS', 'HISTORICO'].map((tab: any) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>
              {tab === 'AGENDA' && <CalendarDays className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'SOLICITACOES' && <div className="relative inline-block">
                <MessageCircle className="w-3 h-3 inline-block mr-1 mb-0.5" />
                {slots.some(s => s.status === 'pending_verification' || s.status === 'pending_field_approval') && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </div>}
              {tab === 'MENSALISTAS' && <UserCheck className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab === 'HISTORICO' && <HistoryIcon className="w-3 h-3 inline-block mr-1 mb-0.5" />}
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

        {activeTab === 'AGENDA' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowAutoGenerateModal(true)} className="bg-pitch text-white text-xs font-black uppercase px-4 py-2 rounded-full flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Gerar Agenda
              </button>
              <div className="flex items-center justify-center bg-gray-100 p-1 rounded-full w-fit">
              <button onClick={() => setAgendaView('LIST')} className={`px-4 py-2 text-xs font-black uppercase rounded-full ${agendaView === 'LIST' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Lista</button>
              <button onClick={() => setAgendaView('CALENDAR')} className={`px-4 py-2 text-xs font-black uppercase rounded-full ${agendaView === 'CALENDAR' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}>Calendário</button>
            </div>
            </div>
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-[2rem] border shadow-sm space-y-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
                <div className="flex items-center gap-2 text-pitch font-black uppercase text-xs">
                  <Filter className="w-4 h-4 text-grass-500" />
                  Filtros de Agenda
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </div>

              {showFilters && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3 pt-2">
                   <div className="grid grid-cols-2 gap-2">
                     <div className="bg-gray-50 p-2 rounded-xl flex items-center gap-2 border">
                        <select 
                          value={filterRange} 
                          onChange={e => setFilterRange(e.target.value)} 
                          className="bg-transparent font-bold text-[10px] outline-none w-full uppercase text-gray-600 appearance-none p-1"
                        >
                           <option value="7">Próximos 7 Dias</option>
                           <option value="15">Próximos 15 Dias</option>
                           <option value="30">Próximos 30 Dias</option>
                           <option value="ALL">Ver Todos</option>
                           <option value="SPECIFIC">Data Específica</option>
                        </select>
                     </div>
                     {filterRange === 'SPECIFIC' && (
                       <input type="date" value={filterSpecificDate} onChange={e => setFilterSpecificDate(e.target.value)} className="bg-gray-50 p-2 rounded-xl border font-bold text-[10px] uppercase text-gray-600" />
                     )}
                   </div>
                   <input 
                      placeholder="Buscar por nome do time..." 
                      value={filterTerm} 
                      onChange={e => setFilterTerm(e.target.value)} 
                      className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-[10px] uppercase"
                    />
                </div>
              )}
            </div>

            {agendaView === 'LIST' && (
              <div className="grid gap-4">
              {combinedSlots.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum horário disponível.</div>
              ) : (
                combinedSlots.map(slot => {
                  const badges = getSlotBadges(slot);
                  
                  // Lógica visual para corrigir nome "CARREGANDO..."
                  const displayLocalName = (slot.localTeamName === 'Carregando...' ? field.name : slot.localTeamName) || slot.bookedByTeamName || 'Horário Livre';
                  const displayLocalNameSafe = displayLocalName === 'Carregando...' ? 'Time da Casa' : displayLocalName;

                  const isAwayGame = slot.fieldId !== field.id;

                  return (
                    <div key={slot.id} className={`bg-white p-5 rounded-[2.5rem] border flex flex-col gap-4 shadow-sm relative group overflow-hidden ${isAwayGame ? 'border-blue-200' : ''}`}>
                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${slot.isBooked ? 'bg-pitch text-white' : 'bg-gray-100 text-gray-400'}`}>
                               <Flag className="w-5 h-5"/>
                            </div>
                            <div>
                               <h4 className="font-black text-pitch text-sm uppercase leading-tight">
                                  {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                               </h4>
                               <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate">
                                  {displayLocalNameSafe} vs {slot.opponentTeamName || '?'}
                               </p>
                               <span className="text-[8px] font-black text-grass-600 uppercase mt-1 inline-block">{slot.sport} • {slot.courtName}</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="block font-black text-pitch text-sm">R$ {slot.price}</span>
                            <span className="text-[8px] font-bold text-gray-300 uppercase">{slot.durationMinutes} min</span>
                         </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isAwayGame && <span className='px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 bg-blue-100 text-blue-700'><MapPin className="w-3 h-3"/> JOGO FORA</span>}
                         {badges.map((badge, i) => (
                           <span key={i} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 ${badge.color}`}>
                             {badge.icon} {badge.label}
                           </span>
                         ))}
                      </div>
                      <div className="flex gap-2 pt-2 border-t mt-1 justify-between items-center">
                        <div className="flex gap-2">
                           <button onClick={() => handleEditSlot(slot)} className="p-3 bg-gray-50 text-pitch rounded-xl hover:bg-pitch hover:text-white transition-all"><Edit className="w-4 h-4"/></button>
                           <button onClick={() => handleDeleteSlot(slot)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl bg-gray-50"><Trash2 className="w-4 h-4"/></button>
                        </div>
                        {slot.status === 'confirmed' && (
                           <button 
                             onClick={() => {
                               const msg = `Olá! Confirmando a partida na arena ${field.name} dia ${slot.date.split('-').reverse().join('/')} às ${slot.time}. Bom jogo!`;
                               const phone = slot.opponentTeamPhone || slot.bookedByUserPhone || slot.localTeamPhone;
                               if (phone) window.open(api.getWhatsAppLink(phone, msg), '_blank');
                             }} 
                             className="p-3 bg-grass-50 text-grass-600 rounded-xl hover:bg-grass-500 hover:text-white transition-all flex items-center gap-2"
                           >
                             <MessageCircle className="w-4 h-4"/>
                             <span className="text-[8px] font-black uppercase">Notificar WhatsApp</span>
                           </button>
                        )}
                        {slot.status === 'pending_payment' && !isAwayGame && (
                           <button 
                             onClick={() => {
                               const msg = `Olá! O jogo na arena ${field.name} dia ${slot.date.split('-').reverse().join('/')} às ${slot.time} está aguardando pagamento.`;
                               const phone = slot.opponentTeamPhone || slot.bookedByUserPhone || slot.localTeamPhone;
                               if (phone) window.open(api.getWhatsAppLink(phone, msg), '_blank');
                             }} 
                             className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2"
                           >
                             <MessageCircle className="w-4 h-4"/>
                             <span className="text-[8px] font-black uppercase">Notificar Pagamento</span>
                           </button>
                        )}
                        {slot.status === 'pending_payment' && isAwayGame && (
                           <button 
                             onClick={() => handleOpenPayment(slot)} 
                             className="flex-1 py-3 bg-grass-500 text-white rounded-xl hover:bg-grass-600 transition-all flex items-center justify-center gap-2 shadow-md"
                           >
                             <Check className="w-4 h-4"/>
                             <span className="text-[10px] font-black uppercase">
                               PAGAR R$ {slot.homeTeamType === 'OUTSIDE' ? (slot.price / 2).toFixed(2) : slot.price.toFixed(2)}
                             </span>
                           </button>
                        )}
                        {(slot.status === 'pending_verification' || slot.status === 'pending_field_approval') && (
                           <button onClick={() => setActiveTab('SOLICITACOES')} className="bg-orange-500 text-white text-[8px] font-black uppercase px-3 py-2 rounded-lg animate-pulse">Ver Solicitação</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}
            {agendaView === 'CALENDAR' && (
              <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                  <button 
                    onClick={() => {
                      const d = new Date(calendarBaseDate);
                      d.setDate(d.getDate() - 7);
                      setCalendarBaseDate(d);
                    }}
                    className="p-2 hover:bg-white rounded-full transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-pitch" />
                  </button>
                  <h3 className="font-black text-pitch uppercase italic text-sm">
                    {weekDays[0].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button 
                    onClick={() => {
                      const d = new Date(calendarBaseDate);
                      d.setDate(d.getDate() + 7);
                      setCalendarBaseDate(d);
                    }}
                    className="p-2 hover:bg-white rounded-full transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-pitch" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b">
                      <div className="p-4 border-r bg-gray-50"></div>
                      {weekDays.map((date: Date, i: number) => (
                        <div key={i} className={`p-4 text-center border-r last:border-r-0 ${date.toDateString() === new Date().toDateString() ? 'bg-grass-50' : ''}`}>
                          <p className="text-[10px] font-black text-gray-400 uppercase">
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </p>
                          <p className={`text-lg font-black ${date.toDateString() === new Date().toDateString() ? 'text-grass-600' : 'text-pitch'}`}>
                            {date.getDate()}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="relative">
                      {calendarHours.map(hour => (
                        <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0 min-h-[80px]">
                          <div className="p-4 border-r bg-gray-50 flex items-start justify-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase">{hour}:00</span>
                          </div>
                          {weekDays.map((date: Date, i: number) => {
                            const dateStr = date.toISOString().split('T')[0];
                            const hourStr = hour.toString().padStart(2, '0') + ':00';
                            const slotsAtTime = combinedSlots.filter(s => s.date === dateStr && s.time.startsWith(hour.toString().padStart(2, '0')));
                            
                            return (
                              <div key={i} className="border-r last:border-r-0 p-1 relative group">
                                {slotsAtTime.map(slot => (
                                  <div 
                                    key={slot.id}
                                    onClick={() => {
                                      if (slot.fieldId === field.id) {
                                        setEditingSlotId(slot.id);
                                        setSlotDate(slot.date);
                                        setSlotTime(slot.time);
                                        setSlotDuration(slot.durationMinutes);
                                        setSlotMatchType(slot.matchType);
                                        setSlotSport(slot.sport);
                                        setSlotCourt(slot.courtName || '');
                                        setSlotPrice(slot.price);
                                        setSelectedRegisteredTeamId(slot.localTeamName ? (registeredTeams.find(t => t.name === slot.localTeamName)?.id || '') : '');
                                        setShowAddSlotModal(true);
                                      }
                                    }}
                                    className={`mb-1 p-2 rounded-xl text-[8px] font-black uppercase leading-tight cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${getSlotColor(slot)}`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="truncate">
                                        {slot.fieldId !== field.id ? `FORA: ${slot.localTeamName || slot.bookedByTeamName}` : (slot.localTeamName || slot.bookedByTeamName || 'Livre')}
                                      </span>
                                      {slot.status === 'confirmed' && <CheckCircle className="w-2 h-2 flex-shrink-0" />}
                                    </div>
                                    <div className="mt-1 opacity-70 flex items-center gap-1">
                                      <Clock className="w-2 h-2" /> {slot.time}
                                    </div>
                                  </div>
                                ))}
                                {slotsAtTime.length === 0 && (
                                  <button 
                                    onClick={() => {
                                      setEditingSlotId(null);
                                      setSlotDate(dateStr);
                                      setSlotTime(hourStr);
                                      setShowAddSlotModal(true);
                                    }}
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-grass-50/50 flex items-center justify-center transition-opacity"
                                  >
                                    <Plus className="w-4 h-4 text-grass-600" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'SOLICITACOES' && (
           <div className="space-y-4">
              {slots.filter(s => s.status === 'pending_verification' || s.status === 'pending_field_approval' || s.status === 'pending_home_approval').map(slot => (
                 <div key={slot.id} className="bg-white rounded-[2.5rem] border-2 border-orange-100 shadow-md p-6 space-y-6">
                    <div className="flex justify-between items-start">
                       <div>
                          <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">
                            {slot.status === 'pending_verification' ? 'Comprovante PIX Enviado' : slot.status === 'pending_home_approval' ? 'Aguardando Mandante' : 'Novo Desafio Recebido'}
                          </span>
                          <h4 className="text-lg font-black text-pitch uppercase mt-2">{slot.date.split('-').reverse().join('/')} às {slot.time}</h4>
                       </div>
                       <div className="p-3 bg-gray-50 rounded-xl text-pitch"><Swords className="w-5 h-5" /></div>
                    </div>
                    
                    {slot.status === 'pending_verification' && slot.receiptUrl && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Comprovante PIX:</p>
                        <a href={slot.receiptUrl} target="_blank" rel="noreferrer" className="block w-full h-40 bg-gray-100 rounded-2xl overflow-hidden border">
                          <img src={slot.receiptUrl} className="w-full h-full object-contain" />
                        </a>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center overflow-hidden">
                             {(slot.opponentTeamLogoUrl || slot.bookedByTeamLogoUrl) ? (
                               <img src={slot.opponentTeamLogoUrl || slot.bookedByTeamLogoUrl} className="w-full h-full object-cover" />
                             ) : (
                               <div className="font-black">{(slot.opponentTeamName || slot.bookedByTeamName)?.charAt(0)}</div>
                             )}
                          </div>
                          <div>
                             <p className="text-[8px] font-black text-gray-400 uppercase">Solicitante</p>
                             <p className="font-black text-pitch uppercase">{slot.opponentTeamName || slot.bookedByTeamName}</p>
                             <p className="text-[9px] font-bold text-grass-600 uppercase">{slot.opponentTeamCategory || slot.bookedByTeamCategory}</p>
                          </div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <Button onClick={() => handleAction(slot, 'reject')} variant="outline" className="py-4 rounded-2xl text-red-500 font-black uppercase text-[10px]">Recusar</Button>
                       <Button onClick={() => handleAction(slot, 'confirm')} className="py-4 rounded-2xl bg-pitch text-white font-black uppercase text-[10px]">
                         {slot.status === 'pending_verification' ? 'Confirmar PIX' : 'Aceitar Jogo'}
                       </Button>
                    </div>
                 </div>
              ))}
              {/* Mensalista Requests */}
              {registeredTeams.filter(t => t.status === 'pending').map(team => (
                <div key={`mensalista-${team.id}`} className="bg-white rounded-[2.5rem] border-2 border-indigo-100 shadow-md p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">
                        Solicitação de Mensalista
                      </span>
                      <h4 className="text-lg font-black text-pitch uppercase mt-2">{team.name}</h4>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl text-pitch"><CalendarPlus className="w-5 h-5" /></div>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl border flex items-center justify-center overflow-hidden">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="font-black">{team.name?.charAt(0)}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-gray-400 uppercase">Capitão</p>
                        <p className="font-black text-pitch uppercase">{team.captainName}</p>
                        <p className="text-[9px] font-bold text-grass-600 uppercase">{team.categories.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => handleRejectMensalista(team.id)} variant="outline" className="py-4 rounded-2xl text-red-500 font-black uppercase text-[10px]">Recusar</Button>
                    <Button onClick={() => handleApproveMensalista(team.id)} className="py-4 rounded-2xl bg-pitch text-white font-black uppercase text-[10px]">Aprovar</Button>
                  </div>
                </div>
              ))}

              {slots.filter(s => s.status === 'pending_verification' || s.status === 'pending_field_approval' || s.status === 'pending_home_approval').length === 0 && registeredTeams.filter(t => t.status === 'pending').length === 0 && (
                <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhuma solicitação pendente.</div>
              )}
            </div>
        )}

        {activeTab === 'HISTORICO' && (
          <div className="space-y-4">
            {historicSlots.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-black uppercase text-[10px]">Nenhum jogo no histórico.</div>
            ) : (
              historicSlots.map(slot => (
                <div key={slot.id} className="bg-white p-5 rounded-[2.5rem] border shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-pitch text-sm uppercase leading-tight">
                        {slot.time} • {slot.date.split('-').reverse().slice(0,2).join('/')}
                      </h4>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate">
                        {slot.localTeamName} vs {slot.opponentTeamName || '?'}
                      </p>
                    </div>
                    <Button onClick={onRateTeam} variant="outline" className="text-xs">Avaliar</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Pagamento Jogo Fora */}
        {selectedPaymentSlot && paymentField && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-pitch/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">Pagamento Pendente</span>
                    <h3 className="text-2xl font-black text-pitch uppercase mt-2 italic tracking-tighter">Realizar Pagamento</h3>
                  </div>
                  <button onClick={() => setSelectedPaymentSlot(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4 border">
                  <div className="flex justify-between items-center pb-4 border-b border-dashed">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Arena Destino</span>
                    <span className="font-black text-pitch uppercase">{paymentField.name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-dashed">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Chave PIX</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-pitch text-xs">{paymentField.pixConfig?.key}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(paymentField.pixConfig?.key || '');
                          alert("Chave PIX copiada!");
                        }}
                        className="p-1.5 bg-white border rounded-lg hover:bg-gray-100"
                      >
                        <LayoutGrid className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Valor a Pagar</span>
                    <span className="text-xl font-black text-grass-600 italic">
                      R$ {selectedPaymentSlot.homeTeamType === 'OUTSIDE' ? (selectedPaymentSlot.price / 2).toFixed(2) : selectedPaymentSlot.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase text-center italic">
                    * O comprovante deve ser enviado em até 24h antes do jogo.
                  </p>
                  
                  <div className="relative">
                    <input
                      type="file"
                      id="receipt-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleUploadReceipt}
                      disabled={isUploadingReceipt}
                    />
                    <label
                      htmlFor="receipt-upload"
                      className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs transition-all cursor-pointer shadow-lg
                        ${isUploadingReceipt ? 'bg-gray-100 text-gray-400' : 'bg-pitch text-white hover:bg-pitch/90 active:scale-95'}`}
                    >
                      {isUploadingReceipt ? (
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                      {isUploadingReceipt ? 'Enviando...' : 'Anexar Comprovante'}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'MENSALISTAS' && (
          <div className="space-y-4">
             {registeredTeams.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[3rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border overflow-hidden">
                        {t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <div className="font-black text-pitch text-xl">{t.name.charAt(0)}</div>}
                      </div>
                      <div>
                          <h4 className="font-black text-pitch uppercase leading-none">{t.name}</h4>
                          <p className="text-[9px] font-black text-gray-400 uppercase mt-2 flex items-center gap-1">
                             {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][Number(t.fixedDay)]} às {t.fixedTime}
                          </p>
                          <p className="text-[8px] font-bold text-grass-600 uppercase mt-1">{t.sport} • {t.courtName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingMensalista(t); setMensalistaName(t.name); setMensalistaPhone(t.captainPhone || ''); setShowAddMensalistaModal(true); }} className="p-3 text-gray-300 hover:text-pitch"><Edit className="w-5 h-5"/></button>
                      <button onClick={() => { if(confirm("Remover mensalista?")) api.deleteRegisteredTeam(t.id).then(loadMensalistas); }} className="p-3 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => handleGenerateRecurringSlots(t)} isLoading={isLoading} className="w-full py-4 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border-dashed">
                    <CalendarPlus className="w-4 h-4" /> Gerar Agenda Mensalista
                  </Button>
               </div>
             ))}
             <div className="grid grid-cols-1 gap-4">
               <button onClick={() => { setEditingMensalista(null); setMensalistaName(''); setMensalistaPhone(''); setShowAddMensalistaModal(true); }} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black uppercase text-[10px]">Adicionar Manualmente</button>
             </div>
          </div>
        )}

      {/* Modal Add/Edit Slot */}
      {showAddSlotModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[400] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xl font-black italic uppercase text-pitch">{editingSlotId ? 'Editar Horário' : 'Novo Horário de Agenda'}</h2>
                 <button onClick={() => setShowAddSlotModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                       <input type="date" className="w-full bg-transparent font-black outline-none" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora Início</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none" value={slotTime} onChange={e => setSlotTime(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Duração (minutos)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Tipo de Jogo</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotMatchType} onChange={e => setSlotMatchType(e.target.value as MatchType)}>
                          <option value="AMISTOSO">Amistoso</option>
                          <option value="FESTIVAL">Festival</option>
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotSport} onChange={e => setSlotSport(e.target.value)}>
                          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local (Quadra)</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={slotCourt} onChange={e => setSlotCourt(e.target.value)}>
                          {field.courts.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Preço Locação (R$)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none" value={slotPrice} onChange={e => setSlotPrice(Number(e.target.value))} />
                    </div>
                 </div>
                 
                 <div className="bg-gray-50 p-4 rounded-2xl border flex items-center justify-between cursor-pointer" onClick={() => setIsLocalTeamSlot(!isLocalTeamSlot)}>
                    <div>
                        <h4 className="font-black text-pitch text-xs uppercase">Vincular Mandante?</h4>
                        <p className="text-[8px] text-gray-400">Define um time fixo para este horário.</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-all ${isLocalTeamSlot ? 'bg-pitch' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all transform ${isLocalTeamSlot ? 'translate-x-6' : ''}`} />
                    </div>
                 </div>

                 {isLocalTeamSlot && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 bg-gray-50 p-4 rounded-2xl border">
                        <div>
                           <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Selecione o Mandante</label>
                           <select 
                             className="w-full p-4 bg-white border rounded-xl text-xs font-bold" 
                             value={selectedRegisteredTeamId} 
                             onChange={e => setSelectedRegisteredTeamId(e.target.value)}
                           >
                              <option value="">Selecione um time</option>
                              {currentUser.teams.map((t, i) => (
                                <option key={`OWNER_TEAM_${i}`} value={`OWNER_TEAM_${i}`}>[MEU TIME] {t.name}</option>
                              ))}
                              {registeredTeams.map(t => (
                                <option key={t.id} value={t.id}>[MENSALISTA] {t.name}</option>
                              ))}
                           </select>
                        </div>
                        
                        {(selectedRegisteredTeamId && (
                          (() => {
                            let team;
                            if (selectedRegisteredTeamId.startsWith('OWNER_TEAM_')) {
                              const idx = parseInt(selectedRegisteredTeamId.split('_')[2]);
                              team = currentUser.teams[idx];
                            } else {
                              team = registeredTeams.find(t => t.id === selectedRegisteredTeamId);
                            }

                            if (team && team.categories && team.categories.length > 1) {
                              return (
                                <div>
                                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Selecione a Categoria</label>
                                  <select 
                                    className="w-full p-4 bg-white border rounded-xl text-xs font-bold" 
                                    value={localTeamCategory} 
                                    onChange={e => setLocalTeamCategory(e.target.value)}
                                  >
                                    <option value="">Selecione a categoria</option>
                                    {team.categories.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }
                            return null;
                          })()
                        ))}
                        
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAcceptNeighbors(!acceptNeighbors)}>
                           <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${acceptNeighbors ? 'bg-pitch border-pitch text-white' : 'bg-white border-gray-300'}`}>
                              {acceptNeighbors && <Check className="w-3 h-3" />}
                           </div>
                           <span className="text-[10px] font-black text-pitch uppercase">Aceitar categorias vizinhas (Matchmaking)</span>
                        </div>
                        {acceptNeighbors && (
                           <p className="text-[8px] text-gray-400 font-bold uppercase italic">* Permitirá desafios de uma categoria acima e uma abaixo.</p>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t mt-3">
                          <div className="bg-white p-3 rounded-xl border">
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Gênero do Time</label>
                            <select value={localTeamGender} onChange={e => setLocalTeamGender(e.target.value as Gender)} className="w-full bg-transparent font-black outline-none text-xs uppercase">
                              <option value="MASCULINO">Masculino</option>
                              <option value="FEMININO">Feminino</option>
                              <option value="MISTO">Misto</option>
                            </select>
                          </div>
                          <div className="bg-white p-3 rounded-xl border flex items-center justify-center">
                            <label className="flex items-center gap-2 text-xs font-black uppercase text-gray-600">
                              <input type="checkbox" checked={acceptsMixed} onChange={e => setAcceptsMixed(e.target.checked)} className="w-4 h-4 rounded text-pitch focus:ring-pitch" />
                              Aceita times mistos?
                            </label>
                          </div>
                        </div>
                    </div>
                 )}

                 <Button onClick={handleCreateOrUpdateSlot} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase shadow-xl">
                   {editingSlotId ? 'Atualizar Horário' : 'Criar Horário'}
                 </Button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Add Mensalista */}
      {showAutoGenerateModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <h2 className="text-xl font-black italic uppercase text-pitch mb-6">Gerar Agenda Automática</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Data</label>
                <input type="date" value={autoGenDate} onChange={e => setAutoGenDate(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora de Início</label>
                  <input type="time" value={autoGenStartTime} onChange={e => setAutoGenStartTime(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm uppercase" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Hora de Fim</label>
                  <input type="time" value={autoGenEndTime} onChange={e => setAutoGenEndTime(e.target.value)} className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm uppercase" />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Duração (minutos)</label>
                <input type="number" step="15" value={autoGenDuration} onChange={e => setAutoGenDuration(parseInt(e.target.value))} className="w-full bg-gray-50 p-3 rounded-xl border font-bold text-sm uppercase" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={() => setShowAutoGenerateModal(false)} variant="outline" className="w-full">Cancelar</Button>
              <Button onClick={handleGenerateAgenda} className="w-full">Gerar</Button>
            </div>
          </div>
        </div>
      )}

      {showAddMensalistaModal && (
        <div className="fixed inset-0 bg-pitch/95 backdrop-blur-md z-[100] flex items-end">
           <div className="bg-white w-full rounded-t-[3rem] p-10 animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-black italic uppercase text-pitch">{editingMensalista ? 'Editar' : 'Novo Mensalista'}</h2>
                 <button onClick={() => setShowAddMensalistaModal(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
              </div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Nome Time</label>
                       <input className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaName} onChange={e => setMensalistaName(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Categoria</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaCategory} onChange={e => setMensalistaCategory(e.target.value)}>
                          {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Esporte</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaSport} onChange={e => setMensalistaSport(e.target.value)}>
                          {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Local (Quadra)</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs" value={mensalistaCourt} onChange={e => setMensalistaCourt(e.target.value)}>
                          {field.courts.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Dia da Semana</label>
                       <select className="w-full bg-transparent font-black outline-none text-xs uppercase" value={mensalistaDay} onChange={e => setMensalistaDay(Number(e.target.value))}>
                          {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map((d, i) => <option key={i} value={i}>{d}</option>)}
                       </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Horário</label>
                       <input type="time" className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaTime} onChange={e => setMensalistaTime(e.target.value)} />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border">
                       <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Duração (minutos)</label>
                       <input type="number" className="w-full bg-transparent font-black outline-none text-pitch" value={mensalistaDuration} onChange={e => setMensalistaDuration(Number(e.target.value))} />
                    </div>
                 </div>
                 <div className="bg-pitch/5 p-6 rounded-[2.5rem] border border-pitch/10 space-y-4">
                    <input className="w-full p-4 bg-white rounded-xl border text-xs font-bold" placeholder="WhatsApp Capitão" value={mensalistaPhone} onChange={e => setMensalistaPhone(e.target.value)} />
                 </div>
                 <Button onClick={handleSaveMensalista} isLoading={isLoading} className="w-full py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-xl">Salvar Mensalista</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
};
