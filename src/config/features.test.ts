import { describe, expect, it } from 'vitest';
import { parseNotasEnabled, parsePensionesEnabled, parseTalleresEnabled } from './features';

describe('parseTalleresEnabled', () => {
  it('es true solo con "true"', () => {
    expect(parseTalleresEnabled('true')).toBe(true);
  });
  it('es false por defecto', () => {
    expect(parseTalleresEnabled(undefined)).toBe(false);
    expect(parseTalleresEnabled('')).toBe(false);
    expect(parseTalleresEnabled('false')).toBe(false);
  });
});

describe('parsePensionesEnabled', () => {
  it('es true solo con "true"', () => {
    expect(parsePensionesEnabled('true')).toBe(true);
  });
  it('es false por defecto', () => {
    expect(parsePensionesEnabled(undefined)).toBe(false);
    expect(parsePensionesEnabled('false')).toBe(false);
  });
});

describe('parseNotasEnabled', () => {
  it('es true solo con "true"', () => {
    expect(parseNotasEnabled('true')).toBe(true);
  });
  it('es false por defecto', () => {
    expect(parseNotasEnabled(undefined)).toBe(false);
    expect(parseNotasEnabled('false')).toBe(false);
  });
});
