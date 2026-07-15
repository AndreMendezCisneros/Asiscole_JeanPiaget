import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FaultType } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryFaultGridProps {
  faults: FaultType[];
  selectedFaultId: number | null;
  onSelectFault: (faultId: number) => void;
  disabled?: boolean;
}

export function CategoryFaultGrid({
  faults,
  selectedFaultId,
  onSelectFault,
  disabled,
}: CategoryFaultGridProps) {
  const grouped = useMemo(() => {
    return faults.reduce(
      (acc, fault) => {
        if (!acc[fault.category]) acc[fault.category] = [];
        acc[fault.category].push(fault);
        return acc;
      },
      {} as Record<string, FaultType[]>,
    );
  }, [faults]);

  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? '');

  if (faults.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay faltas disponibles en el catálogo.</p>;
  }

  const currentCategory = categories.includes(activeCategory) ? activeCategory : categories[0];

  return (
    <Tabs value={currentCategory} onValueChange={setActiveCategory} className="w-full">
      <TabsList className="mb-3 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
        {categories.map((category) => (
          <TabsTrigger key={category} value={category} className="text-xs sm:text-sm">
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      {categories.map((category) => (
        <TabsContent key={category} value={category} className="mt-0">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {grouped[category].map((fault) => {
              const selected = selectedFaultId === fault.id;
              return (
                <Button
                  key={fault.id}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className={cn(
                    'h-auto min-h-[3rem] justify-start whitespace-normal px-3 py-2.5 text-left',
                    selected && 'ring-2 ring-primary ring-offset-2',
                  )}
                  onClick={() => onSelectFault(fault.id)}
                  disabled={disabled}
                >
                  <span className="flex flex-col items-start gap-1">
                    <span className="font-medium leading-snug">{fault.name}</span>
                    <Badge
                      variant={fault.severity === 'Grave' ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {fault.severity}
                    </Badge>
                  </span>
                </Button>
              );
            })}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
