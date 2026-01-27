
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, SubscriptionPlan, Notification, PendingUpdate } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { Subscription } from './views/Subscription';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { AdminDashboard } from './views/AdminDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Trophy, RefreshCw, Settings, Building2, CalendarDays, Bell, X, CheckCircle2, Shield, Edit2, Users, Search, AlertCircle, Check } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'SUBSCRIPTION' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Impersonation state para Super Admin
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const checkSession = async () => {
        const savedUser = localStorage.getItem('jf_session_user');
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            setView('APP');
            if (parsed.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER');
            else if (parsed.role === UserRole.ADMIN || parsed.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
            refreshData();
          } catch (e) { localStorage.removeItem('jf_session_user'); }
        }
    };
    checkSession();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [f, s, cats] = await Promise.all([api.getFields(), api.getSlots(), api.getCategories()]);
      setFields(f);
      setSlots(s);
      setCategories(cats);
      
      if (user?.role === UserRole.SUPER_ADMIN) {
        const u = await api.getAllUsers();
        setAllUsers(u);
      }

      if (user) {
        const updates = await api.getPendingUpdatesForTarget(user.id);
        setPendingUpdates(updates);
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleUpdateProfile = async (updatedUser: User, updatedField?: Partial<Field>) => {
    setIsLoading(true);
    try {
      const targetUser = impersonatingUser || user;
      if (!targetUser) return;

      if (user?.role === UserRole.SUPER_ADMIN && impersonatingUser) {
        // Enviar como sugestão
        await api.requestUpdate({
          requesterId: user.id,
          targetId: targetUser.id,
          entityType: 'USER',
          jsonData: { user: updatedUser, field: updatedField }
        });
        alert("Sua sugestão de alteração foi enviada para aprovação do proprietário.");
      } else {
        // Atualização direta
        const resUser = await api.updateUser(updatedUser);
        if (!impersonatingUser) setUser(resUser);
        if (updatedField && targetUser.role === UserRole.FIELD_OWNER) {
          const currentArena = fields.find(f => f.ownerId === targetUser.id);
          if (currentArena) await api.updateField(currentArena.id, updatedField);
        }
      }
      await refreshData();
      setShowProfileModal(false);
    } catch (err: any) { alert(`Erro ao salvar: ${err.message}`); } finally { setIsLoading(false); }
  };

  const handleApproveUpdate = async (upd: PendingUpdate) => {
    setIsLoading(true);
    try {
      const { user: uData, field: fData } = upd.jsonData;
      await api.updateUser(uData);
      if (fData && fields.find(f => f.ownerId === user?.id)) {
        const fieldId = fields.find(f => f.ownerId === user?.id)!.id;
        await api.updateField(fieldId, fData);
      }
      await api.resolveUpdate(upd.id, 'approved');
      alert("Alterações aplicadas com sucesso!");
      await refreshData();
    } catch (e) { alert("Erro ao aplicar."); } finally { setIsLoading(false); }
  };

  const currentUserContext = impersonatingUser || user;

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  if (view === 'AUTH') return <Auth categories={categories} onLogin={(u) => { setUser(u); setView('APP'); refreshData(); localStorage.setItem('jf_session_user', JSON.stringify(u)); }} onCancel={() => setView('LANDING')} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      {/* Super Admin Status Bar */}
      {impersonatingUser && (
        <div className="bg-pitch text-white px-6 py-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest z-[100]">
           <span className="flex items-center gap-2"><Shield className="w-3 h-3 text-yellow-500"/> Gerenciando: {impersonatingUser.name}</span>
           <button onClick={() => setImpersonatingUser(null)} className="bg-yellow-500 text-pitch px-3 py-1 rounded-lg">Sair do Modo Gestão</button>
        </div>
      )}

      <header className="bg-white px-6 pt-safe pb-4 flex justify-between items-center sticky top-0 z-50 shadow-sm glass">
          <div className="flex flex-col">
              <span className="text-xl font-black text-pitch tracking-tighter italic uppercase leading-none">JOGO FÁCIL</span>
              <p className="text-[8px] font-black text-grass-600 uppercase tracking-widest">Football Pro</p>
          </div>
          <button onClick={refreshData} className={`p-2 transition-transform active:rotate-180 ${isLoading ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-5 h-5 text-grass-500" />
          </button>
      </header>

      {/* Alerta de Aprovações Pendentes (Para o Usuário comum) */}
      {!impersonatingUser && pendingUpdates.length > 0 && (
        <div className="p-6 bg-yellow-50 border-b border-yellow-100 animate-in slide-in-from-top duration-500">
           <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <h3 className="text-xs font-black text-yellow-900 uppercase">Sugestões do Administrador</h3>
           </div>
           {pendingUpdates.map(upd => (
             <div key={upd.id} className="bg-white p-4 rounded-2xl border border-yellow-200 shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-bold text-gray-500">O Admin Pedro sugeriu atualizar seu perfil e dados da arena.</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => api.resolveUpdate(upd.id, 'rejected').then(refreshData)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X className="w-4 h-4"/></button>
                   <button onClick={() => handleApproveUpdate(upd)} className="bg-pitch text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                      <Check className="w-3 h-3"/> Aplicar
                   </button>
                </div>
             </div>
           ))}
        </div>
      )}

      <main className="flex-grow overflow-y-auto no-scrollbar pb-24">
        {activeTab === 'SUPER' && user?.role === UserRole.SUPER_ADMIN && (
          <div className="p-6 space-y-6">
             <div className="bg-pitch rounded-[2.5rem] p-8 text-white">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 mb-2"><Trophy className="w-7 h-7 text-yellow-500"/> Painel Super Admin</h2>
                <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">Gerencie todas as contas e arenas do sistema</p>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Users className="w-4 h-4 text-grass-600" />
                    <h3 className="text-[11px] font-black text-pitch uppercase tracking-widest">Base de Usuários ({allUsers.length})</h3>
                </div>
                {allUsers.filter(u => u.id !== user.id).map(u => (
                  <div key={u.id} className="bg-white p-6 rounded-[2rem] border shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center font-black text-pitch">
                             {u.name.charAt(0)}
                          </div>
                          <div>
                             <h4 className="font-black text-pitch">{u.name}</h4>
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{u.role}</p>
                             <p className="text-[8px] text-gray-400">{u.email}</p>
                          </div>
                      </div>
                      <button onClick={() => { setImpersonatingUser(u); setActiveTab('ADMIN'); }} className="bg-grass-500 text-pitch px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Gerenciar</button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {(activeTab === 'EXPLORE' || activeTab === 'MY_GAMES') && currentUserContext && (
            <TeamDashboard 
                categories={categories} onRefresh={refreshData}
                viewMode={activeTab === 'EXPLORE' ? 'EXPLORE' : 'MY_BOOKINGS'} 
                currentUser={currentUserContext} 
                fields={fields} 
                slots={slots}
                onBookSlot={async (id, data) => {
                   await api.updateSlot(id, { bookedByUserId: currentUserContext.id, bookedByTeamName: data.teamName, status: 'pending_verification' });
                   refreshData();
                }}
                onCancelBooking={async id => { await api.updateSlot(id, { status: 'available', isBooked: false, bookedByTeamName: null as any }); refreshData(); }}
            />
        )}

        {activeTab === 'ADMIN' && currentUserContext && (
          currentUserContext.role === UserRole.FIELD_OWNER ? (
            <FieldDashboard 
                categories={categories} field={fields.find(f => f.ownerId === currentUserContext.id)!} 
                slots={slots.filter(s => s.fieldId === fields.find(f => f.ownerId === currentUserContext.id)?.id)} 
                currentUser={currentUserContext}
                onAddSlot={async s => { await api.createSlots(s); refreshData(); }}
                onRefreshData={refreshData}
                onDeleteSlot={async id => { await api.deleteSlot(id); refreshData(); }}
                onConfirmBooking={async id => { await api.updateSlot(id, { status: 'confirmed' }); refreshData(); }}
                onRejectBooking={async id => { await api.updateSlot(id, { status: 'available' }); refreshData(); }}
                onUpdateField={async (id, u) => { await api.updateField(id, u); refreshData(); return true; }}
                onRateTeam={() => {}}
            />
          ) : <div className="p-20 text-center font-black text-gray-300 uppercase">Acesso Restrito a Donos de Arena</div>
        )}

        {activeTab === 'PROFILE' && currentUserContext && (
            <div className="p-8">
                <div className="bg-white rounded-[3rem] p-10 shadow-xl border flex flex-col items-center">
                    <div className="w-24 h-24 bg-pitch rounded-[2.5rem] flex items-center justify-center text-3xl font-black text-grass-500 shadow-xl border-4 border-white mb-6">
                        {currentUserContext.name.charAt(0)}
                    </div>
                    <h2 className="text-2xl font-black text-pitch tracking-tight mb-1">{currentUserContext.name}</h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{currentUserContext.role}</p>
                    
                    <button onClick={() => setShowProfileModal(true)} className="w-full mt-10 py-5 bg-pitch text-white rounded-[2.5rem] font-black shadow-xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest">
                        <Edit2 className="w-4 h-4" /> Editar Perfil
                    </button>
                    
                    {!impersonatingUser && (
                      <button onClick={() => { localStorage.removeItem('jf_session_user'); window.location.reload(); }} className="mt-10 text-red-500 font-black text-[10px] uppercase">Encerrar Sessão</button>
                    )}
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around items-center z-50 glass pb-safe">
          {user?.role === UserRole.SUPER_ADMIN && (
            <button onClick={() => setActiveTab('SUPER')} className={`flex-1 py-2 flex flex-col items-center gap-1 ${activeTab === 'SUPER' ? 'text-grass-500' : 'text-gray-300'}`}>
                <Shield className="w-6 h-6" />
                <span className="text-[8px] font-black uppercase">Super</span>
            </button>
          )}
          <button onClick={() => setActiveTab('EXPLORE')} className={`flex-1 py-2 flex flex-col items-center gap-1 ${activeTab === 'EXPLORE' ? 'text-grass-500' : 'text-gray-300'}`}>
              <Search className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase">Descobrir</span>
          </button>
          <button onClick={() => setActiveTab('ADMIN')} className={`flex-1 py-2 flex flex-col items-center gap-1 ${activeTab === 'ADMIN' ? 'text-grass-500' : 'text-gray-300'}`}>
              <Building2 className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase">Arena</span>
          </button>
          <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 py-2 flex flex-col items-center gap-1 ${activeTab === 'PROFILE' ? 'text-grass-500' : 'text-gray-300'}`}>
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
