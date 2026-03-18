-- ============================================================
-- Credit Repair AI Suite — Schema completo para Supabase
-- Ejecutar en el SQL Editor de Supabase en este orden
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: usuarios (gestionada por Supabase Auth)
-- Se extiende con una tabla de perfiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'consultor' CHECK (rol IN ('admin', 'consultor', 'usuario')),
  estado      TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: configuracion_ia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configuracion_ia (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id            UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  proveedor_ia          TEXT NOT NULL DEFAULT 'openai',
  modelo                TEXT NOT NULL DEFAULT 'gpt-4o',
  api_key_encriptada    TEXT NOT NULL,
  estado_conexion       TEXT DEFAULT 'pendiente' CHECK (estado_conexion IN ('activo', 'error', 'pendiente')),
  ultimo_test_conexion  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email           TEXT,
  telefono        TEXT,
  direccion       TEXT,
  ciudad          TEXT,
  estado          TEXT,
  zip             TEXT,
  fecha_nacimiento DATE,
  ssn_parcial     TEXT,
  estado_caso     TEXT NOT NULL DEFAULT 'activo'
                  CHECK (estado_caso IN ('activo', 'en_progreso', 'pendiente', 'cerrado')),
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: reportes_credito
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reportes_credito (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre_archivo  TEXT NOT NULL,
  ruta_archivo    TEXT NOT NULL,
  fecha_reporte   DATE NOT NULL,
  mes_referencia  INTEGER CHECK (mes_referencia BETWEEN 1 AND 12),
  anio_referencia INTEGER,
  tipo_reporte    TEXT NOT NULL
                  CHECK (tipo_reporte IN (
                    'Experian','Equifax','TransUnion',
                    'IdentityIQ','SmartCredit','PrivacyGuard',
                    'MyScoreIQ','otro'
                  )),
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: analisis_reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analisis_reportes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporte_id            UUID NOT NULL REFERENCES public.reportes_credito(id) ON DELETE CASCADE,
  resumen_general       JSONB,
  datos_personales      JSONB,
  cuentas               JSONB,
  inquiries             JSONB,
  errores_detectados    JSONB,
  recomendaciones       JSONB,
  estado_general        TEXT CHECK (estado_general IN ('riesgo_bajo', 'riesgo_medio', 'riesgo_alto')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reporte_id)
);

-- ============================================================
-- TABLA: comparaciones_reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comparaciones_reportes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id          UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reporte_base_id     UUID NOT NULL REFERENCES public.reportes_credito(id),
  reporte_comparado_id UUID NOT NULL REFERENCES public.reportes_credito(id),
  resultado           JSONB,
  resumen_cambios     TEXT,
  progreso_general    TEXT CHECK (progreso_general IN ('mejoro', 'empeoro', 'sin_cambios')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: cartas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cartas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id    UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reporte_id    UUID REFERENCES public.reportes_credito(id),
  tipo_carta    TEXT NOT NULL CHECK (tipo_carta IN (
                  'carta_datos_personales',
                  'carta_cuenta_no_reconocida',
                  'carta_cuenta_duplicada',
                  'carta_balance_incorrecto',
                  'carta_late_payment',
                  'carta_inquiry',
                  'carta_validacion_deuda',
                  'carta_coleccion',
                  'carta_seguimiento',
                  'carta_redisputa'
                )),
  destinatario  TEXT NOT NULL,
  contenido     TEXT NOT NULL,
  ley_aplicada  TEXT CHECK (ley_aplicada IN ('FCRA', 'FDCPA', 'FACTA')),
  estado        TEXT NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador', 'editada', 'exportada', 'enviada')),
  pdf_url       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: disputas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disputas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reporte_id      UUID REFERENCES public.reportes_credito(id),
  carta_id        UUID REFERENCES public.cartas(id),
  tipo_disputa    TEXT NOT NULL,
  buro_o_entidad  TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'enviada', 'respondida', 'cerrada')),
  fecha_envio     DATE,
  fecha_respuesta DATE,
  resultado       TEXT CHECK (resultado IN (
                    'eliminado', 'actualizado',
                    'verificado_sin_cambios', 'pendiente'
                  )),
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: branding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branding (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  logo_url        TEXT,
  color_primario  TEXT DEFAULT '#1a1a2e',
  color_secundario TEXT DEFAULT '#16213e',
  color_acento    TEXT DEFAULT '#0f3460',
  tipografia      TEXT DEFAULT 'Inter',
  encabezado_pdf  TEXT,
  pie_pagina_pdf  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ============================================================
-- TABLA: documentos_exportados
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documentos_exportados (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_documento  TEXT NOT NULL CHECK (tipo_documento IN (
                    'evaluacion_completa', 'resumen_ejecutivo',
                    'comparacion_mensual', 'carta_individual',
                    'expediente_completo_cliente'
                  )),
  url_documento   TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: logs_ia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs_ia (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID REFERENCES public.perfiles(id),
  cliente_id      UUID REFERENCES public.clientes(id),
  tipo_operacion  TEXT NOT NULL CHECK (tipo_operacion IN (
                    'analisis_reporte', 'generacion_carta', 'comparacion_reportes'
                  )),
  modelo          TEXT,
  tokens_entrada  INTEGER,
  tokens_salida   INTEGER,
  estado          TEXT CHECK (estado IN ('ok', 'error')),
  mensaje_error   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.perfiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_ia      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_credito      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_reportes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparaciones_reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_exportados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_ia               ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo ve sus propios datos
CREATE POLICY "perfil_propio" ON public.perfiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "config_ia_propia" ON public.configuracion_ia
  FOR ALL USING (auth.uid() = usuario_id);

CREATE POLICY "clientes_propios" ON public.clientes
  FOR ALL USING (auth.uid() = usuario_id);

CREATE POLICY "reportes_de_mis_clientes" ON public.reportes_credito
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())
  );

CREATE POLICY "analisis_de_mis_reportes" ON public.analisis_reportes
  FOR ALL USING (
    reporte_id IN (
      SELECT rc.id FROM public.reportes_credito rc
      JOIN public.clientes c ON c.id = rc.cliente_id
      WHERE c.usuario_id = auth.uid()
    )
  );

CREATE POLICY "comparaciones_de_mis_clientes" ON public.comparaciones_reportes
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())
  );

CREATE POLICY "cartas_de_mis_clientes" ON public.cartas
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())
  );

CREATE POLICY "disputas_de_mis_clientes" ON public.disputas
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())
  );

CREATE POLICY "branding_propio" ON public.branding
  FOR ALL USING (auth.uid() = usuario_id);

CREATE POLICY "documentos_de_mis_clientes" ON public.documentos_exportados
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())
  );

CREATE POLICY "logs_propios" ON public.logs_ia
  FOR ALL USING (auth.uid() = usuario_id);

-- ============================================================
-- FUNCIÓN: auto-crear perfil al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_perfiles
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_cartas
  BEFORE UPDATE ON public.cartas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_disputas
  BEFORE UPDATE ON public.disputas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
