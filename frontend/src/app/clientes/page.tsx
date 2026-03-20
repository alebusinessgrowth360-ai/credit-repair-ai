'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mostrando, setMostrando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setClientes(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function crear(e) {
    e.preventDefault()
    setGuardando(true)
    const token = getToken()
    const res = await fetch(API + '/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ nombre_completo: nombre, email, telefono })
    })
    const data = await res.json()
    if (data.data) {
      setClientes([data.data, ...clientes])
      setNombre(''); setEmail(''); setTelefono('')
      setMostrando(false)
    }
    setGuardando(false)
  }

  const estadoColor = { activo:'#22c55e', en_progreso:'#f59e0b', pendiente:'#94a3b8', cerrado:'#64748b' }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif' }}>Cargando...</div>

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', marginBottom:'24px', fontSize:'14px' }}>Dashboard</button>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <h1 style={{ fontSize:'24px', margin:0 }}>Clientes</h1>
        <button onClick={() => setMostrando(!mostrando)}
          style={{ padding:'10px 20px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:'bold', cursor:'pointer' }}>
          + Nuevo cliente
        </button>
      </div>
      {mostrando && (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'24px' }}>
          <h2 style={{ fontSize:'16px', margin:'0 0 16px' }}>Crear nuevo cliente</h2>
          <form onSubmit={crear} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <input placeholder="Nombre completo *" value={nombre} onChange={e=>setNombre(e.target.value)} required
              style={{ padding:'10px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
              style={{ padding:'10px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Telefono" value={telefono} onChange={e=>setTelefono(e.target.value)}
              style={{ padding:'10px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <button type="submit" disabled={guardando}
              style={{ padding:'10px', background:'#6366f1', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:'bold', cursor:'pointer' }}>
              {guardando ? 'Guardando...' : 'Crear cliente'}
            </button>
          </form>
        </div>
      )}
      {clientes.length === 0 ? (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'48px', textAlign:'center' }}>
          <p style={{ color:'#64748b', margin:0 }}>No hay clientes todavia. Crea el primero.</p>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', overflow:'hidden' }}>
          {clientes.map((c, i) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom: i < clientes.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none', cursor:'pointer' }}
              onClick={() => router.push('/clientes/' + c.id)}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'bold', color:'#818cf8' }}>
                  {c.nombre_completo.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:'bold', color:'#f1f5f9' }}>{c.nombre_completo}</div>
                  <div style={{ fontSize:'12px', color:'#64748b' }}>{c.email || 'Sin email'}</div>
                </div>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'bold', padding:'3px 10px', borderRadius:'20px', background: estadoColor[c.estado_caso] + '20', color: estadoColor[c.estado_caso] }}>
                {c.estado_caso}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
