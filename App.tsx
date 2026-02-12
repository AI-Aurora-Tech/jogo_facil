
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Field, MatchSlot, User, Notification } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './api';
import { RefreshCw, Settings, Building2, Shield, Search, Loader2, Bell, X, Info, History, KeyRound, Eye, LogOut, Smartphone, Download, Share } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [fieldDashForceTab, setFieldDashForceTab] = useState<'AGENDA' | 'SOLICITACOES' | 'MENSALISTAS' | 'HISTORICO' | undefined>(undefined);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null);

  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar evento de instalação (Android/Desktop)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    });

    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    });

    // Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    
    // Verificar se já está rodando como app (standalone)
    const isInStandaloneMode = ('standalone' in window.navigator && (window.navigator as any).standalone) || 
                               (window.matchMedia('(display-mode: standalone)').matches);
    
    setIsStandalone(isInStandaloneMode);

    if (isIosDevice && !isInStandaloneMode) {
      setIsIOS(true);
      setShowInstallBanner(true);
    }
  }, []);

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

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [f, s, cats] = await Promise.all([
        api.getFields().catch(() => [] as Field[]),
        api.getSlots().catch(() => [] as MatchSlot[]),
        api.getCategories().catch(() => ["Livre"] as string[])
      ]);
      
      setFields(f);
      setSlots(s);
      setCategories(cats);
      
      const saved = localStorage.getItem('jf_session_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          const notifs = await api.getNotifications(u.id).catch(() => []);
          setNotifications(notifs);

          if (u?.role === UserRole.SUPER_ADMIN) {
            const users = await api.getAllUsers().catch(() => []);
            setAllUsers(users);
          }
        } catch (e) { console.error("Session parse error", e); }
      }
    } catch (e) { 
      console.error("Global Refresh Error:", e); 
    } finally { 
      setIsLoading(false); 
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('jf_session_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          if (u && u.id) {
            setUser(u);
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
          bookedByTeamName: null as any, 
          bookedByUserId: null as any, 
          opponentTeamName: null as any, 
          opponentTeamCategory: null as any,
          opponentTeamPhone: null as any,
          opponentTeamLogoUrl: null as any,
          opponentTeamGender: null as any,
          receiptUrl: null as any 
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
    if (!n.read) await api.markNotificationAsRead(n.id);
    setShowNotifications(false);
    await refreshData();
    
    if (user?.role === UserRole.FIELD_OWNER && n.title.toLowerCase().includes('desafio')) {
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
      if (!impersonatingUser) {
        setUser(resUser);
        localStorage.setItem('jf_session_user', JSON.stringify(resUser));
      }
      
      if (updatedField && target.role === UserRole.FIELD_OWNER) {
        const arena = fields.find(f => f.ownerId === target.id);
        if (arena) await api.updateField(arena.id, updatedField);
      }
      
      alert("Perfil atualizado!");
      await refreshData();
      setShowProfileModal(false);
    } catch (err: any) { 
      alert(`Erro: ${err.message}`); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jf_session_user');
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

  const currentUserContext = impersonatingUser || user;
  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe relative">
      {/* PWA Install Banner */}
      {showInstallBanner && !isStandalone && (
        <div className="bg-grass-600 text-white p-4 flex items-center justify-between animate-in slide-in-from-top duration-500 sticky top-0 z-[100] shadow-lg">
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

      {/* Impersonation Banner */}
      {impersonatingUser && (
        <div className="bg-red-500 text-white text-xs font-black uppercase tracking-widest p-2 text-center flex justify-between items-center px-4">
           <span>Acessando como: {impersonatingUser.name}</span>
           <button onClick={() => { setImpersonatingUser(null); setActiveTab('SUPER'); }} className="bg-white/20 px-3 py-1 rounded-lg hover:bg-white/30"><LogOut className="w-4 h-4" /></button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50 border-b">
          <div className="flex flex-col">
              <span className="text-xl font-black text-[#022c22] italic uppercase leading-none">JOGO FÁCIL</span>
              {user && <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Olá, {currentUserContext?.name.split(' ')[0]}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNotifications(true)} 
              className="p-2 bg-gray-50 rounded-xl relative active:scale-95 transition-all"
            >
              <Bell className="w-5 h-5 text-gray-500" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadNotifs}
                </span>
              )}
            </button>
            <button 
              onClick={refreshData} 
              disabled={isLoading}
              className={`p-2 bg-gray-50 rounded-xl transition-all ${isLoading ? 'animate-spin opacity-50' : 'active:scale-95'}`}
            >
              <RefreshCw className="w-5 h-5 text-[#10b981]" />
            </button>
          </div>
      </header>

      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex justify-end">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
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
             
             <div className="space-y-4">
               {allUsers.filter(u => u.id !== user.id).map(u => (
                 <div key={u.id} className="bg-white p-5 rounded-[2rem] border flex flex-col gap-4 shadow-sm hover:border-pitch transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${u.role === UserRole.FIELD_OWNER ? 'bg-indigo-500' : 'bg-grass-500'}`}>
                         {u.role === UserRole.FIELD_OWNER ? <Building2 className="w-6 h-6"/> : <Shield className="w-6 h-6"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-pitch text-sm truncate">{u.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase truncate">{u.email}</p>
                        <span className="text-[8px] font-black bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block uppercase">{u.role}</span>
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
                onBookSlot={async (id, data) => {
                   await api.updateSlot(id, { bookedByUserId: currentUserContext.id, bookedByTeamName: data.teamName, status: 'pending_verification' });
                   refreshData();
                }}
                onCancelBooking={handleCancelBooking}
            />
        )}

        {activeTab === 'ADMIN' && currentUserContext && (
          currentUserContext.role === UserRole.FIELD_OWNER ? (
            <FieldDashboard 
                categories={categories} 
                field={fields.find(f => f.ownerId === currentUserContext.id) || { id: '', name: 'Carregando...', ownerId: '', location: '', hourlyRate: 0, cancellationFeePercent: 0, pixConfig: { key: '', name: '' }, imageUrl: '', contactPhone: '', latitude: 0, longitude: 0, courts: [] }} 
                slots={slots.filter(s => s.fieldId === fields.find(f => f.ownerId === currentUserContext.id)?.id)} 
                currentUser={currentUserContext}
                onAddSlot={async s => { await api.createSlots(s); refreshData(); }}
                onRefreshData={refreshData}
                onDeleteSlot={async id => { await api.deleteSlot(id); refreshData(); }}
                onConfirmBooking={async id => { await api.updateSlot(id, { status: 'confirmed', isBooked: true }); refreshData(); }}
                onRejectBooking={async id => { await api.updateSlot(id, { status: 'available', receiptUrl: null as any }); refreshData(); }}
                onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                onRateTeam={() => {}}
                forceTab={fieldDashForceTab}
            />
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
                <div className="w-32 h-32 bg-[#022c22] rounded-[3rem] flex items-center justify-center text-5xl font-black text-[#10b981] shadow-2xl mb-6">
                  {currentUserContext.name.charAt(0)}
                </div>
                <h2 className="text-2xl font-black text-pitch italic uppercase tracking-tighter leading-none">{currentUserContext.name}</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{currentUserContext.role}</p>
                
                <div className="w-full mt-10 space-y-3">
                  {!isStandalone && (deferredPrompt || isIOS) && (
                    <button 
                      onClick={handleInstallClick} 
                      className="w-full py-5 bg-grass-500 text-pitch rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs hover:bg-grass-400 transition-colors shadow-lg shadow-grass-500/20"
                    >
                      <Download className="w-5 h-5" /> {isIOS ? 'Instalar no iPhone' : 'Instalar Aplicativo'}
                    </button>
                  )}
                  <button onClick={() => setShowProfileModal(true)} className="w-full py-5 bg-[#022c22] text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs">
                      <Settings className="w-5 h-5 text-[#10b981]" /> Configurações
                  </button>
                  <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-3xl font-black uppercase text-xs">Sair</button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around z-50">
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
