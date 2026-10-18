import { useEffect, useState } from 'react';
import { Button, Section } from '@/components/ui';
import { WeekScheduleEditor, validateWeek, weekFromRecord, weekToRecord, type WeekRanges } from '@/components/professionals/WeekScheduleEditor';
import { useUpdateTenant, type Tenant } from '@/lib/api/tenant';

const DEFAULT: WeekRanges = [[], ...Array.from({ length: 5 }, () => [{ start: '09:00', end: '19:00' }]), [{ start: '09:00', end: '17:00' }]];

export function OpeningHoursForm({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant('Horário de funcionamento salvo');
  const initial = () => (tenant.openingHours && Object.keys(tenant.openingHours).length ? weekFromRecord(tenant.openingHours) : DEFAULT.map((d) => d.map((r) => ({ ...r }))));
  const [week, setWeek] = useState<WeekRanges>(initial);
  const [dirty, setDirty] = useState(!tenant.openingHours);

  useEffect(() => {
    setWeek(initial());
    setDirty(!tenant.openingHours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.openingHours]);

  const error = validateWeek(week);

  return (
    <Section
      title="Horário de funcionamento"
      description="Horário em que a barbearia está aberta. A agenda de cada profissional é configurada em Profissionais › Jornada."
    >
      <WeekScheduleEditor
        value={week}
        onChange={(w) => {
          setWeek(w);
          setDirty(true);
        }}
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button loading={update.isPending} disabled={!!error || !dirty} onClick={() => update.mutate({ openingHours: weekToRecord(week) }, { onSuccess: () => setDirty(false) })}>
          Salvar horário
        </Button>
      </div>
    </Section>
  );
}

export default OpeningHoursForm;
