-- Migration 004: Create rapid_rescore table

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
