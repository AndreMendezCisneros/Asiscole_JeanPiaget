import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  BookOpen, 
  BarChart3,
  LogOut,
  Menu,
  User,
  Shield,
  Settings,
  Clock,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { authService } from '@/lib/services';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = authService.getCurrentUser();
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  }, [navigate, setMobileMenuOpen]);

  const handleLogout = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    try {
      await authService.logout();
      toast.success('Sesión cerrada');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Asegurar redirección incluso si hay error
      navigate('/login', { replace: true });
    }
  };

  interface NavItem {
    path: string;
    label: string;
    icon: any;
    roles: string[];
    subItems?: { path: string; label: string }[];
  }

  const getNavItems = (): NavItem[] => {
    // Tutores y docentes usan interfaz dedicada sin navbar staff
    if (user?.role === 'Tutor' || user?.role === 'Docente') {
      return [];
    }

    // Padres solo tienen acceso al portal
    if (user?.role === 'Padre') {
      return [
        {
          path: '/parent-portal',
          label: 'Portal de Padres',
          icon: User,
          roles: ['Padre'],
        },
      ];
    }

    const allItems: NavItem[] = [
      {
        path: '/',
        label: 'Inicio',
        icon: LayoutDashboard,
        roles: ['Supervisor', 'Director', 'Admin'],
      },
      {
        path: '/arrival-control',
        label: 'Asistencia',
        icon: Clock,
        roles: ['Supervisor', 'Director', 'Admin'],
        subItems: [
          { path: '/arrival-control', label: 'Control de Llegadas' },
          { path: '/departure-control', label: 'Registro de Salidas' },
        ],
      },
      {
        path: '/incidents',
        label: 'Incidencias',
        icon: FileText,
        roles: ['Supervisor', 'Director', 'Admin'],
        subItems: [
          { path: '/incidents', label: 'Lista de Incidencias' },
          { path: '/register', label: 'Registrar Incidencia' },
          { path: '/justify-faults', label: 'Justificar Faltas' },
        ],
      },
      {
        path: '/students',
        label: 'Estudiantes',
        icon: Users,
        roles: ['Supervisor', 'Director', 'Admin'],
      },
      {
        path: '/parent-meetings',
        label: 'Citas con Padres',
        icon: User,
        roles: ['Supervisor', 'Director', 'Admin'],
      },
      {
        path: '/faults',
        label: 'Catálogos',
        icon: BookOpen,
        roles: ['Director', 'Admin'],
        subItems: [{ path: '/faults', label: 'Catálogo de Faltas' }],
      },
      {
        path: '/reports',
        label: 'Reportes',
        icon: BarChart3,
        roles: ['Supervisor', 'Director', 'Admin'],
        subItems: [
          { path: '/reports', label: 'Reportes de Incidencias' },
          { path: '/attendance-report', label: 'Reporte de Asistencias' },
        ],
      },
      {
        path: '/system-config',
        label: 'Administración',
        icon: Settings,
        roles: ['Admin'],
        subItems: [
          { path: '/audit', label: 'Auditoría' },
          { path: '/system-config', label: 'Configuración' },
        ],
      },
    ];

    return allItems.filter(item => item.roles.includes(user?.role || ''));
  };

  const navItems = getNavItems();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-sidebar border-b border-sidebar-border sticky top-0 z-50 backdrop-blur-sm bg-sidebar/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Título */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-primary/25 transition-all duration-300 group-hover:scale-110">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <span className="text-sidebar-foreground font-bold text-xl bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text">
                  Sistema de Incidencias
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Desktop */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center space-x-1 mr-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path) || item.subItems?.some(sub => isActive(sub.path));
                const hasSubItems = item.subItems && item.subItems.length > 0;

                if (hasSubItems) {
                  return (
                    <DropdownMenu key={item.path}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={active ? 'default' : 'ghost'}
                          size="sm"
                          className={cn(
                            'relative overflow-hidden transition-all duration-300 group',
                            active 
                              ? 'shadow-md' 
                              : 'text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/80',
                            'data-[state=open]:bg-sidebar-accent/80'
                          )}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          <span className="relative z-10">{item.label}</span>
                          <ChevronDown className="ml-1 h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          {active && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground/50" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-56 bg-sidebar border-sidebar-border shadow-lg"
                        align="start"
                        sideOffset={5}
                      >
                        {item.subItems?.map((subItem) => (
                          <DropdownMenuItem 
                            key={subItem.path}
                            onSelect={() => handleNavigation(subItem.path)}
                            className={cn(
                              'cursor-pointer focus:bg-sidebar-accent/80 focus:text-sidebar-foreground',
                              isActive(subItem.path) && 'bg-sidebar-accent/50'
                            )}
                          >
                            <ChevronRight className="mr-2 h-4 w-4 text-muted-foreground" />
                            {subItem.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                }

                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={active ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'relative overflow-hidden transition-all duration-300',
                        active 
                          ? 'shadow-md' 
                          : 'text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/80'
                      )}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      <span className="relative z-10">{item.label}</span>
                      {active && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground/50" />
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center gap-3 pl-4 border-l border-sidebar-border/50">
              <div className="hidden lg:flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="text-sm text-sidebar-foreground">
                  <div className="font-medium">{user?.fullName}</div>
                  <div className="text-xs text-muted-foreground">{user?.role}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/80 transition-all duration-300 hover:scale-105"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden xl:inline">Salir</span>
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-sidebar-foreground hover:bg-sidebar-accent/80 transition-all duration-300"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden pb-4 animate-fade-in">
          <div className="flex flex-col space-y-1 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;

              if (hasSubItems) {
                return (
                  <div key={item.path} className="space-y-1">
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground/80 uppercase tracking-wider flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <div className="ml-4 space-y-1 border-l border-sidebar-border/50 pl-2">
                      {item.subItems?.map((subItem) => (
                        <Button
                          key={subItem.path}
                          variant={isActive(subItem.path) ? 'default' : 'ghost'}
                          className={`w-full justify-start ${isActive(subItem.path) ? 'bg-sidebar-accent/80' : ''} pl-4`}
                          onClick={() => handleNavigation(subItem.path)}
                        >
                          <ChevronRight className="w-4 h-4 mr-2" />
                          {subItem.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              }

              const active = isActive(item.path) || item.subItems?.some(sub => isActive(sub.path));
              return (
                <Button
                  key={item.path}
                  variant={active ? 'default' : 'ghost'}
                  className={`w-full justify-start ${active ? 'bg-sidebar-accent/80' : ''}`}
                  onClick={() => handleNavigation(item.path)}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}

            {/* Mobile User Section */}
            <div className="px-3 py-4 mt-2 border-t border-sidebar-border/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm text-sidebar-foreground">
                  <div className="font-medium">{user?.fullName}</div>
                  <div className="text-xs text-muted-foreground">{user?.role}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/80 transition-all duration-300"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
