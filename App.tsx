import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Field, MatchSlot, User, InAppNotification, SubscriptionPlan } from './types';
import { Landing } from './views/Landing';
import { Auth, AuthMode } from './views/Auth';
import { InviteLanding } from './views/InviteLanding';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { Subscription } from './views/Subscription';
import { EditProfileModal } from './components/EditProfileModal';
import { HelpModal } from './views/HelpModal';
import { MensalistaSubscriptionModal } from './components/MensalistaSubscriptionModal';
import { api, sessionToken, setActAsUser } from './api';
import { monthlyPriceForTeams, countBillableCategories, formatBRL } from './shared/pricing';
import { RefreshCw, Settings, Building2, Shield, Search, Loader2, Bell, X, Info, History, KeyRound, Eye, LogOut, Smartphone, Download, Share, Trophy, Crown, Users, UserPlus, HelpCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!("Notification" in window)) return 'unsupported';
    return Notification.permission;
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMensalistaSubModal, setShowMensalistaSubModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [fieldDashForceTab, setFieldDashForceTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO' | undefined>(undefined);
  const [showNeedsSubscription, setShowNeedsSubscription] = useState(false);
  const [showSubscriptionPage, setShowSubscriptionPage] = useState(false);
  // Link de convite (?convite=TOKEN): guardado até a pessoa entrar/criar conta
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('convite');
      if (fromUrl) {
        sessionStorage.setItem('jf_invite', fromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        return fromUrl;
      }
      return sessionStorage.getItem('jf_invite');
    } catch { return null; }
  });
  const [authOptions, setAuthOptions] = useState<{ mode?: AuthMode; inviteCategory?: string }>({});

  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  
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

  // Bloqueio da mensalidade: dono de time com mais de 1 categoria precisa estar com a assinatura ativa.
  // Assinantes do plano antigo (Mercado Pago) continuam liberados até migrarem.
  useEffect(() => {
    if (!user || impersonatingUser || user.role !== UserRole.TEAM_CAPTAIN) {
      setShowNeedsSubscription(false);
      return;
    }
    const price = monthlyPriceForTeams(user.teams);
    const legacySubscriber = !!user.isSubscribed && (!user.billingStatus || user.billingStatus === 'FREE');
    setShowNeedsSubscription(price > 0 && user.billingStatus !== 'ACTIVE' && !legacySubscriber);
  }, [user, impersonatingUser]);

  // Admin geral acessando outra conta: as ações no servidor vão em nome dela
  useEffect(() => {
    setActAsUser(impersonatingUser?.id || null);
  }, [impersonatingUser]);

  const saveSessionUser = (u: User) => {
    setUser(u);
    localStorage.setItem('jf_session_user', JSON.stringify(u));
  };

  const clearInvite = () => {
    try { sessionStorage.removeItem('jf_invite'); } catch { /* ignore */ }
    setInviteToken(null);
  };

  // Sessão expirada no servidor: volta para o login
  useEffect(() => {
    const onExpired = () => {
      alert('Sua sessão expirou. Entre novamente.');
      localStorage.removeItem('jf_session_user');
      sessionToken.set(null);
      setUser(null);
      setImpersonatingUser(null);
      setAuthOptions({ mode: 'LOGIN' });
      setView('AUTH');
    };
    window.addEventListener('jf:session-expired', onExpired);
    return () => window.removeEventListener('jf:session-expired', onExpired);
  }, []);

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

  const showLocalNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      const iconUrl = 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png';
      // Tenta usar o Service Worker para mostrar a notificação (funciona melhor em background)
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          (registration as any).showNotification(title, {
            body,
            icon: iconUrl,
            vibrate: [200, 100, 200],
            badge: iconUrl,
          });
        });
      } else {
        // Fallback para notificação simples
        new Notification(title, { body, icon: iconUrl });
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        console.log('Permissão para notificações concedida!');
        showLocalNotification("Notificações Ativadas! ⚽", "Você agora receberá alertas sobre suas partidas.");
      }
    }
  };

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

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
        api.getSlotsByFieldId(currentUser?.fieldId || '', true).catch(() => api.getSlots().catch(() => [] as MatchSlot[])),
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
          if (payload.new) {
             const newNotif = payload.new as any;
             showLocalNotification(newNotif.title, newNotif.description);
          }
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
          if (u && u.id && !sessionToken.get()) {
            // Versão nova usa sessão do servidor: quem entrou na versão antiga precisa logar de novo
            localStorage.removeItem('jf_session_user');
            setAuthOptions({ mode: 'LOGIN' });
          } else if (u && u.id) {
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
    if (!confirm("Deseja realmente cancelar este agendamento?")) return;
    setIsLoading(true);
    try {
      const res = await api.match('cancel', slotId);
      alert(res.message || 'Agendamento cancelado.');
      await refreshData();
    } catch (e: any) {
      alert(e.message || "Erro ao cancelar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (n: InAppNotification) => {
    if (!n.read) {
      await api.markNotificationAsRead(n.id);
      const unreadCount = notifications.filter(not => !not.read && not.id !== n.id).length;
      updateAppBadge(unreadCount);
    }
    
    setShowNotifications(false);
    await refreshData();
    
    const t = n.title.toLowerCase();
    if (user?.role === UserRole.FIELD_OWNER && (t.includes('desafio') || t.includes('mensalista') || t.includes('aprove') || t.includes('pagamento'))) {
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

      let resUser = await api.updateUser(updatedUser);
      if (resUser.role === UserRole.TEAM_CAPTAIN) {
        // Ajusta a mensalidade ao novo número de categorias
        try {
          await api.billing('sync');
          resUser = await api.getUserById(resUser.id);
        } catch (e) {
          console.warn('Não foi possível sincronizar a mensalidade', e);
        }
      }
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
    sessionToken.set(null);
    setActAsUser(null);
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

  // Convite aberto (antes ou depois de entrar)
  if (inviteToken && view !== 'AUTH' && !impersonatingUser) {
    return (
      <InviteLanding
        token={inviteToken}
        currentUser={user}
        onAuth={(mode, category) => {
          setAuthOptions({ mode, inviteCategory: mode === 'REGISTER' ? category : undefined });
          setView('AUTH');
        }}
        onUserUpdated={saveSessionUser}
        onDone={() => {
          clearInvite();
          setView('APP');
          setActiveTab('MY_GAMES');
          refreshData();
        }}
        onDismiss={() => {
          clearInvite();
          setView(user ? 'APP' : 'LANDING');
        }}
      />
    );
  }

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  
  if (view === 'AUTH') {
    return (
      <Auth 
        key={`${authOptions.mode || 'LOGIN'}-${authOptions.inviteCategory || ''}`}
        categories={categories} 
        initialMode={authOptions.mode}
        inviteCategory={authOptions.inviteCategory}
        onLogin={(u) => { 
          saveSessionUser(u);
          setAuthOptions({});
          setView('APP'); 
          if(u.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER');
          else if(u.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
          else setActiveTab('EXPLORE');
          refreshData();
        }} 
        onCancel={() => setView('LANDING')} 
      />
    );
  }

  if (user && (showNeedsSubscription || showSubscriptionPage) && !impersonatingUser) {
    return (
      <>
        <Subscription
          user={user}
          blocking={showNeedsSubscription}
          onLogout={handleLogout}
          onBack={() => setShowSubscriptionPage(false)}
          onEditCategories={() => setShowProfileModal(true)}
          onUserUpdated={saveSessionUser}
        />
        {showProfileModal && (
          <EditProfileModal
            categories={categories}
            user={user}
            field={undefined}
            onUpdate={handleUpdateProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}
      </>
    );
  }

  const currentUserContext = impersonatingUser || user;
  // Selo PRO: dono de time com mensalidade ativa (ou assinante do plano antigo)
  const isPro = !!currentUserContext && currentUserContext.role === UserRole.TEAM_CAPTAIN && (
    currentUserContext.billingStatus === 'ACTIVE' ||
    (!!currentUserContext.isSubscribed && (!currentUserContext.billingStatus || currentUserContext.billingStatus === 'FREE'))
  );
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
                        {isPro && (
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
                      try { await api.match('field_decision', id, { approve: true }); } catch (e: any) { alert(e.message); }
                      refreshData();
                    }}
                    onRejectBooking={async id => {
                      try { await api.match('field_decision', id, { approve: false }); } catch (e: any) { alert(e.message); }
                      refreshData();
                    }}
                    onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                    onRateTeam={() => {}}
                    forceTab={fieldDashForceTab}
                    isAdminView={!!impersonatingUser}
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
                   {isPro && (
                      <span className="bg-yellow-400 text-pitch px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1">
                          <Crown className="w-2 h-2" /> PRO
                      </span>
                   )}
                </div>
                {currentUserContext.role === UserRole.TEAM_CAPTAIN && (
                  <div className="mt-4 text-xs font-bold text-gray-500 text-center">
                    {countBillableCategories(currentUserContext.teams)} categoria(s) •{' '}
                    {monthlyPriceForTeams(currentUserContext.teams) > 0 ? `${formatBRL(monthlyPriceForTeams(currentUserContext.teams))}/mês` : 'Plano grátis'}
                  </div>
                )}
                
                <div className="w-full mt-10 space-y-3">
                  {!isStandalone && (deferredPrompt || isIOS) && (
                    <button 
                      onClick={handleInstallClick} 
                      className="w-full py-5 bg-grass-500 text-pitch rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs hover:bg-grass-400 transition-colors shadow-lg shadow-grass-500/20"
                    >
                      <Download className="w-5 h-5" /> {isIOS ? 'Instalar no iPhone' : 'Instalar Aplicativo'}
                    </button>
                  )}
                  
                  {currentUserContext.role === UserRole.TEAM_CAPTAIN && !impersonatingUser && (
                    <button
                      onClick={() => setShowSubscriptionPage(true)}
                      className="w-full py-5 bg-yellow-400 text-pitch rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform"
                    >
                      <Crown className="w-5 h-5" /> Minha mensalidade
                    </button>
                  )}
                  
                  {currentUserContext.role === UserRole.TEAM_CAPTAIN && (
                    <button 
                      onClick={() => setShowMensalistaSubModal(true)} 
                      className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform"
                    >
                        <Trophy className="w-5 h-5" /> Seja Mensalista
                    </button>
                  )}

                  {notifPermission === 'default' && (
                    <button 
                      onClick={requestNotificationPermission} 
                      className="w-full py-5 bg-grass-50 text-grass-700 border-2 border-grass-500 rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform animate-pulse"
                    >
                        <Bell className="w-5 h-5" /> Ativar Notificações
                    </button>
                  )}

                  <button onClick={() => {
                    const link = window.location.origin;
                    const message = `Venha jogar no Jogo Fácil! Cadastre seu time ou sua arena: ${link}`;
                    navigator.clipboard.writeText(message);
                    alert("Link de convite copiado!");
                  }} className="w-full py-5 bg-indigo-500 text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform">
                      <UserPlus className="w-5 h-5" /> Convidar Amigos
                  </button>
                  <button onClick={() => setShowHelpModal(true)} className="w-full py-5 bg-blue-50 text-blue-600 rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-transform">
                      <HelpCircle className="w-5 h-5" /> Ajuda e Tutoriais
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

      {showHelpModal && currentUserContext && (
        <HelpModal 
          currentUser={currentUserContext}
          onClose={() => setShowHelpModal(false)}
        />
      )}
    {showMensalistaSubModal && currentUserContext && (
      <MensalistaSubscriptionModal 
        fields={fields} 
        currentUser={currentUserContext} 
        onClose={() => setShowMensalistaSubModal(false)}
        onSuccess={(msg) => alert(msg)}
      />
    )}
    </div>
  );
};

export default App;