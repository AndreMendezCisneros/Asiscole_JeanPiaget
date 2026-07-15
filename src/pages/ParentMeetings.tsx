import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  CalendarDays,
  Users,
  TrendingUp,
  Scan,
  ScanLine,
  Calendar as CalendarIcon,
  List,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  UserX,
  RefreshCw,
  PhoneCall,
} from 'lucide-react';
import { ModernCalendar } from '@/components/calendar/ModernCalendar';
import { parentMeetingsService, studentsService } from '@/lib/services';
import { ParentMeeting, Student, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authService } from '@/lib/services';
import { format, addMonths, subMonths } from 'date-fns';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { es } from 'date-fns/locale';
import {
  formatDateKeyLima,
  getLimaTodayDate,
  parseMeetingDateTime,
} from '@/lib/utils/limaDateTime';

const meetingFormSchema = z
  .object({
    id_estudiante: z.number().optional(),
    motivo: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
    fecha: z.string().min(1, 'La fecha es requerida'),
    hora: z.string().min(1, 'La hora es requerida'),
    notas: z.string().optional(),
    tipo: z.enum(['individual', 'all', 'grade', 'section', 'students']).default('individual'),
    grade: z.string().optional(),
    section: z.string().optional(),
    level: z.string().optional(),
    studentIds: z.array(z.number()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'individual' && (!data.id_estudiante || data.id_estudiante < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar un estudiante',
        path: ['id_estudiante'],
      });
    }
    if (data.tipo === 'grade' && !data.grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar un grado',
        path: ['grade'],
      });
    }
    if (data.tipo === 'section' && !data.level) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar el nivel educativo',
        path: ['level'],
      });
    }
    if (data.tipo === 'section' && !data.grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar un grado',
        path: ['grade'],
      });
    }
    if (data.tipo === 'section' && !data.section) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar una sección',
        path: ['section'],
      });
    }
  });

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

const individualMeetingDefaults: MeetingFormValues = {
  id_estudiante: 0,
  motivo: '',
  fecha: '',
  hora: '',
  notas: '',
  tipo: 'individual',
  grade: undefined,
  section: undefined,
  level: undefined,
  studentIds: undefined,
};

const bulkMeetingDefaults: MeetingFormValues = {
  id_estudiante: 0,
  motivo: '',
  fecha: '',
  hora: '',
  notas: '',
  tipo: 'all',
  grade: undefined,
  section: undefined,
  level: undefined,
  studentIds: undefined,
};

