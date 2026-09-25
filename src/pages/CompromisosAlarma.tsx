import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileSignature, Loader2, Printer, Search, Users, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffToolbar,
  StaffTablePagination,
} from '@/components/staff';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  authService,
  compromisosAlarmService,
  incidentsService,
  studentsService,
} from '@/lib/services';
import { downloadCompromisoAlarmaPdf } from '@/lib/utils/compromisoAlarmaPdf';
import {
  DEBT_FALTA_THRESHOLD,
  DEBT_TARDE_THRESHOLD,
  shouldAlertDebtFromCounts,
} from '@/lib/utils/debtAlarm';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import {
  CLASSROOM_FIELD_LABELS,
  CLASSROOM_GRADES,
  CLASSROOM_LEVELS,
  CLASSROOM_SECTIONS,
} from '@/lib/constants/classrooms';
import type { EducationalLevel, Student } from '@/types';
import type {
  CompromisoAlarma,
  CompromisoAlarmaTipo,
  CompromisoTardanzaListRow,
} from '@/types/compromisoAlarma';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';

const TIPO_OPTIONS: { value: CompromisoAlarmaTipo; label: string; hint: string }[] = [
  {
    value: 'tardanza',
    label: 'Llegadas tarde',
    hint: 'Cuando el alumno llega tarde varias veces',
  },
  {
    value: 'falta',
    label: 'Faltas a clases',
    hint: 'Cuando falta a clases o no trae el carné',
  },
  {
    value: 'pago',
    label: 'Pensión pendiente',
    hint: 'Cuando hay pensión por pagar',
  },
];

function tipoLabel(t: CompromisoAlarmaTipo): string {
  return TIPO_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

function formatShortDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  try {
    return format(parseISO(isoDate.length <= 10 ? `${isoDate}T12:00:00` : isoDate), 'dd/MM/yyyy', {
      locale: es,
    });
  } catch {
    return isoDate;
  }
}

