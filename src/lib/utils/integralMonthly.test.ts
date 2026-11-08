import { describe, expect, it } from 'vitest';
import { integralMonthlyBreakdown } from './integralMonthly';
import type { IntegralStudentBlock } from '@/lib/services/integralReportService';

const rec = (date: string, status: string) => ({ date, arrivalTime: '07:50', departureTime: null, status });

const block = {
  manana: {
    records: [
      rec('2026-03-02', 'A_tiempo'),
      rec('2026-03-03', 'Tarde'),
      rec('2026-03-04', 'Injustificada'),
      rec('2026-04-01', 'Tarde_justificada'),
      rec('2026-04-02', 'Inasistencia_justificada'),
    ],
  },
  tarde: { records: [rec('2026-04-01', 'A_tiempo')] },
  incidents: [{ registeredAt: '2026-04-10T15:00:00' }],
} as unknown as IntegralStudentBlock;

describe('integralMonthlyBreakdown', () => {
  it('agrupa por mes con las mismas reglas del resumen', () => {
    const rows = integralMonthlyBreakdown(block, '2026-03-01', '2026-05-15');
    expect(rows.map((r) => r.label)).toEqual(['Marzo 2026', 'Abril 2026', 'Mayo 2026']);
    expect(rows[0]).toMatchObject({ asistencias: 2, tardanzas: 1, faltas: 1, asistenciasTarde: 0, incidencias: 0 });
    expect(rows[1]).toMatchObject({ asistencias: 1, tardanzas: 0, faltas: 1, asistenciasTarde: 1, incidencias: 1 });
    expect(rows[2]).toMatchObject({ asistencias: 0, faltas: 0 });
  });
});
