// Tipos que coinciden con el esquema de la base de datos
export type UserRole = 'Supervisor' | 'Tutor' | 'Director' | 'Admin' | 'Padre' | 'Docente';
export type EducationalLevel = 'Primaria' | 'Secundaria';

export interface DocenteClassroom {
  level: EducationalLevel;
  grade: string;
  section: string;
}

export interface DocenteAssignments {
  classrooms: DocenteClassroom[];
}

export type ReincidenceLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Tipos para bimestres
export type Bimestre = 1 | 2 | 3 | 4;

export interface BimestreInfo {
  numero: Bimestre;
  inicio: Date;
  fin: Date;
  añoEscolar: number;
  label: string;
}

/** Categoría de falta; valores por defecto en DEFAULT_FAULT_CATEGORIES + personalizadas en configuración */
export type FaultCategory = string;

export type FaultSeverity = 'Leve' | 'Grave';

export type EstadoEvidencia = 'Sin evidencia' | 'Con evidencia';

export type EstadoIncidencia = 'Activa' | 'Anulada' | 'En revisión' | 'Justificada';
export type AttendanceStatus = 'A_tiempo' | 'Tarde' | 'Justificada' | 'Injustificada' | 'Sin_registro';

// Tipos de la base de datos (DB)
export interface UsuarioDB {
  id_usuario: number;
  username: string;
  password_hash: string;
  nombre_completo: string;
  email: string;
  rol: UserRole;
  grados_asignados: any;
  activo: boolean;
  cambio_password_obligatorio: boolean;
  ultimo_acceso: string | null;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
  fecha_creacion: string;
}

export interface EstudianteDB {
  id_estudiante: number;
  codigo_barras: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nivel_educativo: EducationalLevel;
  foto_perfil: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
  // Campos de contacto familiar (nuevos)
  telefono_contacto?: string | null;
  email_contacto?: string | null;
  nombre_responsable?: string | null;
  parentesco_responsable?: string | null;
  telefono_emergencia?: string | null;
}

export interface CatalogoFaltaDB {
  id_falta: number;
  nombre_falta: string;
  categoria: FaultCategory;
  es_grave: boolean;
  puntos_reincidencia: number;
  descripcion: string | null;
  activo: boolean;
  orden_visualizacion: number;
  fecha_creacion: string;
}

export interface IncidenciaDB {
  id_incidencia: number;
  id_estudiante: number;
  id_falta: number;
  fecha_hora_registro: string;
  id_usuario_registro: number;
  nivel_reincidencia: number;
  observaciones: string | null;
  estado_evidencia: EstadoEvidencia;
  cantidad_fotos: number;
  id_usuario_carga_foto: number | null;
  fecha_hora_carga_foto: string | null;
  estado: EstadoIncidencia;
  motivo_anulacion: string | null;
  id_usuario_anulacion: number | null;
  fecha_anulacion: string | null;
  veces_impreso: number;
  fecha_ultima_impresion: string | null;
}

export interface EvidenciaFotograficaDB {
  id_evidencia: number;
  id_incidencia: number;
  ruta_archivo: string;
  nombre_original: string;
  nombre_archivo: string;
  tamano_bytes: number;
  tipo_mime: string;
  id_usuario_subida: number;
  fecha_subida: string;
  ip_subida: string | null;
  marca_agua_aplicada: boolean;
}

export interface ComentarioIncidenciaDB {
  id_comentario: number;
  id_incidencia: number;
  id_usuario: number;
  texto_comentario: string;
  fecha_hora: string;
}

// Tipos para el frontend (con relaciones expandidas)
export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  gradosAsignados?: any;
  cambioPasswordObligatorio?: boolean;
}

export interface Student {
  id: number;
  fullName: string;
  grade: string;
  section: string;
  level: EducationalLevel;
  barcode: string;
  profilePhoto?: string | null;
  reincidenceLevel?: ReincidenceLevel;
  faultsLast60Days?: number;
  active: boolean;
  // Campos de contacto familiar
  contactPhone?: string | null;
  contactEmail?: string | null;
  responsibleName?: string | null;
  responsibleRelationship?: string | null;
  emergencyPhone?: string | null;
}

export interface FaultType {
  id: number;
  name: string;
  description: string | null;
  category: FaultCategory;
  severity: FaultSeverity;
  points: number;
  active: boolean;
  ordenVisualizacion?: number;
}

export interface Incident {
  id: number;
  studentId: number;
  student?: Student;
  faultTypeId: number;
  faultType?: FaultType;
  registeredBy: number;
  registeredByUser?: User;
  registeredAt: string;
  observations: string | null;
  reincidenceLevel: ReincidenceLevel;
  hasEvidence: boolean;
  evidenceCount: number;
  status: EstadoIncidencia;
  annulledBy?: number | null;
  annulledAt?: string | null;
  annulmentReason?: string | null;
}

