import { describe, expect, it } from 'vitest';
import {
  buildSectionKey,
  getStudentScheduleStatus,
  isInicialStudent,
  parseSectionScheduleConfig,
} from './sectionSchedule';

describe('sectionSchedule', () => {
  it('detecta clave de sección', () => {
    expect(buildSectionKey('Secundaria', "5º", 'A')).toBe("Secundaria|5º|A");
  });

  it('usa salida de inicial al mediodía', () => {
    const student = {
      level: 'Primaria' as const,
      grade: '4 años',
      section: 'A',
    };
    expect(isInicialStudent(student)).toBe(true);
    const status = getStudentScheduleStatus(student, undefined, '12:00');
    expect(status.phase).toBe('exit');
    expect(status.isInicial).toBe(true);
  });

  it('marca en clases a las 10:00 para secundaria', () => {
    const student = {
      level: 'Secundaria' as const,
      grade: "5º",
      section: 'A',
    };
    const status = getStudentScheduleStatus(student, undefined, '10:00');
    expect(status.phase).toBe('in_class');
    expect(status.shouldBeAtSchool).toBe(true);
  });

  it('parsea config JSON', () => {
    const cfg = parseSectionScheduleConfig(
      JSON.stringify({
        sections: {
          'Secundaria|5|A': { salidaInicio: '14:30', salidaFin: '15:00' },
        },
      })
    );
    expect(cfg.sections['Secundaria|5|A']?.salidaInicio).toBe('14:30');
  });
});
