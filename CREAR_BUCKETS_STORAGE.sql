-- ============================================
-- CREAR BUCKETS DE STORAGE PARA EL SISTEMA
-- ============================================

-- 1. Bucket para fotos de perfil de estudiantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-perfil', 'fotos-perfil', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Bucket para evidencias fotográficas de incidencias
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- POLÍTICAS RLS PARA fotos-perfil
-- ============================================

-- Permitir a todos los usuarios autenticados subir fotos de perfil
CREATE POLICY "Usuarios autenticados pueden subir fotos de perfil"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fotos-perfil');

-- Permitir a todos ver las fotos de perfil (bucket público)
CREATE POLICY "Fotos de perfil son públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'fotos-perfil');

-- Permitir a usuarios autenticados actualizar sus archivos
CREATE POLICY "Usuarios pueden actualizar fotos de perfil"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'fotos-perfil');

-- Permitir a usuarios autenticados eliminar fotos
CREATE POLICY "Usuarios pueden eliminar fotos de perfil"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'fotos-perfil');

-- ============================================
-- POLÍTICAS RLS PARA evidencias
-- ============================================

-- Permitir a usuarios autenticados subir evidencias
CREATE POLICY "Usuarios autenticados pueden subir evidencias"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidencias');

-- Permitir a todos ver las evidencias (bucket público)
CREATE POLICY "Evidencias son públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'evidencias');

-- Permitir a usuarios autenticados actualizar evidencias
CREATE POLICY "Usuarios pueden actualizar evidencias"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidencias');

-- Permitir a usuarios autenticados eliminar evidencias
CREATE POLICY "Usuarios pueden eliminar evidencias"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidencias');
