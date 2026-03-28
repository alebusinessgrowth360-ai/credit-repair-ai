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

const RIESGO_COLOR: Record<string, string> = { riesgo_alto: '#ef4444', riesgo_medio: '#f59e0b', riesgo_bajo: '#00ff88' }
const PRIO_COLOR: Record<string, string> = { alta: '#ef4444', media: '#f59e0b', baja: '#00ff88' }
const LEY_COLOR: Record<string, string> = { FCRA: '#38bdf8', FDCPA: '#a78bfa', FACTA: '#fb923c' }

const TIPO_CARTA_MAP: Record<string, string> = {
  'cuenta no reconocida': 'carta_cuenta_no_reconocida',
  'cuenta duplicada': 'carta_cuenta_duplicada',
  'balance incorrecto': 'carta_balance_incorrecto',
  'late payment': 'carta_late_payment',
  'inquiry': 'carta_inquiry',
  'coleccion': 'carta_coleccion',
  'collection': 'carta_coleccion',
  'validacion': 'carta_validacion_deuda',
  'datos personales': 'carta_datos_personales',
}

function inferTipoCarta(tipoError: string): string {
  const t = (tipoError || '').toLowerCase()
  for (const [key, val] of Object.entries(TIPO_CARTA_MAP)) {
    if (t.includes(key)) return val
  }
  return 'carta_cuenta_no_reconocida'
}

const BUREAUS = ['Experian', 'Equifax', 'TransUnion']

const LETTER_TYPES = [
  { tipo: 'carta_datos_personales', label: 'Personal Data Error' },
  { tipo: 'carta_cuenta_no_reconocida', label: 'Unrecognized Account' },
  { tipo: 'carta_cuenta_duplicada', label: 'Duplicate Account' },
  { tipo: 'carta_balance_incorrecto', label: 'Incorrect Balance' },
  { tipo: 'carta_late_payment', label: 'Late Payment' },
  { tipo: 'carta_inquiry', label: 'Unauthorized Inquiry' },
  { tipo: 'carta_validacion_deuda', label: 'Debt Validation' },
  { tipo: 'carta_coleccion', label: 'Collection Account' },
  { tipo: 'carta_seguimiento', label: 'Follow-Up' },
  { tipo: 'carta_redisputa', label: 'Re-Dispute' },
]

