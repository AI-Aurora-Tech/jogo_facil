
import React from 'react';
import { Check, Star, ShieldCheck, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { SubscriptionPlan, UserRole } from '../types';

interface SubscriptionProps {
  userRole: UserRole;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onBack: () => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ userRole, onSubscribe, onBack }) => {
  
  // Se for dono de campo, mostrar mensagem que o uso é gratuito
  if (userRole === UserRole.FIELD_OWNER) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border-t-4 border-grass-500">
            <div className="w-16 h-16 bg-grass-100 text-grass-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-pitch">Acesso Liberado!</h2>
            <p className="text-gray-600 mb-6">
                Donos de campo utilizam a plataforma gratuitamente para gerenciar suas agendas.
            </p>
            <Button onClick={() => onSubscribe(SubscriptionPlan.FREE)} className="w-full">
                Acessar Painel
            </Button>
        </div>
      </div>
    );
  }

  // Se for Time/Capitão, mostrar cobrança de R$ 50,00
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center justify-center">
      <div className="max-w-2xl text-center mb-10">
        <h2 className="text-4xl font-bold text-pitch mb-4">Assinatura do Time</h2>
        <p className="text-xl text-gray-600">
          Para agendar partidas, encontrar adversários e gerenciar seu time, é necessária uma assinatura mensal.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-grass-500 w-full max-w-md relative">
        <div className="bg-grass-500 text-white text-center py-2 font-bold uppercase tracking-wide">
          Capitão Profissional
        </div>
        <div className="p-8 text-center">
          <div className="bg-grass-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-8 h-8 text-grass-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900">Mensalidade do Time</h3>
          <div className="mt-4 flex items-center justify-center">
            <span className="text-5xl font-extrabold text-gray-900">R$ 50</span>
            <span className="ml-2 text-xl text-gray-500">/mês</span>
          </div>
          
          <ul className="mt-8 space-y-4 text-left">
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Acesso a todas as arenas cadastradas</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Agendamento rápido e seguro</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Histórico de jogos e estatísticas</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Suporte prioritário via WhatsApp</span>
            </li>
          </ul>

          <Button 
            variant="primary" 
            className="w-full mt-8 py-4 text-lg shadow-xl shadow-grass-200"
            onClick={() => onSubscribe(SubscriptionPlan.PRO_TEAM)}
          >
            Assinar Agora
          </Button>
          
          <p className="text-xs text-gray-400 mt-4">
            Pagamento seguro. Cancele quando quiser.
          </p>
        </div>
      </div>
      
      <div className="text-center mt-8">
         <button onClick={onBack} className="text-gray-500 hover:underline">Voltar para login</button>
      </div>
    </div>
  );
};
