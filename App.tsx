
import React, { useState, useEffect } from 'react';
import { UserRole, Field, MatchSlot, User, PendingUpdate } from './types';
import { Landing } from './views/Landing';
import { Auth } from './views/Auth';
import { FieldDashboard } from './views/FieldDashboard';
import { TeamDashboard } from './views/TeamDashboard';
import { EditProfileModal } from './components/EditProfileModal';
import { api } from './services/api';
import { Trophy, RefreshCw, Settings, Building2, Shield, Users, Search, AlertCircle, Check, X, Edit2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'LANDING' | 'AUTH' | 'APP'>('LANDING');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_GAMES' | 'ADMIN' | 'PROFILE' | 'SUPER'>('EXPLORE');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  const [slots, setSlots] = useState<MatchSlot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [impersonatingUser, setImpersonatingUser] = useState<User | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('jf_session_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        setView('APP');
        if (u.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER');
        else if (u.role === UserRole.FIELD_OWNER) setActiveTab('ADMIN');
        refreshData();
      } catch (e) { localStorage.removeItem('jf_session_user'); }
    }
  }, []);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [f, s, cats] = await Promise.all([api.getFields(), api.getSlots(), api.getCategories()]);
      setFields(f);
      setSlots(s);
      setCategories(cats);
      
      const current = localStorage.getItem('jf_session_user');
      if (current) {
        const u = JSON.parse(current);
        if (u.role === UserRole.SUPER_ADMIN) {
           const users = await api.getAllUsers();
           setAllUsers(users);
        }
        const updates = await api.getPendingUpdatesForTarget(u.id);
        setPendingUpdates(updates);
      }
    } catch (e) { console.error("Error refreshing:", e); } finally { setIsLoading(false); }
  };

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
        alert("Sugestão enviada.");
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
      refreshData();
      setShowProfileModal(false);
    } catch (err: any) { alert(`Erro: ${err.message}`); } finally { setIsLoading(false); }
  };

  const currentUserContext = impersonatingUser || user;

  if (view === 'LANDING') return <Landing onStart={() => setView('AUTH')} />;
  if (view === 'AUTH') return <Auth categories={categories} onLogin={(u) => { setUser(u); setView('APP'); refreshData(); localStorage.setItem('jf_session_user', JSON.stringify(u)); if(u.role === UserRole.SUPER_ADMIN) setActiveTab('SUPER'); }} onCancel={() => setView('LANDING')} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-safe">
      {impersonatingUser && (
        <div className="bg-pitch text-white px-6 py-2 flex justify-between items-center text-[10px] font-black uppercase z-[100]">
           <span><Shield className="w-3 h-3 inline mr-1 text-yellow-500"/> Gerenciando: {impersonatingUser.name}</span>
           <button onClick={() => setImpersonatingUser(null)} className="bg-yellow-500 text-pitch px-2 py-1 rounded">Sair</button>
        </div>
      )}

      <header className="bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 border-b glass">
          <div className="flex flex-col">
              <span className="text-xl font-black text-pitch italic uppercase">JOGO FÁCIL</span>
          </div>
          <button onClick={refreshData} className={isLoading ? 'animate-spin' : ''}><RefreshCw className="w-5 h-5 text-grass-500" /></button>
      </header>

      {!impersonatingUser && pendingUpdates.length > 0 && (
        <div className="p-4 bg-yellow-50 border-b">
           {pendingUpdates.map(upd => (
             <div key={upd.id} className="bg-white p-3 rounded-xl border flex items-center justify-between text-[10px] font-bold">
                <span>Admin sugeriu mudanças no seu perfil.</span>
                <div className="flex gap-2">
                   <button onClick={() => api.resolveUpdate(upd.id, 'rejected').then(refreshData)} className="text-red-500">Recusar</button>
                   <button onClick={() => {
                      api.updateUser(upd.jsonData.user).then(() => api.resolveUpdate(upd.id, 'approved')).then(refreshData);
                   }} className="bg-pitch text-white px-3 py-1 rounded">Aplicar</button>
                </div>
             </div>
           ))}
        </div>
      )}

      <main className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'SUPER' && user?.role === UserRole.SUPER_ADMIN && (
          <div className="p-6 space-y-4">
             <div className="bg-pitch rounded-3xl p-6 text-white">
                <h2 className="text-xl font-black uppercase">Super Admin</h2>
             </div>
             {allUsers.filter(u => u.id !== user.id).map(u => (
               <div key={u.id} className="bg-white p-4 rounded-2xl border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold">{u.name.charAt(0)}</div>
                    <div><h4 className="font-bold text-sm">{u.name}</h4><p className="text-[9px] text-gray-400">{u.email}</p></div>
                  </div>
                  <button onClick={() => { setImpersonatingUser(u); setActiveTab('ADMIN'); }} className="bg-grass-500 text-pitch px-4 py-2 rounded-xl text-[10px] font-black uppercase">Gerenciar</button>
               </div>
             ))}
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
          ) : <div className="p-20 text-center text-gray-400 font-bold uppercase">Acesso Restrito</div>
        )}

        {activeTab === 'PROFILE' && currentUserContext && (
            <div className="p-8 flex flex-col items-center">
                <div className="w-24 h-24 bg-pitch rounded-3xl flex items-center justify-center text-3xl font-black text-grass-500 mb-4">{currentUserContext.name.charAt(0)}</div>
                <h2 className="text-xl font-bold">{currentUserContext.name}</h2>
                <button onClick={() => setShowProfileModal(true)} className="w-full mt-6 py-4 bg-pitch text-white rounded-2xl font-bold flex items-center justify-center gap-2 uppercase text-xs">
                    <Edit2 className="w-4 h-4" /> Editar Perfil
                </button>
                <button onClick={() => { localStorage.removeItem('jf_session_user'); window.location.reload(); }} className="mt-8 text-red-500 font-bold text-xs uppercase">Sair</button>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around z-50 glass">
          {user?.role === UserRole.SUPER_ADMIN && (
            <button onClick={() => setActiveTab('SUPER')} className={`flex-1 flex flex-col items-center ${activeTab === 'SUPER' ? 'text-grass-500' : 'text-gray-300'}`}><Shield className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Super</span></button>
          )}
          <button onClick={() => setActiveTab('EXPLORE')} className={`flex-1 flex flex-col items-center ${activeTab === 'EXPLORE' ? 'text-grass-500' : 'text-gray-300'}`}><Search className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Busca</span></button>
          <button onClick={() => setActiveTab('ADMIN')} className={`flex-1 flex flex-col items-center ${activeTab === 'ADMIN' ? 'text-grass-500' : 'text-gray-300'}`}><Building2 className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Arena</span></button>
          <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 flex flex-col items-center ${activeTab === 'PROFILE' ? 'text-grass-500' : 'text-gray-300'}`}><Settings className="w-6 h-6" /><span className="text-[8px] font-black uppercase">Perfil</span></button>
      </nav>

      {showProfileModal && currentUserContext && (
        <EditProfileModal categories={categories} user={currentUserContext} field={fields.find(f => f.ownerId === currentUserContext.id)} onUpdate={handleUpdateProfile} onClose={() => setShowProfileModal(false)} isSuperAdminMode={!!impersonatingUser} />
      )}
    </div>
  );
};

export default App;
