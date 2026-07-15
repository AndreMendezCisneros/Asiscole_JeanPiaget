#!/usr/bin/env node
/**
 * Genera message-bank.es.json con cientos/miles de combinaciones posibles.
 * Usa plantillas + @faker-js/faker (es) y deduplica.
 *
 * Uso: node scripts/generar-banco-frases.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakerES_MX as faker } from '@faker-js/faker';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'wppconnect/data/message-bank.es.json');

faker.seed(20260629);

function uniquePool(targetSize, factory, maxAttempts = targetSize * 40) {
  const set = new Set();
  let attempts = 0;
  while (set.size < targetSize && attempts < maxAttempts) {
    attempts++;
    const v = factory().replace(/\s+/g, ' ').trim();
    if (v.length >= 3 && v.length <= 220) set.add(v);
  }
  return [...set];
}

const greetings = uniquePool(100, () =>
  faker.helpers.arrayElement([
    'Hola,',
    'Buen día,',
    'Buenos días,',
    'Buenas tardes,',
    'Estimado apoderado,',
    'Estimada apoderada,',
    'Estimada familia,',
    'Cordial saludo,',
    'Saludos cordiales,',
    'Muy buenos días,',
    `Hola ${faker.person.firstName()},`,
    `${faker.helpers.arrayElement(['Estimado', 'Estimada'])} ${faker.helpers.arrayElement(['apoderado', 'apoderada', 'familiar'])},`,
    `${faker.helpers.arrayElement(['Buen', 'Excelente'])} ${faker.helpers.arrayElement(['día', 'inicio de jornada'])},`,
  ]),
);

const headers = uniquePool(80, () => {
  const bases = [
    '{Registro de llegada|Aviso de ingreso|Confirmación de llegada|Notificación de asistencia|Ingreso registrado|Control de asistencia|Reporte de llegada|Aviso de matinal}',
    '{SIE|Asiscole|Portal escolar} — {registro|aviso|confirmación} de {llegada|ingreso|asistencia}',
    'I.E. San Ramón — {ingreso|llegada|asistencia} {registrada|confirmada|del día}',
  ];
  return spinTemplate(faker.helpers.arrayElement(bases));
});

const studentLabels = uniquePool(25, () =>
  faker.helpers.arrayElement([
    '*Estudiante:*',
    '*Alumno/a:*',
    '*Nombre del estudiante:*',
    '*Estudiante(a):*',
  ]),
);

const levelLabels = uniquePool(15, () =>
  faker.helpers.arrayElement(['*Nivel:*', '*Nivel educativo:*', '*Nivel de estudios:*']),
);

const gradeLabels = uniquePool(15, () =>
  faker.helpers.arrayElement(['*Grado:*', '*Grado escolar:*', '*Año:*']),
);

const sectionLabels = uniquePool(15, () =>
  faker.helpers.arrayElement(['*Sección:*', '*Sección del aula:*', '*Aula:*']),
);

const dateLabels = uniquePool(20, () =>
  faker.helpers.arrayElement(['*Fecha:*', '*Fecha de hoy:*', '*Día:*', '*Fecha del registro:*']),
);

const timeLabels = uniquePool(20, () =>
  faker.helpers.arrayElement(['*Hora:*', '*Hora de ingreso:*', '*Hora de llegada:*', '*Ingreso a las:*']),
);

const statusLabels = uniquePool(20, () =>
  faker.helpers.arrayElement(['*Estado:*', '*Situación:*', '*Resultado:*', '*Puntualidad:*']),
);

const statusOnTime = uniquePool(40, () =>
  spinTemplate(
    '{A tiempo|Puntual|Ingreso normal|Dentro del horario|Llegada registrada a tiempo|Asistencia puntual}',
  ),
);

const statusLate = uniquePool(40, () =>
  spinTemplate(
    '{Tarde|Con tardanza|Ingreso fuera de horario|Llegada tardía|Registro con retraso|Asistencia con tardanza}',
  ),
);

const attendanceCTA = uniquePool(80, () => {
  const emoji = faker.helpers.arrayElement(['📋', '📎', '🔍', '✅', '📲']);
  return spinTemplate(
    `${emoji} {Ver|Consultar|Revisar|Abrir} {asistencia|registro|detalle} {de hoy|del día|escolar}`,
  );
});

const portalCTA = uniquePool(50, () => {
  const emoji = faker.helpers.arrayElement(['👨‍👩‍👧', '🏠', '🔗', '📱']);
  return spinTemplate(
    `${emoji} {Portal de padres|Consulta familiar|Acceso apoderados|Portal familiar}`,
  );
});

const closings = uniquePool(80, () =>
  faker.helpers.arrayElement([
    '_Notificación automática del sistema de asistencia escolar._',
    '_Mensaje automático del SIE — I.E. San Ramón._',
    '_Sistema de asistencia escolar — I.E. San Ramón._',
    '_Asiscole — control de asistencia I.E. San Ramón._',
    '_Este mensaje fue generado por el Sistema de Incidencias Escolares._',
    '_I.E. San Ramón · Sistema de asistencia digital._',
    spinTemplate(
      '_{Mensaje|Aviso|Notificación} {automático|del sistema} — {SIE|Asiscole} I.E. San Ramón._',
    ),
  ]),
);

const midLines = uniquePool(50, () =>
  spinTemplate(
    '{Le informamos el ingreso de su hijo/a|Registramos la llegada de su hijo/a|Se registró la asistencia de|Confirmamos el ingreso de}',
  ),
);

/** Mensajes casuales chip↔chip (calentamiento, no parecen spam masivo). */
const warmupCasual = uniquePool(500, () => {
  const templates = [
    () => spinTemplate('{Hola|Hey|Qué tal|Buenas}, {¿todo bien?|¿cómo va?|¿cómo estás?}'),
    () => spinTemplate('{Listo|Ok|Dale}, {gracias|muchas gracias|te aviso luego}'),
    () => spinTemplate('{Ya llegué|Ya estoy|Todo ok} {al cole|por acá|en la oficina}'),
    () => spinTemplate('{¿Viste|¿Viste el} {mensaje|aviso} {de ayer|de hoy}?'),
    () => spinTemplate('{Te paso|Te mando} {el dato|la info} {en un rato|luego}'),
    () => spinTemplate('{Perfecto|Genial|Excelente}, {quedamos|nos vemos} {mañana|luego}'),
    () => `Reunión ${faker.helpers.arrayElement(['10am', '11am', '3pm', 'mañana'])} — ${faker.word.words(2)}`,
    () => `${faker.helpers.arrayElement(['Colegio', 'Oficina', 'Sistema'])}: ${faker.lorem.sentence({ min: 3, max: 8 })}`,
    () => spinTemplate('{Confirmado|Recibido|Entendido} 👍'),
    () => spinTemplate('{Buen|Que tengas buen} {día|tarde|fin de semana}'),
    () => `${faker.person.firstName()}: ${faker.lorem.sentence({ min: 4, max: 10 })}`,
    () => spinTemplate('{¿Almorzaste|¿Desayunaste|¿Ya comiste}? {Yo sí|Aún no|Recién}'),
  ];
  return faker.helpers.arrayElement(templates)();
});

