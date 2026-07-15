import { Student, User, UserRole } from '@/types';
import { studentsService } from './studentsService';

export function parseStudentIdsFromGrados(gradosAsignados: unknown): number[] {
  if (gradosAsignados == null) return [];

  if (typeof gradosAsignados === 'string') {
    try {
      return parseStudentIdsFromGrados(JSON.parse(gradosAsignados));
    } catch {
      return [];
    }
  }

  if (typeof gradosAsignados === 'object' && !Array.isArray(gradosAsignados)) {
    const obj = gradosAsignados as Record<string, unknown>;
    const raw = obj.studentIds ?? obj.estudiantes ?? obj.ids ?? obj.id_estudiantes;
    if (Array.isArray(raw)) {
      return raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? [n] : [];
    }
  }

  if (Array.isArray(gradosAsignados)) {
    if (gradosAsignados.every((v) => typeof v === 'number')) {
      return gradosAsignados as number[];
    }
    const nums = gradosAsignados.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length > 0) return nums;
  }

  return [];
}

async function fetchByStudentIds(ids: number[]): Promise<Student[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const results = await Promise.all(unique.map((id) => studentsService.getById(id)));
  return results
    .map(({ student }) => student)
    .filter((student): student is Student => Boolean(student?.active));
}

/**
 * Estudiantes vinculados al usuario (padre o personal en modo prueba).
 */
export const parentPortalService = {
  parseStudentIdsFromGrados,

  async getLinkedStudents(user: User): Promise<{ students: Student[]; error: string | null }> {
    try {
      if (user.role === 'Padre') {
        const ids = parseStudentIdsFromGrados(user.gradosAsignados);
        if (ids.length > 0) {
          const students = await fetchByStudentIds(ids);
          if (students.length > 0) {
            return { students, error: null };
          }
        }

        const { students, error } = await studentsService.getLinkedForParent();
        if (students.length > 0) {
          return { students, error: null };
        }

        return {
          students: [],
          error:
            error ||
            (ids.length > 0
              ? 'No se pudieron cargar los estudiantes vinculados.'
              : 'Su cuenta no está vinculada a ningún estudiante. Contacte a la institución.'),
        };
      }

      const staffRoles: UserRole[] = ['Admin', 'Director', 'Supervisor'];
      if (staffRoles.includes(user.role)) {
        return studentsService.getAll({ active: true, page: 1, pageSize: 80 });
      }

      return { students: [], error: 'No tiene acceso al portal de padres.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar estudiantes';
      return { students: [], error: message };
    }
  },
};
