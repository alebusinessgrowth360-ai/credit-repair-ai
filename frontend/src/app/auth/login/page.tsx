'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0f1e',
      fontFamily: "'DM Sans', sans-serif",
      padding: '24px'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Background subtle grid */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>

        {/* Logo / marca */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px'
            }}>✦</div>
            <span style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '22px', color: '#fff', letterSpacing: '-0.3px'
            }}>Credit Repair AI</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Plataforma profesional de reparación de crédito
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '36px 32px',
          backdropFilter: 'blur(12px)'
        }}>
          <h1 style={{
            fontSize: '20px', fontWeight: 600, color: '#f1f5f9',
            margin: '0 0 6px',
            fontFamily: "'DM Serif Display', serif"
          }}>Iniciar sesión</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 28px' }}>
            Ingresa tus credenciales para continuar
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label style={{
                display: 'block', fontSize: '12px', fontWeight: 500,
                color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                style={{
                  width: '100%', padding: '12px 14px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#f1f5f9',
                  outline: 'none', transition: 'border-color .2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{
                  fontSize: '12px', fontWeight: 500, color: '#94a3b8',
                  letterSpacing: '0.05em', textTransform: 'uppercase'
                }}>Contraseña</label>
                <Link href="/auth/reset" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none' }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '12px 14px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', color: '#f1f5f9',
                  outline: 'none', transition: 'border-color .2s',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#fca5a5'
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: 600, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity .2s', marginTop: '4px',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p style={{
            textAlign: 'center', fontSize: '13px', color: '#64748b',
            marginTop: '24px', marginBottom: 0
          }}>
            ¿No tienes cuenta?{' '}
            <Link href="/auth/register" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}>
              Crear cuenta
            </Link>
          </p>
        </div>

        <p style={{
          textAlign: 'center', fontSize: '11px', color: '#475569',
          marginTop: '24px'
        }}>
          Esta plataforma ofrece orientación educativa e informativa.
          No sustituye asesoría legal profesional.
        </p>
      </div>
    </main>
  )
}
export const dynamic = 'force-dynamic'
