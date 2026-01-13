
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, SubTeam, Notification } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Search, Trophy, User as UserIcon, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    if (loggedUser.subscription === SubscriptionPlan.NONE) {
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
      const [f, s] = await Promise.all([api.getFields(), api.getSlots()]);
      setFields(f);
      setSlots(s);
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
        bookedByCategory: undefined
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

  const addSlot = async (slot: any) => {
      try { await api.createSlots([slot]); refreshData(); } catch (e: any) { alert(e.message); }
  };

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  if (view === 'AUTH') return <Auth onLogin={handleAuthSuccess} onCancel={() => setView('LANDING')} />;
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
                viewMode="EXPLORE" currentUser={user} fields={fields} slots={slots}
                onBookSlot={async (id, team) => {
                    await api.updateSlot(id, { isBooked: true, status: 'pending_verification', bookedByTeamName: team.name, bookedByUserId: user.id });
                    refreshData();
                }}
                onCancelBooking={resetSlot}
            />
        )}
        
        {activeTab === 'ADMIN' && myField && user && (
            <FieldDashboard 
                field={myField} slots={mySlots} currentUser={user}
                onAddSlot={addSlot} 
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
            />
        )}

        {activeTab === 'PROFILE' && user && (
            <div className="p-8 space-y-6">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border flex flex-col items-center">
                    <div className="w-24 h-24 bg-grass-100 rounded-full flex items-center justify-center text-grass-700 text-4xl font-black mb-4">
                        {user.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-black text-pitch">{user.name}</h2>
                    <p className="text-gray-400 mb-6">{user.email}</p>
                    <div className="bg-grass-50 px-6 py-2 rounded-full border border-grass-100 text-grass-600 font-bold text-xs uppercase mb-8">
                        Assinatura: {user.subscription.split('_')[1] || 'Free'}
                    </div>
                    <button onClick={() => setShowProfileModal(true)} className="w-full py-4 bg-pitch text-white rounded-2xl font-bold shadow-lg">Editar Meu Time / Perfil</button>
                </div>
            </div>
        )}
      </main>

      {/* Navegação Inferior Melhorada */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around items-center z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] pb-safe">
          <button 
            onClick={() => setActiveTab('EXPLORE')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-2xl ${activeTab === 'EXPLORE' ? 'bg-grass-500 text-pitch scale-110 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
          >
              <Search className={`w-6 h-6 ${activeTab === 'EXPLORE' ? 'text-pitch' : 'text-gray-400'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Explorar</span>
          </button>
          
          {user?.role === UserRole.FIELD_OWNER && (
              <button 
                onClick={() => setActiveTab('ADMIN')} 
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-2xl ${activeTab === 'ADMIN' ? 'bg-grass-500 text-pitch scale-110 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
              >
                  <Trophy className={`w-6 h-6 ${activeTab === 'ADMIN' ? 'text-pitch' : 'text-gray-400'}`} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Minha Arena</span>
              </button>
          )}

          <button 
            onClick={() => setActiveTab('PROFILE')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-all rounded-2xl ${activeTab === 'PROFILE' ? 'bg-grass-500 text-pitch scale-110 shadow-lg shadow-grass-500/20' : 'text-gray-400'}`}
          >
              <UserIcon className={`w-6 h-6 ${activeTab === 'PROFILE' ? 'text-pitch' : 'text-gray-400'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Perfil</span>
          </button>
      </nav>

      {showProfileModal && user && <EditProfileModal user={user} onUpdate={async u => { const res = await api.updateUser(u); setUser(res); }} onClose={() => setShowProfileModal(false)} />}
    </div>
  );
};

export default App;
