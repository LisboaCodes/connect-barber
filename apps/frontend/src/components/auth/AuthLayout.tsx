import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Input, InputProps } from '@/components/ui';

const DEFAULT_BENEFITS = ['Agenda on-line 24 horas', 'Lembretes automáticos por WhatsApp', 'Comandas, caixa e comissões', 'Site próprio para sua barbearia'];

/** Layout split das telas de autenticação: painel escuro com marca à esquerda, formulário à direita */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  sideTitle = 'Uma nova experiência para uma antiga tradição',
  sideText = 'O sistema de gestão completo para barbearias. Agenda, comandas, financeiro e fidelidade em um só lugar.',
  benefits = DEFAULT_BENEFITS,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sideTitle?: string;
  sideText?: string;
  benefits?: string[];
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-gray-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(165,140,100,0.45),transparent_60%)]" />
        <Link to="/" className="relative flex items-center">
          <img src="/logo-dark.png" alt="Connect Barber" className="h-16 w-auto" />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight">{sideTitle}</h2>
          <p className="mt-4 text-gray-300">{sideText}</p>
          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-gray-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-gray-500">© {new Date().getFullYear()} Connect Barber. Todos os direitos reservados.</p>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 lg:hidden">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="Connect Barber" className="h-10 w-auto rounded-lg" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Input de senha com botão de mostrar/ocultar */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'suffix'>>((props, ref) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const CLIENT_BENEFITS = ['Agende em poucos toques, 24 horas por dia', 'Receba lembretes do seu horário', 'Acompanhe seus pontos de fidelidade', 'Histórico de atendimentos'];

/** Máscara simples de telefone BR */
export function maskPhone(v: string) {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