export default function AnalisisPage() {
  const { id } = useParams()
  const [analisis, setAnalisis] = useState<any>(null)
  const [reporte, setReporte] = useState<any>(null)
  const [generando, setGenerando] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState(false)
  const [creandoDisputa, setCreandoDisputa] = useState(false)
  const [modalDisputa, setModalDisputa] = useState(false)
  const [tipDisputa, setTipDisputa] = useState('')
  const [buroDisputa, setBuroDisputa] = useState('Experian')
  const [bureauLetra, setBureauLetra] = useState('Experian')
  const [tipoLetraSeleccionado, setTipoLetraSeleccionado] = useState('carta_cuenta_no_reconocida')
  const [generandoTodas, setGenerandoTodas] = useState(false)
  const [progresoCarta, setProgresoCarta] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token || !id) return
    fetch(API + '/analizar/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) setAnalisis(d.data) })
    fetch(API + '/reportes/by-id/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) { setClienteId(d.data.cliente_id); setReporte(d.data) } }).catch(() => {})
  }, [id])

  async function exportarEvaluacion() {
    setExportando(true); setError('')
    const token = getToken()
    try {
      const res = await fetch(API + '/exportar/evaluacion/' + id, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      descargarHTML(data.data.html, data.data.filename)
    } catch (err: any) { setError(err.message) }
    finally { setExportando(false) }
  }

  function imprimirPDF() {
    window.print()
  }

  async function crearDisputa(e: any) {
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
      setMensaje('✓ Dispute created successfully')
      setModalDisputa(false)
      setTipDisputa(''); setBuroDisputa('Experian')
    } catch (err: any) { setError(err.message) }
    finally { setCreandoDisputa(false) }
  }

  async function generarTodasCartas() {
    if (!clienteId) { setError('No se pudo obtener el cliente. Recarga la página.'); return }
    const erroresList: any[] = analisis?.errores_detectados || []
    if (erroresList.length === 0) { setError('No hay errores detectados para generar cartas.'); return }
    setGenerandoTodas(true); setError(''); setMensaje('')
    const token = getToken()
    let ok = 0; let fail = 0
    for (let i = 0; i < erroresList.length; i++) {
      const e = erroresList[i]
      setProgresoCarta(`Generando carta ${i + 1} de ${erroresList.length}...`)
      try {
        const res = await fetch(API + '/cartas/generar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            cliente_id: clienteId, reporte_id: id,
            tipo_carta: inferTipoCarta(e.tipo),
            destinatario: e.buro || 'Experian',
            ley_aplicada: e.ley_aplicable || 'FCRA',
            error_detectado: e
          })
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    setGenerandoTodas(false); setProgresoCarta('')
    setMensaje(`✓ ${ok} carta${ok !== 1 ? 's' : ''} generada${ok !== 1 ? 's' : ''}${fail > 0 ? ` · ${fail} con error` : ''}. Verifica en el perfil del cliente.`)
  }

  async function generarCarta(tipo: string, dest: string, ley = 'FCRA', errorContext?: any) {
    const key = tipo + '_' + dest
    setGenerando(key); setError(''); setMensaje('')
    const token = getToken()
    try {
      const res = await fetch(API + '/cartas/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          cliente_id: clienteId, reporte_id: id, tipo_carta: tipo,
          destinatario: dest, ley_aplicada: ley,
          error_detectado: errorContext || null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('✓ Letter generated for ' + dest + '. View it in the client\'s letters section.')
    } catch (err: any) { setError(err.message) }
    finally { setGenerando(null) }
  }

  if (!analisis) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', color: '#00ff88', fontFamily: 'monospace', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '2px solid #00ff88', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <p style={{ margin: 0 }}>Loading analysis...</p>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '13px' }}>← Go back</button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const rg = analisis.resumen_general || {}
  const errores: any[] = analisis.errores_detectados || []
  const inconsistencias: any[] = analisis.inconsistencias_entre_buros || []
  const recomendaciones: any[] = analisis.recomendaciones || []
  const cuentas: any[] = analisis.cuentas || []
  const inquiries: any[] = analisis.inquiries || []
  const erroresAlta = errores.filter(e => e.prioridad === 'alta')

  const inp = { padding: '9px 12px', background: '#0a0f1e', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '7px', color: '#e2e8f0', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '32px 40px' }}>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button, .no-print { display: none !important; }
          .print-section { break-inside: avoid; }
        }
      `}</style>

      {/* Modal crear disputa */}
      {modalDisputa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ background: '#0d1117', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', position: 'relative' }}>
            <button onClick={() => setModalDisputa(false)} style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            <h2 style={{ fontSize: '15px', marginBottom: '20px', color: '#00ff88' }}>Register Dispute</h2>
            <form onSubmit={crearDisputa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#00ff88', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Dispute Type</label>
                <input value={tipDisputa} onChange={e => setTipDisputa(e.target.value)} required placeholder="e.g. Unrecognized account - Bank of America" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#00ff88', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Bureau / Entity</label>
                <select value={buroDisputa} onChange={e => setBuroDisputa(e.target.value)} style={{ ...inp, background: '#0a0f1e' }}>
                  <option>Experian</option><option>Equifax</option><option>TransUnion</option>
                  <option>Creditor</option><option>Collection Agency</option><option>Other</option>
                </select>
              </div>
              <button type="submit" disabled={creandoDisputa}
                style={{ padding: '10px', background: creandoDisputa ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#030712', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>
                {creandoDisputa ? 'Creating...' : 'Register Dispute'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '13px' }}>← Back</button>
        <div>
          <h1 style={{ fontSize: '18px', margin: '0 0 2px', color: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Credit Report Analysis</h1>
          {reporte && <p style={{ fontSize: '11px', color: '#475569', margin: 0, textAlign: 'center' }}>{reporte.tipo_reporte} · {reporte.fecha_reporte}</p>}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setModalDisputa(true)}
            style={{ padding: '7px 12px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '7px', color: '#a78bfa', fontSize: '11px', cursor: 'pointer' }}>
            + Dispute
          </button>
          <button onClick={exportarEvaluacion} disabled={exportando}
            style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '7px', color: '#38bdf8', fontSize: '11px', cursor: 'pointer' }}>
            {exportando ? '...' : '↓ HTML'}
          </button>
          <button onClick={imprimirPDF}
            style={{ padding: '7px 12px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '7px', color: '#00ff88', fontSize: '11px', cursor: 'pointer' }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Alerts */}
      {mensaje && <div className="no-print" style={{ padding: '10px 14px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', marginBottom: '16px' }}><p style={{ color: '#00ff88', fontSize: '13px', margin: 0 }}>{mensaje}</p></div>}
      {error && <div className="no-print" style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '16px' }}><p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p></div>}

      {/* Summary */}
      <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '14px', padding: '20px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: 0, color: '#00ff88', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>General Evaluation</h2>
          <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', background: (RIESGO_COLOR[rg.estado_general] || '#94a3b8') + '20', color: RIESGO_COLOR[rg.estado_general] || '#94a3b8', border: `1px solid ${RIESGO_COLOR[rg.estado_general] || '#94a3b8'}44` }}>
            {(rg.estado_general || '').replace('_', ' ').toUpperCase()}
          </span>
          {erroresAlta.length > 0 && <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>⚠ {erroresAlta.length} HIGH PRIORITY</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: '8px' }}>
          {[
            { label: 'Total Accounts', val: rg.total_cuentas, color: '#e2e8f0' },
            { label: 'Positive', val: rg.cuentas_positivas, color: '#00ff88' },
            { label: 'Negative', val: rg.cuentas_negativas, color: '#ef4444' },
            { label: 'Collections', val: rg.collections, color: '#ef4444' },
            { label: 'Charge-offs', val: rg.charge_offs, color: '#ef4444' },
            { label: 'Hard Inquiries', val: rg.hard_inquiries, color: '#f59e0b' },
          ].map(m => (
            <div key={m.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: m.color }}>{m.val ?? 0}</div>
              <div style={{ fontSize: '9px', color: '#475569', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Inconsistencias entre burós — CRITICAL SECTION */}
      {inconsistencias.length > 0 && (
        <div className="print-section" style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 14px', color: '#fb923c', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            ⚡ Bureau Inconsistencies ({inconsistencias.length})
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Element', 'Bureaus Involved', 'Difference', 'Priority'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', background: 'rgba(251,146,60,0.15)', color: '#fb923c', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                  <th className="no-print" style={{ padding: '8px 10px', background: 'rgba(251,146,60,0.15)', color: '#fb923c', fontSize: '10px', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {inconsistencias.map((inc: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px', color: '#f1f5f9', fontWeight: '500' }}>{inc.elemento || '—'}</td>
                    <td style={{ padding: '10px', color: '#38bdf8' }}>{inc.buros_involucrados || '—'}</td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{inc.diferencia || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '20px', background: (PRIO_COLOR[inc.prioridad] || '#94a3b8') + '20', color: PRIO_COLOR[inc.prioridad] || '#94a3b8' }}>
                        {(inc.prioridad || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="no-print" style={{ padding: '10px' }}>
                      <button
                        onClick={() => generarCarta('carta_cuenta_no_reconocida', (inc.buros_involucrados || 'Experian').split(',')[0].trim(), 'FCRA', inc)}
                        disabled={!!generando}
                        style={{ padding: '4px 10px', background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', borderRadius: '5px', color: '#fb923c', fontSize: '10px', cursor: 'pointer' }}>
                        {generando ? '...' : 'Draft Letter'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detected Errors */}
      {errores.length > 0 && (
        <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '12px', margin: 0, color: '#f87171', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>⚠ Detected Errors ({errores.length})</h2>
            <button className="no-print" onClick={generarTodasCartas} disabled={generandoTodas || !clienteId}
              style={{ padding: '6px 14px', background: generandoTodas ? 'rgba(0,255,136,0.1)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '7px', color: '#030712', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
              {generandoTodas ? (progresoCarta || 'Generando...') : `⚡ Generate All Letters (${errores.length})`}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {errores.map((e: any, i: number) => (
              <div key={i} style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f1f5f9' }}>{(e.tipo || '').replace(/_/g, ' ')}</span>
                    {e.buro && <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '20px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>{e.buro}</span>}
                    {e.ley_aplicable && <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '20px', background: (LEY_COLOR[e.ley_aplicable] || '#94a3b8') + '20', color: LEY_COLOR[e.ley_aplicable] || '#94a3b8', border: `1px solid ${LEY_COLOR[e.ley_aplicable] || '#94a3b8'}44` }}>{e.ley_aplicable}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{e.descripcion}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '20px', background: (PRIO_COLOR[e.prioridad] || '#94a3b8') + '20', color: PRIO_COLOR[e.prioridad] || '#94a3b8', border: `1px solid ${PRIO_COLOR[e.prioridad] || '#94a3b8'}44` }}>
                    {(e.prioridad || '').toUpperCase()}
                  </span>
                  <button className="no-print"
                    onClick={() => generarCarta(inferTipoCarta(e.tipo), e.buro || 'Experian', e.ley_aplicable || 'FCRA', e)}
                    disabled={!!generando}
                    style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '5px', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}>
                    {generando === inferTipoCarta(e.tipo) + '_' + (e.buro || 'Experian') ? '...' : 'Draft Letter'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Table */}
      {cuentas.length > 0 && (
        <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 14px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Accounts ({cuentas.length})</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Creditor', 'Type', 'Balance', 'Status', 'Bureau', 'Disputable'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', color: '#64748b', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                  <th className="no-print" style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>Letter</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: c.negativo ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                    <td style={{ padding: '9px 10px', color: '#f1f5f9', fontWeight: c.negativo ? '600' : '400' }}>{c.acreedor || '—'}</td>
                    <td style={{ padding: '9px 10px', color: '#94a3b8' }}>{c.tipo || '—'}</td>
                    <td style={{ padding: '9px 10px', color: c.negativo ? '#ef4444' : '#94a3b8' }}>{c.balance || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: c.negativo ? 'rgba(239,68,68,0.15)' : 'rgba(0,255,136,0.1)', color: c.negativo ? '#ef4444' : '#00ff88' }}>
                        {c.estado || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', color: '#38bdf8', fontSize: '11px' }}>{c.buro || '—'}</td>
                    <td style={{ padding: '9px 10px' }}>
                      {c.disputable ? <span style={{ color: '#f59e0b', fontSize: '11px' }}>⚠ {c.razon_disputa || 'Yes'}</span> : <span style={{ color: '#475569', fontSize: '11px' }}>—</span>}
                    </td>
                    <td className="no-print" style={{ padding: '9px 10px' }}>
                      {c.disputable && (
                        <button
                          onClick={() => generarCarta(inferTipoCarta(c.tipo || ''), c.buro || 'Experian', 'FCRA', c)}
                          disabled={!!generando}
                          style={{ padding: '3px 9px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '5px', color: '#00ff88', fontSize: '10px', cursor: 'pointer' }}>
                          Draft
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inquiries */}
      {inquiries.length > 0 && (
        <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 14px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Hard Inquiries ({inquiries.filter((q: any) => q.tipo === 'hard').length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {inquiries.filter((q: any) => q.tipo === 'hard' || !q.tipo).map((q: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{q.empresa || '—'}</div>
                  {q.fecha && <div style={{ fontSize: '10px', color: '#64748b' }}>{q.fecha}</div>}
                </div>
                <button className="no-print"
                  onClick={() => generarCarta('carta_inquiry', 'Experian', 'FCRA', q)}
                  disabled={!!generando}
                  style={{ padding: '3px 9px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '5px', color: '#f59e0b', fontSize: '10px', cursor: 'pointer' }}>
                  Dispute
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recomendaciones.length > 0 && (
        <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 14px', color: '#00ff88', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Strategic Recommendations</h2>
          {[...recomendaciones].sort((a, b) => (a.prioridad || 0) - (b.prioridad || 0)).map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: i < recomendaciones.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#00ff88', flexShrink: 0, fontWeight: 'bold' }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{r.descripcion}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                  {r.ley_aplicable && <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '20px', background: (LEY_COLOR[r.ley_aplicable] || '#94a3b8') + '20', color: LEY_COLOR[r.ley_aplicable] || '#94a3b8', border: `1px solid ${LEY_COLOR[r.ley_aplicable] || '#94a3b8'}44` }}>{r.ley_aplicable}</span>}
                  {r.tipo && <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>{r.tipo}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Letters — Per Bureau */}
      <div className="no-print print-section" style={{ background: 'rgba(0,255,136,0.02)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
        <h2 style={{ fontSize: '12px', margin: '0 0 4px', color: '#00ff88', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Generate Dispute Letters</h2>
        <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 16px' }}>Select bureau and letter type. AI generates a personalized professional letter.</p>

        {mensaje && <div style={{ padding: '8px 12px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '7px', marginBottom: '12px' }}><p style={{ color: '#00ff88', fontSize: '12px', margin: 0 }}>{mensaje}</p></div>}
        {error && <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '7px', marginBottom: '12px' }}><p style={{ color: '#f87171', fontSize: '12px', margin: 0 }}>{error}</p></div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#00ff88', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Bureau</label>
            <select value={bureauLetra} onChange={e => setBureauLetra(e.target.value)} style={{ ...inp, background: '#0a0f1e' }}>
              {BUREAUS.map(b => <option key={b}>{b}</option>)}
              <option>Creditor</option>
              <option>Collection Agency</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#00ff88', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Letter Type</label>
            <select value={tipoLetraSeleccionado} onChange={e => setTipoLetraSeleccionado(e.target.value)} style={{ ...inp, background: '#0a0f1e' }}>
              {LETTER_TYPES.map(l => <option key={l.tipo} value={l.tipo}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => generarCarta(tipoLetraSeleccionado, bureauLetra, 'FCRA')}
          disabled={!!generando}
          style={{ padding: '10px 20px', background: generando ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#030712', fontSize: '13px', fontWeight: 'bold', cursor: generando ? 'not-allowed' : 'pointer', marginBottom: '14px' }}>
          {generando ? '⏳ Generating letter...' : `Generate Letter → ${bureauLetra}`}
        </button>

        {/* Quick bureau buttons */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <p style={{ fontSize: '10px', color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick: Send same letter to all bureaus</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {BUREAUS.map(b => (
              <button key={b}
                onClick={() => generarCarta(tipoLetraSeleccionado, b, 'FCRA')}
                disabled={!!generando}
                style={{ flex: 1, padding: '8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '7px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>
                {generando === tipoLetraSeleccionado + '_' + b ? '⏳' : b}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
