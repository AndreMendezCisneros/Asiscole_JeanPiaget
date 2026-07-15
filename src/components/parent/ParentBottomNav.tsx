import { Calendar, FileText, Home, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export type ParentTab = 'resumen' | 'asistencia' | 'incidencias' | 'citas';

const ITEMS: { id: ParentTab; label: string; short: string; icon: typeof Home }[] = [
  { id: 'resumen', label: 'Inicio', short: 'Inicio', icon: Home },
  { id: 'asistencia', label: 'Asistencia', short: 'Asist.', icon: Clock },
  { id: 'incidencias', label: 'Incidencias', short: 'Faltas', icon: FileText },
  { id: 'citas', label: 'Citas', short: 'Citas', icon: Calendar },
];

interface ParentBottomNavProps {
  value: ParentTab;
  onChange: (tab: ParentTab) => void;
  badges?: Partial<Record<ParentTab, number>>;
  hideDesktop?: boolean;
}

export function ParentBottomNav({ value, onChange, badges, hideDesktop }: ParentBottomNavProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mobileNav = (
    <nav
      className="parent-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 backdrop-blur-lg md:hidden"
      aria-label="Secciones del portal"
    >
      <div className="parent-bottom-nav__inner grid grid-cols-4 gap-0 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {ITEMS.map(({ id, short, icon: Icon }) => {
          const active = value === id;
          const badge = badges?.[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'parent-bottom-nav__btn flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative flex h-6 items-center justify-center">
                <Icon
                  className={cn('h-[1.35rem] w-[1.35rem] transition-transform', active && 'scale-110')}
                  aria-hidden
                />
                {badge != null && badge > 0 ? (
                  <span className="absolute -right-2.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground shadow-sm">
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </span>
              <span className="leading-none">{short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {mounted ? createPortal(mobileNav, document.body) : null}

      <div
        data-parent-nav
        data-parent-anim
        className={cn(
          'parent-tabs-desktop gap-2 sm:gap-3',
          hideDesktop ? 'hidden' : 'hidden md:grid md:grid-cols-4'
        )}
      >
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'border-border/80 bg-card text-foreground hover:border-primary/30 hover:bg-muted/40'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}
