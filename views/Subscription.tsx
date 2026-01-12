
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
  
  // Capitães de Time: Acesso gratuito liberado
  if (userRole === UserRole.TEAM_CAPTAIN) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-md border border-gray-100">
            <div className="w-20 h-20 bg-grass-100 text-grass-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black mb-2 text-pitch">Bem-vindo, Capitão!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
                Seu acesso como capitão é gratuito. Você pode buscar jogos e agendar partidas sem custos de assinatura.
            </p>
            <Button onClick={() => onSubscribe(SubscriptionPlan.FREE)} className="w-full py-4 text-lg rounded-2xl shadow-lg shadow-grass-500/20">
                Começar a Jogar
            </Button>
        </div>
        <button onClick={onBack} className="mt-8 text-gray-400 font-bold hover:text-pitch transition-colors">Voltar para login</button>
      </div>
    );
  }

  // Donos de Campo: Mensalidade obrigatória para gestão
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-md text-center mb-10">
        <h2 className="text-4xl font-black text-pitch mb-4 tracking-tight">Potencialize sua Arena</h2>
        <p className="text-lg text-gray-500">
          Gerencie sua grade, automatize recebimentos e tenha controle total dos seus horários.
        </p>
      </div>

      <div className="bg-pitch rounded-[3rem] shadow-2xl overflow-hidden w-full max-w-md relative text-white">
        <div className="bg-grass-500 text-pitch text-center py-2 text-xs font-black uppercase tracking-widest">
          Plano Anfitrião Pro
        </div>
        <div className="p-10">
          <div className="bg-white/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg border border-white/10">
            <Wallet className="w-10 h-10 text-grass-400" />
          </div>
          
          <div className="text-center">
            <h3 className="text-2xl font-bold">Gestão Profissional</h3>
            <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-400">R$</span>
                <span className="text-6xl font-black">99</span>
                <span className="text-lg text-gray-400">/mês</span>
            </div>
          </div>
          
          <ul className="mt-10 space-y-4">
            {[
              "Grade de horários ilimitada",
              "Gestão de times da casa",
              "Verificação de PIX por IA",
              "Suporte 24h para sua Arena",
              "Visibilidade total na plataforma"
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                <Check className="w-5 h-5 text-grass-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            variant="primary" 
            className="w-full mt-10 py-5 text-lg rounded-[2rem] shadow-2xl shadow-grass-500/50 bg-grass-500 text-pitch font-black"
            onClick={() => onSubscribe(SubscriptionPlan.PRO_FIELD)}
          >
            Assinar Arena Pro
          </Button>
          
          <p className="text-[10px] text-gray-500 text-center mt-6 uppercase tracking-widest font-bold">
            Teste por 7 dias grátis
          </p>
        </div>
      </div>
      
      <div className="text-center mt-10">
         <button onClick={onBack} className="text-gray-400 font-bold hover:text-pitch transition-colors">Voltar para login</button>
      </div>
    </div>
  );
};
