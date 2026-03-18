'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useParams, useRouter } from 'next/navigation'
import type { AnalisisReporte, TipoCarta } from '@/types'

// Regla crítica: cartas solo aparecen DESPUÉS de mostrar evaluación y recomendaciones
const BOTONES_CARTAS: { tipo: TipoCarta; label: string; destinatario: string }[] = [
  { tipo: 'carta_datos_personales',   label: 'Carta datos personales', destinatario: 'Experian' },
  { tipo: 'carta_cuenta_no_reconocida', label: 'Cuenta no reconocida', destinatario: 'Experian' },
  { tipo: 'carta_cuenta_duplicada',   label: 'Cuenta duplicada',       destinatario: 'Experian' },
  { tipo: 'carta_balance_incorrecto', label: 'Balance incorrecto',     destinatario: 'Experian' },
  { tipo: 'carta_late_payment',       label: 'Late payment',           destinatario: 'Experian' },
  { tipo: 'carta_inquiry',            label: 'Inquiry no autorizada',  destinatario: 'Experian' },
  { tipo: 'carta_validacion_deuda',   label: 'Validación de deuda',    destinatario: 'Acreedor' },
  { tipo: 'carta_coleccion',          label: 'Colección',              destinatario: 'Agencia' },
  { tipo: 'carta_seguimiento',        label: 'Seguimiento',            destinatario: 'Experian' },
  { tipo: 'carta_redisputa',          label: 'Redisputa',              destinatario: 'Experian' },
]

const RIESGO_COLOR: Record<string, string> = {
  riesgo_alto: '#ef4444',
  riesgo_medio: '#f59e0b',
  riesgo_bajo: '#22c55e'
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: '#ef4444',
  media: '#f59e0b',
  baja: '#22c55e'
}

