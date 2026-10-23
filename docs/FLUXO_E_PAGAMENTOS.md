# Jogo Fácil — fluxo de partidas, pagamentos, convites e avaliações

Este documento explica como o app funciona depois da reformulação e o passo a passo para colocar no ar.

## 1. Quem paga o quê

| Conta | Cobrança |
|---|---|
| Dono de campo | Grátis |
| Dono de time com 1 categoria | Grátis |
| Dono de time com 2+ categorias | R$ 19,99 × nº de categorias por mês (2 = R$ 39,98; 3 = R$ 59,97) |

- "Categoria" = cada par time + categoria (ex.: Alfa Sub-11 e Alfa Sub-12 = 2).
- O valor muda sozinho quando o time adiciona ou remove categorias (a assinatura no Asaas é atualizada).
- Se voltar para 1 categoria, a assinatura é cancelada.
- Regra configurável em `shared/pricing.ts` (`CHARGE_ALL_CATEGORIES_WHEN_PAYING`): hoje, quem passa de 1 categoria paga todas. Se preferir que a 1ª continue grátis (2 categorias = R$ 19,99), troque para `false`.

## 2. Taxa do jogo (paga pelos times, vai para o dono do campo)

| Situação | Quem paga |
|---|---|
| 2 times de fora | 50% cada (taxa R$ 200 → R$ 100 + R$ 100) |
| Mensalista ou time da casa | 100% o adversário (taxa R$ 300 → adversário paga R$ 300) |
| Amistoso | Ninguém (taxa R$ 0) |

O PIX é gerado pelo Asaas com **split**: o valor cai direto na conta Asaas do dono do campo.
A plataforma pode reter uma porcentagem com a variável `PLATFORM_FEE_PERCENT` (padrão 0).

## 3. Tipos de jogo

- **Partida Normal**: sem premiação.
- **Festival**: com premiação (campo "Premiação do vencedor", ex.: troféu).
- **Amistoso**: taxa R$ 0.

## 4. Fluxo da partida

```mermaid
stateDiagram-v2
    [*] --> available: campo cria horário livre
    [*] --> waiting_opponent: campo cria horário com mensalista / time da casa
    available --> waiting_opponent: 1º time de fora reserva
    waiting_opponent --> pending_home_approval: adversário se inscreve (convite ou busca)
    pending_home_approval --> waiting_opponent: time 1 recusa
    pending_home_approval --> pending_payment: time 1 aprova
    pending_home_approval --> pending_field_approval: time 1 aprova (amistoso)
    pending_payment --> pending_field_approval: todos pagaram (webhook Asaas)
    pending_field_approval --> confirmed: campo aprova
    pending_field_approval --> waiting_opponent: campo recusa + estorno
    confirmed --> finished: 2h após o fim, time 1 lança placar
```

- **Time 1** = mensalista/time da casa do horário, ou o primeiro time de fora que reservou.
- O time 1 aprova o adversário. Se o mensalista não tiver conta no app, quem aprova é o dono do campo.
- Ao criar o horário, o dono do campo responde "Tem mensalista ou time da casa neste horário?" e escolhe time e categoria. O jogo aparece direto na agenda desse time (e ele recebe notificação).
- Um time não pode ter 2 jogos da **mesma categoria** no mesmo horário (em casa ou fora). Categorias diferentes podem.
- Recusa do campo devolve o horário para a agenda e estorna o que foi pago.
- 2h depois do fim do jogo: o time 1 recebe aviso para lançar o placar, e os dois times avaliam o adversário e o campo (o aviso automático usa `pg_cron`, ver passo 5).

## 4.1 Configuração de recebimento do dono do campo

O dono do campo vê o botão **Configurar pagamento** (no topo da Arena e na agenda). Ele abre o seu WhatsApp
(`VITE_SUPPORT_WHATSAPP`) com a mensagem: *"Olá, me chamo {nome}, e criei conta no Jogo Facil agora, pode me
ajudar a configurar a conta para receber meus pagamentos?"*.

Para concluir: ajude a pessoa a abrir a conta Asaas dela, pegue o **Wallet ID**, entre no app como admin geral,
"Acessar Conta" do dono do campo → Arena → **Recebimentos** → cole o Wallet ID → Salvar.

## 5. Convites

Dono do campo, mensalista/time da casa ou o time 1 tocam em **Enviar convite**. O app gera um link
(`https://seu-app/?convite=XXXX`) e abre o compartilhamento do celular/WhatsApp com a mensagem pronta.

Quem abre o link vê o jogo (campo, data, categoria, taxa) e:
- sem conta: cria uma **conta grátis de time já com a categoria do jogo** e entra direto na inscrição;
- com conta: escolhe o time e se inscreve.

O convite expira no horário do jogo.

## 6. Avaliação

