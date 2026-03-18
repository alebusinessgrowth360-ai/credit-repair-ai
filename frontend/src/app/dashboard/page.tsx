'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

interface DashboardData {
  total_clientes: number
  clientes_activos: number
  reportes_este_mes: number
  cartas_generadas: number
  disputas_pendientes: number
  clientes_recientes: any[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function cargarDatos() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar perfil
      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setPerfil(perfilData)

      // Cargar métricas
      const [
        { count: totalClientes },
        { count: clientesActivos },
        { count: reportesMes },
        { count: cartasTotal },
        { count: disputasPend },
        { data: recientes }
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('estado_caso', 'activo'),
        supabase.from('reportes_credito').select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('cartas').select('*', { count: 'exact', head: true }),
        supabase.from('disputas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('clientes').select('id, nombre_completo, estado_caso, created_at').order('created_at', { ascending: false }).limit(5)
      ])

      setData({
        total_clientes: totalClientes || 0,
        clientes_activos: clientesActivos || 0,
        reportes_este_mes: reportesMes || 0,
        cartas_generadas: cartasTotal || 0,
        disputas_pendientes: disputasPend || 0,
        clientes_recientes: recientes || []
      })
      setLoading(false)
    }

    cargarDatos()
  }, [])

  const estadoColor: Record<string, string> = {
    activo: '#22c55e',
    en_progreso: '#f59e0b',
    pendiente: '#94a3b8',
    cerrado: '#64748b'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '26px', fontWeight: 600, color: '#f1f5f9',
          margin: '0 0 4px',
          fontFamily: "'DM Serif Display', serif"
        }}>
          Hola, {perfil?.nombre?.split(' ')[0] || 'Usuario'} 👋
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          {new Date().toLocaleDateString('es-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '32px'
      }}>
        {[
          { label: 'Total clientes', value: data?.total_clientes, icon: '👥', color: '#6366f1' },
          { label: 'Casos activos', value: data?.clientes_activos, icon: '✅', color: '#22c55e' },
          { label: 'Reportes este mes', value: data?.reportes_este_mes, icon: '📄', color: '#f59e0b' },
          { label: 'Cartas generadas', value: data?.cartas_generadas, icon: '✉️', color: '#8b5cf6' },
          { label: 'Disputas pendientes', value: data?.disputas_pendientes, icon: '⏳', color: '#ef4444' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '22px', marginBottom: '10px' }}>{m.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: m.color, lineHeight: 1 }}>
              {m.value ?? '—'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Acciones rápidas */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Acciones rápidas
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          {[
            { href: '/clientes/nuevo', label: 'Nuevo cliente', icon: '➕', desc: 'Crear expediente' },
            { href: '/reportes/subir', label: 'Subir reporte', icon: '📤', desc: 'PDF de crédito' },
            { href: '/configuracion', label: 'Configurar IA', icon: '🔑', desc: 'API Key' },
            { href: '/branding', label: 'Mi marca', icon: '🎨', desc: 'Logo y colores' },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'border-color .2s'
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              >
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{a.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{a.label}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Clientes recientes */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Clientes recientes
          </h2>
          <Link href="/clientes" style={{ fontSize: '13px', color: '#6366f1', textDecoration: 'none' }}>
            Ver todos →
          </Link>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          {data?.clientes_recientes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No hay clientes todavía.{' '}
              <Link href="/clientes/nuevo" style={{ color: '#6366f1', textDecoration: 'none' }}>
                Crea el primero →
              </Link>
            </div>
          ) : (
            data?.clientes_recientes.map((c, i) => (
              <Link key={c.id} href={`/clientes/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: i < (data.clientes_recientes.length - 1) ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  transition: 'background .15s'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'rgba(99,102,241,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 600, color: '#818cf8',
                      flexShrink: 0
                    }}>
                      {c.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#f1f5f9' }}>{c.nombre_completo}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(c.created_at).toLocaleDateString('es-US')}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 500,
                    padding: '3px 10px', borderRadius: '20px',
                    background: `${estadoColor[c.estado_caso]}20`,
                    color: estadoColor[c.estado_caso]
                  }}>
                    {c.estado_caso.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
