import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Field, MatchSlot, User, Notification, SubscriptionPlan } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { Subscription } from './views/Subscription';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './api';
import { RefreshCw, Settings, Building2, Shield, Search, Loader2, Bell, X, Info, History, KeyRound, Eye, LogOut, Smartphone, Download, Share, Trophy, Crown, Users, UserPlus } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'APP' | 'SUBSCRIPTION'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [fieldDashForceTab, setFieldDashForceTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO' | undefined>(undefined);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Super Admin Search State
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterRole, setAdminFilterRole] = useState<'ALL' | 'FIELD_OWNER' | 'TEAM_CAPTAIN'>('FIELD_OWNER');

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null);

  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  const [isIOS] = useState(() => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));
  const [isStandalone, setIsStandalone] = useState(false);

  // Efeito "Gatekeeper": Se logado mas sem plano, forçar tela de assinatura
  useEffect(() => {
    if (user && !impersonatingUser) {
      // Se a assinatura for NONE ou FREE (legado), manda para o fluxo de pagamento obrigatório
      if (user.subscription === SubscriptionPlan.NONE || user.subscription === SubscriptionPlan.FREE) {
        setView('SUBSCRIPTION');
      } else if (view === 'SUBSCRIPTION') {
        // Se já pagou e ainda está na tela de assinatura, manda pro App
        setView('APP');
      }
    }
  }, [user, impersonatingUser]);

  // Verifica convite de mensalista
  useEffect(() => {
    const checkInvite = async () => {
       const query = new URLSearchParams(window.location.search);
       const inviteFieldId = query.get('inviteFieldId');
       
       if (inviteFieldId) {
          if (user) {
             if (confirm("Você foi convidado para ser mensalista desta arena. Aceitar convite?")) {
                setIsLoading(true);
                try {
                   await api.acceptInvitation(inviteFieldId, user);
                   alert("Convite aceito com sucesso! Agora você é mensalista.");
                   window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) {
                   console.error(e);
                   alert("Erro ao aceitar convite.");
                } finally {
                   setIsLoading(false);
                }
             }
          } else {
             // Se não logado, salva para depois
             localStorage.setItem('pending_invite_field_id', inviteFieldId);
             setView('AUTH');
          }
       } else if (user) {
          // Check pending invite from localStorage
          const pendingInvite = localStorage.getItem('pending_invite_field_id');
          if (pendingInvite) {
             if (confirm("Você foi convidado para ser mensalista desta arena. Aceitar convite?")) {
                setIsLoading(true);
                try {
                   await api.acceptInvitation(pendingInvite, user);
                   alert("Convite aceito com sucesso! Agora você é mensalista.");
                   localStorage.removeItem('pending_invite_field_id');
                } catch (e) {
                   console.error(e);
                   alert("Erro ao aceitar convite.");
                } finally {
                   setIsLoading(false);
                }
             } else {
                localStorage.removeItem('pending_invite_field_id');
             }
          }
       }
    };
    checkInvite();
  }, [user]);

  // Verifica retorno do Mercado Pago
  useEffect(() => {
    const checkPaymentReturn = async () => {
      const query = new URLSearchParams(window.location.search);
      // O Mercado Pago retorna 'status' ou 'collection_status'
      const status = query.get('status') || query.get('collection_status');
      const preapproval_id = query.get('preapproval_id');
      
      if ((status === 'approved' || status === 'authorized' || preapproval_id) && user) {
        setIsLoading(true);
        try {
           // Remove parametros da URL para não processar novamente
           window.history.replaceState({}, document.title, window.location.pathname);
           
           const planType = user.role === UserRole.FIELD_OWNER ? SubscriptionPlan.PRO_FIELD : SubscriptionPlan.PRO_TEAM;
           const updatedUser = await api.confirmProSubscription(user.id, planType);
           
           setUser(updatedUser);
           localStorage.setItem('jf_session_user', JSON.stringify(updatedUser));
           
           // Força a mudança de view após a atualização
           setView('APP');
           
           alert("Pagamento Confirmado! Bem-vindo ao Plano PRO com 60 dias grátis! 🚀");
           await api.createNotification({
             userId: user.id,
             title: "Assinatura Ativa 🏆",
             description: "Sua assinatura PRO foi ativada com sucesso. Aproveite os 60 dias de teste!",
             type: 'success'
           });
        } catch (e) {
           alert("Erro ao confirmar assinatura. Entre em contato com o suporte.");
        } finally {
           setIsLoading(false);
        }
      }
    };

    if (user) {
      checkPaymentReturn();
    }
  }, [user]);

  const updateAppBadge = (count: number) => {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          (navigator as any).setAppBadge(count);
        } else {
          (navigator as any).clearAppBadge();
        }
      } catch (e) {
        console.warn("Badging API not supported or failed", e);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    });

    const isInStandaloneMode = ('standalone' in window.navigator && (window.navigator as any).standalone) || 
                               (window.matchMedia('(display-mode: standalone)').matches);
    
    setIsStandalone(isInStandaloneMode);

    if (isIOS && !isInStandaloneMode) {
      setShowInstallBanner(true);
    }
  }, [isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("Para instalar no iPhone/iPad:\n\n1. Toque no botão Compartilhar (quadrado com seta)\n2. Role para baixo\n3. Toque em 'Adicionar à Tela de Início'");
      return;
    }

    if (!deferredPrompt) {
        if (!isStandalone) {
             alert("Para instalar, procure a opção 'Adicionar à Tela Inicial' no menu do seu navegador.");
        }
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const refreshData = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setIsLoading(true);
    try {
      const saved = localStorage.getItem('jf_session_user');
      const currentUser = impersonatingUser || (saved ? JSON.parse(saved) : null);

      // Fetch everything in parallel for maximum speed
      const [fetchedFields, fetchedSlots, fetchedCats] = await Promise.all([
        api.getFields().catch(() => [] as Field[]),
        api.getSlots().catch(() => [] as MatchSlot[]),
        api.getCategories().catch(() => ["Livre"] as string[])
      ]);
      
      setFields(fetchedFields);
      setSlots(fetchedSlots);
      setCategories(fetchedCats);
      
      if (currentUser) {
          const notifs = await api.getNotifications(currentUser.id).catch(() => []);
          setNotifications(notifs);
          
          const unreadCount = notifs.filter(n => !n.read).length;
          updateAppBadge(unreadCount);

          if (currentUser.role === UserRole.SUPER_ADMIN) {
            const users = await api.getAllUsers().catch(() => []);
            setAllUsers(users);
          }
      }
    } catch (e) { 
      console.error("Global Refresh Error:", e); 
    } finally { 
      if (!isAutoRefresh) setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [impersonatingUser]);

  useEffect(() => {
    const currentUser = impersonatingUser || user;
    if (!currentUser) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log('Nova notificação recebida!', payload);
          refreshData(true); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, impersonatingUser, refreshData]);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('jf_session_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          if (u && u.id) {
            setUser(u);
            // A view inicial depende da assinatura, mas deixamos o useEffect Gatekeeper decidir
            setView('APP'); 
            if (u.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER');
            else if (u.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
            else setActiveTab('EXPLORE');
            await refreshData();
          } else {
            localStorage.removeItem('jf_session_user');
          }
        } catch (e) {
          localStorage.removeItem('jf_session_user');
        }
      }
      setIsInitialLoading(false);
    };
    init();
  }, [refreshData]);

  const handleCancelBooking = async (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    const field = fields.find(f => f.id === slot.fieldId);

    if (confirm("Deseja realmente cancelar este agendamento? Ele voltará a ficar disponível para outros times.")) {
      setIsLoading(true);
      try {
        await api.updateSlot(slotId, { 
          status: 'available', 
          isBooked: false, 
          bookedByTeamName: undefined, 
          bookedByUserId: undefined, 
          opponentTeamName: undefined, 
          opponentTeamCategory: undefined,
          opponentTeamPhone: undefined,
          opponentTeamLogoUrl: undefined,
          opponentTeamGender: undefined,
          receiptUrl: undefined 
        });

        if (field) {
          await api.createNotification({
            userId: field.ownerId,
            title: "Agendamento Cancelado ⚠️",
            description: `A partida do dia ${slot.date.split('-').reverse().join('/')} às ${slot.time} foi cancelada e o horário voltou para a agenda.`,
            type: 'warning'
          });
        }

        if (slot.bookedByUserId) {
          await api.createNotification({
            userId: slot.bookedByUserId,
            title: "Agendamento Removido",
            description: `Seu agendamento para o dia ${slot.date} na arena ${field?.name} foi cancelado com sucesso.`,
            type: 'info'
          });
        }
        
        await refreshData();
        alert("Agendamento cancelado. O horário está livre novamente!");
      } catch (e) {
        alert("Erro ao cancelar.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await api.markNotificationAsRead(n.id);
      const unreadCount = notifications.filter(not => !not.read && not.id !== n.id).length;
      updateAppBadge(unreadCount);
    }
    
    setShowNotifications(false);
    await refreshData();
    
    if (user?.role === UserRole.FIELD_OWNER && (n.title.toLowerCase().includes('desafio') || n.title.toLowerCase().includes('mensalista'))) {
      setActiveTab('ADMIN');
      setFieldDashForceTab('SOLICITACOES');
      setTimeout(() => setFieldDashForceTab(undefined), 100);
    }
  };

  const handleUpdateProfile = async (updatedUser: User, updatedField?: Partial<Field>) => {
    setIsLoading(true);
    try {
      const target = impersonatingUser || user;
      if (!target) return;

      const resUser = await api.updateUser(updatedUser);
      if (impersonatingUser) {
        setImpersonatingUser(resUser);
      } else {
        setUser(resUser);
        localStorage.setItem('jf_session_user', JSON.stringify(resUser));
      }
      
      if (updatedField && target.role === UserRole.FIELD_OWNER) {
        // Tenta encontrar a arena pelo ownerId ou usa a arena atual se já estivermos no contexto dela
        const arena = fields.find(f => f.ownerId === target.id);
        if (arena) {
          await api.updateField(arena.id, updatedField);
        } else {
          console.warn("Arena não encontrada para o usuário:", target.id);
        }
      }
      
      alert("Perfil atualizado!");
      await refreshData();
      setShowProfileModal(false);
    } catch (err: any) { 
      console.error("Erro ao atualizar perfil:", err);
      alert(`Erro: ${err.message || "Erro desconhecido ao salvar"}`); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jf_session_user');
    updateAppBadge(0);
    window.location.href = '/';
  };

  const handleAdminResetPassword = async (userId: string) => {
    const newPass = prompt("Digite a nova senha para este usuário:");
    if (!newPass) return;
    
    try {
      setIsLoading(true);
      await api.adminUpdatePassword(userId, newPass);
      alert("Senha alterada com sucesso!");
    } catch (e: any) {
      alert("Erro ao alterar senha: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 text-[#10b981] animate-spin mb-4" />
        <h1 className="text-xl font-black italic uppercase tracking-tighter">Jogo Fácil</h1>
      </div>
    );
  }

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  
  if (view === 'AUTH') {
    return (
      <Auth 
        categories={categories} 
        onLogin={(u) => { 
          setUser(u); 
          // O useEffect vai checar a assinatura e redirecionar se for NONE
          setView('APP'); 
          localStorage.setItem('jf_session_user', JSON.stringify(u)); 
          if(u.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER');
          else if(u.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
          else setActiveTab('EXPLORE');
          refreshData();
        }} 
        onCancel={() => setView('LANDING')} 
      />
    );
  }

  if (view === 'SUBSCRIPTION') {
      return (
         <Subscription 
            userRole={user?.role || UserRole.TEAM_CAPTAIN} 
            onSubscribe={() => {}} // Lógica via link direto
            onBack={() => {
              // Bloqueia voltar se a assinatura for obrigatória
              if (user?.subscription !== SubscriptionPlan.NONE && user?.subscription !== SubscriptionPlan.FREE) {
                 setView('APP');
              } else {
                 handleLogout(); // Se tentar voltar sem pagar, faz logout
              }
            }} 
         />
      );
  }

  const currentUserContext = impersonatingUser || user;
  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe relative">
      {showInstallBanner && !isStandalone && (
        <div className={`bg-grass-600 text-white p-4 flex items-center justify-between animate-in slide-in-from-top duration-500 sticky top-0 z-[100] shadow-lg ${isIOS ? 'pt-12' : 'pt-safe'}`}>
           <div className="flex items-center gap-3">
              <Download className="w-5 h-5" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase leading-none">Instalar Jogo Fácil</span>
                <span className="text-[8px] font-bold opacity-80 uppercase mt-0.5">
                  {isIOS ? 'Toque em Compartilhar e "Adicionar à Tela de Início"' : 'Acesso rápido e offline'}
                </span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setShowInstallBanner(false)} className="p-1 opacity-50"><X className="w-4 h-4" /></button>
              {!isIOS && (
                <button 
                  onClick={handleInstallClick}
                  className="bg-white text-grass-700 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all"
                >
                  Instalar
                </button>
              )}
              {isIOS && <Share className="w-5 h-5 animate-bounce" />}
           </div>
        </div>
      )}

      {impersonatingUser && (
        <div className={`bg-red-500 text-white text-xs font-black uppercase tracking-widest p-2 text-center flex justify-between items-center px-4 ${isIOS ? 'pt-12' : 'pt-safe'}`}>
           <span>Acessando como: {impersonatingUser.name}</span>
           <button onClick={() => { setImpersonatingUser(null); setActiveTab('SUPER'); }} className="bg-white/20 px-3 py-1 rounded-lg hover:bg-white/30"><LogOut className="w-4 h-4" /></button>
        </div>
      )}

      <header className={`bg-white/95 backdrop-blur-md px-6 flex justify-between items-center sticky top-0 z-50 border-b shadow-sm transition-all ${isIOS ? 'pt-12 pb-4' : 'pt-safe py-4'}`}>
          <div className="mt-2 w-full flex justify-between items-center">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-grass-600" />
                  <span className="text-xl font-black text-[#022c22] italic uppercase leading-none">JOGO FÁCIL</span>
                </div>
                {user && (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Olá, {currentUserContext?.name.split(' ')[0]}</span>
                        {currentUserContext?.subscription && currentUserContext.subscription !== 'FREE' && (
                           <span className="bg-yellow-400 text-pitch px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1">
                              <Crown className="w-2 h-2" /> PRO
                           </span>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowNotifications(true)} 
                className="p-3 bg-gray-50 rounded-xl relative active:scale-95 transition-all hover:bg-gray-100"
              >
                <Bell className="w-6 h-6 text-gray-500" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {unreadNotifs}
                  </span>
                )}
              </button>
              <button 
                onClick={() => refreshData(false)} 
                disabled={isLoading}
                className={`p-3 bg-gray-50 rounded-xl transition-all hover:bg-gray-100 ${isLoading ? 'animate-spin opacity-50' : 'active:scale-95'}`}
              >
                <RefreshCw className="w-6 h-6 text-[#10b981]" />
              </button>
            </div>
          </div>
      </header>

      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex justify-end pt-safe">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto mt-safe">
             <div className="p-6 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                <h2 className="font-black text-pitch uppercase italic">Notificações</h2>
                <button onClick={() => setShowNotifications(false)} className="p-2"><X className="w-6 h-6"/></button>
             </div>
             <div className="p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 font-bold uppercase text-[10px]">Nenhuma notificação encontrada</div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 rounded-2xl border flex gap-3 transition-all cursor-pointer ${n.read ? 'bg-white opacity-60' : 'bg-grass-50 border-grass-100 shadow-sm'}`}
                    >
                       <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm ${n.type === 'success' ? 'bg-grass-50 text-grass-600 border-grass-200' : n.type === 'warning' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                          <Info className="w-5 h-5" />
                       </div>
                       <div className="flex-1">
                          <h4 className="font-black text-pitch text-[10px] uppercase leading-tight mb-1">{n.title}</h4>
                          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{n.description}</p>
                          <span className="text-[8px] text-gray-300 font-black uppercase mt-2 block">{new Date(n.timestamp).toLocaleString()}</span>
                       </div>
                       {!n.read && <div className="w-2 h-2 bg-red-500 rounded-full self-center" />}
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      <main className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'SUPER' && user?.role === UserRole.SUPER_ADMIN && (
          <div className="p-6 space-y-6">
             <div className="bg-[#022c22] rounded-[2.5rem] p-8 text-white shadow-xl">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Super Admin</h2>
                <p className="text-xs text-grass-500 font-bold uppercase tracking-widest mt-1">Gerenciamento de Contas</p>
             </div>
             
             {/* Barra de Busca Super Admin */}
             <div className="bg-white p-4 rounded-[2rem] border shadow-sm space-y-3">
                <div className="flex p-1 bg-gray-100 rounded-2xl">
                    <button 
                      onClick={() => setAdminFilterRole('FIELD_OWNER')} 
                      className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all ${adminFilterRole === 'FIELD_OWNER' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}
                    >
                      <Building2 className="w-3 h-3 inline-block mr-1 mb-0.5" /> Arenas
                    </button>
                    <button 
                      onClick={() => setAdminFilterRole('TEAM_CAPTAIN')} 
                      className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all ${adminFilterRole === 'TEAM_CAPTAIN' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}
                    >
                      <Shield className="w-3 h-3 inline-block mr-1 mb-0.5" /> Times
                    </button>
                    <button 
                      onClick={() => setAdminFilterRole('ALL')} 
                      className={`flex-1 py-2 px-3 text-[10px] font-black uppercase rounded-xl transition-all ${adminFilterRole === 'ALL' ? 'bg-white text-pitch shadow-sm' : 'text-gray-400'}`}
                    >
                      Todos
                    </button>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border">
                   <Search className="w-5 h-5 text-gray-400 ml-2" />
                   <input 
                      className="w-full bg-transparent font-bold outline-none text-pitch placeholder-gray-300 uppercase text-xs"
                      placeholder="Buscar por Nome ou Email..."
                      value={adminSearch}
                      onChange={e => setAdminSearch(e.target.value)}
                   />
                </div>
             </div>

             <div className="space-y-4">
               {allUsers
                  .filter(u => u.id !== user.id)
                  .filter(u => adminFilterRole === 'ALL' || u.role === adminFilterRole)
                  .filter(u => {
                      if (!adminSearch) return true;
                      const search = adminSearch.toLowerCase();
                      return u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
                  })
                  .map(u => (
                 <div key={u.id} className="bg-white p-5 rounded-[2rem] border flex flex-col gap-4 shadow-sm hover:border-pitch transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${u.role === UserRole.FIELD_OWNER ? 'bg-indigo-500' : 'bg-grass-500'}`}>
                         {u.role === UserRole.FIELD_OWNER ? <Building2 className="w-6 h-6"/> : <Shield className="w-6 h-6"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-pitch text-sm truncate">{u.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{u.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[8px] font-black bg-gray-100 px-2 py-0.5 rounded-md uppercase">{u.role === UserRole.FIELD_OWNER ? 'Dono de Campo' : 'Capitão'}</span>
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${u.subscription !== SubscriptionPlan.FREE && u.subscription !== SubscriptionPlan.NONE ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                             {u.subscription === SubscriptionPlan.NONE ? 'Sem Plano' : u.subscription}
                           </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 border-t pt-3">
                      <button 
                        onClick={() => { setImpersonatingUser(u); setActiveTab('EXPLORE'); }} 
                        className="flex-1 py-3 bg-gray-50 rounded-xl text-[10px] font-black uppercase text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-100"
                      >
                        <Eye className="w-4 h-4" /> Acessar Conta
                      </button>
                      <button 
                        onClick={() => handleAdminResetPassword(u.id)} 
                        className="flex-1 py-3 bg-gray-50 rounded-xl text-[10px] font-black uppercase text-gray-600 flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500"
                      >
                        <KeyRound className="w-4 h-4" /> Resetar Senha
                      </button>
                    </div>
                 </div>
               ))}
               {allUsers.length === 0 && (
                   <div className="text-center text-gray-400 font-bold uppercase text-[10px] mt-10">Nenhum usuário encontrado.</div>
               )}
             </div>
          </div>
        )}

        {(activeTab === 'EXPLORE' || activeTab === 'MY_GAMES') && currentUserContext && (
            <TeamDashboard 
                categories={categories} 
                onRefresh={refreshData}
                viewMode={activeTab === 'EXPLORE' ? 'EXPLORE' : 'MY_BOOKINGS'} 
                currentUser={currentUserContext} 
                fields={fields} 
                slots={slots}
                onCancelBooking={handleCancelBooking}
                onRateTeam={() => {
                  alert("Funcionalidade de avaliação em breve!");
                }}
            />
        )}

        {activeTab === 'ADMIN' && currentUserContext && (
          currentUserContext.role === UserRole.FIELD_OWNER ? (
            (() => {
              const userField = fields.find(f => f.ownerId === currentUserContext.id);
              return (
                <FieldDashboard 
                    categories={categories} 
                    field={userField || { id: '', name: 'Carregando...', ownerId: '', location: '', hourlyRate: 0, cancellationFeePercent: 0, pixConfig: { key: '', name: '' }, imageUrl: '', contactPhone: '', latitude: 0, longitude: 0, courts: [] }} 
                    slots={userField ? slots.filter(s => s.fieldId === userField.id) : []} 
                    currentUser={currentUserContext}
                    onAddSlot={async (newSlots) => { 
                      try {
                        const createdSlots = await api.createSlots(newSlots); 
                        setSlots(prev => [...prev, ...createdSlots]); 
                      } catch (err: any) {
                        console.error("Error adding slots:", err);
                        throw new Error(err.message || "Erro ao salvar no banco de dados");
                      }
                    }}
                    onUpdateSlot={async (id, updates) => {
                      try {
                        await api.updateSlot(id, updates);
                        setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
                      } catch (err: any) {
                        console.error("Error updating slot:", err);
                        throw new Error(err.message || "Erro ao atualizar no banco de dados");
                      }
                    }}
                    onRefreshData={refreshData}
                    onDeleteSlot={async id => { 
                      await api.deleteSlot(id); 
                      setSlots(prev => prev.filter(s => s.id !== id));
                    }}
                    onConfirmBooking={async id => { 
                      const slot = slots.find(s => s.id === id);
                      const newStatus = slot?.status === 'pending_verification' ? 'confirmed' : 'pending_payment';
                      await api.updateSlot(id, { status: newStatus, isBooked: true }); 
                      refreshData(); 
                    }}
                    onRejectBooking={async id => { await api.updateSlot(id, { status: 'rejected', isBooked: false, receiptUrl: undefined }); refreshData(); }}
                    onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                    onRateTeam={() => {}}
                    forceTab={fieldDashForceTab}
                />
              );
            })()
          ) : (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="bg-red-50 text-red-500 p-6 rounded-full mb-6"><Shield className="w-12 h-12" /></div>
              <h3 className="font-black text-pitch text-xl italic uppercase tracking-tighter">Acesso Restrito</h3>
              <p className="text-gray-400 text-xs font-bold uppercase mt-2">Área exclusiva para proprietários.</p>
            </div>
          )
        )}

        {activeTab === 'PROFILE' && currentUserContext && (
            <div className="p-10 flex flex-col items-center">
                <div className="w-32 h-32 bg-[#022c22] rounded-[3rem] flex items-center justify-center text-5xl font-black text-[#10b981] shadow-2xl mb-6 border-4 border-[#10b981]">
                  {currentUserContext.name.charAt(0)}
                </div>
                <h2 className="text-2xl font-black text-pitch italic uppercase tracking-tighter leading-none">{currentUserContext.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{currentUserContext.role}</p>
                   {currentUserContext.subscription !== SubscriptionPlan.FREE && (
                      <span className="bg-yellow-400 text-pitch px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1">
                          <Crown className="w-2 h-2" /> PRO
                      </span>
                   )}
                </div>
                
                <div className="w-full mt-10 space-y-3">
                  {!isStandalone && (deferredPrompt || isIOS) && (
                    <button 
                      onClick={handleInstallClick} 
                      className="w-full py-5 bg-grass-500 text-pitch rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs hover:bg-grass-400 transition-colors shadow-lg shadow-grass-500/20"
                    >
                      <Download className="w-5 h-5" /> {isIOS ? 'Instalar no iPhone' : 'Instalar Aplicativo'}
                    </button>
                  )}
                  
                  {/* Botão de assinatura removido pois agora é obrigatória a partir da criação */}

                  <button onClick={() => {
                    const link = window.location.origin;
                    const message = `Venha jogar no Jogo Fácil! Cadastre seu time ou sua arena: ${link}`;
                    navigator.clipboard.writeText(message);
                    alert("Link de convite copiado!");
                  }} className="w-full py-5 bg-indigo-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform">
                      <UserPlus className="w-5 h-5" /> Convidar Amigos
                  </button>
                  <button onClick={() => setShowProfileModal(true)} className="w-full py-5 bg-[#022c22] text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform">
                      <Settings className="w-5 h-5 text-[#10b981]" /> Configurações
                  </button>
                  <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-3xl font-black uppercase text-xs active:scale-95 transition-transform">Sair</button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 pb-safe flex justify-around z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          {currentUserContext?.role === UserRole.SUPER_ADMIN ? (
             <button onClick={() => setActiveTab('SUPER')} className={`flex flex-col items-center gap-1 ${activeTab === 'SUPER' ? 'text-[#10b981]' : 'text-gray-300'}`}>
                <Users className="w-6 h-6" />
                <span className="text-[8px] font-black uppercase">Gerenciamento</span>
             </button>
          ) : (
            <>
              <button onClick={() => setActiveTab('EXPLORE')} className={`flex flex-col items-center gap-1 ${activeTab === 'EXPLORE' ? 'text-[#10b981]' : 'text-gray-300'}`}>
                <Search className="w-6 h-6" />
                <span className="text-[8px] font-black uppercase">Explorar</span>
              </button>
              
              {currentUserContext?.role === UserRole.TEAM_CAPTAIN ? (
                <button onClick={() => setActiveTab('MY_GAMES')} className={`flex flex-col items-center gap-1 ${activeTab === 'MY_GAMES' ? 'text-[#10b981]' : 'text-gray-300'}`}>
                  <History className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase">Meus Jogos</span>
                </button>
              ) : (
                <button onClick={() => setActiveTab('ADMIN')} className={`flex flex-col items-center gap-1 ${activeTab === 'ADMIN' ? 'text-[#10b981]' : 'text-gray-300'}`}>
                  <Building2 className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase">Arena</span>
                </button>
              )}
            </>
          )}

          <button onClick={() => setActiveTab('PROFILE')} className={`flex flex-col items-center gap-1 ${activeTab === 'PROFILE' ? 'text-[#10b981]' : 'text-gray-300'}`}>
            <Settings className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Perfil</span>
          </button>
      </nav>

      {showProfileModal && currentUserContext && (
        <EditProfileModal 
          categories={categories} 
          user={currentUserContext} 
          field={fields.find(f => f.ownerId === currentUserContext.id)} 
          onUpdate={handleUpdateProfile} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}
    </div>
  );
};

export default App;