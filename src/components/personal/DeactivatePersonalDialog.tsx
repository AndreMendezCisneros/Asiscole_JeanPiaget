import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Personal } from '@/types/personal';

interface DeactivatePersonalDialogProps {
  personal: Personal | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (personal: Personal) => void;
}

/**
 * Doble confirmación para desactivar: explica las consecuencias y exige marcar
 * la casilla antes de habilitar el botón.
 */
export const DeactivatePersonalDialog = ({ personal, busy, onCancel, onConfirm }: DeactivatePersonalDialogProps) => {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [personal]);

  return (
    <AlertDialog open={personal !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            Desactivar a {personal?.fullName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Al desactivarlo ya no podrá marcar con el escáner, no se le registrarán inasistencias y no aparecerá en
            los controles diarios. Su historial se conserva y puede volver a activarlo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium">
          <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} />
          Confirmo que quiero desactivar a este empleado
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!confirmed || busy || !personal}
            onClick={() => personal && onConfirm(personal)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desactivar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
