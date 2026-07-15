/**
 * Parámetros conocidos del sistema (tabla configuracion_sistema).
 * Solo estas claves tienen efecto en la aplicación.
 */
export const SYSTEM_SETTING_KEYS = {
  /** @deprecated Usar primaria/secundaria; se mantiene como respaldo en BD */
  arrivalLimit: 'hora_limite_llegada',
  arrivalLimitPrimary: 'hora_limite_llegada_primaria',
  arrivalLimitSecondary: 'hora_limite_llegada_secundaria',
  departureLimit: 'hora_limite_salida',
  schoolClose: 'hora_cierre_colegio',
} as const;

export type SystemSettingKey =
  (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS];

export interface SystemSettingDefinition {
  key: SystemSettingKey;
  label: string;
  description: string;
  defaultValue: string;
  /** Valor mostrado en input type="time" (HH:MM) */
  inputType: 'time';
  usedIn: string;
}

export const SYSTEM_SETTINGS: SystemSettingDefinition[] = [
  {
    key: SYSTEM_SETTING_KEYS.arrivalLimitPrimary,
    label: 'Hora límite de llegada — Primaria',
    description:
      'A partir de esta hora el registro de asistencia de estudiantes de Primaria se marca como «Tarde» en el escáner del tutor.',
    defaultValue: '08:00',
    inputType: 'time',
    usedIn: 'Control de llegadas · Escáner del tutor',
  },
  {
    key: SYSTEM_SETTING_KEYS.arrivalLimitSecondary,
    label: 'Hora límite de llegada — Secundaria',
    description:
      'A partir de esta hora el registro de asistencia de estudiantes de Secundaria se marca como «Tarde» en el escáner del tutor.',
    defaultValue: '08:00',
    inputType: 'time',
    usedIn: 'Control de llegadas · Escáner del tutor',
  },
  {
    key: SYSTEM_SETTING_KEYS.departureLimit,
    label: 'Hora límite de salida',
    description:
      'Después de esta hora el sistema alerta sobre estudiantes que llegaron pero no tienen salida registrada.',
    defaultValue: '15:00',
    inputType: 'time',
    usedIn: 'Control de llegadas · Alertas de salida',
  },
  {
    key: SYSTEM_SETTING_KEYS.schoolClose,
    label: 'Hora de cierre del colegio',
    description:
      'A partir de esta hora el escáner muestra el aviso «Fuera de jornada». Antes de esta hora el registro sigue activo (talleres, actividades).',
    defaultValue: '18:00',
    inputType: 'time',
    usedIn: 'Escáner del tutor · Control de llegadas',
  },
];

export function getSettingDefinition(key: string): SystemSettingDefinition | undefined {
  return SYSTEM_SETTINGS.find((s) => s.key === key);
}

/** Convierte valor de configuracion_sistema (texto, TIME, número) a string seguro. */
export function coerceTimeConfigValue(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return String(raw).trim() || fallback;
}

/** Normaliza HH:MM o HH:MM:SS a HH:MM para inputs y servicios */
export function normalizeTimeValue(raw: unknown, fallback: string): string {
  const trimmed = coerceTimeConfigValue(raw, fallback) || fallback;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Guarda en BD como HH:MM:SS (compatible con registros existentes) */
export function toStorageTimeValue(hhmm: string): string {
  const normalized = normalizeTimeValue(hhmm, '08:00');
  return `${normalized}:00`;
}
