import type { Student } from '@/types';

/** Máximo de estudiantes en el desplegable del escáner tutor. */
export const TUTOR_NAME_SEARCH_LIMIT = 50;

/** Quita acentos y pasa a minúsculas para comparar en cliente. */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

/** Palabras de al menos 2 caracteres (o DNI de 2+ dígitos). */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const tokens = normalized.split(' ').filter((part) => {
    if (part.length >= 2) return true;
    return part.replace(/\D/g, '').length >= 2;
  });

  return [...new Set(tokens)];
}

export function isDniLikeQuery(query: string): boolean {
  const trimmed = normalizeSearchQuery(query);
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly.length >= 2 && digitsOnly.length >= trimmed.replace(/\s/g, '').length * 0.6;
}

export function studentMatchesSearchTokens(student: Student, tokens: string[]): boolean {
  if (tokens.length === 0) return true;

  const nameFolded = foldSearchText(student.fullName);
  const barcodeFolded = foldSearchText(student.barcode);
  const barcodeDigits = student.barcode.replace(/\D/g, '');

  if (tokens.length >= 2) {
    const phrasePattern = tokens.map((token) => foldSearchText(token)).join('.*');
    if (phrasePattern && new RegExp(phrasePattern, 'i').test(nameFolded)) {
      return true;
    }
  }

  return tokens.every((token) => {
    const folded = foldSearchText(token);
    if (folded && (nameFolded.includes(folded) || barcodeFolded.includes(folded))) {
      return true;
    }
    const tokenDigits = token.replace(/\D/g, '');
    return tokenDigits.length >= 2 && barcodeDigits.includes(tokenDigits);
  });
}

/** Tokens ordenados del más selectivo (largo) al más común. */
export function orderSearchTokensBySelectivity(tokens: string[]): string[] {
  return [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b, 'es'));
}

/** Mayor puntaje = mejor coincidencia (apellido, prefijo de palabra, etc.). */
export function scoreStudentSearchMatch(student: Student, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  const nameFolded = foldSearchText(student.fullName);
  const words = nameFolded.split(/\s+/).filter(Boolean);
  const lastName = words[words.length - 1] ?? '';
  let score = 0;

  for (const token of tokens) {
    const folded = foldSearchText(token);
    if (!folded) continue;

    if (lastName === folded) score += 120;
    else if (lastName.startsWith(folded)) score += 90;
    else if (words.some((w) => w === folded)) score += 70;
    else if (words.some((w) => w.startsWith(folded))) score += 50;
    else if (nameFolded.includes(folded)) score += 30;

    const tokenDigits = token.replace(/\D/g, '');
    if (tokenDigits.length >= 2 && student.barcode.replace(/\D/g, '').includes(tokenDigits)) {
      score += 40;
    }
  }

  return score;
}

export function sortStudentsForSearch(students: Student[], tokens: string[]): Student[] {
  return [...students].sort((a, b) => {
    const scoreDiff = scoreStudentSearchMatch(b, tokens) - scoreStudentSearchMatch(a, tokens);
    if (scoreDiff !== 0) return scoreDiff;

    const lastA = a.fullName.trim().split(/\s+/).pop() ?? '';
    const lastB = b.fullName.trim().split(/\s+/).pop() ?? '';
    const byLast = lastA.localeCompare(lastB, 'es');
    if (byLast !== 0) return byLast;

    const gradeCmp = a.grade.localeCompare(b.grade, 'es', { numeric: true });
    if (gradeCmp !== 0) return gradeCmp;

    return a.fullName.localeCompare(b.fullName, 'es');
  });
}
