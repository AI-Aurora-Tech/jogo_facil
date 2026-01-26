
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, SubTeam, Notification } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Search, Trophy, User as UserIcon, RefreshCw, Settings, Building2, MapPin, CalendarDays } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const cats = await api.getCategories();
    setCategories(cats);
  };

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    if (loggedUser.subscription === SubscriptionPlan.NONE && loggedUser.role !== UserRole.ADMIN) {
        setView('SUBSCRIPTION');
    } else {
        setView('APP');
        if (loggedUser.role === UserRole.ADMIN) setActiveTab('ADMIN');
        else if (loggedUser.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
        else setActiveTab('EXPLORE');
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

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) return;
    const updated = { 
      ...user, 
      subscription: plan,
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
    };
    const res = await api.updateUser(updated);
    setUser(res);
    setView('APP');
    refreshData();
  };

  const resetSlot = async (id: string) => {
    await api.updateSlot(id, {
        isBooked: false,
        status: 'available',
        bookedByTeamName: undefined,
        bookedByUserId: undefined,
        bookedByPhone: undefined,
        bookedByCategory: undefined,
        ratingGiven: 0
    });
    refreshData();
  };

  const handleUpdateField = async (id: string, updates: any) => {
      try {
          const res = await api.updateField(id, updates);
          setFields(prev => prev.map(f => f.id === id ? res : f));
          return true;
      } catch { return false; }
  };

  const addSlots = async (newSlots: any[]) => {
      try { await api.createSlots(newSlots); refreshData(); } catch (e: any) { alert(e.message); }
  };

  const handleRateTeam = async (userId: string, slotId: string, rating: number) => {
      try {
          await api.rateTeam(userId, slotId, rating);
          refreshData();
      } catch (e) {
          alert('Erro ao enviar avaliação.');
      }
  };

  const handleUpdateGlobalCategories = async (newCats: string[]) => {
      const updated = await api.updateCategories(newCats);
      setCategories(updated);
  };

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  if (view === 'AUTH') return <Auth categories={categories} onLogin={handleAuthSuccess} onCancel={() => setView('LANDING')} />;
  if (view === 'SUBSCRIPTION' && user) return <Subscription userRole={user.role} onSubscribe={handleSubscribe} onBack={() => setView('LANDING')} />;

  const myField = user?.role === UserRole.FIELD_OWNER ? fields.find(f => f.ownerId === user.id) : null;
  const mySlots = myField ? slots.filter(s => s.fieldId === myField.id) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      <header className="bg-pitch pt-safe text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
          <span className="text-xl font-black italic text-grass-500 tracking-tighter">JOGO FÁCIL</span>
          <div className="flex gap-4">
              <button onClick={refreshData} className={`${isLoading ? 'animate-spin' : ''}`}>
                  <RefreshCw className="w-5 h-5 text-grass-500" />
              </button>
          </div>
      </header>

      <main className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'EXPLORE' && user && (
            <TeamDashboard 
                categories={categories}
                viewMode="EXPLORE" currentUser={user} fields={fields} slots={slots}
                onBookSlot={async (id, bookingData) => {
                    await api.updateSlot(id, { 
                        isBooked: true, 
                        status: 'pending_verification', 
                        bookedByTeamName: bookingData.teamName, 
                        bookedByCategory: bookingData.category,
                        bookedByUserId: user.id 
                    });
                    refreshData();
                }}
                onCancelBooking={resetSlot}
            />
        )}
        
        {activeTab === 'ADMIN' && user && (
            user.role === UserRole.ADMIN ? (
              <AdminDashboard categories={categories} onUpdateCategories={handleUpdateGlobalCategories} />
            ) : myField ? (
              <FieldDashboard 
                  categories={categories}
                  field={myField} slots={mySlots} currentUser={user}
                  onAddSlot={addSlots} 
                  onDeleteSlot={async id => { 
                      const slot = slots.find(s => s.id === id);
                      if (slot?.isBooked) {
                          if (confirm("Deseja CANCELAR A RESERVA deste horário?")) {
                              await resetSlot(id);
                          }
                      } else {
                          if (confirm("Deseja EXCLUIR este horário da agenda?")) {
                              await api.deleteSlot(id);
                              refreshData();
                          }
                      }
                  }}
                  onConfirmBooking={async id => { await api.updateSlot(id, { status: 'confirmed' }); refreshData(); }}
                  onRejectBooking={resetSlot}
                  onUpdateField={handleUpdateField}
                  onRateTeam={handleRateTeam}
              />
            ) : <div className="p-10 text-center text-gray-400 font-bold uppercase">Acesso Não Autorizado</div>
        )}

        {activeTab === 'PROFILE' && user && (
            <div className="p-8 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border flex flex-col items-center">
                    <div className="w-24 h-24 bg-grass-100 rounded-full flex items-center justify-center text-grass-700 text-4xl font-black mb-4">
                        {user.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-black text-pitch">{user.name}</h2>
                    <p className="text-gray-400 mb-6 font-medium">{user.email}</p>
                    <div className="bg-pitch/5 px-4 py-1.5 rounded-full mb-8">
                        <span className="text-[10px] font-black text-pitch uppercase tracking-widest">
                          {user.role === UserRole.FIELD_OWNER ? 'Proprietário de Arena' : user.role}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 w-full mb-8">
                        <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center flex flex-col items-center justify-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Plano</p>
                            <p className="text-xs font-black text-grass-600 uppercase">{user.subscription.split('_')[1] || 'Ativo'}</p>
                        </div>
                        {user.role === UserRole.FIELD_OWNER ? (
                          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center flex flex-col items-center justify-center">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Grade Agenda</p>
                              <div className="flex items-center gap-1">
                                  <span className="text-xs font-black text-pitch">{mySlots.length} Horários</span>
                              </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 text-center flex flex-col items-center justify-center">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reputação Time</p>
                              <div className="flex items-center gap-1">
                                  <span className="text-xs font-black text-pitch">{(user.teamRating || 0).toFixed(1)}</span>
                                  <Trophy className="w-3 h-3 text-yellow-500" />
                              </div>
                          </div>
                        )}
                    </div>

                    {user.role === UserRole.FIELD_OWNER && myField && (
                      <div className="w-full bg-gray-50 rounded-[2rem] p-6 border mb-8 animate-in zoom-in-95 duration-200">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4" /> Minha Arena Registrada
                          </h4>
                          <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pitch rounded-xl flex items-center justify-center">
                                  <Trophy className="w-5 h-5 text-grass-500" />
                                </div>
                                <span className="font-black text-pitch">{myField.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-gray-400">
                                <MapPin className="w-4 h-4" />
                                <span className="text-xs font-bold truncate">{myField.location}</span>
                              </div>
                          </div>
                      </div>
                    )}

                    <button onClick={() => setShowProfileModal(true)} className="w-full py-5 bg-pitch text-white rounded-[2rem] font-black shadow-xl active:scale-95 transition-transform uppercase text-xs tracking-widest">
                      Editar Meus Dados
                    </button>
                    
                    <button onClick={() => window.location.reload()} className="mt-8 text-gray-400 font-bold text-xs hover:text-red-500 uppercase tracking-widest">Sair da Conta</button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-2.5 flex justify-around items-center z-50 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] pb-safe">
          <button 
            onClick={() => setActiveTab('EXPLORE')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-[1.5rem] ${activeTab === 'EXPLORE' ? 'bg-grass-500 text-pitch scale-105 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
          >
              <Search className={`w-5 h-5 ${activeTab === 'EXPLORE' ? 'text-pitch' : 'text-gray-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-tight">Buscar</span>
          </button>
          
          {(user?.role === UserRole.FIELD_OWNER || user?.role === UserRole.ADMIN) && (
              <button 
                onClick={() => setActiveTab('ADMIN')} 
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-[1.5rem] ${activeTab === 'ADMIN' ? 'bg-grass-500 text-pitch scale-105 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
              >
                  {user.role === UserRole.ADMIN ? <Settings className={`w-5 h-5 ${activeTab === 'ADMIN' ? 'text-pitch' : 'text-gray-300'}`} /> : <Trophy className={`w-5 h-5 ${activeTab === 'ADMIN' ? 'text-pitch' : 'text-gray-300'}`} />}
                  <span className="text-[9px] font-black uppercase tracking-tight">{user.role === UserRole.ADMIN ? 'Sistema' : 'Arena'}</span>
              </button>
          )}

          <button 
            onClick={() => setActiveTab('PROFILE')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-[1.5rem] ${activeTab === 'PROFILE' ? 'bg-grass-500 text-pitch scale-105 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
          >
              <UserIcon className={`w-5 h-5 ${activeTab === 'PROFILE' ? 'text-pitch' : 'text-gray-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-tight">Perfil</span>
          </button>
      </nav>

      {showProfileModal && user && <EditProfileModal categories={categories} user={user} onUpdate={async u => { const res = await api.updateUser(u); setUser(res); }} onClose={() => setShowProfileModal(false)} />}
    </div>
  );
};

export default App;
