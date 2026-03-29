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
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [estado, setEstado] = useState('')
  const [zip, setZip] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [ssnParcial, setSsnParcial] = useState('')
  const [mostrando, setMostrando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setClientes(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(API + '/branding', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data?.logo_url) setLogoUrl(d.data.logo_url) }).catch(() => {})
  }, [])

  async function crear(e) {
    e.preventDefault()
    setGuardando(true)
    const token = getToken()
    const res = await fetch(API + '/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ nombre_completo: nombre, email, telefono, direccion, ciudad, estado, zip, fecha_nacimiento: fechaNacimiento || null, ssn_parcial: ssnParcial || null })
    })
    const data = await res.json()
    if (data.data) {
      setClientes([data.data, ...clientes])
      setNombre(''); setEmail(''); setTelefono(''); setDireccion(''); setCiudad(''); setEstado(''); setZip(''); setFechaNacimiento(''); setSsnParcial('')
      setMostrando(false)
    }
    setGuardando(false)
  }

  const estadoColor = { activo:'#00ff88', en_progreso:'#f59e0b', pendiente:'#94a3b8', cerrado:'#475569' }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712', color:'#00ff88', fontFamily:'monospace' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#030712', backgroundImage:'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color:'#e2e8f0', fontFamily:'sans-serif', padding:'40px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'#00ff88', cursor:'pointer', fontSize:'14px' }}>← Dashboard</button>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'linear-gradient(135deg,#00ff88,#0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:'16px' }}>💳</span>}
          </div>
          <span style={{ fontSize:'13px', color:'#475569' }}>Credit Repair AI</span>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'26px', margin:0, color:'#f1f5f9', fontWeight:'bold' }}>Clientes</h1>
          <p style={{ color:'#475569', fontSize:'13px', margin:'4px 0 0' }}>{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setMostrando(!mostrando)}
          style={{ padding:'10px 20px', background:'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'10px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer', boxShadow:'0 0 20px rgba(0,255,136,0.3)' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* Form nuevo cliente */}
      {mostrando && (
        <div style={{ background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'16px', padding:'24px', marginBottom:'24px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
          <h2 style={{ fontSize:'14px', margin:'0 0 20px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold' }}>Nuevo cliente</h2>
          <form onSubmit={crear} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <input placeholder="Nombre completo *" value={nombre} onChange={e=>setNombre(e.target.value)} required
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Teléfono" value={telefono} onChange={e=>setTelefono(e.target.value)}
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Dirección" value={direccion} onChange={e=>setDireccion(e.target.value)}
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <input placeholder="Ciudad" value={ciudad} onChange={e=>setCiudad(e.target.value)}
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <input placeholder="Estado (FL, TX...)" value={estado} onChange={e=>setEstado(e.target.value)} maxLength={2}
                style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
              <input placeholder="ZIP" value={zip} onChange={e=>setZip(e.target.value)} maxLength={10}
                style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:'10px', color:'#475569', display:'block', marginBottom:'4px' }}>Fecha de nacimiento</label>
              <input type="date" value={fechaNacimiento} onChange={e=>setFechaNacimiento(e.target.value)}
                style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none', boxSizing:'border-box' }} />
            </div>
            <input placeholder="SSN (últimos 4): XXXX" value={ssnParcial} onChange={e=>setSsnParcial(e.target.value)} maxLength={4}
              style={{ padding:'11px 14px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px', outline:'none' }} />
            <div style={{ gridColumn:'span 2' }}>
              <button type="submit" disabled={guardando}
                style={{ width:'100%', padding:'11px', background: guardando ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer' }}>
                {guardando ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {clientes.length === 0 ? (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', padding:'60px', textAlign:'center' }}>
          <div style={{ fontSize:'40px', marginBottom:'16px' }}>👥</div>
          <p style={{ color:'#475569', margin:0, fontSize:'14px' }}>No hay clientes todavía. Crea el primero.</p>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
          {clientes.map((c, i) => (
            <div key={c.id}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom: i < clientes.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor:'pointer', transition:'background 0.2s' }}
              onClick={() => router.push('/clientes/' + c.id)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(14,165,233,0.2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'bold', color:'#00ff88', border:'1px solid rgba(0,255,136,0.2)' }}>
                  {c.nombre_completo.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:'bold', color:'#f1f5f9' }}>{c.nombre_completo}</div>
                  <div style={{ fontSize:'12px', color:'#475569' }}>{c.email || 'Sin email'} {c.telefono ? '· ' + c.telefono : ''}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontSize:'11px', fontWeight:'bold', padding:'3px 12px', borderRadius:'20px', background: (estadoColor[c.estado_caso] || '#94a3b8') + '20', color: estadoColor[c.estado_caso] || '#94a3b8', border:`1px solid ${estadoColor[c.estado_caso] || '#94a3b8'}44` }}>
                  {c.estado_caso}
                </span>
                <span style={{ color:'#475569', fontSize:'16px' }}>→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
