import type { EducationalLevel } from '@/types';

/** Pisos de academia (columna BD `grado`). */
export const CLASSROOM_GRADES = [
  '2001',
  '2002',
  '2003',
  '2004',
  '2005',
  '2006',
  '2007',
  '2008',
  '2009',
  '2010',
] as const;

/** Salones (columna BD `seccion`). */
export const CLASSROOM_SECTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export const CLASSROOM_LEVELS: EducationalLevel[] = [
  'Primaria',
  'Secundaria',
  'Pre-universitario',
];

export const CLASSROOM_LEVEL_ORDER: Record<EducationalLevel, number> = {
  Primaria: 0,
  Secundaria: 1,
  'Pre-universitario': 2,
};

/** Etiquetas de UI. Las columnas SQL siguen siendo nivel_educativo / grado / seccion. */
export const CLASSROOM_FIELD_LABELS = {
  level: 'Nivel educativo',
  grade: 'Piso',
  section: 'Salón',
  levelGrade: 'Nivel / Piso',
  allLevels: 'Todos los niveles',
  allGrades: 'Todos los pisos',
  allSections: 'Todos los salones',
} as const;

export type ClassroomGrade = (typeof CLASSROOM_GRADES)[number];
export type ClassroomSection = (typeof CLASSROOM_SECTIONS)[number];
