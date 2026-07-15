/**
 * Utilidades para manejar bimestres del sistema educativo peruano
 * 
 * Estructura de bimestres (configurable):
 * - Bimestre 1: Marzo - Mayo
 * - Bimestre 2: Mayo - Julio
 * - Bimestre 3: Agosto - Octubre
 * - Bimestre 4: Octubre - Diciembre
 */

export type Bimestre = 1 | 2 | 3 | 4;

export interface BimestreInfo {
  numero: Bimestre;
  inicio: Date;
  fin: Date;
  añoEscolar: number;
  label: string;
}

/**
 * Fechas por defecto para los bimestres (año escolar típico en Perú)
 * El año escolar inicia en marzo y termina en diciembre
 */
const DEFAULT_BIMESTRE_DATES = {
  1: { inicioMes: 3, inicioDia: 1, finMes: 5, finDia: 31 }, // Marzo - Mayo
  2: { inicioMes: 6, inicioDia: 1, finMes: 7, finDia: 31 }, // Junio - Julio
  3: { inicioMes: 8, inicioDia: 1, finMes: 10, finDia: 31 }, // Agosto - Octubre
  4: { inicioMes: 11, inicioDia: 1, finMes: 12, finDia: 31 }, // Noviembre - Diciembre
};

/**
 * Determina el bimestre al que pertenece una fecha
 * @param fecha - Fecha a evaluar
 * @param añoEscolar - Año escolar (ej: 2024 para el año escolar 2024-2025)
 * @returns El número del bimestre (1-4) o null si la fecha está fuera del año escolar
 */
export function getBimestreFromDate(fecha: Date, añoEscolar: number): Bimestre | null {
  const mes = fecha.getMonth() + 1; // getMonth() retorna 0-11
  const año = fecha.getFullYear();

  // Determinar el año escolar correcto
  // Si estamos en enero o febrero, probablemente pertenece al año escolar anterior
  let añoEscolarCorrecto = añoEscolar;
  if (mes === 1 || mes === 2) {
    // Enero y febrero pueden ser parte del año escolar anterior
    // Por ejemplo, si estamos en 2025 y el año escolar es 2024, enero/febrero 2025 pertenecen a 2024
    if (año === añoEscolar + 1) {
      añoEscolarCorrecto = añoEscolar;
    }
  }

  // Verificar que la fecha esté dentro del rango del año escolar
  const inicioAñoEscolar = new Date(añoEscolarCorrecto, 2, 1); // 1 de marzo
  const finAñoEscolar = new Date(añoEscolarCorrecto + 1, 1, 28); // Último día de febrero del año siguiente

  if (fecha < inicioAñoEscolar || fecha > finAñoEscolar) {
    return null;
  }

  // Determinar bimestre según el mes
  if (mes >= 3 && mes <= 5) return 1; // Marzo - Mayo
  if (mes >= 6 && mes <= 7) return 2; // Junio - Julio
  if (mes >= 8 && mes <= 10) return 3; // Agosto - Octubre
  if (mes >= 11 && mes <= 12) return 4; // Noviembre - Diciembre

  // Enero y febrero pueden ser parte del bimestre 4 del año escolar anterior
  if (mes === 1 || mes === 2) {
    // Verificar si pertenece al año escolar anterior
    if (año === añoEscolarCorrecto + 1) {
      return 4; // Enero/Febrero del año siguiente pertenecen al bimestre 4
    }
  }

  return null;
}

/**
 * Obtiene las fechas de inicio y fin de un bimestre específico
 * @param bimestre - Número del bimestre (1-4)
 * @param añoEscolar - Año escolar (ej: 2024)
 * @returns Objeto con fecha de inicio y fin del bimestre
 */
export function getBimestreDates(bimestre: Bimestre, añoEscolar: number): { inicio: Date; fin: Date } {
  const config = DEFAULT_BIMESTRE_DATES[bimestre];
  
  let añoInicio = añoEscolar;
  let añoFin = añoEscolar;

  // Ajustar años para bimestres que cruzan el cambio de año
  if (bimestre === 4) {
    // El bimestre 4 puede extenderse hasta febrero del año siguiente
    añoFin = añoEscolar + 1;
  }

  const inicio = new Date(añoInicio, config.inicioMes - 1, config.inicioDia);
  const fin = new Date(añoFin, config.finMes - 1, config.finDia);

  return { inicio, fin };
}

/**
 * Obtiene información completa de un bimestre
 * @param bimestre - Número del bimestre (1-4)
 * @param añoEscolar - Año escolar
 * @returns Información completa del bimestre
 */
export function getBimestreInfo(bimestre: Bimestre, añoEscolar: number): BimestreInfo {
  const { inicio, fin } = getBimestreDates(bimestre, añoEscolar);
  
  const labels = {
    1: 'Primer Bimestre',
    2: 'Segundo Bimestre',
    3: 'Tercer Bimestre',
    4: 'Cuarto Bimestre',
  };

  return {
    numero: bimestre,
    inicio,
    fin,
    añoEscolar,
    label: labels[bimestre],
  };
}

/**
 * Obtiene todos los bimestres de un año escolar
 * @param añoEscolar - Año escolar
 * @returns Array con información de todos los bimestres
 */
export function getAllBimestres(añoEscolar: number): BimestreInfo[] {
  return [1, 2, 3, 4].map((num) => getBimestreInfo(num as Bimestre, añoEscolar));
}

/**
 * Obtiene el año escolar actual basado en la fecha
 * En Perú, el año escolar inicia en marzo
 * @param fecha - Fecha de referencia (por defecto: hoy)
 * @returns Año escolar (ej: 2024 para el año escolar 2024-2025)
 */
export function getCurrentSchoolYear(fecha: Date = new Date()): number {
  const mes = fecha.getMonth() + 1;
  const año = fecha.getFullYear();

  // Si estamos en enero o febrero, el año escolar es el año anterior
  if (mes === 1 || mes === 2) {
    return año - 1;
  }

  // De marzo en adelante, el año escolar es el año actual
  return año;
}

/**
 * Formatea una fecha de bimestre para mostrar
 * @param bimestre - Información del bimestre
 * @returns String formateado (ej: "Primer Bimestre 2024 (Mar - May)")
 */
export function formatBimestreLabel(bimestre: BimestreInfo): string {
  const meses = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const mesInicio = meses[bimestre.inicio.getMonth()];
  const mesFin = meses[bimestre.fin.getMonth()];

  return `${bimestre.label} ${bimestre.añoEscolar} (${mesInicio} - ${mesFin})`;
}

/**
 * Verifica si una fecha está dentro de un bimestre
 * @param fecha - Fecha a verificar
 * @param bimestre - Número del bimestre
 * @param añoEscolar - Año escolar
 * @returns true si la fecha está dentro del bimestre
 */
export function isDateInBimestre(fecha: Date, bimestre: Bimestre, añoEscolar: number): boolean {
  const { inicio, fin } = getBimestreDates(bimestre, añoEscolar);
  return fecha >= inicio && fecha <= fin;
}

