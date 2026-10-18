import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, MessageCircle, Users } from 'lucide-react';
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Select, Spinner, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { campaignsApi, type Audience, type Campaign, type Channel } from '@/lib/api/campaigns';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/auth.store';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const VARS = [
  { key: '{{cliente}}', label: 'Nome do cliente' },
  { key: '{{barbearia}}', label: 'Nome da barbearia' },
  { key: '{{link}}', label: 'Link de agendamento' },
];

interface Draft {
  title: string;
  content: string;
  channels: Channel[];
  all: boolean;
  tags: string[];
  clubId: string;
  inactiveDays: string;
  birthdayMonth: string;
  professionalId: string;
  minVisits: string;
  schedule: boolean;
  scheduledAt: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const toDraft = (c?: Campaign | null): Draft => {
  const a = c?.audience ?? { all: true };
  const filtered = !!(a.tags?.length || a.clubId || a.inactiveDays || a.birthdayMonth || a.professionalId || a.minVisits);
  return {
    title: c?.title ?? '',
    content: c?.content ?? 'Olá {{cliente}}! ',
    channels: c?.channels?.length ? c.channels : ['WHATSAPP'],
    all: !filtered,
    tags: a.tags ?? [],
    clubId: a.clubId ?? '',
    inactiveDays: a.inactiveDays ? String(a.inactiveDays) : '',
    birthdayMonth: a.birthdayMonth ? String(a.birthdayMonth) : '',
    professionalId: a.professionalId ?? '',
    minVisits: a.minVisits ? String(a.minVisits) : '',
    schedule: !!c?.scheduledAt,
    scheduledAt: c?.scheduledAt ? toLocalInput(new Date(c.scheduledAt)) : toLocalInput(new Date(Date.now() + 3600_000)),
  };
};

export function buildAudience(d: Pick<Draft, 'all' | 'tags' | 'clubId' | 'inactiveDays' | 'birthdayMonth' | 'professionalId' | 'minVisits'>): Audience {
  if (d.all) return { all: true };
  const a: Audience = {};
  if (d.tags.length) a.tags = d.tags;
  if (d.clubId) a.clubId = d.clubId;
  if (Number(d.inactiveDays)) a.inactiveDays = Number(d.inactiveDays);
  if (Number(d.birthdayMonth)) a.birthdayMonth = Number(d.birthdayMonth);
  if (d.professionalId) a.professionalId = d.professionalId;
  if (Number(d.minVisits)) a.minVisits = Number(d.minVisits);
  return Object.keys(a).length ? a : { all: true };
}

export function renderPreview(content: string, shop: string) {
  return content.replace(/\{\{cliente\}\}/g, 'João').replace(/\{\{barbearia\}\}/g, shop).replace(/\{\{link\}\}/g, `${window.location.origin}/b/sua-barbearia`);
}

export function CampaignFormDialog({ open, onOpenChange, campaign }: { open: boolean; onOpenChange: (o: boolean) => void; campaign?: Campaign | null }) {
  const qc = useQueryClient();
  const shop = useAuthStore((s) => s.current?.tenant.name ?? 'Barbearia');
  const [d, setD] = useState<Draft>(() => toDraft(campaign));
  const [debouncedAudience, setDebouncedAudience] = useState<Audience>({ all: true });
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setD(toDraft(campaign));
  }, [open, campaign]);

  const audience = buildAudience(d);
  const audienceKey = JSON.stringify(audience);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAudience(JSON.parse(audienceKey)), 400);
    return () => clearTimeout(t);
  }, [audienceKey]);

  const tags = useQuery({ queryKey: ['clients', 'tags'], queryFn: campaignsApi.tags, enabled: open });
  const clubs = useQuery({ queryKey: ['loyalty', 'clubs'], queryFn: campaignsApi.clubs, enabled: open });
  const pros = useQuery({ queryKey: ['professionals', 'lite'], queryFn: campaignsApi.professionals, enabled: open });
  const preview = useQuery({ queryKey: ['campaigns', 'preview', debouncedAudience], queryFn: () => campaignsApi.preview(debouncedAudience), enabled: open });

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: d.title.trim(), content: d.content, channels: d.channels, audience, scheduledAt: d.schedule && d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null };
      return campaign ? campaignsApi.update(campaign.id, payload) : campaignsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(d.schedule ? 'Campanha agendada' : 'Campanha salva como rascunho');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const toggleChannel = (c: Channel) => set('channels', d.channels.includes(c) ? d.channels.filter((x) => x !== c) : [...d.channels, c]);
  const insertVar = (v: string) => {
    const el = contentRef.current;
    if (!el) return set('content', d.content + v);
    const start = el.selectionStart ?? d.content.length;
    const end = el.selectionEnd ?? d.content.length;
    const next = d.content.slice(0, start) + v + d.content.slice(end);
    set('content', next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (d.title.trim().length < 2) return toast.error('Informe o título');
    if (d.content.trim().length < 5) return toast.error('Escreva a mensagem (mínimo 5 caracteres)');
    if (!d.channels.length) return toast.error('Selecione ao menos um canal');
    if (d.schedule && new Date(d.scheduledAt) <= new Date()) return toast.error('A data de agendamento precisa ser futura');
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title={campaign ? 'Editar campanha' : 'Nova campanha'} description="Envie notícias e promoções por WhatsApp e e-mail para seus clientes.">
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Field label="Título" required hint="Usado como assunto do e-mail.">
              <Input value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="Ex.: Promoção de aniversário" autoFocus />
            </Field>
            <Field label="Mensagem" required hint={`${d.content.length}/2000 caracteres`}>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {VARS.map((v) => (
                  <button key={v.key} type="button" onClick={() => insertVar(v.key)} className="rounded-md border bg-muted/50 px-2 py-0.5 text-xs hover:bg-accent" title={v.label}>
                    {v.key}
                  </button>
                ))}
              </div>
              <Textarea ref={contentRef} rows={6} value={d.content} onChange={(e) => set('content', e.target.value)} maxLength={2000} />
            </Field>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Canais</div>
              <div className="flex gap-2">
                {(
                  [
                    { c: 'WHATSAPP' as const, label: 'WhatsApp', icon: MessageCircle },
                    { c: 'EMAIL' as const, label: 'E-mail', icon: Mail },
                  ]
                ).map(({ c, label, icon: Icon }) => (
                  <button key={c} type="button" onClick={() => toggleChannel(c)} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors', d.channels.includes(c) ? 'border-primary bg-accent font-medium' : 'text-muted-foreground hover:bg-muted')}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-center justify-between text-sm font-medium">
                Agendar envio
                <Switch checked={d.schedule} onCheckedChange={(v) => set('schedule', v)} />
              </label>
              {d.schedule ? <Input type="datetime-local" value={d.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} /> : <p className="text-xs text-muted-foreground">Sem agendamento a campanha fica como rascunho até você clicar em Enviar.</p>}
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="mb-1 text-xs font-medium text-emerald-800">Pré-visualização</div>
              <p className="whitespace-pre-wrap text-sm text-emerald-950">{renderPreview(d.content, shop)}</p>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="text-sm font-medium">Público</div>
            <div className="flex rounded-lg border p-0.5 text-sm">
              <button type="button" className={cn('flex-1 rounded-md px-3 py-1.5', d.all ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground')} onClick={() => set('all', true)}>
                Todos os clientes
              </button>
              <button type="button" className={cn('flex-1 rounded-md px-3 py-1.5', !d.all ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground')} onClick={() => set('all', false)}>
                Filtrar
              </button>
            </div>
            {!d.all && (
              <div className="space-y-3">
                <Field label="Etiquetas (qualquer uma)">
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {tags.data?.length ? (
                      tags.data.map((t) => (
                        <button key={t.tag} type="button" onClick={() => set('tags', d.tags.includes(t.tag) ? d.tags.filter((x) => x !== t.tag) : [...d.tags, t.tag])} className={cn('rounded-full border px-2.5 py-0.5 text-xs', d.tags.includes(t.tag) ? 'border-primary bg-accent font-medium' : 'text-muted-foreground hover:bg-muted')}>
                          {t.tag} <span className="opacity-60">({t.count})</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada.</span>
                    )}
                  </div>
                </Field>
                <Field label="Clube">
                  <Select value={d.clubId} onChange={(e) => set('clubId', e.target.value)}>
                    <option value="">Qualquer</option>
                    {clubs.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Profissional preferido">
                  <Select value={d.professionalId} onChange={(e) => set('professionalId', e.target.value)}>
                    <option value="">Qualquer</option>
                    {pros.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inativos há (dias)">
                    <Input type="number" min={1} value={d.inactiveDays} onChange={(e) => set('inactiveDays', e.target.value)} placeholder="Ex.: 30" />
                  </Field>
                  <Field label="Mín. de visitas">
                    <Input type="number" min={1} value={d.minVisits} onChange={(e) => set('minVisits', e.target.value)} />
                  </Field>
                </div>
                <Field label="Aniversariantes do mês">
                  <Select value={d.birthdayMonth} onChange={(e) => set('birthdayMonth', e.target.value)}>
                    <option value="">Qualquer</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> Destinatários
                </span>
                {preview.isFetching ? <Spinner className="h-4 w-4" /> : <Badge variant="warning">{preview.data?.count ?? 0}</Badge>}
              </div>
              {!!preview.data?.sample.length && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground scrollbar-thin">
                  {preview.data.sample.map((c) => (
                    <li key={c.id} className="truncate">
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </li>
                  ))}
                  {preview.data.count > preview.data.sample.length && <li>e mais {preview.data.count - preview.data.sample.length}...</li>}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">Apenas clientes que aceitam marketing, não bloqueados e com telefone ou e-mail.</p>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked disabled className="mt-0.5" /> Respeitar o opt-out de marketing dos clientes (LGPD)
            </label>
          </div>

          <DialogFooter className="lg:col-span-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {d.schedule ? 'Agendar campanha' : 'Salvar rascunho'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
