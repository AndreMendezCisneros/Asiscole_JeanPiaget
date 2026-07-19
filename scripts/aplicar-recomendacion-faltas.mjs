/**
 * Corrige recomendaciones WhatsApp según el catálogo real (ids 1–10).
 * Uso: node scripts/aplicar-recomendacion-faltas.mjs
 *      node scripts/aplicar-recomendacion-faltas.mjs --force   # sobrescribe existentes
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';
const key =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';

/** Catálogo real San Ramón — recomendaciones alineadas al nombre de la falta */
const BY_ID = {
  1: 'Asegurar que el estudiante asista con el uniforme oficial del día. Reservar el buzo solo para las actividades deportivas autorizadas.',
  2: 'Verificar cada mañana que porte el polo institucional completo. Revisar juntos el reglamento de presentación personal.',
  3: 'Usar únicamente el calzado reglamentario del colegio. Revisar el calzado la noche anterior para evitar sanciones.',
  4: 'Acordar un corte o peinado acorde a la normativa institucional. Revisar juntos el reglamento de presentación personal.',
  5: 'Ajustar el peinado según el reglamento del colegio antes de salir de casa. Reforzar el cuidado de la presentación personal.',
  6: 'Establecer una rutina de salida más temprana. Conversar sobre la puntualidad y avisar a tutoría si hay dificultades de traslado.',
  7: 'Retirar prendas no autorizadas y vestir solo lo permitido por el reglamento. Revisar la mochila y la vestimenta antes de salir.',
  8: 'Respetar la normativa sobre maquillaje en el colegio. Conversar en casa sobre presentación personal y acuerdos institucionales.',
  9: 'Mantener uñas según la normativa (largo y color permitidos). Revisar el cuidado personal antes de asistir a clases.',
  10: 'Portar siempre el carné institucional visible. Guardarlo en un lugar fijo de la mochila o uniforme para no olvidarlo.',
};

function fallbackByCategory(categoria, esGrave) {
  const c = String(categoria || '');
  if (/uniforme/i.test(c)) {
    return esGrave
      ? 'Corregir de inmediato la presentación personal y coordinar con el colegio si hace falta reposición del uniforme.'
      : 'Revisar juntos el reglamento de presentación personal y asegurar el uniforme completo al día siguiente.';
  }
  if (/puntualidad|asistencia/i.test(c)) {
    return esGrave
      ? 'Establecer rutina diaria de puntualidad y comunicar a tutoría cualquier dificultad de traslado.'
      : 'Ajustar horarios de salida de casa para llegar con anticipación al colegio.';
  }
  if (/acad[eé]mica/i.test(c)) {
    return esGrave
      ? 'Solicitar entrevista con el área académica para plan de refuerzo y compromisos de estudio.'
      : 'Apoyar en casa la organización de tareas y revisar avances con el docente de la materia.';
  }
  return esGrave
    ? 'Agendar reunión con tutoría o dirección para acordar compromisos y seguimiento cercano.'
    : 'Conversar en casa sobre el respeto a las normas escolares y acompañar una reflexión breve.';
}

async function staffClient() {
  const anon = createClient(url, key);
  const user = process.env.SIE_ADMIN_USER || 'Rudeus';
  const pass = process.env.SIE_ADMIN_PASSWORD || '123456';
  const { data, error } = await anon.rpc('sie_iniciar_sesion', {
    p_username: user,
    p_password: pass,
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const sb = await staffClient();

  const { data: rows, error } = await sb
    .from('catalogo_faltas')
    .select('id_falta, nombre_falta, categoria, es_grave, recomendacion')
    .order('id_falta');

  if (error) {
    if (/recomendacion.*does not exist/i.test(error.message)) {
      console.error(
        'Falta la columna recomendacion. Ejecute primero el ALTER en el SQL Editor de Supabase.',
      );
      process.exit(1);
    }
    throw new Error(error.message);
  }

  let updated = 0;
  for (const row of rows || []) {
    const next = BY_ID[row.id_falta] || fallbackByCategory(row.categoria, row.es_grave);
    const current = (row.recomendacion || '').trim();
    if (current && !force && BY_ID[row.id_falta] && current === next) {
      console.log(`ok   #${row.id_falta} ${row.nombre_falta}`);
      continue;
    }
    if (current && !force && !BY_ID[row.id_falta]) {
      console.log(`skip #${row.id_falta} ${row.nombre_falta}`);
      continue;
    }
    console.log(`${dryRun ? 'DRY' : 'SET'} #${row.id_falta} ${row.nombre_falta}`);
    console.log(`  → ${next.slice(0, 100)}`);
    if (!dryRun) {
      const { error: upErr } = await sb
        .from('catalogo_faltas')
        .update({ recomendacion: next })
        .eq('id_falta', row.id_falta);
      if (upErr) throw new Error(`Update #${row.id_falta}: ${upErr.message}`);
    }
    updated += 1;
  }

  console.log(`\nListo. ${updated} falta(s) ${dryRun ? 'a actualizar' : 'actualizadas'}.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
