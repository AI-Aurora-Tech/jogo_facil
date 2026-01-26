
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, Notification, SubTeam } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Search, Trophy, User as UserIcon, RefreshCw, Settings, Building2, MapPin, CalendarDays, TrendingUp, Users2, BarChart3, Bell, X, CheckCircle2, Clock, AlertCircle, Shield, Edit2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: 'Bem-vindo ao Jogo Fácil!', description: 'Finalize seu perfil para começar a agendar suas partidas.', timestamp: 'Agora', type: 'info', read: false },
    { id: '2', title: 'Arena Atualizada', description: 'A Arena Jogo Fácil adicionou novos horários para este final de semana.', timestamp: '10 min atrás', type: 'success', read: false }
  ]);

  useEffect(() => {
    const checkSession = async () => {
        const savedUser = localStorage.getItem('jf_session_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            const freshUser = await api.updateUser(parsed); 
            setUser(freshUser);
            setView('APP');
            if (freshUser.role === UserRole.ADMIN || freshUser.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
            refreshData();
          } catch (e) { 
            console.error("Falha ao recuperar sessão, deslogando...");
            localStorage.removeItem('jf_session_user'); 
          }
        }
    };
    
    checkSession();
    loadInitialData();
    
    navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Permissão de local negada.")
    );

    const interval = setInterval(() => { if (user) refreshData(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
        const cats = await api.getCategories();
        setCategories(cats);
    } catch (e) { console.error("Erro categorias:", e); }
  };

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    localStorage.setItem('jf_session_user', JSON.stringify(loggedUser));
    if (loggedUser.subscription === SubscriptionPlan.NONE && loggedUser.role !== UserRole.ADMIN) {
        setView('SUBSCRIPTION');
    } else {
        setView('APP');
        setActiveTab(loggedUser.role === UserRole.FIELD_OWNER ? 'ADMIN' : 'EXPLORE');
        refreshData();
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [f, s, cats] = await Promise.all([api.getFields(), api.getSlots(), api.getCategories()]);
      setFields(f);
      setSlots(s);
      setCategories(cats);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleUpdateProfile = async (updatedUser: User, updatedField?: Partial<Field>) => {
    setIsLoading(true);
    try {
      // 1. Atualizar dados do Usuário
      const resUser = await api.updateUser(updatedUser);
      setUser(resUser);
      localStorage.setItem('jf_session_user', JSON.stringify(resUser));

      // 2. Se for dono de campo e enviou dados da arena, atualizar a arena
      if (updatedField && user?.role === UserRole.FIELD_OWNER) {
        const myField = fields.find(f => f.ownerId === user.id);
        if (myField) {
          await api.updateField(myField.id, updatedField);
        }
      }

      setNotifications([
        { id: Math.random().toString(), title: 'Perfil Atualizado', description: 'Suas informações foram salvas com sucesso.', timestamp: 'Agora', type: 'success', read: false },
        ...notifications
      ]);
      
      await refreshData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar alterações.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetSlot = async (id: string) => {
    await api.updateSlot(id, {
        isBooked: false,
        status: 'available',
        bookedByTeamName: null as any,
        bookedByUserId: null as any,
        bookedByPhone: null as any,
        bookedByCategory: null as any,
        opponentTeamName: null as any,
        receiptUrl: null as any,
        aiVerificationResult: null as any,
        ratingGiven: 0
    });
    refreshData();
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  if (view === 'AUTH') return <Auth categories={categories} onLogin={handleAuthSuccess} onCancel={() => setView('LANDING')} />;
  if (view === 'SUBSCRIPTION' && user) return <Subscription userRole={user.role} onSubscribe={async (p) => {
    const updated = { ...user, subscription: p, subscriptionExpiry: new Date(Date.now() + 2592000000).toISOString() };
    const res = await api.updateUser(updated);
    setUser(res);
    localStorage.setItem('jf_session_user', JSON.stringify(res));
    setView('APP');
    refreshData();
  }} onBack={() => setView('LANDING')} />;

  const myField = user?.role === UserRole.FIELD_OWNER ? fields.find(f => f.ownerId === user.id) : null;
  const mySlots = myField ? slots.filter(s => s.fieldId === myField.id) : [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      <header className="bg-white px-6 pt-safe pb-4 flex justify-between items-center sticky top-0 z-50 shadow-sm glass">
          <div className="flex flex-col">
              <span className="text-xl font-black text-pitch tracking-tighter italic uppercase leading-none">JOGO FÁCIL</span>
              <p className="text-[8px] font-black text-grass-600 uppercase tracking-widest">Football Pro</p>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={() => setShowNotifications(true)} className="relative p-2 text-gray-400 hover:text-pitch transition-colors">
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-grass-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                        {unreadCount}
                    </span>
                  )}
              </button>
              <button onClick={refreshData} className={`p-2 transition-transform active:rotate-180 ${isLoading ? 'animate-spin' : ''}`}>
                  <RefreshCw className="w-5 h-5 text-grass-500" />
              </button>
          </div>
      </header>

      {/* NOTIFICATION PANEL */}
      {showNotifications && (
          <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
              <div className="fixed inset-0 bg-pitch/40 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
              <div className="relative bg-white w-full max-w-[320px] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                      <h2 className="text-sm font-black text-pitch uppercase tracking-widest">Atividades</h2>
                      <div className="flex gap-2">
                        <button onClick={markAllRead} className="text-[10px] font-black text-grass-600 uppercase">Lidas</button>
                        <button onClick={() => setShowNotifications(false)} className="p-1 bg-white rounded-lg border shadow-sm"><X className="w-4 h-4" /></button>
                      </div>
                  </div>
                  <div className="flex-grow overflow-y-auto p-4 space-y-3 no-scrollbar">
                      {notifications.length === 0 ? (
                          <div className="text-center py-20 text-gray-300 font-bold italic text-xs">Nada por aqui ainda.</div>
                      ) : (
                          notifications.map(n => (
                              <div key={n.id} className={`p-4 rounded-2xl border transition-all ${n.read ? 'bg-white opacity-60' : 'bg-grass-50/50 border-grass-100 shadow-sm'}`}>
                                  <div className="flex justify-between items-start mb-1">
                                      <h3 className="text-xs font-black text-pitch">{n.title}</h3>
                                      <span className="text-[8px] font-bold text-gray-400">{n.timestamp}</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed">{n.description}</p>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      <main className="flex-grow overflow-y-auto no-scrollbar">
        {activeTab === 'EXPLORE' && user && (
            <TeamDashboard 
                categories={categories} onRefresh={refreshData}
                viewMode="EXPLORE" currentUser={user} fields={fields} slots={slots}
                onBookSlot={async (id, data) => {
                    const slot = slots.find(s => s.id === id);
                    if (!slot) return;
                    
                    const updates: any = { 
                      bookedByUserId: user.id, 
                      bookedByCategory: data.category, 
                      status: 'pending_verification' 
                    };
                    
                    if (slot.hasLocalTeam) {
                      updates.opponentTeamName = data.teamName;
                    } else {
                      updates.isBooked = true; 
                      updates.bookedByTeamName = data.teamName; 
                    }
                    
                    await api.updateSlot(id, updates);
                    setNotifications([
                        { id: Math.random().toString(), title: 'Reserva Enviada!', description: `Aguardando validação da Arena ${fields.find(f => f.id === slot.fieldId)?.name}.`, timestamp: 'Agora', type: 'success', read: false },
                        ...notifications
                    ]);
                    setActiveTab('MY_GAMES');
                    refreshData();
                }}
                onCancelBooking={resetSlot}
                userLocation={userLocation}
            />
        )}

        {activeTab === 'MY_GAMES' && user && (
            <TeamDashboard 
                categories={categories} viewMode="MY_BOOKINGS" onRefresh={refreshData}
                currentUser={user} fields={fields} slots={slots}
                onBookSlot={() => {}} onCancelBooking={resetSlot}
            />
        )}
        
        {activeTab === 'ADMIN' && user && (
            user.role === UserRole.ADMIN ? (
              <AdminDashboard categories={categories} onUpdateCategories={async (c) => { await api.updateCategories(c); refreshData(); }} />
            ) : myField ? (
              <FieldDashboard 
                  categories={categories} field={myField} slots={mySlots} currentUser={user}
                  onAddSlot={async s => { await api.createSlots(s); refreshData(); }} 
                  onRefreshData={refreshData}
                  onDeleteSlot={async id => { 
                      const s = slots.find(x => x.id === id);
                      if (s?.isBooked && confirm("Cancelar esta reserva?")) await resetSlot(id);
                      else if (confirm("Remover horário?")) { await api.deleteSlot(id); refreshData(); }
                  }}
                  onConfirmBooking={async id => { 
                      await api.updateSlot(id, { status: 'confirmed' }); 
                      setNotifications([
                        { id: Math.random().toString(), title: 'Reserva Confirmada!', description: 'Você acabou de validar um pagamento.', timestamp: 'Agora', type: 'success', read: false },
                        ...notifications
                      ]);
                      refreshData(); 
                  }}
                  onRejectBooking={resetSlot}
                  onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                  onRateTeam={() => {}}
              />
            ) : <div className="p-20 text-center font-black text-gray-300 uppercase">Arena Não Configurada</div>
        )}

        {activeTab === 'PROFILE' && user && (
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] p-10 shadow-xl border flex flex-col items-center">
                    <div className="relative">
                        <div className="w-24 h-24 bg-pitch rounded-[2.5rem] flex items-center justify-center text-3xl font-black text-grass-500 shadow-xl border-4 border-white mb-4 overflow-hidden">
                            {user.role === UserRole.FIELD_OWNER && myField?.imageUrl ? (
                                <img src={myField.imageUrl} className="w-full h-full object-cover" />
                            ) : user.teamLogoUrl ? (
                                <img src={user.teamLogoUrl} className="w-full h-full object-cover" />
                            ) : user.name.charAt(0)}
                        </div>
                        {user.subscription !== SubscriptionPlan.NONE && (
                            <div className="absolute -top-1 -right-1 bg-grass-500 text-pitch p-1.5 rounded-xl border-2 border-white shadow-lg">
                                <Shield className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                    <h2 className="text-2xl font-black text-pitch tracking-tight leading-none mb-1">
                        {user.role === UserRole.FIELD_OWNER ? (myField?.name || user.name) : (user.teamName || user.name)}
                    </h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{user.role === UserRole.FIELD_OWNER ? 'Gestor de Arena' : 'Capitão de Equipe'}</p>
                    
                    <div className="grid grid-cols-2 gap-4 w-full mt-10">
                        <div className="bg-gray-50 p-6 rounded-[2rem] border text-center shadow-sm">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</span>
                            <span className="text-xs font-black text-grass-600 uppercase">{user.subscription !== SubscriptionPlan.NONE ? 'Premium' : 'Free'}</span>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-[2rem] border text-center shadow-sm">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reputação</span>
                            <div className="flex items-center justify-center gap-1">
                                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                                <span className="text-xl font-black text-pitch">{(user.teamRating || 5).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full mt-8 space-y-3">
                        <button onClick={() => setShowProfileModal(true)} className="w-full py-5 bg-pitch text-white rounded-[2.5rem] font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]">
                            <Edit2 className="w-4 h-4" /> Editar Perfil & Arena/Time
                        </button>
                        
                        {user.role === UserRole.TEAM_CAPTAIN && user.subTeams && user.subTeams.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-[2.5rem] border">
                                <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Meus Sub-times ({user.subTeams.length})</h4>
                                <div className="space-y-2">
                                    {user.subTeams.map(sub => (
                                        <div key={sub.id} className="flex justify-between items-center px-2">
                                            <span className="text-[10px] font-black text-pitch uppercase">{sub.name}</span>
                                            <span className="text-[8px] font-bold text-grass-600 border border-grass-100 bg-grass-50 px-2 py-0.5 rounded-lg">{sub.category}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {user.role === UserRole.FIELD_OWNER && myField && (
                            <div className="bg-gray-50 p-5 rounded-[2.5rem] border">
                                <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Localização da Arena</h4>
                                <div className="flex items-center gap-2 px-2">
                                    <MapPin className="w-3.5 h-3.5 text-grass-600" />
                                    <span className="text-[10px] font-bold text-pitch truncate">{myField.location}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button onClick={() => { localStorage.removeItem('jf_session_user'); window.location.reload(); }} className="mt-8 text-red-500 font-black text-[10px] uppercase tracking-widest border-b-2 border-red-500/10 pb-1">Encerrar Sessão</button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50 glass pb-safe">
          {[
              { id: 'EXPLORE', icon: Search, label: 'Descobrir' },
              { id: 'MY_GAMES', icon: CalendarDays, label: 'Agenda' },
              { id: 'ADMIN', icon: user?.role === UserRole.FIELD_OWNER ? Trophy : Settings, label: user?.role === UserRole.FIELD_OWNER ? 'Arena' : 'Admin', hide: user?.role === UserRole.TEAM_CAPTAIN },
              { id: 'PROFILE', icon: UserIcon, label: 'Perfil' }
          ].filter(i => !i.hide).map(item => (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)} 
                className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'active-nav-item' : 'text-gray-300 hover:text-pitch'}`}
            >
                <item.icon className={`w-6 h-6`} />
                <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
      </nav>

      {showProfileModal && user && (
        <EditProfileModal 
          categories={categories} 
          user={user} 
          field={myField}
          onUpdate={handleUpdateProfile} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}
    </div>
  );
};

export default App;
