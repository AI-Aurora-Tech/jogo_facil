import React from 'react';
import { Check, Star } from 'lucide-react';
import { Button } from '../components/Button';
import { SubscriptionPlan, UserRole } from '../types';

interface SubscriptionProps {
  userRole: UserRole;
  onSubscribe: (plan: SubscriptionPlan) => void;
  onBack: () => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ userRole, onSubscribe, onBack }) => {
  
  // Se por algum erro um Capitão cair aqui, redireciona para o plano grátis
  if (userRole === UserRole.TEAM_CAPTAIN) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4">Times têm acesso gratuito!</h2>
        <Button onClick={() => onSubscribe(SubscriptionPlan.FREE)}>Acessar o App</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex flex-col items-center justify-center">
      <div className="max-w-2xl text-center mb-10">
        <h2 className="text-4xl font-bold text-pitch mb-4">Plano Profissional</h2>
        <p className="text-xl text-gray-600">
          Para gerenciar sua arena, receber pagamentos e organizar jogos, cobramos uma taxa única mensal de manutenção.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-grass-500 w-full max-w-md relative">
        <div className="bg-grass-500 text-white text-center py-2 font-bold uppercase tracking-wide">
          Acesso Completo
        </div>
        <div className="p-8 text-center">
          <div className="bg-grass-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Star className="w-8 h-8 text-grass-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900">Mensalidade do Campo</h3>
          <div className="mt-4 flex items-center justify-center">
            <span className="text-5xl font-extrabold text-gray-900">R$ 50</span>
            <span className="ml-2 text-xl text-gray-500">/mês</span>
          </div>
          
          <ul className="mt-8 space-y-4 text-left">
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Painel de gestão ilimitado</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Receba pagamentos via PIX direto na sua conta</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Notificações automáticas no WhatsApp</span>
            </li>
            <li className="flex items-center gap-3 text-gray-600">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>Divulgação para centenas de times</span>
            </li>
          </ul>

          <Button 
            variant="primary" 
            className="w-full mt-8 py-4 text-lg shadow-xl shadow-grass-200"
            onClick={() => onSubscribe(SubscriptionPlan.PRO_FIELD)}
          >
            Assinar e Começar
          </Button>
          
          <p className="text-xs text-gray-400 mt-4">
            Ao assinar, você concorda com os termos de serviço. Cancelamento a qualquer momento.
          </p>
        </div>
      </div>
      
      <div className="text-center mt-8">
         <button onClick={onBack} className="text-gray-500 hover:underline">Voltar para login</button>
      </div>
    </div>
  );
};