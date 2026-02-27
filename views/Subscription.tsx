import React from 'react';
import { ShieldCheck, Calendar, Search, BarChart2, LogOut } from 'lucide-react';

interface SubscriptionProps {
  onBack?: () => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onBack }) => {

  const handleSubscription = () => {
    window.location.href = 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=5efc581a3ff84478bf1a349617285115';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-pitch italic uppercase tracking-tighter">ATIVE SEU JOGO FÁCIL</h1>
        <p className="text-gray-500 mt-2">Agende partidas, encontre adversários e organize seu time.</p>
      </div>

      <div className="w-full max-w-sm bg-pitch rounded-3xl shadow-2xl overflow-hidden transform -rotate-1">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-center p-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">✨ Período de Teste: 60 Dias Grátis</p>
        </div>
        
        <div className="p-8 text-white">
          <h2 className="text-2xl font-black uppercase text-center">Capitão Pro</h2>
          
          <div className="text-center my-6">
            <span className="text-4xl font-light">R$</span>
            <span className="text-8xl font-black tracking-tighter -ml-2">19</span>
            <span className="text-4xl font-light relative -top-4 -ml-1">,90</span>
            <span className="text-2xl font-light text-gray-300">/mês</span>
          </div>

          <div className="text-center mb-8">
            <span className="bg-white/10 text-white text-[10px] font-bold uppercase px-4 py-2 rounded-full">Primeira cobrança após 60 dias</span>
          </div>

          <ul className="space-y-4 mb-10">
            <li className="flex items-center">
              <ShieldCheck className="w-5 h-5 text-grass-400 mr-3" />
              <span>Agendamentos ilimitados</span>
            </li>
            <li className="flex items-center">
              <Search className="w-5 h-5 text-grass-400 mr-3" />
              <span>Filtro de busca por 100km</span>
            </li>
            <li className="flex items-center">
              <ShieldCheck className="w-5 h-5 text-grass-400 mr-3" />
              <span>Selo de Time Verificado</span>
            </li>
            <li className="flex items-center">
              <BarChart2 className="w-5 h-5 text-grass-400 mr-3" />
              <span>Histórico e Estatísticas PRO</span>
            </li>
          </ul>

          <button 
            onClick={handleSubscription}
            className="w-full bg-grass-500 hover:bg-grass-600 text-white font-bold uppercase py-4 rounded-xl transition-all shadow-lg active:scale-95"
          >
            Começar Teste Grátis
          </button>

          <p className="text-center text-gray-400 text-xs mt-4">Sem fidelidade • Cancele quando quiser</p>
        </div>
      </div>

      <button className="text-gray-400 font-bold text-sm mt-8 flex items-center gap-2">
        <LogOut className="w-4 h-4" />
        Sair da conta
      </button>
    </div>
  );
};
