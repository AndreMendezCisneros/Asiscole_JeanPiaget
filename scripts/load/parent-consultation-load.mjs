#!/usr/bin/env node
/**
 * Prueba de carga: consultas del portal de padres (público).
 *
 * Simula LOAD_TOTAL peticiones a buscar_asistencia_por_dni repartidas
 * uniformemente en LOAD_DURATION_MIN minutos (por defecto 10 000 en 30 min).
 *
 * Uso:
 *   node scripts/load/parent-consultation-load.mjs
 *   node scripts/load/parent-consultation-load.mjs --total 1000 --minutes 5 --dry-run
 */
import {
  loadEnvLocal,
  createAnonClient,
  fetchActiveStudentBarcodes,
  runConstantRate,
  summarize,
  evaluate,
  printSummary,
  saveReport,
  parseArgs,
  sleep,
} from './lib/loadTestLib.mjs';

loadEnvLocal();
const args = parseArgs(process.argv);

const TOTAL = Number(args.total ?? process.env.LOAD_PARENT_TOTAL ?? 10_000);
const MINUTES = Number(args.minutes ?? process.env.LOAD_DURATION_MIN ?? 30);
const DURATION_MS = MINUTES * 60 * 1000;
const DRY_RUN = Boolean(args['dry-run']);

async function main() {
  console.log('=== Carga: consultas portal padres ===');
  console.log(`Objetivo: ${TOTAL} peticiones en ${MINUTES} min (ritmo constante)`);
  console.log(`Intervalo ~${(DURATION_MS / TOTAL).toFixed(1)} ms entre consultas`);
  if (DRY_RUN) console.log('Modo dry-run: solo 10 peticiones de prueba');

  let barcodes = [];
  try {
    const students = await fetchActiveStudentBarcodes(Number(process.env.LOAD_STUDENT_POOL ?? 800));
    barcodes = students.map((s) => s.barcode);
    console.log(`Pool de DNI/carnets: ${barcodes.length}`);
  } catch (err) {
    console.warn(`⚠️  ${err.message}`);
    console.warn('Usando DNI de ejemplo. Configure SUPABASE_SERVICE_ROLE_KEY.');
    barcodes = ['81433952', '76127901', '70391919'];
  }

  if (!barcodes.length) {
    console.error('No hay DNI para consultar.');
    process.exit(1);
  }

  const supabase = createAnonClient(null);
  const targetTotal = DRY_RUN ? 10 : TOTAL;

  const { samples, durationMs } = await runConstantRate({
    totalRequests: targetTotal,
    durationMs: DRY_RUN ? 5_000 : DURATION_MS,
    onProgress: (done, total) => {
      process.stdout.write(`\rProgreso: ${done}/${total} (${((done / total) * 100).toFixed(1)}%)`);
    },
    fn: async (i) => {
      const dni = barcodes[i % barcodes.length];
      const { data, error } = await supabase.rpc('buscar_asistencia_por_dni', { p_dni: dni });
      if (error) {
        return { ok: false, error: error.message };
      }
      const payload = data;
      const found = payload?.found === true;
      return { ok: found || Boolean(payload?.student), error: found ? undefined : 'not_found' };
    },
  });

  process.stdout.write('\n');
  const summary = summarize(samples, durationMs);
  const verdict = evaluate(summary, { minSuccessRate: 99, maxP95Ms: 2500 });
  printSummary('Portal padres — buscar_asistencia_por_dni', summary, verdict);

  saveReport(
    `parent-consultation-${Date.now()}.json`,
    { scenario: 'parent-consultation', total: targetTotal, minutes: MINUTES, summary, verdict }
  );

  process.exit(verdict.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
