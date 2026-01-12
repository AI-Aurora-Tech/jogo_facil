
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, SubTeam, Notification } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { Button } from './components/Button';
import { LogOut, Settings, Search, Shield, RefreshCw, Calendar, User as UserIcon, Bell, X, Info } from 'lucide-react';
import { api } from './services/api';
import { storageService } from './services/storage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log("GPS Error:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const storedUser = storageService.getCurrentUser();
    if (storedUser) {
      handleAuthSuccess(storedUser);
    }
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [f, s] = await Promise.all([api.getFields(), api.getSlots()]);
      setSlots(s);
      setFields(f);
      
      // Simular notificações baseadas em slots para o dono
      if (user?.role === UserRole.FIELD_OWNER) {
          const myField = f.find(field => field.ownerId === user.id);
          const pending = s.filter(slot => slot.fieldId === myField?.id && slot.status === 'pending_verification');
          if (pending.length > 0) {
              setNotifications([{
                  id: '1',
                  title: 'Reserva Pendente',
                  message: `Você tem ${pending.length} reserva(s) aguardando verificação de pagamento.`,
                  type: 'booking',
                  read: false,
                  createdAt: new Date().toISOString()
              }]);
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = () => setView('AUTH');

  const handleAuthSuccess = (loggedUser: User) => {
    setUser(loggedUser);
    storageService.setCurrentUser(loggedUser);
    
    // Lógica invertida: Apenas Donos de Campo precisam assinar
    if (loggedUser.role === UserRole.FIELD_OWNER) {
        if (loggedUser.subscription === SubscriptionPlan.NONE) {
            setView('SUBSCRIPTION');
            return;
        }
    }
    
    setView('APP');
    setActiveTab(loggedUser.role === UserRole.FIELD_OWNER ? 'ADMIN' : 'EXPLORE');
    refreshData();
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
    setView('LANDING');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const res = await api.updateUser(updatedUser);
      setUser(res);
      storageService.setCurrentUser(res);
    } catch (e) {
      alert("Erro ao atualizar perfil");
    }
  };

  const handleUpdateField = async (fieldId: string, updates: Partial<Field>) => {
    try {
        const updatedField = await api.updateField(fieldId, updates);
        setFields(prev => prev.map(f => f.id === fieldId ? updatedField : f));
        return true;
    } catch (e: any) {
        return false;
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) return;
    const updated = { 
      ...user, 
      subscription: plan,
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
    };
    await handleUpdateUser(updated);
    setView('APP');
    refreshData();
  };

  const addSlot = async (newSlot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => {
    try {
      await api.createSlots([newSlot]);
      await refreshData();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const editSlot = async (slotId: string, updates: Partial<MatchSlot>) => {
    try {
        await api.updateSlot(slotId, updates);
        await refreshData();
    } catch (e: any) {
        alert("Erro ao editar");
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!window.confirm("Remover este horário da grade?")) return;
    try {
      await api.updateSlot(slotId, { status: 'available', isBooked: false, bookedByUserId: 'DELETED' } as any);
      await refreshData();
    } catch (e) {
      alert("Erro ao excluir");
    }
  }

  const confirmBooking = async (slotId: string) => {
    try {
      await api.updateSlot(slotId, { status: 'confirmed' });
      await refreshData();
    } catch(e) { alert("Erro ao confirmar"); }
  };

  const rejectBooking = async (slotId: string) => {
    if (!window.confirm("Cancelar esta reserva?")) return;
    try {
      await api.updateSlot(slotId, { 
        status: 'available', 
        isBooked: false, 
        bookedByTeamName: null, 
        bookedByUserId: null, 
        bookedByPhone: null,
        bookedByCategory: null,
        opponentTeamName: null,
        opponentTeamPhone: null
      } as any);
      refreshData();
    } catch(e) { alert("Erro ao rejeitar"); }
  };

  const handleCancelBooking = async (slotId: string) => {
    if (!window.confirm("Cancelar seu agendamento? O horário será liberado.")) return;
    try {
      await api.updateSlot(slotId, { 
        status: 'available', 
        isBooked: false, 
        bookedByTeamName: null, 
        bookedByUserId: null, 
        bookedByPhone: null,
        bookedByCategory: null,
        opponentTeamName: null,
        opponentTeamPhone: null
      } as any);
      refreshData();
    } catch(e) { alert("Erro ao cancelar"); }
  };

  const bookSlot = async (slotId: string, team: SubTeam) => {
    try {
      await api.updateSlot(slotId, { 
        isBooked: true, 
        status: 'pending_verification',
        bookedByTeamName: team.name,
        bookedByCategory: team.category,
        bookedByUserId: user?.id,
        bookedByPhone: user?.phoneNumber
      });
      refreshData();
    } catch(e) { alert("Erro ao agendar"); }
  };

  if (view === 'LANDING') return <Landing onStart={handleStart} />;
  if (view === 'AUTH') return <Auth onLogin={handleAuthSuccess} onCancel={() => setView('LANDING')} />;
  if (view === 'SUBSCRIPTION' && user) return <Subscription userRole={user.role} onSubscribe={handleSubscribe} onBack={handleLogout} />;

  const myField = user?.role === UserRole.FIELD_OWNER ? fields.find(f => f.ownerId === user.id) : null;
  const mySlots = myField ? slots.filter(s => s.fieldId === myField.id && s.bookedByUserId !== 'DELETED') : [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      <header className="bg-pitch pt-safe text-white px-5 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
            <span className="text-xl font-black italic tracking-tighter text-grass-500">JOGO FÁCIL</span>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={refreshData} className={`${isLoading ? 'animate-spin' : ''} p-1 text-gray-300`}>
              <RefreshCw className="w-5 h-5" />
           </button>
           <button onClick={() => setShowNotifications(true)} className="relative p-1 text-gray-300">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-pitch text-[10px] flex items-center justify-center font-bold text-white">
                  {unreadCount}
                </span>
              )}
           </button>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'EXPLORE' && user && (
            <TeamDashboard 
                viewMode="EXPLORE"
                currentUser={user}
                fields={fields}
                slots={slots}
                onBookSlot={bookSlot}
                onCancelBooking={handleCancelBooking}
                userLocation={userLocation}
            />
        )}
        
        {activeTab === 'MY_GAMES' && user && (
             <TeamDashboard 
                viewMode="MY_BOOKINGS"
                currentUser={user}
                fields={fields}
                slots={slots}
                onBookSlot={bookSlot}
                onCancelBooking={handleCancelBooking}
                userLocation={userLocation}
            />
        )}

        {activeTab === 'ADMIN' && (
          myField ? (
            <FieldDashboard 
              field={myField} 
              slots={mySlots} 
              onAddSlot={addSlot}
              onEditSlot={editSlot}
              onDeleteSlot={deleteSlot}
              onConfirmBooking={confirmBooking}
              onRejectBooking={rejectBooking}
              onUpdateField={handleUpdateField}
            />
          ) : (
             <div className="p-10 text-center text-gray-500">
               {user?.role === UserRole.FIELD_OWNER ? "Carregando..." : "Sem campo vinculado."}
             </div>
          )
        )}

        {activeTab === 'PROFILE' && user && (
            <div className="p-6">
                 <div className="bg-white rounded-3xl p-6 shadow-sm border mb-6 flex flex-col items-center">
                    <div className="w-20 h-20 bg-grass-100 rounded-full flex items-center justify-center text-grass-700 text-3xl font-bold mb-3">
                        {user.name.charAt(0)}
                    </div>
                    <h2 className="text-xl font-bold text-pitch">{user.name}</h2>
                    <p className="text-gray-500 text-sm mb-4">{user.email}</p>
                    <Button variant="outline" size="sm" onClick={() => setShowProfileModal(true)}>Editar Perfil</Button>
                 </div>
                 <div className="space-y-2">
                    <button onClick={handleLogout} className="w-full bg-white border p-4 rounded-2xl flex items-center justify-between text-red-500 font-semibold shadow-sm">
                        Sair da Conta <LogOut className="w-5 h-5" />
                    </button>
                 </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
          <button onClick={() => setActiveTab('EXPLORE')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'EXPLORE' ? 'text-grass-600' : 'text-gray-400'}`}>
            <Search className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Explorar</span>
          </button>
          <button onClick={() => setActiveTab('MY_GAMES')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'MY_GAMES' ? 'text-grass-600' : 'text-gray-400'}`}>
            <Calendar className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Jogos</span>
          </button>
          {(user?.role === UserRole.FIELD_OWNER || user?.role === UserRole.ADMIN) && (
              <button onClick={() => setActiveTab('ADMIN')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'ADMIN' ? 'text-grass-600' : 'text-gray-400'}`}>
                <Shield className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Gestão</span>
              </button>
          )}
          <button onClick={() => setActiveTab('PROFILE')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'PROFILE' ? 'text-grass-600' : 'text-gray-400'}`}>
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
          </button>
      </nav>

      {/* Modal de Notificações */}
      {showNotifications && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}></div>
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 pt-safe flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-pitch text-white">
                <h2 className="text-lg font-bold">Notificações</h2>
                <button onClick={() => setShowNotifications(false)}><X className="w-6 h-6"/></button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
               {notifications.length === 0 ? (
                 <div className="text-center py-20 text-gray-400">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Sem novas notificações.</p>
                 </div>
               ) : (
                 notifications.map(n => (
                   <div key={n.id} className={`p-4 rounded-2xl border ${n.read ? 'bg-gray-50 border-gray-100' : 'bg-grass-50 border-grass-100'} flex gap-3`}>
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                         {n.type === 'booking' ? <Calendar className="w-5 h-5 text-grass-600"/> : <Info className="w-5 h-5 text-blue-500"/>}
                      </div>
                      <div>
                         <p className="font-bold text-pitch text-sm">{n.title}</p>
                         <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                         <p className="text-[10px] text-gray-400 mt-2">{new Date(n.createdAt).toLocaleTimeString()}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}
      
      {showProfileModal && user && (
        <EditProfileModal user={user} onUpdate={handleUpdateUser} onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
};

export default App;
