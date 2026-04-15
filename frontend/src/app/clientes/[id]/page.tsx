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
  const [exportandoCarta, setExportandoCarta] = useState(null)
  const [borrrandoCarta, setBorrrandoCarta] = useState(null)
  const [modalEditarCliente, setModalEditarCliente] = useState(false)
  const [editForm, setEditForm] = useState({ nombre_completo: '', email: '', telefono: '', direccion: '', ciudad: '', estado: '', zip: '', notas: '', estado_caso: '' })
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [reporteBase, setReporteBase] = useState('')
  const [reporteComp, setReporteComp] = useState('')
  const [resultadoComparacion, setResultadoComparacion] = useState(null)
  const [modalCreditHero, setModalCreditHero] = useState(false)
  const [chEmail, setChEmail] = useState('')
  const [chPassword, setChPassword] = useState('')
  const [importandoCH, setImportandoCH] = useState(false)
  const [resultadoCH, setResultadoCH] = useState<any>(null)
  const [errorCH, setErrorCH] = useState('')
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
          body: JSON.stringify({ cliente_id: id, tipo_reporte: tipoReporte, fecha_reporte: new Date().toISOString().split('T')[0], nombre_archivo: archivo.name, pdf_base64: base64 })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        cargarDatos(token)
        setMensaje('Reporte subido correctamente.')
        setArchivo(null)
      } catch (err) { setError(err.message) }
      finally { setSubiendo(false) }
    }
    reader.readAsDataURL(archivo)
  }

  async function analizar(reporteId) {
    setAnalizando(reporteId); setError(''); setMensaje('')
    const token = getToken()
    try {
      setMensaje('Analizando con IA... esto puede tardar 30-60 segundos.')
      const res = await fetch(API + '/analizar/' + reporteId, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/analisis/' + reporteId)
    } catch (err) { setError(err.message); setMensaje('') }
    finally { setAnalizando(null) }
  }

  async function borrarReporte(reporteId) {
    if (!confirm('¿Seguro que quieres borrar este reporte?')) return
    const token = getToken()
    try {
      const res = await fetch(API + '/reportes/' + reporteId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) throw new Error('Error al borrar')
      cargarDatos(token)
    } catch (err) { setError(err.message) }
  }

  async function borrarCarta(cartaId) {
    if (!confirm('¿Borrar esta carta?')) return
    setBorrrandoCarta(cartaId)
    const token = getToken()
    try {
      const res = await fetch(API + '/cartas/' + cartaId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) throw new Error('Error al borrar')
      setCartas(prev => prev.filter(c => c.id !== cartaId))
    } catch (err) { setError(err.message) }
    finally { setBorrrandoCarta(null) }
  }

  async function guardarCliente(e) {
    e.preventDefault()
    setGuardandoCliente(true); setError('')
    const token = getToken()
    try {
      const res = await fetch(API + '/clientes/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCliente(data.data)
      setModalEditarCliente(false)
      setMensaje('Cliente actualizado.')
    } catch (err) { setError(err.message) }
    finally { setGuardandoCliente(false) }
  }

  function abrirModalEditar() {
    setEditForm({
      nombre_completo: cliente.nombre_completo || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      estado: cliente.estado || '',
      zip: cliente.zip || '',
      notas: cliente.notas || '',
      estado_caso: cliente.estado_caso || ''
    })
    setModalEditarCliente(true)
  }

  async function borrarCliente() {
    if (!confirm('¿Seguro? Se borrarán todos sus reportes y cartas.')) return
    const token = getToken()
    try {
      const res = await fetch(API + '/clientes/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) throw new Error('Error al borrar')
      router.push('/clientes')
    } catch (err) { setError(err.message) }
  }

  function descargarHTML(html: string, filename: string) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportarCarta(cartaId: string) {
    setExportandoCarta(cartaId)
    const token = getToken()
    try {
      const res = await fetch(API + '/exportar/carta/' + cartaId, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      descargarHTML(data.data.html, data.data.filename)
    } catch (err) { setError(err.message) }
    finally { setExportandoCarta(null) }
  }

  async function importarCreditHero(e) {
    e.preventDefault()
    setImportandoCH(true); setErrorCH(''); setResultadoCH(null)
    const token = getToken()
    try {
      const res = await fetch(API + '/scraper/credit-hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ email: chEmail, password: chPassword, cliente_id: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultadoCH(data.data)
      if (data.data?.reporte_id) {
        cargarDatos(token)
      }
    } catch (err: any) { setErrorCH(err.message) }
    finally { setImportandoCH(false) }
  }

  async function compararReportes(e) {
    e.preventDefault()
    if (!reporteBase || !reporteComp || reporteBase === reporteComp) {
      setError('Selecciona dos reportes diferentes'); return
    }
    setComparando(true); setError(''); setResultadoComparacion(null)
    const token = getToken()
    try {
      const res = await fetch(API + '/analizar/comparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ cliente_id: id, reporte_base_id: reporteBase, reporte_comparado_id: reporteComp })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultadoComparacion(data.data)
    } catch (err) { setError(err.message) }
    finally { setComparando(false) }
  }

  if (!cliente) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712', color:'#00ff88', fontFamily:'monospace', fontSize:'14px' }}>
      <span>Cargando...</span>
    </div>
  )

  const fuentes = ['Experian','Equifax','TransUnion','IdentityIQ','SmartCredit','PrivacyGuard','MyScoreIQ','otro']

  return (
    <div style={{ minHeight:'100vh', background:'#030712', color:'#e2e8f0', fontFamily:'sans-serif', padding:'40px', backgroundImage:'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)' }}>
      
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px' }}>
        <button onClick={() => router.push('/clientes')} style={{ background:'none', border:'none', color:'#00ff88', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', gap:'6px' }}>
          ← Clientes
        </button>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={abrirModalEditar} style={{ padding:'6px 16px', background:'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'8px', color:'#00ff88', fontSize:'12px', cursor:'pointer' }}>
            Editar
          </button>
          <button onClick={borrarCliente} style={{ padding:'6px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:'8px', color:'#f87171', fontSize:'12px', cursor:'pointer' }}>
            Borrar cliente
          </button>
        </div>
      </div>

      {/* Cliente info */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'32px', padding:'20px', background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'16px' }}>
        <div style={{ width:'52px', height:'52px', borderRadius:'12px', background:'linear-gradient(135deg,#00ff88,#0ea5e9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', fontWeight:'bold', color:'#030712' }}>
          {cliente.nombre_completo.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize:'22px', margin:0, color:'#f1f5f9' }}>{cliente.nombre_completo}</h1>
          <p style={{ color:'#64748b', fontSize:'13px', margin:0 }}>{cliente.email} · {cliente.telefono}</p>
        </div>
        <span style={{ marginLeft:'auto', fontSize:'11px', fontWeight:'bold', padding:'4px 12px', borderRadius:'20px', background:'rgba(0,255,136,0.15)', color:'#00ff88', border:'1px solid rgba(0,255,136,0.3)' }}>
          {cliente.estado_caso}
        </span>
      </div>

      {/* Modal editar cliente */}
      {modalEditarCliente && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', overflowY:'auto' }}>
          <div style={{ background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'16px', padding:'28px', maxWidth:'500px', width:'100%', position:'relative' }}>
            <button onClick={() => setModalEditarCliente(false)} style={{ position:'absolute', top:'14px', right:'14px', background:'none', border:'none', color:'#64748b', fontSize:'18px', cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:'15px', marginBottom:'20px', color:'#00ff88' }}>Editar cliente</h2>
            <form onSubmit={guardarCliente} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { field: 'nombre_completo', label: 'Nombre completo' },
                { field: 'email', label: 'Email' },
                { field: 'telefono', label: 'Teléfono' },
                { field: 'direccion', label: 'Dirección' },
                { field: 'ciudad', label: 'Ciudad' },
                { field: 'zip', label: 'ZIP' },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label style={{ display:'block', fontSize:'10px', color:'#00ff88', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</label>
                  <input value={editForm[field]} onChange={e => setEditForm(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 12px', background:'#0a0f1e', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:'10px', color:'#00ff88', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'1px' }}>Estado del caso</label>
                <select value={editForm.estado_caso} onChange={e => setEditForm(prev => ({ ...prev, estado_caso: e.target.value }))}
                  style={{ width:'100%', padding:'9px 12px', background:'#0a0f1e', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px' }}>
                  <option value="activo">Activo</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="completado">Completado</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'10px', color:'#00ff88', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'1px' }}>Notas</label>
                <textarea value={editForm.notas} onChange={e => setEditForm(prev => ({ ...prev, notas: e.target.value }))} rows={3}
                  style={{ width:'100%', padding:'9px 12px', background:'#0a0f1e', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px', boxSizing:'border-box', resize:'vertical' }} />
              </div>
              {error && <p style={{ color:'#f87171', fontSize:'12px', margin:0 }}>{error}</p>}
              <button type="submit" disabled={guardandoCliente}
                style={{ padding:'10px', background: guardandoCliente ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer', marginTop:'4px' }}>
                {guardandoCliente ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Credit Hero Score */}
      {modalCreditHero && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
          <div style={{ background:'#0d1117', border:'1px solid rgba(56,189,248,0.25)', borderRadius:'16px', padding:'28px', maxWidth:'480px', width:'100%', position:'relative' }}>
            <button onClick={() => { setModalCreditHero(false); setResultadoCH(null); setErrorCH('') }} style={{ position:'absolute', top:'14px', right:'14px', background:'none', border:'none', color:'#64748b', fontSize:'18px', cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:'14px', marginBottom:'4px', color:'#38bdf8' }}>Importar desde Credit Hero Score</h2>
            <p style={{ fontSize:'12px', color:'#64748b', marginBottom:'20px' }}>Ingresa las credenciales del cliente en creditheroscore.com</p>

            {!resultadoCH ? (
              <form onSubmit={importarCreditHero} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'#38bdf8', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'1px' }}>Email</label>
                  <input type="email" value={chEmail} onChange={e => setChEmail(e.target.value)} required placeholder="email@ejemplo.com"
                    style={{ width:'100%', padding:'9px 12px', background:'#0a0f1e', border:'1px solid rgba(56,189,248,0.2)', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'10px', color:'#38bdf8', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'1px' }}>Contraseña</label>
                  <input type="password" value={chPassword} onChange={e => setChPassword(e.target.value)} required
                    style={{ width:'100%', padding:'9px 12px', background:'#0a0f1e', border:'1px solid rgba(56,189,248,0.2)', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px', boxSizing:'border-box' }} />
                </div>
                {errorCH && <p style={{ color:'#f87171', fontSize:'12px', margin:0 }}>{errorCH}</p>}
                <button type="submit" disabled={importandoCH}
                  style={{ padding:'10px', background: importandoCH ? 'rgba(56,189,248,0.15)' : 'linear-gradient(135deg,#0ea5e9,#38bdf8)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer', marginTop:'4px' }}>
                  {importandoCH ? 'Conectando...' : 'Importar reporte'}
                </button>
              </form>
            ) : (
              <div>
                {/* Scores */}
                <p style={{ fontSize:'11px', color:'#64748b', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>Credit Scores</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
                  {[['TransUnion','#34d399'],['Equifax','#f87171'],['Experian','#818cf8']].map(([b, color]) => (
                    <div key={b} style={{ flex:1, textAlign:'center', padding:'10px 6px', background:`rgba(${color === '#34d399' ? '52,211,153' : color === '#f87171' ? '248,113,113' : '129,140,248'},0.1)`, border:`1px solid ${color}44`, borderRadius:'10px' }}>
                      <div style={{ fontSize:'20px', fontWeight:'bold', color }}>{resultadoCH.scores[b] || '—'}</div>
                      <div style={{ fontSize:'10px', color:'#64748b', marginTop:'2px' }}>{b === 'TransUnion' ? 'TU' : b === 'Equifax' ? 'EQ' : 'EX'}</div>
                    </div>
                  ))}
                </div>

                {/* Inquiries */}
                <p style={{ fontSize:'11px', color:'#64748b', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'1px' }}>
                  Hard Inquiries — Total: {resultadoCH.total_inquiries}
                </p>
                {[['TransUnion','#34d399'],['Equifax','#f87171'],['Experian','#818cf8']].map(([b, color]) => {
                  const list = resultadoCH.inquiries[b] || []
                  return (
                    <div key={b} style={{ marginBottom:'12px' }}>
                      <div style={{ fontSize:'11px', color, fontWeight:'bold', marginBottom:'4px' }}>{b} ({list.length})</div>
                      {list.length === 0 ? (
                        <p style={{ fontSize:'11px', color:'#475569', margin:0, paddingLeft:'8px' }}>Ninguno</p>
                      ) : list.map((q: any, i: number) => (
                        <div key={i} style={{ fontSize:'11px', color:'#94a3b8', paddingLeft:'8px', lineHeight:'1.7' }}>
                          {q.empresa} <span style={{ color:'#475569' }}>{q.fecha}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {resultadoCH.reporte_id && (
                  <button onClick={() => router.push('/analisis/' + resultadoCH.reporte_id)}
                    style={{ marginTop:'8px', padding:'10px', background:'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer', width:'100%' }}>
                    Ver análisis completo
                  </button>
                )}
                <button onClick={() => { setResultadoCH(null); setChEmail(''); setChPassword('') }}
                  style={{ marginTop:'6px', padding:'8px 16px', background:'none', border:'1px solid rgba(56,189,248,0.2)', borderRadius:'8px', color:'#38bdf8', fontSize:'12px', cursor:'pointer', width:'100%' }}>
                  Importar otro
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal carta */}
      {cartaAbierta && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
          <div style={{ background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'16px', padding:'32px', maxWidth:'700px', width:'100%', maxHeight:'80vh', overflowY:'auto', position:'relative' }}>
            <button onClick={() => setCartaAbierta(null)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'#64748b', fontSize:'20px', cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:'16px', marginBottom:'8px', color:'#00ff88' }}>{cartaAbierta.tipo_carta.replace(/_/g,' ')}</h2>
            <p style={{ fontSize:'12px', color:'#64748b', marginBottom:'20px' }}>{cartaAbierta.destinatario} · {cartaAbierta.estado}</p>
            <pre style={{ fontSize:'13px', lineHeight:'1.7', whiteSpace:'pre-wrap', color:'#e2e8f0', background:'rgba(255,255,255,0.03)', padding:'16px', borderRadius:'8px' }}>{cartaAbierta.contenido}</pre>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
        {/* Columna izquierda */}
        <div>
          {/* Subir PDF */}
          <h2 style={{ fontSize:'14px', fontWeight:'bold', marginBottom:'12px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px' }}>Subir reporte PDF</h2>
          <form onSubmit={subirReporte} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'20px', display:'flex', flexDirection:'column', gap:'12px', marginBottom:'28px' }}>
            <select value={tipoReporte} onChange={e => setTipoReporte(e.target.value)}
              style={{ padding:'10px', background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#e2e8f0', fontSize:'13px' }}>
              {fuentes.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="file" accept=".pdf,application/pdf" onChange={e => setArchivo(e.target.files[0])} required
              style={{ padding:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'8px', color:'#e2e8f0', fontSize:'13px' }} />
            {mensaje && <p style={{ color:'#00ff88', fontSize:'12px', margin:0 }}>{mensaje}</p>}
            {error && <p style={{ color:'#f87171', fontSize:'12px', margin:0 }}>{error}</p>}
            <button type="submit" disabled={subiendo}
              style={{ padding:'10px', background: subiendo ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer' }}>
              {subiendo ? 'Subiendo...' : 'Subir PDF'}
            </button>
          </form>

          {/* Credit Hero Score import */}
          <button onClick={() => setModalCreditHero(true)}
            style={{ width:'100%', padding:'10px', background:'rgba(56,189,248,0.06)', border:'1px dashed rgba(56,189,248,0.3)', borderRadius:'10px', color:'#38bdf8', fontSize:'12px', cursor:'pointer', marginBottom:'28px', textAlign:'center' }}>
            + Importar desde Credit Hero Score
          </button>

          {/* Reportes */}
          <h2 style={{ fontSize:'14px', fontWeight:'bold', marginBottom:'12px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px' }}>Reportes ({reportes.length})</h2>
          {reportes.length === 0 ? (
            <p style={{ color:'#475569', fontSize:'13px' }}>No hay reportes todavia.</p>
          ) : reportes.map(r => (
            <div key={r.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'bold', color:'#f1f5f9' }}>{r.tipo_reporte} v{r.version}</div>
                  <div style={{ fontSize:'11px', color:'#475569' }}>{r.nombre_archivo}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                <button onClick={() => router.push('/reportes/' + r.id)}
                  style={{ padding:'5px 12px', background:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.3)', borderRadius:'6px', color:'#94a3b8', fontSize:'11px', cursor:'pointer' }}>
                  Ver PDF
                </button>
                <button onClick={() => router.push('/analisis/' + r.id)}
                  style={{ padding:'5px 12px', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'6px', color:'#00ff88', fontSize:'11px', cursor:'pointer' }}>
                  Ver análisis
                </button>
                <button onClick={() => analizar(r.id)} disabled={analizando === r.id}
                  style={{ padding:'5px 12px', background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.3)', borderRadius:'6px', color:'#38bdf8', fontSize:'11px', cursor:'pointer' }}>
                  {analizando === r.id ? 'Analizando...' : 'Analizar con IA'}
                </button>
                <button onClick={() => borrarReporte(r.id)}
                  style={{ padding:'5px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', color:'#f87171', fontSize:'11px', cursor:'pointer' }}>
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Columna derecha */}
        <div>
          {/* Cartas */}
          <h2 style={{ fontSize:'14px', fontWeight:'bold', marginBottom:'12px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px' }}>Cartas ({cartas.length})</h2>
          {cartas.length === 0 ? (
            <p style={{ color:'#475569', fontSize:'13px' }}>Las cartas apareceran despues del analisis.</p>
          ) : cartas.map(c => (
            <div key={c.id}
              style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(0,255,136,0.1)', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px' }}>
                <div onClick={() => setCartaAbierta(c)} style={{ cursor:'pointer', flex:1 }}>
                  <div style={{ fontSize:'13px', fontWeight:'bold', color:'#f1f5f9' }}>{c.tipo_carta.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:'11px', color:'#475569', marginTop:'3px' }}>{c.destinatario} · {c.estado}</div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => exportarCarta(c.id)} disabled={exportandoCarta === c.id}
                    style={{ padding:'4px 10px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:'6px', color:'#38bdf8', fontSize:'11px', cursor:'pointer' }}>
                    {exportandoCarta === c.id ? '...' : '↓ Export'}
                  </button>
                  <button onClick={() => borrarCarta(c.id)} disabled={borrrandoCarta === c.id}
                    style={{ padding:'4px 10px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', color:'#f87171', fontSize:'11px', cursor:'pointer' }}>
                    {borrrandoCarta === c.id ? '...' : 'Borrar'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Comparar reportes */}
          {reportes.length >= 2 && (
            <div style={{ marginTop:'28px' }}>
              <h2 style={{ fontSize:'14px', fontWeight:'bold', marginBottom:'12px', color:'#a78bfa', textTransform:'uppercase', letterSpacing:'1px' }}>Comparar reportes</h2>
              <div style={{ background:'rgba(167,139,250,0.04)', border:'1px solid rgba(167,139,250,0.15)', borderRadius:'12px', padding:'16px' }}>
                <form onSubmit={compararReportes} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  <select value={reporteBase} onChange={e => setReporteBase(e.target.value)} required
                    style={{ padding:'9px', background:'#0d1117', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'8px', color:'#e2e8f0', fontSize:'12px' }}>
                    <option value="">Reporte base...</option>
                    {reportes.map(r => <option key={r.id} value={r.id}>{r.tipo_reporte} v{r.version} — {r.fecha_reporte}</option>)}
                  </select>
                  <select value={reporteComp} onChange={e => setReporteComp(e.target.value)} required
                    style={{ padding:'9px', background:'#0d1117', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'8px', color:'#e2e8f0', fontSize:'12px' }}>
                    <option value="">Reporte comparado...</option>
                    {reportes.map(r => <option key={r.id} value={r.id}>{r.tipo_reporte} v{r.version} — {r.fecha_reporte}</option>)}
                  </select>
                  <button type="submit" disabled={comparando}
                    style={{ padding:'9px', background: comparando ? 'rgba(167,139,250,0.2)' : 'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.4)', borderRadius:'8px', color:'#a78bfa', fontSize:'12px', fontWeight:'bold', cursor:'pointer' }}>
                    {comparando ? 'Comparando...' : 'Comparar con IA'}
                  </button>
                </form>
                {resultadoComparacion && (
                  <div style={{ marginTop:'12px', padding:'12px', background:'rgba(0,0,0,0.3)', borderRadius:'8px' }}>
                    <div style={{ fontSize:'12px', fontWeight:'bold', color: resultadoComparacion.progreso_general === 'mejoro' ? '#00ff88' : resultadoComparacion.progreso_general === 'empeoro' ? '#f87171' : '#94a3b8', marginBottom:'6px' }}>
                      {resultadoComparacion.progreso_general === 'mejoro' ? '↑ Mejora detectada' : resultadoComparacion.progreso_general === 'empeoro' ? '↓ Empeoramiento' : '→ Sin cambios'}
                    </div>
                    <p style={{ fontSize:'12px', color:'#94a3b8', margin:0 }}>{resultadoComparacion.resumen_cambios}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
