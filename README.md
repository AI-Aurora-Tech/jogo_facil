# ⚽ Jogo Fácil

Sistema profissional de agendamento de partidas de futebol com inteligência artificial.

## 🚀 Funcionalidades

*   **Busca de Partidas:** Encontre adversários ou campos disponíveis.
*   **Gestão de Campos:** Painel para donos de quadras gerenciarem horários.
*   **Fluxo de partidas:** time 1 aprova o adversário → pagamento PIX → campo aprova → placar e avaliação.
*   **Pagamentos (Asaas):** taxa do jogo por PIX, com split automático para o dono do campo. Criar conta e usar o app é grátis.
*   **Convites:** link de convite que cria uma conta já na categoria do jogo.
*   **Avaliações:** times avaliam o adversário e o campo (estrelas + tags).
*   **Recorrência:** Criação automática de agenda para times mensalistas.

## 🛠️ Tecnologias

*   React + TypeScript
*   Tailwind CSS
*   Google Gemini API (Verificação de Pagamentos)
*   Lucide React (Ícones)

## 📦 Como rodar

Hospedado na **Vercel** (tela em Vite + funções em `/api`) com banco no **Supabase**.

Passo a passo de configuração (banco, Asaas, variáveis de ambiente): [`docs/FLUXO_E_PAGAMENTOS.md`](docs/FLUXO_E_PAGAMENTOS.md).

*   `npm run dev` — só a tela
*   `npx vercel dev` — tela + funções `/api`
*   `npm test` — testes das regras de negócio
*   `npm run lint` — checagem de tipos (app e servidor)

## 🔒 Segurança

O sistema possui níveis de acesso:
*   **Admin:** Acesso total.
*   **Dono de Campo:** Gerencia sua grade de horários.
*   **Capitão:** Busca jogos e envia pagamentos.
