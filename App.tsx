
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Field, MatchSlot, User, PendingUpdate } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { RefreshCw, Settings, Building2, Shield, Search, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null);

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
          if (u?.role === UserRole.SUPER_ADMIN) {
            const users = await api.getAllUsers().catch(() => []);
            setAllUsers(users);
          }
          const updates = await api.getPendingUpdatesForTarget(u.id).catch(() => []);
          setPendingUpdates(updates);
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

  const handleUpdateProfile = async (updatedUser: User, updatedField?: Partial<Field>) => {
    setIsLoading(true);
    try {
      const target = impersonatingUser || user;
      if (!target) return;

      if (user?.role === UserRole.SUPER_ADMIN && impersonatingUser) {
        await api.requestUpdate({
          requesterId: user.id,
          targetId: target.id,
          entityType: 'USER',
          jsonData: { user: updatedUser, field: updatedField }
        });
        alert("Sugestão enviada com sucesso!");
      } else {
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
      }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe relative">
      {impersonatingUser && (
        <div className="bg-[#022c22] text-white px-6 py-2 flex justify-between items-center text-[10px] font-black uppercase z-[100] sticky top-0">
           <span className="flex items-center gap-2">
             <Shield className="w-3 h-3 text-yellow-500"/> Gerenciando Perfil: {impersonatingUser.name}
           </span>
           <button onClick={() => setImpersonatingUser(null)} className="bg-yellow-500 text-[#022c22] px-3 py-1 rounded-lg">Sair do Modo Admin</button>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50 border-b">
          <div className="flex flex-col">
              <span className="text-xl font-black text-[#022c22] italic uppercase leading-none">JOGO FÁCIL</span>
              {user && <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Olá, {user.name.split(' ')[0]}</span>}
          </div>
          <button 
            onClick={refreshData} 
            disabled={isLoading}
            className={`p-2 bg-gray-50 rounded-xl transition-all ${isLoading ? 'animate-spin opacity-50' : 'active:scale-95'}`}
          >
            <RefreshCw className="w-5 h-5 text-[#10b981]" />
          </button>
      </header>

      {!impersonatingUser && pendingUpdates.length > 0 && (
        <div className="p-4 bg-yellow-50 border-b space-y-2">
           {pendingUpdates.map(upd => (
             <div key={upd.id} className="bg-white p-4 rounded-2xl border border-yellow-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-yellow-600" />
                  <span className="text-[10px] font-bold text-pitch uppercase">O Admin sugeriu mudanças no seu perfil</span>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => api.resolveUpdate(upd.id, 'rejected').then(refreshData)} className="text-[10px] font-black text-gray-400 uppercase">Ignorar</button>
                   <button 
                    onClick={() => {
                      api.updateUser(upd.jsonData.user)
                        .then(() => api.resolveUpdate(upd.id, 'approved'))
                        .then(refreshData);
                    }} 
                    className="bg-[#022c22] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
                   >
                     Aplicar
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      <main className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'SUPER' && user?.role === UserRole.SUPER_ADMIN && (
          <div className="p-6 space-y-4 animate-in fade-in duration-500">
             <div className="bg-[#022c22] rounded-[2.5rem] p-8 text-white shadow-xl">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Super Admin</h2>
                <p className="text-xs text-grass-500 font-bold uppercase tracking-widest mt-1">Gerenciamento de Contas ({allUsers.length})</p>
             </div>
             <div className="grid gap-3">
               {allUsers.filter(u => u.id !== user.id).map(u => (
                 <div key={u.id} className="bg-white p-4 rounded-[2rem] border flex items-center justify-between hover:border-grass-500 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-pitch text-lg">{u.name.charAt(0)}</div>
                      <div>
                        <h4 className="font-black text-pitch text-sm">{u.name}</h4>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{u.role} • {u.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setImpersonatingUser(u); setActiveTab('ADMIN'); }} 
                      className="bg-[#10b981] text-[#022c22] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-transform shadow-md"
                    >
                      Gerenciar
                    </button>
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
                onCancelBooking={async id => { 
                  await api.updateSlot(id, { status: 'available', isBooked: false, bookedByTeamName: null as any, bookedByUserId: null as any, receiptUrl: null as any }); 
                  refreshData(); 
                }}
            />
        )}

        {activeTab === 'ADMIN' && currentUserContext && (
          currentUserContext.role === UserRole.FIELD_OWNER ? (
            <FieldDashboard 
                categories={categories} 
                field={fields.find(f => f.ownerId === currentUserContext.id) || { id: '', name: 'Carregando...', ownerId: '', location: '', hourlyRate: 0, cancellationFeePercent: 0, pixConfig: { key: '', name: '' }, imageUrl: '', contactPhone: '', latitude: 0, longitude: 0 }} 
                slots={slots.filter(s => s.fieldId === fields.find(f => f.ownerId === currentUserContext.id)?.id)} 
                currentUser={currentUserContext}
                onAddSlot={async s => { await api.createSlots(s); refreshData(); }}
                onRefreshData={refreshData}
                onDeleteSlot={async id => { await api.deleteSlot(id); refreshData(); }}
                onConfirmBooking={async id => { await api.updateSlot(id, { status: 'confirmed', isBooked: true }); refreshData(); }}
                onRejectBooking={async id => { await api.updateSlot(id, { status: 'available', receiptUrl: null as any }); refreshData(); }}
                onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                onRateTeam={() => {}}
            />
          ) : (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="bg-red-50 text-red-500 p-6 rounded-full mb-6"><Shield className="w-12 h-12" /></div>
              <h3 className="font-black text-pitch text-xl italic uppercase tracking-tighter">Acesso Restrito</h3>
              <p className="text-gray-400 text-xs font-bold uppercase mt-2">Esta área é exclusiva para proprietários de arenas.</p>
            </div>
          )
        )}

        {activeTab === 'PROFILE' && currentUserContext && (
            <div className="p-10 flex flex-col items-center animate-in slide-in-from-bottom duration-500">
                <div className="w-32 h-32 bg-[#022c22] rounded-[3rem] flex items-center justify-center text-5xl font-black text-[#10b981] shadow-2xl mb-6 ring-8 ring-white">
                  {currentUserContext.name.charAt(0)}
                </div>
                <h2 className="text-2xl font-black text-pitch italic uppercase tracking-tighter leading-none">{currentUserContext.name}</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{currentUserContext.role} • {currentUserContext.email}</p>
                
                <div className="w-full mt-10 space-y-3">
                  <button 
                    onClick={() => setShowProfileModal(true)} 
                    className="w-full py-5 bg-[#022c22] text-white rounded-3xl font-black flex items-center justify-center gap-3 uppercase text-xs shadow-xl active:scale-95 transition-all"
                  >
                      <Settings className="w-5 h-5 text-[#10b981]" /> Editar Configurações
                  </button>
                  {!impersonatingUser && (
                    <button 
                      onClick={handleLogout} 
                      className="w-full py-5 bg-red-50 text-red-600 rounded-3xl font-black uppercase text-xs active:scale-95 transition-all"
                    >
                      Sair da Conta
                    </button>
                  )}
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t p-4 flex justify-around z-50">
          {user?.role === UserRole.SUPER_ADMIN && (
            <button onClick={() => setActiveTab('SUPER')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'SUPER' ? 'text-[#10b981] scale-110' : 'text-gray-300'}`}>
              <Shield className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase">Super</span>
            </button>
          )}
          <button onClick={() => setActiveTab('EXPLORE')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'EXPLORE' ? 'text-[#10b981] scale-110' : 'text-gray-300'}`}>
            <Search className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Explorar</span>
          </button>
          <button onClick={() => setActiveTab('ADMIN')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'ADMIN' ? 'text-[#10b981] scale-110' : 'text-gray-300'}`}>
            <Building2 className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase">Arena</span>
          </button>
          <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === 'PROFILE' ? 'text-[#10b981] scale-110' : 'text-gray-300'}`}>
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
          isSuperAdminMode={!!impersonatingUser} 
        />
      )}
    </div>
  );
};

export default App;
