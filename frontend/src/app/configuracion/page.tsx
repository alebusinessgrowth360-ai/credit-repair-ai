'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracionPage() {
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState('gpt-4o')
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = window.localStorage.getItem('token')
    if (!t) { router.push('/auth/login'); return }
    setToken(t)
    fetch(`${API}/ia/config`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => { if (d.data) setConfig(d.data) })
      .catch(() => {})
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setMensaje('')
    const t = window.localStorage.getItem('token')
    if (!t) { router.push('/auth/login'); return }
    try {
      const res = await fetch(`${API}/ia/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ api_key: apiKey, modelo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('API Key guardada. Probando conexión...')
      const test = await fetch(`${API}/ia/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      })
      const testData = await test.json()
      if (!test.ok) throw new Error(testData.error)
cat > ~/Downloads/credit-repair-ai/frontend/src/app/configuracion/page.tsx << 'EOF'
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfiguracionPage() {
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState('gpt-4o')
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = window.localStorage.getItem('token')
    if (!t) { router.push('/auth/login'); return }
    setToken(t)
    fetch(`${API}/ia/config`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(d => { if (d.data) setConfig(d.data) })
      .catch(() => {})
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setMensaje('')
    const t = window.localStorage.getItem('token')
    if (!t) { router.push('/auth/login'); return }
    try {
      const res = await fetch(`${API}/ia/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ api_key: apiKey, modelo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('API Key guardada. Probando conexión...')
      const test = await fetch(`${API}/ia/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      })
      const testData = await test.json()
      if (!test.ok) throw new Error(testData.error)
      setMensaje('✅ Conexión exitosa. IA lista para usar.')
      setConfig({ ...config, estado_conexion: 'activo' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', marginBottom:'24px', fontSize:'14px' }}>← Dashboard</button>
      <h1 style={{ fontSize:'24px', marginBottom:'8px' }}>Configuración de IA</h1>
      <p style={{ color:'#64748b', fontSize:'14px', marginBottom:'32px' }}>Conecta tu API Key de OpenAI para analizar reportes y generar cartas.</p>

      {config && (
        <div style={{ background: config.estado_conexion === 'activo' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${config.estado_conexion === 'activo' ? '#22c55e' : '#ef4444'}40`, borderRadius:'10px', padding:'12px 16px', marginBottom:'24px', fontSize:'13px' }}>
          Estado: <b>{config.estado_conexion}</b> · Modelo: {config.modelo}
        </div>
      )}

      <form onSubmit={guardar} style={{ maxWidth:'500px', display:'flex', flexDirection:'column', gap:'16px' }}>
        <div>
          <label style={{ display:'block', fontSize:'12px', color:'#94a3b8', marginBottom:'8px' }}>API KEY DE OPENAI</label>
          <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} required
            style={{ width:'100%', padding:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ display:'block', fontSize:'12px', color:'#94a3b8', marginBottom:'8px' }}>MODELO</label>
          <select value={modelo} onChange={e => setModelo(e.target.value)}
            style={{ width:'100%', padding:'12px', background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', outline:'none' }}>
            <option value="gpt-4o">GPT-4o (recomendado)</option>
            <option value="gpt-4o-mini">GPT-4o Mini (más económico)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>
        {mensaje && <p style={{ color:'#22c55e', fontSize:'13px', margin:0 }}>{mensaje}</p>}
        {error && <p style={{ color:'#fca5a5', fontSize:'13px', margin:0 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ padding:'13px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'14px', fontWeight:600, cursor:'pointer' }}>
          {loading ? 'Guardando y probando...' : 'Guardar y probar conexión'}
        </button>
      </form>
    </div>
  )
}
