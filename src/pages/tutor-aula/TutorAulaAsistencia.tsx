import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StaffDataPanel, StaffDataPanelHeader, StaffEmptyState, StaffSegmentedControl } from '@/components/staff';
import { PageLoader } from '@/components/ui/page-loader';
import { tutorAulaService } from '@/lib/services/tutorAulaService';
import { getLimaTodayDate, getMonthBounds } from '@/lib/utils/limaDateTime';
import { getAllBimestres, getBimestreDates, getCurrentSchoolYear } from '@/lib/utils/bimestreUtils';
import { buildTutorAttendanceRows, dateKeysBetween } from '@/lib/utils/tutorAttendance';
import type { AttendanceStatus, Bimestre } from '@/types';
import { cn } from '@/lib/utils';

type Period = 'mes' | 'bimestre';

const CELL: Record<AttendanceStatus, { short: string; className: string; label: string }> = {
  A_tiempo: { short: '•', className: 'bg-success/15 text-success', label: 'A tiempo' },
  Tarde: { short: 'T', className: 'bg-warning/20 text-warning', label: 'Tarde' },
  Tarde_justificada: { short: 'TJ', className: 'bg-info/15 text-info', label: 'Tarde justificada' },
  Justificada: { short: 'J', className: 'bg-info/15 text-info', label: 'Justificada' },
  Inasistencia_justificada: { short: 'FJ', className: 'bg-info/15 text-info', label: 'Falta justificada' },
  Injustificada: { short: 'F', className: 'bg-destructive/15 text-destructive', label: 'Faltó' },
  Sin_registro: { short: '', className: 'text-muted-foreground', label: 'Sin registro' },
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bimestreRange(numero: number, year: number): { from: string; to: string } {
  const { inicio, fin } = getBimestreDates(numero as Bimestre, year);
  return { from: toDateKey(inicio), to: toDateKey(fin) };
}

function isWeekday(dateKey: string): boolean {
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Reporte de asistencia del salón (mes o bimestre), solo lectura. */
export function TutorAulaAsistencia() {
  const today = getLimaTodayDate();
  const [period, setPeriod] = useState<Period>('mes');
  const [month, setMonth] = useState(today.slice(0, 7));
  const schoolYear = getCurrentSchoolYear(new Date(`${today}T12:00:00`));
  const [bimestre, setBimestre] = useState('1');

  const range = useMemo(() => {
    if (period === 'bimestre') return bimestreRange(Number(bimestre), schoolYear);
    const [y, m] = month.split('-').map(Number);
    const b = getMonthBounds(y, m);
    return { from: b.start, to: b.end };
  }, [period, month, bimestre, schoolYear]);

  // Días hábiles hasta hoy: los futuros no aportan nada.
  const dateKeys = useMemo(() => {
    const end = range.to < today ? range.to : today;
    return dateKeysBetween(range.from, end).filter(isWeekday);
  }, [range, today]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['tutor-aula', 'asistencia', range.from, range.to],
    queryFn: async () => {
      const res = await tutorAulaService.getAttendance(range.from, range.to);
      if (res.error) throw new Error(res.error);
      return res;
    },
    staleTime: 5 * 60 * 1000,
    enabled: range.from <= today,
  });

  const rows = useMemo(
    () => (data ? buildTutorAttendanceRows(data.students, data.arrivals, dateKeys, today) : []),
    [data, dateKeys, today],
  );

  const showGrid = period === 'mes' && dateKeys.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <StaffSegmentedControl
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          options={[
            { value: 'mes', label: 'Mes' },
            { value: 'bimestre', label: 'Bimestre' },
          ]}
          aria-label="Periodo del reporte"
        />
        {period === 'mes' ? (
          <div className="space-y-1.5">
            <Label htmlFor="tutor-asis-mes">Mes</Label>
            <Input
              id="tutor-asis-mes"
              type="month"
              value={month}
              max={today.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value || today.slice(0, 7))}
              className="w-44"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Bimestre {schoolYear}</Label>
            <Select value={bimestre} onValueChange={setBimestre}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAllBimestres(schoolYear).map((b) => (
                  <SelectItem key={b.numero} value={String(b.numero)}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Reporte de asistencia (${rows.length} alumnos)`}
          description={`${dateKeys.length} días hábiles · Solo lectura`}
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0" aria-live="polite">
          {range.from > today ? (
            <StaffEmptyState icon={BarChart3} title="Periodo aún no iniciado" />
          ) : isLoading ? (
            <PageLoader message="Cargando asistencia..." />
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </p>
          ) : rows.length === 0 ? (
            <StaffEmptyState icon={BarChart3} title="Sin alumnos" />
          ) : (
            <div className="app-table-wrap">
              <Table aria-label="Asistencia del salón">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="sticky left-0 z-10 bg-card">Alumno</TableHead>
                    <TableHead scope="col" className="text-center">A tiempo</TableHead>
                    <TableHead scope="col" className="text-center">Tarde</TableHead>
                    <TableHead scope="col" className="text-center">Justif.</TableHead>
                    <TableHead scope="col" className="text-center">Faltas</TableHead>
                    <TableHead scope="col" className="text-center">% Asist.</TableHead>
                    {showGrid &&
                      dateKeys.map((d) => (
                        <TableHead key={d} scope="col" className="px-1 text-center text-xs">
                          {Number(d.slice(8, 10))}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ student, days, totals }) => {
                    const counted = totals.onTime + totals.late + totals.lateJustified + totals.absentJustified + totals.unjustified;
                    const attended = totals.onTime + totals.late + totals.lateJustified;
                    const pct = counted > 0 ? Math.round((attended / counted) * 100) : null;
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="sticky left-0 z-10 max-w-[12rem] truncate bg-card font-medium">
                          {student.fullName}
                        </TableCell>
                        <TableCell className="text-center">{totals.onTime}</TableCell>
                        <TableCell className="text-center">{totals.late + totals.lateJustified}</TableCell>
                        <TableCell className="text-center">{totals.absentJustified + totals.lateJustified}</TableCell>
                        <TableCell className={cn('text-center', totals.unjustified > 0 && 'font-semibold text-destructive')}>
                          {totals.unjustified}
                        </TableCell>
                        <TableCell className="text-center">{pct === null ? '—' : `${pct}%`}</TableCell>
                        {showGrid &&
                          days.map((d) => {
                            const cell = CELL[d.status];
                            return (
                              <TableCell
                                key={d.date}
                                className={cn('px-1 text-center text-xs font-semibold', cell.className)}
                                title={`${d.date}: ${cell.label}${d.arrivalTime ? ` (${d.arrivalTime.slice(0, 5)})` : ''}`}
                              >
                                {cell.short}
                              </TableCell>
                            );
                          })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {showGrid && rows.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              • a tiempo · T tarde · TJ tarde justificada · FJ falta justificada · F faltó
            </p>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
}
