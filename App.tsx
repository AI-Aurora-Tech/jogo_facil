
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, SubTeam } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { LogOut, Settings, Search as SearchIcon, Shield, RefreshCw } from 'lucide-react';
import { api } from './services/api';
import { storageService } from './services/storage';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [currentTab, setCurrentTab] = useState<'MY_FIELD' | 'SEARCH'>('SEARCH');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Init Data
  useEffect(() => {
    const storedUser = storageService.getCurrentUser();
    if (storedUser) {
      handleAuthSuccess(storedUser);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Location access denied", err),
        { enableHighAccuracy: false }
      );
    }
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [f, s] = await Promise.all([api.getFields(), api.getSlots()]);
      setFields(f);
      setSlots(s);
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
    
    // Logic: 
    // If Admin -> App
    // If Team Captain -> Must have PRO_TEAM subscription to access
    // If Field Owner -> Free access (PRO_FIELD or FREE)
    
    if (loggedUser.role === UserRole.TEAM_CAPTAIN) {
        if (loggedUser.subscription === SubscriptionPlan.NONE || loggedUser.subscription === SubscriptionPlan.FREE) {
            setView('SUBSCRIPTION');
            return;
        }
    }
    
    // Field owners or Paid Team Captains go here
    setView('APP');
    setCurrentTab(loggedUser.role === UserRole.FIELD_OWNER ? 'MY_FIELD' : 'SEARCH');
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
        alert("Erro ao atualizar campo: " + e.message);
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

  // --- Actions ---

  const addSlot = async (newSlot: Omit<MatchSlot, 'id'>, isRecurring: boolean) => {
    const slotsToCreate: any[] = [];
    
    // Slot 1
    slotsToCreate.push(newSlot);

    if (isRecurring) {
      for (let i = 1; i <= 3; i++) {
        const dateObj = new Date(newSlot.date);
        dateObj.setDate(dateObj.getDate() + (i * 7)); 
        const nextDate = dateObj.toISOString().split('T')[0];
        
        slotsToCreate.push({
          ...newSlot,
          date: nextDate
        });
      }
    }
    
    try {
      await api.createSlots(slotsToCreate);
      // Force refresh to guarantee UI sync
      await refreshData();
    } catch (e: any) {
      console.error("Erro ao criar slot:", e);
      alert(`Erro ao criar horário: ${e.message || "Verifique se a tabela MatchSlot possui as colunas 'customImageUrl' e 'matchType'."}`);
    }
  };

  const editSlot = async (slotId: string, updates: Partial<MatchSlot>) => {
    try {
        await api.updateSlot(slotId, updates);
        await refreshData();
    } catch (e: any) {
        alert("Erro ao editar horário: " + e.message);
    }
  };

  const confirmBooking = async (slotId: string) => {
    try {
      await api.updateSlot(slotId, { status: 'confirmed' });
      // Update local state directly for speed, refresh background
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, status: 'confirmed' } : s));
    } catch(e) { alert("Erro ao confirmar"); }
  };

  const rejectBooking = async (slotId: string) => {
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
  const mySlots = myField ? slots.filter(s => s.fieldId === myField.id) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-pitch text-white px-4 md:px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-40">
        <div className="font-bold text-xl flex items-center gap-2">
          ⚽ Jogo Fácil 
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex bg-white/10 rounded-lg p-1 gap-1">
              {(user?.role === UserRole.FIELD_OWNER || user?.role === UserRole.ADMIN) && (
                <button 
                  onClick={() => setCurrentTab('MY_FIELD')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${currentTab === 'MY_FIELD' ? 'bg-grass-600 text-white shadow' : 'hover:bg-white/10 text-gray-300'}`}
                >
                  Meu Campo
                </button>
              )}
              <button 
                onClick={() => setCurrentTab('SEARCH')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${currentTab === 'SEARCH' ? 'bg-grass-600 text-white shadow' : 'hover:bg-white/10 text-gray-300'}`}
              >
                Buscar Jogos
              </button>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={refreshData} disabled={isLoading} className={`p-2 hover:bg-white/10 rounded-full transition text-gray-300 hover:text-white ${isLoading ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={() => setShowProfileModal(true)} className="p-2 hover:bg-white/10 rounded-full transition text-gray-300 hover:text-white">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="text-red-300 hover:text-red-100 transition text-sm font-semibold">
                <LogOut className="w-5 h-5" />
              </button>
           </div>
        </div>
      </nav>
      
      <div className="md:hidden bg-pitch border-t border-white/10 flex justify-around p-2 sticky top-[60px] z-30 shadow-md">
         {(user?.role === UserRole.FIELD_OWNER || user?.role === UserRole.ADMIN) && (
            <button onClick={() => setCurrentTab('MY_FIELD')} className={`flex flex-col items-center gap-1 text-xs px-4 py-2 rounded ${currentTab === 'MY_FIELD' ? 'text-grass-400' : 'text-gray-400'}`}>
              <Shield className="w-5 h-5" /> Gerir Campo
            </button>
         )}
         <button onClick={() => setCurrentTab('SEARCH')} className={`flex flex-col items-center gap-1 text-xs px-4 py-2 rounded ${currentTab === 'SEARCH' ? 'text-grass-400' : 'text-gray-400'}`}>
            <SearchIcon className="w-5 h-5" /> Jogos
          </button>
      </div>

      <main className="flex-grow pb-20 md:pb-0">
        {currentTab === 'MY_FIELD' && (
          myField ? (
            <FieldDashboard 
              field={myField} 
              slots={mySlots} 
              onAddSlot={addSlot}
              onEditSlot={editSlot}
              onConfirmBooking={confirmBooking}
              onRejectBooking={rejectBooking}
              onUpdateField={handleUpdateField}
            />
          ) : (
             <div className="p-10 text-center text-gray-500">
               {user?.role === UserRole.FIELD_OWNER ? "Carregando seu campo..." : "Você não possui um campo."}
             </div>
          )
        )}
        {currentTab === 'SEARCH' && user && (
          <TeamDashboard 
            currentUser={user}
            fields={fields}
            slots={slots}
            onBookSlot={bookSlot}
            userLocation={userLocation}
          />
        )}
      </main>
      
      {showProfileModal && user && (
        <EditProfileModal user={user} onUpdate={handleUpdateUser} onClose={() => setShowProfileModal(false)} />
      )}
    </div>
  );
};

export default App;