const spintaxTemplates = uniquePool(30, () =>
  spinTemplate(
    '{Hola|Buenos días}, {le informamos|le confirmamos|registramos} {el ingreso|la llegada|la asistencia} de su {hijo|hija|menor} en I.E. San Ramón.',
  ),
);

function spinTemplate(tpl) {
  let s = tpl;
  const re = /\{([^{}]+)\}/;
  for (let i = 0; i < 8 && re.test(s); i++) {
    s = s.replace(re, (_, inner) => {
      const parts = inner.split('|');
      return parts[Math.floor(Math.random() * parts.length)];
    });
  }
  return s;
}

const pools = {
  greetings,
  headers,
  studentLabels,
  levelLabels,
  gradeLabels,
  sectionLabels,
  dateLabels,
  timeLabels,
  statusLabels,
  statusOnTime,
  statusLate,
  attendanceCTA,
  portalCTA,
  closings,
  midLines,
  warmupCasual,
  spintaxTemplates,
};

const combinationEstimate = Object.values(pools)
  .filter((arr) => arr !== warmupCasual && arr !== spintaxTemplates)
  .reduce((n, arr) => n * Math.max(arr.length, 1), 1);

const bank = {
  version: 2,
  locale: 'es-PE',
  generatedAt: new Date().toISOString(),
  combinationEstimate,
  warmupCount: warmupCasual.length,
  pools,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(bank, null, 2), 'utf8');

console.log(`OK → ${OUT}`);
console.log(`Frases en banco:`);
for (const [k, v] of Object.entries(pools)) {
  console.log(`  ${k}: ${v.length}`);
}
console.log(`Combinaciones estimadas (llegada): ~${combinationEstimate.toLocaleString('es-PE')}`);
console.log(`Mensajes casuales calentamiento: ${warmupCasual.length}`);
