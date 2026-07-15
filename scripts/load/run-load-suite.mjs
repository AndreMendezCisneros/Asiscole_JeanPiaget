#!/usr/bin/env node
/**
 * Ejecuta la batería de pruebas de carga del SIE.
 *
 * Uso:
 *   node scripts/load/run-load-suite.mjs --scenario padres
 *   node scripts/load/run-load-suite.mjs --scenario tutores
 *   node scripts/load/run-load-suite.mjs --scenario whatsapp --dry-run
 *   node scripts/load/run-load-suite.mjs --all --dry-run
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/loadTestLib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = parseArgs(process.argv);
const dryRunFlag = args['dry-run'] ? ['--dry-run'] : [];

function runScript(name, extraArgs = []) {
  return new Promise((resolvePromise, reject) => {
    const script = resolve(__dirname, name);
    console.log(`\n>>> Ejecutando ${name}...\n`);
    const child = spawn(process.execPath, [script, ...extraArgs, ...dryRunFlag], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${name} terminó con código ${code}`));
    });
  });
}

async function main() {
  const scenario = args.scenario || (args.all ? 'all' : 'padres');

  if (scenario === 'all') {
    await runScript('parent-consultation-load.mjs');
    await runScript('tutor-scanner-load.mjs');
    await runScript('whatsapp-load.mjs');
    console.log('\n✅ Batería completa finalizada.');
    return;
  }

  if (scenario === 'padres') {
    await runScript('parent-consultation-load.mjs');
    return;
  }
  if (scenario === 'tutores' || scenario === 'tutors') {
    await runScript('tutor-scanner-load.mjs');
    return;
  }
  if (scenario === 'whatsapp' || scenario === 'wa') {
    await runScript('whatsapp-load.mjs');
    return;
  }

  console.error('Escenario desconocido. Use: padres | tutores | whatsapp | all');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
