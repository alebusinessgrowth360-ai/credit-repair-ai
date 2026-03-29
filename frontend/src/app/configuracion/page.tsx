'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function ConfiguracionPage() {
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState('gpt-4o')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const t = getToken()
    if (!t) { router.push('/auth/login'); return }
    fetch(API + '/ia/config', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => { if (d.data) setConfig(d.data) })
      .catch(() => {})
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setLoading(true); setError(''); setMensaje('')
    const t = getToken()
    if (!t) { router.push('/auth/login'); return }
    try {
      const res = await fetch(API + '/ia/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify({ api_key: apiKey, modelo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('API Key guardada. Probando conexion...')
      const test = await fetch(API + '/ia/test-connection', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t }
      })
      const testData = await test.json()
      if (!test.ok) throw new Error(testData.error)
      setMensaje('Conexion exitosa. IA lista para usar.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#030712', backgroundImage:'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color:'#e2e8f0', fontFamily:'sans-serif', padding:'40px' }}>
      <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'#00ff88', cursor:'pointer', marginBottom:'32px', fontSize:'14px' }}>← Dashboard</button>
      <h1 style={{ fontSize:'26px', marginBottom:'8px', color:'#f1f5f9', fontWeight:'bold' }}>Configuracion de IA</h1>
      <p style={{ color:'#475569', fontSize:'14px', marginBottom:'32px' }}>Conecta tu API Key de OpenAI.</p>
      {config && (
        <div style={{ background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'10px', padding:'12px 16px', marginBottom:'24px', fontSize:'13px', color:'#00ff88' }}>
          Estado: {config.estado_conexion} — Modelo: {config.modelo}
        </div>
      )}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'16px', padding:'28px', maxWidth:'500px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
        <form onSubmit={guardar} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div>
            <label style={{ display:'block', fontSize:'11px', color:'#00ff88', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>API Key de OpenAI</label>
            <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} required
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'11px', color:'#00ff88', fontWeight:'bold', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Modelo</label>
            <select value={modelo} onChange={e => setModelo(e.target.value)}
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none' }}>
              <option value="gpt-4o">GPT-4o (recomendado)</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>
          {mensaje && <p style={{ color:'#00ff88', fontSize:'13px', margin:0 }}>{mensaje}</p>}
          {error && <p style={{ color:'#f87171', fontSize:'13px', margin:0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ padding:'13px', background: loading ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'14px', fontWeight:'bold', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 20px rgba(0,255,136,0.3)' }}>
            {loading ? 'Guardando...' : 'Guardar y probar conexion'}
          </button>
        </form>
      </div>
    </div>
  )
}
