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
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import type { FaultType, Student } from '@/types';

interface IncidentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  fault: FaultType | null;
  observations?: string;
  evidenceCount?: number;
  registering?: boolean;
  onConfirm: () => void;
}

export function IncidentConfirmDialog({
  open,
  onOpenChange,
  student,
  fault,
  observations,
  evidenceCount = 0,
  registering,
  onConfirm,
}: IncidentConfirmDialogProps) {
  if (!student || !fault) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tutor-dialog sm:max-w-md rounded-[28px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar estudiante</DialogTitle>
          <DialogDescription>
            ¿Confirma que esta incidencia es para este estudiante?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2 text-center sm:flex-row sm:text-left">
          <StudentPhoto src={student.profilePhoto} name={student.fullName} className="h-20 w-20 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-semibold leading-tight">{student.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {student.level} · {student.grade} — Sección {student.section}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{fault.name}</span>
            <Badge variant={fault.severity === 'Grave' ? 'destructive' : 'secondary'} className="text-[10px]">
              {fault.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {fault.category}
            </Badge>
          </div>
          {observations?.trim() && (
            <p className="text-sm text-muted-foreground">{observations.trim()}</p>
          )}
          {evidenceCount > 0 && (
            <p className="text-xs text-muted-foreground">{evidenceCount} foto(s) de evidencia adjunta(s)</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={registering}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={registering}>
            {registering ? 'Registrando…' : 'Sí, registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
