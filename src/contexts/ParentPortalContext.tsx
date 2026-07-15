import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authService, parentPortalService } from '@/lib/services';
import type { Student } from '@/types';
import type { ParentTab } from '@/components/parent/ParentBottomNav';

type ParentPortalContextValue = {
  students: Student[];
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  student: Student | null;
  tab: ParentTab;
  setTab: (tab: ParentTab) => void;
  loading: boolean;
  refreshStudents: () => Promise<void>;
};

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function ParentPortalProvider({ children }: { children: ReactNode }) {
  const user = authService.getCurrentUser();
  const userId = user?.id;

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [tab, setTab] = useState<ParentTab>('resumen');
  const [loading, setLoading] = useState(true);

  const loadStudents = useCallback(async () => {
    const current = authService.getCurrentUser();
    if (!current) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { students: list, error } = await parentPortalService.getLinkedStudents(current);
    if (error && list.length === 0) {
      setStudents([]);
      setSelectedStudentId('');
    } else {
      setStudents(list);
      if (list.length > 0) {
        setSelectedStudentId((prev) =>
          prev && list.some((s) => String(s.id) === prev) ? prev : String(list[0].id)
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === 'Padre' || user?.role === 'Admin' || user?.role === 'Director' || user?.role === 'Supervisor') {
      void loadStudents();
    } else {
      setLoading(false);
    }
  }, [userId, user?.role, loadStudents]);

  const student = useMemo(
    () => students.find((s) => String(s.id) === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const value = useMemo(
    () => ({
      students,
      selectedStudentId,
      setSelectedStudentId,
      student,
      tab,
      setTab,
      loading,
      refreshStudents: loadStudents,
    }),
    [students, selectedStudentId, student, tab, loading, loadStudents]
  );

  return (
    <ParentPortalContext.Provider value={value}>{children}</ParentPortalContext.Provider>
  );
}

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext);
  if (!ctx) {
    throw new Error('useParentPortal debe usarse dentro de ParentPortalProvider');
  }
  return ctx;
}

/** Para Sidebar: no falla fuera del portal */
export function useParentPortalOptional() {
  return useContext(ParentPortalContext);
}
