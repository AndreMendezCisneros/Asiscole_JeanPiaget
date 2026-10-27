-- Jean Piaget: rol DocenteTutor (docente encargado de un salón, solo lectura).
-- No confundir con 'Tutor' (escáner de puerta). Archivo aparte porque un valor
-- nuevo de enum no se puede usar en la misma transacción que lo crea.
-- Aplicar ANTES de PATCH_DOCENTE_TUTOR.sql. Idempotente.
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'DocenteTutor';
