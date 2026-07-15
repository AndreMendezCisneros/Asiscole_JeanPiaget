import { useMemo, useState } from 'react';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, LogIn, LogOut, Search } from 'lucide-react';
import type { ArrivalRecord, Student } from '@/types';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { foldSearchText } from '@/lib/utils/studentSearch';
import { cn } from '@/lib/utils';

interface ClassroomStudentListProps {
  students: Student[];
  loading?: boolean;
  arrivalByStudentId?: Map<number, ArrivalRecord>;
  onSelectStudent: (student: Student) => void;
  onRegisterArrival?: (student: Student) => void;
  onRegisterDeparture?: (recordId: number, student: Student) => void;
  registeringEntryId?: number | null;
  registeringDepartureId?: number | null;
}

function AttendanceStatusBadge({ record }: { record: ArrivalRecord | undefined }) {
  if (!record) {
    return (
      <Badge
        variant="outline"
        className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap text-[11px] sm:text-xs"
      >
        Sin registrar
      </Badge>
    );
  }

  return (
    <Badge
      variant={record.status === 'A tiempo' ? 'default' : 'destructive'}
      className={cn(
        'whitespace-nowrap text-[11px] sm:text-xs',
        record.status === 'A tiempo'
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      )}
    >
      {record.status}
    </Badge>
  );
}

export function ClassroomStudentList({
  students,
  loading,
  arrivalByStudentId,
  onSelectStudent,
  onRegisterArrival,
  onRegisterDeparture,
  registeringEntryId,
  registeringDepartureId,
}: ClassroomStudentListProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = foldSearchText(filter.trim());
    if (!q) return students;
    return students.filter((s) => foldSearchText(s.fullName).includes(q));
  }, [students, filter]);

  if (loading) {
    return (
      <CardContent className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando estudiantes…
      </CardContent>
    );
  }

  return (
    <CardContent className="p-3 sm:p-5 lg:p-6 space-y-3">
      {/* Buscador — font-size 16px en móvil para evitar zoom automático en iOS */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre…"
          className="pl-10 h-11"
          style={{ fontSize: '16px' }}
        />
      </div>

      {/* Contador */}
      {students.length > 0 && (
        <p className="text-xs text-muted-foreground px-0.5">
          {filtered.length} de {students.length} estudiante{students.length !== 1 ? 's' : ''}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            {students.length === 0
              ? 'No hay estudiantes activos en este salón.'
              : 'Ningún estudiante coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <ul
          className="space-y-2 overflow-y-auto pr-0.5"
          style={{ maxHeight: 'min(65dvh, 600px)' }}
        >
          {filtered.map((student) => {
            const record = arrivalByStudentId?.get(student.id);
            const canRegisterArrival = !record && onRegisterArrival;
            const canRegisterDeparture =
              record && !record.departureTime && onRegisterDeparture;
            const hasDeparture = record && record.departureTime;

            return (
              <li key={student.id}>
                {/* Card del estudiante: siempre en columna para móvil */}
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2.5">
                  {/* Fila superior: foto + info + estado */}
                  <div className="flex items-start gap-3">
                    <StudentPhoto
                      src={student.profilePhoto}
                      name={student.fullName}
                      className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      {/* Nombre completo: word-break para que no se corte */}
                      <p className="font-semibold text-sm leading-tight break-words hyphens-auto">
                        {student.fullName}
                      </p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                        {student.level} · {student.grade} — {student.section}
                      </p>
                      {/* Badge reincidencia debajo en móvil */}
                      {(student.reincidenceLevel ?? 0) > 0 && (
                        <div className="mt-1">
                          <ReincidenceBadge level={student.reincidenceLevel ?? 0} short />
                        </div>
                      )}
                    </div>
                    {/* Estado asistencia: arriba a la derecha, compacto */}
                    <div className="shrink-0 mt-0.5">
                      <AttendanceStatusBadge record={record} />
                    </div>
                  </div>

                  {/* Fila de botones de acción: en fila, ocupan todo el ancho disponible */}
                  <div className="flex gap-2">
                    {canRegisterArrival && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onRegisterArrival(student)}
                        disabled={registeringEntryId === student.id}
                        className="flex-1 gap-1.5 min-h-[2.5rem] text-xs sm:text-sm"
                      >
                        {registeringEntryId === student.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogIn className="h-3.5 w-3.5" />
                        )}
                        Entrada
                      </Button>
                    )}

                    {canRegisterDeparture && record && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onRegisterDeparture(record.id, student)}
                        disabled={registeringDepartureId === record.id}
                        className="flex-1 gap-1.5 min-h-[2.5rem] text-xs sm:text-sm"
                      >
                        {registeringDepartureId === record.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5" />
                        )}
                        Salida
                      </Button>
                    )}

                    {hasDeparture && (
                      <span className="flex-1 flex items-center justify-center text-xs text-muted-foreground gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 min-h-[2.5rem]">
                        <LogOut className="h-3 w-3 opacity-50" />
                        Salida OK
                      </span>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectStudent(student)}
                      className={cn(
                        'gap-1.5 min-h-[2.5rem] text-xs sm:text-sm shrink-0',
                        // Si no hay ningún otro botón, que crezca
                        !canRegisterArrival && !canRegisterDeparture && !hasDeparture
                          ? 'flex-1'
                          : '',
                      )}
                    >
                      Incidencia
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CardContent>
  );
}
