import { ReincidenceLevel } from '@/types';

export const getReincidenceLevelColor = (level: ReincidenceLevel): string => {
  switch (level) {
    case 0:
      return 'success';
    case 1:
    case 2:
      return 'warning';
    case 3:
    case 4:
    case 5:
      return 'danger';
    default:
      return 'danger';
  }
};

/** Clase CSS semáforo por nivel (0 = verde → 5 = rojo) */
export function getReincidenceLevelPillClass(level: number): string {
  const n = Math.min(5, Math.max(0, Math.round(level)));
  return `app-level-pill app-level-pill--${n}`;
}

/** Color de barra / indicador según nivel (semáforo) */
export function getReincidenceLevelBarColor(level: number): string {
  const colors: Record<number, string> = {
    0: 'hsl(152, 55%, 45%)',
    1: 'hsl(142, 48%, 44%)',
    2: 'hsl(45, 85%, 50%)',
    3: 'hsl(32, 88%, 52%)',
    4: 'hsl(12, 78%, 50%)',
    5: 'hsl(0, 70%, 48%)',
  };
  const n = Math.min(5, Math.max(0, Math.round(level)));
  return colors[n];
}

const LEVEL_SUMMARY_LABELS: Record<ReincidenceLevel, string> = {
  0: 'Sin reincidencia',
  1: 'Primera falta',
  2: 'Moderada',
  3: 'Alta',
  4: 'Crítica',
  5: 'Crítica máxima',
};

export function getReincidenceLevelSummaryLabel(level: ReincidenceLevel): string {
  return LEVEL_SUMMARY_LABELS[level] ?? `Nivel ${level}`;
}

export const REINCIDENCE_LEVELS: ReincidenceLevel[] = [0, 1, 2, 3, 4, 5];

export const getReincidenceLevelLabel = (level: ReincidenceLevel): string => {
  return `Nivel ${level}`;
};

export const getReincidenceLevelDescription = (level: ReincidenceLevel): string => {
  switch (level) {
    case 0:
      return 'Sin reincidencias';
    case 1:
      return 'Primera reincidencia';
    case 2:
      return 'Reincidencia moderada';
    case 3:
      return 'Reincidencia alta - Requiere atención';
    case 4:
      return 'Reincidencia crítica - Acción inmediata';
    case 5:
      return 'Reincidencia crítica máxima - Acción inmediata';
    default:
      return '';
  }
};

export const getSuggestedAction = (level: ReincidenceLevel): string => {
  switch (level) {
    case 0:
      return 'Registro estándar';
    case 1:
      return 'Amonestación verbal';
    case 2:
      return 'Citación a tutor';
    case 3:
      return 'Reunión con padres - Compromiso escrito';
    case 4:
      return 'Medida disciplinaria severa - Director';
    case 5:
      return 'Escalamiento inmediato - Dirección y tutela';
    default:
      return '';
  }
};
