#!/usr/bin/env node
/**
 * Prueba de carga: escáner del tutor (4 tutores en paralelo, 30 min).
 *
 * Cada tutor repite el flujo real:
 *   1) sie_buscar_estudiante_carnet
 *   2) INSERT registros_llegada (o duplicado del día)
 *
 * Uso:
 *   LOAD_TUTOR_ACCOUNTS=Tutor1:pass,Tutor2:pass,Tutor3:pass,Tutor4:pass \
 *     node scripts/load/tutor-scanner-load.mjs
 *
 *   node scripts/load/tutor-scanner-load.mjs --minutes 5 --tutors 4 --dry-run
 */
import {
  loadEnvLocal,
  createAnonClient,
  fetchActiveStudentBarcodes,
  login,
  parseTutorAccounts,
  getLimaNow,
  runParallelWorkers,
  summarize,
  evaluate,
  printSummary,
  saveReport,
  parseArgs,
} from './lib/loadTestLib.mjs';

loadEnvLocal();
const args = parseArgs(process.argv);

const MINUTES = Number(args.minutes ?? process.env.LOAD_DURATION_MIN ?? 30);
const DURATION_MS = MINUTES * 60 * 1000;
const TUTOR_COUNT = Number(args.tutors ?? process.env.LOAD_TUTOR_COUNT ?? 4);
const DRY_RUN = Boolean(args['dry-run']);

async function scanOnce(client, token, student, tutorUserId) {
  const { data: lookup, error: lookupErr } = await client.rpc('sie_buscar_estudiante_carnet', {
    p_token: token,
    p_codigo: student.barcode,
    p_skip_reincidencia: true,
  });

  if (lookupErr) {
    return { ok: false, error: `lookup: ${lookupErr.message}` };
  }
  if (lookup?.error) {
    return { ok: false, error: lookup.error };
  }

  const { date, time } = getLimaNow();
  const { data: existing } = await client
    .from('registros_llegada')
    .select('id_registro')
    .eq('id_estudiante', student.id)
    .eq('fecha', date)
    .maybeSingle();

  if (existing?.id_registro) {
    return { ok: true, meta: 'duplicate_today' };
  }

  const { error: insertErr } = await client.from('registros_llegada').insert({
    id_estudiante: student.id,
    fecha: date,
    hora_llegada: time,
    estado: 'A tiempo',
    registrado_por: tutorUserId,
    fecha_creacion: new Date().toISOString(),
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { ok: true, meta: 'race_duplicate' };
    }
    return { ok: false, error: `insert: ${insertErr.message}` };
  }

  return { ok: true, meta: 'registered' };
}

async function main() {
  console.log('=== Carga: escáner del tutor ===');
  console.log(`Duración: ${MINUTES} min | Tutores: ${TUTOR_COUNT}`);
  if (DRY_RUN) console.log('Modo dry-run: 20 s por tutor');

  let accounts = [];
  try {
    accounts = parseTutorAccounts();
  } catch (err) {
    console.error(err.message);
    console.error('Configure LOAD_TUTOR_ACCOUNTS=user:pass,user2:pass,...');
    process.exit(1);
  }

  if (accounts.length < TUTOR_COUNT) {
    console.error(`Se necesitan al menos ${TUTOR_COUNT} cuentas tutor en LOAD_TUTOR_ACCOUNTS`);
    process.exit(1);
  }

  const students = await fetchActiveStudentBarcodes(Number(process.env.LOAD_STUDENT_POOL ?? 1000));
  if (!students.length) {
    console.error('No hay estudiantes activos para escanear.');
    process.exit(1);
  }
  console.log(`Estudiantes en pool: ${students.length}`);

  const tutors = [];
  for (let i = 0; i < TUTOR_COUNT; i++) {
    const acc = accounts[i];
    const session = await login(acc.username, acc.password);
    if (session.user?.role !== 'Tutor') {
      console.warn(`⚠️  ${acc.username} no es Tutor (rol: ${session.user?.role})`);
    }
    const client = createAnonClient(session.token);
    tutors.push({ client, token: session.token, userId: session.user.id, name: acc.username });
    console.log(`Tutor ${i + 1} conectado: ${acc.username}`);
  }

  let scanIndex = 0;
  const duration = DRY_RUN ? 20_000 : DURATION_MS;

  const { samples, durationMs } = await runParallelWorkers({
    workerCount: TUTOR_COUNT,
    durationMs: duration,
    onProgress: (done, elapsed, total) => {
      process.stdout.write(
        `\rEscaneos: ${done} | ${(elapsed / 1000).toFixed(0)}s / ${(total / 1000).toFixed(0)}s`
      );
    },
    workerFn: async (workerId) => {
      const tutor = tutors[workerId - 1];
      const student = students[scanIndex % students.length];
      scanIndex++;
      return scanOnce(tutor.client, tutor.token, student, tutor.userId);
    },
  });

  process.stdout.write('\n');
  const summary = summarize(samples, durationMs);
  const verdict = evaluate(summary, { minSuccessRate: 98, maxP95Ms: 4000 });
  printSummary('Escáner tutor — lookup + registro llegada', summary, verdict);

  const metaCounts = {};
  for (const s of samples) {
    if (s.meta) metaCounts[s.meta] = (metaCounts[s.meta] ?? 0) + 1;
  }
  if (Object.keys(metaCounts).length) {
    console.log('Desglose:', metaCounts);
  }

  saveReport(`tutor-scanner-${Date.now()}.json`, {
    scenario: 'tutor-scanner',
    tutors: TUTOR_COUNT,
    minutes: MINUTES,
    summary,
    metaCounts,
    verdict,
  });

  process.exit(verdict.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
