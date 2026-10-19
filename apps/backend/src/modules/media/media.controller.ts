import { Controller, Delete, Get, Param, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types/auth-user';
import { MAX_IMAGE_BYTES, MediaService, UploadedImage } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Envia uma imagem (logo, capa, galeria, avatar). Qualquer usuário logado; fica ligada à barbearia ativa. */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: UploadedImage | undefined, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const media = await this.media.upload(file, { tenantId: user.tenantId, userId: user.sub });
    return { id: media.id, url: this.media.publicUrl(media.id, req), mime: media.mime, size: media.size };
  }

  /** Imagem pública (site, app e painel). Cache longo: o conteúdo de um id nunca muda. */
  @Public()
  @Get(':id')
  async get(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const media = await this.media.get(id);
    const etag = `"${media.id}"`;
    // proxies (Cloudflare) devolvem o ETag fraco: W/"id"
    const inm = String(req.headers['if-none-match'] ?? '').replace(/^W\//, '');
    if (inm === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', media.mime);
    res.setHeader('Content-Length', String(media.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // não devolve o Response: o interceptor global serializa o retorno e entraria em ciclo (req <-> res)
    res.end(media.data);
  }

  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.media.remove(id, { tenantId: user.tenantId, userId: user.sub, isSuperAdmin: user.isSuperAdmin });
  }
}
