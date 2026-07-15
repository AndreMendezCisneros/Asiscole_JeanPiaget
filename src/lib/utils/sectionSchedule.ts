import type { EducationalLevel, Student } from '@/types';
import { getLimaNow } from '@/lib/utils/limaDateTime';

export type SchedulePhase =
  | 'before_entry'
  | 'entry'
  | 'in_class'
  | 'exit'
  | 'after_school'
  | 'extracurricular';

export interface SectionScheduleSlot {
  entradaInicio: string;
  entradaFin: string;
  salidaInicio: string;
  salidaFin: string;
  /** Ventana extracurricular opcional (talleres) */
  tallerInicio?: string;
  tallerFin?: string;
  notas?: string;
}

export interface SectionScheduleConfig {
  defaults: SectionScheduleSlot;
  inicial: Pick<SectionScheduleSlot, 'salidaInicio' | 'salidaFin' | 'notas'>;
  sections: Record<string, Partial<SectionScheduleSlot>>;
}

export interface StudentScheduleStatus {
  slot: SectionScheduleSlot;
  phase: SchedulePhase;
  phaseLabel: string;
  shouldBeAtSchool: boolean;
  sectionKey: string;
  isInicial: boolean;
  summary: string;
}

export const DEFAULT_SECTION_SCHEDULE: SectionScheduleConfig = {
  defaults: {
    entradaInicio: '06:30',
    entradaFin: '08:45',
    salidaInicio: '14:00',
    salidaFin: '15:30',
    tallerInicio: '15:30',
    tallerFin: '18:00',
    notas: 'Horario regular Primaria / Secundaria',
  },
  inicial: {
    salidaInicio: '11:45',
    salidaFin: '12:15',
    notas: 'Inicial — salida al mediodía',
  },
  sections: {},
};

const CONFIG_KEY = 'horarios_por_seccion';

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function isBetween(nowMin: number, start: string, end: string): boolean {
  return nowMin >= parseHHMM(start) && nowMin <= parseHHMM(end);
}

export function buildSectionKey(level: EducationalLevel | string, grade: string, section: string): string {
  return `${level}|${grade.trim()}|${section.trim().toUpperCase()}`;
}

/** Detecta estudiantes de Inicial por grado o nivel. */
export function isInicialStudent(student: Pick<Student, 'grade' | 'level'>): boolean {
  const g = student.grade.toLowerCase();
  if (g.includes('inicial') || g.includes('años') || g.includes('anos')) return true;
  if (/^[345]\s/.test(g) && !g.includes('º') && !g.includes('°')) return true;
  return false;
}

export function parseSectionScheduleConfig(raw: string | null | undefined): SectionScheduleConfig {
  if (!raw?.trim()) return DEFAULT_SECTION_SCHEDULE;
  try {
    const parsed = JSON.parse(raw) as Partial<SectionScheduleConfig>;
    return {
      defaults: { ...DEFAULT_SECTION_SCHEDULE.defaults, ...parsed.defaults },
      inicial: { ...DEFAULT_SECTION_SCHEDULE.inicial, ...parsed.inicial },
      sections: parsed.sections ?? {},
    };
  } catch {
    return DEFAULT_SECTION_SCHEDULE;
  }
}

export function resolveSlotForStudent(
  student: Pick<Student, 'level' | 'grade' | 'section'>,
  config: SectionScheduleConfig = DEFAULT_SECTION_SCHEDULE
): SectionScheduleSlot {
  const key = buildSectionKey(student.level, student.grade, student.section);
  const override = config.sections[key] ?? {};
  const base = { ...config.defaults, ...override };

  if (isInicialStudent(student)) {
    return {
      ...base,
      salidaInicio: override.salidaInicio ?? config.inicial.salidaInicio,
      salidaFin: override.salidaFin ?? config.inicial.salidaFin,
      notas: override.notas ?? config.inicial.notas ?? base.notas,
    };
  }

  return base;
}

export function getStudentScheduleStatus(
  student: Pick<Student, 'level' | 'grade' | 'section'>,
  config?: SectionScheduleConfig,
  nowHHMM?: string
): StudentScheduleStatus {
  const slot = resolveSlotForStudent(student, config);
  const now = nowHHMM ?? getLimaNow().time;
  const nowMin = parseHHMM(now.slice(0, 5));
  const inicial = isInicialStudent(student);
  const sectionKey = buildSectionKey(student.level, student.grade, student.section);

  let phase: SchedulePhase = 'after_school';
  let phaseLabel = 'Fuera de jornada';
  let shouldBeAtSchool = false;

  if (isBetween(nowMin, slot.entradaInicio, slot.entradaFin)) {
    phase = 'entry';
    phaseLabel = 'Ventana de entrada';
    shouldBeAtSchool = true;
  } else if (nowMin > parseHHMM(slot.entradaFin) && nowMin < parseHHMM(slot.salidaInicio)) {
    phase = 'in_class';
    phaseLabel = 'En clases';
    shouldBeAtSchool = true;
  } else if (isBetween(nowMin, slot.salidaInicio, slot.salidaFin)) {
    phase = 'exit';
    phaseLabel = inicial ? 'Salida Inicial' : 'Salida regular';
    shouldBeAtSchool = true;
  } else if (
    slot.tallerInicio &&
    slot.tallerFin &&
    isBetween(nowMin, slot.tallerInicio, slot.tallerFin)
  ) {
    phase = 'extracurricular';
    phaseLabel = 'Taller / extracurricular';
    shouldBeAtSchool = true;
  } else if (nowMin < parseHHMM(slot.entradaInicio)) {
    phase = 'before_entry';
    phaseLabel = 'Antes de entrada';
    shouldBeAtSchool = false;
  }

  const summary = inicial
    ? `Inicial · Entrada ${slot.entradaInicio}–${slot.entradaFin} · Salida ${slot.salidaInicio}–${slot.salidaFin}`
    : `${student.level} ${student.grade} '${student.section}' · Entrada ${slot.entradaInicio}–${slot.entradaFin} · Salida ${slot.salidaInicio}–${slot.salidaFin}`;

  return {
    slot,
    phase,
    phaseLabel,
    shouldBeAtSchool,
    sectionKey,
    isInicial: inicial,
    summary,
  };
}

export { CONFIG_KEY as SECTION_SCHEDULE_CONFIG_KEY };