export interface IncidentEvidence {
  id: number;
  incidentId: number;
  filename: string;
  url: string;
  uploadedBy: number;
  uploadedAt: string;
}

export interface Comment {
  id: number;
  incidentId: number;
  userId: number;
  user?: User;
  content: string;
  createdAt: string;
}

export interface DashboardStats {
  totalIncidents: number;
  incidentsToday: number;
  incidentsThisWeek: number;
  incidentsThisMonth: number;
  studentsWithIncidents: number;
  averageReincidenceLevel: number;
  levelDistribution: {
    level0: number;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    level5: number;
  };
  topFaults: Array<{
    faultType: string;
    count: number;
  }>;
  incidentsByGrade: Array<{
    level: EducationalLevel;
    grade: string;
    label: string;
    count: number;
  }>;
}

// Nuevas tablas del sistema
export interface ConfiguracionSistemaDB {
  id_config?: number;
  id?: number;
  clave: string;
  valor: string;
  descripcion: string | null;
  fecha_actualizacion: string;
}

export interface ConfiguracionReincidenciaDB {
  id_configuracion_reincidencia?: number;
  id_config_reincidencia?: number;
  ventana_dias: number;
  puntos_falta_leve: number;
  puntos_falta_grave: number;
  umbral_nivel_1: number;
  umbral_nivel_2: number;
  umbral_nivel_3: number;
  umbral_nivel_4: number;
  umbral_nivel_5: number;
  activo: boolean;
  fecha_vigencia?: string | null;
}

/** Configuración activa del algoritmo de reincidencia (frontend) */
export interface ReincidenceSettings {
  id: number | null;
  windowDays: number;
  thresholds: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    level5: number;
  };
  active: boolean;
}

export interface RegistroLlegadaDB {
  id_registro: number;
  id_estudiante: number;
  fecha: string;
  hora_llegada: string;
  estado: 'A tiempo' | 'Tarde';
  registrado_por: number | null;
  fecha_creacion: string;
  // Campos para control de salidas (nuevos)
  hora_salida?: string | null;
  registrado_salida_por?: number | null;
  fecha_salida?: string | null;
  tipo_salida?: 'Normal' | 'Autorizada' | 'Sin registro' | null;
}

export interface AuditoriaLogDB {
  id_log: number;
  id_usuario?: number | null;
  tabla_afectada: string;
  id_registro: number;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  datos_anteriores: any;
  datos_nuevos: any;
  descripcion_accion?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  fecha_hora: string;
}

// Tipos para el frontend
export interface ArrivalRecord {
  id: number;
  studentId: number;
  student?: Student;
  date: string;
  arrivalTime: string;
  status: 'A tiempo' | 'Tarde';
  registeredBy: number | null;
  registeredByUser?: User;
  createdAt: string;
  // Campos para control de salidas
  departureTime?: string | null;
  departureRegisteredBy?: number | null;
  departureType?: 'Normal' | 'Autorizada' | 'Sin registro' | null;
}

export interface MonthlyAttendanceDay {
  day: number;
  status: AttendanceStatus;
  arrivalTime?: string;
}

export interface MonthlyAttendanceRow {
  student: Student;
  days: MonthlyAttendanceDay[];
  totals: {
    onTime: number;
    late: number;
    justified: number;
    unjustified: number;
  };
}

export interface AuditLog {
  id: number;
  table: string;
  recordId?: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  previousData: any;
  newData: any;
  userId?: number;
  actionDescription?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

// Tipos para citas con padres
export interface CitaPadreDB {
  id_cita: number;
  id_estudiante: number;
  motivo: string;
  fecha: string;
  hora: string;
  estado: 'Pendiente' | 'Confirmada' | 'Reprogramada' | 'Completada' | 'No asistió' | 'Cancelada';
  asistencia: boolean | null;
  llegada_tarde?: boolean | null;
  hora_llegada_real?: string | null;
  notas: string | null;
  id_usuario_creador: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ParentMeeting {
  id: number;
  studentId: number;
  student?: Student;
  motivo: string;
  fecha: string;
  hora: string;
  estado: 'Pendiente' | 'Confirmada' | 'Reprogramada' | 'Completada' | 'No asistió' | 'Cancelada';
  asistencia: boolean | null;
  llegadaTarde?: boolean | null;
  horaLlegadaReal?: string | null;
  notas: string | null;
  createdBy: number;
  createdByUser?: User;
  createdAt: string;
  updatedAt: string;
}

// Filtros extendidos para reportes
export interface ReportFilters {
  level?: EducationalLevel;
  grade?: string;
  section?: string;
  bimestre?: Bimestre;
  añoEscolar?: number;
  startDate?: string;
  endDate?: string;
}
