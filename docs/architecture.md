# Arquitetura - Connect Barber

## Visão Geral

O Connect Barber é construído como um monorepo usando Turbo, com backend em NestJS e frontend em React.

## Arquitetura Backend

### Clean Architecture

O backend segue os princípios da Clean Architecture:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│      (Controllers, DTOs)            │
├─────────────────────────────────────┤
│       Application Layer             │
│    (Use Cases, Services)            │
├─────────────────────────────────────┤
│          Domain Layer               │
│  (Entities, Value Objects)          │
├─────────────────────────────────────┤
│      Infrastructure Layer           │
│  (Prisma, External APIs)            │
└─────────────────────────────────────┘
```

### Camadas

1. **Domain Layer** (`core/domain/`)
   - Entidades de negócio
   - Regras de domínio
   - Interfaces de repositórios
   - Value Objects

2. **Application Layer** (`core/application/`)
   - Casos de uso
   - Serviços de aplicação
   - DTOs de aplicação

3. **Infrastructure Layer** (`core/infrastructure/`)
   - Implementações de repositórios (Prisma)
   - Integrações externas (Google, Resend, Evolution API)
   - Configurações

4. **Presentation Layer** (`modules/`)
   - Controllers REST
   - Validação de entrada
   - Documentação Swagger

## Multi-Tenancy

### Estratégia: Isolamento Lógico

- **Um banco de dados** para todos os tenants
- **tenantId** em todas as tabelas relevantes
- **Middleware Prisma** garante isolamento automático
- **Tenant Guard** valida acesso por tenant

### Fluxo de Isolamento

```
Request → JWT Decode → Extract tenantId → Prisma Middleware → Query com tenantId
```

## Autenticação

### JWT + Refresh Token

```
┌──────────┐     Login      ┌──────────┐
│  Client  │ ─────────────> │   API    │
│          │                 │          │
│          │ <───────────── │          │
└──────────┘  Access Token   └──────────┘
              Refresh Token
```

- **Access Token**: 1 dia de validade
- **Refresh Token**: 7 dias de validade
- **OAuth Google**: Suporte a login social

## Frontend Architecture

### React + TypeScript

```
┌─────────────────────────────────────┐
│            Components               │
│      (UI, Layout, Forms)            │
├─────────────────────────────────────┤
│           State Management          │
│    (Zustand + React Query)          │
├─────────────────────────────────────┤
│           API Layer                 │
│         (Axios Client)              │
└─────────────────────────────────────┘
```

### State Management

- **Server State**: React Query (cache, refetch, invalidation)
- **Client State**: Zustand (auth, UI preferences)

## Banco de Dados

### PostgreSQL + Prisma

- **ORM**: Prisma (type-safe, migrations)
- **Soft Delete**: Todas entidades têm `deletedAt`
- **Auditoria**: Logs de ações sensíveis

## Integrações

### Google Calendar
- Sincronização automática de agendamentos
- OAuth 2.0 para autenticação

### Resend (E-mail)
- Confirmações de agendamento
- Lembretes automáticos
- Recuperação de senha

### Evolution API (WhatsApp)
- Notificações em tempo real
- Confirmações de agendamento
- Marketing de retorno

## Deploy

### Docker + Coolify

- **Backend**: Container Node.js
- **Frontend**: Container Nginx
- **Database**: PostgreSQL container
- **CI/CD**: GitHub Actions

### Ambiente de Produção

```
┌─────────────┐
│   Nginx     │ → Serve frontend + Proxy API
└─────────────┘
      ↓
┌─────────────┐
│  NestJS API │ → Backend application
└─────────────┘
      ↓
┌─────────────┐
│ PostgreSQL  │ → Database
└─────────────┘
```

## Segurança

1. **Autenticação**: JWT com refresh tokens
2. **Autorização**: RBAC (Role-Based Access Control)
3. **Multi-tenant**: Isolamento garantido por middleware
4. **Rate Limiting**: Proteção contra brute force
5. **Auditoria**: Logs de todas ações sensíveis
6. **Soft Delete**: Dados nunca são permanentemente deletados

## Escalabilidade

### Horizontal Scaling

- Backend stateless (permite múltiplas instâncias)
- Database connection pooling
- Cache com React Query no frontend

### Performance

- Indexes otimizados no banco
- Pagination em todas listas
- Lazy loading de componentes
- Build otimizado com Vite

## Testes

### Backend
- **Unit Tests**: Jest
- **E2E Tests**: Supertest
- **Coverage**: > 80%

### Frontend
- **Component Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright (futuro)
