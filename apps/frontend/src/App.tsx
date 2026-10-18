import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { PageLoader } from '@/components/ui';
import { RedirectIfAuthenticated, RequireAuth, RequireRole, RequireSuperAdmin, RequireTenant } from '@/components/layout/guards';
import SiteLayout from '@/components/layout/SiteLayout';
import AppShell from '@/components/layout/AppShell';

// Site institucional
const HomePage = lazy(() => import('@/pages/site/HomePage'));
const FeaturesPage = lazy(() => import('@/pages/site/FeaturesPage'));
const PricingPage = lazy(() => import('@/pages/site/PricingPage'));

// Autenticação
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const ClientLoginPage = lazy(() => import('@/pages/auth/ClientLoginPage'));
const ClientRegisterPage = lazy(() => import('@/pages/auth/ClientRegisterPage'));

// Painel da barbearia
const DashboardPage = lazy(() => import('@/pages/app/DashboardPage'));
const OnboardingPage = lazy(() => import('@/pages/app/OnboardingPage'));
const AgendaPage = lazy(() => import('@/pages/app/AgendaPage'));
const OrdersPage = lazy(() => import('@/pages/app/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/app/OrderDetailPage'));
const CashierPage = lazy(() => import('@/pages/app/CashierPage'));
const ClientsPage = lazy(() => import('@/pages/app/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/app/ClientDetailPage'));
const ProfessionalsPage = lazy(() => import('@/pages/app/ProfessionalsPage'));
const ServicesPage = lazy(() => import('@/pages/app/ServicesPage'));
const ProductsPage = lazy(() => import('@/pages/app/ProductsPage'));
const FinancePage = lazy(() => import('@/pages/app/FinancePage'));
const CommissionsPage = lazy(() => import('@/pages/app/CommissionsPage'));
const ReportsPage = lazy(() => import('@/pages/app/ReportsPage'));
const LoyaltyPage = lazy(() => import('@/pages/app/LoyaltyPage'));
const CampaignsPage = lazy(() => import('@/pages/app/CampaignsPage'));
const WaitlistPage = lazy(() => import('@/pages/app/WaitlistPage'));
const SurveysPage = lazy(() => import('@/pages/app/SurveysPage'));
const MessagesPage = lazy(() => import('@/pages/app/MessagesPage'));
const SettingsPage = lazy(() => import('@/pages/app/SettingsPage'));
const SiteSettingsPage = lazy(() => import('@/pages/app/SiteSettingsPage'));
const PlanPage = lazy(() => import('@/pages/app/PlanPage'));
const ProfilePage = lazy(() => import('@/pages/app/ProfilePage'));

// Público e cliente
const BarbershopPage = lazy(() => import('@/pages/public/BarbershopPage'));
const SurveyPage = lazy(() => import('@/pages/public/SurveyPage'));
const KioskPage = lazy(() => import('@/pages/public/KioskPage'));
const ClientAreaPage = lazy(() => import('@/pages/client/ClientAreaPage'));

// Administração da plataforma
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

const MANAGERS = ['OWNER', 'ADMIN'] as const;
const STAFF = ['OWNER', 'ADMIN', 'RECEPTION'] as const;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Site */}
            <Route element={<SiteLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/funcionalidades" element={<FeaturesPage />} />
              <Route path="/precos" element={<PricingPage />} />
            </Route>

            {/* Auth */}
            <Route element={<RedirectIfAuthenticated />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cadastro" element={<RegisterPage />} />
              <Route path="/cliente/login" element={<ClientLoginPage />} />
              <Route path="/cliente/cadastro" element={<ClientRegisterPage />} />
            </Route>
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

            {/* Público */}
            <Route path="/b/:slug" element={<BarbershopPage />} />
            <Route path="/b/:slug/*" element={<BarbershopPage />} />
            <Route path="/avaliar/:token" element={<SurveyPage />} />
            <Route path="/totem/:slug" element={<KioskPage />} />

            {/* Área do cliente */}
            <Route element={<RequireAuth />}>
              <Route path="/cliente/*" element={<ClientAreaPage />} />
            </Route>

            {/* Painel */}
            <Route element={<RequireTenant />}>
              <Route path="/app/onboarding" element={<OnboardingPage />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="comandas" element={<OrdersPage />} />
                <Route path="comandas/:id" element={<OrderDetailPage />} />
                <Route path="clientes" element={<ClientsPage />} />
                <Route path="clientes/:id" element={<ClientDetailPage />} />
                <Route path="profissionais" element={<ProfessionalsPage />} />
                <Route path="servicos" element={<ServicesPage />} />
                <Route path="produtos" element={<ProductsPage />} />
                <Route path="comissoes" element={<CommissionsPage />} />
                <Route path="relatorios" element={<ReportsPage />} />
                <Route path="lista-espera" element={<WaitlistPage />} />
                <Route path="pesquisas" element={<SurveysPage />} />
                <Route path="perfil" element={<ProfilePage />} />
                <Route element={<RequireRole roles={[...STAFF]} />}>
                  <Route path="caixa" element={<CashierPage />} />
                  <Route path="fidelidade" element={<LoyaltyPage />} />
                  <Route path="mensagens" element={<MessagesPage />} />
                </Route>
                <Route element={<RequireRole roles={[...MANAGERS]} />}>
                  <Route path="financeiro" element={<FinancePage />} />
                  <Route path="campanhas" element={<CampaignsPage />} />
                  <Route path="configuracoes" element={<SettingsPage />} />
                  <Route path="site" element={<SiteSettingsPage />} />
                  <Route path="plano" element={<PlanPage />} />
                </Route>
              </Route>
            </Route>

            {/* Admin da plataforma */}
            <Route element={<RequireAuth />}>
              <Route element={<RequireSuperAdmin />}>
                <Route path="/admin/*" element={<AdminPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
