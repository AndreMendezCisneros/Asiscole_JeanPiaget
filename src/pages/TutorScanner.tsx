import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Barcode,
  Clock,
  AlertCircle,
  LogOut,
  X,
  ScanLine,
  Search,
  Loader2,
  Zap,
  CalendarClock,
} from 'lucide-react';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { GuardyMark } from '@/components/brand/GuardyMark';
import { toast } from 'sonner';
import {
  studentsService,
  faultsService,
  incidentsService,
  authService,
  arrivalService,
  whatsappService,
  scheduleService,
  sessionService,
} from '@/lib/services';
import { Student, FaultType, ArrivalRecord } from '@/types';
import type { StudentScheduleStatus } from '@/lib/utils/sectionSchedule';
import { useNavigate } from 'react-router-dom';
import { useInvalidateIncidents } from '@/hooks/queries/useIncidentsQuery';
import { useInvalidateStudents } from '@/hooks/queries/useStudentsQuery';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import {
  compareArrivalStatus,
  resolveArrivalLimitForLevel,
  resolveArrivalStatusForStudent,
  type ArrivalLimitsByLevel,
} from '@/lib/utils/arrivalLimit';
import { configService } from '@/lib/services';
import { SYSTEM_SETTING_KEYS, normalizeTimeValue } from '@/config/systemSettings';
import type { CreateArrivalOptions } from '@/lib/services/arrivalService';
import { invalidateArrivalLimitCache } from '@/lib/services/arrivalService';
import { useTutorProfileIdle } from '@/hooks/useTutorProfileIdle';
import { useTutorViewport } from '@/hooks/useTutorViewport';
import { isDniLikeQuery, TUTOR_NAME_SEARCH_LIMIT } from '@/lib/utils/studentSearch';
import { prefersTouchBarcodeInput } from '@/lib/utils/deviceCompat';
import { useTutorTouchLayout } from '@/hooks/useTutorTouchLayout';
import { useHardwareBarcodeCapture } from '@/hooks/useHardwareBarcodeCapture';
import { buildStudentLookupVariants } from '@/lib/services/studentsService';
import { cn } from '@/lib/utils';

const NAME_SEARCH_SCROLL_AFTER = 8;

