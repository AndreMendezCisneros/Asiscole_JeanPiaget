import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SYSTEM_SETTINGS,
  SYSTEM_SETTING_KEYS,
  coerceTimeConfigValue,
  normalizeTimeValue,
  type SystemSettingKey,
} from '@/config/systemSettings';
import { configService, reincidenceConfigService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';

const CONFIG_STALE_MS = 5 * 60 * 1000;

export type AttendanceSettingsValues = Record<SystemSettingKey, string>;

export function useAttendanceSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.systemConfig.attendance(),
    queryFn: async (): Promise<AttendanceSettingsValues> => {
      const keys = [
        ...SYSTEM_SETTINGS.map((s) => s.key),
        SYSTEM_SETTING_KEYS.arrivalLimit,
      ];
      const { configs, error } = await configService.getByKeys(keys);
      if (error) throw new Error(error);

      const legacyLimit = normalizeTimeValue(
        configs[SYSTEM_SETTING_KEYS.arrivalLimit]?.value,
        '08:00',
      );

      const values = {} as AttendanceSettingsValues;
      for (const def of SYSTEM_SETTINGS) {
        const config = configs[def.key];
        const hasValue = Boolean(coerceTimeConfigValue(config?.value));
        const fallback =
          def.key === SYSTEM_SETTING_KEYS.arrivalLimitPrimary ||
          def.key === SYSTEM_SETTING_KEYS.arrivalLimitSecondary
            ? legacyLimit
            : def.defaultValue;
        values[def.key] = normalizeTimeValue(
          hasValue ? config?.value : fallback,
          def.defaultValue,
        );
      }
      return values;
    },
    staleTime: CONFIG_STALE_MS,
  });
}

export function useReincidenceSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.systemConfig.reincidence(),
    queryFn: async () => {
      const { settings, error } = await reincidenceConfigService.ensureDefault();
      if (error) throw new Error(error);
      if (!settings) throw new Error('Sin configuración de reincidencia');
      return settings;
    },
    staleTime: CONFIG_STALE_MS,
  });
}

export function useInvalidateSystemConfig() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.systemConfig.all });
}
