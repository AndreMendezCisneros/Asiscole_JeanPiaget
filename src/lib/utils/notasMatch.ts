import { matchPensionCandidate, type PensionMatchStudent } from '@/lib/utils/pensionesMatch';

export type NotasMatchStudent = PensionMatchStudent;

export function matchNotasCandidate(
  candidate: { rawDni: string | null; rawNombre: string | null },
  students: NotasMatchStudent[],
) {
  return matchPensionCandidate(candidate, students);
}
