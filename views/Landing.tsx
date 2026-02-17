
import React from 'react';
import { Trophy, Shield, Calendar, CreditCard, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pitch to-grass-900 text-white pb-10">
      {/* Navbar com Padding Safe para iOS */}
      <nav className="p-6 pt-safe mt-4 md:mt-0 flex justify-between items-center container mx-auto relative z-10">
         <div className="font-bold text-2xl flex items-center gap-2">
             <Trophy className="w-6 h-6 text-grass-500" /> Jogo Fácil
         </div>
         <Button variant="outline" className="border-white text-white hover:bg-white hover:text-pitch" onClick={onStart}>
            Entrar / Cadastrar
         </Button>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-10 md:py-16 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          O Futuro do seu <span className="text-grass-400">Futebol</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
          Sistema profissional de agendamento de partidas. Pagamentos seguros via IA, gestão de times e recorrência de jogos.
        </p>
        
        <div className="flex justify-center">
          <Button onClick={onStart} className="px-8 py-4 text-lg bg-grass-500 hover:bg-grass-600 shadow-2xl shadow-grass-500/50">
            Começar Agora <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Features Cards */}
      <div className="container mx-auto px-6 py-4 grid md:grid-cols-3 gap-6">
          <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/20 transition">
            <Shield className="w-10 h-10 text-grass-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Donos de Campo</h3>
            <p className="text-sm text-gray-300">Gerencie horários, crie jogos recorrentes e receba pagamentos com validação automática.</p>
          </div>

          <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/20 transition">
            <Calendar className="w-10 h-10 text-yellow-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Capitães de Time</h3>
            <p className="text-sm text-gray-300">Encontre adversários, pague com segurança e garanta sua partida sem calotes.</p>
          </div>
          
          <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md border border-white/20 hover:bg-white/20 transition">
            <CreditCard className="w-10 h-10 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Assinatura Flexível</h3>
            <p className="text-sm text-gray-300">Planos avulsos, mensais ou anuais. Pague apenas pelo tempo que utilizar a plataforma.</p>
          </div>
      </div>
    </div>
  );
};