- Nota de 1 a 5 estrelas + tags rápidas (ex.: "Pontual", "Fair play", "Faltou jogador"; para o campo "Gramado bom", "Vestiário sujo"...).
- Cada time avalia o adversário e o campo uma vez por jogo (pode editar).
- As médias aparecem na busca (estrela ao lado do campo) e ficam em `field.rating_avg`, `user.team_rating` e na view `team_rating_summary`.

## 7. Por que Asaas (e não Mercado Pago)

- **Split nativo** por `walletId`: a cobrança já nasce dividida e o dinheiro do campo cai direto na conta dele, sem a plataforma precisar repassar.
- **Subcontas por API**: o dono do campo cria a conta de recebimento dentro do app (ou informa o Wallet ID se já tiver Asaas).
- **Assinatura com valor ajustável**: a mensalidade por categoria muda de valor sem cancelar/recriar.
- No Mercado Pago, o split exige que cada dono de campo conecte a própria conta via OAuth (modelo marketplace), o que dá mais trabalho para você e para ele.

## 8. Arquitetura

```
App (React/Vite)  ──>  Supabase (leitura e cadastros simples)
        │
        └──>  /api (funções da Vercel, com service role)  ──>  Asaas
                    ▲
                    └── webhook do Asaas (/api/webhooks/asaas)
```

| Arquivo | O que faz |
|---|---|
| `shared/matchRules.ts` | Regras do fluxo (quem aprova, quanto cada um paga, quando libera placar). Usado pela tela e pelo servidor. |
| `shared/pricing.ts` | Cálculo da mensalidade por categoria. |
| `api/matches.ts` | Todas as etapas da partida: reservar, se inscrever, aprovar, pagar, aprovar pelo campo, cancelar, placar, avaliação. |
| `api/invites.ts` | Cria e abre convites. |
| `api/billing.ts` | Mensalidade (assinatura Asaas). |
| `api/payouts.ts` | Conta de recebimento do dono do campo. |
| `api/webhooks/asaas.ts` | Confirmação de pagamentos (idempotente). |
| `api/auth/login.ts` | Login que devolve a sessão usada nas ações do servidor. |

## 9. Passo a passo para colocar no ar

1. **Banco (Supabase > SQL Editor)**
   1. Habilite a extensão `pg_cron` (Database > Extensions).
   2. Rode `supabase/migrations/20261022_01_fluxo_partidas_pagamentos.sql`.
2. **Asaas**
   1. Crie a conta (use o **sandbox** primeiro: https://sandbox.asaas.com).
   2. Gere a chave de API (Integrações > Chaves de API).
   3. Para criar subcontas dos donos de campo, peça ao Asaas a liberação de "Contas filhas / white label" na sua conta.
   4. Configure o webhook: Integrações > Webhooks > URL `https://SEU-DOMINIO/api/webhooks/asaas`, token = o mesmo de `ASAAS_WEBHOOK_TOKEN`, eventos de **cobrança**.
3. **Vercel (Settings > Environment Variables)** — ver `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API; a service role **nunca** vai para o navegador)
   - `SESSION_SECRET` (texto aleatório longo)
   - `ASAAS_API_KEY`, `ASAAS_ENV` (`sandbox` ou `production`), `ASAAS_WEBHOOK_TOKEN`
   - `PLATFORM_FEE_PERCENT` (opcional), `APP_URL` (ex.: `https://jogofacil.app`)
4. **Deploy** e teste o fluxo completo no sandbox.
5. **Depois que a versão nova estiver no ar**, rode `supabase/migrations/20261022_02_endurecimento_colunas.sql`.
   Ele impede que o navegador altere status, pagamento, placar e assinatura (só o servidor muda).
6. Troque `ASAAS_ENV` para `production` e a chave de API de produção.

### Rodar localmente

- `npm run dev` sobe só a tela (as ações de partida/pagamento mostram "Servidor indisponível").
- Para testar tudo: `npx vercel dev` (lê as variáveis de `.env`).
- `npm test` roda os testes das regras; `npm run lint` checa tipos do app e do servidor.

## 10. Mudanças de comportamento importantes

- Todos precisam **entrar de novo** uma vez (a sessão agora é validada no servidor).
- O teste grátis de 60 dias do capitão foi substituído pela regra de categorias.
- Quem assinava o plano antigo do Mercado Pago continua liberado até mudar as categorias; depois disso passa para a assinatura do Asaas. Cancele as assinaturas antigas no painel do Mercado Pago.
- O envio de comprovante PIX com verificação por IA foi substituído pelo PIX automático. Jogos antigos que estavam "aguardando validação" ainda podem ser aprovados pelo campo.
- Antes, mensalista dividia a taxa 50/50 — agora o adversário paga 100%, como pedido.
