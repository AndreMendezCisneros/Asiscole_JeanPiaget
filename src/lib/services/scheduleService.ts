import type { Student } from '@/types';
import { configService } from './configService';
import {
  DEFAULT_SECTION_SCHEDULE,
  getStudentScheduleStatus,
  parseSectionScheduleConfig,
  SECTION_SCHEDULE_CONFIG_KEY,
  type SectionScheduleConfig,
  type StudentScheduleStatus,
} from '@/lib/utils/sectionSchedule';
import { getCached, setCached } from '@/lib/utils/memoryCache';

const CACHE_KEY = 'config:horarios_por_seccion';
const CACHE_TTL = 10 * 60 * 1000;

let cachedConfig: SectionScheduleConfig | null = null;

async function loadConfig(): Promise<SectionScheduleConfig> {
  if (cachedConfig) return cachedConfig;

  const mem = getCached<SectionScheduleConfig>(CACHE_KEY);
  if (mem) {
    cachedConfig = mem;
    return mem;
  }

  const { config } = await configService.getByKey(SECTION_SCHEDULE_CONFIG_KEY);
  const parsed = parseSectionScheduleConfig(config?.value);
  cachedConfig = parsed;
  setCached(CACHE_KEY, parsed, CACHE_TTL);
  return parsed;
}

export const scheduleService = {
  invalidateCache(): void {
    cachedConfig = null;
  },

  async getConfig(): Promise<SectionScheduleConfig> {
    return loadConfig();
  },

  async getForStudent(
    student: Pick<Student, 'level' | 'grade' | 'section'>,
    nowHHMM?: string
  ): Promise<StudentScheduleStatus> {
    const config = await loadConfig();
    return getStudentScheduleStatus(student, config, nowHHMM);
  },

  getDefaultConfig(): SectionScheduleConfig {
    return DEFAULT_SECTION_SCHEDULE;
  },
};
