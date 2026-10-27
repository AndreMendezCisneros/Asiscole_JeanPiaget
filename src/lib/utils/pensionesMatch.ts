import { buildStudentLookupVariants } from '@/lib/services/studentsService';
import { normalizePersonName } from '@/lib/utils/personName';

export type PensionMatchCandidate = {
  rawDni: string | null;
  rawNombre: string | null;
};

export type PensionMatchStudent = {
  id: number;
  barcode: string;
  fullName: string;
};

export type PensionMatchResult = {
  status: 'ok' | 'sin_match' | 'ambiguo';
  idEstudiante: number | null;
  nombreMatched: string | null;
  /** Cómo se encontró al alumno. */
  metodo: 'dni' | 'nombre' | null;
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const SIN_MATCH: PensionMatchResult = {
  status: 'sin_match',
  idEstudiante: null,
  nombreMatched: null,
  metodo: null,
};
const AMBIGUO: PensionMatchResult = { ...SIN_MATCH, status: 'ambiguo' };

function found(s: PensionMatchStudent, metodo: 'dni' | 'nombre'): PensionMatchResult {
  return { status: 'ok', idEstudiante: s.id, nombreMatched: s.fullName, metodo };
}

/**
 * El Excel puede traer menos nombres que el SIE ("PEREZ RUIZ, JUAN" vs "PEREZ RUIZ JUAN CARLOS").
 * Apellidos al inicio y el resto de palabras dentro del nombre del SIE; así no se cruzan hermanos.
 */
function containsAllWords(excel: string[], sie: string[]): boolean {
  if (excel.length < 3 || excel.length > sie.length) return false;
  if (excel[0] !== sie[0] || excel[1] !== sie[1]) return false;
  const rest = sie.slice(2);
  return excel.slice(2).every((w) => {
    const i = rest.indexOf(w);
    if (i < 0) return false;
    rest.splice(i, 1);
    return true;
  });
}

/** Primero DNI; si no lo encuentra (o hay varios), por nombre; si tampoco, sin match. */
export function matchPensionCandidate(
  candidate: PensionMatchCandidate,
  students: PensionMatchStudent[],
  fuzzyThreshold = 0.92,
): PensionMatchResult {
  let dniHits: PensionMatchStudent[] = [];
  if (candidate.rawDni) {
    const variants = new Set(buildStudentLookupVariants(candidate.rawDni));
    dniHits = students.filter((s) => {
      for (const v of buildStudentLookupVariants(s.barcode)) {
        if (variants.has(v)) return true;
      }
      return false;
    });
    if (dniHits.length === 1) return found(dniHits[0], 'dni');
  }

  // Con DNI repetido, el nombre decide entre esos alumnos.
  const pool = dniHits.length > 1 ? dniHits : students;
  const norm = normalizePersonName(candidate.rawNombre);
  if (!norm) return dniHits.length > 1 ? AMBIGUO : SIN_MATCH;

  const exact = pool.filter((s) => normalizePersonName(s.fullName) === norm);
  if (exact.length === 1) return found(exact[0], 'nombre');
  if (exact.length > 1) return AMBIGUO;

  const fuzzy = pool
    .map((s) => ({ s, score: similarity(norm, normalizePersonName(s.fullName)) }))
    .filter((x) => x.score >= fuzzyThreshold)
    .sort((a, b) => b.score - a.score);
  if (fuzzy.length === 1) return found(fuzzy[0].s, 'nombre');
  if (fuzzy.length > 1 && fuzzy[0].score > fuzzy[1].score + 0.02) {
    return found(fuzzy[0].s, 'nombre');
  }
  if (fuzzy.length > 1) return AMBIGUO;

  const words = norm.split(' ');
  const byWords = pool.filter((s) =>
    containsAllWords(words, normalizePersonName(s.fullName).split(' ')),
  );
  if (byWords.length === 1) return found(byWords[0], 'nombre');
  if (byWords.length > 1 || dniHits.length > 1) return AMBIGUO;

  return SIN_MATCH;
}

export type PensionAusentesResult<T> = {
  /** Ya no salen en el Excel: se pueden poner al día. */
  ausentes: T[];
  /** No salen con match, pero su nombre se parece a una fila sin match/ambigua. */
  protegidos: T[];
};

/**
 * Alumnos con meses impagos que ya no aparecen en el Excel de deudas.
 * Si una fila sin match o ambigua se parece al nombre del alumno, no se cierra:
 * puede ser el mismo alumno con otro número de documento en el reporte.
 */
export function computeAusentes<T extends { idEstudiante: number; nombreEstudiante: string }>(
  impagos: T[],
  matchedIds: Iterable<number>,
  nombresSinMatch: Array<string | null>,
  fuzzyThreshold = 0.92,
): PensionAusentesResult<T> {
  const matched = new Set(matchedIds);
  const dudosos = nombresSinMatch.map((n) => normalizePersonName(n)).filter(Boolean);
  const ausentes: T[] = [];
  const protegidos: T[] = [];
  for (const row of impagos) {
    if (matched.has(row.idEstudiante)) continue;
    const norm = normalizePersonName(row.nombreEstudiante);
    const parecido = dudosos.some((d) => similarity(norm, d) >= fuzzyThreshold);
    (parecido ? protegidos : ausentes).push(row);
  }
  return { ausentes, protegidos };
}
