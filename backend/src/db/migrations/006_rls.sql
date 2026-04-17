-- Migration 006: Row Level Security
-- Protege que un usuario nunca pueda leer ni escribir datos de otro usuario.
-- Requiere que el backend establezca `app.current_user_id` antes de cada query.
-- Ver: backend/src/db/client.ts → withUserContext()

-- ============================================================
-- HABILITAR RLS EN TABLAS CON usuario_id DIRECTO
-- ============================================================
ALTER TABLE public.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_ia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapid_rescore     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_ia           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HABILITAR RLS EN TABLAS QUE HEREDAN OWNER VÍA cliente_id
-- ============================================================
ALTER TABLE public.reportes_credito     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparaciones_reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_reportes    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS: tablas con usuario_id directo
-- ============================================================

-- clientes
DROP POLICY IF EXISTS clientes_user_isolation ON public.clientes;
CREATE POLICY clientes_user_isolation ON public.clientes
  USING (usuario_id::text = current_setting('app.current_user_id', true));

-- configuracion_ia
DROP POLICY IF EXISTS configuracion_ia_user_isolation ON public.configuracion_ia;
CREATE POLICY configuracion_ia_user_isolation ON public.configuracion_ia
  USING (usuario_id::text = current_setting('app.current_user_id', true));

-- branding
DROP POLICY IF EXISTS branding_user_isolation ON public.branding;
CREATE POLICY branding_user_isolation ON public.branding
  USING (usuario_id::text = current_setting('app.current_user_id', true));

-- rapid_rescore
DROP POLICY IF EXISTS rapid_rescore_user_isolation ON public.rapid_rescore;
CREATE POLICY rapid_rescore_user_isolation ON public.rapid_rescore
  USING (usuario_id::text = current_setting('app.current_user_id', true));

-- logs_ia
DROP POLICY IF EXISTS logs_ia_user_isolation ON public.logs_ia;
CREATE POLICY logs_ia_user_isolation ON public.logs_ia
  USING (usuario_id::text = current_setting('app.current_user_id', true));

-- ============================================================
-- POLÍTICAS: tablas que dependen de clientes
-- ============================================================

-- reportes_credito (cliente_id → clientes.usuario_id)
DROP POLICY IF EXISTS reportes_credito_user_isolation ON public.reportes_credito;
CREATE POLICY reportes_credito_user_isolation ON public.reportes_credito
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.usuario_id::text = current_setting('app.current_user_id', true)
    )
  );

-- cartas
DROP POLICY IF EXISTS cartas_user_isolation ON public.cartas;
CREATE POLICY cartas_user_isolation ON public.cartas
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.usuario_id::text = current_setting('app.current_user_id', true)
    )
  );

-- disputas
DROP POLICY IF EXISTS disputas_user_isolation ON public.disputas;
CREATE POLICY disputas_user_isolation ON public.disputas
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.usuario_id::text = current_setting('app.current_user_id', true)
    )
  );

-- comparaciones_reportes
DROP POLICY IF EXISTS comparaciones_reportes_user_isolation ON public.comparaciones_reportes;
CREATE POLICY comparaciones_reportes_user_isolation ON public.comparaciones_reportes
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.usuario_id::text = current_setting('app.current_user_id', true)
    )
  );

-- analisis_reportes (reporte_id → reportes_credito.cliente_id → clientes.usuario_id)
DROP POLICY IF EXISTS analisis_reportes_user_isolation ON public.analisis_reportes;
CREATE POLICY analisis_reportes_user_isolation ON public.analisis_reportes
  USING (
    EXISTS (
      SELECT 1 FROM public.reportes_credito r
      JOIN public.clientes c ON c.id = r.cliente_id
      WHERE r.id = reporte_id
        AND c.usuario_id::text = current_setting('app.current_user_id', true)
    )
  );

-- ============================================================
-- BYPASSRLS: el rol que usa la app puede hacer bypass.
-- Reemplaza 'app_user' con el usuario de PostgreSQL que usa tu app.
-- Corre esto SOLO si quieres que el backend actual siga funcionando
-- sin modificar cada query. Elimínalo cuando uses withUserContext().
-- ============================================================
ALTER ROLE postgres BYPASSRLS;

-- ============================================================
-- NOTA DE ACTIVACIÓN
-- Para activar la protección estricta (sin BYPASSRLS):
-- 1. Asegúrate de que el backend use withUserContext() en cada request
-- 2. Comenta o elimina el ALTER ROLE de arriba
-- 3. Corre este script en producción
-- ============================================================
