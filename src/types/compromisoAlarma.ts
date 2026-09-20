/** Tipos de compromiso que reinician la alarma de deuda. */
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
