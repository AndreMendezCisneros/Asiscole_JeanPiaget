import type { DocenteAssignments, DocenteClassroom, EducationalLevel } from '@/types';

export function parseDocenteAssignments(raw: unknown): DocenteAssignments {
  if (!raw || typeof raw !== 'object') {
    return { classrooms: [] };
  }
  const payload = raw as { classrooms?: unknown };
  if (!Array.isArray(payload.classrooms)) {
    return { classrooms: [] };
  }
  const classrooms = payload.classrooms
    .filter((item): item is DocenteClassroom => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return (
        typeof row.level === 'string' &&
        typeof row.grade === 'string' &&
        typeof row.section === 'string'
      );
    })
    .map((item) => ({
      level: item.level as EducationalLevel,
      grade: item.grade.trim(),
      section: item.section.trim(),
    }));
  return { classrooms };
}

export function formatClassroomLabel(classroom: DocenteClassroom): string {
  return `${classroom.level} ${classroom.grade} - ${classroom.section}`;
}

export function serializeDocenteAssignments(classrooms: DocenteClassroom[]): DocenteAssignments {
  return { classrooms };
}
