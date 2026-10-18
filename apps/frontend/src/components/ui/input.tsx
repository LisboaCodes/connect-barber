import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, prefix, suffix, ...props }, ref) => {
  const base =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
  if (!prefix && !suffix) return <input type={type} className={cn(base, className)} ref={ref} {...props} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {prefix && <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">{prefix}</span>}
      <input type={type} className={cn(base, prefix && 'pl-9', suffix && 'pr-9')} ref={ref} {...props} />
      {suffix && <span className="absolute right-3 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
});
Input.displayName = 'Input';

/** Input de dinheiro (R$) controlado por número */
export function MoneyInput({ value, onChange, className, ...props }: Omit<InputProps, 'value' | 'onChange' | 'prefix'> & { value: number | '' | undefined; onChange: (v: number) => void }) {
  const [text, setText] = React.useState(value === '' || value === undefined ? '' : String(value).replace('.', ','));
  React.useEffect(() => {
    const n = value === '' || value === undefined ? '' : String(value).replace('.', ',');
    if (Number(n.replace(',', '.')) !== Number(text.replace(',', '.'))) setText(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      inputMode="decimal"
      prefix="R$"
      className={className}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d,.-]/g, '');
        setText(t);
        const n = Number(t.replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number(text.replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(n)) setText(n.toFixed(2).replace('.', ','));
      }}
      {...props}
    />
  );
}

export { Input };
