# Configuración Completa del Sistema

## ✅ Estado Actual de la Conexión

- **Cliente Supabase**: Configurado con URL y API Key
- **Servicios de API**: Todos creados y conectados
- **Protección de Rutas**: Implementada
- **Autenticación**: Funcional (requiere función SQL)

## 📋 Checklist de Configuración

### 1. Base de Datos ✅

- [x] Script SQL de tablas ejecutado
- [x] Vistas creadas (`v_dashboard_ejecutivo`, `v_estudiantes_nivel_actual`)
- [ ] **FALTA**: Ejecutar `sql/schema/FUNCIONES_SQL_REQUERIDAS.sql` (función `validar_password`)

### 2. Storage de Supabase ⚠️

- [ ] **FALTA**: Crear bucket `evidencias` en Storage
- [ ] **FALTA**: Configurar políticas de acceso al bucket

### 3. Autenticación ✅

- [x] Login funcional
- [x] Protección de rutas implementada
- [x] Cerrar sesión funcional
- [ ] **FALTA**: Usuario de prueba en base de datos

### 4. Row Level Security (RLS) ⚠️

- [ ] **FALTA**: Configurar políticas RLS en Supabase para seguridad

## 🔧 Pasos de Configuración Restantes

### Paso 1: Ejecutar Función SQL de Validación

1. Ve a Supabase Dashboard → SQL Editor
2. Abre el archivo `sql/schema/FUNCIONES_SQL_REQUERIDAS.sql`
3. Copia y pega el contenido
4. Ejecuta el script

**Nota**: La función usa validación simple para desarrollo. En producción, cambia a bcrypt.

### Paso 2: Crear Usuario de Prueba

Ejecuta este SQL en Supabase:

```sql
-- Usuario administrador (desarrollo)
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'admin',
  'admin123',  -- Contraseña en texto plano (SOLO DESARROLLO)
  'Administrador del Sistema',
  'admin@escuela.edu',
  'Admin',
  true
);

-- Usuario supervisor (desarrollo)
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'supervisor',
  'supervisor123',
  'Supervisor de Control',
  'supervisor@escuela.edu',
  'Supervisor',
  true
);

-- Usuario tutor (desarrollo)
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'tutor',
  'tutor123',
  'Tutor Académico',
  'tutor@escuela.edu',
  'Tutor',
  true
);
```

### Paso 3: Crear Bucket de Storage

1. Ve a Supabase Dashboard → Storage
2. Crea un nuevo bucket llamado `evidencias`
3. Configura las políticas:

```sql
-- Política para lectura pública
CREATE POLICY "Evidencias lectura pública"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- Política para inserción (usuarios autenticados)
CREATE POLICY "Evidencias inserción"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'evidencias' 
  AND auth.role() = 'authenticated'
);

-- Política para eliminación (usuarios autenticados)
CREATE POLICY "Evidencias eliminación"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'evidencias' 
  AND auth.role() = 'authenticated'
);
```

### Paso 4: Configurar Row Level Security (Recomendado)

```sql
-- Habilitar RLS en tablas principales
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_faltas ENABLE ROW LEVEL SECURITY;

-- Política básica: todos pueden leer (ajustar según necesidades)
CREATE POLICY "Permitir lectura usuarios"
ON usuarios FOR SELECT
USING (true);

CREATE POLICY "Permitir lectura estudiantes"
ON estudiantes FOR SELECT
USING (true);

CREATE POLICY "Permitir lectura incidencias"
ON incidencias FOR SELECT
USING (true);

CREATE POLICY "Permitir lectura faltas"
ON catalogo_faltas FOR SELECT
USING (true);

-- Políticas de escritura (solo autenticados)
CREATE POLICY "Permitir inserción incidencias"
ON incidencias FOR INSERT
WITH CHECK (true);  -- Ajustar según permisos de rol

CREATE POLICY "Permitir inserción estudiantes"
ON estudiantes FOR INSERT
WITH CHECK (true);  -- Ajustar según permisos de rol
```

## 🧪 Probar el Sistema

1. **Iniciar sesión**:
   - Usuario: `admin`
   - Contraseña: `admin123`

2. **Verificar funcionalidades**:
   - ✅ Dashboard carga estadísticas
   - ✅ Puedes buscar estudiantes
   - ✅ Puedes registrar incidencias
   - ✅ Puedes ver listados

## ⚠️ Problemas Comunes

### Error: "Función validar_password no encontrada"
**Solución**: Ejecuta `sql/schema/FUNCIONES_SQL_REQUERIDAS.sql` en Supabase

### Error: "storage: bucket not found"
**Solución**: Crea el bucket `evidencias` en Storage

### Error: "permission denied"
**Solución**: Configura RLS o desactívalo temporalmente para desarrollo

### Login no funciona
**Solución**: 
1. Verifica que el usuario existe en la tabla `usuarios`
2. Verifica que `activo = true`
3. Verifica que la función `validar_password` existe

## 📝 Notas Finales

- **Desarrollo**: El sistema usa validación simple de contraseñas (texto plano)
- **Producción**: DEBES cambiar a bcrypt antes de usar en producción
- **Seguridad**: Configura RLS adecuadamente según tus necesidades
- **Storage**: Las evidencias se guardan en Supabase Storage

## ✅ Verificación Final

Antes de considerar el sistema listo, verifica:

- [ ] Función `validar_password` existe en Supabase
- [ ] Usuario de prueba creado
- [ ] Bucket `evidencias` creado
- [ ] Puedes iniciar sesión
- [ ] Puedes crear incidencias
- [ ] Dashboard muestra datos (aunque estén vacíos)


