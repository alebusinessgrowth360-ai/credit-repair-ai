'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function DetalleClientePage() {
  const params = useParams()
  const id = params.id
  const [cliente, setCliente] = useState(null)
  const [reportes, setReportes] = useState([])
  const [cartas, setCartas] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [analizando, setAnalizando] = useState(null)
  const [tipoReporte, setTipoReporte] = useState('Experian')
  const [archivo, setArchivo] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cartaAbierta, setCartaAbierta] = useState(null)
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  function cargarDatos(token) {
    Promise.all([
      fetch(API + '/clientes/' + id, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(API + '/reportes/cliente/' + id, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(API + '/cartas?cliente_id=' + id, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json())
    ]).then(([c, r, ca]) => {
      if (c.data) setCliente(c.data)
      setReportes(Array.isArray(r.data) ? r.data : [])
      setCartas(Array.isArray(ca.data) ? ca.data : [])
    }).catch(console.error)
  }

  useEffect(() => {
    const token = getToken()
    if (!token || !id) { router.push('/auth/login'); return }
    cargarDatos(token)
  }, [id])

  async function subirReporte(e) {
    e.preventDefault()
    if (!archivo) return
    setSubiendo(true); setError(''); setMensaje('')
    const token = getToken()
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1]
        const res = await fetch(API + '/reportes/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            cliente_id: id,
            tipo_reporte: tipoReporte,
            fecha_reporte: new Date().toISOString().split('T')[0],
            nombre_archivo: archivo.name,
            pdf_base64: base64
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        cargarDatos(token)
        setMensaje('Reporte subido correctamente. Ahora puedes analizarlo.')
        setArchivo(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setSubiendo(false)
      }
    }
    reader.readAsDataURL(archivo)
  }

  async function analizar(reporteId) {
    setAnalizando(reporteId); setError(''); setMensaje('')
    const token = getToken()
    try {
      setMensaje('Analizando con IA... esto puede tardar 30-60 segundos.')
      const res = await fetch(API + '/analizar/' + reporteId, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('Analisis completado.')
      router.push('/analisis/' + reporteId)
    } catch (err) {
      setError(err.message)
      setMensaje('')
    } finally {
      setAnalizando(null)
    }
  }

  if (!cliente) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif' }}>Cargando...</div>

  const fuentes = ['Experian','Equifax','TransUnion','IdentityIQ','SmartCredit','PrivacyGuard','MyScoreIQ','otro']

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <button onClick={() => router.push('/clientes')} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', marginBottom:'24px', fontSize:'14px' }}>Clientes</button>
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'32px' }}>
        <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'bold', color:'#818cf8' }}>
          {cliente.nombre_completo.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize:'24px', margin:0 }}>{cliente.nombre_completo}</h1>
          <p style={{ color:'#64748b', fontSize:'13px', margin:0 }}>{cliente.email} · {cliente.telefono}</p>
        </div>
        <span style={{ marginLeft:'auto', fontSize:'12px', padding:'4px 12px', borderRadius:'20px', background:'rgba(34,197,94,0.15)', color:'#22c55e' }}>{cliente.estado_caso}</span>
      </div>

      {cartaAbierta && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
          <div style={{ background:'#1e293b', borderRadius:'16px', padding:'32px', maxWidth:'700px', width:'100%', maxHeight:'80vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => setCartaAbierta(null)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'#94a3b8', fontSize:'20px', cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:'16px', marginBottom:'16px' }}>{cartaAbierta.tipo_carta.replace(/_/g,' ')}</h2>
            <p style={{ fontSize:'12px', color:'#64748b', marginBottom:'16px' }}>{cartaAbierta.destinatario} · {cartaAbierta.estado}</p>
            <pre style={{ fontSize:'13px', lineHeight:'1.6', whiteSpace:'pre-wrap', color:'#f1f5f9' }}>{cartaAbierta.contenido}</pre>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
        <div>
          <h2 style={{ fontSize:'16px', marginBottom:'16px' }}>Subir reporte PDF</h2>
          <form onSubmit={subirReporte} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', display:'flex', flexDirection:'column', gap:'12px' }}>
            <select value={tipoReporte} onChange={e => setTipoReporte(e.target.value)}
              style={{ padding:'10px', background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px' }}>
              {fuentes.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="file" accept=".pdf,application/pdf" onChange={e => setArchivo(e.target.files[0])} required
              style={{ padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', color:'#f1f5f9', fontSize:'13px' }} />
            {mensaje && <p style={{ color:'#22c55e', fontSize:'12px', margin:0 }}>{mensaje}</p>}
            {error && <p style={{ color:'#fca5a5', fontSize:'12px', margin:0 }}>{error}</p>}
            <button type="submit" disabled={subiendo}
              style={{ padding:'10px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:'bold', cursor:'pointer' }}>
              {subiendo ? 'Subiendo...' : 'Subir PDF'}
            </button>
          </form>
          <h2 style={{ fontSize:'16px', margin:'24px 0 16px' }}>Reportes ({reportes.length})</h2>
          {reportes.length === 0 ? (
            <p style={{ color:'#64748b', fontSize:'13px' }}>No hay reportes todavia.</p>
          ) : reportes.map(r => (
            <div key={r.id} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'bold' }}>{r.tipo_reporte} v{r.version}</div>
                <div style={{ fontSize:'11px', color:'#64748b' }}>{r.nombre_archivo}</div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => router.push('/reportes/' + r.id)}
                  style={{ padding:'6px 14px', background:'rgba(148,163,184,0.15)', border:'1px solid rgba(148,163,184,0.4)', borderRadius:'8px', color:'#94a3b8', fontSize:'12px', cursor:'pointer' }}>
                  Ver PDF
                </button>
                <button onClick={() => router.push('/analisis/' + r.id)}
                  style={{ padding:'6px 14px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.4)', borderRadius:'8px', color:'#4ade80', fontSize:'12px', cursor:'pointer' }}>
                  Ver análisis
                </button>
                <button onClick={() => analizar(r.id)} disabled={analizando === r.id}
                  style={{ padding:'6px 14px', background: analizando === r.id ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'8px', color:'#a5b4fc', fontSize:'12px', cursor:'pointer' }}>
                  {analizando === r.id ? 'Analizando...' : 'Analizar con IA'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h2 style={{ fontSize:'16px', marginBottom:'16px' }}>Cartas ({cartas.length})</h2>
          {cartas.length === 0 ? (
            <p style={{ color:'#64748b', fontSize:'13px' }}>Las cartas apareceran despues del analisis.</p>
          ) : cartas.map(c => (
            <div key={c.id} onClick={() => setCartaAbierta(c)}
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px', cursor:'pointer' }}>
              <div style={{ fontSize:'13px', fontWeight:'bold' }}>{c.tipo_carta.replace(/_/g,' ')}</div>
              <div style={{ fontSize:'11px', color:'#64748b' }}>{c.destinatario} · {c.estado}</div>
              <div style={{ fontSize:'11px', color:'#6366f1', marginTop:'4px' }}>Click para ver →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
