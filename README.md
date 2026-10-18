# 💈 Connect Barber

Sistema de gestão on-line para barbearias (SaaS multi-tenant), no modelo do AppBarber: agenda com agendamento online, comandas, caixa, estoque, comissões, fidelidade, comunicação automática e site da barbearia.

## O que o sistema faz

**Barbearia (painel web)**
- Agenda por profissional com jornada por dia da semana, folgas/jornadas específicas, bloqueios, encaixes e agendamentos recorrentes; cores por status; lista de espera avisada automaticamente quando vaga um horário.
- Comandas geradas pelo agendamento (ou avulsas): serviços, produtos, pacotes, itens avulsos, descontos, várias formas de pagamento com taxas por parcela, pontos de fidelidade como pagamento, fiado (conta a receber), reabertura com estorno completo.
- Caixa: abertura, vendas, entradas/saídas, sangria, suprimento, fechamento com conferência; histórico.
- Financeiro: contas a pagar/receber com parcelas, categorias, fluxo de caixa, taxas de cartão.
- Produtos e estoque: saldo, custo, lucro, mínimo, validade, movimentações, inventário; baixa automática na venda.
- Comissões por serviço/produto (por profissional ou por item), vales/adiantamentos, comandas de consumo dos profissionais e fechamento por período.
- Clientes: histórico completo, aniversariantes, tags, importação, clube de clientes (desconto automático), pacotes de sessões, programa de fidelidade por pontos com prêmios e resgate pelo cliente.
- Comunicação automática por WhatsApp (Evolution API) e e-mail (Resend): confirmação, lembrete, cancelamento, mensagens de retorno por serviço, aniversário, pesquisa de satisfação, campanhas (notícias e promoções) por público com controle de envio/leitura.
- Relatórios: dashboard, agendamentos por dia da semana/horário/origem, ocupação, taxa de retorno, ticket médio, financeiro detalhado, movimentações (CSV).
- Equipe com papéis (dono, gestor, recepção, profissional); o profissional vê só a própria agenda e comissões.

**Pagamentos e autoatendimento**
- Pagamento online pela conta CreativePay da própria barbearia (Pix com QR code e checkout com cartão): sinal no agendamento online ("pagar agora" ou "pagar na barbearia"), cobrança da comanda pelo painel, pelo totem e pela área do cliente; webhook por barbearia.
- Maquininha: cobrança enviada ao aparelho via API do Mercado Pago Point, com confirmação automática na comanda.
- Totem de autoatendimento (`/totem/<slug>` em um tablet): o cliente se identifica pelo celular, faz check-in (o barbeiro recebe aviso e a agenda mostra "chegou"), entra na fila sem hora marcada, paga a comanda (Pix, maquininha ou balcão) e agenda a próxima visita sem precisar de atendente.

**Clientes (site público e área do cliente)**
- Site da barbearia em `/b/<slug>` com serviços, profissionais, horários, galeria e **agendamento online 24h** (com ou sem cadastro).
- Área do cliente: meus agendamentos (cancelar dentro do prazo), pontos e prêmios, pacotes, clube.

**Plataforma**
- Teste grátis de 30 dias sem limitação; planos por número de profissionais (1 / 2–5 / 6–15 / +15) com cobrança via CreativePay; painel superadmin.

## Stack

- **Backend**: NestJS 10, Prisma 5, PostgreSQL 16, JWT (access + refresh), cron (@nestjs/schedule), Swagger em `/api/docs`.
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Radix UI, React Query, Zustand, React Hook Form + Zod, Recharts.
- **Infra**: Docker (Dockerfiles em `docker/`), Coolify.

## Estrutura

```
apps/backend          API NestJS (src/modules/* = um módulo por domínio; prisma/ = schema, migrations, seed)
apps/frontend         SPA React (src/pages/{site,auth,app,public,client,admin}, src/components, src/lib/api)
docker/               Dockerfile.backend, Dockerfile.frontend, nginx.conf.template
docs/                 arquitetura e modelo de dados
```

## Rodando localmente

Veja [GETTING_STARTED.md](./GETTING_STARTED.md). Resumo:

```bash
npm install
docker compose up -d postgres
cp apps/backend/.env.example apps/backend/.env   # ajuste DATABASE_URL (porta 5432)
cd apps/backend && npx prisma migrate deploy && SEED_DEMO=true npx ts-node prisma/seed.ts
npm run dev   # na raiz: API em :3000 e frontend em :5173
```

Acessos do seed de demonstração: dono `dono@barbeariademo.com`, profissional `barbeiro@barbeariademo.com`, cliente `cliente@example.com` (senha `123456`); superadmin definido por `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Produção

- API: https://api-connect-barber.creativenext.cloud (`/api/health`, `/api/docs`)
- App: https://connect-barber.creativenext.cloud
- Deploy: push na `main` + redeploy dos dois apps no Coolify. O container da API roda `prisma migrate deploy` e o seed (idempotente) antes de iniciar.

## Licença

MIT — Lisboa Codes / Creative Labs.
