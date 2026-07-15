/**
 * Sube fotos de carnet a Supabase Storage y actualiza estudiantes.foto_perfil.
 * Empareja por nombre de archivo (sin extensión) ↔ nombre_completo en BD.
 *
 * Uso:
 *   node scripts/upload-student-photos.mjs "E:/generar codigos de brras/Fotos carnet"
 *   node scripts/upload-student-photos.mjs "ruta" --dry-run
 *   node scripts/upload-student-photos.mjs "ruta" --force   # reemplaza fotos existentes
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const BUCKET = 'fotos-perfil';
const MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 400;

function loadEnvLocal() {
  for (const name of ['.env.local', '.env.production', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
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
}

async function staffLogin(username, password) {
  const url = process.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';
  const anon = createClient(url, key);
  const { data, error } = await anon.rpc('sie_iniciar_sesion', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(`Login: ${error.message}`);
  if (!data?.ok || !data.token) throw new Error(data?.error || 'Login fallido');
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('x-sie-token', data.token);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    console.log('🔑 Usando SUPABASE_SERVICE_ROLE_KEY');
    return createClient(url, serviceKey);
  }

  const user = process.env.SIE_ADMIN_USER || process.env.SIE_UPLOAD_USER;
  const pass = process.env.SIE_ADMIN_PASSWORD || process.env.SIE_UPLOAD_PASSWORD;
  if (user && pass) {
    console.log(`🔑 Sesión staff: ${user}`);
    return staffLogin(user, pass);
  }

  console.warn('⚠️  Sin service role ni SIE_ADMIN_USER — la lectura de estudiantes puede devolver 0 filas (RLS).');
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';
  return createClient(url, key);
}

export function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/,/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const roots = args.filter((a) => !a.startsWith('--'));
  if (!roots.length) {
    console.error(
      'Uso: node scripts/upload-student-photos.mjs <carpeta-fotos> [carpeta-extra...] [--dry-run] [--force]'
    );
    process.exit(1);
  }
  return { roots: roots.map((r) => resolve(r)), dryRun, force };
}

function collectImageFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectImageFiles(full, acc);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    if (entry.name.startsWith('~$')) continue;
    acc.push(full);
  }
  return acc;
}

async function fetchAllStudents(supabase) {
  const students = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('id_estudiante, codigo_barras, nombre_completo, foto_perfil')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;
    students.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return students;
}

function buildNameIndex(students) {
  const index = new Map();
  for (const s of students) {
    const key = normalizePersonName(s.nombre_completo);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(s);
  }
  return index;
}

async function prepareAvatarWebp(filePath) {
  const buffer = await sharp(readFileSync(filePath))
    .rotate()
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  return { buffer, ext: '.webp', mime: 'image/webp' };
}

async function main() {
  loadEnvLocal();
  const { roots, dryRun, force } = parseArgs(process.argv);

  console.log(`\n📁 Carpetas: ${roots.join(', ')}`);
  console.log(`🔧 Modo: ${dryRun ? 'SIMULACIÓN' : 'SUBIR'}${force ? ' (forzar reemplazo)' : ''}\n`);

  const files = roots.flatMap((r) => collectImageFiles(r));
  console.log(`Archivos de imagen encontrados: ${files.length}`);

  const supabase = await getSupabaseClient();
  const students = await fetchAllStudents(supabase);
  console.log(`Estudiantes en BD: ${students.length}`);

  const nameIndex = buildNameIndex(students);

  let matched = 0;
  let uploaded = 0;
  let skippedHasPhoto = 0;
  let skippedNoMatch = 0;
  let failed = 0;
  const noMatchSamples = [];

  for (const filePath of files) {
    const baseName = basename(filePath, extname(filePath));
    const key = normalizePersonName(baseName);
    const candidates = nameIndex.get(key);

    if (!candidates?.length) {
      skippedNoMatch++;
      if (noMatchSamples.length < 8) noMatchSamples.push(baseName);
      continue;
    }

    const student = candidates.length === 1 ? candidates[0] : candidates[0];
    if (candidates.length > 1) {
      console.warn(`⚠️  Nombre ambiguo (${candidates.length}): ${baseName}`);
    }

    matched++;

    if (student.foto_perfil && !force) {
      skippedHasPhoto++;
      continue;
    }

    const { buffer, ext: outExt, mime } = await prepareAvatarWebp(filePath);
    const storagePath = `profile/${student.codigo_barras}_${Date.now()}${outExt}`;

    if (dryRun) {
      uploaded++;
      continue;
    }

    if (buffer.length > MAX_BYTES) {
      console.warn(`⚠️  Foto sigue >5MB tras comprimir: ${baseName}`);
      failed++;
      continue;
    }

    let { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error(`❌ Storage ${baseName}:`, uploadError.message);
      failed++;
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('estudiantes')
      .update({ foto_perfil: publicUrl })
      .eq('id_estudiante', student.id_estudiante);

    if (updateError) {
      console.error(`❌ BD ${baseName}:`, updateError.message);
      failed++;
      continue;
    }

    uploaded++;
    if (uploaded % 25 === 0) {
      process.stdout.write(`\rSubidas: ${uploaded}/${matched - skippedHasPhoto}`);
    }
  }

  if (!dryRun && uploaded > 0) process.stdout.write(`\rSubidas: ${uploaded}          \n`);

  console.log('\n✅ Proceso terminado');
  console.log(`   Emparejadas con estudiante: ${matched}`);
  console.log(`   ${dryRun ? 'Simularían subirse' : 'Subidas/actualizadas'}: ${uploaded}`);
  console.log(`   Omitidas (ya tenían foto): ${skippedHasPhoto}`);
  console.log(`   Sin coincidencia en BD: ${skippedNoMatch}`);
  if (failed) console.log(`   Fallidas: ${failed}`);
  if (noMatchSamples.length) {
    console.log('\nEjemplos sin coincidencia:');
    noMatchSamples.forEach((n) => console.log(`   - ${n}`));
  }
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
