import { describe, expect, it } from 'vitest';
import { areaShortLabel, resolveNotasCarreraArea } from './notasCatalogResolve';
import type { NotasArea, NotasCarrera } from '@/types/notas';

const areas: NotasArea[] = [
  { id: 1, codigo: 'salud', nombre: 'Ciencias de la Salud', orden: 1 },
  { id: 2, codigo: 'ingenierias', nombre: 'Ingenierías y Ciencias Básicas / Exactas', orden: 2 },
  { id: 3, codigo: 'letras', nombre: 'Letras, Ciencias Sociales y Económicas', orden: 3 },
];

const carreras: NotasCarrera[] = [
  { id: 10, areaId: 1, nombre: 'Medicina Humana' },
  { id: 11, areaId: 1, nombre: 'Enfermería' },
  { id: 20, areaId: 2, nombre: 'Ingeniería de Sistemas / Software' },
  { id: 30, areaId: 3, nombre: 'Derecho / Ciencias Políticas' },
];

describe('resolveNotasCarreraArea', () => {
  it('resuelve carrera y área desde nombre de carrera', () => {
    expect(resolveNotasCarreraArea('Medicina Humana', null, areas, carreras)).toEqual({
      areaId: 1,
      carreraId: 10,
    });
  });

  it('resuelve solo área por código', () => {
    expect(resolveNotasCarreraArea(null, 'letras', areas, carreras)).toEqual({
      areaId: 3,
      carreraId: null,
    });
  });

  it('acepta match parcial de carrera', () => {
    expect(resolveNotasCarreraArea('Sistemas', null, areas, carreras).carreraId).toBe(20);
  });
});

describe('areaShortLabel', () => {
  it('acorta etiquetas largas', () => {
    expect(areaShortLabel(areas[0])).toBe('Salud');
    expect(areaShortLabel(areas[1])).toBe('Ingenierías');
  });
});
