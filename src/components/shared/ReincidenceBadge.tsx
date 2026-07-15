import { ReincidenceLevel } from '@/types';
import { cn } from '@/lib/utils';
import {
  getReincidenceLevelLabel,
  getReincidenceLevelPillClass,
} from '@/lib/utils/reincidenceUtils';

interface ReincidenceBadgeProps {
  level: ReincidenceLevel;
  className?: string;
  short?: boolean;
}

export const ReincidenceBadge = ({ level, className, short }: ReincidenceBadgeProps) => {
  const label = short ? `Nv. ${level}` : getReincidenceLevelLabel(level);

  return (
    <span className={cn(getReincidenceLevelPillClass(level), className)}>{label}</span>
  );
};
