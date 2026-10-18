# 🚀 Como rodar o Connect Barber

## Pré-requisitos

- Node.js 20+ e npm 10+
- Docker (para o PostgreSQL) ou um PostgreSQL 16 local

## 1. Instale as dependências

```bash
npm install
```

## 2. Banco de dados

```bash
docker compose up -d postgres        # sobe o Postgres em localhost:5432 (postgres/postgres, db connect_barber)
```

## 3. Variáveis de ambiente

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env     # VITE_API_URL=http://localhost:3000/api
```

As integrações são opcionais em desenvolvimento: sem `RESEND_API_KEY`/`EVOLUTION_*` as mensagens são apenas registradas em `message_logs` com status FAILED; sem `CREATIVE_PAY_*` a assinatura gera a fatura em modo manual.

## 4. Migrations e seed

```bash
cd apps/backend
npx prisma migrate deploy
SEED_DEMO=true npx ts-node prisma/seed.ts
```

O seed é idempotente: cria/atualiza o superadmin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, padrão `admin@connectbarber.app` / `admin123`) e, com `SEED_DEMO=true`, a **Barbearia Demo** (`/b/barbearia-demo`) com 3 profissionais, 8 serviços, produtos, 12 clientes, ~200 agendamentos (10 dias passados e 5 futuros), ~100 comandas fechadas, comissões, despesas, fidelidade ativa, clube VIP e um pacote.

| Perfil        | E-mail                      | Senha  |
|---------------|-----------------------------|--------|
| Dono          | dono@barbeariademo.com      | 123456 |
| Profissional  | barbeiro@barbeariademo.com  | 123456 |
| Cliente       | cliente@example.com         | 123456 |

## 5. Rode em desenvolvimento

```bash
npm run dev                                   # API (:3000) + frontend (:5173) via turbo
# ou separadamente
npm run dev --workspace=@connect-barber/backend
npm run dev --workspace=@connect-barber/frontend
```

- Frontend: http://localhost:5173 (site institucional em `/`, painel em `/app`, site da barbearia demo em `/b/barbearia-demo`, área do cliente em `/cliente`, admin em `/admin`)
- API: http://localhost:3000/api — Swagger em http://localhost:3000/api/docs

## 6. Docker (stack completa)

```bash
cp .env.example .env    # defina senhas/segredos
docker compose up -d --build
```

O backend aplica as migrations e o seed ao iniciar. Frontend em http://localhost (nginx) e API em http://localhost:3000/api.

## Comandos úteis

```bash
# backend
npm run build --workspace=@connect-barber/backend
npx prisma studio                      # em apps/backend
npx prisma migrate dev --name <nome>   # nova migration (dev)

# frontend
npm run build --workspace=@connect-barber/frontend
npx tsc --noEmit -p apps/frontend/tsconfig.json
```

## Rotinas automáticas (cron)

Rodam dentro da API (desligue com `DISABLE_CRON=true`): lembretes (a cada 10 min), pesquisa de satisfação (15 min), campanhas agendadas (5 min), mensagens de retorno (10h), aniversariantes (9h), limpeza/renovação de planos/expiração de pontos (3h).

## Problemas comuns

- **"Abra o caixa antes de fechar comandas"**: comandas só fecham com um caixa aberto (Caixa › Abrir).
- **Prisma: migration modificada**: o banco foi criado com um schema antigo; em dev, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` e rode as migrations de novo.
- **Build do backend**: usa `tsc` (sem webpack) porque `bcrypt` é nativo; `nest build` já está configurado assim.
