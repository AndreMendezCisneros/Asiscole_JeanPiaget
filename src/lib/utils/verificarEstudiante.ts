import { supabase } from '../supabaseClient';
import { studentsService, incidentsService } from '../services';

/**
 * Función de utilidad para verificar un estudiante y sus incidencias
 * Útil para debugging y verificación
 */
export async function verificarEstudiante(codigoBarras: string) {
  console.log(`\n🔍 ========================================`);
  console.log(`🔍 VERIFICANDO ESTUDIANTE: ${codigoBarras}`);
  console.log(`🔍 ========================================\n`);

  try {
    // 1. Buscar estudiante
    const { student, error: studentError } = await studentsService.getByBarcode(codigoBarras);

    if (studentError || !student) {
      console.log('❌ Estudiante no encontrado');
      console.log(`   Error: ${studentError || 'No se encontró el estudiante'}`);
      return null;
    }

    console.log('📋 DATOS DEL ESTUDIANTE:');
    console.log(`   ID: ${student.id}`);
    console.log(`   Nombre: ${student.fullName}`);
    console.log(`   Grado: ${student.grade}`);
    console.log(`   Sección: ${student.section}`);
    console.log(`   Nivel: ${student.level}`);
    console.log(`   Código de Barras: ${student.barcode}`);

    // 2. Información de reincidencia
    console.log('\n🎯 NIVEL DE REINCIDENCIA:');
    console.log(`   Nivel Actual: ${student.reincidenceLevel || 0}`);
    console.log(`   Total Faltas (últimos 60 días): ${student.faultsLast60Days || 0}`);

    // Clasificación
    const nivel = student.reincidenceLevel || 0;
    if (nivel === 0) {
      console.log(`   ✅ Sin reincidencias`);
    } else if (nivel <= 2) {
      console.log(`   ⚠️ Reincidencia moderada (Nivel ${nivel})`);
    } else {
      console.log(`   🔴 Reincidencia alta (Nivel ${nivel}) - Requiere atención`);
    }

    // 3. Obtener todas las incidencias
    const { incidents, total, error: incidentsError } = await incidentsService.getAll({
      estudianteId: student.id,
    });

    if (incidentsError) {
      console.log(`\n❌ Error al obtener incidencias: ${incidentsError}`);
      return { student, incidents: [], total: 0 };
    }

    console.log('\n📊 INCIDENCIAS:');
    console.log(`   Total de Incidencias: ${total}`);

    const activas = incidents.filter(i => i.status === 'Activa');
    const anuladas = incidents.filter(i => i.status === 'Anulada');

    console.log(`   Incidencias Activas: ${activas.length}`);
    console.log(`   Incidencias Anuladas: ${anuladas.length}`);

    // 4. Detalle de incidencias activas
    if (activas.length > 0) {
      console.log('\n📝 DETALLE DE INCIDENCIAS ACTIVAS:');
      activas.forEach((inc, index) => {
        console.log(`\n   ${index + 1}. Incidencia #${inc.id}`);
        console.log(`      Falta: ${inc.faultType?.name || 'N/A'}`);
        console.log(`      Tipo: ${inc.faultType?.severity || 'N/A'}`);
        console.log(`      Puntos: ${inc.faultType?.points || 0}`);
        console.log(`      Fecha: ${new Date(inc.registeredAt).toLocaleString('es-PE')}`);
        console.log(`      Nivel Reincidencia: ${inc.reincidenceLevel}`);
        console.log(`      Estado: ${inc.status}`);
        if (inc.observations) {
          console.log(`      Observaciones: ${inc.observations}`);
        }
      });
    }

    // 5. Resumen por nivel de reincidencia
    console.log('\n📈 RESUMEN POR NIVEL DE REINCIDENCIA:');
    const porNivel: Record<number, number> = {};
    activas.forEach(inc => {
      const nivelInc = inc.reincidenceLevel || 0;
      porNivel[nivelInc] = (porNivel[nivelInc] || 0) + 1;
    });

    Object.keys(porNivel)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(nivel => {
        console.log(`   Nivel ${nivel}: ${porNivel[Number(nivel)]} incidencia(s)`);
      });

    // 6. Resumen de puntos
    if (activas.length > 0) {
      const puntosTotales = activas.reduce((sum, inc) => {
        return sum + (inc.faultType?.points || 0);
      }, 0);
      console.log(`\n💯 PUNTOS TOTALES: ${puntosTotales} puntos`);

      const faltasLeves = activas.filter(i => i.faultType?.severity === 'Leve').length;
      const faltasGraves = activas.filter(i => i.faultType?.severity === 'Grave').length;
      console.log(`   Faltas Leves: ${faltasLeves}`);
      console.log(`   Faltas Graves: ${faltasGraves}`);
    }

    // 7. Verificar si está catalogado como reincidente
    console.log('\n🏷️ CLASIFICACIÓN FINAL:');
    if (nivel === 0) {
      console.log('   ✅ NO está catalogado como reincidente');
      console.log('   ✅ Sin faltas activas en el período de análisis');
    } else {
      console.log(`   ⚠️ SÍ está catalogado como reincidente`);
      console.log(`   📊 Nivel de reincidencia: ${nivel}`);
      console.log(`   📅 Faltas en últimos 60 días: ${student.faultsLast60Days || 0}`);
      
      if (nivel >= 3) {
        console.log('   🔴 ALERTA: Nivel alto de reincidencia - Requiere acción inmediata');
      }
    }

    console.log(`\n✅ ========================================`);
    console.log(`✅ VERIFICACIÓN COMPLETA`);
    console.log(`✅ ========================================\n`);

    return {
      student,
      incidents,
      activas,
      anuladas,
      total,
      nivelActual: nivel,
      esReincidente: nivel > 0,
    };
  } catch (error: any) {
    console.error('❌ Error en verificarEstudiante:', error);
    return null;
  }
}

// Función para usar desde la consola del navegador (solo desarrollo)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Window & { verificarEstudiante?: typeof verificarEstudiante }).verificarEstudiante =
    verificarEstudiante;
}

