import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface StaffSegmentedOption {
  value: string;
  label: string;
}

interface StaffSegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: StaffSegmentedOption[];
  className?: string;
  listClassName?: string;
  'aria-label'?: string;
}

export function StaffSegmentedControl({
  value,
  onValueChange,
  options,
  className,
  listClassName,
  'aria-label': ariaLabel,
}: StaffSegmentedControlProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          'app-segmented-list grid h-auto w-full grid-cols-2 sm:grid-cols-3',
          listClassName
        )}
      >
        {options.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value} className="app-segmented-trigger">
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
