import { Home, Clock, FileText, Calendar } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { authService } from '@/lib/services';
import { useParentPortalOptional } from '@/contexts/ParentPortalContext';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { cn } from '@/lib/utils';
import type { ParentTab } from '@/components/parent/ParentBottomNav';

const TABS: { id: ParentTab; label: string; icon: typeof Home }[] = [
  { id: 'resumen', label: 'Inicio', icon: Home },
  { id: 'asistencia', label: 'Asistencia', icon: Clock },
  { id: 'incidencias', label: 'Incidencias', icon: FileText },
  { id: 'citas', label: 'Citas', icon: Calendar },
];

interface ParentSidebarNavProps {
  onNavigate?: () => void;
}

/** Menú lateral para apoderados: hijos + secciones */
export function ParentSidebarNav({ onNavigate }: ParentSidebarNavProps) {
  const ctx = useParentPortalOptional();
  const location = useLocation();

  if (!ctx || !location.pathname.startsWith('/parent-portal')) {
    return null;
  }

  const user = authService.getCurrentUser();
  if (user?.role !== 'Padre') {
    return null;
  }

  const { students, selectedStudentId, setSelectedStudentId, tab, setTab, loading } = ctx;

  const selectChild = (id: string) => {
    setSelectedStudentId(id);
    onNavigate?.();
  };

  const selectTab = (t: ParentTab) => {
    setTab(t);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          {students.length > 1 ? `Mis hijos (${students.length})` : 'Mi hijo/a'}
        </p>
        {loading ? (
          <p className="px-2 text-xs text-white/60">Cargando...</p>
        ) : students.length === 0 ? (
          <p className="px-2 text-xs text-white/60">Sin alumno vinculado</p>
        ) : (
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
            {students.map((s) => {
              const active = String(s.id) === selectedStudentId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectChild(String(s.id))}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2.5 text-left transition-all',
                    active
                      ? 'border-primary bg-white/15 shadow-sm'
                      : 'border-transparent bg-white/5 hover:bg-white/10'
                  )}
                >
                  <StudentPhoto src={s.profilePhoto} name={s.fullName} className="h-10 w-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{s.fullName}</span>
                    <span className="block truncate text-[11px] text-white/65">
                      {s.grade} {s.section}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-white/15 pt-3">
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Ver información
        </p>
        <div className="space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white border-l-2 border-l-primary pl-[14px]'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-white/55')} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
