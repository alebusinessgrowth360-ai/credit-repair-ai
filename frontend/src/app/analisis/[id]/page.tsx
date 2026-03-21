'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

const BOTONES = [
  { tipo:'carta_datos_personales', label:'Datos personales', dest:'Experian' },
  { tipo:'carta_cuenta_no_reconocida', label:'Cuenta no reconocida', dest:'Experian' },
  { tipo:'carta_cuenta_duplicada', label:'Cuenta duplicada', dest:'Equifax' },
  { tipo:'carta_balance_incorrecto', label:'Balance incorrecto', dest:'TransUnion' },
  { tipo:'carta_late_payment', label:'Late payment', dest:'Experian' },
  { tipo:'carta_inquiry', label:'Inquiry no autorizada', dest:'Experian' },
  { tipo:'carta_validacion_deuda', label:'Validacion de deuda', dest:'Acreedor' },
  { tipo:'carta_coleccion', label:'Coleccion', dest:'Agencia' },
  { tipo:'carta_seguimiento', label:'Seguimiento', dest:'Experian' },
  { tipo:'carta_redisputa', label:'Redisputa', dest:'Experian' },
]

const RIESGO_COLOR = { riesgo_alto:'#ef4444', riesgo_medio:'#f59e0b', riesgo_bajo:'#22c55e' }
const PRIO_COLOR = { alta:'#ef4444', media:'#f59e0b', baja:'#22c55e' }

export default function AnalisisPage() {
  const { id } = useParams()
  const [analisis, setAnalisis] = useState(null)
  const [generando, setGenerando] = useState(null)
  const [clienteId, setClienteId] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token || !id) return
    fetch(API + '/analizar/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => {
        if (d.data) {
          setAnalisis(d.data)
          fetch(API + '/reportes/cliente/any', { headers: { Authorization: 'Bearer ' + token } }).catch(() => {})
        }
      })
    fetch(API + '/reportes/by-id/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) setClienteId(d.data.cliente_id) }).catch(() => {})
  }, [id])

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
      setMensaje('Carta generada. ID: ' + data.data.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(null)
    }
  }

  if (!analisis) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif', flexDirection:'column', gap:'16px' }}>
      <p>Cargando analisis...</p>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:'14px' }}>Volver</button>
    </div>
  )

  const rg = analisis.resumen_general || {}
  const errores = analisis.errores_detectados || []
  const recomendaciones = analisis.recomendaciones || []

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', marginBottom:'24px', fontSize:'14px' }}>Volver</button>
      <h1 style={{ fontSize:'24px', marginBottom:'24px' }}>Resultado del analisis</h1>

      <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'16px', margin:0 }}>Evaluacion general</h2>
          <span style={{ fontSize:'12px', fontWeight:'bold', padding:'4px 12px', borderRadius:'20px', background:(RIESGO_COLOR[rg.estado_general] || '#94a3b8') + '20', color: RIESGO_COLOR[rg.estado_general] || '#94a3b8' }}>
            {(rg.estado_general || '').replace('_',' ').toUpperCase()}
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap:'10px' }}>
          {[
            { label:'Total cuentas', val: rg.total_cuentas },
            { label:'Positivas', val: rg.cuentas_positivas, color:'#22c55e' },
            { label:'Negativas', val: rg.cuentas_negativas, color:'#ef4444' },
            { label:'Collections', val: rg.collections, color:'#ef4444' },
            { label:'Charge-offs', val: rg.charge_offs, color:'#ef4444' },
            { label:'Hard inquiries', val: rg.hard_inquiries, color:'#f59e0b' },
          ].map(m => (
            <div key={m.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:'22px', fontWeight:'bold', color: m.color || '#f1f5f9' }}>{m.val ?? 0}</div>
              <div style={{ fontSize:'10px', color:'#64748b', marginTop:'4px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {errores.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'16px', margin:'0 0 16px' }}>Errores detectados ({errores.length})</h2>
          {errores.map((e, i) => (
            <div key={i} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'bold' }}>{(e.tipo || '').replace(/_/g,' ')}</div>
                <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>{e.descripcion}</div>
              </div>
              <span style={{ fontSize:'10px', fontWeight:'bold', padding:'2px 8px', borderRadius:'20px', flexShrink:0, background:(PRIO_COLOR[e.prioridad] || '#94a3b8') + '20', color: PRIO_COLOR[e.prioridad] || '#94a3b8' }}>
                {(e.prioridad || '').toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {recomendaciones.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'24px', marginBottom:'24px' }}>
          <h2 style={{ fontSize:'16px', margin:'0 0 16px' }}>Recomendaciones</h2>
          {recomendaciones.sort((a,b) => a.prioridad - b.prioridad).map((r, i) => (
            <div key={i} style={{ display:'flex', gap:'12px', padding:'10px 0', borderBottom: i < recomendaciones.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#818cf8', flexShrink:0 }}>{i+1}</div>
              <div>
                <div style={{ fontSize:'13px' }}>{r.descripcion}</div>
                {r.ley_aplicable && <span style={{ display:'inline-block', marginTop:'4px', fontSize:'10px', padding:'2px 8px', borderRadius:'20px', background:'rgba(139,92,246,0.2)', color:'#a78bfa' }}>{r.ley_aplicable}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:'16px', padding:'24px' }}>
        <h2 style={{ fontSize:'16px', margin:'0 0 6px' }}>Generar carta de disputa</h2>
        <p style={{ color:'#64748b', fontSize:'13px', margin:'0 0 16px' }}>Selecciona el tipo de carta. La IA redactara un borrador personalizado.</p>
        {mensaje && <p style={{ color:'#22c55e', fontSize:'13px', margin:'0 0 12px' }}>{mensaje}</p>}
        {error && <p style={{ color:'#fca5a5', fontSize:'13px', margin:'0 0 12px' }}>{error}</p>}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
          {BOTONES.map(b => (
            <button key={b.tipo} onClick={() => generarCarta(b.tipo, b.dest)} disabled={!!generando}
              style={{ padding:'8px 14px', background: generando === b.tipo ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'8px', fontSize:'12px', color:'#a5b4fc', cursor: generando ? 'not-allowed' : 'pointer' }}>
              {generando === b.tipo ? 'Generando...' : b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
