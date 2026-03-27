'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

const ESTADO_COLOR = {
  pendiente: '#f59e0b',
  enviada: '#38bdf8',
  respondida: '#a78bfa',
  cerrada: '#475569'
}

const RESULTADO_COLOR = {
  eliminado: '#00ff88',
  actualizado: '#38bdf8',
  verificado_sin_cambios: '#f59e0b',
  pendiente: '#475569'
}

export default function DisputasPage() {
  const [disputas, setDisputas] = useState([])
  const [loading, setLoading] = useState(true)
  const [disputaSeleccionada, setDisputaSeleccionada] = useState(null)
  const [actualizando, setActualizando] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevoResultado, setNuevoResultado] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaRespuesta, setFechaRespuesta] = useState('')
  const [mensaje, setMensaje] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  function cargar() {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    fetch(API + '/disputas', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setDisputas(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  function abrirDisputa(d) {
    setDisputaSeleccionada(d)
    setNuevoEstado(d.estado)
    setNuevoResultado(d.resultado || '')
    setNotas(d.notas || '')
    setFechaRespuesta(d.fecha_respuesta ? d.fecha_respuesta.split('T')[0] : '')
    setMensaje('')
  }

  async function actualizarDisputa(e) {
    e.preventDefault()
    setActualizando(true)
    const token = getToken()
    try {
      const res = await fetch(API + '/disputas/' + disputaSeleccionada.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ estado: nuevoEstado, resultado: nuevoResultado || null, fecha_respuesta: fechaRespuesta || null, notas: notas || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('Disputa actualizada.')
      cargar()
      setTimeout(() => setDisputaSeleccionada(null), 1000)
    } catch (err) {
      setMensaje('Error: ' + err.message)
    } finally {
      setActualizando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', color: '#00ff88', fontFamily: 'monospace' }}>
      Cargando...
    </div>
  )

  const pendientes = disputas.filter(d => d.estado === 'pendiente').length
  const enviadas = disputas.filter(d => d.estado === 'enviada').length
  const respondidas = disputas.filter(d => d.estado === 'respondida').length

  return (
    <div style={{ minHeight: '100vh', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '40px' }}>

      {/* Modal editar disputa */}
      {disputaSeleccionada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%', position: 'relative' }}>
            <button onClick={() => setDisputaSeleccionada(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            <h2 style={{ fontSize: '16px', marginBottom: '4px', color: '#00ff88' }}>Actualizar disputa</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>{disputaSeleccionada.tipo_disputa} · {disputaSeleccionada.buro_o_entidad}</p>

            <form onSubmit={actualizarDisputa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado</label>
                <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px' }}>
                  <option value="pendiente">Pendiente</option>
                  <option value="enviada">Enviada</option>
                  <option value="respondida">Respondida</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Resultado</label>
                <select value={nuevoResultado} onChange={e => setNuevoResultado(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px' }}>
                  <option value="">Sin resultado</option>
                  <option value="eliminado">Eliminado ✓</option>
                  <option value="actualizado">Actualizado</option>
                  <option value="verificado_sin_cambios">Verificado sin cambios</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Fecha de respuesta</label>
                <input type="date" value={fechaRespuesta} onChange={e => setFechaRespuesta(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#00ff88', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Notas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              {mensaje && <p style={{ color: mensaje.startsWith('Error') ? '#f87171' : '#00ff88', fontSize: '13px', margin: 0 }}>{mensaje}</p>}
              <button type="submit" disabled={actualizando}
                style={{ padding: '11px', background: actualizando ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#030712', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                {actualizando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '14px' }}>← Dashboard</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#00ff88,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>💳</div>
          <span style={{ fontSize: '13px', color: '#475569' }}>Credit Repair AI</span>
        </div>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', margin: '0 0 4px', color: '#f1f5f9', fontWeight: 'bold' }}>Disputas</h1>
        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>{disputas.length} disputa{disputas.length !== 1 ? 's' : ''} en total</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Pendientes', value: pendientes, color: '#f59e0b' },
          { label: 'Enviadas', value: enviadas, color: '#38bdf8' },
          { label: 'Respondidas', value: respondidas, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`, borderRadius: '12px', padding: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,${s.color},transparent)` }}></div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Lista */}
      {disputas.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <p style={{ color: '#475569', margin: 0, fontSize: '14px' }}>No hay disputas todavía. Se crean desde el análisis de un reporte.</p>
          <button onClick={() => router.push('/clientes')} style={{ marginTop: '16px', padding: '10px 20px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', color: '#00ff88', fontSize: '13px', cursor: 'pointer' }}>
            Ir a Clientes →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {disputas.map(d => (
            <div key={d.id}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,255,136,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1f5f9' }}>{d.tipo_disputa}</span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', background: (ESTADO_COLOR[d.estado] || '#94a3b8') + '20', color: ESTADO_COLOR[d.estado] || '#94a3b8', border: `1px solid ${ESTADO_COLOR[d.estado] || '#94a3b8'}44`, flexShrink: 0 }}>
                    {d.estado.toUpperCase()}
                  </span>
                  {d.resultado && (
                    <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '20px', background: (RESULTADO_COLOR[d.resultado] || '#94a3b8') + '20', color: RESULTADO_COLOR[d.resultado] || '#94a3b8', border: `1px solid ${RESULTADO_COLOR[d.resultado] || '#94a3b8'}44`, flexShrink: 0 }}>
                      {d.resultado.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  {d.buro_o_entidad}
                  {d.fecha_envio && ` · Enviada: ${new Date(d.fecha_envio).toLocaleDateString('es-US')}`}
                  {d.fecha_respuesta && ` · Respuesta: ${new Date(d.fecha_respuesta).toLocaleDateString('es-US')}`}
                </div>
                {d.notas && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>{d.notas}</div>}
              </div>
              <button onClick={() => abrirDisputa(d)}
                style={{ padding: '7px 16px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '8px', color: '#00ff88', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                Actualizar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
