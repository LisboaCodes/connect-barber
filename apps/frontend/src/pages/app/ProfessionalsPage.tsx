import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Globe, KeyRound, MoreVertical, Pencil, Plus, Power, Scissors, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import { ProfessionalFormDialog } from '@/components/professionals/ProfessionalFormDialog';
import { ProfessionalScheduleDialog } from '@/components/professionals/ProfessionalScheduleDialog';
import { GeneratedPasswordDialog } from '@/components/settings/GeneratedPasswordDialog';
import { errorMessage } from '@/lib/api/client';
import { professionalsApi, type Professional } from '@/lib/api/professionals';
import { WEEKDAYS_SHORT, fmtPhone, pct } from '@/lib/utils/format';
import { useAuthStore, useIsManager } from '@/store/auth.store';

function scheduleSummary(p: Professional) {
  const days = [...new Set(p.workSchedules.map((w) => w.weekday))].sort();
  if (!days.length) return 'Sem jornada definida';
  return days
    .map((d) => {
      const r = p.workSchedules.filter((w) => w.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return `${WEEKDAYS_SHORT[d]} ${r[0].startTime}–${r[r.length - 1].endTime}`;
    })
    .join(' · ');
}

export default function ProfessionalsPage() {
  const qc = useQueryClient();
  const isManager = useIsManager();
  const myProfessionalId = useAuthStore((s) => s.current?.professionalId ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Professional | null>(null);
  const [removing, setRemoving] = useState<Professional | null>(null);
  const [password, setPassword] = useState<{ password: string; email: string | null } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['professionals', 'all'], queryFn: () => professionalsApi.list(true) });

  const toggleActive = useMutation({
    mutationFn: (p: Professional) => professionalsApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: (p) => {
      toast.success(p.isActive ? 'Profissional ativado' : 'Profissional desativado');
      qc.invalidateQueries({ queryKey: ['professionals'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (p: Professional) => professionalsApi.remove(p.id),
    onSuccess: () => {
      toast.success('Profissional removido');
      qc.invalidateQueries({ queryKey: ['professionals'] });
      setRemoving(null);
    },
    onError: (e) => {
      toast.error(errorMessage(e), { duration: 8000 });
      setRemoving(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (p: Professional) => {
    setEditing(p);
    setFormOpen(true);
  };

  const list = data ?? [];
  const active = list.filter((p) => p.isActive);
  const inactive = list.filter((p) => !p.isActive);

  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Equipe, comissões, serviços e jornada de trabalho"
        actions={
          isManager && (
            <Button onClick={openCreate}>
              <Plus /> Novo profissional
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !list.length ? (
        <EmptyState icon={UserCog} title="Nenhum profissional cadastrado" description="Cadastre os barbeiros da sua equipe para começar a agendar." action={isManager && <Button onClick={openCreate}><Plus /> Novo profissional</Button>} />
      ) : (
        <div className="space-y-8">
          <Grid
            items={active}
            isManager={isManager}
            myProfessionalId={myProfessionalId}
            onEdit={openEdit}
            onSchedule={setScheduleFor}
            onToggle={(p) => toggleActive.mutate(p)}
            onRemove={setRemoving}
          />
          {inactive.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inativos ({inactive.length})</h2>
              <Grid
                items={inactive}
                isManager={isManager}
                myProfessionalId={myProfessionalId}
                onEdit={openEdit}
                onSchedule={setScheduleFor}
                onToggle={(p) => toggleActive.mutate(p)}
                onRemove={setRemoving}
              />
            </div>
          )}
        </div>
      )}

      <ProfessionalFormDialog open={formOpen} onOpenChange={setFormOpen} professional={editing} count={list.length} onPassword={(pw, email) => setPassword({ password: pw, email })} />
      <ProfessionalScheduleDialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)} professional={scheduleFor} />
      <GeneratedPasswordDialog password={password?.password ?? null} email={password?.email} onClose={() => setPassword(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remover ${removing?.name ?? ''}?`}
        description="O profissional sai da agenda e o acesso ao sistema é desativado. Não é possível remover quem tem agendamentos futuros."
        confirmText="Remover"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing);
        }}
      />
    </div>
  );
}

function Grid({
  items,
  isManager,
  myProfessionalId,
  onEdit,
  onSchedule,
  onToggle,
  onRemove,
}: {
  items: Professional[];
  isManager: boolean;
  myProfessionalId: string | null;
  onEdit: (p: Professional) => void;
  onSchedule: (p: Professional) => void;
  onToggle: (p: Professional) => void;
  onRemove: (p: Professional) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => {
        const canSchedule = isManager || p.id === myProfessionalId;
        return (
          <Card key={p.id} className={`flex flex-col overflow-hidden ${!p.isActive ? 'opacity-70' : ''}`}>
            <div className="h-1.5" style={{ backgroundColor: p.color }} />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <Avatar src={p.avatarUrl} name={p.name} size="lg" color={p.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.phone ? fmtPhone(p.phone) : p.email ?? 'Sem contato'}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {!p.isActive && <Badge variant="secondary">Inativo</Badge>}
                    {p.membership && (
                      <Badge variant="outline" className="gap-1">
                        <KeyRound className="h-3 w-3" /> Com acesso
                      </Badge>
                    )}
                    {p.acceptsOnlineBooking && p.isActive && (
                      <Badge variant="success" className="gap-1">
                        <Globe className="h-3 w-3" /> Online
                      </Badge>
                    )}
                  </div>
                </div>
                {isManager && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Ações">
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(p)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onSchedule(p)}>
                        <CalendarClock /> Jornada e folgas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggle(p)}>
                        <Power /> {p.isActive ? 'Desativar' : 'Ativar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={() => onRemove(p)}>
                        <Trash2 /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center text-xs">
                <div>
                  <div className="font-semibold">{pct(Number(p.serviceCommissionPct), 0)}</div>
                  <div className="text-muted-foreground">Comissão serv.</div>
                </div>
                <div>
                  <div className="font-semibold">{pct(Number(p.productCommissionPct), 0)}</div>
                  <div className="text-muted-foreground">Comissão prod.</div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 font-semibold">
                    <Scissors className="h-3 w-3" /> {p.services.length || 'Todos'}
                  </div>
                  <div className="text-muted-foreground">Realiza</div>
                </div>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{scheduleSummary(p)}</p>
              {canSchedule && (
                <Button variant="outline" size="sm" className="mt-auto" onClick={() => onSchedule(p)}>
                  <CalendarClock /> Jornada e folgas
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
