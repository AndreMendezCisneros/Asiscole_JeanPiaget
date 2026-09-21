/** Tipos de compromiso que reinician la alarma de citación. */
export type CompromisoAlarmaTipo = 'tardanza' | 'falta' | 'pago';

export type CompromisoAlarma = {
  id: number;
  studentId: number;
  tipo: CompromisoAlarmaTipo;
  parentName: string;
  documentUrl: string | null;
  signedAt: string;
  registeredBy: number | null;
  observations: string | null;
  active: boolean;
  createdAt: string;
};

export type CompromisoBaselines = {
  tardanza: string | null;
  falta: string | null;
  pago: string | null;
};

/** Fila de listado: alumno con tardanzas desde el último compromiso. */
export type CompromisoTardanzaListRow = {
  studentId: number;
  fullName: string;
  grade: string;
  section: string;
  level: string;
  barcode: string;
  responsibleName: string | null;
  tardeCount: number;
  lastTardeDate: string | null;
  needsCitation: boolean;
};
