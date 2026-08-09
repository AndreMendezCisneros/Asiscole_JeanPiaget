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

export function matchPensionCandidate(
  candidate: PensionMatchCandidate,
  students: PensionMatchStudent[],
  fuzzyThreshold = 0.92,
): PensionMatchResult {
  if (candidate.rawDni) {
    const variants = new Set(buildStudentLookupVariants(candidate.rawDni));
    const hits = students.filter((s) => {
      for (const v of buildStudentLookupVariants(s.barcode)) {
        if (variants.has(v)) return true;
      }
      return false;
    });
    if (hits.length === 1) {
      return { status: 'ok', idEstudiante: hits[0].id, nombreMatched: hits[0].fullName };
    }
    if (hits.length > 1) {
      return { status: 'ambiguo', idEstudiante: null, nombreMatched: null };
    }
  }

  const norm = normalizePersonName(candidate.rawNombre);
  if (norm) {
    const exact = students.filter((s) => normalizePersonName(s.fullName) === norm);
    if (exact.length === 1) {
      return { status: 'ok', idEstudiante: exact[0].id, nombreMatched: exact[0].fullName };
    }
    if (exact.length > 1) {
      return { status: 'ambiguo', idEstudiante: null, nombreMatched: null };
    }

    const fuzzy = students
      .map((s) => ({ s, score: similarity(norm, normalizePersonName(s.fullName)) }))
      .filter((x) => x.score >= fuzzyThreshold)
      .sort((a, b) => b.score - a.score);

    if (fuzzy.length === 1) {
      return { status: 'ok', idEstudiante: fuzzy[0].s.id, nombreMatched: fuzzy[0].s.fullName };
    }
    if (fuzzy.length > 1 && fuzzy[0].score > fuzzy[1].score + 0.02) {
      return { status: 'ok', idEstudiante: fuzzy[0].s.id, nombreMatched: fuzzy[0].s.fullName };
    }
    if (fuzzy.length > 1) {
      return { status: 'ambiguo', idEstudiante: null, nombreMatched: null };
    }
  }

  return { status: 'sin_match', idEstudiante: null, nombreMatched: null };
}
