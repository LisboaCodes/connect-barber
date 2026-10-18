import { Link } from 'react-router-dom';
import { ArrowRight, Rocket } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';

/** Card exibido enquanto a configuração inicial da barbearia não foi concluída */
export function OnboardingBanner({ className }: { className?: string }) {
  const current = useAuthStore((s) => s.current);
  if (!current || (current.role !== 'OWNER' && current.role !== 'ADMIN')) return null;
  const step = current.tenant.onboardingStep ?? 0;
  if (step >= 9) return null;
  const done = Math.max(0, Math.min(4, step - 1));
  return (
    <Card className={`mb-6 overflow-hidden border-primary/40 bg-gradient-to-r from-amber-50 to-background ${className ?? ''}`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Rocket className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Conclua a configuração da sua barbearia</div>
          <p className="text-sm text-muted-foreground">Horários, serviços, profissionais e jornada: faltam poucos passos para seus clientes agendarem on-line.</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(done / 4) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{done} de 4 etapas</span>
          </div>
        </div>
        <Button asChild>
          <Link to="/app/onboarding">
            {step > 1 ? 'Continuar configuração' : 'Começar agora'} <ArrowRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export default OnboardingBanner;
