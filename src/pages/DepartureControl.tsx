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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Clock,
  Search,
  Users,
  CheckCircle,
  Loader2,
  LogOut,
  AlertTriangle,
  Barcode,
  ChevronDown,
  GraduationCap,
} from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import { arrivalService, authService, studentsService, whatsappService } from '@/lib/services';
import type { ArrivalRecord, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';
import { cn } from '@/lib/utils';

const GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function enqueueDepartureWhatsApp(
  records: ArrivalRecord[],
  updatedIds: number[],
  departureTime: string | null,
  tipo: 'Normal' | 'Autorizada',
) {
  if (!whatsappService.isEnabled() || updatedIds.length === 0) return;
  const idSet = new Set(updatedIds);
  for (const record of records) {
    if (!idSet.has(record.id) || !record.student) continue;
    const student = record.student;
    const notifyRecord: ArrivalRecord = {
      ...record,
      departureTime: departureTime || record.departureTime,
      departureType: tipo,
    };
    void whatsappService.notifyParentDeparture(student, notifyRecord).then((wa) => {
      if (!wa.ok && wa.error) {
        toast.warning(`WhatsApp salida (${student.fullName}): ${wa.error}`, { duration: 4500 });
      }
    });
  }
}

function getTodayDate() {
  const nowLima = new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [dd, mm, yyyy] = nowLima.split('/');
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

type DepartureFilter = 'pending' | 'done' | 'all';
type DepartureType = 'Normal' | 'Autorizada';

interface DepartureGroup {
  key: string;
  level: EducationalLevel;
  grade: string;
  section: string;
  label: string;
  total: number;
  pending: number;
  done: number;
  pendingRecordIds: number[];
}

interface BulkConfirmTarget {
  label: string;
  recordIds: number[];
  tipo: DepartureType;
}

function matchesBulkFilters(
  group: DepartureGroup,
  level: 'all' | EducationalLevel,
  grade: 'all' | string,
  section: 'all' | string,
) {
  if (level !== 'all' && group.level !== level) return false;
  if (grade !== 'all' && group.grade !== grade) return false;
  if (section !== 'all' && group.section !== section) return false;
  return true;
}

function hasActiveBulkFilters(
  level: 'all' | EducationalLevel,
  grade: 'all' | string,
  section: 'all' | string,
) {
  return level !== 'all' || grade !== 'all' || section !== 'all';
}

function buildDepartureGroups(records: ArrivalRecord[]): DepartureGroup[] {
  const map = new Map<string, DepartureGroup>();

  for (const record of records) {
    const level = record.student?.level;
    const grade = record.student?.grade;
    const section = record.student?.section;
    if (!level || !grade || !section) continue;

    const key = `${level}|${grade}|${section}`;
    const existing = map.get(key) ?? {
      key,
      level,
      grade,
      section,
      label: `${level} ${grade} '${section}'`,
      total: 0,
      pending: 0,
      done: 0,
      pendingRecordIds: [],
    };

    existing.total += 1;
    if (record.departureTime) {
      existing.done += 1;
    } else {
      existing.pending += 1;
      existing.pendingRecordIds.push(record.id);
    }

    map.set(key, existing);
  }

  const levelOrder: Record<EducationalLevel, number> = { Primaria: 0, Secundaria: 1 };
  const gradeOrder = (g: string) => GRADES.indexOf(g);

  return [...map.values()].sort((a, b) => {
    const levelDiff = (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    const gradeDiff = gradeOrder(a.grade) - gradeOrder(b.grade);
    if (gradeDiff !== 0) return gradeDiff;
    return a.section.localeCompare(b.section);
  });
}

export const DepartureControl = () => {
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departureFilter, setDepartureFilter] = useState<DepartureFilter>('pending');
  const [departureType, setDepartureType] = useState<DepartureType>('Normal');
  const [bulkLevel, setBulkLevel] = useState<'all' | EducationalLevel>('all');
  const [bulkGrade, setBulkGrade] = useState<'all' | string>('all');
  const [bulkSection, setBulkSection] = useState<'all' | string>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [confirmBulk, setConfirmBulk] = useState<BulkConfirmTarget | null>(null);
  const [individualOpen, setIndividualOpen] = useState(false);
  const isMountedRef = useRef(true);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const loadArrivals = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      const { records: arrivals, error } = await arrivalService.getArrivals({ date: selectedDate });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error('Error al cargar registros de asistencia');
        setRecords([]);
      } else {
        setRecords(arrivals);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en loadArrivals:', error);
      toast.error('Error al procesar los registros');
      setRecords([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadArrivals();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadArrivals]);

  useEffect(() => {
    setLevelFilter(bulkLevel);
    setGradeFilter(bulkGrade);
    setSectionFilter(bulkSection);
  }, [bulkLevel, bulkGrade, bulkSection]);

  const departureGroups = useMemo(() => buildDepartureGroups(records), [records]);

  const bulkFiltersActive = hasActiveBulkFilters(bulkLevel, bulkGrade, bulkSection);

  const filteredDepartureGroups = useMemo(
    () =>
      bulkFiltersActive
        ? departureGroups.filter((g) => matchesBulkFilters(g, bulkLevel, bulkGrade, bulkSection))
        : departureGroups,
    [departureGroups, bulkLevel, bulkGrade, bulkSection, bulkFiltersActive],
  );

  const groupsWithPending = useMemo(
    () => departureGroups.filter((g) => g.pending > 0),
    [departureGroups],
  );

  const filteredGroupsWithPending = useMemo(
    () => filteredDepartureGroups.filter((g) => g.pending > 0),
    [filteredDepartureGroups],
  );

  const bulkPendingIds = useMemo(() => {
    return filteredGroupsWithPending.flatMap((g) => g.pendingRecordIds);
  }, [filteredGroupsWithPending]);

  const bulkSelectionLabel = useMemo(() => {
    if (bulkLevel === 'all' && bulkGrade === 'all' && bulkSection === 'all') {
      return 'todas las aulas con pendientes';
    }
    const parts: string[] = [];
    if (bulkLevel !== 'all') parts.push(bulkLevel);
    if (bulkGrade !== 'all') parts.push(bulkGrade);
    if (bulkSection !== 'all') parts.push(`'${bulkSection}'`);
    if (bulkGrade !== 'all' && bulkSection === 'all') {
      return `${parts.join(' ')} (todas las secciones)`;
    }
    return parts.join(' ');
  }, [bulkLevel, bulkGrade, bulkSection]);

  const executeBulkDeparture = async (target: BulkConfirmTarget) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar salidas');
      return;
    }

    setBulkSubmitting(true);
    const { successCount, skipped, error, updatedIds, departureTime } =
      await arrivalService.createBulkDepartureRecords(
        target.recordIds,
        currentUser.id,
        target.tipo,
      );

    if (!isMountedRef.current) return;
    setBulkSubmitting(false);
    setConfirmBulk(null);

    if (error) {
      toast.error(error);
      return;
    }

    if (successCount === 0) {
      toast.info('No había salidas pendientes en la selección');
      return;
    }

    enqueueDepartureWhatsApp(records, updatedIds, departureTime, target.tipo);

    const skippedNote = skipped > 0 ? ` · ${skipped} ya tenían salida` : '';
    staffNotify.success(
      'Salidas registradas',
      `${successCount} estudiante${successCount === 1 ? '' : 's'} — ${target.label}${skippedNote}`,
    );
    void loadArrivals();
  };

  const requestBulkDeparture = (label: string, recordIds: number[], tipo: DepartureType = departureType) => {
    if (recordIds.length === 0) {
      toast.info('No hay estudiantes pendientes de salida en esta selección');
      return;
    }
    setConfirmBulk({ label, recordIds, tipo });
  };

  const handleBarcodeSubmit = async () => {
    const code = barcodeInput.trim();
    if (!code) return;

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar salidas');
      return;
    }

    setScanning(true);
    try {
      const { student, error } = await studentsService.getByBarcode(code, { skipReincidence: true });

      if (!isMountedRef.current) return;

      if (error || !student) {
        toast.error(error || 'No se encontró estudiante con ese DNI o carnet');
        return;
      }

      const record = records.find((r) => r.student?.id === student.id);
      if (!record) {
        toast.error('El estudiante no tiene llegada registrada en la fecha seleccionada');
        return;
      }

      if (record.departureTime) {
        toast.info(`${student.fullName} ya tiene salida registrada (${record.departureTime})`);
        setBarcodeInput('');
        return;
      }

      const { successCount, error: bulkError, updatedIds, departureTime } =
        await arrivalService.createBulkDepartureRecords(
          [record.id],
          currentUser.id,
          departureType,
        );

      if (bulkError || successCount === 0) {
        toast.error(bulkError || 'No se pudo registrar la salida');
        return;
      }

      enqueueDepartureWhatsApp(
        records.map((r) => (r.id === record.id ? { ...r, student } : r)),
        updatedIds,
        departureTime,
        departureType,
      );

      staffNotify.success('Salida registrada', student.fullName);
      setBarcodeInput('');
      void loadArrivals();
      barcodeInputRef.current?.focus();
    } finally {
      if (isMountedRef.current) {
        setScanning(false);
      }
    }
  };

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const studentName = record.student?.fullName ?? '';
        const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesLevel = levelFilter === 'all' || record.student?.level === levelFilter;
        const matchesGrade = gradeFilter === 'all' || record.student?.grade === gradeFilter;
        const matchesSection = sectionFilter === 'all' || record.student?.section === sectionFilter;
        const hasDeparture = Boolean(record.departureTime);
        const matchesDeparture =
          departureFilter === 'all' ||
          (departureFilter === 'pending' && !hasDeparture) ||
          (departureFilter === 'done' && hasDeparture);
        return matchesSearch && matchesLevel && matchesGrade && matchesSection && matchesDeparture;
      }),
    [records, searchTerm, levelFilter, gradeFilter, sectionFilter, departureFilter],
  );

  const stats = useMemo(() => {
    const pending = records.filter((r) => !r.departureTime).length;
    const done = records.filter((r) => r.departureTime).length;
    return { total: records.length, pending, done, groups: departureGroups.length };
  }, [records, departureGroups.length]);

  const dateLabel =
    selectedDate === getTodayDate()
      ? 'del día de hoy'
      : `del ${new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`;

  const syncFiltersFromBulk = () => {
    setLevelFilter(bulkLevel);
    setGradeFilter(bulkGrade);
    setSectionFilter(bulkSection);
    setDepartureFilter('pending');
  };

  const clearBulkFilters = () => {
    setBulkLevel('all');
    setBulkGrade('all');
    setBulkSection('all');
  };

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={LogOut}
        eyebrow="Asistencia"
        title="Registro de Salidas"
        description={`Reporte de salida por grado y sección ${dateLabel}. Marque el retiro de aulas completas o de estudiantes individuales.`}
        accent="warning"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="Aulas con llegada"
          value={stats.groups}
          icon={GraduationCap}
          tone="primary"
        />
        <StaffKpiStat
          label="Pendientes de salida"
          value={stats.pending}
          hint={stats.pending > 0 ? 'Por registrar' : 'Todo al día'}
          hintIcon={stats.pending > 0 ? AlertTriangle : CheckCircle}
          icon={AlertTriangle}
          tone="warning"
        />
        <StaffKpiStat
          label="Salidas registradas"
          value={stats.done}
          hint={
            stats.total > 0
              ? `${Math.round((stats.done / stats.total) * 100)}% del total`
              : 'Sin llegadas aún'
          }
          hintIcon={CheckCircle}
          icon={LogOut}
          tone="success"
        />
        <StaffKpiStat
          label="Total con llegada"
          value={stats.total}
          icon={Users}
          tone="accent"
        />
      </div>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Salida por grado y sección"
          description="Seleccione nivel, grado y sección para registrar la salida de un aula o grado completo"
        />
        <div className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={getTodayDate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Nivel</Label>
              <Select
                value={bulkLevel}
                onValueChange={(v) => setBulkLevel(v as 'all' | EducationalLevel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nivel" />
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
              <Select value={bulkGrade} onValueChange={setBulkGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Grado" />
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
              <Select value={bulkSection} onValueChange={setBulkSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Sección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas (grado completo)</SelectItem>
                  {SECTIONS.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de salida</Label>
              <Select
                value={departureType}
                onValueChange={(v) => setDepartureType(v as DepartureType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Autorizada">Autorizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <div className="text-sm">
              <span className="font-medium text-foreground">{bulkPendingIds.length}</span>
              <span className="text-muted-foreground">
                {' '}
                pendiente{bulkPendingIds.length === 1 ? '' : 's'} en{' '}
                <span className="font-medium text-foreground">{bulkSelectionLabel}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {bulkFiltersActive && (
                <Button variant="ghost" size="sm" onClick={clearBulkFilters}>
                  Limpiar filtros
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={syncFiltersFromBulk}
                disabled={!bulkFiltersActive}
              >
                Ver en detalle
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={bulkPendingIds.length === 0 || bulkSubmitting}
                onClick={() =>
                  requestBulkDeparture(bulkSelectionLabel, bulkPendingIds, departureType)
                }
              >
                {bulkSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Registrar salida seleccionada
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando aulas...
            </div>
          ) : departureGroups.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title="Sin llegadas registradas"
              description="No hay estudiantes con ingreso en la fecha seleccionada"
            />
          ) : filteredDepartureGroups.length === 0 ? (
            <StaffEmptyState
              icon={GraduationCap}
              title="Sin aulas para estos filtros"
              description={`No hay llegadas registradas en ${bulkSelectionLabel} para la fecha seleccionada`}
              action={
                <Button variant="outline" size="sm" onClick={clearBulkFilters}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <>
              {bulkFiltersActive && (
                <p className="text-xs text-muted-foreground">
                  Mostrando {filteredDepartureGroups.length} aula
                  {filteredDepartureGroups.length === 1 ? '' : 's'} · {bulkSelectionLabel}
                </p>
              )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredDepartureGroups.map((group) => (
                <div
                  key={group.key}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4 transition-colors',
                    group.pending > 0
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/60 bg-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{group.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.total} con llegada · {group.done} con salida
                      </p>
                    </div>
                    {group.pending === 0 ? (
                      <Badge className="shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Completo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-700">
                        {group.pending} pendiente{group.pending === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                  {group.pending > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={bulkSubmitting}
                      onClick={() =>
                        requestBulkDeparture(group.label, group.pendingRecordIds, departureType)
                      }
                    >
                      <LogOut className="h-4 w-4" />
                      Registrar salida del aula
                    </Button>
                  )}
                </div>
              ))}
            </div>
            </>
          )}

          {(bulkFiltersActive ? filteredGroupsWithPending : groupsWithPending).length > 1 && (
            <div className="flex justify-end border-t border-border/60 pt-3">
              <Button
                variant="secondary"
                className="gap-2"
                disabled={
                  (bulkFiltersActive ? filteredGroupsWithPending : groupsWithPending).length === 0 ||
                  bulkSubmitting
                }
                onClick={() =>
                  requestBulkDeparture(
                    bulkFiltersActive ? bulkSelectionLabel : 'todas las aulas con pendientes',
                    (bulkFiltersActive ? filteredGroupsWithPending : groupsWithPending).flatMap(
                      (g) => g.pendingRecordIds,
                    ),
                    departureType,
                  )
                }
              >
                <Users className="h-4 w-4" />
                Registrar todas las aulas pendientes (
                {(bulkFiltersActive ? filteredGroupsWithPending : groupsWithPending).reduce(
                  (sum, g) => sum + g.pending,
                  0,
                )}
                )
              </Button>
            </div>
          )}
        </div>
      </StaffDataPanel>

      <Collapsible open={individualOpen} onOpenChange={setIndividualOpen}>
        <StaffDataPanel>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left sm:px-5"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">Registro individual</p>
                <p className="text-xs text-muted-foreground">
                  Escanee un carnet o busque por nombre en el detalle
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
                  individualOpen && 'rotate-180',
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative min-w-0 flex-1 space-y-2">
                  <Label htmlFor="departure-barcode">Carnet / DNI</Label>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barcodeInputRef}
                      id="departure-barcode"
                      placeholder="Escanee o escriba el DNI..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleBarcodeSubmit();
                        }
                      }}
                      className="pl-10"
                      autoComplete="off"
                      disabled={scanning || bulkSubmitting}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void handleBarcodeSubmit()}
                  disabled={!barcodeInput.trim() || scanning || bulkSubmitting}
                  className="gap-2"
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Registrar uno
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </StaffDataPanel>
      </Collapsible>

      <StaffToolbar title="Detalle por estudiante" description="Consulte el listado filtrado del día">
        <div className="col-span-full grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
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
            <Label>Estado salida</Label>
            <Select
              value={departureFilter}
              onValueChange={(v) => setDepartureFilter(v as DepartureFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="done">Con salida</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select
              value={levelFilter}
              onValueChange={(v) => setLevelFilter(v as 'all' | EducationalLevel)}
            >
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
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
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
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
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
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Listado del día"
          description={`${filteredRecords.length} visibles`}
          action={
            <Button onClick={() => void loadArrivals()} variant="outline" size="sm" disabled={loading}>
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
          ) : filteredRecords.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title={departureFilter === 'pending' ? 'Sin salidas pendientes' : 'Sin registros'}
              description={
                departureFilter === 'pending'
                  ? 'Todos los estudiantes visibles ya tienen salida registrada'
                  : 'No hay registros para los filtros seleccionados'
              }
            />
          ) : (
            <div className="app-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Nivel / Grado</TableHead>
                    <TableHead>Hora llegada</TableHead>
                    <TableHead>Hora salida</TableHead>
                    <TableHead>Estado llegada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.student?.fullName}</TableCell>
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
                        {record.departureTime ? (
                          <div className="flex items-center gap-2">
                            <LogOut className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{record.departureTime}</span>
                            {record.departureType === 'Autorizada' && (
                              <Badge variant="outline" className="text-xs">
                                Autorizada
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">Pendiente</span>
                          </div>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </StaffDataPanel>

      <AlertDialog open={confirmBulk !== null} onOpenChange={(open) => !open && setConfirmBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar salida masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBulk && (
                <>
                  Se registrará la salida <strong>{confirmBulk.tipo.toLowerCase()}</strong> de{' '}
                  <strong>{confirmBulk.recordIds.length}</strong> estudiante
                  {confirmBulk.recordIds.length === 1 ? '' : 's'} en{' '}
                  <strong>{confirmBulk.label}</strong>, con la hora actual.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkSubmitting}
              onClick={(e) => {
                e.preventDefault();
                if (confirmBulk) void executeBulkDeparture(confirmBulk);
              }}
            >
              {bulkSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Confirmar salida'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
