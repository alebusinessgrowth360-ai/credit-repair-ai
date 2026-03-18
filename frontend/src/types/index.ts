// ============================================================
// Credit Repair AI Suite — Types
// Basados en el schema maestro del proyecto
// ============================================================

// --- Auth ---
export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'consultor' | 'usuario'
  estado: 'activo' | 'inactivo'
  created_at: string
  updated_at: string
}

// --- IA ---
export interface ConfiguracionIA {
  id: string
  usuario_id: string
  proveedor_ia: string
  modelo: string
  api_key_encriptada: string
  estado_conexion: 'activo' | 'error' | 'pendiente'
  ultimo_test_conexion: string | null
  created_at: string
  updated_at: string
}

// --- Clientes ---
export type EstadoCaso = 'activo' | 'en_progreso' | 'pendiente' | 'cerrado'

export interface Cliente {
  id: string
  usuario_id: string
  nombre_completo: string
  email?: string
  telefono?: string
  direccion?: string
  ciudad?: string
  estado?: string
  zip?: string
  fecha_nacimiento?: string
  ssn_parcial?: string
  estado_caso: EstadoCaso
  notas?: string
  created_at: string
  updated_at: string
}

// --- Reportes ---
export type FuenteReporte =
  | 'Experian' | 'Equifax' | 'TransUnion'
  | 'IdentityIQ' | 'SmartCredit' | 'PrivacyGuard'
  | 'MyScoreIQ' | 'otro'

export interface ReporteCredito {
  id: string
  cliente_id: string
  nombre_archivo: string
  ruta_archivo: string
  fecha_reporte: string
  mes_referencia: number
  anio_referencia: number
  tipo_reporte: FuenteReporte
  version: number
  created_at: string
}

// --- Análisis ---
export type EstadoGeneral = 'riesgo_bajo' | 'riesgo_medio' | 'riesgo_alto'

export interface ResumenGeneral {
  total_cuentas: number
  cuentas_positivas: number
  cuentas_negativas: number
  collections: number
  charge_offs: number
  hard_inquiries: number
  estado_general: EstadoGeneral
}

export interface ErrorDetectado {
  tipo: string
  descripcion: string
  cuenta?: string
  buro?: string
  prioridad: 'alta' | 'media' | 'baja'
}

export interface Recomendacion {
  tipo: string
  descripcion: string
  ley_aplicable?: 'FCRA' | 'FDCPA' | 'FACTA'
  prioridad: number
}

export interface AnalisisReporte {
  id: string
  reporte_id: string
  resumen_general: ResumenGeneral
  datos_personales: Record<string, any>
  cuentas: Record<string, any>[]
  inquiries: Record<string, any>[]
  errores_detectados: ErrorDetectado[]
  recomendaciones: Recomendacion[]
  estado_general: EstadoGeneral
  created_at: string
}

// --- Comparación ---
export interface ComparacionReportes {
  id: string
  cliente_id: string
  reporte_base_id: string
  reporte_comparado_id: string
  resultado: Record<string, any>
  resumen_cambios: string
  progreso_general: 'mejoro' | 'empeoro' | 'sin_cambios'
  created_at: string
}

// --- Cartas ---
export type TipoCarta =
  | 'carta_datos_personales'
  | 'carta_cuenta_no_reconocida'
  | 'carta_cuenta_duplicada'
  | 'carta_balance_incorrecto'
  | 'carta_late_payment'
  | 'carta_inquiry'
  | 'carta_validacion_deuda'
  | 'carta_coleccion'
  | 'carta_seguimiento'
  | 'carta_redisputa'

export type EstadoCarta = 'borrador' | 'editada' | 'exportada' | 'enviada'

export interface Carta {
  id: string
  cliente_id: string
  reporte_id?: string
  tipo_carta: TipoCarta
  destinatario: string
  contenido: string
  ley_aplicada?: 'FCRA' | 'FDCPA' | 'FACTA'
  estado: EstadoCarta
  pdf_url?: string
  created_at: string
  updated_at: string
}

// --- Disputas ---
export type EstadoDisputa = 'pendiente' | 'enviada' | 'respondida' | 'cerrada'
export type ResultadoDisputa = 'eliminado' | 'actualizado' | 'verificado_sin_cambios' | 'pendiente'

export interface Disputa {
  id: string
  cliente_id: string
  reporte_id?: string
  carta_id?: string
  tipo_disputa: string
  buro_o_entidad: string
  estado: EstadoDisputa
  fecha_envio?: string
  fecha_respuesta?: string
  resultado?: ResultadoDisputa
  notas?: string
  created_at: string
  updated_at: string
}

// --- Branding ---
export interface Branding {
  id: string
  usuario_id: string
  logo_url?: string
  color_primario: string
  color_secundario: string
  color_acento: string
  tipografia: string
  encabezado_pdf?: string
  pie_pagina_pdf?: string
  updated_at: string
}

// --- API responses ---
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
