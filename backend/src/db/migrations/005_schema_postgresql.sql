-- Migration 005: Create all core tables for plain PostgreSQL (no Supabase Auth)
-- This replaces 001_schema.sql which required Supabase's auth.users table.
-- Prerequisites: Run 002_add_inconsistencias.sql first (creates usuarios table).
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: configuracion_ia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configuracion_ia (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id            UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
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
  usuario_id      UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
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
  pdf_contenido   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: analisis_reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analisis_reportes (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporte_id                  UUID NOT NULL REFERENCES public.reportes_credito(id) ON DELETE CASCADE,
  resumen_general             JSONB,
  datos_personales            JSONB,
  cuentas                     JSONB,
  inquiries                   JSONB,
  errores_detectados          JSONB,
  recomendaciones             JSONB,
  inconsistencias_entre_buros JSONB DEFAULT '[]'::jsonb,
  estado_general              TEXT CHECK (estado_general IN ('riesgo_bajo', 'riesgo_medio', 'riesgo_alto')),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reporte_id)
);

-- ============================================================
-- TABLA: comparaciones_reportes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comparaciones_reportes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id            UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reporte_base_id       UUID NOT NULL REFERENCES public.reportes_credito(id),
  reporte_comparado_id  UUID NOT NULL REFERENCES public.reportes_credito(id),
  resultado             JSONB,
  resumen_cambios       TEXT,
  progreso_general      TEXT CHECK (progreso_general IN ('mejoro', 'empeoro', 'sin_cambios')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reporte_base_id, reporte_comparado_id)
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
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  logo_url         TEXT,
  color_primario   TEXT DEFAULT '#1a1a2e',
  color_secundario TEXT DEFAULT '#16213e',
  color_acento     TEXT DEFAULT '#0f3460',
  tipografia       TEXT DEFAULT 'Inter',
  encabezado_pdf   TEXT,
  pie_pagina_pdf   TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ============================================================
-- TABLA: logs_ia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.logs_ia (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID REFERENCES public.usuarios(id),
  cliente_id      UUID REFERENCES public.clientes(id),
  tipo_operacion  TEXT NOT NULL,
  modelo          TEXT,
  tokens_entrada  INTEGER,
  tokens_salida   INTEGER,
  estado          TEXT CHECK (estado IN ('ok', 'error')),
  mensaje_error   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: rapid_rescore (also in 004 but included here for completeness)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rapid_rescore (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL,
  cliente_id      UUID,
  reporte_id      UUID,
  banco           TEXT NOT NULL,
  numero_cuenta   TEXT,
  tipo_cuenta     TEXT NOT NULL,
  balance         NUMERIC(12,2) DEFAULT 0,
  limite_credito  NUMERIC(12,2) DEFAULT 0,
  accion          TEXT NOT NULL,
  score_actual    INTEGER NOT NULL,
  score_estimado  INTEGER,
  impacto_puntos  INTEGER,
  explicacion     TEXT,
  recomendacion   TEXT,
  tiempo_estimado TEXT,
  modo            TEXT DEFAULT 'formula',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE OR REPLACE FUNCTION create_trigger_if_not_exists(
  trig_name TEXT, tbl_name TEXT
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = trig_name
  ) THEN
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      trig_name, tbl_name
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT create_trigger_if_not_exists('set_updated_at_clientes', 'clientes');
SELECT create_trigger_if_not_exists('set_updated_at_cartas', 'cartas');
SELECT create_trigger_if_not_exists('set_updated_at_disputas', 'disputas');
SELECT create_trigger_if_not_exists('set_updated_at_usuarios', 'usuarios');

DROP FUNCTION IF EXISTS create_trigger_if_not_exists(TEXT, TEXT);
