# 🚀 Getting Started - Connect Barber

## Pré-requisitos

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **PostgreSQL** >= 16 (ou Docker)
- **Git**

## Instalação Rápida

### 1. Clone o repositório

```bash
git clone https://github.com/LisboaCodes/connect-barber.git
cd connect-barber
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

#### Backend

```bash
cd apps/backend
cp .env.example .env
```

Edite o arquivo `.env` e configure:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/connect_barber
JWT_SECRET=seu-secret-super-seguro-aqui
JWT_REFRESH_SECRET=seu-refresh-secret-aqui
```

#### Frontend

```bash
cd apps/frontend
cp .env.example .env
```

Edite o arquivo `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Configure o banco de dados

#### Opção A: Usando Docker (Recomendado)

```bash
# Na raiz do projeto
docker-compose up -d postgres
```

#### Opção B: PostgreSQL local

Certifique-se de ter o PostgreSQL rodando e crie o banco:

```sql
CREATE DATABASE connect_barber;
```

### 5. Execute as migrations

```bash
cd apps/backend
npm run db:migrate
```

### 6. Seed do banco (dados de exemplo)

```bash
npm run db:seed
```

Isso criará:
- 1 barbearia demo
- 1 usuário admin
- 1 barbeiro
- 1 cliente
- Serviços e produtos de exemplo

**Credenciais de acesso:**
- Admin: `admin@barbeariademo.com` / `123456`
- Barbeiro: `barbeiro@barbeariademo.com` / `123456`
- Cliente: `cliente@example.com` / `123456`

### 7. Inicie o projeto

#### Desenvolvimento (backend + frontend)

```bash
# Na raiz do projeto
npm run dev
```

Ou individualmente:

```bash
# Backend (porta 3000)
npm run dev --workspace=@connect-barber/backend

# Frontend (porta 5173)
npm run dev --workspace=@connect-barber/frontend
```

### 8. Acesse a aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **Prisma Studio**: `npm run db:studio` (abre em http://localhost:5555)

## 🐳 Docker (Produção)

Para rodar todo o stack com Docker:

### 1. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` raiz com suas configurações.

### 2. Suba os containers

```bash
docker-compose up -d
```

Isso irá:
- Criar container PostgreSQL
- Buildar e subir o backend
- Buildar e subir o frontend com Nginx

### 3. Execute as migrations

```bash
docker-compose exec backend npx prisma migrate deploy
```

### 4. (Opcional) Seed do banco

```bash
docker-compose exec backend npm run db:seed
```

### 5. Acesse

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000/api

## 📚 Próximos Passos

Agora que o projeto está rodando, você pode:

1. **Explorar a API**: Acesse http://localhost:3000/api/docs
2. **Fazer login**: Use as credenciais do seed
3. **Testar features**: Criar agendamentos, gerenciar produtos, etc
4. **Desenvolver**: Siga o plano de implementação nas fases seguintes

## 🛠️ Comandos Úteis

### Backend

```bash
# Gerar Prisma Client
npm run db:generate --workspace=@connect-barber/backend

# Criar nova migration
npm run db:migrate --workspace=@connect-barber/backend

# Deploy migrations (produção)
npm run db:migrate:deploy --workspace=@connect-barber/backend

# Abrir Prisma Studio
npm run db:studio --workspace=@connect-barber/backend

# Rodar testes
npm run test --workspace=@connect-barber/backend

# Build
npm run build --workspace=@connect-barber/backend
```

### Frontend

```bash
# Dev server
npm run dev --workspace=@connect-barber/frontend

# Build
npm run build --workspace=@connect-barber/frontend

# Preview build
npm run preview --workspace=@connect-barber/frontend

# Lint
npm run lint --workspace=@connect-barber/frontend
```

### Geral

```bash
# Rodar tudo em dev
npm run dev

# Build tudo
npm run build

# Rodar testes
npm run test

# Lint tudo
npm run lint

# Formatar código
npm run format

# Limpar node_modules
npm run clean
```

## 🔧 Troubleshooting

### Porta já em uso

Se a porta 3000 ou 5173 já estiver em uso:

```bash
# Backend
PORT=3001 npm run dev --workspace=@connect-barber/backend

# Frontend - edite vite.config.ts
```

### Erro de conexão com banco

Verifique se:
1. PostgreSQL está rodando
2. `DATABASE_URL` está correta no `.env`
3. Banco de dados existe

### Prisma Client não gerado

```bash
cd apps/backend
npx prisma generate
```

### Migrations pendentes

```bash
cd apps/backend
npx prisma migrate dev
```

## 📞 Suporte

- **Issues**: https://github.com/LisboaCodes/connect-barber/issues
- **Documentação**: `/docs` folder
- **Wiki**: Em breve

---

**Desenvolvido com ❤️ por Lisboa Codes**