export default function AnalisisPage() {
  const { id } = useParams() // reporte_id
  const [analisis, setAnalisis] = useState<AnalisisReporte | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [generandoCarta, setGenerandoCarta] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()
  const router = useRouter()

  useEffect(() => { cargarAnalisis() }, [id])

  async function cargarAnalisis() {
    const { data } = await supabase
      .from('analisis_reportes')
      .select('*')
      .eq('reporte_id', id)
      .single()

    if (data) setAnalisis(data as AnalisisReporte)
  }

  async function iniciarAnalisis() {
    setAnalizando(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analizar/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error)

      setAnalisis(json.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalizando(false)
    }
  }

  // Esta función solo se llama si el usuario presiona el botón — nunca automáticamente
  async function generarCarta(tipo: TipoCarta, destinatario: string, errorDetectado?: any) {
    setGenerandoCarta(tipo)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      // Obtener cliente_id del reporte
      const { data: reporte } = await supabase
        .from('reportes_credito')
        .select('cliente_id')
        .eq('id', id)
        .single()

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cartas/generar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          cliente_id: reporte?.cliente_id,
          reporte_id: id,
          tipo_carta: tipo,
          destinatario,
          error_detectado: errorDetectado || {},
          ley_aplicada: 'FCRA'
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      router.push(`/cartas/${json.data.id}`)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerandoCarta(null)
    }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: '860px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px', fontFamily: "'DM Serif Display', serif" }}>
          Análisis del reporte
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Reporte ID: {id}</p>
      </div>

      {/* Sin análisis aún */}
      {!analisis && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h2 style={{ fontSize: '18px', color: '#f1f5f9', margin: '0 0 8px', fontFamily: "'DM Serif Display', serif" }}>
            Reporte sin analizar
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 28px' }}>
            La IA analizará el PDF, detectará errores y generará recomendaciones.<br />
            Las cartas solo estarán disponibles después del análisis.
          </p>
          <button
            onClick={iniciarAnalisis}
            disabled={analizando}
            style={{
              padding: '13px 32px',
              background: analizando ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: 600, color: '#fff',
              cursor: analizando ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {analizando ? '⏳ Analizando con IA...' : '✦ Iniciar análisis'}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', padding: '12px 16px',
          fontSize: '13px', color: '#fca5a5', marginBottom: '20px'
        }}>{error}</div>
      )}

      {/* Resultado del análisis */}
      {analisis && (
        <>
          {/* Resumen general */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${RIESGO_COLOR[analisis.estado_general]}40`,
            borderRadius: '16px', padding: '24px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                Evaluación general
              </h2>
              <span style={{
                fontSize: '12px', fontWeight: 600,
                padding: '4px 12px', borderRadius: '20px',
                background: `${RIESGO_COLOR[analisis.estado_general]}20`,
                color: RIESGO_COLOR[analisis.estado_general]
              }}>
                {analisis.estado_general?.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Total cuentas', value: analisis.resumen_general?.total_cuentas },
                { label: 'Positivas', value: analisis.resumen_general?.cuentas_positivas, color: '#22c55e' },
                { label: 'Negativas', value: analisis.resumen_general?.cuentas_negativas, color: '#ef4444' },
                { label: 'Collections', value: analisis.resumen_general?.collections, color: '#ef4444' },
                { label: 'Charge-offs', value: analisis.resumen_general?.charge_offs, color: '#ef4444' },
                { label: 'Hard inquiries', value: analisis.resumen_general?.hard_inquiries, color: '#f59e0b' },
              ].map(m => (
                <div key={m.label} style={{
                  background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '14px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: m.color || '#f1f5f9' }}>
                    {m.value ?? '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Errores detectados */}
          {analisis.errores_detectados?.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '24px',
              marginBottom: '20px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>
                Errores detectados ({analisis.errores_detectados.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analisis.errores_detectados.map((e, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#f1f5f9' }}>
                        {e.tipo?.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                        {e.descripcion}
                      </div>
                      {e.cuenta && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                          Cuenta: {e.cuenta} {e.buro && `· ${e.buro}`}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 600,
                      padding: '3px 10px', borderRadius: '20px', flexShrink: 0,
                      background: `${PRIORIDAD_COLOR[e.prioridad]}20`,
                      color: PRIORIDAD_COLOR[e.prioridad]
                    }}>
                      {e.prioridad?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {analisis.recomendaciones?.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px', padding: '24px',
              marginBottom: '28px'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 16px' }}>
                Recomendaciones estratégicas
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analisis.recomendaciones
                  .sort((a, b) => a.prioridad - b.prioridad)
                  .map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: '12px 0',
                      borderBottom: i < analisis.recomendaciones.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                    }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: 'rgba(99,102,241,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 600, color: '#818cf8',
                        flexShrink: 0
                      }}>{i + 1}</div>
                      <div>
                        <div style={{ fontSize: '13px', color: '#f1f5f9' }}>{r.descripcion}</div>
                        {r.ley_aplicable && (
                          <span style={{
                            display: 'inline-block', marginTop: '4px',
                            fontSize: '10px', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '20px',
                            background: 'rgba(139,92,246,0.2)', color: '#a78bfa'
                          }}>{r.ley_aplicable}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* BOTONES DE CARTAS — solo aparecen después del análisis */}
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '16px', padding: '24px'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 6px' }}>
              Generar carta de disputa
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 18px' }}>
              Selecciona el tipo de carta que deseas generar. La IA redactará un borrador personalizado.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {BOTONES_CARTAS.map(b => (
                <button
                  key={b.tipo}
                  onClick={() => generarCarta(b.tipo, b.destinatario)}
                  disabled={generandoCarta === b.tipo}
                  style={{
                    padding: '9px 16px',
                    background: generandoCarta === b.tipo
                      ? 'rgba(99,102,241,0.3)'
                      : 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    borderRadius: '8px',
                    fontSize: '13px', color: '#a5b4fc',
                    cursor: generandoCarta ? 'not-allowed' : 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'background .15s'
                  }}
                >
                  {generandoCarta === b.tipo ? '⏳ Generando...' : b.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
