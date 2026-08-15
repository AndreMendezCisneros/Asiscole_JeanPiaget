import type { Student } from '@/types';
import { studentsService } from '@/lib/services';

/** Nómina activa completa (con respaldo paginado si fetchAll no trae todo). */
export async function loadActiveNomina(): Promise<{ students: Student[]; error: string | null }> {
  const first = await studentsService.getAll({ active: true, fetchAll: true });
  if (!first.error && first.students.length >= 20) {
    return { students: first.students, error: null };
  }

  const pageSize = 100;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  const all: Student[] = [];
  let lastError: string | null = first.error;

  while (all.length < total && page <= 50) {
    const res = await studentsService.getAll({ active: true, page, pageSize });
    if (res.error) {
      lastError = res.error;
      break;
    }
    all.push(...res.students);
    total = res.total || all.length;
    if (res.students.length === 0) break;
    page += 1;
  }

  if (all.length > 0) return { students: all, error: null };
  if (!first.error && first.students.length > 0) {
    return { students: first.students, error: null };
  }
  return { students: [], error: lastError || 'Nómina vacía' };
}

export function sortNominaByName(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}
