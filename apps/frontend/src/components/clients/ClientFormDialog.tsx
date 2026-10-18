import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogFooter, Field, Input, Label, Select, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api/client';
import { clientsApi, dateOnly, type Client, type ClientInput } from '@/lib/api/clients';
import { professionalsApi } from '@/lib/api/professionals';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome (mín. 2 letras)').max(100),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || v.replace(/\D/g, '').length >= 10, 'Telefone inválido (com DDD)'),
  email: z.string().trim().email('E-mail inválido').or(z.literal('')),
  birthDate: z.string(),
  gender: z.string(),
  notes: z.string().max(2000),
  preferredProfessionalId: z.string(),
  clubId: z.string(),
  marketingOptIn: z.boolean(),
  blocked: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const toForm = (c?: Client | null): FormValues => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  email: c?.email ?? '',
  birthDate: dateOnly(c?.birthDate),
  gender: c?.gender ?? '',
  notes: c?.notes ?? '',
  preferredProfessionalId: c?.preferredProfessionalId ?? '',
  clubId: c?.clubId ?? '',
  marketingOptIn: c?.marketingOptIn ?? true,
  blocked: c?.blocked ?? false,
});

export function ClientFormDialog({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; client?: Client | null; onSaved?: (c: Client) => void }) {
  const qc = useQueryClient();
  const editing = !!client;
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');

  const { data: pros } = useQuery({ queryKey: ['professionals', 'active'], queryFn: () => professionalsApi.list(false), enabled: open });
  const { data: clubs } = useQuery({ queryKey: ['clubs'], queryFn: clientsApi.clubs, enabled: open });
  const { data: allTags } = useQuery({ queryKey: ['clients', 'tags'], queryFn: clientsApi.tags, enabled: open });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(client) });
  const { register, handleSubmit, reset, control, formState } = form;

  useEffect(() => {
    if (open) {
      reset(toForm(client));
      setTags(client?.tags ?? []);
      setTagText('');
    }
  }, [open, client, reset]);

  const addTag = (t: string) => {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagText('');
  };

  const mut = useMutation({
    mutationFn: (v: FormValues) => {
      const pending = tagText.trim() && !tags.includes(tagText.trim()) ? [...tags, tagText.trim()] : tags;
      const payload: ClientInput = {
        name: v.name.trim(),
        phone: v.phone.trim() || (editing ? '' : undefined),
        email: v.email.trim() || (editing ? null : undefined),
        birthDate: v.birthDate || null,
        gender: v.gender || undefined,
        notes: v.notes || (editing ? '' : undefined),
        tags: pending,
        preferredProfessionalId: v.preferredProfessionalId || null,
        clubId: v.clubId || null,
        marketingOptIn: v.marketingOptIn,
        blocked: v.blocked,
      };
      return editing ? clientsApi.update(client!.id, payload) : clientsApi.create(payload);
    },
    onSuccess: (c) => {
      toast.success(editing ? 'Cliente atualizado' : 'Cliente cadastrado');
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', c.id] });
      onSaved?.(c);
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const suggestions = (allTags ?? []).map((t) => t.tag).filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={editing ? 'Editar cliente' : 'Novo cliente'}>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={formState.errors.name?.message} className="sm:col-span-2">
              <Input autoFocus {...register('name')} placeholder="Nome completo" />
            </Field>
            <Field label="Telefone / WhatsApp" error={formState.errors.phone?.message}>
              <Input {...register('phone')} inputMode="tel" placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail" error={formState.errors.email?.message}>
              <Input {...register('email')} type="email" placeholder="cliente@email.com" />
            </Field>
            <Field label="Data de nascimento">
              <Input type="date" {...register('birthDate')} />
            </Field>
            <Field label="Gênero">
              <Select {...register('gender')}>
                <option value="">Não informado</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </Select>
            </Field>
            <Field label="Profissional preferido">
              <Select {...register('preferredProfessionalId')}>
                <option value="">Nenhum</option>
                {pros?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Clube de assinatura">
              <Select {...register('clubId')}>
                <option value="">Sem clube</option>
                {clubs?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Etiquetas" hint="Pressione Enter ou vírgula para adicionar">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remover ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
                value={tagText}
                placeholder={tags.length ? '' : 'VIP, barba, indicação...'}
                onChange={(e) => setTagText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagText);
                  } else if (e.key === 'Backspace' && !tagText && tags.length) setTags(tags.slice(0, -1));
                }}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {suggestions.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent">
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Observações">
            <Textarea rows={3} {...register('notes')} placeholder="Preferências, alergias, estilo de corte..." />
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Controller
              control={control}
              name="marketingOptIn"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /> Aceita receber mensagens e promoções
                </Label>
              )}
            />
            <Controller
              control={control}
              name="blocked"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal text-red-700">
                  <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} /> Bloqueado para agendamento online
                </Label>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={mut.isPending}>
              {editing ? 'Salvar alterações' : 'Cadastrar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ClientFormDialog;
