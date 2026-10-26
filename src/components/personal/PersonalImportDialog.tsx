import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScheduleEditor } from './ScheduleEditor';
import { personalService } from '@/lib/services/personalService';
import {
  isImportableRow,
  parsePersonalExcelBuffer,
  type PersonalExcelRow,
} from '@/lib/utils/personalExcelParser';
import { validateSchedule } from '@/lib/utils/personalSchedule';
import type { DiaSemana, HorarioDia } from '@/types/personal';

interface PersonalImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_SCHEDULE: HorarioDia[] = ([1, 2, 3, 4, 5] as DiaSemana[]).map((day) => ({
  day,
  entry: '07:30',
  exit: '15:00',
}));

export const PersonalImportDialog = ({ open, onOpenChange, onImported }: PersonalImportDialogProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PersonalExcelRow[]>([]);
  const [studentCollisions, setStudentCollisions] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [useDefaultSchedule, setUseDefaultSchedule] = useState(true);
  const [schedule, setSchedule] = useState<HorarioDia[]>(DEFAULT_SCHEDULE);

  const reset = () => {
    setRows([]);
    setStudentCollisions(new Set());
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Seleccione un archivo .xlsx');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('El archivo no puede superar 8 MB');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parsePersonalExcelBuffer(await file.arrayBuffer());
      parsed.warnings.forEach((w) => toast.warning(w));
      const dnis = parsed.rows.map((r) => r.dni).filter((d): d is string => Boolean(d));
      setStudentCollisions(new Set(await personalService.findStudentBarcodeCollisions(dnis)));
      setRows(parsed.rows);
      setFileName(file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo leer el Excel');
    } finally {
      setParsing(false);
    }
  };

  const canImport = (row: PersonalExcelRow) =>
    isImportableRow(row) && !studentCollisions.has(row.dni ?? '');
  const importable = rows.filter(canImport);

  const handleImport = async () => {
    const finalSchedule = useDefaultSchedule ? schedule : [];
    const scheduleError = validateSchedule(finalSchedule);
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    setImporting(true);
    try {
      const result = await personalService.bulkImport(
        importable.map((r) => ({
          barcode: r.dni as string,
          fullName: r.fullName,
          category: r.category,
          birthDate: r.birthDate,
          address: r.address,
          schedule: finalSchedule,
        })),
      );
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} con error. ${result.errors.slice(0, 3).join(' · ')}`);
      }
      toast.success(
        `Importados ${result.created}` + (result.skipped ? ` · ${result.skipped} ya existían` : ''),
      );
      onImported();
      reset();
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar personal desde Excel</DialogTitle>
          <DialogDescription>
            Directorio del personal (Nº, Apellidos y nombres, DNI…). Las filas de grupo definen la
            categoría. Los DNI que ya existen se saltan.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing || importing}>
          {parsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4" />
          )}
          {fileName || 'Elegir archivo .xlsx'}
        </Button>

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default">{importable.length} listos para importar</Badge>
              {rows.length - importable.length > 0 && (
                <Badge variant="destructive">{rows.length - importable.length} con problemas (se omiten)</Badge>
              )}
            </div>

            <div className="app-table-wrap max-h-72 overflow-y-auto">
              <Table aria-label="Vista previa del personal">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Observación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const issues = [...row.issues];
                    if (row.dni && studentCollisions.has(row.dni)) issues.push('DNI ya registrado como estudiante');
                    const ok = canImport(row);
                    return (
                      <TableRow key={row.rowIndex} className={ok ? undefined : 'bg-destructive/5'}>
                        <TableCell className="font-medium">{row.fullName}</TableCell>
                        <TableCell className="font-mono text-sm">{row.dni ?? '—'}</TableCell>
                        <TableCell className="text-sm">{row.category}</TableCell>
                        <TableCell className="text-xs">
                          {issues.length === 0 ? (
                            <span className="text-muted-foreground">OK</span>
                          ) : (
                            <span className={ok ? 'text-warning' : 'text-destructive'}>
                              {!ok && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />}
                              {issues.join(' · ')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={useDefaultSchedule}
                onCheckedChange={(checked) => setUseDefaultSchedule(Boolean(checked))}
              />
              Asignar este horario a todos los importados (luego se ajusta uno por uno)
            </label>
            {useDefaultSchedule && <ScheduleEditor value={schedule} onChange={setSchedule} />}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button variant="info" onClick={() => void handleImport()} disabled={importing || importable.length === 0}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar {importable.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
