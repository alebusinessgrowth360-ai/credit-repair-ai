'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

function descargarHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const BOTONES = [
  { tipo:'carta_datos_personales', label:'Personal Data', dest:'Experian' },
  { tipo:'carta_cuenta_no_reconocida', label:'Unrecognized Account', dest:'Experian' },
  { tipo:'carta_cuenta_duplicada', label:'Duplicate Account', dest:'Equifax' },
  { tipo:'carta_balance_incorrecto', label:'Incorrect Balance', dest:'TransUnion' },
  { tipo:'carta_late_payment', label:'Late Payment', dest:'Experian' },
  { tipo:'carta_inquiry', label:'Unauthorized Inquiry', dest:'Experian' },
  { tipo:'carta_validacion_deuda', label:'Debt Validation', dest:'Creditor' },
  { tipo:'carta_coleccion', label:'Collection', dest:'Agency' },
  { tipo:'carta_seguimiento', label:'Follow Up', dest:'Experian' },
  { tipo:'carta_redisputa', label:'Re-Dispute', dest:'Experian' },
]

const RIESGO_COLOR = { riesgo_alto:'#ef4444', riesgo_medio:'#f59e0b', riesgo_bajo:'#00ff88' }
const PRIO_COLOR = { alta:'#ef4444', media:'#f59e0b', baja:'#00ff88' }