export const TutorScanner = () => {
  const navigate = useNavigate();
  const invalidateIncidents = useInvalidateIncidents();
  const invalidateStudents = useInvalidateStudents();
  const queryClient = useQueryClient();
  const [barcode, setBarcode] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [nameSearchResults, setNameSearchResults] = useState<Student[]>([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [nameSearchError, setNameSearchError] = useState<string | null>(null);
  const [nameSearchEmpty, setNameSearchEmpty] = useState(false);
  const [lookupPending, setLookupPending] = useState(false);
  const [scanAnnouncement, setScanAnnouncement] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [faults, setFaults] = useState<FaultType[]>([]);
  const [selectedFault, setSelectedFault] = useState('');
  const [observations, setObservations] = useState('');
  const [registering, setRegistering] = useState(false);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [arrivalRecord, setArrivalRecord] = useState<ArrivalRecord | null>(null);
  const [arrivalLimits, setArrivalLimits] = useState<ArrivalLimitsByLevel>({
    general: '08:00',
    primaria: '08:00',
    secundaria: '08:00',
  });
  const [schoolCloseTime, setSchoolCloseTime] = useState<string>('18:00');
  const [nowHHMM, setNowHHMM] = useState<string>('');
  const [sessionCount, setSessionCount] = useState<{ total: number; onTime: number; late: number }>({
    total: 0,
    onTime: 0,
    late: 0,
  });
  const [recentScans, setRecentScans] = useState<
    Array<{ id: string; name: string; time: string; status: 'A tiempo' | 'Tarde' | string }>
  >([]);
  const [studentSchedule, setStudentSchedule] = useState<StudentScheduleStatus | null>(null);
  const [quickFaultId, setQuickFaultId] = useState<number | null>(null);
  const [barcodeKeyboard, setBarcodeKeyboard] = useState(false);
  const isMountedRef = useRef(true);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const hardwareScanInputRef = useRef<HTMLInputElement>(null);
  const studentCardRef = useRef<HTMLDivElement>(null);
  const showStudentProfileRef = useRef(false);
  const barcodeIndexRef = useRef<Map<string, Student>>(new Map());
  const latestProfileScanRef = useRef(0);
  const activeLookupsRef = useRef(0);
  const inFlightStudentIdsRef = useRef<Set<number>>(new Set());
  const todayArrivalsRef = useRef<Map<number, ArrivalRecord>>(new Map());
  const clearScanRef = useRef<() => void>(() => {});
  const bumpProfileIdleRef = useRef<() => void>(() => {});
  const manualEntryActiveRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });
  const nameBarcodeBufferRef = useRef({ buf: '', lastAt: 0 });
  const hardwareSinkBufferRef = useRef('');
  const displayedStudentIdRef = useRef<number | null>(null);

  const user = authService.getCurrentUser();
  const touchBarcode = useMemo(() => prefersTouchBarcodeInput(), []);
  const touchTablet = useTutorTouchLayout();
  const nameSearchScrollable = touchTablet
    ? nameSearchResults.length > NAME_SEARCH_SCROLL_AFTER
    : nameSearchResults.length > 0;

  useTutorViewport(showStudentProfile && touchTablet);

  useEffect(() => {
    showStudentProfileRef.current = showStudentProfile;
  }, [showStudentProfile]);

  /** Solo true cuando el tutor tocó el campo (no en focus programático del lector). */
  const markManualEntry = useCallback(() => {
    manualEntryActiveRef.current = true;
  }, []);

  const prepareForHardwareScan = useCallback(() => {
    manualEntryActiveRef.current = false;
    setNameSearch('');
    setNameSearchResults([]);
    const nameEl = document.getElementById('name-search-input') as HTMLInputElement | null;
    const hadNameFocus = document.activeElement === nameEl;
    if (hadNameFocus) {
      nameEl.blur();
    }
  }, []);

  const startScanRef = useRef<(code: string) => void>(() => {});

  useEffect(() => {
    if (!showStudentProfile) return;
    const card = studentCardRef.current;
    if (!card) return;
    card.scrollTop = 0;
    const scroll = card.querySelector<HTMLElement>('.tutor-student-card__scroll');
    scroll?.scrollTo(0, 0);
  }, [showStudentProfile, student?.id]);

  const focusBarcodeInput = useCallback(() => {
    requestAnimationFrame(() => {
      const useHardwareSink =
        touchBarcode && showStudentProfileRef.current && !showIncidentDialog;

      if (manualEntryActiveRef.current && !useHardwareSink) return;

      const active = document.activeElement;
      const nameInput = document.getElementById('name-search-input');
      if (active === nameInput) {
        if (useHardwareSink) {
          manualEntryActiveRef.current = false;
          (nameInput as HTMLInputElement).blur();
        } else {
          return;
        }
      }
      if (active instanceof HTMLTextAreaElement || active?.closest('[data-tutor-incident-dialog]')) {
        return;
      }

      const input = useHardwareSink
        ? hardwareScanInputRef.current
        : barcodeInputRef.current;
      if (!input) return;

      input.focus({ preventScroll: true });
      if (!useHardwareSink && window.matchMedia('(max-width: 1023px)').matches) {
        input.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      if (input.value.length > 0) {
        input.select();
      }
    });
  }, [touchBarcode, showIncidentDialog]);

  const releaseScanFocus = useCallback(() => {
    prepareForHardwareScan();
    requestAnimationFrame(() => focusBarcodeInput());
  }, [focusBarcodeInput, prepareForHardwareScan]);

  useEffect(() => {
    isMountedRef.current = true;
    loadFaults();
    arrivalService.prefetchArrivalConfig();
    void scheduleService.getConfig();
    loadArrivalLimit();
    const stopClock = startClock();
    if (!touchBarcode) {
      focusBarcodeInput();
    } else {
      const t = window.setTimeout(() => focusBarcodeInput(), 400);
      return () => {
        isMountedRef.current = false;
        stopClock?.();
        window.clearTimeout(t);
      };
    }

    return () => {
      isMountedRef.current = false;
      stopClock?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showIncidentDialog) {
      focusBarcodeInput();
    }
  }, [showIncidentDialog, focusBarcodeInput]);

  // El tutor no debe pulsar "Siguiente": al mostrarse el perfil reenfocamos el
  // input para que escanear el siguiente carnet reemplace el perfil al instante.
  useEffect(() => {
    if (showStudentProfile && !showIncidentDialog) {
      focusBarcodeInput();
    }
  }, [showStudentProfile, showIncidentDialog, focusBarcodeInput]);

  const bumpProfileIdle = useTutorProfileIdle({
    active: showStudentProfile && !showIncidentDialog,
    onIdle: () => {
      clearScanRef.current();
      toast.message('Pantalla limpiada por inactividad', { duration: 2500 });
    },
  });

  useEffect(() => {
    bumpProfileIdleRef.current = bumpProfileIdle;
  }, [bumpProfileIdle]);

  useEffect(() => {
    if (nameSearch.trim().length < 2) {
      setNameSearchResults([]);
      setNameSearching(false);
      setNameSearchError(null);
      setNameSearchEmpty(false);
      return;
    }

    let cancelled = false;
    setNameSearching(true);
    setNameSearchError(null);
    setNameSearchEmpty(false);

    const timeoutId = window.setTimeout(async () => {
      const { students, error } = await studentsService.searchForTutorScanner(nameSearch.trim());
      if (cancelled || !isMountedRef.current) return;
      if (error) {
        setNameSearchResults([]);
        setNameSearchError(error);
        setNameSearchEmpty(false);
      } else {
        setNameSearchResults(students);
        setNameSearchEmpty(students.length === 0);
      }
      setNameSearching(false);
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [nameSearch]);

  useEffect(() => {
    if (!student) {
      setStudentSchedule(null);
      return;
    }
    let cancelled = false;
    void scheduleService.getForStudent(student, nowHHMM || undefined).then((status) => {
      if (!cancelled && isMountedRef.current) setStudentSchedule(status);
    });
    return () => {
      cancelled = true;
    };
  }, [student, nowHHMM]);

  const quickFaults = useMemo(
    () =>
      [...faults]
        .filter((f) => f.active)
        .sort((a, b) => (a.ordenVisualizacion ?? 99) - (b.ordenVisualizacion ?? 99))
        .slice(0, 6),
    [faults]
  );

  const scheduleBadgeVariant = useMemo(() => {
    if (!studentSchedule) return 'secondary' as const;
    if (studentSchedule.shouldBeAtSchool) {
      return studentSchedule.phase === 'exit' ? ('warning' as const) : ('success' as const);
    }
    if (studentSchedule.phase === 'before_entry') return 'secondary' as const;
    return 'destructive' as const;
  }, [studentSchedule]);

  const loadFaults = async () => {
    if (!isMountedRef.current) return;

    try {
      const { faults: faultsList } = await faultsService.getAll(true);
      if (!isMountedRef.current) return;
      setFaults(faultsList);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error loading faults:', error);
    }
  };

  const loadArrivalLimit = async () => {
    try {
      invalidateArrivalLimitCache();
      const limits = await arrivalService.fetchArrivalLimits();
      setArrivalLimits(limits);

      // Hora de cierre: desde cuándo mostrar "Fuera de jornada"
      const { config: closeCfg } = await configService.getByKey(SYSTEM_SETTING_KEYS.schoolClose);
      const normalized = normalizeTimeValue(closeCfg?.value, '18:00');
      setSchoolCloseTime(normalized);
    } catch {
      // Silencioso: usamos valores por defecto
    }
  };

  const startClock = () => {
    const tick = () => {
      const now = new Date().toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setNowHHMM(now);
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  };

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

  const computeArrivalSnapshot = useCallback(
    (studentLevel?: string) => {
      const { date, time } = getLimaNow();
      const limit = resolveArrivalLimitForLevel(arrivalLimits, studentLevel);
      const status = compareArrivalStatus(time, limit);
      return { date, time, status, limit };
    },
    [arrivalLimits]
  );

  const applyScanSuccess = useCallback(
    (
      studentToShow: Student,
      record: ArrivalRecord,
      options?: { countInSession?: boolean; duplicate?: boolean }
    ) => {
      showStudentProfileRef.current = true;
      displayedStudentIdRef.current = studentToShow.id;
      setStudent(studentToShow);
      setArrivalRecord(record);
      setShowStudentProfile(true);

      const status = record.status || 'Registrado';
      const displayTime = record.arrivalTime ?? nowHHMM;

      if (options?.countInSession !== false) {
        setSessionCount((prev) => ({
          total: prev.total + 1,
          onTime: prev.onTime + (status === 'A tiempo' ? 1 : 0),
          late: prev.late + (status === 'Tarde' ? 1 : 0),
        }));
        setRecentScans((prev) => {
          const next = [
            {
              id: `${Date.now()}-${studentToShow.id}`,
              name: studentToShow.fullName,
              time: displayTime,
              status,
            },
            ...prev,
          ];
          return next.slice(0, 6);
        });
      }

      setScanAnnouncement(
        options?.duplicate
          ? `${studentToShow.fullName} ya registrado hoy: ${status}, hora ${displayTime}`
          : `${studentToShow.fullName} registrado: ${status}, hora ${displayTime}`
      );
      bumpProfileIdleRef.current();
    },
    [nowHHMM]
  );

  const revertOptimisticSessionCount = useCallback((status: ArrivalRecord['status']) => {
    setSessionCount((prev) => ({
      total: Math.max(0, prev.total - 1),
      onTime: Math.max(0, prev.onTime - (status === 'A tiempo' ? 1 : 0)),
      late: Math.max(0, prev.late - (status === 'Tarde' ? 1 : 0)),
    }));
    setRecentScans((prev) => prev.slice(1));
  }, []);

  const appendToSessionStats = useCallback(
    (studentToShow: Student, record: ArrivalRecord) => {
      const status = record.status || 'Registrado';
      const displayTime = record.arrivalTime ?? nowHHMM;

      setSessionCount((prev) => ({
        total: prev.total + 1,
        onTime: prev.onTime + (status === 'A tiempo' ? 1 : 0),
        late: prev.late + (status === 'Tarde' ? 1 : 0),
      }));
      setRecentScans((prev) => {
        const next = [
          {
            id: `${Date.now()}-${studentToShow.id}`,
            name: studentToShow.fullName,
            time: displayTime,
            status,
          },
          ...prev,
        ];
        return next.slice(0, 6);
      });
      setScanAnnouncement(
        `${studentToShow.fullName} registrado: ${status}, hora ${displayTime}`
      );
    },
    [nowHHMM]
  );

  const setLookupBusy = useCallback((busy: boolean) => {
    if (busy) {
      activeLookupsRef.current += 1;
      if (isMountedRef.current) setLookupPending(true);
      return;
    }
    activeLookupsRef.current = Math.max(0, activeLookupsRef.current - 1);
    if (activeLookupsRef.current === 0 && isMountedRef.current) {
      setLookupPending(false);
    }
  }, []);

  const persistArrivalInBackground = useCallback(
    (
      studentToShow: Student,
      arrivalOpts: CreateArrivalOptions,
      scanSeq: number,
      optimisticStatus: ArrivalRecord['status'],
      showedOptimisticUi: boolean
    ) => {
      const currentUser = authService.getCurrentUser();
      void arrivalService
        .createArrivalRecord(studentToShow.id, currentUser?.id, arrivalOpts)
        .then(({ record, error: arrivalError, alreadyRegistered }) => {
          if (!isMountedRef.current) return;

          inFlightStudentIdsRef.current.delete(studentToShow.id);

          const isLatestProfile = scanSeq === latestProfileScanRef.current;

          if (arrivalError || !record) {
            console.error('Error al registrar llegada:', arrivalError);
            if (isLatestProfile && showedOptimisticUi) {
              revertOptimisticSessionCount(optimisticStatus);
              setShowStudentProfile(false);
              setStudent(null);
              setArrivalRecord(null);
            }
            toast.error('No se guardó la llegada en el servidor. Vuelva a escanear.');
            focusBarcodeInput();
            return;
          }

          todayArrivalsRef.current.set(studentToShow.id, record);

          if (alreadyRegistered) {
            if (isLatestProfile) {
              if (showedOptimisticUi) {
                revertOptimisticSessionCount(optimisticStatus);
              }
              applyScanSuccess(studentToShow, record, { countInSession: false, duplicate: true });
            }
            toast.info(
              `${studentToShow.fullName} ya fue registrado hoy a las ${record.arrivalTime ?? '—'}`,
              { duration: 2800 }
            );
            focusBarcodeInput();
            return;
          }

          if (!showedOptimisticUi) {
            appendToSessionStats(studentToShow, record);
          } else if (isLatestProfile) {
            setArrivalRecord(record);
            if (record.status !== optimisticStatus) {
              setSessionCount((prev) => ({
                total: prev.total,
                onTime:
                  prev.onTime -
                  (optimisticStatus === 'A tiempo' ? 1 : 0) +
                  (record.status === 'A tiempo' ? 1 : 0),
                late:
                  prev.late -
                  (optimisticStatus === 'Tarde' ? 1 : 0) +
                  (record.status === 'Tarde' ? 1 : 0),
              }));
              setRecentScans((prev) => {
                if (!prev.length) return prev;
                const [head, ...tail] = prev;
                if (head.name !== studentToShow.fullName) return prev;
                return [
                  {
                    ...head,
                    status: record.status,
                    time: record.arrivalTime ?? head.time,
                  },
                  ...tail,
                ];
              });
            }
          }

          if (whatsappService.isEnabled()) {
            void whatsappService.notifyParentArrival(studentToShow, record).then((wa) => {
              if (!isMountedRef.current) return;
              if (!wa.ok && wa.error) {
                toast.warning(`WhatsApp: ${wa.error}`, { duration: 4500 });
              } else if (wa.skipped) {
                toast.info('WhatsApp: aviso ya enviado hace poco (sin reenvío)', { duration: 2200 });
              }
            });
          }
        })
        .catch((err: unknown) => {
          inFlightStudentIdsRef.current.delete(studentToShow.id);
        });
    },
    [
      appendToSessionStats,
      applyScanSuccess,
      focusBarcodeInput,
      revertOptimisticSessionCount,
    ]
  );

  const resolveStudentByBarcode = useCallback(
    async (code: string): Promise<Student | null> => {
      const fromIndex = studentsService.lookupBarcodeInIndex(barcodeIndexRef.current, code);
      if (fromIndex) return fromIndex;

      try {
        const { student, error } = await studentsService.lookupByBarcodeOrDni(code, {
          skipReincidence: true,
        });
        if (student) {
          for (const variant of buildStudentLookupVariants(code)) {
            barcodeIndexRef.current.set(variant, student);
          }
          if (student.barcode?.trim()) {
            barcodeIndexRef.current.set(student.barcode.trim(), student);
          }
          return student;
        }
        if (error) console.warn('lookupByBarcodeOrDni:', error);
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const processStudent = useCallback(
    (foundStudent: Student, scanSeq: number) => {
      void (async () => {
        if (!isMountedRef.current) return;

        const isLatestProfile = scanSeq === latestProfileScanRef.current;
        const shouldUpdateProfile =
          isLatestProfile || foundStudent.id !== displayedStudentIdRef.current;

        const cachedToday = todayArrivalsRef.current.get(foundStudent.id);
        if (cachedToday) {
          if (shouldUpdateProfile) {
            applyScanSuccess(foundStudent, cachedToday, { countInSession: false, duplicate: true });
          }
          toast.info(
            `${foundStudent.fullName} ya fue registrado hoy a las ${cachedToday.arrivalTime ?? '—'}`,
            { duration: 2800 }
          );
          releaseScanFocus();
          return;
        }

        if (inFlightStudentIdsRef.current.has(foundStudent.id)) {
          if (isLatestProfile) {
            toast.info(`Registrando a ${foundStudent.fullName}…`, { duration: 1800 });
          }
          releaseScanFocus();
          return;
        }
        inFlightStudentIdsRef.current.add(foundStudent.id);

        invalidateArrivalLimitCache();
        const limits = await arrivalService.fetchArrivalLimits();
        if (!isMountedRef.current) return;
        setArrivalLimits(limits);

        const { date, time } = getLimaNow();
        const status = resolveArrivalStatusForStudent(time, limits, foundStudent.level);

        const arrivalOpts: CreateArrivalOptions = {
          date,
          arrivalTime: time,
          studentLevel: foundStudent.level,
        };

        if (foundStudent.barcode?.trim()) {
          barcodeIndexRef.current.set(foundStudent.barcode.trim(), foundStudent);
        }

        const optimisticRecord: ArrivalRecord = {
          id: 0,
          studentId: foundStudent.id,
          date,
          arrivalTime: time,
          status,
          createdAt: new Date().toISOString(),
          registeredBy: 0,
        };

        const showedOptimisticUi = shouldUpdateProfile;
        if (showedOptimisticUi) {
          applyScanSuccess(foundStudent, optimisticRecord);
        }

        persistArrivalInBackground(
          foundStudent,
          arrivalOpts,
          scanSeq,
          status,
          showedOptimisticUi
        );

        releaseScanFocus();
      })();
    },
    [
      applyScanSuccess,
      persistArrivalInBackground,
      releaseScanFocus,
    ]
  );

  const processScanCode = useCallback(
    async (rawInput: string, scanSeq: number) => {
      const raw = rawInput.replace(/\r?\n/g, '').trim();
      if (!raw || !isMountedRef.current) {
        if (!raw) toast.error('Ingrese un código de barras');
        return;
      }

      let foundStudent = studentsService.lookupBarcodeInIndex(barcodeIndexRef.current, raw);

      if (!foundStudent) {
        setLookupBusy(true);
        try {
          foundStudent = await resolveStudentByBarcode(raw);
        } finally {
          setLookupBusy(false);
        }
        if (!isMountedRef.current) return;
      }

      if (!foundStudent) {
        toast.error('Estudiante no encontrado');
        focusBarcodeInput();
        return;
      }

      processStudent(foundStudent, scanSeq);
    },
    [focusBarcodeInput, processStudent, resolveStudentByBarcode, setLookupBusy]
  );

  const startScan = useCallback(
    (rawInput: string) => {
      const code = rawInput.replace(/\r?\n/g, '').trim();
      if (!code) return;

      prepareForHardwareScan();

      const now = Date.now();
      const deduped =
        lastScanRef.current.code === code && now - lastScanRef.current.at < 400;
      if (deduped) {
        return;
      }
      lastScanRef.current = { code, at: now };

      // Cada escaneo es actividad real: mantiene viva la sesión del tutor (cliente
      // y servidor) aunque no toque la pantalla, evitando cierres a los 15 min.
      sessionService.touchActivity();
      authService.renewSessionThrottled();
      setBarcode('');
      const scanSeq = ++latestProfileScanRef.current;
      void processScanCode(code, scanSeq);
    },
    [processScanCode, prepareForHardwareScan]
  );

  startScanRef.current = startScan;

  const flushHardwareSink = useCallback((suffix = '') => {
    const code = (hardwareSinkBufferRef.current + suffix).replace(/\r?\n/g, '').trim();
    hardwareSinkBufferRef.current = '';
    if (hardwareScanInputRef.current) {
      hardwareScanInputRef.current.value = '';
    }
    if (code.length >= 4) startScanRef.current(code);
  }, []);

  useHardwareBarcodeCapture({
    enabled: !showIncidentDialog,
    onScan: startScan,
    maxGapMs: 200,
  });

  const handleNameSearchSelect = async (selected: Student) => {
    prepareForHardwareScan();
    setNameSearchError(null);
    setNameSearchEmpty(false);
    const scanSeq = ++latestProfileScanRef.current;

    let studentToRegister = selected;
    setLookupBusy(true);
    try {
      if (selected.barcode?.trim()) {
        const full = await resolveStudentByBarcode(selected.barcode.trim());
        if (full) studentToRegister = full;
      } else {
        const { student, error } = await studentsService.getById(selected.id);
        if (student) {
          studentToRegister = student;
        } else if (error) {
          toast.error(error);
        }
      }
    } finally {
      setLookupBusy(false);
    }

    processStudent(studentToRegister, scanSeq);
  };

  const handleNameSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      if (e.key.length === 1 && /^[0-9A-Za-z]$/.test(e.key)) {
        if (now - nameBarcodeBufferRef.current.lastAt > 200) {
          nameBarcodeBufferRef.current.buf = '';
        }
        nameBarcodeBufferRef.current.buf += e.key;
        nameBarcodeBufferRef.current.lastAt = now;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const rapidCode = nameBarcodeBufferRef.current.buf.trim();
        nameBarcodeBufferRef.current.buf = '';
        if (rapidCode.length >= 8 && /^\d+$/.test(rapidCode)) {
          e.preventDefault();
          setNameSearch('');
          setNameSearchResults([]);
          startScan(rapidCode);
          return;
        }
      }
    }

    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = nameSearch.trim();
    if (q.length < 2) return;

    if (nameSearchResults.length === 1) {
      void handleNameSearchSelect(nameSearchResults[0]);
      return;
    }

    setNameSearching(true);
    setNameSearchError(null);
    try {
      const { students, error } = await studentsService.searchForTutorScanner(q);
      if (error) {
        toast.error(error);
        return;
      }
      if (students.length === 1) {
        void handleNameSearchSelect(students[0]);
        return;
      }
      if (students.length > 1) {
        setNameSearchResults(students);
        setNameSearchEmpty(false);
        return;
      }

      const digits = q.replace(/\D/g, '');
      if (digits.length >= 4) {
        const { student, error: dniError } = await studentsService.lookupByBarcodeOrDni(q, {
          skipReincidence: true,
        });
        if (student) {
          setNameSearch('');
          setNameSearchResults([]);
          setNameSearchEmpty(false);
          processStudent(student, ++latestProfileScanRef.current);
        } else if (dniError) {
          toast.error(dniError);
        } else {
          setNameSearchEmpty(true);
        }
      } else {
        setNameSearchResults([]);
        setNameSearchEmpty(true);
      }
    } finally {
      setNameSearching(false);
    }
  };

  const handleNameSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/[\r\n]/.test(v)) {
      const code = v.replace(/\r?\n/g, '').trim();
      setNameSearch('');
      setNameSearchResults([]);
      if (code.length >= 4) startScan(code);
      return;
    }
    // Si el lector escanea con foco en búsqueda, la ráfaga llega al input de nombre.
    if (v.length >= 4 && v.length - nameSearch.length >= 4 && /^[0-9A-Za-z]+$/.test(v.trim())) {
      const code = v.trim();
      setNameSearch('');
      setNameSearchResults([]);
      startScan(code);
      return;
    }
    setNameSearch(v);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode;
    setBarcode('');
    startScan(code);
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/[\r\n]/.test(v)) {
      const code = v.replace(/\r?\n/g, '').trim();
      setBarcode('');
      if (code) startScan(code);
      return;
    }
    setBarcode(v);
  };

  const handleRegisterFault = () => {
    if (!student) {
      toast.error('Debe escanear un estudiante primero');
      return;
    }
    setShowIncidentDialog(true);
  };

  const submitIncident = async (faultTypeId: number, obs?: string) => {
    if (!student || !isMountedRef.current) return false;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Usuario no autenticado');
      return false;
    }

    const { error } = await incidentsService.create({
      studentId: student.id,
      faultTypeId,
      registeredBy: currentUser.id,
      observations: obs?.trim() || undefined,
    });

    if (!isMountedRef.current) return false;

    if (error) {
      toast.error(error, { duration: 3200 });
      return false;
    }

    toast.success('Incidencia registrada');
    invalidateIncidents();
    invalidateStudents();
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentIncidents() });
    setShowIncidentDialog(false);
    setSelectedFault('');
    setObservations('');
    setQuickFaultId(null);
    setStudent(null);
    setShowStudentProfile(false);
    setArrivalRecord(null);
    setBarcode('');
    focusBarcodeInput();
    return true;
  };

  const handleQuickIncident = async (faultId: number) => {
    if (!student || registering) return;
    setQuickFaultId(faultId);
    setRegistering(true);
    try {
      await submitIncident(faultId);
    } finally {
      if (isMountedRef.current) {
        setRegistering(false);
        setQuickFaultId(null);
      }
    }
  };

  const handleSubmitIncident = async () => {
    if (!student || !selectedFault || !isMountedRef.current) {
      if (!isMountedRef.current) return;
      toast.error('Debe seleccionar una falta');
      return;
    }

    setRegistering(true);
    try {
      await submitIncident(parseInt(selectedFault, 10), observations);
    } catch {
      if (!isMountedRef.current) return;
      toast.error('Error al registrar incidencia');
    } finally {
      if (isMountedRef.current) {
        setRegistering(false);
      }
    }
  };

  const clearScan = () => {
    setBarcode('');
    setNameSearch('');
    setNameSearchResults([]);
    setStudent(null);
    displayedStudentIdRef.current = null;
    showStudentProfileRef.current = false;
    setShowStudentProfile(false);
    setArrivalRecord(null);
    releaseScanFocus();
  };

  clearScanRef.current = clearScan;

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      clearScan();
    }
  };

  const closeStudentProfile = () => {
    showStudentProfileRef.current = false;
    displayedStudentIdRef.current = null;
    setShowStudentProfile(false);
    setStudent(null);
    setArrivalRecord(null);
    setBarcode('');
    setNameSearch('');
    setNameSearchResults([]);
    releaseScanFocus();
  };

  const arrivalOnTime = arrivalRecord?.status === 'A tiempo';
  const displayArrivalTime =
    arrivalRecord?.arrivalTime?.length && arrivalRecord.arrivalTime.length >= 5
      ? arrivalRecord.arrivalTime.slice(0, 5)
      : arrivalRecord?.arrivalTime ?? '—:—';
  const limitsLabel = `Prim ${arrivalLimits.primaria} · Sec ${arrivalLimits.secundaria}`;
  const activeArrivalLimit = student
    ? resolveArrivalLimitForLevel(arrivalLimits, student.level)
    : arrivalLimits.general;
  const limitTone = useMemo(() => {
    if (!nowHHMM) return 'secondary' as const;
    return compareArrivalStatus(nowHHMM, activeArrivalLimit) === 'A tiempo'
      ? ('success' as const)
      : ('warning' as const);
  }, [nowHHMM, activeArrivalLimit]);

  return (
    <div
      className={cn(
        'tutor-page',
        touchTablet && 'tutor-page--touch',
        showStudentProfile && touchTablet && 'tutor-page--profile-open',
      )}
    >
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {scanAnnouncement}
      </div>
      {/* Receptor oculto del lector Bluetooth: mantiene foco con el perfil abierto en tablet/móvil */}
      <input
        ref={hardwareScanInputRef}
        id="tutor-hardware-scan-sink"
        type="text"
        inputMode="none"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        tabIndex={-1}
        className="tutor-hardware-scan-sink"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            flushHardwareSink();
          }
        }}
        onChange={(e) => {
          const raw = e.target.value;
          e.target.value = '';
          if (/[\r\n]/.test(raw)) {
            flushHardwareSink(raw);
            return;
          }
          hardwareSinkBufferRef.current += raw;
        }}
      />
      <header className="tutor-header">
        <div className="tutor-header__inner">
          <div className="tutor-header__brand">
            <div className="tutor-header__shield p-1" aria-hidden>
              <GuardyMark size="sm" />
            </div>
            <div className="min-w-0">
              <p className="tutor-header__title">Control de asistencia</p>
              <p className="tutor-header__subtitle hidden sm:block">SIE — Sistema de Incidencias Escolares</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Badge
              variant={limitTone}
              className={cn('text-[10px] px-2 py-0.5 shrink-0', !touchTablet && 'lg:hidden')}
            >
              {nowHHMM || '—:—'}
            </Badge>
            <span className="tutor-header__user">{user?.fullName}</span>
            <Badge
              variant="outline"
              className="sm:hidden border-[var(--tutor-lead)] bg-[var(--tutor-graphite)] text-[var(--tutor-starlight)] text-xs max-w-[100px] truncate"
            >
              {user?.fullName?.split(' ')[0]}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleLogout}
              className="tutor-header__logout border-[var(--tutor-lead)] bg-transparent text-[var(--tutor-starlight)] hover:bg-[var(--tutor-graphite)] hover:text-[var(--tutor-starlight)]"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>

        {/* Barra de sesión — solo móvil */}
        <div
          className={cn('tutor-mobile-bar', !touchTablet && 'lg:hidden')}
          aria-label="Estado de la sesión"
        >
          <div className="tutor-mobile-bar__strip">
            <div className="tutor-mobile-bar__stat">
              <span className="tutor-mobile-bar__stat-val">{sessionCount.total}</span>
              <span className="tutor-mobile-bar__stat-lbl">Total</span>
            </div>
            <span className="tutor-mobile-bar__divider" aria-hidden />
            <div className="tutor-mobile-bar__stat tutor-mobile-bar__stat--ok">
              <span className="tutor-mobile-bar__stat-val">{sessionCount.onTime}</span>
              <span className="tutor-mobile-bar__stat-lbl">A tiempo</span>
            </div>
            <span className="tutor-mobile-bar__divider" aria-hidden />
            <div className="tutor-mobile-bar__stat tutor-mobile-bar__stat--late">
              <span className="tutor-mobile-bar__stat-val">{sessionCount.late}</span>
              <span className="tutor-mobile-bar__stat-lbl">Tarde</span>
            </div>
            <div className="tutor-mobile-bar__limit">
              <span className="tutor-mobile-bar__limit-lbl">Límite</span>
              <span className="tutor-mobile-bar__limit-val">{limitsLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="tutor-main">
        <div className="tutor-grid">
          <section className="tutor-left">
            <div
              className={cn(
                'tutor-scan-card',
                nameSearchResults.length > 0 && touchTablet && 'tutor-scan-card--search-open',
              )}
            >
              <div className="tutor-scan-card__head">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <ScanLine className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
                        Registro de llegada
                      </p>
                      <Badge variant={limitTone} className="text-[10px]">
                        Límite {limitsLabel}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                      Escanear o buscar estudiante
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed hidden sm:block">
                      Carnet con lector de barras o búsqueda manual por nombre del estudiante.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed sm:hidden">
                      Conecte el lector por Bluetooth o adaptador: escanee carnets seguidos sin tocar la pantalla.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="p-5 sm:p-7 pt-5 sm:pt-6">
                <form
                  onSubmit={handleScan}
                  className="space-y-5"
                  aria-busy={lookupPending}
                  aria-label="Registro de llegada por código de barras o nombre"
                >
                  <div className="space-y-2">
                    <Label htmlFor="barcode-input" className="text-sm font-medium text-foreground">
                      Código de barras
                    </Label>
                    <Input
                      ref={barcodeInputRef}
                      id="barcode-input"
                      type="text"
                      inputMode={touchBarcode ? (barcodeKeyboard ? 'numeric' : 'none') : 'text'}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={barcode}
                      onChange={handleBarcodeChange}
                      onKeyDown={handleBarcodeKeyDown}
                      onPointerDown={() => {
                        markManualEntry();
                        if (touchBarcode) setBarcodeKeyboard(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          const active = document.activeElement;
                          if (
                            active?.id === 'barcode-input' ||
                            active?.id === 'name-search-input'
                          ) {
                            return;
                          }
                          manualEntryActiveRef.current = false;
                          setBarcodeKeyboard(false);
                          if (touchBarcode && showStudentProfileRef.current && !showIncidentDialog) {
                            hardwareScanInputRef.current?.focus({ preventScroll: true });
                          }
                        }, 150);
                      }}
                      autoComplete="off"
                      autoFocus={!touchBarcode}
                      placeholder="Escanee el carnet o escriba DNI…"
                      aria-describedby="barcode-scan-hint"
                      className="tutor-scan-input"
                    />
                    <div id="barcode-scan-hint" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="sm:hidden rounded-full border border-primary/25 bg-primary/5 px-2 py-1">
                        Lector Bluetooth listo
                      </span>
                      <span className="hidden sm:inline rounded-full border border-border bg-muted/20 px-2 py-1 font-mono">
                        Enter
                      </span>
                      <span className="hidden sm:inline">Registrar</span>
                      <span className="hidden sm:inline mx-1">·</span>
                      <span className="rounded-full border border-border bg-muted/20 px-2 py-1 font-mono">
                        Esc
                      </span>
                      <span>Limpiar</span>
                      <span className="mx-1 hidden sm:inline">·</span>
                      <span className="hidden sm:inline">
                        Siguiente carnet sin cerrar perfil
                      </span>
                      <span className="mx-1 hidden sm:inline">·</span>
                      <span className="hidden sm:inline">
                        Perfil se oculta a los 45 s sin actividad
                      </span>
                    </div>
                  </div>

                  <div className="relative space-y-2" data-tutor-name-search>
                    <Label htmlFor="name-search-input" className="text-sm font-medium text-foreground">
                      Buscar por nombre o DNI
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name-search-input"
                        type="text"
                        value={nameSearch}
                        onChange={handleNameSearchChange}
                        onKeyDown={handleNameSearchKeyDown}
                        onPointerDown={markManualEntry}
                        onBlur={() => {
                          window.setTimeout(() => {
                            const active = document.activeElement;
                            if (
                              active?.id === 'name-search-input' ||
                              active?.id === 'barcode-input' ||
                              active?.closest('[data-tutor-name-search]')
                            ) {
                              return;
                            }
                            manualEntryActiveRef.current = false;
                            if (showStudentProfileRef.current) {
                              focusBarcodeInput();
                            }
                          }, 150);
                        }}
                        placeholder="Nombre, apellido o DNI…"
                        autoComplete="off"
                        enterKeyHint="search"
                        inputMode={isDniLikeQuery(nameSearch) ? 'numeric' : 'text'}
                        disabled={lookupPending}
                        className="tutor-field-input pl-9 min-h-12 sm:min-h-10"
                        aria-describedby="name-search-hint"
                        aria-expanded={nameSearchResults.length > 0}
                        aria-controls="name-search-results"
                      />
                      {nameSearching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p id="name-search-hint" className="text-xs text-muted-foreground">
                      Escriba nombre, apellido o DNI. Cada palabra filtra (ej. &quot;huamani rey&quot;). Hasta{' '}
                      {TUTOR_NAME_SEARCH_LIMIT} resultados.
                    </p>
                    {nameSearchResults.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground">
                        {nameSearchResults.length} estudiante{nameSearchResults.length === 1 ? '' : 's'} — toque el correcto
                      </p>
                    )}
                    {nameSearchError && (
                      <p className="text-xs text-destructive" role="alert">
                        {nameSearchError}
                      </p>
                    )}
                    {nameSearchEmpty && !nameSearching && (
                      <p className="text-xs text-muted-foreground">No se encontraron estudiantes activos.</p>
                    )}
                    {nameSearchResults.length > 0 && (
                      <div
                        id="name-search-results"
                        role="listbox"
                        className={cn(
                          'tutor-name-search-results w-full rounded-xl border border-border bg-popover shadow-xl',
                          nameSearchScrollable && 'tutor-name-search-results--scroll',
                        )}
                      >
                        {nameSearchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            role="option"
                            onClick={() => handleNameSearchSelect(result)}
                            className="tutor-name-search-results__row flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-4 sm:py-4"
                          >
                            <StudentPhoto
                              src={result.profilePhoto}
                              name={result.fullName}
                              className="tutor-name-search-results__photo h-16 w-16 shrink-0 rounded-xl sm:h-[4.5rem] sm:w-[4.5rem]"
                              imageClassName="object-cover object-center"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-base leading-snug text-foreground sm:text-lg">
                                {result.fullName}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                                <span className="font-mono font-semibold text-foreground/90">
                                  DNI {result.barcode || '—'}
                                </span>
                                <span aria-hidden>·</span>
                                <span>
                                  {result.level} · {result.grade} &apos;{result.section}&apos;
                                </span>
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearScan}
                      disabled={lookupPending}
                      className="sm:min-w-[120px]"
                    >
                      Limpiar
                    </Button>
                    <Button
                      type="submit"
                      disabled={lookupPending || !barcode.trim()}
                      className="sm:min-w-[180px]"
                    >
                      {lookupPending ? (
                        <>
                          <Clock className="h-4 w-4 animate-spin" />
                          Buscando…
                        </>
                      ) : (
                        <>
                          <Barcode className="h-4 w-4" />
                          Registrar llegada
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </div>
          </section>

          <aside className="tutor-right">
            {showStudentProfile && student && (
              <>
                <button
                  type="button"
                  className={cn('tutor-student-backdrop', !touchTablet && 'lg:hidden')}
                  aria-label="Cerrar perfil del estudiante"
                  onClick={closeStudentProfile}
                />
                <div
                  key={student.id}
                  ref={studentCardRef}
                  className={`tutor-student-card ${arrivalOnTime ? 'tutor-student-card--ontime' : 'tutor-student-card--late'}`}
                  role="region"
                  aria-label={`Registro de ${student.fullName}`}
                >
                <div className="tutor-student-card__banner" aria-hidden />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="tutor-student-card__close"
                  onClick={closeStudentProfile}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Cerrar</span>
                </Button>

                <div className="tutor-student-card__scroll">
                <div className="tutor-student-card__hero-sticky">
                  <div className="tutor-identity tutor-identity--sheet">
                    <div className="tutor-identity__photo-frame">
                      <StudentPhoto
                        src={student.profilePhoto}
                        name={student.fullName}
                        priority="auto"
                        className="h-full w-full rounded-2xl"
                        imageClassName="object-cover object-[center_20%]"
                      />
                    </div>
                    <div className="tutor-identity__meta">
                      <Badge
                        variant={arrivalOnTime ? 'success' : 'warning'}
                        className="tutor-student-card__status"
                      >
                        {arrivalRecord?.status ?? 'Registrado'} · {displayArrivalTime}
                      </Badge>
                      <h3 className="tutor-identity__name">{student.fullName}</h3>
                      <p className="tutor-identity__grade">
                        {student.level} · {student.grade} &apos;{student.section}&apos;
                      </p>
                      <p className="tutor-identity__dni font-mono">{student.barcode || '—'}</p>
                    </div>
                  </div>
                </div>
                  {/* Horario del salón */}
                  {studentSchedule && (
                    <div
                      className={`tutor-schedule tutor-schedule--${studentSchedule.phase}`}
                      aria-label="Horario del salón"
                    >
                      <div className="tutor-schedule__head">
                        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="font-semibold text-sm">Horario del salón</span>
                        <Badge variant={scheduleBadgeVariant} className="ml-auto text-[10px]">
                          {studentSchedule.phaseLabel}
                        </Badge>
                      </div>
                      {!studentSchedule.shouldBeAtSchool &&
                        studentSchedule.phase === 'after_school' &&
                        nowHHMM >= schoolCloseTime && (
                          <p className="tutor-schedule__alert">
                            Fuera de jornada — verifique si tiene taller o permiso especial.
                          </p>
                        )}
                    </div>
                  )}

                  {/* Reporte rápido */}
                  {quickFaults.length > 0 && (
                    <div className="tutor-quick-report">
                      <p className="tutor-quick-report__title">
                        <Zap className="h-4 w-4" aria-hidden />
                        Reporte rápido
                      </p>
                      <div className="tutor-quick-report__grid">
                        {quickFaults.map((fault) => (
                          <Button
                            key={fault.id}
                            type="button"
                            variant={fault.severity === 'Grave' ? 'destructive' : 'secondary'}
                            size="sm"
                            disabled={registering}
                            className="tutor-quick-report__btn h-auto min-h-[2.75rem] py-2 text-left text-xs leading-snug whitespace-normal"
                            onClick={() => handleQuickIncident(fault.id)}
                          >
                            {registering && quickFaultId === fault.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            ) : null}
                            {fault.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="tutor-student-card__actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={closeStudentProfile}
                      className="tutor-student-card__btn-next"
                    >
                      Siguiente estudiante
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      onClick={handleRegisterFault}
                      className="tutor-student-card__btn-incident gap-2"
                    >
                      <AlertCircle className="h-5 w-5" />
                      Otra incidencia…
                    </Button>
                  </div>
                </div>
                </div>
              </>
            )}
            <div className={cn('tutor-side-stack', touchTablet ? 'hidden' : 'hidden lg:block')}>
            <div className="tutor-side-card">
              <div className="tutor-side-card__head">
                <CardTitle className="text-base font-semibold">Estado del turno</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hora local Lima y conteo de registros en esta sesión.
                </p>
              </div>
              <div className="tutor-meta">
                <div className="tutor-meta__item">
                  <p className="tutor-meta__k">Hora actual</p>
                  <p className="tutor-meta__v">{nowHHMM || '—:—'}</p>
                </div>
                <div className="tutor-meta__item">
                  <p className="tutor-meta__k">Límite Primaria</p>
                  <p className="tutor-meta__v">{arrivalLimits.primaria}</p>
                </div>
                <div className="tutor-meta__item">
                  <p className="tutor-meta__k">Límite Secundaria</p>
                  <p className="tutor-meta__v">{arrivalLimits.secundaria}</p>
                </div>
              </div>
              <div className="tutor-kpis">
                <div className="tutor-kpi">
                  <p className="tutor-kpi__value">{sessionCount.total}</p>
                  <p className="tutor-kpi__label">Total</p>
                </div>
                <div className="tutor-kpi">
                  <p className="tutor-kpi__value">{sessionCount.onTime}</p>
                  <p className="tutor-kpi__label">A tiempo</p>
                </div>
                <div className="tutor-kpi">
                  <p className="tutor-kpi__value">{sessionCount.late}</p>
                  <p className="tutor-kpi__label">Tarde</p>
                </div>
              </div>
            </div>

            <div className="tutor-side-card">
              <div className="tutor-side-card__head">
                <CardTitle className="text-base font-semibold">Últimos escaneos</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Historial rápido (máx. 6).</p>
              </div>
              <div className="tutor-feed">
                {recentScans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay registros en esta sesión. Escanea el primer carnet para empezar.
                  </p>
                ) : (
                  recentScans.map((row) => (
                    <div key={row.id} className="tutor-feed__row">
                      <span className="tutor-feed__name">{row.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tutor-feed__time">{row.time}</span>
                        <Badge variant={row.status === 'A tiempo' ? 'success' : row.status === 'Tarde' ? 'warning' : 'secondary'}>
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Card className="tutor-instructions">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Instrucciones</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-5">
                <ol>
                  <li>
                    <span className="tutor-instructions__step">1</span>
                    <span>
                      Escanee el código de barras del carnet o busque al estudiante por nombre.
                    </span>
                  </li>
                  <li>
                    <span className="tutor-instructions__step">2</span>
                    <span>El sistema registrará automáticamente la hora de llegada.</span>
                  </li>
                  <li>
                    <span className="tutor-instructions__step">3</span>
                    <span>
                      Si detecta una falta (uniforme, conducta, etc.), use{' '}
                      <strong className="text-foreground font-medium">Registrar incidencia</strong>.
                    </span>
                  </li>
                  <li>
                    <span className="tutor-instructions__step">4</span>
                    <span>Complete el tipo de falta y guarde el registro.</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
            </div>
          </aside>
        </div>

        {/* Historial reciente colapsable — solo móvil */}
        <details className={cn('tutor-mobile-feed', !touchTablet && 'lg:hidden')}>
          <summary className="tutor-mobile-feed__summary">
            Últimos escaneos
            {sessionCount.total > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {sessionCount.total}
              </Badge>
            )}
          </summary>
          <div className="tutor-feed tutor-mobile-feed__body">
            {recentScans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Aún no hay registros en esta sesión.
              </p>
            ) : (
              recentScans.map((row) => (
                <div key={row.id} className="tutor-feed__row">
                  <span className="tutor-feed__name">{row.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tutor-feed__time">{row.time}</span>
                    <Badge variant={row.status === 'A tiempo' ? 'success' : row.status === 'Tarde' ? 'warning' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      </main>

      <Dialog
        open={showIncidentDialog}
        onOpenChange={(open) => {
          setShowIncidentDialog(open);
          if (!open) {
            setSelectedFault('');
            setObservations('');
            focusBarcodeInput();
          }
        }}
      >
        <DialogContent className="tutor-dialog sm:max-w-md rounded-[28px] max-h-[90dvh] overflow-y-auto" data-tutor-incident-dialog>
          <DialogHeader>
            <DialogTitle>Registrar incidencia</DialogTitle>
            <DialogDescription>
              Estudiante: <span className="font-medium text-foreground">{student?.fullName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de falta</Label>
              <Select value={selectedFault} onValueChange={setSelectedFault}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar falta" />
                </SelectTrigger>
                <SelectContent>
                  {faults.map((fault) => (
                    <SelectItem key={fault.id} value={fault.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={fault.severity === 'Grave' ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {fault.severity}
                        </Badge>
                        <span>{fault.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                className="tutor-field-input resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowIncidentDialog(false);
                setSelectedFault('');
                setObservations('');
                focusBarcodeInput();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmitIncident}
              disabled={!selectedFault || registering}
            >
              {registering ? 'Guardando…' : 'Guardar incidencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
