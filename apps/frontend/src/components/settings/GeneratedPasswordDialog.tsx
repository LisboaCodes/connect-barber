import { Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogFooter } from '@/components/ui';

/** Exibe a senha gerada pelo backend ao criar um acesso (mostrada uma única vez) */
export function GeneratedPasswordDialog({ password, email, onClose }: { password: string | null; email?: string | null; onClose: () => void }) {
  const copy = () => {
    const text = email ? `Login: ${email}\nSenha: ${password}` : String(password);
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Copiado'),
      () => toast.error('Não foi possível copiar'),
    );
  };
  return (
    <Dialog open={!!password} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" title="Acesso criado" description="Anote ou envie estes dados agora: a senha não será exibida novamente.">
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          {email && (
            <div>
              <div className="text-xs text-muted-foreground">Login</div>
              <div className="font-medium">{email}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Senha provisória</div>
            <div className="flex items-center gap-2 font-mono text-lg font-semibold">
              <KeyRound className="h-4 w-4 text-primary" /> {password}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy /> Copiar
          </Button>
          <Button onClick={onClose}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GeneratedPasswordDialog;
