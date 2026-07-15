import { describe, expect, it } from 'vitest';
import { normalizePhoneDigits, toWhatsAppChatId } from './phoneUtils';

describe('phoneUtils', () => {
  it('normaliza dígitos peruanos con espacios y guiones', () => {
    expect(normalizePhoneDigits('+51 900 116 737')).toBe('51900116737');
  });

  it('formatea celular peruano de 9 dígitos', () => {
    expect(toWhatsAppChatId('900116737')).toBe('51900116737@c.us');
  });

  it('acepta número ya con código 51', () => {
    expect(toWhatsAppChatId('51900116737')).toBe('51900116737@c.us');
  });

  it('rechaza entradas vacías', () => {
    expect(toWhatsAppChatId('')).toBeNull();
    expect(toWhatsAppChatId('abc')).toBeNull();
  });
});
