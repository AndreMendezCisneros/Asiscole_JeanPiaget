import { useState, useEffect, useRef, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Search, Users, CheckCircle, AlertCircle, Loader2, LogIn, LogOut, Pencil } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffTablePagination,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { arrivalService, authService, studentsService, whatsappService } from '@/lib/services';
import type { ArrivalRecord, EducationalLevel, EstudianteEstadoPension, Student } from '@/types';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';
import { isPensionesEnabled } from '@/config/features';
import { playPensionMorosoBeep } from '@/lib/utils/pensionBeep';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';

const GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

type ArrivalStatusFilter = 'all' | 'A tiempo' | 'Tarde' | 'Sin registrar';

type DayRow =
  | { kind: 'registered'; record: ArrivalRecord }
  | { kind: 'pending'; student: Student };

/** «sí» = no pagó / moroso; «no» = al día; null = sin dato */
function deudaLabelFromEstado(
  estado: EstudianteEstadoPension | undefined | null,
): 'sí' | 'no' | null {
  if (!estado || estado === 'sin_dato') return null;
  if (estado === 'al_dia') return 'no';
  // pendiente (pagado=0 antes de mora) o moroso
  return 'sí';
}

function resolveStudentEstadoPension(
  student: Student | undefined | null,
  byId: Map<number, Student>,
): EstudianteEstadoPension | undefined {
  if (!student) return undefined;
  if (student.estadoPension) return student.estadoPension;
  return byId.get(student.id)?.estadoPension;
}

