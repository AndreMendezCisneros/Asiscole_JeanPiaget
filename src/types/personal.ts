/** Módulo Personal: empleados del colegio (no estudiantes). */

export const PERSONAL_CATEGORIAS = [
  'Directivo y Jerárquico',
  'Administrativo',
  'Docente Inicial',
  'Docente Primaria',
  'Docente Secundaria',
  'Servicio y Mantenimiento',
] as const;

export type PersonalCategoria = (typeof PERSONAL_CATEGORIAS)[number];

/** 1 = lunes … 7 = domingo (ISO, igual que `personal_horario.dia_semana`). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIAS_SEMANA: { value: DiaSemana; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
];

export interface HorarioDia {
  day: DiaSemana;
  /** HH:mm */
  entry: string;
  /** HH:mm o null si no tiene hora de salida fija */
  exit: string | null;
}

export interface Personal {
  id: number;
  barcode: string;
  fullName: string;
  category: PersonalCategoria;
  position: string | null;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  profilePhoto: string | null;
  active: boolean;
  /** YYYY-MM-DD en que se registró (no se le exige asistencia antes). */
  createdAt: string;
  /** Solo los días que asiste. */
  schedule: HorarioDia[];
}

export interface PersonalDB {
  id_personal: number;
  codigo_barras: string;
  nombre_completo: string;
  categoria: PersonalCategoria;
  cargo: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  foto_perfil: string | null;
  activo: boolean;
  fecha_creacion: string;
  personal_horario?: PersonalHorarioDB[];
}

export interface PersonalHorarioDB {
  id_personal: number;
  dia_semana: number;
  hora_entrada: string;
  hora_salida: string | null;
}

export type PersonalArrivalEstado =
  | 'A tiempo'
  | 'Tarde'
  | 'Tarde justificada'
  | 'Falta justificada'
  | 'Falta'
  | 'Fuera de horario';

export type PersonalDepartureType = 'Normal' | 'Anticipada' | 'Autorizada';

export interface PersonalArrivalRecord {
  id: number;
  personalId: number;
  date: string;
  arrivalTime: string | null;
  status: PersonalArrivalEstado;
  expectedEntry: string | null;
  expectedExit: string | null;
  departureTime: string | null;
  departureType: PersonalDepartureType | null;
  justificationReason: string | null;
  /** Motivo de la salida anticipada autorizada. */
  departureReason: string | null;
  registeredBy: number | null;
}

export interface PersonalFormData {
  barcode: string;
  fullName: string;
  category: PersonalCategoria;
  position?: string | null;
  birthDate?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  profilePhoto?: string | null;
  active?: boolean;
  schedule: HorarioDia[];
}
