/**
 * Importa estudiantes desde NominaPrimariaLimpia.xlsx a Supabase.
 *
 * Uso:
 *   node scripts/import-nomina-primaria.mjs "C:/Users/User/Downloads/NominaPrimariaLimpia.xlsx"
 *   node scripts/import-nomina-primaria.mjs "ruta.xlsx" --dry-run
 *
 * Variables (opcional en .env.local o entorno):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY  (o SUPABASE_SERVICE_ROLE_KEY)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

const GRADE_MAP = {
  PRIMERO: '1ro',
  SEGUNDO: '2do',
  TERCERO: '3ro',
  CUARTO: '4to',
  QUINTO: '5to',
  SEXTO: '6to',
};

const BATCH_SIZE = 100;

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizeGrade(raw) {
  const key = String(raw || '').trim().toUpperCase();
  return GRADE_MAP[key] || raw;
}

function normalizeSection(raw) {
  return String(raw || '').trim().toUpperCase();
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) return digits;
  if (digits.length === 11 && digits.startsWith('51')) return digits.slice(2);
  return digits;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Uso: node scripts/import-nomina-primaria.mjs <archivo.xlsx> [--dry-run]');
    process.exit(1);
  }
  return { file: resolve(file), dryRun };
}

async function readExcelRows(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('El Excel no tiene hojas');

  const headers = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? '').trim();
  });

  const rows = [];
  sheet.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return;
    const record = {};
    row.eachCell((cell, col) => {
      const header = headers[col];
      if (!header) return;
      record[header] = cell.value == null ? '' : String(cell.value).trim();
    });
    if (record.dni || record.apellidosYnombres) rows.push(record);
  });
  return rows;
}

function toStudentRow(row) {
  const dni = String(row.dni || '').replace(/\D/g, '').trim();
  const nombre = String(row.apellidosYnombres || '').trim();
  if (!dni || !nombre) return null;

  return {
    codigo_barras: dni,
    nombre_completo: nombre,
    grado: normalizeGrade(row.grado),
    seccion: normalizeSection(row.seccion),
    nivel_educativo: 'Primaria',
    activo: true,
    telefono_contacto: normalizePhone(row.watsapwatsap),
    nombre_responsable: String(row.apoderado || '').trim() || null,
    parentesco_responsable: row.apoderado ? 'Apoderado' : null,
  };
}

async function fetchExistingBarcodes(supabase) {
  const existing = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('codigo_barras')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const code = row.codigo_barras?.trim();
      if (code) existing.add(code);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return existing;
}

async function main() {
  loadEnvLocal();
  const { file, dryRun } = parseArgs(process.argv);

  const url =
    process.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';

  console.log(`\n📂 Archivo: ${file}`);
  console.log(`🔧 Modo: ${dryRun ? 'SIMULACIÓN (--dry-run)' : 'IMPORTAR'}\n`);

  const rawRows = await readExcelRows(file);
  console.log(`Filas en Excel: ${rawRows.length}`);

  const mapped = rawRows.map(toStudentRow).filter(Boolean);
  const invalid = rawRows.length - mapped.length;
  if (invalid) console.log(`Filas omitidas (sin DNI o nombre): ${invalid}`);

  const supabase = createClient(url, key);
  const existing = await fetchExistingBarcodes(supabase);
  console.log(`DNIs ya en Supabase: ${existing.size}`);

  const toInsert = mapped.filter((s) => !existing.has(s.codigo_barras));
  const skipped = mapped.length - toInsert.length;

  console.log(`Nuevos a insertar: ${toInsert.length}`);
  console.log(`Duplicados (omitidos): ${skipped}\n`);

  if (toInsert.length > 0) {
    console.log('Muestra de los primeros 3 nuevos:');
    console.log(JSON.stringify(toInsert.slice(0, 3), null, 2));
  }

  if (dryRun) {
    console.log('\n✅ Simulación terminada. Ejecute sin --dry-run para importar.');
    return;
  }

  if (toInsert.length === 0) {
    console.log('\n✅ Nada que insertar: todos los DNI ya existen.');
    return;
  }

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('estudiantes')
      .insert(batch)
      .select('id_estudiante');

    if (error) {
      console.error(`\n❌ Error en lote ${i / BATCH_SIZE + 1}:`, error.message);
      failed += batch.length;
      continue;
    }

    inserted += data?.length ?? batch.length;
    process.stdout.write(`\rInsertados: ${inserted}/${toInsert.length}`);
  }

  console.log(`\n\n✅ Importación terminada`);
  console.log(`   Insertados: ${inserted}`);
  console.log(`   Omitidos (ya existían): ${skipped}`);
  if (failed) console.log(`   Fallidos: ${failed}`);
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
