import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  Menu,
  X,
  User,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { authService } from '@/lib/services';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ParentSidebarNav } from '@/components/parent/ParentSidebarNav';
import { GuardyMark } from '@/components/brand/GuardyMark';
import {
  getStaffNavDefaultPath,
  getStaffNavItems,
  isStaffNavItemActive,
  type StaffNavItem,
} from '@/config/staffNavigation';
import { preloadRoute } from '@/lib/routePreloads';

const navItemClass = (active: boolean) =>
  cn(
    'group relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
    active
      ? 'bg-sidebar-primary/12 text-sidebar-foreground shadow-[inset_3px_0_0_0_hsl(var(--sidebar-primary))]'
      : 'text-sidebar-foreground/75 hover:bg-white/[0.06] hover:text-sidebar-foreground',
  );

const navIconClass = (active: boolean) =>
  cn(
    'h-[18px] w-[18px] shrink-0 transition-colors',
    active ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80',
  );

const subItemClass = (active: boolean) =>
  cn(
    'group relative flex items-center rounded-md py-2 pl-9 pr-3 text-[12.5px] transition-all duration-200',
    active
      ? 'bg-sidebar-primary/14 font-medium text-sidebar-foreground'
      : 'text-sidebar-foreground/65 hover:bg-white/[0.05] hover:text-sidebar-foreground/90',
  );

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const user = authService.getCurrentUser();

  const handleLogout = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    try {
      await authService.logout();
      toast.success('Sesión cerrada');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      navigate('/login', { replace: true });
    }
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedItems(newExpanded);
  };

  const navItems = useMemo(() => getStaffNavItems(user?.role), [user?.role]);
  const isParentRole = user?.role === 'Padre';

  const isActive = (item: StaffNavItem) => isStaffNavItemActive(location.pathname, item);

  const prefetchPath = (path: string) => {
    preloadRoute(path);
  };

  useEffect(() => {
    const group = navItems.find((item) => isStaffNavItemActive(location.pathname, item));
    if (group?.subItems?.length) {
      setExpandedItems((prev) => {
        if (prev.has(group.path)) return prev;
        const next = new Set(prev);
        next.add(group.path);
        return next;
      });
    }
  }, [location.pathname, navItems]);

  return (
    <>
      {!isParentRole && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="fixed left-4 top-4 z-50 border border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground shadow-lg backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </>
      )}

      <aside
        className={cn(
          'staff-sidebar fixed left-0 top-0 z-40 flex h-full w-64 flex-col animate-in fade-in slide-in-from-left-2 duration-300',
          'border-r border-sidebar-border/80 text-sidebar-foreground shadow-xl',
          isParentRole
            ? 'hidden md:flex -translate-x-0'
            : mobileMenuOpen
              ? 'translate-x-0'
              : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="border-b border-sidebar-border/60 px-5 pb-5 pt-5">
          <Link
            to={user?.role === 'Padre' ? '/parent-portal' : '/'}
            className="group flex flex-col items-center justify-center gap-2.5 text-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.02]">
              <GuardyMark size="lg" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display text-lg font-bold leading-none tracking-wide text-sidebar-foreground">
                SIE
              </span>
              <p className="text-[11px] leading-snug text-sidebar-foreground/60">
                Incidencias Escolares
              </p>
            </div>
          </Link>
        </div>

        <nav className="staff-sidebar-nav flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {user?.role === 'Padre' ? (
            <ParentSidebarNav onNavigate={() => setMobileMenuOpen(false)} />
          ) : null}
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedItems.has(item.path);

            if (hasSubItems) {
              const defaultPath = getStaffNavDefaultPath(item);
              const showSubItems = isExpanded || active;
              return (
                <div key={item.path} className="space-y-0.5">
                  <div className="flex items-stretch gap-1">
                    <Link
                      to={defaultPath}
                      onClick={() => setMobileMenuOpen(false)}
                      onMouseEnter={() => prefetchPath(defaultPath)}
                      onFocus={() => prefetchPath(defaultPath)}
                      onTouchStart={() => prefetchPath(defaultPath)}
                      className={navItemClass(active)}
                    >
                      <Icon className={navIconClass(active)} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      aria-expanded={showSubItems}
                      aria-label={`Ver opciones de ${item.label}`}
                      onClick={() => toggleExpanded(item.path)}
                      className={cn(
                        'flex shrink-0 items-center justify-center rounded-lg px-2 text-sidebar-foreground/55 transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground',
                        active && 'text-sidebar-primary',
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          showSubItems && 'rotate-90',
                        )}
                      />
                    </button>
                  </div>
                  {showSubItems && (
                    <div className="relative ml-3 space-y-0.5 border-l border-sidebar-border/50 py-1 pl-3">
                      {item.subItems?.map((subItem) => {
                        const subActive = location.pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={() => setMobileMenuOpen(false)}
                            onMouseEnter={() => prefetchPath(subItem.path)}
                            onFocus={() => prefetchPath(subItem.path)}
                            onTouchStart={() => prefetchPath(subItem.path)}
                            className={subItemClass(subActive)}
                          >
                            <span
                              className={cn(
                                'absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-colors',
                                subActive
                                  ? 'bg-sidebar-primary shadow-[0_0_6px_hsl(var(--sidebar-primary)/0.6)]'
                                  : 'bg-sidebar-foreground/25 group-hover:bg-sidebar-foreground/40',
                              )}
                              aria-hidden
                            />
                            {subItem.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                onMouseEnter={() => prefetchPath(item.path)}
                onFocus={() => prefetchPath(item.path)}
                onTouchStart={() => prefetchPath(item.path)}
                className={cn(navItemClass(active), 'w-full')}
              >
                <Icon className={navIconClass(active)} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border/60 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-3 ring-1 ring-white/8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/25 ring-1 ring-sidebar-primary/30">
              <User className="h-4 w-4 text-sidebar-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.fullName}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="h-9 w-full justify-start rounded-lg text-[13px] text-sidebar-foreground/80 hover:bg-white/[0.06] hover:text-sidebar-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2.5 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>
    </>
  );
};
