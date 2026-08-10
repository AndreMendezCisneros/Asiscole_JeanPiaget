export type NotasArea = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
};

export type NotasCarrera = {
  id: number;
  areaId: number;
  nombre: string;
};

export type NotasSemana = {
  id: number;
  codigo: string;
  etiqueta: string;
  fechaInicio: string;
  fechaFin: string;
  abiertaDeclaracion: boolean;
  abiertaCargaNotas: boolean;
  activo: boolean;
};

export type NotasDeclaracion = {
  id: number;
  idEstudiante: number;
  nombreEstudiante: string;
  barcode: string;
  semanaId: number;
  areaId: number;
  areaNombre: string;
  carreraId: number | null;
  carreraNombre: string | null;
  declaradoEn: string;
};

export type NotasRow = {
  id: number;
  idEstudiante: number;
  nombreEstudiante: string;
  barcode: string;
  semanaId: number;
  areaId: number;
  areaNombre: string;
  carreraId: number | null;
  carreraNombre: string | null;
  nota: number;
  observacion: string | null;
  registradoEn: string;
};

export type NotasRankingArea = {
  areaId: number;
  areaCodigo: string;
  areaNombre: string;
  orden: number;
  top: Array<{
    idEstudiante: number;
    nombreEstudiante: string;
    barcode: string;
    nota: number;
    puesto: number;
  }>;
};

export type NotasImportLog = {
  id: number;
  semanaId: number;
  semanaCodigo: string;
  nombreArchivo: string | null;
  filasLeidas: number;
  filasOk: number;
  filasSinMatch: number;
  filasSinDeclaracion: number;
  filasAmbiguas: number;
  importadoEn: string;
};

export type NotasImportPreviewRow = {
  rowIndex: number;
  rawDni: string | null;
  rawNombre: string | null;
  nota: number | null;
  observacion: string | null;
  carreraNombre: string | null;
  areaCodigo: string | null;
  matchStatus: 'ok' | 'sin_match' | 'ambiguo';
  idEstudiante: number | null;
  nombreMatched: string | null;
};
