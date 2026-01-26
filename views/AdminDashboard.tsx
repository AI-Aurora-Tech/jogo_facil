
import React, { useState } from 'react';
import { Plus, Trash2, Tag, LayoutDashboard, Settings } from 'lucide-react';
import { Button } from '../components/Button';

interface AdminDashboardProps {
  categories: string[];
  onUpdateCategories: (categories: string[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ categories, onUpdateCategories }) => {
  const [newCat, setNewCat] = useState('');

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (trimmed && !categories.includes(trimmed)) {
      onUpdateCategories([...categories, trimmed]);
      setNewCat('');
    }
  };

  const handleRemove = (cat: string) => {
    if (confirm(`Deseja remover a categoria "${cat}" do sistema?`)) {
      onUpdateCategories(categories.filter(c => c !== cat));
    }
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="p-6 bg-white border-b sticky top-0 z-10">
        <h1 className="text-2xl font-black text-pitch flex items-center gap-3">
          <Settings className="w-6 h-6 text-grass-500" /> Administração
        </h1>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Configurações Globais do Sistema</p>
      </div>

      <div className="p-6 space-y-8">
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-grass-100 p-3 rounded-2xl text-grass-600">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-pitch">Categorias de Times</h2>
              <p className="text-gray-400 text-[10px] font-black uppercase">Gerencie as categorias disponíveis no sistema</p>
            </div>
          </div>

          <div className="flex gap-2 mb-8">
            <input 
              type="text" 
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Ex: Sub-12, Master 60+..."
              className="flex-grow p-4 bg-gray-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-grass-500 transition-all"
            />
            <button 
              onClick={handleAdd}
              className="bg-pitch text-white px-6 rounded-2xl active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-grass-200 transition-colors">
                <span className="font-bold text-pitch">{cat}</span>
                <button 
                  onClick={() => handleRemove(cat)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
        
        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
            <div className="bg-blue-600 text-white p-2 rounded-xl h-fit">
                <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-black text-blue-900 text-sm">Atenção Admin</h4>
                <p className="text-xs text-blue-700 font-medium leading-relaxed mt-1">
                    As categorias criadas aqui aparecerão imediatamente no cadastro de novos times, na edição de perfis e nos filtros de busca da arena.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
