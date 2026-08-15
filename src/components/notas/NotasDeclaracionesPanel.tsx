import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Student } from '@/types';
import type { NotasArea, NotasCarrera, NotasDeclaracion } from '@/types/notas';
import {
  NOTAS_EXCEL_MAX_BYTES,
  parseNotasExcelBuffer,
} from '@/lib/utils/notasExcelParser';
import { matchNotasCandidate } from '@/lib/utils/notasMatch';
import {
  areaShortLabel,
  resolveNotasCarreraArea,
} from '@/lib/utils/notasCatalogResolve';
import { downloadDeclaracionesNominaTemplate } from '@/lib/utils/nominaExcelTemplates';

export type DeclDraft = { areaId: number | null; carreraId: number | null };

type Props = {
  abiertaDeclaracion: boolean;
  students: Student[];
  areas: NotasArea[];
  carreras: NotasCarrera[];
  drafts: Record<number, DeclDraft>;
  onDraftsChange: (next: Record<number, DeclDraft> | ((prev: Record<number, DeclDraft>) => Record<number, DeclDraft>)) => void;
  search: string;
  onSearchChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onBulkArea: (areaId: number) => void;
};

const triggerClass =
  'h-auto min-h-11 w-full min-w-[13rem] items-start gap-2 border-2 border-border bg-background whitespace-normal py-2.5 text-left text-sm font-medium leading-snug text-foreground shadow-sm [&>span]:line-clamp-none [&>span]:whitespace-normal';

const contentClass =
  'min-w-[min(92vw,22rem)] max-w-[min(92vw,28rem)] border-border bg-popover text-popover-foreground shadow-lg';

const itemClass =
  'cursor-pointer whitespace-normal py-3 pl-8 pr-3 text-sm font-medium leading-snug text-foreground focus:bg-primary/10 focus:text-foreground';

