/**
 * Colores de los gráficos de tardanzas.
 * Niveles: paleta categórica validada (orden fijo, un color por nivel aunque falte alguno).
 * Retraso: escala secuencial de un solo tono (--late-*).
 */
export const LEVEL_COLORS: Record<string, string> = {
  Inicial: '#13968b',
  Primaria: '#2f63b8',
  Secundaria: '#d4920d',
};

export const LEVEL_FALLBACK_COLOR = 'hsl(215 14% 58%)';

export const JUSTIFICATION_COLORS = {
  pending: 'hsl(var(--late-4))',
  justified: '#2f63b8',
} as const;

export const DELAY_COLORS = ['hsl(var(--late-2))', 'hsl(var(--late-3))', 'hsl(var(--late-4))', 'hsl(var(--late-5))'];

/** Estados de llegada de un alumno (Reporte integral). */
export const ARRIVAL_STATUS_COLORS = {
  onTime: 'hsl(142 45% 38%)',
  late: 'hsl(var(--late-4))',
  lateJustified: 'hsl(var(--late-2))',
  absent: 'hsl(215 14% 62%)',
} as const;
