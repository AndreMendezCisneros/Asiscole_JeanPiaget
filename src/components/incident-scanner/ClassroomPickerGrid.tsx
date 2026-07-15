import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';
import type { DocenteClassroom } from '@/types';
import { formatClassroomLabel } from '@/lib/utils/docenteAssignments';
import { cn } from '@/lib/utils';

interface ClassroomPickerGridProps {
  classrooms: DocenteClassroom[];
  onSelect: (classroom: DocenteClassroom) => void;
}

export function ClassroomPickerGrid({ classrooms, onSelect }: ClassroomPickerGridProps) {
  if (classrooms.length === 0) {
    return (
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground text-center">
          No tiene salones asignados. Contacte al administrador.
        </p>
      </CardContent>
    );
  }

  return (
    <CardContent className="p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {classrooms.map((classroom) => (
          <button
            key={`${classroom.level}-${classroom.grade}-${classroom.section}`}
            type="button"
            onClick={() => onSelect(classroom)}
            className={cn(
              'group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left',
              'transition-colors hover:border-primary/40 hover:bg-primary/5',
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary group-hover:bg-primary/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{formatClassroomLabel(classroom)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Ver estudiantes del salón</p>
            </div>
          </button>
        ))}
      </div>
    </CardContent>
  );
}
