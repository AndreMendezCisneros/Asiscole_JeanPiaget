-- Jean Piaget: rol RR.HH. (Recursos Humanos). Archivo aparte porque un valor
-- nuevo de enum no se puede usar en la misma transacción que lo crea.
-- Aplicar ANTES de PATCH_PERSONAL_V2.sql. Idempotente.
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'RRHH';
