import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';

/** Arquivo recebido pelo multer (tipagem mínima para não depender de @types/multer) */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB por arquivo
const TENANT_QUOTA = 300 * 1024 * 1024; // 300 MB por barbearia
const USER_QUOTA = 20 * 1024 * 1024; // 20 MB para usuário sem barbearia (cliente final)

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Detecta o tipo real pelos primeiros bytes (não confia só no mimetype informado) */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  return null;
}

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(file: UploadedImage | undefined, owner: { tenantId?: string; userId: string }) {
    if (!file || !file.buffer?.length) throw new BadRequestException('Envie uma imagem');
    if (file.size > MAX_IMAGE_BYTES) throw new PayloadTooLargeException('Imagem maior que 5 MB');
    const mime = sniff(file.buffer);
    if (!mime || !ALLOWED.has(mime)) throw new BadRequestException('Formato não suportado. Use JPG, PNG, WEBP ou GIF.');

    const where = owner.tenantId ? { tenantId: owner.tenantId } : { userId: owner.userId, tenantId: null };
    const used = await this.prisma.mediaFile.aggregate({ where, _sum: { size: true } });
    const quota = owner.tenantId ? TENANT_QUOTA : USER_QUOTA;
    if ((used._sum.size ?? 0) + file.size > quota) {
      throw new PayloadTooLargeException('Espaço para imagens esgotado. Remova fotos antigas.');
    }

    return this.prisma.mediaFile.create({
      data: { tenantId: owner.tenantId ?? null, userId: owner.userId, mime, size: file.size, data: file.buffer },
      select: { id: true, mime: true, size: true },
    });
  }

  async get(id: string) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Imagem não encontrada');
    return media;
  }

  async remove(id: string, owner: { tenantId?: string; userId: string; isSuperAdmin?: boolean }) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id }, select: { id: true, tenantId: true, userId: true } });
    if (!media) return { ok: true };
    const allowed =
      owner.isSuperAdmin ||
      (media.tenantId && media.tenantId === owner.tenantId) ||
      (!media.tenantId && media.userId === owner.userId);
    if (!allowed) throw new NotFoundException('Imagem não encontrada');
    await this.prisma.mediaFile.delete({ where: { id } });
    return { ok: true };
  }

  /** URL pública absoluta da imagem (a API fica em outro host do site, então precisa ser absoluta) */
  publicUrl(id: string, req: { protocol: string; get(name: string): string | undefined }) {
    const base = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    return `${base}/api/media/${id}`;
  }
}
