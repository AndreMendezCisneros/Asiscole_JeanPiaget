import { toast } from 'sonner';
import type { Student } from '@/types';

/** Aviso operativo de puerta. No se envía a padres. */
export function alertSpecialCare(student: Pick<Student, 'fullName' | 'cuidadoEspecial' | 'condicionEspecialNota'>): void {
  if (!student.cuidadoEspecial) return;
  const note = student.condicionEspecialNota?.trim();
  toast.warning('Cuidado especial con este alumno', {
    description: note ? `${student.fullName} · ${note}` : student.fullName,
    duration: 4500,
  });
}
