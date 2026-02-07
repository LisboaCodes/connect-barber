# 💈 Connect Barber SaaS

Sistema completo de gestão para barbearias - Multi-tenant, escalável e moderno.

## 🚀 Tecnologias

### Backend
- **NestJS** - Framework Node.js robusto
- **Prisma** - ORM TypeScript-first
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação
- **Google OAuth** - Login social
- **Google Calendar API** - Sincronização de agendamentos
- **Resend** - Serviço de e-mail
- **Evolution API** - WhatsApp

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool ultra-rápido
- **TailwindCSS** - Estilização
- **Shadcn/UI** - Componentes
- **React Query** - Server state
- **Zustand** - Client state
- **React Hook Form** - Formulários
- **Recharts** - Gráficos

## 🏗️ Arquitetura

```
connect-barber/
├── apps/
│   ├── backend/          # API NestJS
│   └── frontend/         # React App
├── packages/
│   ├── shared/           # Código compartilhado
│   └── database/         # Prisma schema
├── docker/               # Dockerfiles
└── docs/                 # Documentação
```

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Executar migrations
npm run db:migrate

# Seed do banco
npm run db:seed

# Iniciar desenvolvimento
npm run dev
```

## 🐳 Docker

```bash
# Desenvolvimento
docker-compose up -d

# Produção
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes E2E
npm run test:e2e

# Coverage
npm run test:cov
```

## 📚 Features

- ✅ Multi-tenant (isolamento por barbearia)
- ✅ Sistema de planos (Free, Pro, Premium)
- ✅ Autenticação JWT + OAuth Google
- ✅ Agendamentos com sincronização Google Calendar
- ✅ Caixa e controle financeiro
- ✅ Gestão de produtos e estoque
- ✅ Sistema de comissões
- ✅ Notificações por e-mail e WhatsApp
- ✅ Programa de fidelidade
- ✅ Relatórios e dashboards
- ✅ Auditoria de ações

## 🔐 Segurança

- Autenticação JWT com refresh tokens
- RBAC (Role-based access control)
- Tenant isolation em todas as queries
- Rate limiting
- Auditoria de ações sensíveis
- Soft delete em todas as entidades

## 📖 Documentação

- [Arquitetura](./docs/architecture.md)
- [Banco de Dados - ER](./docs/database-er.md)
- [API Spec](./docs/api-spec.yaml)

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.

## 👨‍💻 Autor

Desenvolvido por **Lisboa Codes**

---

🚀 **Connect Barber** - Transformando a gestão de barbearias
