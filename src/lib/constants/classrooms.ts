import type { EducationalLevel } from '@/types';

export const CLASSROOM_GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'] as const;
export const CLASSROOM_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const CLASSROOM_LEVELS: EducationalLevel[] = ['Primaria', 'Secundaria'];

/** Etiquetas de UI de colegio. Las columnas SQL siguen siendo nivel_educativo / grado / seccion. */
export const CLASSROOM_FIELD_LABELS = {
  level: 'Nivel educativo',
  grade: 'Grado',
  section: 'Sección',
  levelGrade: 'Nivel / Grado',
  allLevels: 'Todos los niveles',
  allGrades: 'Todos los grados',
  allSections: 'Todas las secciones',
} as const;

export type ClassroomGrade = (typeof CLASSROOM_GRADES)[number];
export type ClassroomSection = (typeof CLASSROOM_SECTIONS)[number];
