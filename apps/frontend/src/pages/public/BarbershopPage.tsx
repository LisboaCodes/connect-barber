import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { Button, EmptyState, PageLoader } from '@/components/ui';
import { publicApi } from '@/lib/api/public';
import BarbershopSite from '@/components/public/BarbershopSite';
import BookingFlow from '@/components/public/BookingFlow';

export default function BarbershopPage() {
  const params = useParams();
  const slug = params.slug ?? '';
  const sub = (params['*'] ?? '').replace(/\/+$/, '');

  const { data: shop, isLoading, isError, error } = useQuery({
    queryKey: ['public-barbershop', slug],
    queryFn: () => publicApi.barbershop(slug),
    enabled: !!slug,
    retry: (count, e: any) => e?.response?.status !== 404 && count < 1,
  });

  useEffect(() => {
    if (shop?.name) document.title = sub === 'agendar' ? `Agendar · ${shop.name}` : shop.name;
    return () => {
      document.title = 'Connect Barber';
    };
  }, [shop?.name, sub]);

  if (isLoading) return <PageLoader />;

  if (isError || !shop) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <EmptyState
          icon={Store}
          className="w-full max-w-md bg-white"
          title={notFound ? 'Barbearia não encontrada' : 'Não foi possível carregar'}
          description={notFound ? 'Confira o endereço digitado. O site pode ter sido desativado.' : 'Verifique sua conexão e tente novamente.'}
          action={
            <Button asChild variant="outline">
              <Link to="/">Ir para o Connect Barber</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (sub === 'agendar') {
    if (!shop.onlineBookingEnabled) return <Navigate to={`/b/${slug}`} replace />;
    return <BookingFlow shop={shop} />;
  }
  if (sub) return <Navigate to={`/b/${slug}`} replace />;

  return <BarbershopSite shop={shop} />;
}
