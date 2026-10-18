import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, num } from '@/lib/utils/format';

/** Paleta categórica (ordem fixa, validada para daltonismo) */
export const CHART_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
/** Cor primária (âmbar) para séries únicas */
export const PRIMARY = '#f59e0b';
export const POSITIVE = '#059669';
export const NEGATIVE = '#dc2626';
export const AXIS = '#9ca3af';
export const GRID = '#eef0f3';

export const colorAt = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

export const compactMoney = (v: number) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1000) return `R$ ${num(n / 1000, 1)}k`;
  return `R$ ${num(n)}`;
};

type Fmt = (v: number) => string;

/** Tooltip padronizado em pt-BR */
export function ChartTooltip({ active, payload, label, formatter = money, labelFormatter }: { active?: boolean; payload?: any[]; label?: any; formatter?: Fmt; labelFormatter?: (l: any) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== '' && <div className="mb-1 font-medium text-foreground">{labelFormatter ? labelFormatter(label) : label}</div>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill || p.fill }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">{formatter(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartEmpty({ height = 240, text = 'Sem dados no período' }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground" style={{ height }}>
      {text}
    </div>
  );
}

/** Série temporal (área) com uma ou mais séries */
export function TimeAreaChart<T extends Record<string, any>>({ data, xKey, series, height = 260, formatter = money, yFormatter = compactMoney, xFormatter }: { data: T[]; xKey: keyof T & string; series: { key: keyof T & string; name: string; color?: string }[]; height?: number; formatter?: Fmt; yFormatter?: Fmt; xFormatter?: (v: any) => string }) {
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? (series.length === 1 ? PRIMARY : colorAt(i))} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color ?? (series.length === 1 ? PRIMARY : colorAt(i))} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={xFormatter} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickFormatter={yFormatter} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={64} />
        <Tooltip content={<ChartTooltip formatter={formatter} labelFormatter={xFormatter} />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => {
          const c = s.color ?? (series.length === 1 ? PRIMARY : colorAt(i));
          return <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={c} strokeWidth={2} fill={`url(#grad-${s.key})`} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />;
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Rosca com legenda lateral */
export function DonutChart({ data, height = 220, formatter = money }: { data: { name: string; value: number; color?: string }[]; height?: number; formatter?: Fmt }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) return <ChartEmpty height={height} />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={1.5} stroke="#fff" strokeWidth={2}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? colorAt(i)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={formatter} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-bold">{formatter(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? colorAt(i) }} />
            <span className="truncate text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{formatter(d.value)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{num((d.value / total) * 100, 0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais simples (ranking) */
export function HBarList({ data, formatter = money, color = PRIMARY, sub }: { data: { name: string; value: number; color?: string | null }[]; formatter?: Fmt; color?: string; sub?: (d: any, i: number) => React.ReactNode }) {
  if (!data.length) return <ChartEmpty height={160} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={`${d.name}-${i}`} className="space-y-1" title={`${d.name}: ${formatter(d.value)}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{d.name}</span>
            <span className="shrink-0 font-medium tabular-nums">{formatter(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color || color }} />
          </div>
          {sub && <div className="text-xs text-muted-foreground">{sub(d, i)}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Colunas verticais (uma ou mais séries) */
export function ColumnChart<T extends Record<string, any>>({ data, xKey, series, height = 240, formatter = (v: number) => num(v), yFormatter = (v: number) => num(v), stacked, xFormatter }: { data: T[]; xKey: keyof T & string; series: { key: keyof T & string; name: string; color?: string }[]; height?: number; formatter?: Fmt; yFormatter?: Fmt; stacked?: boolean; xFormatter?: (v: any) => string }) {
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={xFormatter} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={yFormatter} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTooltip formatter={formatter} labelFormatter={xFormatter} />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? (series.length === 1 ? PRIMARY : colorAt(i))} stackId={stacked ? 'a' : undefined} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} maxBarSize={40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