export default function AnalisisPage() {
  const { id } = useParams()
  const [analisis, setAnalisis] = useState(null)
  const [generando, setGenerando] = useState(null)
  const [clienteId, setClienteId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState(false)
  const [creandoDisputa, setCreandoDisputa] = useState(false)
  const [modalDisputa, setModalDisputa] = useState(false)
  const [tipDisputa, setTipDisputa] = useState('')
  const [buroDisputa, setBuroDisputa] = useState('Experian')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token || !id) return
    fetch(API + '/analizar/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) setAnalisis(d.data) })
    fetch(API + '/reportes/by-id/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) setClienteId(d.data.cliente_id) }).catch(() => {})
  }, [id])

  async function exportarEvaluacion() {
    setExportando(true); setError('')
    const token = getToken()
    try {
      const res = await fetch(API + '/exportar/evaluacion/' + id, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      descargarHTML(data.data.html, data.data.filename)
    } catch (err) { setError(err.message) }
    finally { setExportando(false) }
  }

  async function crearDisputa(e) {
    e.preventDefault()
    setCreandoDisputa(true); setError('')
    const token = getToken()
    try {
      const res = await fetch(API + '/disputas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ cliente_id: clienteId, reporte_id: id, tipo_disputa: tipDisputa, buro_o_entidad: buroDisputa })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('✓ Disputa creada correctamente')
      setModalDisputa(false)
      setTipDisputa(''); setBuroDisputa('Experian')
    } catch (err) { setError(err.message) }
    finally { setCreandoDisputa(false) }
  }

  async function generarCarta(tipo, dest) {
    setGenerando(tipo); setError('')
    const token = getToken()
    try {
      const res = await fetch(API + '/cartas/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ cliente_id: clienteId, reporte_id: id, tipo_carta: tipo, destinatario: dest, ley_aplicada: 'FCRA' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('✓ Letter generated successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(null)
    }
  }

  if (!analisis) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712', color:'#00ff88', fontFamily:'monospace', flexDirection:'column', gap:'16px' }}>
      <div style={{ width:'40px', height:'40px', border:'2px solid #00ff88', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}></div>
      <p style={{ margin:0 }}>Analyzing report...</p>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'13px' }}>← Go back</button>
    </div>
  )

  const rg = analisis.resumen_general || {}
  const errores = analisis.errores_detectados || []
  const recomendaciones = analisis.recomendaciones || []

  return (
    <div style={{ minHeight:'100vh', background:'#030712', backgroundImage:'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color:'#e2e8f0', fontFamily:'sans-serif', padding:'40px' }}>

      {/* Modal crear disputa */}
      {modalDisputa && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
          <div style={{ background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'16px', padding:'32px', maxWidth:'440px', width:'100%', position:'relative' }}>
            <button onClick={() => setModalDisputa(false)} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'#64748b', fontSize:'20px', cursor:'pointer' }}>✕</button>
            <h2 style={{ fontSize:'16px', marginBottom:'20px', color:'#00ff88' }}>Crear disputa</h2>
            <form onSubmit={crearDisputa} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#00ff88', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>Tipo de disputa</label>
                <input value={tipDisputa} onChange={e => setTipDisputa(e.target.value)} required placeholder="Ej: Cuenta no reconocida - Bank of America"
                  style={{ width:'100%', padding:'10px', background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#e2e8f0', fontSize:'13px', boxSizing:'border-box' as const }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#00ff88', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'1px' }}>Buró o entidad</label>
                <select value={buroDisputa} onChange={e => setBuroDisputa(e.target.value)}
                  style={{ width:'100%', padding:'10px', background:'#0d1117', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'8px', color:'#e2e8f0', fontSize:'13px' }}>
                  <option>Experian</option><option>Equifax</option><option>TransUnion</option>
                  <option>Creditor</option><option>Collection Agency</option><option>Otro</option>
                </select>
              </div>
              <button type="submit" disabled={creandoDisputa}
                style={{ padding:'11px', background: creandoDisputa ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border:'none', borderRadius:'8px', color:'#030712', fontSize:'13px', fontWeight:'bold', cursor:'pointer', marginTop:'4px' }}>
                {creandoDisputa ? 'Creando...' : 'Crear disputa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#00ff88', cursor:'pointer', fontSize:'14px' }}>← Back</button>
        <h1 style={{ fontSize:'20px', margin:0, color:'#f1f5f9', fontWeight:'bold' }}>Analysis Results</h1>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={() => setModalDisputa(true)}
            style={{ padding:'8px 14px', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'8px', color:'#a78bfa', fontSize:'12px', cursor:'pointer' }}>
            + Disputa
          </button>
          <button onClick={exportarEvaluacion} disabled={exportando}
            style={{ padding:'8px 14px', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'8px', color:'#00ff88', fontSize:'12px', cursor:'pointer' }}>
            {exportando ? 'Exportando...' : '↓ Exportar'}
          </button>
        </div>
      </div>

      {/* Resumen general */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'16px', padding:'24px', marginBottom:'20px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'14px', margin:0, color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold' }}>General Evaluation</h2>
          <span style={{ fontSize:'11px', fontWeight:'bold', padding:'4px 12px', borderRadius:'20px', background:(RIESGO_COLOR[rg.estado_general] || '#94a3b8') + '20', color: RIESGO_COLOR[rg.estado_general] || '#94a3b8', border:`1px solid ${RIESGO_COLOR[rg.estado_general] || '#94a3b8'}44` }}>
            {(rg.estado_general || '').replace('_',' ').toUpperCase()}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'10px' }}>
          {[
            { label:'Total Accounts', val: rg.total_cuentas, color:'#e2e8f0' },
            { label:'Positive', val: rg.cuentas_positivas, color:'#00ff88' },
            { label:'Negative', val: rg.cuentas_negativas, color:'#ef4444' },
            { label:'Collections', val: rg.collections, color:'#ef4444' },
            { label:'Charge-offs', val: rg.charge_offs, color:'#ef4444' },
            { label:'Hard Inquiries', val: rg.hard_inquiries, color:'#f59e0b' },
          ].map(m => (
            <div key={m.label} style={{ background:'rgba(0,0,0,0.3)', borderRadius:'10px', padding:'14px', textAlign:'center', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize:'24px', fontWeight:'bold', color: m.color }}>{m.val ?? 0}</div>
              <div style={{ fontSize:'10px', color:'#475569', marginTop:'4px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Errores */}
      {errores.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'14px', margin:'0 0 16px', color:'#f87171', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold' }}>⚠ Detected Errors ({errores.length})</h2>
          {errores.map((e, i) => (
            <div key={i} style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:'10px', padding:'14px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'bold', color:'#f1f5f9' }}>{(e.tipo || '').replace(/_/g,' ')}</div>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>{e.descripcion}</div>
                {e.buro && <span style={{ fontSize:'10px', color:'#38bdf8', marginTop:'4px', display:'inline-block' }}>{e.buro}</span>}
              </div>
              <span style={{ fontSize:'10px', fontWeight:'bold', padding:'3px 10px', borderRadius:'20px', flexShrink:0, background:(PRIO_COLOR[e.prioridad] || '#94a3b8') + '20', color: PRIO_COLOR[e.prioridad] || '#94a3b8', border:`1px solid ${PRIO_COLOR[e.prioridad] || '#94a3b8'}44` }}>
                {(e.prioridad || '').toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recomendaciones */}
      {recomendaciones.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:'16px', padding:'24px', marginBottom:'24px' }}>
          <h2 style={{ fontSize:'14px', margin:'0 0 16px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold' }}>Strategic Recommendations</h2>
          {recomendaciones.sort((a,b) => a.prioridad - b.prioridad).map((r, i) => (
            <div key={i} style={{ display:'flex', gap:'12px', padding:'12px 0', borderBottom: i < recomendaciones.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'rgba(0,255,136,0.15)', border:'1px solid rgba(0,255,136,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#00ff88', flexShrink:0, fontWeight:'bold' }}>{i+1}</div>
              <div>
                <div style={{ fontSize:'13px', color:'#e2e8f0' }}>{r.descripcion}</div>
                {r.ley_aplicable && <span style={{ display:'inline-block', marginTop:'6px', fontSize:'10px', padding:'2px 10px', borderRadius:'20px', background:'rgba(14,165,233,0.15)', color:'#38bdf8', border:'1px solid rgba(14,165,233,0.3)' }}>{r.ley_aplicable}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generar cartas */}
      <div style={{ background:'rgba(0,255,136,0.03)', border:'1px solid rgba(0,255,136,0.2)', borderRadius:'16px', padding:'24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'linear-gradient(90deg,#00ff88,transparent)' }}></div>
        <h2 style={{ fontSize:'14px', margin:'0 0 6px', color:'#00ff88', textTransform:'uppercase', letterSpacing:'1px', fontWeight:'bold' }}>Generate Dispute Letter</h2>
        <p style={{ color:'#475569', fontSize:'13px', margin:'0 0 16px' }}>Select letter type. AI will draft a personalized letter in English.</p>
        {mensaje && <div style={{ padding:'10px 14px', background:'rgba(0,255,136,0.1)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'8px', marginBottom:'12px' }}><p style={{ color:'#00ff88', fontSize:'13px', margin:0 }}>{mensaje}</p></div>}
        {error && <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', marginBottom:'12px' }}><p style={{ color:'#f87171', fontSize:'13px', margin:0 }}>{error}</p></div>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {BOTONES.map(b => (
            <button key={b.tipo} onClick={() => generarCarta(b.tipo, b.dest)} disabled={!!generando}
              style={{ padding:'8px 16px', background: generando === b.tipo ? 'rgba(0,255,136,0.2)' : 'rgba(0,255,136,0.08)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'8px', fontSize:'12px', color: generando === b.tipo ? '#00ff88' : '#94a3b8', cursor: generando ? 'not-allowed' : 'pointer', fontWeight:'500' }}>
              {generando === b.tipo ? '⏳ Generating...' : b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
