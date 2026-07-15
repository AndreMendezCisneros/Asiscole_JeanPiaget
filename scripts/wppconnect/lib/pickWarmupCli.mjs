#!/usr/bin/env node
/** CLI: frase casual del banco o estadísticas (--stats). */
import { pickWarmupMessage, getBankStats } from './messageVariety.mjs';

if (process.argv.includes('--stats')) {
  console.log(JSON.stringify(getBankStats(), null, 2));
} else {
  process.stdout.write(pickWarmupMessage());
}
