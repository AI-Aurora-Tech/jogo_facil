
import React from 'react';
import { Check, Star, ShieldCheck, Trophy, Wallet, Sparkles } from 'lucide-react';
import { Button } from '../components/Button';
import { SubscriptionPlan, UserRole } from '../types';

interface SubscriptionProps {
  userRole: UserRole;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onBack: () => void;
}

// ⬇️⬇️⬇️ COLE O LINK DO SEU PLANO DO MERCADO PAGO ABAIXO ⬇️⬇️⬇️
// Link atualizado conforme solicitado
const MERCADO_PAGO_SUBSCRIBE_LINK: string = "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=5efc581a3ff84478bf1a349617285115"; 

export const Subscription: React.FC<SubscriptionProps> = ({ userRole, onSubscribe, onBack }) => {
  const isFieldOwner = userRole === UserRole.FIELD_OWNER;

  const handleSubscribeClick = () => {
    // Abre o Mercado Pago na mesma aba para garantir o retorno correto
    window.location.href = MERCADO_PAGO_SUBSCRIBE_LINK;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-md text-center mb-10">
        <h2 className="text-4xl font-black text-pitch mb-4 tracking-tight">Ative sua conta</h2>
        <p className="text-lg text-gray-500">
          {isFieldOwner 
            ? "Para gerenciar sua arena, ative o plano PRO." 
            : "Para agendar jogos, ative o plano PRO."}
        </p>
      </div>

      <div className="bg-pitch rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-md relative text-white border-4 border-pitch">
        {/* Banner Promocional */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-pitch text-center py-3 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> 
          Teste Grátis de 60 Dias
        </div>
        
        <div className="p-10 relative">
          <div className="text-center">
            <h3 className="text-2xl font-bold uppercase">{isFieldOwner ? "Arena Pro" : "Capitão Pro"}</h3>
            <div className="mt-4 flex items-center justify-center gap-1">
                <span className="text-xs text-gray-400 mt-2">R$</span>
                <span className="text-6xl font-black text-[#10b981]">19</span>
                <div className="flex flex-col items-start leading-none">
                   <span className="text-2xl font-black text-[#10b981]">,90</span>
                   <span className="text-[10px] text-gray-400 font-bold uppercase">/mês</span>
                </div>
            </div>
            <p className="text-[10px] text-yellow-400 font-black uppercase mt-2 bg-white/10 inline-block px-3 py-1 rounded-full">
              Cobrança inicia somente após 60 dias
            </p>
          </div>
          
          <ul className="mt-10 space-y-4">
            {(isFieldOwner ? [
              "Grade de horários ilimitada",
              "Verificação de PIX por IA",
              "Gestão de mensalistas e times",
              "Destaque nas buscas de arenas"
            ] : [
              "Agendamentos ilimitados",
              "Histórico completo de partidas",
              "Selo de time verificado",
              "Notificações prioritárias de jogos"
            ]).map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="p-1 bg-[#10b981] rounded-full">
                  <Check className="w-3 h-3 text-pitch flex-shrink-0" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            className="w-full mt-10 py-5 text-lg rounded-[2rem] bg-[#10b981] text-pitch font-black hover:bg-[#059669] hover:text-white transition-all shadow-lg shadow-green-900/50"
            onClick={handleSubscribeClick}
          >
            Iniciar Teste Grátis
          </Button>
          
          <p className="text-[9px] text-gray-500 text-center mt-4">
            Você não será cobrado hoje. Cancele quando quiser pelo painel do Mercado Pago.
          </p>
        </div>
      </div>
      
      <button onClick={onBack} className="mt-10 text-red-400 font-bold hover:text-red-600 uppercase text-[10px] tracking-widest border-b border-red-200 pb-1">
         Sair e cancelar
      </button>
    </div>
  );
};
