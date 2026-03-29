-- Migration 003: Create comparaciones_reportes table and branding color_acento column

CREATE TABLE IF NOT EXISTS public.comparaciones_reportes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           UUID NOT NULL,
  reporte_base_id      UUID NOT NULL,
  reporte_comparado_id UUID NOT NULL,
  resultado            JSONB,
  resumen_cambios      TEXT,
  progreso_general     TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reporte_base_id, reporte_comparado_id)
);

ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS color_acento TEXT DEFAULT '#0ea5e9';
