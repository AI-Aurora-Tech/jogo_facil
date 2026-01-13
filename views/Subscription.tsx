
import React from 'react';
import { Check, Star, ShieldCheck, Trophy, Wallet } from 'lucide-react';
import { Button } from '../components/Button';
import { SubscriptionPlan, UserRole } from '../types';

interface SubscriptionProps {
  userRole: UserRole;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onBack: () => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ userRole, onSubscribe, onBack }) => {
  const isFieldOwner = userRole === UserRole.FIELD_OWNER;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-md text-center mb-10">
        <h2 className="text-4xl font-black text-pitch mb-4 tracking-tight">Ative sua conta</h2>
        <p className="text-lg text-gray-500">
          {isFieldOwner 
            ? "Gerencie sua arena e automatize sua agenda com inteligência." 
            : "Agende partidas, encontre adversários e organize seu time."}
        </p>
      </div>

      <div className="bg-pitch rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-md relative text-white">
        <div className="bg-grass-500 text-pitch text-center py-2 text-xs font-black uppercase tracking-widest">
          {isFieldOwner ? "Plano Arena Pro" : "Plano Capitão Pro"}
        </div>
        <div className="p-10">
          <div className="text-center">
            <h3 className="text-2xl font-bold">{isFieldOwner ? "Gestão Completa" : "Partidas Ilimitadas"}</h3>
            <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-400">R$</span>
                <span className="text-6xl font-black">{isFieldOwner ? "99" : "29"}</span>
                <span className="text-lg text-gray-400">/mês</span>
            </div>
          </div>
          
          <ul className="mt-10 space-y-4">
            {(isFieldOwner ? [
              "Grade de horários ilimitada",
              "Verificação de PIX por IA",
              "Gestão de mensalistas",
              "Suporte prioritário"
            ] : [
              "Agendamentos ilimitados",
              "Histórico de partidas",
              "Busca por categoria",
              "Perfil verificado do time"
            ]).map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                <Check className="w-5 h-5 text-grass-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            className="w-full mt-10 py-5 text-lg rounded-[2rem] bg-grass-500 text-pitch font-black"
            onClick={() => onSubscribe(isFieldOwner ? SubscriptionPlan.PRO_FIELD : SubscriptionPlan.PRO_TEAM)}
          >
            Assinar Agora
          </Button>
        </div>
      </div>
      
      <button onClick={onBack} className="mt-10 text-gray-400 font-bold hover:text-pitch">Sair</button>
    </div>
  );
};
