import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Globe, Link2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, EmptyState, Field, ImageUpload, Input, PageHeader, PageLoader, Section, Switch, Textarea, UploadButton } from '@/components/ui';
import { SwitchRow } from '@/components/settings/BookingSettingsForm';
import { errorMessage } from '@/lib/api/client';
import { useTenant, useUpdateTenant, type Tenant } from '@/lib/api/tenant';
import { useAuthStore } from '@/store/auth.store';

const url = z.string().trim().url('URL inválida').or(z.literal(''));

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen'),
  siteEnabled: z.boolean(),
  onlineBookingEnabled: z.boolean(),
  coverUrl: url,
  logoUrl: url,
  siteAbout: z.string().max(5000),
  siteInstagram: z.string().trim(),
  siteFacebook: z.string().trim(),
  sitePaymentInfo: z.string().max(1000),
});
type FormValues = z.infer<typeof schema>;

const toForm = (t: Tenant): FormValues => ({
  slug: t.slug,
  siteEnabled: t.siteEnabled,
  onlineBookingEnabled: t.onlineBookingEnabled,
  coverUrl: t.coverUrl ?? '',
  logoUrl: t.logoUrl ?? '',
  siteAbout: t.siteAbout ?? '',
  siteInstagram: t.siteInstagram ?? '',
  siteFacebook: t.siteFacebook ?? '',
  sitePaymentInfo: t.sitePaymentInfo ?? '',
});

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-');

export default function SiteSettingsPage() {
  const { data: tenant, isLoading, error } = useTenant();
  if (isLoading) return <PageLoader />;
  if (error || !tenant) return <EmptyState icon={Globe} title="Não foi possível carregar" description={errorMessage(error)} />;
  return <SiteForm tenant={tenant} />;
}

function SiteForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant('Site atualizado');
  const [gallery, setGallery] = useState<string[]>(tenant.siteGallery ?? []);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [newImage, setNewImage] = useState('');
  const { register, handleSubmit, reset, control, watch, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(tenant) });

  useEffect(() => {
    reset(toForm(tenant));
    setGallery(Array.isArray(tenant.siteGallery) ? tenant.siteGallery : []);
    setGalleryDirty(false);
  }, [tenant, reset]);

  const slug = watch('slug');
  const cover = watch('coverUrl');
  const logo = watch('logoUrl');
  const publicUrl = `${window.location.origin}/b/${tenant.slug}`;

  const setG = (g: string[]) => {
    setGallery(g);
    setGalleryDirty(true);
  };
  const addImage = () => {
    const v = newImage.trim();
    if (!z.string().url().safeParse(v).success) return toast.error('Informe uma URL de imagem válida');
    if (gallery.length >= 20) return toast.error('Limite de 20 fotos');
    setG([...gallery, v]);
    setNewImage('');
  };
  const moveImg = (i: number, d: -1 | 1) => {
    const g = [...gallery];
    [g[i], g[i + d]] = [g[i + d], g[i]];
    setG(g);
  };

  const onSubmit = (v: FormValues) => {
    const nul = (s: string) => (s.trim() ? s.trim() : null);
    update.mutate(
      {
        slug: v.slug !== tenant.slug ? v.slug : undefined,
        siteEnabled: v.siteEnabled,
        onlineBookingEnabled: v.onlineBookingEnabled,
        coverUrl: nul(v.coverUrl),
        logoUrl: nul(v.logoUrl),
        siteAbout: nul(v.siteAbout),
        siteInstagram: nul(v.siteInstagram.replace(/^@/, '')),
        siteFacebook: nul(v.siteFacebook),
        sitePaymentInfo: nul(v.sitePaymentInfo),
        siteGallery: gallery,
      },
      {
        onSuccess: (t) => {
          useAuthStore.getState().updateCurrentTenant({ name: t.name, slug: t.slug, logoUrl: t.logoUrl });
          setGalleryDirty(false);
        },
      },
    );
  };

  const copy = () =>
    navigator.clipboard?.writeText(publicUrl).then(
      () => toast.success('Link copiado'),
      () => toast.error('Não foi possível copiar'),
    );

  return (
    <div>
      <PageHeader
        title="Site e agendamento online"
        description="Sua página pública, onde clientes conhecem a barbearia e agendam horários"
        actions={
          <>
            <Button variant="outline" onClick={copy}>
              <Copy /> Copiar link
            </Button>
            <Button asChild variant="outline">
              <a href={`/b/${tenant.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver site
              </a>
            </Button>
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
        <Section title="Endereço e publicação">
          <Field label="Endereço da sua página" error={formState.errors.slug?.message} hint={slug !== tenant.slug ? 'Atenção: o link antigo deixará de funcionar.' : undefined}>
            <div className="flex items-center overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
              <span className="whitespace-nowrap border-r bg-muted px-3 py-2 text-sm text-muted-foreground">{window.location.host}/b/</span>
              <input className="h-9 flex-1 bg-background px-2 text-sm outline-none" {...register('slug', { onChange: (e) => setValue('slug', slugify(e.target.value)) })} />
            </div>
          </Field>
          <a href={`/b/${tenant.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {publicUrl} <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <div className="mt-3 divide-y">
            <SwitchRow title="Site publicado" description="Quando desativado, a página pública fica indisponível">
              <Controller control={control} name="siteEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </SwitchRow>
            <SwitchRow title="Agendamento online" description="Exibe o botão de agendar na página">
              <Controller control={control} name="onlineBookingEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </SwitchRow>
          </div>
        </Section>

        <Section title="Aparência">
          <div className="overflow-hidden rounded-xl border">
            <div className="relative h-36 bg-gradient-to-br from-amber-500 to-amber-700 sm:h-48">
              {cover && !formState.errors.coverUrl && <img src={cover} alt="" className="h-full w-full object-cover" />}
              <div className="absolute -bottom-8 left-4 h-16 w-16 overflow-hidden rounded-full border-4 border-background bg-muted">
                {logo && !formState.errors.logoUrl ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-lg font-bold">{tenant.name[0]}</div>}
              </div>
            </div>
            <div className="px-4 pb-3 pl-24 pt-2 font-semibold">{tenant.name}</div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Imagem de capa" error={formState.errors.coverUrl?.message} hint="Recomendado 1600×600 (paisagem)">
              <Controller control={control} name="coverUrl" render={({ field }) => <ImageUpload shape="wide" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Logotipo" error={formState.errors.logoUrl?.message} hint="Quadrado, mín. 200×200">
              <Controller control={control} name="logoUrl" render={({ field }) => <ImageUpload shape="circle" value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
        </Section>

        <Section title="Conteúdo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sobre a barbearia" className="sm:col-span-2" error={formState.errors.siteAbout?.message}>
              <Textarea rows={5} {...register('siteAbout')} placeholder="Conte a história da barbearia, estilo, diferenciais..." />
            </Field>
            <Field label="Instagram" hint="Somente o usuário, sem @">
              <Input prefix="@" {...register('siteInstagram')} placeholder="suabarbearia" />
            </Field>
            <Field label="Facebook" hint="Link ou nome da página">
              <Input {...register('siteFacebook')} placeholder="facebook.com/suabarbearia" />
            </Field>
            <Field label="Formas de pagamento aceitas" className="sm:col-span-2" hint="Texto exibido no site (ex.: Pix, cartões, dinheiro)">
              <Textarea rows={2} {...register('sitePaymentInfo')} />
            </Field>
          </div>
        </Section>

        <Section title="Galeria de fotos" description="Fotos de cortes, ambiente e equipe (até 20)">
          <div className="flex flex-col gap-2 sm:flex-row">
            <UploadButton
              multiple
              variant="default"
              disabled={gallery.length >= 20}
              onUploaded={(urls) => setG([...gallery, ...urls].slice(0, 20))}
            />
            <div className="flex flex-1 gap-2">
              <Input
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                placeholder="ou cole o link de uma imagem"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImage();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addImage} aria-label="Adicionar por link">
                <Link2 /> Adicionar
              </Button>
            </div>
          </div>
          {gallery.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((g, i) => (
                <div key={`${g}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <img src={g} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <Button type="button" size="icon-sm" variant="secondary" disabled={i === 0} onClick={() => moveImg(i, -1)} aria-label="Mover para trás">
                      <ArrowUp className="-rotate-90" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="secondary" disabled={i === gallery.length - 1} onClick={() => moveImg(i, 1)} aria-label="Mover para frente">
                      <ArrowDown className="-rotate-90" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="destructive" onClick={() => setG(gallery.filter((_, j) => j !== i))} aria-label="Remover">
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma foto adicionada.</p>
          )}
        </Section>

        <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty && !galleryDirty}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