export const ParentMeetings = () => {
  const [meetings, setMeetings] = useState<ParentMeeting[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const debouncedStudentSearch = useDebouncedValue(studentPickerSearch, 350);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ParentMeeting | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ParentMeeting['estado']>('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{
    total: number;
    pendientes: number;
    confirmadas: number;
    completadas: number;
    noAsistieron: number;
    tasaAsistencia: number;
  } | null>(null);
  const isMountedRef = useRef(true);

  const scanTargetDate = useMemo(
    () => formatDateKeyLima(selectedDate ?? new Date()),
    [selectedDate],
  );

  const meetingsDateRange = useMemo(() => {
    const anchor = selectedDate ?? new Date();
    return {
      fechaDesde: formatDateKeyLima(subMonths(anchor, 1)),
      fechaHasta: formatDateKeyLima(addMonths(anchor, 2)),
    };
  }, [selectedDate]);

  const openIndividualDialog = () => {
    form.reset(individualMeetingDefaults);
    setDialogOpen(true);
  };

  const openIndividualDialogWithSchedule = (date: Date, time?: string) => {
    form.reset({
      ...individualMeetingDefaults,
      fecha: format(date, 'yyyy-MM-dd'),
      hora: time ?? '',
    });
    setDialogOpen(true);
  };

  const openBulkDialog = () => {
    form.reset(bulkMeetingDefaults);
    setBulkDialogOpen(true);
  };

  const focusMeetingsOnDate = (fecha: string) => {
    const [year, month, day] = fecha.split('-').map(Number);
    if (year && month && day) {
      setSelectedDate(new Date(year, month - 1, day));
    }
    setViewMode('list');
  };

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      id_estudiante: 0,
      motivo: '',
      fecha: '',
      hora: '',
      notas: '',
      tipo: 'individual',
    },
  });

  useEffect(() => {
    isMountedRef.current = true;
    loadMeetings();
    loadStats();

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, meetingsDateRange.fechaDesde, meetingsDateRange.fechaHasta]);

  useEffect(() => {
    if (!dialogOpen) {
      setStudentPickerSearch('');
      setStudents([]);
      return;
    }

    if (debouncedStudentSearch.trim().length < 2) {
      setStudents([]);
      return;
    }

    let cancelled = false;
    setStudentsLoading(true);

    void studentsService.searchByName(debouncedStudentSearch, 25).then(({ students: list, error }) => {
      if (cancelled) return;
      if (error) toast.error(error);
      setStudents(list);
      setStudentsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, debouncedStudentSearch]);

  const loadMeetings = async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    try {
      const { meetings: meetingsList, error } = await parentMeetingsService.getAll({
        estado: statusFilter === 'all' ? undefined : statusFilter,
        fechaDesde: meetingsDateRange.fechaDesde,
        fechaHasta: meetingsDateRange.fechaHasta,
      });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error('Error al cargar citas');
        setMeetings([]);
      } else {
        setMeetings(meetingsList);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error loading meetings:', error);
      toast.error('Error al procesar las citas');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadStats = async () => {
    if (!isMountedRef.current) return;
    
    try {
      const { stats: statsData } = await parentMeetingsService.getStats();
      if (!isMountedRef.current) return;
      if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error loading stats:', error);
    }
  };

  const onSubmit = async (data: MeetingFormValues) => {
    if (!isMountedRef.current) return;
    
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para crear citas');
      return;
    }

    setLoading(true);

    try {
      const isBulk = bulkDialogOpen || data.tipo !== 'individual';

      if (isBulk) {
        const { success, count, error } = await parentMeetingsService.createBulk({
          motivo: data.motivo,
          fecha: data.fecha,
          hora: data.hora,
          id_usuario_creador: currentUser.id,
          notas: data.notas,
          tipo: data.tipo,
          grade: data.grade,
          section: data.section,
          level: data.level,
          studentIds: data.studentIds,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
        } else if (!success) {
          toast.error('No se pudieron crear las citas masivas');
        } else {
          toast.success(`${count} citas creadas exitosamente`);
          setBulkDialogOpen(false);
          form.reset();
          focusMeetingsOnDate(data.fecha);
          loadMeetings();
          loadStats();
        }
      } else {
        // Cita individual
        if (!data.id_estudiante) {
          toast.error('Debe seleccionar un estudiante');
          setLoading(false);
          return;
        }

        const { meeting, error } = await parentMeetingsService.create({
          id_estudiante: data.id_estudiante,
          motivo: data.motivo,
          fecha: data.fecha,
          hora: data.hora,
          id_usuario_creador: currentUser.id,
          notas: data.notas,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
        } else {
          toast.success('Cita creada exitosamente');
          setDialogOpen(false);
          form.reset();
          loadMeetings();
          loadStats();
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en onSubmit:', error);
      toast.error('Error al crear cita');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleMarkAttendance = async (meetingId: number, asistio: boolean, llegadaTarde?: boolean) => {
    if (!isMountedRef.current) return;
    
    try {
      const { success, error } = await parentMeetingsService.markAttendance(meetingId, asistio, llegadaTarde);
      if (!isMountedRef.current) return;
      
      if (error) {
        toast.error(error);
      } else {
        const mensaje = llegadaTarde 
          ? 'Asistencia registrada (llegó tarde)' 
          : asistio 
          ? 'Asistencia registrada' 
          : 'Marcado como no asistió';
        toast.success(mensaje);
        loadMeetings();
        loadStats();
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en handleMarkAttendance:', error);
      toast.error('Error al registrar asistencia');
    }
  };

  const handleBarcodeScan = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();

    if (!barcodeInput.trim()) {
      toast.error('Por favor ingrese o escanee el código de barras');
      return;
    }

    setScanning(true);
    try {
      const { success, meetingId, error } = await parentMeetingsService.markAttendanceByBarcode(
        barcodeInput.trim(),
        false,
        scanTargetDate,
      );

      if (error) {
        toast.error(error);
      } else if (success) {
        toast.success('Asistencia registrada exitosamente');
        setBarcodeInput('');
        loadMeetings();
        loadStats();
      }
    } catch (error: any) {
      toast.error('Error al procesar el código de barras');
      console.error('Error:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (meetingId: number, nuevoEstado: ParentMeeting['estado']) => {
    const { success, error } = await parentMeetingsService.update(meetingId, { estado: nuevoEstado });
    if (error) {
      toast.error(error);
    } else {
      toast.success('Estado actualizado');
      loadMeetings();
      loadStats();
    }
  };

  const filteredMeetings = meetings.filter((meeting) => {
    const studentName = meeting.student?.fullName ?? '';
    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase());

    if (viewMode === 'calendar' && selectedDate) {
      const meetingDay = meeting.fecha.slice(0, 10);
      const selectedKey = formatDateKeyLima(selectedDate);
      return matchesSearch && meetingDay === selectedKey;
    }

    return matchesSearch;
  });

  // Agrupar citas con el mismo motivo+fecha+hora en un solo evento (citas masivas).
  // Los grupos con 1 sola cita se tratan como individuales.
  type MeetingGroup = {
    key: string;
    motivo: string;
    fecha: string;
    hora: string;
    isBulk: boolean;
    meetings: ParentMeeting[];
    pendientes: number;
    confirmadas: number;
    completadas: number;
    noAsistieron: number;
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const meetingGroups = useMemo<MeetingGroup[]>(() => {
    const map = new Map<string, ParentMeeting[]>();
    for (const m of filteredMeetings) {
      const k = `${m.motivo}||${m.fecha}||${m.hora}`;
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([key, arr]) => ({
      key,
      motivo: arr[0].motivo,
      fecha: arr[0].fecha,
      hora: arr[0].hora,
      isBulk: arr.length > 1,
      meetings: arr,
      pendientes: arr.filter(m => m.estado === 'Pendiente').length,
      confirmadas: arr.filter(m => m.estado === 'Confirmada').length,
      completadas: arr.filter(m => m.estado === 'Completada').length,
      noAsistieron: arr.filter(m => m.estado === 'No asistió').length,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMeetings]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Citas donde el padre no asistió, agrupadas por evento
  type MissedGroup = {
    key: string;
    motivo: string;
    fecha: string;
    hora: string;
    meetings: ParentMeeting[];
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [expandedMissed, setExpandedMissed] = useState<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const missedGroups = useMemo<MissedGroup[]>(() => {
    const noShow = meetings.filter(m => m.estado === 'No asistió');
    const map = new Map<string, ParentMeeting[]>();
    for (const m of noShow) {
      const k = `${m.motivo}||${m.fecha}||${m.hora}`;
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([key, arr]) => ({ key, motivo: arr[0].motivo, fecha: arr[0].fecha, hora: arr[0].hora, meetings: arr }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings]);

  const toggleMissed = (key: string) =>
    setExpandedMissed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const handleReschedule = (meeting: ParentMeeting) => {
    // Pre-rellenar formulario individual con el mismo motivo para el mismo estudiante
    form.reset({
      id_estudiante: meeting.studentId,
      motivo: meeting.motivo,
      fecha: '',
      hora: '',
      notas: `Reprogramado por inasistencia el ${format(new Date(meeting.fecha), 'dd/MM/yyyy', { locale: es })}`,
      tipo: 'individual',
    });
    setDialogOpen(true);
  };

  const getMeetingColor = (estado: ParentMeeting['estado']) => {
    switch (estado) {
      case 'Pendiente':
        return 'amber' as const;
      case 'Confirmada':
        return 'blue' as const;
      case 'Completada':
        return 'green' as const;
      default:
        return 'gray' as const;
    }
  };

  const calendarEvents = meetings.map((m) => {
    const { start, end } = parseMeetingDateTime(m.fecha, m.hora);
    return {
      id: m.id,
      title: m.motivo,
      start,
      end,
      student: m.student
        ? {
            id: m.student.id,
            fullName: m.student.fullName,
            grade: m.student.grade,
            section: m.student.section,
          }
        : undefined,
      estado: m.estado,
      motivo: m.motivo,
      color: getMeetingColor(m.estado),
    };
  });

  const getStatusBadge = (estado: ParentMeeting['estado']) => {
    const variants: Record<ParentMeeting['estado'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      'Pendiente': { variant: 'outline', className: 'border-amber-500 text-amber-700' },
      'Confirmada': { variant: 'default', className: 'bg-blue-100 text-blue-700' },
      'Reprogramada': { variant: 'secondary', className: 'bg-gray-100 text-gray-700' },
      'Completada': { variant: 'default', className: 'bg-green-100 text-green-700' },
      'No asistió': { variant: 'destructive', className: 'bg-red-100 text-red-700' },
      'Cancelada': { variant: 'destructive', className: 'bg-gray-100 text-gray-700' },
    };
    const config = variants[estado];
    return (
      <Badge variant={config.variant} className={config.className}>
        {estado}
      </Badge>
    );
  };

  // Obtener fecha mínima (hoy)
  const getMinDate = () => getLimaTodayDate();

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={CalendarDays}
        eyebrow="Comunicación"
        title="Citas con Padres"
        description="Programe reuniones, confirme asistencia y haga seguimiento del estado de cada cita"
        accent="accent"
      >
        <Button
          variant="outline-primary"
          onClick={() => {
            void (async () => {
              const { exportParentMeetingsExcel } = await import('@/lib/utils/excelListExports');
              await exportParentMeetingsExcel(filteredMeetings);
            })();
          }}
          disabled={filteredMeetings.length === 0}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </PageHeader>

      {/* KPIs */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StaffKpiStat label="Total citas" value={stats.total} icon={CalendarDays} tone="primary" />
          <StaffKpiStat label="Pendientes" value={stats.pendientes} icon={AlertCircle} tone="warning" />
          <StaffKpiStat label="Confirmadas" value={stats.confirmadas} icon={CheckCircle} tone="info" />
          <StaffKpiStat label="Completadas" value={stats.completadas} icon={CheckCircle} tone="success" />
          <StaffKpiStat label="No asistieron" value={stats.noAsistieron} icon={XCircle} tone="warning" />
          <StaffKpiStat
            label="Tasa asistencia"
            value={`${stats.tasaAsistencia}%`}
            icon={TrendingUp}
            tone="accent"
          />
        </div>
      )}

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Registro rápido de asistencia"
          description={`Escanee el DNI o carnet del estudiante. Citas del ${format(new Date(scanTargetDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}`}
          accent="primary"
          action={
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
              <CheckCircle className="mr-1 h-3 w-3" />
              Digital
            </Badge>
          }
        />
        <StaffDataPanelBody className="space-y-4 p-4 sm:p-5">
          <form onSubmit={handleBarcodeScan} className="space-y-4">
            <div className="relative">
              <Scan className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
              <Input
                placeholder="Escanee o ingrese el DNI / código de barras del estudiante"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(e);
                  }
                }}
                className="pl-12 h-14 text-lg font-mono border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
                disabled={scanning}
              />
            </div>
            <Button 
              type="submit" 
              disabled={scanning || !barcodeInput.trim()}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary via-primary-dark to-primary hover:from-primary-dark hover:via-primary hover:to-primary-dark shadow-lg hover:shadow-xl transition-all"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Procesando código de barras...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Registrar Asistencia Automáticamente
                </>
              )}
            </Button>
          </form>
          <div className="rounded-xl border border-info/25 bg-info/10 p-3">
            <p className="text-sm text-foreground/90">
              <strong>Ventajas del sistema digital:</strong> Registro instantáneo, sin papel,
              detección automática de tardanzas y acceso inmediato al historial.
            </p>
          </div>
        </StaffDataPanelBody>
      </StaffDataPanel>

      <StaffToolbar title="Vista y acciones" description="Calendario, lista o citas masivas">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openBulkDialog}>
            <Users className="mr-2 h-4 w-4" />
            Citas masivas
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            Calendario
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="mr-2 h-4 w-4" />
            Lista
          </Button>
          <Button variant="accent" size="sm" onClick={openIndividualDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel className={viewMode === 'calendar' ? 'h-[800px]' : undefined}>
        <StaffDataPanelHeader
          title={viewMode === 'calendar' ? 'Calendario de citas' : 'Buscar citas'}
          accent="neutral"
        />
        <StaffDataPanelBody className={viewMode === 'calendar' ? 'h-[calc(100%-4rem)] p-0' : 'p-4 sm:p-5'}>
          {viewMode === 'calendar' ? (
            <div className="h-full">
              <ModernCalendar
                events={calendarEvents}
                onDateClick={(date) => {
                  setSelectedDate(date);
                  openIndividualDialogWithSchedule(date);
                }}
                onEventClick={(event) => {
                  const meeting = meetings.find(m => m.id === event.id);
                  if (meeting) {
                    setSelectedMeeting(meeting);
                    setViewDialogOpen(true);
                  }
                }}
                onCreateEvent={(date, time) => {
                  setSelectedDate(date);
                  openIndividualDialogWithSchedule(date, time);
                }}
                defaultView="week"
                currentDate={selectedDate || new Date()}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filters para vista de lista */}
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por estudiante..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Confirmada">Confirmada</SelectItem>
                    <SelectItem value="Reprogramada">Reprogramada</SelectItem>
                    <SelectItem value="Completada">Completada</SelectItem>
                    <SelectItem value="No asistió">No asistió</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="accent" onClick={openIndividualDialog}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nueva Cita
                </Button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Cargando citas...</span>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No hay citas para mostrar</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Estudiante / Evento</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Asistencia</TableHead>
                      <TableHead>Puntualidad</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetingGroups.map((group) => {
                      const isExpanded = expandedGroups.has(group.key);
                      if (group.isBulk) {
                        return (
                          <>
                            {/* Fila de cabecera del grupo masivo */}
                            <TableRow
                              key={`group-${group.key}`}
                              className="bg-primary/5 hover:bg-primary/10 cursor-pointer font-medium"
                              onClick={() => toggleGroup(group.key)}
                            >
                              <TableCell>
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-primary" />
                                  : <ChevronRight className="h-4 w-4 text-primary" />}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-primary shrink-0" />
                                  <span>Evento masivo</span>
                                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                                    {group.meetings.length} padres
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                                  {group.pendientes > 0 && <span className="text-amber-600">{group.pendientes} pendientes</span>}
                                  {group.confirmadas > 0 && <span className="text-blue-600">{group.confirmadas} confirmadas</span>}
                                  {group.completadas > 0 && <span className="text-green-600">{group.completadas} completadas</span>}
                                  {group.noAsistieron > 0 && <span className="text-red-600">{group.noAsistieron} no asistieron</span>}
                                </div>
                              </TableCell>
                              <TableCell>{group.motivo}</TableCell>
                              <TableCell>{format(new Date(group.fecha), 'dd/MM/yyyy', { locale: es })}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  {group.hora}
                                </div>
                              </TableCell>
                              <TableCell colSpan={4}>
                                <span className="text-xs text-muted-foreground italic">
                                  {isExpanded ? 'Haz clic para contraer' : 'Haz clic para ver padres'}
                                </span>
                              </TableCell>
                            </TableRow>
                            {/* Filas individuales cuando está expandido */}
                            {isExpanded && group.meetings.map((meeting) => (
                              <TableRow key={meeting.id} className="bg-muted/30">
                                <TableCell />
                                <TableCell className="pl-8 font-medium">
                                  {meeting.student?.fullName}
                                  <div className="text-xs text-muted-foreground">
                                    {meeting.student?.level} · {meeting.student?.grade} {meeting.student?.section}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{meeting.motivo}</TableCell>
                                <TableCell>{format(new Date(meeting.fecha), 'dd/MM/yyyy', { locale: es })}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {meeting.hora}
                                  </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(meeting.estado)}</TableCell>
                                <TableCell>
                                  {meeting.asistencia === null ? (
                                    <span className="text-muted-foreground text-sm">Pendiente</span>
                                  ) : meeting.asistencia ? (
                                    <Badge variant="default" className="bg-green-100 text-green-700">
                                      <CheckCircle className="h-3 w-3 mr-1" />Asistió
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      <XCircle className="h-3 w-3 mr-1" />No asistió
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {meeting.asistencia === true ? (
                                    meeting.llegadaTarde ? (
                                      <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                                        <Clock className="h-3 w-3 mr-1" />Llegó tarde
                                        {meeting.horaLlegadaReal && <span className="ml-1 text-xs">({meeting.horaLlegadaReal})</span>}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                                        <CheckCircle className="h-3 w-3 mr-1" />A tiempo
                                      </Badge>
                                    )
                                  ) : <span className="text-muted-foreground text-sm">-</span>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    <Button size="sm" variant="outline" onClick={() => { setSelectedMeeting(meeting); setViewDialogOpen(true); }}>Ver</Button>
                                    {meeting.estado === 'Pendiente' && (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(meeting.id, 'Confirmada')}>Confirmar</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(meeting.id, 'Cancelada')}>Cancelar</Button>
                                      </>
                                    )}
                                    {(meeting.estado === 'Confirmada' || meeting.estado === 'Pendiente') && (
                                      <>
                                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleMarkAttendance(meeting.id, true, false)}>A tiempo</Button>
                                        <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => handleMarkAttendance(meeting.id, true, true)}>Tarde</Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleMarkAttendance(meeting.id, false)}>No Asistió</Button>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      }

                      // Cita individual (sin agrupar)
                      const meeting = group.meetings[0];
                      return (
                        <TableRow key={meeting.id}>
                          <TableCell />
                          <TableCell className="font-medium">
                            {meeting.student?.fullName}
                            <div className="text-sm text-muted-foreground">
                              {meeting.student?.level} · {meeting.student?.grade} {meeting.student?.section}
                            </div>
                          </TableCell>
                          <TableCell>{meeting.motivo}</TableCell>
                          <TableCell>{format(new Date(meeting.fecha), 'dd/MM/yyyy', { locale: es })}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {meeting.hora}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(meeting.estado)}</TableCell>
                          <TableCell>
                            {meeting.asistencia === null ? (
                              <span className="text-muted-foreground text-sm">Pendiente</span>
                            ) : meeting.asistencia ? (
                              <Badge variant="default" className="bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" />Asistió
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />No asistió
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {meeting.asistencia === true ? (
                              meeting.llegadaTarde ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                                  <Clock className="h-3 w-3 mr-1" />Llegó tarde
                                  {meeting.horaLlegadaReal && <span className="ml-1 text-xs">({meeting.horaLlegadaReal})</span>}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                                  <CheckCircle className="h-3 w-3 mr-1" />A tiempo
                                </Badge>
                              )
                            ) : <span className="text-muted-foreground text-sm">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedMeeting(meeting); setViewDialogOpen(true); }}>Ver</Button>
                              {meeting.estado === 'Pendiente' && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(meeting.id, 'Confirmada')}>Confirmar</Button>
                                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(meeting.id, 'Cancelada')}>Cancelar</Button>
                                </>
                              )}
                              {(meeting.estado === 'Confirmada' || meeting.estado === 'Pendiente') && (
                                <>
                                  <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleMarkAttendance(meeting.id, true, false)}>A tiempo</Button>
                                  <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => handleMarkAttendance(meeting.id, true, true)}>Tarde</Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleMarkAttendance(meeting.id, false)}>No Asistió</Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </StaffDataPanelBody>
      </StaffDataPanel>

      {/* Panel: Padres que no asistieron */}
      {missedGroups.length > 0 && (
        <StaffDataPanel>
          <StaffDataPanelHeader
            title={`Padres que no asistieron (${missedGroups.reduce((s, g) => s + g.meetings.length, 0)})`}
            description="Registro de inasistencias para seguimiento y reprogramación"
            accent="warning"
            action={
              <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                <UserX className="mr-1 h-3 w-3" />
                {missedGroups.reduce((s, g) => s + g.meetings.length, 0)} ausentes
              </Badge>
            }
          />
          <StaffDataPanelBody className="p-4 sm:p-5 space-y-3">
            {missedGroups.map((group) => {
              const isOpen = expandedMissed.has(group.key);
              return (
                <div key={group.key} className="rounded-lg border border-red-200 bg-red-50/60 overflow-hidden">
                  {/* Cabecera del grupo */}
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-100/60 transition-colors"
                    onClick={() => toggleMissed(group.key)}
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-red-500 shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">{group.motivo}</span>
                        <Badge variant="destructive" className="bg-red-100 text-red-700 text-xs">
                          {group.meetings.length} no asistieron
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                        <span>{format(new Date(group.fecha), "EEEE dd 'de' MMMM yyyy", { locale: es })}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{group.hora}</span>
                      </div>
                    </div>
                  </button>

                  {/* Lista de alumnos del grupo */}
                  {isOpen && (
                    <div className="border-t border-red-200 divide-y divide-red-100">
                      {group.meetings.map((meeting) => (
                        <div key={meeting.id} className="flex items-center gap-3 px-4 py-3 bg-white/70 hover:bg-red-50/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{meeting.student?.fullName ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {meeting.student?.level} · {meeting.student?.grade} {meeting.student?.section}
                            </p>
                            {meeting.student?.contactPhone && (
                              <a
                                href={`tel:${meeting.student.contactPhone}`}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                              >
                                <PhoneCall className="h-3 w-3" />
                                {meeting.student.contactPhone}
                              </a>
                            )}
                          </div>
                          {meeting.notas && (
                            <p className="hidden sm:block text-xs text-muted-foreground max-w-[180px] truncate italic">
                              {meeting.notas}
                            </p>
                          )}
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => handleReschedule(meeting)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Reprogramar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedMeeting(meeting); setViewDialogOpen(true); }}
                            >
                              Ver
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </StaffDataPanelBody>
        </StaffDataPanel>
      )}

      {/* Create Meeting Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            form.reset(individualMeetingDefaults);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Cita con Padre</DialogTitle>
            <DialogDescription>
              Programe una nueva reunión con el padre o apoderado del estudiante.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cita</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== 'individual') {
                          setDialogOpen(false);
                          form.reset({
                            ...bulkMeetingDefaults,
                            tipo: value as MeetingFormValues['tipo'],
                          });
                          setBulkDialogOpen(true);
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="all">Todos los Padres (APAFA)</SelectItem>
                        <SelectItem value="grade">Por Grado</SelectItem>
                        <SelectItem value="section">Por Sección</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="id_estudiante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estudiante</FormLabel>
                    <div className="space-y-2">
                      <Input
                        placeholder="Buscar por nombre (mín. 2 letras)…"
                        value={studentPickerSearch}
                        onChange={(e) => setStudentPickerSearch(e.target.value)}
                      />
                      {studentsLoading ? (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Buscando…
                        </p>
                      ) : students.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {studentPickerSearch.trim().length < 2
                            ? 'Escriba al menos 2 letras para buscar'
                            : 'Sin coincidencias'}
                        </p>
                      ) : (
                        <Select
                          value={field.value ? String(field.value) : ''}
                          onValueChange={(value) => field.onChange(Number(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar estudiante" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={String(student.id)}>
                                {student.fullName} - {student.level} {student.grade} {student.section}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de la Cita</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Revisión de incidencias, Rendimiento académico..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" min={getMinDate()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hora"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Información adicional sobre la cita..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Crear Cita'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Meeting Dialog */}
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (open) {
            form.reset(bulkMeetingDefaults);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Citas Masivas</DialogTitle>
            <DialogDescription>
              Programe citas para múltiples padres de familia. Puede crear citas para todos los padres, por grado o por sección.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cita Masiva</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">Todos los Padres (Junta APAFA)</SelectItem>
                        <SelectItem value="grade">Por Grado</SelectItem>
                        <SelectItem value="section">Por Sección</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('tipo') === 'grade' && (
                <>
                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel Educativo</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar nivel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Primaria">Primaria</SelectItem>
                            <SelectItem value="Secundaria">Secundaria</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar grado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1ro">1ro</SelectItem>
                            <SelectItem value="2do">2do</SelectItem>
                            <SelectItem value="3ro">3ro</SelectItem>
                            <SelectItem value="4to">4to</SelectItem>
                            <SelectItem value="5to">5to</SelectItem>
                            <SelectItem value="6to">6to</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {form.watch('tipo') === 'section' && (
                <>
                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel Educativo</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar nivel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Primaria">Primaria</SelectItem>
                            <SelectItem value="Secundaria">Secundaria</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar grado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1ro">1ro</SelectItem>
                            <SelectItem value="2do">2do</SelectItem>
                            <SelectItem value="3ro">3ro</SelectItem>
                            <SelectItem value="4to">4to</SelectItem>
                            <SelectItem value="5to">5to</SelectItem>
                            <SelectItem value="6to">6to</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="section"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sección</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar sección" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="D">D</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={form.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de la Cita</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Junta de APAFA, Reunión de padres de 3ro A..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input type="date" min={getMinDate()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hora"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Información adicional sobre la cita..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando citas...
                    </>
                  ) : (
                    'Crear Citas Masivas'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Meeting Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Cita</DialogTitle>
          </DialogHeader>
          {selectedMeeting && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Estudiante</Label>
                  <p className="text-lg font-semibold">{selectedMeeting.student?.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMeeting.student?.level} • {selectedMeeting.student?.grade} {selectedMeeting.student?.section}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedMeeting.estado)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <p className="text-lg font-semibold">
                    {format(new Date(selectedMeeting.fecha), 'dd/MM/yyyy', { locale: es })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Hora</Label>
                  <p className="text-lg font-semibold">{selectedMeeting.hora}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Motivo</Label>
                  <p className="text-lg font-semibold">{selectedMeeting.motivo}</p>
                </div>
                {selectedMeeting.notas && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Notas</Label>
                    <p className="text-sm">{selectedMeeting.notas}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Creada por</Label>
                  <p className="text-sm">{selectedMeeting.createdByUser?.fullName || 'Sistema'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Asistencia</Label>
                  <div className="mt-1">
                    {selectedMeeting.asistencia === null ? (
                      <Badge variant="outline">Pendiente</Badge>
                    ) : selectedMeeting.asistencia ? (
                      <Badge variant="default" className="bg-green-100 text-green-700">
                        Asistió
                      </Badge>
                    ) : (
                      <Badge variant="destructive">No asistió</Badge>
                    )}
                  </div>
                </div>
                {selectedMeeting.asistencia === true && (
                  <div>
                    <Label className="text-muted-foreground">Puntualidad</Label>
                    <div className="mt-1">
                      {selectedMeeting.llegadaTarde ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" />
                          Llegó tarde
                          {selectedMeeting.horaLlegadaReal && (
                            <span className="ml-1">({selectedMeeting.horaLlegadaReal})</span>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          A tiempo
                          {selectedMeeting.horaLlegadaReal && (
                            <span className="ml-1">({selectedMeeting.horaLlegadaReal})</span>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

