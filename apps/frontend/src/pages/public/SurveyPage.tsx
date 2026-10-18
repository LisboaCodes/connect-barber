import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, MessageSquareHeart, Star } from 'lucide-react';
import { Button, EmptyState, Field, PageLoader, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { fmtDateTime } from '@/lib/utils/format';
import { errorMessage } from '@/lib/api/client';
import { publicApi } from '@/lib/api/public';
import { PoweredBy, ShopLogo } from '@/components/public/shared';

const LABELS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente!'];

export default function SurveyPage() {
  const { token = '' } = useParams();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-survey', token],
    queryFn: () => publicApi.survey(token),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    document.title = data?.tenant?.name ? `Avalie · ${data.tenant.name}` : 'Avaliação';
  }, [data?.tenant?.name]);

  const submit = useMutation({
    mutationFn: () => publicApi.answerSurvey(token, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(errorMessage(e, 'Não foi possível enviar sua avaliação')),
  });

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <Wrapper>
        <EmptyState icon={MessageSquareHeart} className="bg-white" title={notFound ? 'Pesquisa não encontrada' : 'Não foi possível carregar'} description={notFound ? 'O link pode estar incorreto ou expirado.' : 'Tente novamente em instantes.'} />
      </Wrapper>
    );
  }

  const services = (data.appointment?.services ?? []).map((s) => s.service?.name).filter(Boolean).join(', ');
  const header = (
    <div className="flex flex-col items-center text-center">
      <ShopLogo name={data.tenant.name} logoUrl={data.tenant.logoUrl} className="h-16 w-16 text-lg shadow" />
      <div className="mt-3 font-semibold">{data.tenant.name}</div>
      {data.appointment && (
        <p className="mt-1 text-xs text-muted-foreground">
          {fmtDateTime(data.appointment.startAt)}
          {services && ` · ${services}`}
          {data.professional && ` · com ${data.professional.name}`}
        </p>
      )}
    </div>
  );

  if (sent || data.answeredAt) {
    return (
      <Wrapper>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {header}
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-bold">{sent ? 'Obrigado pela avaliação!' : 'Esta pesquisa já foi respondida'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{sent ? 'Sua opinião ajuda a barbearia a melhorar cada vez mais.' : 'Agradecemos por ter compartilhado sua opinião.'}</p>
            {data.tenant.slug && (
              <Button asChild className="mt-5">
                <Link to={`/b/${data.tenant.slug}`}>Agendar novamente</Link>
              </Button>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }

  const shown = hover || rating;
  return (
    <Wrapper>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {header}
        <h1 className="mt-6 text-center text-lg font-bold">Como foi seu atendimento?</h1>
        <div className="mt-4 flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} estrela(s)`} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} className="rounded-full p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Star className={cn('h-10 w-10', i <= shown ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300')} />
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-center text-sm font-medium text-amber-700">{LABELS[shown]}</p>
        <Field label="Comentário" hint="Opcional" className="mt-4">
          <Textarea rows={4} maxLength={1000} placeholder="Conte o que achou do atendimento..." value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <Button size="lg" className="mt-5 w-full" disabled={!rating} loading={submit.isPending} onClick={() => submit.mutate()}>
          Enviar avaliação
        </Button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-gray-50 p-4">
      <div className="w-full max-w-md">{children}</div>
      <PoweredBy className="mt-6" />
    </div>
  );
}