export function NotasDeclaracionesPanel({
  abiertaDeclaracion,
  students,
  areas,
  carreras,
  drafts,
  onDraftsChange,
  search,
  onSearchChange,
  saving,
  onSave,
  onBulkArea,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.fullName} ${s.barcode}`.toLowerCase().includes(q),
    );
  })();

  const assigned = Object.values(drafts).filter((d) => d.areaId != null).length;

  const applyExcel = async (file: File | null) => {
    if (!file) return;
    if (!abiertaDeclaracion) {
      toast.error('La declaración de esta semana está cerrada');
      return;
    }
    if (file.size > NOTAS_EXCEL_MAX_BYTES) {
      toast.error('El archivo supera 8 MB');
      return;
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error('Solo se admiten .xlsx o .xls');
      return;
    }

    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseNotasExcelBuffer(buffer);
      if (!parsed.rows.length) {
        toast.error('No se detectaron filas (use columnas DNI y Carrera)');
        return;
      }

      const index = students.map((s) => ({
        id: s.id,
        barcode: s.barcode,
        fullName: s.fullName,
      }));

      let ok = 0;
      let sinMatch = 0;
      let sinCarrera = 0;
      const patch: Record<number, DeclDraft> = {};

      for (const row of parsed.rows) {
        const match = matchNotasCandidate(
          { rawDni: row.rawDni, rawNombre: row.rawNombre },
          index,
        );
        if (match.status !== 'ok' || match.idEstudiante == null) {
          sinMatch += 1;
          continue;
        }
        const resolved = resolveNotasCarreraArea(
          row.carreraNombre,
          row.areaCodigo,
          areas,
          carreras,
        );
        if (resolved.areaId == null) {
          sinCarrera += 1;
          continue;
        }
        patch[match.idEstudiante] = {
          areaId: resolved.areaId,
          carreraId: resolved.carreraId,
        };
        ok += 1;
      }

      if (ok === 0) {
        toast.error(
          `Ninguna fila útil (sin match ${sinMatch} · sin carrera/área ${sinCarrera})`,
        );
        return;
      }

      onDraftsChange((prev) => ({ ...prev, ...patch }));
      toast.success(
        `Excel aplicado: ${ok} declaraciones en borrador` +
          (sinMatch || sinCarrera
            ? ` · omitidas ${sinMatch + sinCarrera}`
            : '') +
          '. Pulse Guardar para confirmar.',
      );
    } catch (err) {
      console.error(err);
      toast.error('No se pudo leer el Excel de declaraciones');
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    if (!students.length) {
      toast.error('No hay alumnos activos para armar la plantilla');
      return;
    }
    const declaraciones: NotasDeclaracion[] = students.flatMap((student) => {
      const draft = drafts[student.id];
      if (!draft?.areaId && !draft?.carreraId) return [];
      const area = areas.find((a) => a.id === draft.areaId);
      const carrera = carreras.find((c) => c.id === draft.carreraId);
      return [
        {
          id: 0,
          idEstudiante: student.id,
          nombreEstudiante: student.fullName,
          barcode: student.barcode,
          semanaId: 0,
          areaId: draft.areaId ?? 0,
          areaNombre: area?.nombre ?? '',
          carreraId: draft.carreraId,
          carreraNombre: carrera?.nombre ?? null,
          declaradoEn: '',
        },
      ];
    });
    await downloadDeclaracionesNominaTemplate(students, { declaraciones });
    toast.success(`Plantilla con ${students.length} alumnos`);
  };

  return (
    <div className="space-y-4">
      {!abiertaDeclaracion && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          La declaración de esta semana está cerrada. Ábrala en Configuración para editar.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Asigne área y carrera (postulación) por alumno, o cárguelas desde Excel.
            {assigned > 0 ? (
              <span className="ml-1 font-medium text-foreground">
                {assigned} con área en borrador.
              </span>
            ) : null}
          </p>
          <Input
            placeholder="Buscar alumno…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm border-border bg-background text-foreground shadow-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => void applyExcel(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={parsing || !abiertaDeclaracion}
            onClick={() => void downloadTemplate()}
            className="border-2 border-border bg-background font-semibold shadow-sm"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Plantilla Excel
          </Button>
          <Button
            type="button"
            variant="outline-primary"
            disabled={parsing || !abiertaDeclaracion}
            onClick={() => inputRef.current?.click()}
            className="border-2 font-semibold shadow-sm"
          >
            {parsing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Cargar carreras Excel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !abiertaDeclaracion}
            className="font-semibold shadow-sm"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar declaraciones
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Asignar el mismo área a los alumnos filtrados
        </p>
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.nombre}
              onClick={() => onBulkArea(a.id)}
              disabled={!abiertaDeclaracion}
              className="notas-area-chip"
            >
              <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span>Todos → {areaShortLabel(a)}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Botones de acción: aplican el área a la lista visible (usa el buscador para acotar).
        </p>
      </div>

      <div className="notas-table-wrap">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="notas-table-th w-[28%] min-w-[12rem]">
                Estudiante
              </TableHead>
              <TableHead className="notas-table-th w-[12%] min-w-[6.5rem]">DNI</TableHead>
              <TableHead className="notas-table-th w-[28%] min-w-[14rem]">Área</TableHead>
              <TableHead className="notas-table-th w-[32%] min-w-[16rem]">
                Carrera (postulación)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const d = drafts[s.id] ?? { areaId: null, carreraId: null };
              const cars = carreras.filter((c) => c.areaId === d.areaId);
              const area = areas.find((a) => a.id === d.areaId);
              const carrera = carreras.find((c) => c.id === d.carreraId);
              return (
                <TableRow key={s.id} className="align-top hover:bg-muted/30">
                  <TableCell className="py-3 font-medium leading-snug text-foreground">
                    {s.fullName}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {s.barcode}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Select
                      value={d.areaId != null ? String(d.areaId) : undefined}
                      onValueChange={(v) =>
                        onDraftsChange((prev) => ({
                          ...prev,
                          [s.id]: { areaId: Number(v), carreraId: null },
                        }))
                      }
                      disabled={!abiertaDeclaracion}
                    >
                      <SelectTrigger className={triggerClass} title={area?.nombre}>
                        <SelectValue placeholder="Elegir área…" />
                      </SelectTrigger>
                      <SelectContent className={contentClass} position="popper">
                        {areas.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)} className={itemClass}>
                            {a.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Select
                      value={d.carreraId != null ? String(d.carreraId) : 'none'}
                      onValueChange={(v) =>
                        onDraftsChange((prev) => ({
                          ...prev,
                          [s.id]: {
                            areaId: d.areaId,
                            carreraId: v === 'none' ? null : Number(v),
                          },
                        }))
                      }
                      disabled={!abiertaDeclaracion || d.areaId == null}
                    >
                      <SelectTrigger className={triggerClass} title={carrera?.nombre}>
                        <SelectValue placeholder="Elegir carrera…" />
                      </SelectTrigger>
                      <SelectContent className={contentClass} position="popper">
                        <SelectItem value="none" className={itemClass}>
                          Sin carrera
                        </SelectItem>
                        {cars.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)} className={itemClass}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Excel: columnas <strong>DNI</strong>, <strong>Carrera</strong> (y opcional{' '}
        <strong>Área</strong> / Nombre). Tras cargar, pulse Guardar declaraciones.
      </p>
    </div>
  );
}
