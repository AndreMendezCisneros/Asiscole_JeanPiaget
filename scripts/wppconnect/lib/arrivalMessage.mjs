/**
 * Plantilla de llegada — delega al banco de frases (message-bank.es.json).
 */
import { buildVariedArrivalMessage, formatHoraWithSeconds } from './messageVariety.mjs';

export { formatHoraWithSeconds };

/**
 * @param {{ fullName: string, level?: string, grade?: string, section?: string, barcode?: string }} student
 * @param {{ date?: string, arrivalTime?: string, status?: string, id?: number }} record
 * @param {string} [appUrl]
 */
export function buildArrivalMessage(student, record, appUrl) {
  return buildVariedArrivalMessage(student, record, appUrl);
}
