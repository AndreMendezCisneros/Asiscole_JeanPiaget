/** Salón (nivel / grado / sección) tal como está en `estudiantes`. */
export interface TutorSalon {
  level: string;
  grade: string;
  section: string;
}

export interface TutorArrival {
  id: number;
  arrivalTime: string | null;
  departureTime: string | null;
  departureType: string | null;
  status: string | null;
  justification: string | null;
}

/** Alumno del salón con su registro del día (o null si no marcó). */
export interface TutorDayStudent {
  id: number;
  fullName: string;
  photo: string | null;
  arrival: TutorArrival | null;
}

export interface TutorIncident {
  id: number;
  studentId: number;
  studentName: string;
  studentPhoto: string | null;
  registeredAt: string;
  faultName: string;
  faultCategory: string | null;
  faultSerious: boolean;
  observations: string | null;
  reincidenceLevel: number | null;
  status: string | null;
  photoCount: number;
  registeredBy: string | null;
}

export interface TutorEvidence {
  id: number;
  filename: string | null;
  url: string;
  uploadedAt: string | null;
}

export interface TutorAttendanceStudent {
  id: number;
  fullName: string;
  photo: string | null;
}

export interface TutorAttendanceArrival {
  id_estudiante: number;
  fecha: string;
  hora_llegada: string | null;
  hora_salida: string | null;
  estado: string | null;
  motivo_justificacion: string | null;
}

/** Tutoría vista por RR.HH. */
export interface Tutoria {
  personalId: number;
  userId: number;
  username: string;
  level: string;
  grade: string;
  section: string;
  active: boolean;
  lastAccess: string | null;
}

export interface SalonDisponible extends TutorSalon {
  students: number;
}

export function salonKey(s: TutorSalon): string {
  return `${s.level}|${s.grade}|${s.section}`;
}

export function formatSalon(s: TutorSalon): string {
  return `${s.grade} ${s.section} · ${s.level}`;
}
