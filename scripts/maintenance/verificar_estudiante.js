// Script para verificar estudiante por código de barras
// Ejecutar en la consola del navegador o en Node.js con las credenciales de Supabase

const SUPABASE_URL = 'https://spdugaykkcgpcfslcpac.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';

async function verificarEstudiante(codigoBarras) {
  try {
    console.log(`🔍 Buscando estudiante con código de barras: ${codigoBarras}`);
    
    // 1. Buscar estudiante
    const estudianteResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/estudiantes?codigo_barras=eq.${codigoBarras}&activo=eq.true&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    const estudianteData = await estudianteResponse.json();
    
    if (!estudianteData || estudianteData.length === 0) {
      console.log('❌ Estudiante no encontrado');
      return;
    }
    
    const estudiante = estudianteData[0];
    console.log('\n📋 DATOS DEL ESTUDIANTE:');
    console.log(`   ID: ${estudiante.id_estudiante}`);
    console.log(`   Nombre: ${estudiante.nombre_completo}`);
    console.log(`   Grado: ${estudiante.grado}`);
    console.log(`   Sección: ${estudiante.seccion}`);
    console.log(`   Nivel: ${estudiante.nivel_educativo}`);
    
    // 2. Obtener nivel de reincidencia desde la vista
    const nivelResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/v_estudiantes_nivel_actual?id_estudiante=eq.${estudiante.id_estudiante}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    const nivelData = await nivelResponse.json();
    const nivelInfo = nivelData[0] || {};
    
    console.log('\n🎯 NIVEL DE REINCIDENCIA:');
    console.log(`   Nivel Actual: ${nivelInfo.nivel_actual || 0}`);
    console.log(`   Total Faltas (últimos 60 días): ${nivelInfo.total_faltas_60_dias || 0}`);
    console.log(`   Última Falta: ${nivelInfo.ultima_falta || 'N/A'}`);
    
    // 3. Obtener todas las incidencias
    const incidenciasResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/incidencias?id_estudiante=eq.${estudiante.id_estudiante}&select=*,catalogos_faltas(nombre_falta,es_grave,puntos_reincidencia),estudiantes(nombre_completo)&order=fecha_hora_registro.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    
    const incidencias = await incidenciasResponse.json();
    
    console.log('\n📊 INCIDENCIAS:');
    console.log(`   Total de Incidencias: ${incidencias.length}`);
    
    const activas = incidencias.filter(i => i.estado === 'Activa');
    const anuladas = incidencias.filter(i => i.estado === 'Anulada');
    
    console.log(`   Incidencias Activas: ${activas.length}`);
    console.log(`   Incidencias Anuladas: ${anuladas.length}`);
    
    // 4. Detalle de incidencias activas
    if (activas.length > 0) {
      console.log('\n📝 DETALLE DE INCIDENCIAS ACTIVAS:');
      activas.forEach((inc, index) => {
        const falta = inc.catalogos_faltas;
        console.log(`\n   ${index + 1}. Incidencia #${inc.id_incidencia}`);
        console.log(`      Falta: ${falta?.nombre_falta || 'N/A'}`);
        console.log(`      Tipo: ${falta?.es_grave ? 'GRAVE' : 'LEVE'}`);
        console.log(`      Puntos: ${falta?.puntos_reincidencia || 0}`);
        console.log(`      Fecha: ${new Date(inc.fecha_hora_registro).toLocaleString('es-PE')}`);
        console.log(`      Nivel Reincidencia: ${inc.nivel_reincidencia}`);
        console.log(`      Estado: ${inc.estado}`);
      });
    }
    
    // 5. Resumen por nivel
    console.log('\n📈 RESUMEN POR NIVEL DE REINCIDENCIA:');
    const porNivel = {};
    activas.forEach(inc => {
      const nivel = inc.nivel_reincidencia || 0;
      porNivel[nivel] = (porNivel[nivel] || 0) + 1;
    });
    
    Object.keys(porNivel).sort().forEach(nivel => {
      console.log(`   Nivel ${nivel}: ${porNivel[nivel]} incidencia(s)`);
    });
    
    // 6. Clasificación
    const nivelActual = nivelInfo.nivel_actual || 0;
    console.log('\n🏷️ CLASIFICACIÓN:');
    if (nivelActual === 0) {
      console.log('   ✅ Sin reincidencias');
    } else if (nivelActual <= 2) {
      console.log(`   ⚠️ Reincidencia moderada (Nivel ${nivelActual})`);
    } else {
      console.log(`   🔴 Reincidencia alta (Nivel ${nivelActual}) - Requiere atención`);
    }
    
    return {
      estudiante,
      nivelInfo,
      incidencias,
      activas,
      anuladas
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar para el código de barras específico
verificarEstudiante('70391919');

