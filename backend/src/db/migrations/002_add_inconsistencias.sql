-- Migration 002: Add inconsistencias_entre_buros column to analisis_reportes
-- Run this in your PostgreSQL database (Supabase SQL Editor or psql)
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS guards)

ALTER TABLE public.analisis_reportes
  ADD COLUMN IF NOT EXISTS inconsistencias_entre_buros JSONB DEFAULT '[]'::jsonb;

-- Also add pdf_contenido to reportes_credito if not present
-- (used by the backend but missing from migration 001)
ALTER TABLE public.reportes_credito
  ADD COLUMN IF NOT EXISTS pdf_contenido TEXT;

-- Add usuarios table if not present (backend uses custom auth, not Supabase auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'consultor',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
