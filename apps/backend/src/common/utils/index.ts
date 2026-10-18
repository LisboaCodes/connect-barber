import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addMinutes, format, parse } from 'date-fns';
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

export const DEFAULT_TZ = 'America/Sao_Paulo';

// ---------- Dinheiro ----------
export const D = (v: number | string | Prisma.Decimal | null | undefined) =>
  new Prisma.Decimal(v ?? 0);
export const money = (v: number | string | Prisma.Decimal | null | undefined): number =>
  Math.round(Number(v ?? 0) * 100) / 100;
export const pct = (base: number, p: number) => money((base * p) / 100);

// ---------- Datas / fuso ----------
/** "2026-10-18" + "09:30" no fuso da barbearia -> Date UTC */
export function localToUtc(dateStr: string, timeStr: string, tz = DEFAULT_TZ): Date {
  return zonedTimeToUtc(`${dateStr}T${timeStr}:00`, tz);
}
/** Date UTC -> "HH:mm" no fuso */
export function toLocalTime(d: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(d, tz, 'HH:mm');
}
/** Date UTC -> "yyyy-MM-dd" no fuso */
export function toLocalDate(d: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(d, tz, 'yyyy-MM-dd');
}
/** Dia da semana (0=domingo) no fuso */
export function localWeekday(d: Date, tz = DEFAULT_TZ): number {
  return utcToZonedTime(d, tz).getDay();
}
/** Início e fim (UTC) de um dia local "yyyy-MM-dd" */
export function localDayRange(dateStr: string, tz = DEFAULT_TZ): { start: Date; end: Date } {
  const start = zonedTimeToUtc(`${dateStr}T00:00:00`, tz);
  const end = zonedTimeToUtc(`${dateStr}T23:59:59.999`, tz);
  return { start, end };
}
export function nowLocalDate(tz = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}
export function parseDateOnly(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException(`Data inválida: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}
export function dateOnlyStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** "09:30" -> minutos desde 00:00 */
export function timeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m) throw new BadRequestException(`Horário inválido: ${t}`);
  return Number(m[1]) * 60 + Number(m[2]);
}
export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export { addMinutes, format, parse };

// ---------- Strings ----------
export function slugify(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
export function onlyDigits(s?: string | null): string | null {
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  return d || null;
}
/** Normaliza telefone BR para E.164 sem '+', ex.: 5511999999999 */
export function normalizePhone(s?: string | null): string | null {
  const d = onlyDigits(s);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}
export function randomToken(len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  const bytes = require('crypto').randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
export function sha256(s: string): string {
  return require('crypto').createHash('sha256').update(s).digest('hex');
}

// ---------- Paginação ----------
export interface PageQuery {
  page?: number | string;
  limit?: number | string;
}
export function paging(q: PageQuery, defaultLimit = 20, max = 200) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(max, Math.max(1, Number(q.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
export function paged<T>(items: T[], total: number, p: { page: number; limit: number }) {
  return { items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) };
}
