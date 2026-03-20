'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesion')
      document.cookie = 'token=' + data.data.token + '; path=/; max-age=604800'
      localStorage.setItem('token', data.data.token)
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', fontFamily:'sans-serif', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <h1 style={{ color:'#f1f5f9', fontSize:'28px', margin:'0 0 8px' }}>Credit Repair AI</h1>
          <p style={{ color:'#64748b', fontSize:'14px', margin:0 }}>Plataforma profesional de reparacion de credito</p>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'32px' }}>
          <h2 style={{ color:'#f1f5f9', fontSize:'18px', margin:'0 0 24px' }}>Iniciar sesion</h2>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none' }} />
            <input type="password" placeholder="Contrasena" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none' }} />
            {error && <p style={{ color:'#fca5a5', fontSize:'13px', margin:0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ padding:'13px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'14px', fontWeight:'bold', cursor:'pointer' }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