export const CompromisosAlarma = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [dateFilter, setDateFilter] = useState('');

  const [listRows, setListRows] = useState<CompromisoTardanzaListRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [citationCount, setCitationCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  const {
    page,
    pageSize,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
  } = useTablePagination({
    totalItems: listTotal,
    initialPageSize: TABLE_PAGE_SIZE,
  });

  const [selected, setSelected] = useState<Student | null>(null);
  const [pagoMuted, setPagoMuted] = useState(false);
  const [counts, setCounts] = useState({
    faltaCount: 0,
    carnetCount: 0,
    tardeCount: 0,
  });
  const [history, setHistory] = useState<CompromisoAlarma[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipo, setTipo] = useState<CompromisoAlarmaTipo>('tardanza');
  const [parentName, setParentName] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  const user = authService.getCurrentUser();
  const schoolName =
    (import.meta.env.VITE_SCHOOL_NAME as string | undefined)?.trim() || 'Colegio Jean Piaget';

  const alerts = useMemo(
    () =>
      shouldAlertDebtFromCounts({
        ...counts,
        alertPago: selected?.estadoPension === 'moroso' && !pagoMuted,
      }),
    [counts, selected?.estadoPension, pagoMuted],
  );

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) ||
    Boolean(dateFilter) ||
    levelFilter !== 'all' ||
    gradeFilter !== 'all' ||
    sectionFilter !== 'all';

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const { rows, total, citationCount: cites, error } =
        await compromisosAlarmService.listStudentsWithTardanzas({
          search: debouncedSearch.trim() || undefined,
          level: levelFilter === 'all' ? undefined : levelFilter,
          grade: gradeFilter === 'all' ? undefined : gradeFilter,
          section: sectionFilter === 'all' ? undefined : sectionFilter,
          date: dateFilter || undefined,
          page,
          pageSize,
        });
      if (error) toast.error(error);
      setListRows(rows);
      setListTotal(total);
      setCitationCount(cites);
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, levelFilter, gradeFilter, sectionFilter, dateFilter, page, pageSize]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, levelFilter, gradeFilter, sectionFilter, dateFilter, resetPage]);

  const loadStudentData = useCallback(async (student: Student) => {
    setLoadingStudent(true);
    try {
      if (student.estadoPension && student.estadoPension !== 'moroso') {
        await compromisosAlarmService.syncPagoBaselinesForPension(student.id, false);
      }
      const [debt, list, base] = await Promise.all([
        incidentsService.countDebtTriggerFaults(student.id),
        compromisosAlarmService.listForStudent(student.id),
        compromisosAlarmService.getBaselines(student.id),
      ]);
      if (debt.error) toast.error(debt.error);
      setCounts({
        faltaCount: debt.faltaCount,
        carnetCount: debt.carnetCount,
        tardeCount: debt.tardeCount,
      });
      setPagoMuted(Boolean(base.baselines.pago));
      if (list.error) toast.error(list.error);
      setHistory(list.items);
      const responsable = student.responsibleName?.trim();
      if (responsable) setParentName(responsable);
    } finally {
      setLoadingStudent(false);
    }
  }, []);

  useEffect(() => {
    const idParam = searchParams.get('student');
    if (!idParam) return;
    const id = Number(idParam);
    if (!Number.isFinite(id)) return;
    void studentsService.getById(id).then(({ student, error }) => {
      if (error || !student) return;
      setSelected(student);
      setSearch(student.fullName);
      void loadStudentData(student);
    });
  }, [searchParams, loadStudentData]);

  const selectFromList = async (row: CompromisoTardanzaListRow) => {
    const { student, error } = await studentsService.getById(row.studentId);
    if (error || !student) {
      toast.error(error || 'No se pudo abrir el alumno');
      return;
    }
    if (row.responsibleName && !student.responsibleName) {
      student.responsibleName = row.responsibleName;
    }
    setSelected(student);
    setParentName(student.responsibleName?.trim() || row.responsibleName?.trim() || '');
    setTipo('tardanza');
    void loadStudentData(student);
  };

  const clearSelection = () => {
    setSelected(null);
    setHistory([]);
    setCounts({ faltaCount: 0, carnetCount: 0, tardeCount: 0 });
  };

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setLevelFilter('all');
    setGradeFilter('all');
    setSectionFilter('all');
    resetPage();
  };

  const countsHintForTipo = (t: CompromisoAlarmaTipo): string => {
    if (t === 'tardanza') return `${counts.tardeCount} llegadas tarde desde el último compromiso`;
    if (t === 'falta')
      return `${counts.faltaCount} faltas / ${counts.carnetCount} sin carné desde el último compromiso`;
    return selected?.estadoPension === 'moroso' ? 'pensión pendiente' : 'pensión al día';
  };

  const handlePrint = async () => {
    if (!selected) return;
    if (parentName.trim().length < 3) {
      toast.error('Indique el nombre del apoderado antes de imprimir');
      return;
    }
    try {
      await downloadCompromisoAlarmaPdf({
        schoolName,
        studentName: selected.fullName,
        grade: selected.grade,
        section: selected.section,
        level: selected.level,
        barcode: selected.barcode,
        parentName: parentName.trim(),
        tipo,
        countsHint: countsHintForTipo(tipo),
      });
      toast.success('PDF generado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    }
  };

  const handleRegister = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { item, error } = await compromisosAlarmService.registerSigned({
        studentId: selected.id,
        tipo,
        parentName,
        registeredBy: user?.id ?? null,
        observations,
      });
      if (error || !item) {
        toast.error(error || 'No se pudo registrar');
        return;
      }
      toast.success('Compromiso registrado: el aviso de este motivo se reinició');
      setDialogOpen(false);
      setObservations('');
      await loadStudentData(selected);
      await loadList();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        title="Compromisos de alarma"
        description="Liste alumnos con llegadas tarde, imprima el acta para la firma del apoderado y registre el compromiso para reiniciar el aviso."
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-3">
        <StaffKpiStat
          label="Con llegadas tarde"
          value={listTotal}
          hint="Desde el último compromiso"
          icon={Users}
          tone="warning"
        />
        <StaffKpiStat
          label="Para citar"
          value={citationCount}
          hint={`${DEBT_TARDE_THRESHOLD} o más llegadas tarde`}
          icon={FileSignature}
          tone="accent"
        />
        <StaffKpiStat
          label="Página"
          value={`${page}/${totalPages}`}
          hint={`${pageSize} por página`}
          icon={Search}
          tone="info"
        />
      </div>

      <StaffToolbar
        title="Filtros"
        description="Busque por nombre o código. Puede filtrar por fecha de tardanza, nivel, grado y sección."
        footer={
          hasActiveFilters ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {listTotal} alumno{listTotal === 1 ? '' : 's'}
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
          <Label htmlFor="compromiso-search">Buscar alumno</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="compromiso-search"
              className="pl-10 pr-10"
              placeholder="Nombre o código del carnet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearch('')}
                aria-label="Borrar búsqueda"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="col-span-full grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="compromiso-date">Fecha de tardanza</Label>
            <Input
              id="compromiso-date"
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

      <div className={`grid gap-6 ${selected ? 'lg:grid-cols-2' : ''}`}>
        <StaffDataPanel>
          <StaffDataPanelHeader
            title={`Alumnos con llegadas tarde (${listTotal})`}
            description="Al entrar se listan todos. Pulse un alumno para imprimir o registrar el compromiso."
          />
          <div className="p-4 pt-0 sm:p-5 sm:pt-0">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando alumnos…
              </div>
            ) : listRows.length === 0 ? (
              <StaffEmptyState
                icon={Users}
                title="Sin llegadas tarde"
                description="No hay alumnos con tardanzas para estos filtros (o ya tienen compromiso reciente)."
              />
            ) : (
              <>
                <Table role="table" aria-label="Alumnos con llegadas tarde">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Aula</TableHead>
                      <TableHead className="text-center">Tardanzas</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listRows.map((row) => {
                      const isActive = selected?.id === row.studentId;
                      return (
                        <TableRow
                          key={row.studentId}
                          className={isActive ? 'bg-muted/60' : undefined}
                        >
                          <TableCell>
                            <div className="font-medium">{row.fullName}</div>
                            <div className="text-xs text-muted-foreground">{row.barcode}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.grade} {row.section}
                            <div className="text-xs text-muted-foreground">{row.level}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={row.needsCitation ? 'destructive' : 'secondary'}>
                              {row.tardeCount}
                              {row.needsCitation ? ' · citar' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatShortDate(row.lastTardeDate)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              onClick={() => void selectFromList(row)}
                            >
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {listTotal > pageSize && (
                  <StaffTablePagination
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={listTotal}
                    onPrev={prevPage}
                    onNext={nextPage}
                    onGoToPage={goToPage}
                    onPageSizeChange={changePageSize}
                  />
                )}
              </>
            )}
          </div>
        </StaffDataPanel>

        {selected && (
          <div className="space-y-6">
            <StaffDataPanel>
              <StaffDataPanelHeader
                title={selected.fullName}
                description={`Grado ${selected.grade} · Sección ${selected.section} · ${selected.level}`}
                action={
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                    Cerrar
                  </Button>
                }
              />
              {loadingStudent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={alerts.alertTarde ? 'destructive' : 'secondary'}>
                      Llegadas tarde: {counts.tardeCount}
                      {alerts.alertTarde ? ' · citar apoderado' : ''}
                    </Badge>
                    <Badge variant={alerts.alertFalta ? 'destructive' : 'secondary'}>
                      Faltas: {counts.faltaCount}
                      {counts.faltaCount >= DEBT_FALTA_THRESHOLD ? ' · citar' : ''}
                    </Badge>
                    <Badge variant={alerts.alertCarnet ? 'destructive' : 'secondary'}>
                      Sin carné: {counts.carnetCount}
                    </Badge>
                    {selected.estadoPension === 'moroso' && (
                      <Badge variant="destructive">Pensión pendiente</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Justificar la tardanza en la planilla no quita el aviso. Solo un compromiso
                    firmado reinicia el conteo.
                  </p>
                  <div className="space-y-2">
                    <Label>Nombre del apoderado(a)</Label>
                    <Input
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Ej. María Pérez López"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo del compromiso</Label>
                    <Select
                      value={tipo}
                      onValueChange={(v) => setTipo(v as CompromisoAlarmaTipo)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <div className="flex flex-col items-start">
                              <span>{o.label}</span>
                              <span className="text-xs text-muted-foreground">{o.hint}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_OPTIONS.find((o) => o.value === tipo)?.hint}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void handlePrint()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir acta
                    </Button>
                    <Button type="button" onClick={() => setDialogOpen(true)}>
                      <FileSignature className="mr-2 h-4 w-4" />
                      Registrar firmado
                    </Button>
                  </div>
                </div>
              )}
            </StaffDataPanel>

            <StaffDataPanel>
              <StaffDataPanelHeader
                title="Historial de compromisos"
                description="El registro activo reinicia el aviso de ese motivo."
              />
              <div className="max-h-[320px] space-y-2 overflow-auto p-4">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin compromisos aún.</p>
                )}
                {history.map((h) => (
                  <div key={h.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{tipoLabel(h.tipo)}</span>
                      {h.active ? (
                        <Badge>Vigente</Badge>
                      ) : (
                        <Badge variant="secondary">Anterior</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{h.parentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(h.signedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                ))}
              </div>
            </StaffDataPanel>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compromiso firmado</DialogTitle>
            <DialogDescription>
              Confirme que el apoderado firmó el acta en el colegio. Esto reinicia el aviso de{' '}
              <strong>{tipoLabel(tipo)}</strong> hasta que el alumno vuelva a acumular el mismo
              problema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Apoderado(a)</Label>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
                placeholder="Ej. Entrevista con tutoría, acuerdos…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRegister()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
