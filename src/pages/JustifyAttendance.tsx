import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, CheckCircle2, Clock, AlertCircle, Loader2, X } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffTablePagination,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { arrivalService, authService } from '@/lib/services';
import {
  arrivalDateKey,
  isWeekdayDateKey,
  MIN_JUSTIFICATION_REASON_LENGTH,
} from '@/lib/utils/attendanceJustification';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { studentMatchesNameOrClassroom } from '@/lib/utils/studentSearch';
import {
  CLASSROOM_FIELD_LABELS,
  CLASSROOM_GRADES,
  CLASSROOM_LEVELS,
  CLASSROOM_SECTIONS,
} from '@/lib/constants/classrooms';
import type { ArrivalRecord, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';

function formatArrivalDate(date: string, time?: string | null): { date: string; time: string } {
  try {
    const parsed = parseISO(`${date}T12:00:00`);
    return {
      date: format(parsed, 'dd/MM/yyyy', { locale: es }),
      time: time && time !== '00:00' && time !== '00:00:00' ? time.slice(0, 5) : '—',
    };
  } catch {
    return { date, time: time?.slice(0, 5) || '—' };
  }
}

function kindLabel(status: ArrivalRecord['status']): string {
  if (status === 'Falta justificada') return 'Inasistencia justificada';
  if (status === 'Falta' || status === 'Injustificada') return 'Falto';
  if (status === 'Tarde justificada') return 'Tardanza';
  return 'Tardanza';
}

function isPendingAbsence(row: ArrivalRecord): boolean {
  return row.status === 'Falta' || row.status === 'Injustificada' || row.id < 0;
}

function isPendingRow(row: ArrivalRecord): boolean {
  return row.status === 'Tarde' || isPendingAbsence(row);
}

type ListMode = 'Activa' | 'Inasistencias';

export const JustifyAttendance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState<ListMode>('Activa');
  const [dateFilter, setDateFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const debouncedDateFilter = useDebouncedValue(dateFilter, 300);
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ArrivalRecord | null>(null);
  const [justificationReason, setJustificationReason] = useState('');
  const [justifying, setJustifying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const absenceDateKey = debouncedDateFilter || dateFilter;
  const absenceFiltersReady = Boolean(absenceDateKey);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (statusFilter === 'Inasistencias' && !absenceFiltersReady) {
      setRecords([]);
      setLoading(false);
      return;
    }

    if (absenceDateKey && !isWeekdayDateKey(absenceDateKey)) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const classroom = {
      level: levelFilter === 'all' ? undefined : levelFilter,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      section: sectionFilter === 'all' ? undefined : sectionFilter,
    };

    const result =
      statusFilter === 'Inasistencias'
        ? await arrivalService.getPendingAbsencesForDate({
            date: absenceDateKey,
            level: classroom.level,
            grade: classroom.grade,
            section: classroom.section,
          })
        : await arrivalService.getAttendanceJustifications({
            pending: statusFilter === 'Activa',
            date: debouncedDateFilter || undefined,
            limit: 500,
          });

    if (result.error) {
      setLoadError(result.error);
      setRecords([]);
      toast.error(result.error);
    } else {
      let rows = result.records.filter((row) => isWeekdayDateKey(arrivalDateKey(row.date)));
      if (statusFilter !== 'Inasistencias') {
        rows = rows.filter((row) => {
          if (classroom.level && row.student?.level !== classroom.level) return false;
          if (classroom.grade && row.student?.grade !== classroom.grade) return false;
          if (classroom.section && row.student?.section !== classroom.section) return false;
          return true;
        });
      }
      setRecords(rows);
    }
    setLoading(false);
  }, [
    statusFilter,
    absenceDateKey,
    debouncedDateFilter,
    levelFilter,
    gradeFilter,
    sectionFilter,
    absenceFiltersReady,
  ]);

  useEffect(() => {
    if (statusFilter === 'Inasistencias' && !dateFilter) {
      setDateFilter(getLimaTodayDate());
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return records;
    return records.filter((row) => studentMatchesNameOrClassroom(row.student, debouncedSearch));
  }, [records, debouncedSearch]);

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
    totalItems: filtered.length,
    initialPageSize: TABLE_PAGE_SIZE,
  });

  useEffect(() => {
    resetPage();
  }, [statusFilter, debouncedDateFilter, debouncedSearch, levelFilter, gradeFilter, sectionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice(sliceRange.start, sliceRange.end);

  const handleJustify = async () => {
    if (!selectedRecord) return;
    if (!isWeekdayDateKey(arrivalDateKey(selectedRecord.date))) {
      toast.error('No hay clases los sábados ni domingo; no se justifica esa fecha.');
      return;
    }
    if (justificationReason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH) {
      toast.error(`El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres`);
      return;
    }
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para justificar asistencia');
      return;
    }
    setJustifying(true);
    try {
      const isAbsence = isPendingAbsence(selectedRecord);
      const { error } = isAbsence
        ? await arrivalService.createJustifiedAbsence({
            studentId: selectedRecord.studentId,
            date: selectedRecord.date,
            motivo: justificationReason,
            userId: currentUser.id,
          })
        : await arrivalService.justifyTardiness(
            selectedRecord.id,
            currentUser.id,
            justificationReason,
          );
      if (error) {
        toast.error(error);
      } else {
        toast.success(isAbsence ? 'Inasistencia justificada (IJ)' : 'Tardanza justificada (TJ)');
        setDialogOpen(false);
        setJustificationReason('');
        setSelectedRecord(null);
        await loadRecords();
      }
    } finally {
      setJustifying(false);
    }
  };

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    Boolean(dateFilter) ||
    levelFilter !== 'all' ||
    gradeFilter !== 'all' ||
    sectionFilter !== 'all' ||
    statusFilter !== 'Activa';

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setLevelFilter('all');
    setGradeFilter('all');
    setSectionFilter('all');
    setStatusFilter('Activa');
  };

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Clock}
        eyebrow="Asistencia"
        title="Justificar asistencia"
        description="Justifique tardanzas (TJ) o faltos (IN → IJ). Desde el 07/09/2026, un día hábil cerrado sin llegada cuenta como falto. Las incidencias de conducta siguen en Justificar Faltas."
        accent="warning"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-3">
        <StaffKpiStat
          label="En lista"
          value={filtered.length}
          hint={
            statusFilter === 'Activa' ? 'Tardanzas pendientes' : 'Faltos / inasistencias'
          }
          icon={Clock}
          tone="warning"
        />
        <StaffKpiStat
          label="Filtro"
          value={statusFilter === 'Activa' ? 'Tardanzas' : 'Faltos'}
          hint={dateFilter || 'Todas las fechas'}
          icon={CheckCircle2}
          tone="info"
        />
      </div>

      <StaffToolbar
        title="Filtros"
        description="Busque por nombre, DNI o aula (ej. 3ro A). Nivel, grado y sección se pueden usar por separado."
        footer={
          hasActiveFilters ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
                {debouncedSearch.trim() ? ` · “${debouncedSearch.trim()}”` : ''}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : null
        }
      >
        <div className="col-span-full space-y-2">
          <Label htmlFor="justify-attendance-search">Buscar estudiante o aula</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="justify-attendance-search"
              className="pl-10 pr-10"
              placeholder="Nombre, apellido, DNI o aula (ej. Huamani, 3ro A, Secundaria)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearchTerm('')}
                aria-label="Borrar búsqueda"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="col-span-full grid gap-3 grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 col-span-2 lg:col-span-1">
            <Label>Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(value: ListMode) => setStatusFilter(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Tardanzas</SelectItem>
                <SelectItem value="Inasistencias">Faltos / Inasistencias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="justify-attendance-date">Fecha</Label>
            <Input
              id="justify-attendance-date"
              type="date"
              value={dateFilter}
              max={getLimaTodayDate()}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{CLASSROOM_FIELD_LABELS.level}</Label>
            <Select
              value={levelFilter}
              onValueChange={(value: 'all' | EducationalLevel) => setLevelFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allLevels}</SelectItem>
                {CLASSROOM_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{CLASSROOM_FIELD_LABELS.grade}</Label>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Grado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allGrades}</SelectItem>
                {CLASSROOM_GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{CLASSROOM_FIELD_LABELS.section}</Label>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Sección" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allSections}</SelectItem>
                {CLASSROOM_SECTIONS.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Registros (${filtered.length})`}
          description={
            statusFilter === 'Activa'
              ? 'Tardanzas sin justificar. Pulse Justificar e indique el motivo.'
              : 'Faltos del día (día hábil cerrado desde el 07/09/2026, o registro Falta). El día en curso aún no se marca como falto.'
          }
        />
        <div className={loading ? 'p-4 pt-0 sm:p-5 sm:pt-0 opacity-70' : 'p-4 pt-0 sm:p-5 sm:pt-0'}>
          {loading && records.length === 0 && !loadError ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando registros…
            </div>
          ) : loadError && records.length === 0 ? (
            <StaffEmptyState
              icon={AlertCircle}
              title="Error al cargar"
              description={loadError}
              action={
                <Button size="sm" variant="outline" onClick={() => void loadRecords()}>
                  Reintentar
                </Button>
              }
            />
          ) : dateFilter && !isWeekdayDateKey(dateFilter) ? (
            <StaffEmptyState
              icon={Clock}
              title="No hay clases ese día"
              description="Los sábados y domingo no se justifican tardanzas ni faltos. Elija un día hábil (lunes a viernes)."
            />
          ) : statusFilter === 'Inasistencias' && !absenceFiltersReady ? (
            <StaffEmptyState
              icon={Clock}
              title="Elija una fecha"
              description="Los faltos se listan por día cerrado. Elija una fecha hábil desde el 07/09/2026 (no el día en curso)."
            />
          ) : pageRows.length === 0 ? (
            <StaffEmptyState
              icon={Clock}
              title="Sin resultados"
              description={
                statusFilter === 'Activa'
                  ? 'No hay tardanzas pendientes de días hábiles con estos filtros'
                  : 'No hay faltos en esa fecha: o el día aún no cierra, es anterior al 07/09/2026, o todos tienen llegada o IJ.'
              }
            />
          ) : (
            <div className="app-table-wrap">
              <Table role="table" aria-label="Lista de asistencia para justificar">
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => {
                    const when = formatArrivalDate(row.date, row.arrivalTime);
                    const pending = isPendingRow(row);
                    const absence = isPendingAbsence(row);
                    return (
                      <TableRow key={`${row.studentId}-${row.date}-${row.id}`}>
                        <TableCell>
                          <p className="font-medium">{row.student?.fullName || `ID ${row.studentId}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.student?.level} • {row.student?.grade} {row.student?.section}
                          </p>
                        </TableCell>
                        <TableCell>{kindLabel(row.status)}</TableCell>
                        <TableCell>
                          <p>{when.date}</p>
                          <p className="text-muted-foreground">{absence ? 'Falto' : when.time}</p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={pending ? 'outline' : 'default'}
                            className={
                              pending
                                ? ''
                                : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                            }
                          >
                            {pending ? 'Pendiente' : row.status === 'Falta justificada' ? 'IJ' : 'TJ'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pending ? (
                            <Dialog
                              open={dialogOpen && selectedRecord?.id === row.id}
                              onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (open) {
                                  setSelectedRecord(row);
                                  setJustificationReason('');
                                } else {
                                  setJustificationReason('');
                                  setSelectedRecord(null);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedRecord(row)}
                                  aria-label={`Justificar ${absence ? 'inasistencia' : 'tardanza'} de ${row.student?.fullName || row.studentId}`}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Justificar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>
                                    {absence ? 'Justificar inasistencia' : 'Justificar tardanza'}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {absence
                                      ? 'El registro pasará a IJ (inasistencia justificada) en la planilla.'
                                      : 'El registro pasará a TJ (tarde justificada) en la planilla.'}
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedRecord && (
                                  <div className="space-y-4">
                                    <div className="space-y-2 rounded-lg bg-muted p-4">
                                      <p className="font-semibold">{selectedRecord.student?.fullName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {isPendingAbsence(selectedRecord) ? 'Inasistencia' : 'Tardanza'} ·{' '}
                                        {formatArrivalDate(selectedRecord.date, selectedRecord.arrivalTime).date}
                                        {isPendingAbsence(selectedRecord)
                                          ? ''
                                          : ` ${formatArrivalDate(selectedRecord.date, selectedRecord.arrivalTime).time}`}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="attendance-justification-reason">
                                        Motivo <span className="text-destructive">*</span>
                                      </Label>
                                      <Textarea
                                        id="attendance-justification-reason"
                                        rows={5}
                                        value={justificationReason}
                                        onChange={(e) => setJustificationReason(e.target.value)}
                                        placeholder={
                                          absence
                                            ? 'Ej: El estudiante presentó certificado médico...'
                                            : 'Ej: El apoderado avisó demora por cita médica...'
                                        }
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Mínimo {MIN_JUSTIFICATION_REASON_LENGTH} caracteres.
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancelar
                                  </Button>
                                  <Button onClick={() => void handleJustify()} disabled={justifying}>
                                    {justifying ? 'Guardando…' : 'Confirmar'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {row.justificationReason || '—'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {filtered.length > pageSize && (
            <StaffTablePagination
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPrev={prevPage}
              onNext={nextPage}
              onGoToPage={goToPage}
              onPageSizeChange={changePageSize}
            />
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};
