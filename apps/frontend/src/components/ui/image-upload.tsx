import { useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { errorMessage } from '@/lib/api/client';
import { mediaApi } from '@/lib/api/media';
import { Button } from './button';
import { Input } from './input';

/** Botão que abre o seletor de arquivos, envia as imagens e devolve as URLs públicas. */
export function UploadButton({
  onUploaded,
  multiple = false,
  maxDim = 1600,
  disabled,
  children,
  variant = 'outline',
  size,
  className,
}: {
  onUploaded: (urls: string[]) => void;
  multiple?: boolean;
  maxDim?: number;
  disabled?: boolean;
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    setBusy(true);
    const urls: string[] = [];
    let failed = 0;
    for (const f of list) {
      try {
        const m = await mediaApi.upload(f, maxDim);
        urls.push(m.url);
      } catch (e) {
        failed++;
        toast.error(`${f.name}: ${errorMessage(e, 'não foi possível enviar')}`);
      }
    }
    setBusy(false);
    if (ref.current) ref.current.value = '';
    if (urls.length) {
      onUploaded(urls);
      if (list.length > 1) toast.success(`${urls.length} foto(s) enviada(s)${failed ? `, ${failed} com erro` : ''}`);
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => handle(e.target.files)} />
      <Button type="button" variant={variant} size={size} loading={busy} disabled={disabled} className={className} onClick={() => ref.current?.click()}>
        {children ?? (
          <>
            <Upload /> {multiple ? 'Enviar fotos' : 'Enviar imagem'}
          </>
        )}
      </Button>
    </>
  );
}

/**
 * Campo de imagem única: pré-visualização + enviar do aparelho + opção de colar um link.
 * `value` é a URL atual ('' quando vazio).
 */
export function ImageUpload({
  value,
  onChange,
  shape = 'square',
  maxDim,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  shape?: 'square' | 'circle' | 'wide';
  maxDim?: number;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');
  const dim = maxDim ?? (shape === 'wide' ? 1600 : 800);

  const box = {
    square: 'h-20 w-20 rounded-lg',
    circle: 'h-20 w-20 rounded-full',
    wide: 'h-20 w-40 rounded-lg',
  }[shape];

  const applyLink = () => {
    const v = link.trim();
    if (!/^https?:\/\/.+/i.test(v)) return toast.error('Informe um link válido (https://...)');
    onChange(v);
    setLink('');
    setLinkMode(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground', box)}>
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : placeholder ?? <ImagePlus className="h-6 w-6 opacity-60" />}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <UploadButton size="sm" maxDim={dim} disabled={disabled} onUploaded={(urls) => onChange(urls[0])}>
            <Upload /> {value ? 'Trocar' : 'Enviar imagem'}
          </UploadButton>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setLinkMode((v) => !v)} aria-label="Usar link">
            <Link2 /> Link
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')} aria-label="Remover imagem">
              <Trash2 /> Remover
            </Button>
          )}
        </div>
      </div>
      {linkMode && (
        <div className="flex gap-2">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={applyLink}>
            Usar
          </Button>
        </div>
      )}
    </div>
  );
}
