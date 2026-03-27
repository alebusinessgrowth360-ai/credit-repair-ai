'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrarse')
      document.cookie = 'token=' + data.data.token + '; path=/; max-age=604800'
      localStorage.setItem('token', data.data.token)
      router.push('/configuracion')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: '8px', color: '#f1f5f9', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', fontFamily: 'sans-serif', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg,#00ff88,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 16px', boxShadow: '0 0 30px rgba(0,255,136,0.3)' }}>
            💳
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '26px', margin: '0 0 8px', fontWeight: 'bold' }}>Credit Repair AI</h1>
          <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>Crea tu cuenta</p>
        </div>

        {/* Form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '20px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Nombre completo</label>
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Contraseña</label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
                <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ padding: '13px', background: loading ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '10px', color: '#030712', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 20px rgba(0,255,136,0.3)', marginTop: '4px' }}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', marginTop: '24px' }}>
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" style={{ color: '#00ff88', textDecoration: 'none', fontWeight: 'bold' }}>Iniciar sesión</Link>
        </p>
      </div>
    </main>
  )
}
