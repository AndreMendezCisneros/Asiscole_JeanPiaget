import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { Clock, Search, Users, CheckCircle, AlertCircle, Loader2, LogOut, LogIn, AlertTriangle } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import { arrivalService, studentsService } from '@/lib/services';
import type { ArrivalRecord, EducationalLevel, Student } from '@/types';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';
import { authService } from '@/lib/services';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ARRIVAL_PAGE_SIZE = 15;

type StatusFilter = 'all' | 'A tiempo' | 'Tarde' | 'Sin registrar';

type ArrivalControlRow = {
  student: Student;
  record: ArrivalRecord | null;
};

export const ArrivalControl = () => {
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [rosterStudents, setRosterStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [registeringEntryId, setRegisteringEntryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const isMountedRef = useRef(true);

  const getTodayDate = () => {
    const nowLima = new Date().toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [dd, mm, yyyy] = nowLima.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());

  const isRosterMode =
    levelFilter !== 'all' && gradeFilter !== 'all' && sectionFilter !== 'all';

  const loadArrivals = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      const { records: arrivals, error } = await arrivalService.getArrivals({ date: selectedDate });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error('Error al cargar llegadas');
        setRecords([]);
      } else {
        setRecords(arrivals);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en loadArrivals:', error);
      toast.error('Error al procesar las llegadas');
      setRecords([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  const loadRoster = useCallback(async () => {
    if (!isRosterMode) {
      setRosterStudents([]);
      return;
    }

    setRosterLoading(true);
    try {
      const { students, error } = await studentsService.getAll({
        level: levelFilter as EducationalLevel,
        grade: gradeFilter,
        section: sectionFilter,
        active: true,
        fetchAll: true,
      });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error(error);
        setRosterStudents([]);
      } else {
        setRosterStudents(students);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en loadRoster:', error);
      setRosterStudents([]);
    } finally {
      if (isMountedRef.current) {
        setRosterLoading(false);
      }
    }
  }, [isRosterMode, levelFilter, gradeFilter, sectionFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    void arrivalService.prefetchArrivalConfig();
    void loadArrivals();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadArrivals]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, levelFilter, gradeFilter, sectionFilter, selectedDate]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const handleRegisterDeparture = async (recordId: number) => {
    if (!isMountedRef.current) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar salidas');
      return;
    }

    const { success, error } = await arrivalService.createDepartureRecord(
      recordId,
      currentUser.id,
      'Normal',
    );

    if (!isMountedRef.current) return;

    if (error) {
      toast.error(error);
    } else {
      staffNotify.success('¡Salida registrada!', 'El registro de asistencia quedó actualizado');
      void loadArrivals();
    }
  };

  const handleRegisterArrival = async (student: Student) => {
    if (!isMountedRef.current) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar entradas');
      return;
    }

    setRegisteringEntryId(student.id);

    const { record, error, alreadyRegistered } = await arrivalService.createArrivalRecord(
      student.id,
      currentUser.id,
      { studentLevel: student.level },
    );

    if (!isMountedRef.current) return;
    setRegisteringEntryId(null);

    if (error) {
      toast.error(error);
      return;
    }

    if (alreadyRegistered) {
      toast.info(`${student.fullName} ya tenía llegada registrada hoy`);
    } else {
      staffNotify.success(
        '¡Entrada registrada!',
        `${student.fullName}: ${record?.status ?? 'registrado'} a las ${record?.arrivalTime ?? '—'}`,
      );
    }

    void loadArrivals();
  };

  const displayRows = useMemo((): ArrivalControlRow[] => {
    const matchesSearch = (name: string) =>
      name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = (record: ArrivalRecord | null) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'Sin registrar') return record === null;
      return record?.status === statusFilter;
    };

    if (isRosterMode) {
      const arrivalByStudent = new Map<number, ArrivalRecord>();
      for (const record of records) {
        if (
          record.student?.level === levelFilter &&
          record.student?.grade === gradeFilter &&
          record.student?.section === sectionFilter
        ) {
          arrivalByStudent.set(record.studentId, record);
        }
      }

      const rows = rosterStudents
        .map((student) => ({
          student,
          record: arrivalByStudent.get(student.id) ?? null,
        }))
        .filter(
          (row) => matchesSearch(row.student.fullName) && matchesStatus(row.record),
        )
        .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName, 'es'));

      return rows;
    }

    return records
      .filter((record) => {
        const studentName = record.student?.fullName ?? '';
        const matchesLevel = levelFilter === 'all' || record.student?.level === levelFilter;
        const matchesGrade = gradeFilter === 'all' || record.student?.grade === gradeFilter;
        const matchesSection = sectionFilter === 'all' || record.student?.section === sectionFilter;
        return (
          matchesSearch(studentName) &&
          matchesStatus(record) &&
          matchesLevel &&
          matchesGrade &&
          matchesSection
        );
      })
      .map((record) => ({
        student: record.student!,
        record,
      }));
  }, [
    records,
    rosterStudents,
    isRosterMode,
    searchTerm,
    statusFilter,
    levelFilter,
    gradeFilter,
    sectionFilter,
  ]);

  const filteredStats = useMemo(() => {
    const registered = displayRows.filter((r) => r.record !== null);
    const onTime = registered.filter((r) => r.record?.status === 'A tiempo').length;
    const late = registered.filter((r) => r.record?.status === 'Tarde').length;
    const unregistered = displayRows.filter((r) => r.record === null).length;
    return {
      total: isRosterMode ? displayRows.length : registered.length,
      onTime,
      late,
      unregistered,
      registered: registered.length,
    };
  }, [displayRows, isRosterMode]);

  const onTimePct =
    filteredStats.registered > 0
      ? Math.round((filteredStats.onTime / filteredStats.registered) * 100)
      : 0;

  const totalPages = Math.max(1, Math.ceil(displayRows.length / ARRIVAL_PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ARRIVAL_PAGE_SIZE;
    return displayRows.slice(start, start + ARRIVAL_PAGE_SIZE);
  }, [displayRows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const isLoading = loading || (isRosterMode && rosterLoading);

  const refreshAll = () => {
    void loadArrivals();
    void loadRoster();
  };

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Clock}
        eyebrow="Asistencia"
        title="Control de Llegadas"
        description={`Registro y seguimiento de ingresos ${selectedDate === getTodayDate() ? 'del día de hoy' : `del ${new Date(selectedDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`}`}
        accent="success"
      />

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat
          label={isRosterMode ? 'En sección' : 'Total llegadas'}
          value={filteredStats.total}
          hint={isRosterMode ? `${filteredStats.registered} con entrada · ${filteredStats.unregistered} sin registrar` : undefined}
          icon={Users}
          tone="primary"
        />
        <StaffKpiStat
          label="A tiempo"
          value={filteredStats.onTime}
          hint={`${onTimePct}% de registrados`}
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

      <StaffToolbar
        title="Filtros del día"
        description={
          isRosterMode
            ? 'Lista completa del aula: incluye estudiantes sin entrada registrada'
            : 'Fecha, estudiante, nivel, grado, sección y estado'
        }
      >
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
            <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="A tiempo">A tiempo</SelectItem>
                <SelectItem value="Tarde">Tarde</SelectItem>
                {isRosterMode && <SelectItem value="Sin registrar">Sin registrar</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Registros del día"
          description={
            displayRows.length > ARRIVAL_PAGE_SIZE
              ? `${displayRows.length} visibles · página ${currentPage} de ${totalPages} · ${ARRIVAL_PAGE_SIZE} por página`
              : `${displayRows.length} visibles · actualice para refrescar`
          }
          action={
            <Button onClick={refreshAll} variant="outline" size="sm" disabled={isLoading}>
              Actualizar
            </Button>
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Cargando registros...</span>
            </div>
          ) : displayRows.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title="Sin registros"
              description={
                isRosterMode
                  ? 'No hay estudiantes activos en esta sección o no coinciden con los filtros'
                  : 'No hay llegadas para la fecha o filtros seleccionados. Seleccione nivel, grado y sección para ver toda el aula.'
              }
            />
          ) : (
            <>
            <div className="app-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Nivel / Grado</TableHead>
                    <TableHead>Hora de Llegada</TableHead>
                    <TableHead>Hora de Salida</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row) => {
                    const { student, record } = row;
                    const rowKey = record?.id ?? `pending-${student.id}`;

                    return (
                      <TableRow key={rowKey}>
                        <TableCell className="font-medium">{student.fullName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{student.level}</span>
                            <span className="text-muted-foreground">
                              {student.grade} - {student.section}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {record.arrivalTime}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record?.departureTime ? (
                            <div className="flex items-center gap-2">
                              <LogOut className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{record.departureTime}</span>
                              {record.departureType === 'Autorizada' && (
                                <Badge variant="outline" className="text-xs">
                                  Autorizada
                                </Badge>
                              )}
                            </div>
                          ) : record ? (
                            <div className="flex items-center gap-2 text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm">Sin salida</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record ? (
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
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              Sin registrar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {record?.registeredByUser?.fullName ?? (record ? 'Sistema' : '—')}
                        </TableCell>
                        <TableCell>
                          {!record ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => void handleRegisterArrival(student)}
                              disabled={registeringEntryId === student.id}
                              className="gap-2"
                            >
                              {registeringEntryId === student.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LogIn className="h-4 w-4" />
                              )}
                              Registrar Entrada
                            </Button>
                          ) : (
                            !record.departureTime && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRegisterDeparture(record.id)}
                                className="gap-2"
                              >
                                <LogOut className="h-4 w-4" />
                                Registrar Salida
                              </Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {displayRows.length > ARRIVAL_PAGE_SIZE && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((p) => Math.max(1, p - 1));
                      }}
                      className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .map((page, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev !== undefined && page - prev > 1;
                      return (
                        <span key={page} className="contents">
                          {showEllipsis && (
                            <PaginationItem>
                              <span className="px-2 text-muted-foreground">…</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </span>
                      );
                    })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                      }}
                      className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
            </>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};
