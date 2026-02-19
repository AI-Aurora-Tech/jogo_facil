
import React from 'react';
import { Check, Star, ShieldCheck, Trophy, Wallet, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { SubscriptionPlan, UserRole } from '../types';

interface SubscriptionProps {
  userRole: UserRole;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onBack: () => void;
}

// Link oficial enviado pelo usuário
const MERCADO_PAGO_SUBSCRIBE_LINK: string = "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=5efc581a3ff84478bf1a349617285115"; 

export const Subscription: React.FC<SubscriptionProps> = ({ userRole, onSubscribe, onBack }) => {
  const isFieldOwner = userRole === UserRole.FIELD_OWNER;

  const handleSubscribeClick = () => {
    window.location.href = MERCADO_PAGO_SUBSCRIBE_LINK;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-md text-center mb-10">
        <h2 className="text-4xl font-black text-pitch mb-4 tracking-tight uppercase italic">Ative seu Jogo Fácil</h2>
        <p className="text-lg text-gray-500 font-medium">
          {isFieldOwner 
            ? "Gerencie sua arena com ferramentas profissionais." 
            : "Agende partidas, encontre adversários e organize seu time."}
        </p>
      </div>

      <div className="bg-pitch rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-md relative text-white border-4 border-pitch">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-pitch text-center py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> 
          Período de teste: 60 Dias Grátis
        </div>
        
        <div className="p-10 relative">
          <div className="text-center">
            <h3 className="text-2xl font-black uppercase italic">{isFieldOwner ? "Arena Pro" : "Capitão Pro"}</h3>
            <div className="mt-4 flex items-center justify-center gap-1">
                <span className="text-xs text-gray-400 mt-2 font-bold">R$</span>
                <span className="text-6xl font-black text-grass-500 tracking-tighter">19</span>
                <div className="flex flex-col items-start leading-none">
                   <span className="text-2xl font-black text-grass-500">,90</span>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">/mês</span>
                </div>
            </div>
            <p className="text-[9px] text-yellow-400 font-black uppercase mt-4 bg-white/10 inline-block px-4 py-1.5 rounded-full border border-white/10">
              Primeira cobrança após 60 dias
            </p>
          </div>
          
          <ul className="mt-10 space-y-4">
            {(isFieldOwner ? [
              "Grade de horários ilimitada",
              "Verificação de PIX por IA",
              "Gestão de mensalistas e times",
              "Destaque prioritário nas buscas"
            ] : [
              "Agendamentos ilimitados",
              "Filtro de busca por 100km",
              "Selo de Time Verificado",
              "Histórico e Estatísticas PRO"
            ]).map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-300 font-medium">
                <div className="p-1 bg-grass-500 rounded-full flex-shrink-0">
                  <Check className="w-3 h-3 text-pitch" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            className="w-full mt-10 py-6 text-sm rounded-[2rem] bg-grass-500 text-pitch font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-grass-900/20 active:scale-95"
            onClick={handleSubscribeClick}
          >
            Começar Teste Grátis
          </Button>
          
          <p className="text-[9px] text-gray-500 text-center mt-6 font-bold uppercase tracking-widest">
            Sem fidelidade • Cancele quando quiser
          </p>
        </div>
      </div>
      
      <button onClick={onBack} className="mt-10 text-gray-400 font-black hover:text-red-500 uppercase text-[10px] tracking-widest transition-colors">
         Sair da conta
      </button>
    </div>
  );
};
