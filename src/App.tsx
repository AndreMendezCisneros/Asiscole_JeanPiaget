import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/ui/loading-screen";
import { SuccessFlashOverlay } from "./components/feedback/SuccessFlashOverlay";
import { authService } from "./lib/services";
import { useSessionMonitor } from "./hooks/useSessionMonitor";
import { useDeployVersionCheck } from "./hooks/useDeployVersionCheck";
import { PageMetaManager } from "./components/seo/PageMetaManager";
import { SiteAnalytics } from "./components/seo/SiteAnalytics";
import { StaffLayoutShell } from "./components/layout/StaffLayoutShell";
import { lazyPage } from "./lib/lazyPage";
import { Dashboard } from "./pages/Dashboard";
import { RegisterIncident } from "./pages/RegisterIncident";
import { IncidentsList } from "./pages/IncidentsList";
import { StudentsList } from "./pages/StudentsList";
import { AttendanceReport } from "./pages/AttendanceReport";
import { ArrivalControl } from "./pages/ArrivalControl";
import { DepartureControl } from "./pages/DepartureControl";
import { ParentMeetings } from "./pages/ParentMeetings";
import { JustifyFaults } from "./pages/JustifyFaults";
import { TeachersAdmin } from "./pages/TeachersAdmin";
import { FaultsCatalog } from "./pages/FaultsCatalog";
import { Reports } from "./pages/Reports";
import { AuditLogs } from "./pages/AuditLogs";
import { SystemConfig } from "./pages/SystemConfig";

const Login = lazyPage(() => import("./pages/Login").then(m => ({ default: m.Login })));
const TutorScanner = lazyPage(() => import("./pages/TutorScanner").then(m => ({ default: m.TutorScanner })));
const TeacherIncidentScanner = lazyPage(() =>
  import("./pages/TeacherIncidentScanner").then(m => ({ default: m.TeacherIncidentScanner }))
);
const ParentPortalRoute = lazyPage(() =>
  import("./components/parent/ParentPortalRoute").then((m) => ({ default: m.ParentPortalRoute }))
);
const ArrivalView = lazyPage(() => import("./pages/ArrivalView").then(m => ({ default: m.ArrivalView })));
const ParentDniPortal = lazyPage(() => import("./pages/ParentDniPortal").then(m => ({ default: m.ParentDniPortal })));
const ChangePassword = lazyPage(() => import("./pages/ChangePassword").then(m => ({ default: m.ChangePassword })));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      // 1 s → 2 s → 4 s entre reintentos (máx 10 s).
      // Cubre el cold-start de Supabase: el primer intento puede fallar por
      // timeout (10 s), pero el segundo ya encuentra la conexión "caliente".
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000,   // 5 min: datos frescos mientras navegas
      gcTime: 20 * 60 * 1000,     // 20 min en caché sin usar
    },
  },
});

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const user = authService.getCurrentUser();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return children as React.ReactElement;
};

const RootRoute = () => {
  const user = authService.getCurrentUser();

  if (!user) return <Navigate to="/login" replace />;

  if (user.cambioPasswordObligatorio) {
    return <Navigate to="/cambiar-password" replace />;
  }

  if (user.role === 'Tutor') return <Navigate to="/tutor-scanner" replace />;
  if (user.role === 'Docente') return <Navigate to="/docente-scanner" replace />;
  if (user.role === 'Padre') return <Navigate to="/parent-portal" replace />;
  return <Navigate to="/dashboard" replace />;
};

/** Pantalla completa para rutas sin Layout (login, tutor, etc.). */
const FullScreenLoading = () => <LoadingScreen message="Cargando SIE…" />;

const LazyFullScreen = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullScreenLoading />}>{children}</Suspense>
);

const AppContent = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LazyFullScreen>
            <PublicRoute>
              <Login />
            </PublicRoute>
          </LazyFullScreen>
        }
      />
      <Route path="/" element={<RootRoute />} />

      {/* Panel staff — un solo layout, sin lazy por página (evita Suspense colgado) */}
      <Route
        element={
          <ProtectedRoute requiredRole={['Supervisor', 'Director', 'Admin']}>
            <StaffLayoutShell requiredRole={['Supervisor', 'Director', 'Admin']} />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/register" element={<RegisterIncident />} />
        <Route path="/incidents" element={<IncidentsList />} />
        <Route path="/students" element={<StudentsList />} />
        <Route path="/attendance-report" element={<AttendanceReport />} />
        <Route path="/arrival-control" element={<ArrivalControl />} />
        <Route path="/departure-control" element={<DepartureControl />} />
        <Route path="/parent-meetings" element={<ParentMeetings />} />
        <Route path="/justify-faults" element={<JustifyFaults />} />
        <Route
          path="/faults"
          element={
            <ProtectedRoute requiredRole={['Director', 'Admin']}>
              <FaultsCatalog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRole={['Director', 'Admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/teachers"
          element={
            <ProtectedRoute requiredRole={['Admin']}>
              <TeachersAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute requiredRole={['Admin']}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-config"
          element={
            <ProtectedRoute requiredRole={['Admin']}>
              <SystemConfig />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="/docente-scanner"
        element={
          <ProtectedRoute requiredRole={['Docente']}>
            <LazyFullScreen>
              <TeacherIncidentScanner />
            </LazyFullScreen>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor-scanner"
        element={
          <ProtectedRoute requiredRole={['Tutor']}>
            <LazyFullScreen>
              <TutorScanner />
            </LazyFullScreen>
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent-portal"
        element={
          <ProtectedRoute requiredRole={['Padre', 'Supervisor', 'Director', 'Admin']}>
            <LazyFullScreen>
              <ParentPortalRoute />
            </LazyFullScreen>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cambiar-password"
        element={
          <LazyFullScreen>
            <ChangePassword />
          </LazyFullScreen>
        }
      />
      <Route
        path="/portal-padres"
        element={
          <LazyFullScreen>
            <ParentDniPortal />
          </LazyFullScreen>
        }
      />
      <Route
        path="/llegada/dni/:dni"
        element={
          <LazyFullScreen>
            <ArrivalView />
          </LazyFullScreen>
        }
      />
      <Route
        path="/llegada/:id"
        element={
          <LazyFullScreen>
            <ArrivalView />
          </LazyFullScreen>
        }
      />
      <Route
        path="*"
        element={
          <LazyFullScreen>
            <NotFound />
          </LazyFullScreen>
        }
      />
    </Routes>
  );
};

const AppWithSessionMonitor = () => {
  useSessionMonitor();
  useDeployVersionCheck();

  // route-login.js agrega la clase 'route-login' al <html> en el momento
  // de la carga inicial cuando la URL es /login (para mostrar fondo oscuro
  // antes de que React hidrate). Con SPA, esa clase NUNCA se borra sola
  // al navegar — lo que deja body { color: #e2e8f0 } (texto casi blanco)
  // aplicado sobre fondos blancos de las demás páginas, haciendo el texto
  // prácticamente invisible. Este efecto sincroniza la clase con la ruta actual.
  const { pathname } = useLocation();
  useEffect(() => {
    const isLogin = pathname === '/login' || pathname.startsWith('/login/');
    document.documentElement.classList.toggle('route-login', isLogin);
  }, [pathname]);

  return (
    <>
      <PageMetaManager />
      <SiteAnalytics />
      <AppContent />
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SuccessFlashOverlay />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppWithSessionMonitor />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
