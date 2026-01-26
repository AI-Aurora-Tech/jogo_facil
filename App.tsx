
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, SubTeam } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Search, Trophy, User as UserIcon, RefreshCw, Settings, Building2, MapPin, CalendarDays, TrendingUp, Users2, BarChart3, Bell } from 'lucide-react';

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
  const [notifications, setNotifications] = useState(2);

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

  const handleBellClick = () => {
    if (notifications > 0) {
      alert(`Você tem ${notifications} novas atualizações de partidas!`);
      setNotifications(0);
    } else {
      alert("Nenhuma notificação nova no momento.");
    }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      <header className="bg-white px-6 pt-safe pb-4 flex justify-between items-center sticky top-0 z-50 shadow-sm glass">
          <div className="flex flex-col">
              <span className="text-xl font-black text-pitch tracking-tighter italic">JOGO FÁCIL</span>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={handleBellClick} className="relative p-2 text-gray-400 hover:text-pitch transition-colors">
                  <Bell className="w-6 h-6" />
                  {notifications > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-grass-500 rounded-full border-2 border-white animate-pulse"></span>
                  )}
              </button>
              <button onClick={refreshData} className={`p-2 transition-transform active:rotate-180 ${isLoading ? 'animate-spin' : ''}`}>
                  <RefreshCw className="w-5 h-5 text-grass-500" />
              </button>
          </div>
      </header>

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
                  onConfirmBooking={async id => { await api.updateSlot(id, { status: 'confirmed' }); refreshData(); }}
                  onRejectBooking={resetSlot}
                  onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                  onRateTeam={() => {}}
              />
            ) : <div className="p-20 text-center font-black text-gray-300 uppercase">Arena Não Configurada</div>
        )}

        {activeTab === 'PROFILE' && user && (
            <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] p-10 shadow-xl border flex flex-col items-center">
                    <div className="w-24 h-24 bg-pitch rounded-[2rem] flex items-center justify-center text-3xl font-black text-grass-500 shadow-inner mb-4">
                        {user.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-black text-pitch tracking-tight">{user.name}</h2>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{user.role}</p>
                    
                    <div className="grid grid-cols-2 gap-4 w-full mt-10">
                        <div className="bg-gray-50 p-6 rounded-[2rem] border text-center">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reputação</span>
                            <span className="text-xl font-black text-pitch">{(user.teamRating || 0).toFixed(1)}</span>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-[2rem] border text-center">
                            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Avaliações</span>
                            <span className="text-xl font-black text-pitch">{user.teamRatingCount || 0}</span>
                        </div>
                    </div>

                    <button onClick={() => setShowProfileModal(true)} className="w-full mt-10 py-5 bg-pitch text-white rounded-[2.5rem] font-black shadow-xl active:scale-95 transition-transform uppercase text-xs tracking-[0.2em]">
                        Editar Perfil
                    </button>
                    
                    <button onClick={() => { localStorage.removeItem('jf_session_user'); window.location.reload(); }} className="mt-8 text-red-500 font-black text-[10px] uppercase tracking-widest">Encerrar Sessão</button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50 glass pb-safe">
          {[
              { id: 'EXPLORE', icon: Search, label: 'Descobrir' },
              { id: 'MY_GAMES', icon: CalendarDays, label: 'Meus Jogos' },
              { id: 'ADMIN', icon: user?.role === UserRole.FIELD_OWNER ? Trophy : Settings, label: user?.role === UserRole.FIELD_OWNER ? 'Arena' : 'Admin', hide: user?.role === UserRole.TEAM_CAPTAIN },
              { id: 'PROFILE', icon: UserIcon, label: 'Perfil' }
          ].filter(i => !i.hide).map(item => (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)} 
                className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'active-nav-item' : 'text-gray-300'}`}
            >
                <item.icon className={`w-6 h-6`} />
                <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
      </nav>

      {showProfileModal && user && <EditProfileModal categories={categories} user={user} onUpdate={async u => { const res = await api.updateUser(u); setUser(res); localStorage.setItem('jf_session_user', JSON.stringify(res)); }} onClose={() => setShowProfileModal(false)} />}
    </div>
  );
};

export default App;
