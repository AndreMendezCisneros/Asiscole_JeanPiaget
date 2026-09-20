import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileSignature, Loader2, Printer, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffToolbar,
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
import type { Student } from '@/types';
import type { CompromisoAlarma, CompromisoAlarmaTipo } from '@/types/compromisoAlarma';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_OPTIONS: { value: CompromisoAlarmaTipo; label: string }[] = [
  { value: 'tardanza', label: 'Tardanzas (≥ 3)' },
  { value: 'falta', label: 'Faltas / inasistencias (≥ 4)' },
  { value: 'pago', label: 'Pensión / pagos' },
];

function tipoLabel(t: CompromisoAlarmaTipo): string {
  return TIPO_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export const CompromisosAlarma = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
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
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    void studentsService.searchForTutorScanner(q).then(({ students, error }) => {
      if (cancelled) return;
      if (error) toast.error(error);
      setResults(students);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

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

  const selectStudent = (student: Student) => {
    setSelected(student);
    setResults([]);
    setSearch(student.fullName);
    void loadStudentData(student);
  };

  const countsHintForTipo = (t: CompromisoAlarmaTipo): string => {
    if (t === 'tardanza') return `${counts.tardeCount} tardanzas desde el último reinicio`;
    if (t === 'falta')
      return `${counts.faltaCount} faltas / ${counts.carnetCount} sin carnet desde el último reinicio`;
    return selected?.estadoPension === 'moroso' ? 'pensión morosa' : 'sin deuda de pensión';
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
      toast.success('Compromiso registrado: la alarma de este tipo se reinició');
      setDialogOpen(false);
      setObservations('');
      await loadStudentData(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compromisos de alarma"
        description="Imprima el acta para que el apoderado firme en el colegio y registre el compromiso para reiniciar el aviso sonoro (tardanzas, faltas o pensión)."
      />

      <StaffToolbar>
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar alumno por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-md">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => selectStudent(s)}
                  >
                    <span className="font-medium">{s.fullName}</span>
                    <span className="ml-2 text-muted-foreground">
                      {s.grade} {s.section} · {s.level}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StaffToolbar>

      {!selected && (
        <StaffEmptyState
          icon={Users}
          title="Seleccione un estudiante"
          description="Busque al alumno con alarma activa para imprimir o registrar el compromiso del apoderado."
        />
      )}

      {selected && (
        <div className="grid gap-6 lg:grid-cols-2">
          <StaffDataPanel>
            <StaffDataPanelHeader
              title={selected.fullName}
              description={`Grado ${selected.grade} · Sección ${selected.section} · ${selected.level}`}
            />
            {loadingStudent ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={alerts.alertTarde ? 'destructive' : 'secondary'}>
                    Tardanzas: {counts.tardeCount}/{DEBT_TARDE_THRESHOLD}
                  </Badge>
                  <Badge variant={alerts.alertFalta ? 'destructive' : 'secondary'}>
                    Faltas: {counts.faltaCount}/{DEBT_FALTA_THRESHOLD}
                  </Badge>
                  <Badge variant={alerts.alertCarnet ? 'destructive' : 'secondary'}>
                    Sin carnet: {counts.carnetCount}/4
                  </Badge>
                  {selected.estadoPension === 'moroso' && (
                    <Badge variant="destructive">Pensión morosa</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  La justificación TJ/IJ no apaga la alarma. Solo un compromiso firmado reinicia el
                  conteo de ese tipo.
                </p>
                <div className="space-y-2">
                  <Label>Apoderado(a)</Label>
                  <Input
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Nombre completo del apoderado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de compromiso</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as CompromisoAlarmaTipo)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handlePrint()}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir PDF
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
              description="Últimos registros (el activo reinicia la alarma de su tipo)."
            />
            <div className="max-h-[420px] space-y-2 overflow-auto p-4">
              {history.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin compromisos aún.</p>
              )}
              {history.map((h) => (
                <div
                  key={h.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{tipoLabel(h.tipo)}</span>
                    {h.active ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Histórico</Badge>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compromiso firmado</DialogTitle>
            <DialogDescription>
              Confirme que el apoderado firmó el acta en el colegio. Esto reinicia el aviso sonoro
              de <strong>{tipoLabel(tipo)}</strong> hasta que se vuelva a alcanzar el umbral.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Apoderado(a)</Label>
              <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
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
              Confirmar reinicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
