import type { EstudianteEstadoPension, PensionEstado } from '@/types';

export function periodoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function periodoFromLimaDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function fechaVencimientoForPeriodo(periodo: string, dia: number): string {
  const [ys, ms] = periodo.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const safeDay = Math.min(Math.max(dia, 1), 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Mora: si hoy es el día *siguiente* al vencimiento (hoy > vencimiento) y no pagó → moroso.
 * El día del vencimiento sigue pendiente.
 */
export function estadoTrasImportNoPago(fechaVencimiento: string, hoyLima: string): PensionEstado {
  return hoyLima > fechaVencimiento ? 'moroso' : 'pendiente';
}

/** Recalcula estado textual a partir de pagado 0/1 y fechas. */
export function resolveEstadoPension(input: {
  pagado: 0 | 1;
  fechaVencimiento: string;
  hoyLima: string;
}): PensionEstado {
  if (input.pagado === 1) return 'pagado';
  return estadoTrasImportNoPago(input.fechaVencimiento, input.hoyLima);
}

export function cacheEstadoFromPension(
  estado: PensionEstado | null | undefined,
): EstudianteEstadoPension {
  if (!estado) return 'sin_dato';
  if (estado === 'pagado') return 'al_dia';
  if (estado === 'pendiente') return 'pendiente';
  return 'moroso';
}

export function cacheEstadoFromPagado(
  pagado: 0 | 1 | null | undefined,
  estado: PensionEstado | null | undefined,
): EstudianteEstadoPension {
  if (pagado === 1 || estado === 'pagado') return 'al_dia';
  if (estado === 'pendiente') return 'pendiente';
  if (pagado === 0 || estado === 'moroso') return 'moroso';
  return 'sin_dato';
}
