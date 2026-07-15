import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useParentPortalOptional } from '@/contexts/ParentPortalContext';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { cn } from '@/lib/utils';

interface ParentChildrenSwitcherProps {
  className?: string;
}

export function ParentChildrenSwitcher({ className }: ParentChildrenSwitcherProps) {
  const ctx = useParentPortalOptional();
  if (!ctx) return null;

  const { students, selectedStudentId, setSelectedStudentId, loading } = ctx;
  const count = students.length;

  if (loading || count <= 1) return null;

  return (
    <div className={cn('rounded-xl border border-border/70 bg-muted/25 p-3 sm:p-3.5', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-xs font-semibold tracking-tight text-foreground">Alumnos a cargo</p>
        </div>
        <Badge variant="default" className="text-[10px] font-medium">
          {count}
        </Badge>
      </div>

      <div
        className="parent-children-switcher flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Seleccionar alumno"
      >
        {students.map((s) => {
          const active = String(s.id) === selectedStudentId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedStudentId(String(s.id))}
              className={cn(
                'parent-children-switcher__chip flex shrink-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2.5',
                active
                  ? 'border-primary bg-card shadow-md shadow-primary/10'
                  : 'border-transparent bg-card/90 hover:border-primary/25'
              )}
            >
              <StudentPhoto src={s.profilePhoto} name={s.fullName} className="h-10 w-10" />
              <span className="max-w-[8.5rem] text-left sm:max-w-[10rem]">
                <span className="block truncate text-xs font-semibold">{s.fullName}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {s.grade} · Sec. {s.section}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
