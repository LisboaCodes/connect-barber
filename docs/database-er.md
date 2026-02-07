# Diagrama Entidade-Relacionamento

## Relacionamentos Principais

```mermaid
erDiagram
    TENANT ||--o{ USER : has
    TENANT ||--o{ SERVICE : offers
    TENANT ||--o{ APPOINTMENT : manages
    TENANT ||--o{ PRODUCT : sells
    TENANT ||--o{ CASHIER_SESSION : operates

    USER ||--o| PROFESSIONAL_PROFILE : has
    USER ||--o| CLIENT_PROFILE : has
    USER ||--o{ APPOINTMENT : books
    USER ||--o{ CASHIER_SESSION : opens
    USER ||--o{ AUDIT_LOG : performs

    PROFESSIONAL_PROFILE ||--o{ APPOINTMENT : serves

    SERVICE ||--o{ APPOINTMENT : scheduled

    APPOINTMENT }o--|| PROFESSIONAL_PROFILE : attended_by
    APPOINTMENT }o--|| SERVICE : uses
    APPOINTMENT }o--|| USER : booked_by

    CASHIER_SESSION ||--o{ TRANSACTION : contains

    PRODUCT ||--o{ TRANSACTION : sold_in

    TENANT {
        uuid id PK
        string name
        string slug UK
        enum plan
        datetime planExpiresAt
        int maxProfessionals
        boolean isActive
        json settings
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    USER {
        uuid id PK
        string email UK
        string password
        string name
        string phone
        string avatar
        uuid tenantId FK
        boolean emailVerified
        enum role
        string googleId UK
        string refreshToken
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    PROFESSIONAL_PROFILE {
        uuid id PK
        uuid userId FK,UK
        string bio
        array specialties
        decimal commissionRate
        json workSchedule
        string googleCalendarId
        string googleAccessToken
        string googleRefreshToken
        datetime createdAt
        datetime updatedAt
    }

    CLIENT_PROFILE {
        uuid id PK
        uuid userId FK,UK
        int loyaltyPoints
        uuid preferredProfessionalId
        datetime createdAt
        datetime updatedAt
    }

    SERVICE {
        uuid id PK
        uuid tenantId FK
        string name
        string description
        int durationMinutes
        decimal price
        decimal commissionRate
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    APPOINTMENT {
        uuid id PK
        uuid tenantId FK
        uuid clientId FK
        uuid professionalId FK
        uuid serviceId FK
        datetime scheduledAt
        datetime endAt
        enum status
        string notes
        datetime cancelledAt
        string cancelReason
        string googleEventId
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    CASHIER_SESSION {
        uuid id PK
        uuid tenantId FK
        uuid userId FK
        datetime openedAt
        datetime closedAt
        decimal initialBalance
        decimal finalBalance
        enum status
    }

    TRANSACTION {
        uuid id PK
        uuid cashierSessionId FK
        enum type
        decimal amount
        enum paymentMethod
        uuid appointmentId
        uuid productId FK
        string description
        datetime createdAt
    }

    PRODUCT {
        uuid id PK
        uuid tenantId FK
        string name
        string description
        decimal price
        int stock
        int minStock
        boolean isActive
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    AUDIT_LOG {
        uuid id PK
        uuid userId FK
        string action
        string entity
        uuid entityId
        json before
        json after
        string ipAddress
        string userAgent
        datetime createdAt
    }
```

## Enums

### PlanType
- `FREE`: Plano gratuito (1 profissional, limitações)
- `PRO`: Plano profissional (5 profissionais)
- `PREMIUM`: Plano premium (profissionais ilimitados + features avançadas)

### UserRole
- `ADMIN`: Dono da barbearia (acesso total)
- `PROFESSIONAL`: Barbeiro (acesso aos seus agendamentos)
- `CLIENT`: Cliente (acesso aos seus agendamentos)

### AppointmentStatus
- `PENDING`: Aguardando confirmação
- `CONFIRMED`: Confirmado
- `CANCELLED`: Cancelado
- `COMPLETED`: Concluído
- `NO_SHOW`: Cliente não compareceu

### CashierStatus
- `OPEN`: Caixa aberto
- `CLOSED`: Caixa fechado

### TransactionType
- `INCOME`: Entrada (venda de serviço/produto)
- `EXPENSE`: Saída (despesa)
- `WITHDRAWAL`: Sangria

### PaymentMethod
- `CASH`: Dinheiro
- `PIX`: PIX
- `CREDIT_CARD`: Cartão de crédito
- `DEBIT_CARD`: Cartão de débito

## Indexes

### Performance Optimization

```sql
-- Tenant lookup
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- User authentication
CREATE INDEX idx_users_email_tenant ON users(email, tenantId);
CREATE INDEX idx_users_google_id ON users(googleId);

-- Appointments by tenant and date
CREATE INDEX idx_appointments_tenant_date ON appointments(tenantId, scheduledAt);
CREATE INDEX idx_appointments_professional_date ON appointments(professionalId, scheduledAt);

-- Services by tenant
CREATE INDEX idx_services_tenant ON services(tenantId);

-- Products by tenant
CREATE INDEX idx_products_tenant ON products(tenantId);

-- Cashier sessions by tenant
CREATE INDEX idx_cashier_sessions_tenant_date ON cashier_sessions(tenantId, openedAt);

-- Transactions by session
CREATE INDEX idx_transactions_session_date ON transactions(cashierSessionId, createdAt);

-- Audit logs
CREATE INDEX idx_audit_logs_user_date ON audit_logs(userId, createdAt);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entityId);
```

## Constraints

### Unique Constraints
- `tenants.slug`: Cada barbearia tem slug único
- `users.email`: E-mail único globalmente
- `users.googleId`: Google ID único
- `professionalProfiles.userId`: Um usuário = um perfil profissional
- `clientProfiles.userId`: Um usuário = um perfil de cliente

### Foreign Keys
- Todas relações têm FK constraints
- `ON DELETE CASCADE` para perfis (quando user deletado)
- `ON DELETE RESTRICT` para relações críticas (ex: tenant em users)

## Soft Delete

Todas as entidades principais têm `deletedAt`:
- `tenants`
- `users`
- `services`
- `appointments`
- `products`

Dados nunca são permanentemente deletados, apenas marcados como deletados.
