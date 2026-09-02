import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v
  const d = parseISO(v)
  return isValid(d) ? d : new Date(v)
}

export function formatTime(v: string | Date): string {
  return format(toDate(v), 'HH:mm', { locale: ru })
}

export function formatDate(v: string | Date): string {
  return format(toDate(v), 'dd.MM.yyyy', { locale: ru })
}

export function formatDateTime(v: string | Date): string {
  return format(toDate(v), 'dd MMM yyyy, HH:mm', { locale: ru })
}

export function formatExpiry(v: string | Date): string {
  return formatTime(v)
}

export function formatRelative(v: string | Date): string {
  return formatDistanceToNow(toDate(v), { addSuffix: true, locale: ru })
}
