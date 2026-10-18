import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

/** Converte Prisma.Decimal em number e remove campos sensíveis em toda resposta */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => serialize(data)));
  }
}

const HIDDEN_FIELDS = new Set(['password', 'tokenHash', 'googleAccessToken', 'googleRefreshToken', 'cpApiKey', 'cpWebhookSecret', 'posAccessToken']);

export function serialize(value: any, depth = 0): any {
  if (value === null || value === undefined || depth > 25) return value;
  if (value instanceof Prisma.Decimal) return Number(value.toString());
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((v) => serialize(v, depth + 1));
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function' && !(value.constructor === Object)) {
      // objetos com toJSON próprio (ex.: streams) ficam como estão
      return value;
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (HIDDEN_FIELDS.has(k)) continue;
      out[k] = serialize(v, depth + 1);
    }
    return out;
  }
  return value;
}
