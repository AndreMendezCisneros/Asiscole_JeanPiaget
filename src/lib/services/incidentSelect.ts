/** Select PostgREST de incidencias; el embed de talleres requiere FK incidencias.taller_id. */

const INCIDENT_LIST_BASE = `
  id_incidencia,
  id_estudiante,
  id_falta,
  id_usuario_registro,
  fecha_hora_registro,
  observaciones,
  nivel_reincidencia,
  estado_evidencia,
  cantidad_fotos,
  estado,
  revisado_app,
  revisado_app_en,
  confirmada_app,
  confirmada_app_en,
  estudiantes:id_estudiante (
    id_estudiante,
    codigo_barras,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    activo
  ),
  catalogos_faltas:id_falta (
    id_falta,
    nombre_falta,
    categoria,
    es_grave,
    puntos_reincidencia,
    descripcion,
    recomendacion,
    activo
  ),
  usuarios_registro:id_usuario_registro (
    id_usuario,
    nombre_completo
  )
`;

const INCIDENT_FULL_BASE = `
  *,
  estudiantes:id_estudiante (
    id_estudiante,
    codigo_barras,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    foto_perfil,
    activo
  ),
  catalogos_faltas:id_falta (
    id_falta,
    nombre_falta,
    categoria,
    es_grave,
    puntos_reincidencia,
    descripcion,
    recomendacion,
    activo
  ),
  usuarios_registro:id_usuario_registro (
    id_usuario,
    nombre_completo
  )
`;

const TALLER_EMBED = `
  taller_id,
  talleres:taller_id (
    nombre
  )
`;

export function buildIncidentSelect(opts: {
  full?: boolean;
  includeTaller?: boolean;
}): string {
  const base = opts.full ? INCIDENT_FULL_BASE : INCIDENT_LIST_BASE;
  if (!opts.includeTaller) return base.trim();
  // FULL ya trae `*`; igual pedimos el embed explícito para hidratar nombre.
  return `${base.trim()},\n  ${TALLER_EMBED.trim()}`;
}

export function isMissingTallerSchemaError(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (code === 'PGRST200' && message.includes('taller_id')) return true;
  if (code === '42703' && message.includes('taller_id')) return true;
  if (code === 'PGRST205' && message.includes('talleres')) return true;
  return false;
}

/** Tras un fallo de esquema, no reintentar el embed en esta sesión de página. */
let tallerSchemaAvailable: boolean | null = null;

export function getTallerSchemaAvailable(): boolean | null {
  return tallerSchemaAvailable;
}

export function setTallerSchemaAvailable(value: boolean): void {
  tallerSchemaAvailable = value;
}

export function resetTallerSchemaCacheForTests(): void {
  tallerSchemaAvailable = null;
}

export function shouldIncludeTallerEmbed(featureEnabled: boolean): boolean {
  if (!featureEnabled) return false;
  // Solo tras confirmar que existen tablas/FK (p. ej. listado de talleres OK).
  // Si es null/false, evitamos PGRST200 en incidencias.
  return tallerSchemaAvailable === true;
}