export const ArrivalControl = () => {
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [activeStudents, setActiveStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArrivalStatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [registeringStudentId, setRegisteringStudentId] = useState<number | null>(null);
  const [editRecord, setEditRecord] = useState<ArrivalRecord | null>(null);
  const [editStep, setEditStep] = useState<'ask' | 'edit'>('ask');
  const [editTime, setEditTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const isMountedRef = useRef(true);
  const pensionesEnabled = isPensionesEnabled();

  const studentsById = useMemo(() => {
    const map = new Map<number, Student>();
    for (const s of activeStudents) map.set(s.id, s);
    return map;
  }, [activeStudents]);
  
  // Obtener fecha actual en formato YYYY-MM-DD
  const getTodayDate = () => {
    const nowLima = new Date().toLocaleString('es-PE', { 
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [dd, mm, yyyy] = nowLima.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());

  useEffect(() => {
    isMountedRef.current = true;
    loadArrivals();
    
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadActiveStudents = async (): Promise<{ students: Student[]; error: string | null }> => {
    const lite = await studentsService.listLite({ active: true });
    if (!lite.error && lite.students.length > 0) {
      return { students: lite.students, error: null };
    }
    if (lite.error) {
      console.warn('listLite falló, usando paginación via RPC:', lite.error);
    }

    // Fallback: paginar si fetchAll no está soportado o devolvió vacío con error
    const pageSize = 100;
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    const all: Student[] = [];
    let lastError: string | null = lite.error;

    while (all.length < total) {
      const res = await studentsService.getAll({ active: true, page, pageSize });
      if (res.error) {
        lastError = res.error;
        break;
      }
      all.push(...res.students);
      total = res.total || all.length;
      if (res.students.length === 0) break;
      page += 1;
      if (page > 50) break;
    }

    if (all.length > 0) return { students: all, error: null };
    return { students: [], error: lastError };
  };

  const loadArrivals = async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      // Primero llegadas del día (rápido) → pintar tabla; estudiantes en paralelo después.
      const { records: arrivals, error } = await arrivalService.getArrivals({ date: selectedDate });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error('Error al cargar llegadas');
        setRecords([]);
      } else {
        setRecords(arrivals);
      }
      setLoading(false);

      const studentsResult = await loadActiveStudents();
      if (!isMountedRef.current) return;

      if (studentsResult.error) {
        toast.error(`Error al cargar estudiantes activos: ${studentsResult.error}`);
        setActiveStudents([]);
      } else {
        setActiveStudents(studentsResult.students);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en loadArrivals:', error);
      toast.error('Error al procesar las llegadas');
      setRecords([]);
      setActiveStudents([]);
      setLoading(false);
    }
  };

  const handleRegisterArrival = async (student: Student) => {
    if (!isMountedRef.current) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar entradas');
      return;
    }

    const estado =
      resolveStudentEstadoPension(student, studentsById) ?? student.estadoPension;
    const deuda = pensionesEnabled ? deudaLabelFromEstado(estado) : null;
    if (deuda === 'sí') {
      playPensionMorosoBeep();
      toast.warning('Pensión: estudiante no pagó', {
        description: student.fullName,
        duration: 3200,
      });
    }

    setRegisteringStudentId(student.id);
    try {
      const { record, error, alreadyRegistered } = await arrivalService.createArrivalRecord(
        student.id,
        currentUser.id,
        { date: selectedDate, studentLevel: student.level },
      );

      if (!isMountedRef.current) return;

      if (error || !record) {
        toast.error(error || 'No se pudo registrar la entrada');
        return;
      }

      if (alreadyRegistered) {
        toast.info(`${student.fullName} ya tenía entrada registrada hoy`);
      } else {
        if (whatsappService.isEnabled()) {
          void whatsappService.notifyParentArrival(student, record).then((wa) => {
            if (!isMountedRef.current) return;
            if (!wa.ok && wa.error) {
              toast.warning(`WhatsApp: ${wa.error}`, { duration: 4500 });
            }
          });
        }
        staffNotify.success('¡Entrada registrada!', `${student.fullName} quedó registrado`);
      }

      loadArrivals();
    } finally {
      if (isMountedRef.current) {
        setRegisteringStudentId(null);
      }
    }
  };

  const closeEditArrival = () => {
    if (savingEdit) return;
    setEditRecord(null);
    setEditStep('ask');
    setEditTime('');
  };

  const openEditArrival = (record: ArrivalRecord) => {
    const raw = (record.arrivalTime || '').slice(0, 5);
    setEditTime(raw);
    setEditStep('ask');
    setEditRecord(record);
  };

  const handleConfirmEditArrival = async () => {
    if (!editRecord || !isMountedRef.current) return;
    if (!/^\d{2}:\d{2}$/.test(editTime)) {
      toast.error('Ingrese una hora válida (HH:MM)');
      return;
    }

    setSavingEdit(true);
    try {
      const { record, error } = await arrivalService.updateArrivalTime(
        editRecord.id,
        editTime,
        editRecord.student?.level,
      );
      if (!isMountedRef.current) return;
      if (error || !record) {
        toast.error(error || 'No se pudo editar la entrada');
        return;
      }
      staffNotify.success(
        'Entrada actualizada',
        `${editRecord.student?.fullName || 'Estudiante'}: ${editTime}`,
      );
      closeEditArrival();
      loadArrivals();
    } finally {
      if (isMountedRef.current) setSavingEdit(false);
    }
  };

  const dayRows = useMemo((): DayRow[] => {
    const registeredIds = new Set(records.map((r) => r.studentId));
    const registeredRows: DayRow[] = records.map((record) => ({ kind: 'registered', record }));
    const pendingRows: DayRow[] = activeStudents
      .filter((student) => !registeredIds.has(student.id))
      .map((student) => ({ kind: 'pending', student }));

    return [...registeredRows, ...pendingRows].sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'pending' ? -1 : 1;
      }
      const nameA = (a.kind === 'registered' ? a.record.student?.fullName : a.student.fullName) ?? '';
      const nameB = (b.kind === 'registered' ? b.record.student?.fullName : b.student.fullName) ?? '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }, [records, activeStudents]);

  const filteredRows = useMemo(
    () =>
      dayRows.filter((row) => {
        const student = row.kind === 'registered' ? row.record.student : row.student;
        const studentName = student?.fullName ?? '';
        const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLevel = levelFilter === 'all' || student?.level === levelFilter;
        const matchesGrade = gradeFilter === 'all' || student?.grade === gradeFilter;
        const matchesSection = sectionFilter === 'all' || student?.section === sectionFilter;

        let matchesStatus = true;
        if (statusFilter === 'Sin registrar') {
          matchesStatus = row.kind === 'pending';
        } else if (statusFilter !== 'all') {
          matchesStatus = row.kind === 'registered' && row.record.status === statusFilter;
        }

        return matchesSearch && matchesStatus && matchesLevel && matchesGrade && matchesSection;
      }),
    [dayRows, searchTerm, statusFilter, levelFilter, gradeFilter, sectionFilter],
  );

  const filteredStats = useMemo(() => {
    const registered = filteredRows.filter((r): r is Extract<DayRow, { kind: 'registered' }> => r.kind === 'registered');
    const pending = filteredRows.filter((r) => r.kind === 'pending').length;
    const onTime = registered.filter((r) => r.record.status === 'A tiempo').length;
    const late = registered.filter((r) => r.record.status === 'Tarde').length;
    return { total: registered.length, pending, onTime, late };
  }, [filteredRows]);

  const {
    page: currentPage,
    pageSize,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
    sliceRange,
  } = useTablePagination({
    totalItems: filteredRows.length,
    initialPageSize: TABLE_PAGE_SIZE,
  });

  useEffect(() => {
    resetPage();
  }, [searchTerm, statusFilter, levelFilter, gradeFilter, sectionFilter, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const paginatedRows = useMemo(() => {
    return filteredRows.slice(sliceRange.start, sliceRange.end);
  }, [filteredRows, sliceRange.start, sliceRange.end]);

  const onTimePct =
    filteredStats.total > 0
      ? Math.round((filteredStats.onTime / filteredStats.total) * 100)
      : 0;

  const visibleSummary =
    filteredRows.length > pageSize
      ? `${filteredRows.length} visibles · página ${currentPage} de ${totalPages} · ${pageSize} por página`
      : `${filteredRows.length} visibles · ${pageSize} por página`;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Clock}
        eyebrow="Asistencia"
        title="Control de Llegadas"
        description={`Registro y seguimiento de ingresos ${selectedDate === getTodayDate() ? 'del día de hoy' : `del ${new Date(selectedDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`}`}
        accent="success"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="Con entrada"
          value={filteredStats.total}
          icon={Users}
          tone="primary"
        />
        <StaffKpiStat
          label="Sin registrar"
          value={filteredStats.pending}
          hint="Aún no registran llegada"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
        <StaffKpiStat
          label="A tiempo"
          value={filteredStats.onTime}
          hint={filteredStats.total > 0 ? `${onTimePct}% de quienes llegaron` : undefined}
          hintIcon={CheckCircle}
          icon={CheckCircle}
          tone="success"
        />
        <StaffKpiStat
          label="Tarde"
          value={filteredStats.late}
          hint="Requieren seguimiento"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <StaffToolbar title="Filtros del día" description="Fecha, estudiante, nivel, grado, sección y estado">
        <div className="col-span-full grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getTodayDate()}
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>Buscar estudiante</Label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre completo del estudiante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-w-[12rem] pl-10"
              />
            </div>
          </div>
        </div>
        <div className="col-span-full grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Nivel educativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Primaria">Primaria</SelectItem>
                <SelectItem value="Secundaria">Secundaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grado</Label>
            <Select value={gradeFilter} onValueChange={(value) => setGradeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sección</Label>
            <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SECTIONS.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={(value: ArrivalStatusFilter) => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Sin registrar">Sin registrar</SelectItem>
              <SelectItem value="A tiempo">A tiempo</SelectItem>
              <SelectItem value="Tarde">Tarde</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Registros del día"
          description={`${visibleSummary} · actualice para refrescar`}
          action={
            <Button onClick={loadArrivals} variant="outline" size="sm" disabled={loading}>
              Actualizar
            </Button>
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Cargando registros...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title="Sin registros"
              description="No hay estudiantes para la fecha o filtros seleccionados"
            />
          ) : (
            <div className="app-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Nivel / Grado</TableHead>
                  <TableHead>Hora de Llegada</TableHead>
                  <TableHead>Hora de Salida</TableHead>
                  <TableHead>Estado</TableHead>
                  {pensionesEnabled && <TableHead>¿Tiene deuda?</TableHead>}
                  <TableHead>Registrado por</TableHead>
                  <TableHead className="min-w-[10rem]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => {
                  if (row.kind === 'pending') {
                    const student = row.student;
                    const isRegistering = registeringStudentId === student.id;
                    const deuda = pensionesEnabled
                      ? deudaLabelFromEstado(resolveStudentEstadoPension(student, studentsById))
                      : null;
                    return (
                      <TableRow key={`pending-${student.id}`}>
                        <TableCell className="font-medium">{student.fullName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{student.level}</span>
                            <span className="text-muted-foreground">
                              {student.grade} - {student.section}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">—</TableCell>
                        <TableCell className="text-muted-foreground text-sm">—</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            Sin registrar
                          </Badge>
                        </TableCell>
                        {pensionesEnabled && (
                          <TableCell>
                            {deuda === 'sí' ? (
                              <Badge variant="destructive" className="font-normal">sí</Badge>
                            ) : deuda === 'no' ? (
                              <span className="text-sm text-muted-foreground">no</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground text-sm">—</TableCell>
                        <TableCell>
                          {/* Sin llegada → Registrar Entrada */}
                          <Button
                            size="sm"
                            onClick={() => void handleRegisterArrival(student)}
                            disabled={isRegistering}
                            className="gap-2"
                          >
                            {isRegistering ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogIn className="h-4 w-4" />
                            )}
                            Registrar Entrada
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const record = row.record;
                  const hasDeparture = Boolean(record.departureTime);
                  const deuda = pensionesEnabled
                    ? deudaLabelFromEstado(
                        resolveStudentEstadoPension(record.student, studentsById),
                      )
                    : null;
                  return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.student?.fullName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">{record.student?.level}</span>
                        <span className="text-muted-foreground">
                          {record.student?.grade} - {record.student?.section}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {record.arrivalTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasDeparture ? (
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{record.departureTime}</span>
                          {record.departureType === 'Autorizada' && (
                            <Badge variant="outline" className="text-xs">Autorizada</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={record.status === 'A tiempo' ? 'default' : 'destructive'}
                        className={
                          record.status === 'A tiempo'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    {pensionesEnabled && (
                      <TableCell>
                        {deuda === 'sí' ? (
                          <Badge variant="destructive" className="font-normal">sí</Badge>
                        ) : deuda === 'no' ? (
                          <span className="text-sm text-muted-foreground">no</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm">
                      {record.registeredByUser?.fullName || 'Sistema'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditArrival(record)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar entrada
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredRows.length > pageSize && (
              <StaffTablePagination
                page={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredRows.length}
                onPrev={prevPage}
                onNext={nextPage}
                onGoToPage={goToPage}
                onPageSizeChange={changePageSize}
              />
            )}
            </div>
          )}
        </div>
      </StaffDataPanel>

      <Dialog
        open={editRecord != null}
        onOpenChange={(open) => {
          if (!open) closeEditArrival();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {editStep === 'ask' ? (
            <>
              <DialogHeader>
                <DialogTitle>¿Editar esta entrada?</DialogTitle>
                <DialogDescription>
                  Confirme que va a modificar la hora de llegada del estudiante indicado.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estudiante</p>
                <p className="text-base font-semibold leading-snug">
                  {editRecord?.student?.fullName || 'Estudiante sin nombre'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[editRecord?.student?.level, editRecord?.student?.grade, editRecord?.student?.section]
                    .filter(Boolean)
                    .join(' · ')}
                  {editRecord?.arrivalTime ? ` · Hora actual: ${editRecord.arrivalTime}` : null}
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeEditArrival}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => setEditStep('edit')}>
                  Sí, editar a este niño
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar nueva hora</DialogTitle>
                <DialogDescription>
                  Segunda confirmación: guarde la hora solo si corresponde a{' '}
                  <span className="font-medium text-foreground">
                    {editRecord?.student?.fullName || 'este estudiante'}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="edit-arrival-time">Nueva hora de llegada</Label>
                <Input
                  id="edit-arrival-time"
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  disabled={savingEdit}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditStep('ask')}
                  disabled={savingEdit}
                >
                  Volver
                </Button>
                <Button type="button" onClick={() => void handleConfirmEditArrival()} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar cambio
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
