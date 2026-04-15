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
  const [rescores, setRescores] = useState<any[]>([])
  const [showRescoreForm, setShowRescoreForm] = useState(false)
  const [rescoreForm, setRescoreForm] = useState({ banco: '', numero_cuenta: '', tipo_cuenta: 'Collection', balance: '', limite_credito: '', accion: 'Pay in Full', score_actual: '' })
  const [calculandoRescore, setCalculandoRescore] = useState<'ia'|'formula'|null>(null)
  const [rescoreError, setRescoreError] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token || !id) return
    // Restore from session cache instantly
    const cA = sessionStorage.getItem('analisis_' + id)
    const cR = sessionStorage.getItem('reporte_' + id)
    if (cA) setAnalisis(JSON.parse(cA))
    if (cR) { const r = JSON.parse(cR); setClienteId(r.cliente_id); setReporte(r) }
    // Fetch fresh data
    fetch(API + '/analizar/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) { setAnalisis(d.data); sessionStorage.setItem('analisis_' + id, JSON.stringify(d.data)) } })
    fetch(API + '/reportes/by-id/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (d.data) { setClienteId(d.data.cliente_id); setReporte(d.data); sessionStorage.setItem('reporte_' + id, JSON.stringify(d.data)) } }).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!clienteId) return
    const token = getToken()
    fetch(API + '/rapid-rescore/cliente/' + clienteId, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => setRescores(d.data || [])).catch(() => {})
  }, [clienteId])

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

  async function calcularRescore(modo: 'ia' | 'formula') {
    if (!rescoreForm.banco || !rescoreForm.score_actual) { setRescoreError('Bank and current score are required.'); return }
    setCalculandoRescore(modo); setRescoreError('')
    const token = getToken()
    const endpoint = modo === 'ia' ? '/rapid-rescore/calcular' : '/rapid-rescore/calcular-rapido'
    try {
      const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...rescoreForm, cliente_id: clienteId, reporte_id: id, balance: parseFloat(rescoreForm.balance) || 0, limite_credito: parseFloat(rescoreForm.limite_credito) || 0, score_actual: parseInt(rescoreForm.score_actual) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRescores(prev => [data.data, ...prev])
      setRescoreForm({ banco: '', numero_cuenta: '', tipo_cuenta: 'Collection', balance: '', limite_credito: '', accion: 'Pay in Full', score_actual: '' })
      setShowRescoreForm(false)
    } catch (err: any) { setRescoreError(err.message) }
    finally { setCalculandoRescore(null) }
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
  // Support both formats: new {TransUnion:[...], Equifax:[...], Experian:[...]} and old flat array
  const inquiriesRaw = analisis.inquiries || {}
  const inquiries: any[] = Array.isArray(inquiriesRaw)
    ? inquiriesRaw
    : [
        ...((inquiriesRaw.TransUnion || []).map((q: any) => ({ ...q, buro: 'TransUnion', tipo: 'hard' }))),
        ...((inquiriesRaw.Equifax    || []).map((q: any) => ({ ...q, buro: 'Equifax',    tipo: 'hard' }))),
        ...((inquiriesRaw.Experian   || []).map((q: any) => ({ ...q, buro: 'Experian',   tipo: 'hard' }))),
      ]
  const erroresAlta = errores.filter(e => e.prioridad === 'alta')

  const inp = { padding: '9px 12px', background: '#0a0f1e', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '7px', color: '#e2e8f0', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '32px 40px' }}>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          button, .no-print { display: none !important; }
          .print-section { break-inside: avoid; }
          .print-only { display: block !important; }
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
          {reporte && <p style={{ fontSize: '11px', color: '#475569', margin: 0, textAlign: 'center' }}><span style={{ color: '#94a3b8', fontWeight: '600' }}>{reporte.nombre_completo}</span> · {reporte.tipo_reporte} · {reporte.fecha_reporte}</p>}
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

      {/* Print-only client header */}
      {reporte && (
        <div style={{ display: 'none' }} className="print-only">
          <h2 style={{ fontSize: '16px', margin: '0 0 4px', color: '#111' }}>{reporte.nombre_completo}</h2>
          <p style={{ fontSize: '12px', color: '#555', margin: '0 0 20px' }}>{reporte.tipo_reporte} · {reporte.fecha_reporte}</p>
        </div>
      )}

      {/* Alerts */}
      {mensaje && <div className="no-print" style={{ padding: '10px 14px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', marginBottom: '16px' }}><p style={{ color: '#00ff88', fontSize: '13px', margin: 0 }}>{mensaje}</p></div>}
      {error && <div className="no-print" style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '16px' }}><p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p></div>}

      {/* Credit Scores */}
      {(() => {
        const scores = rg.scores || analisis.scores || {}
        const bureaus = [
          { key: 'Experian', color: '#818cf8' },
          { key: 'Equifax', color: '#f87171' },
          { key: 'TransUnion', color: '#34d399' },
        ]
        const hasScores = bureaus.some(b => scores[b.key] && scores[b.key] > 0) || (scores.general && scores.general > 0)
        if (!hasScores) return null
        const scoreColor = (s: number) => s >= 740 ? '#00ff88' : s >= 670 ? '#f59e0b' : s >= 580 ? '#fb923c' : '#ef4444'
        const scoreLabel = (s: number) => s >= 740 ? 'Excellent' : s >= 670 ? 'Good' : s >= 580 ? 'Fair' : 'Poor'
        return (
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '12px', margin: '0 0 16px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Credit Scores</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {scores.general > 0 && (
                <div style={{ flex: 1, minWidth: '120px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `2px solid ${scoreColor(scores.general)}44` }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Overall</div>
                  <div style={{ fontSize: '42px', fontWeight: 'bold', color: scoreColor(scores.general), lineHeight: 1 }}>{scores.general}</div>
                  <div style={{ fontSize: '11px', color: scoreColor(scores.general), marginTop: '4px' }}>{scoreLabel(scores.general)}</div>
                </div>
              )}
              {bureaus.map(b => scores[b.key] > 0 ? (
                <div key={b.key} style={{ flex: 1, minWidth: '120px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `1px solid ${b.color}33` }}>
                  <div style={{ fontSize: '11px', color: b.color, marginBottom: '6px', fontWeight: '600' }}>{b.key}</div>
                  <div style={{ fontSize: '42px', fontWeight: 'bold', color: scoreColor(scores[b.key]), lineHeight: 1 }}>{scores[b.key]}</div>
                  <div style={{ fontSize: '11px', color: scoreColor(scores[b.key]), marginTop: '4px' }}>{scoreLabel(scores[b.key])}</div>
                </div>
              ) : null)}
            </div>
          </div>
        )
      })()}

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
          {(() => {
            const colCount = cuentas.filter((c: any) => { const e = (c.estado || '').toLowerCase(); const t = (c.tipo_negativo || ''); return t === 'collection' || e.includes('collection') }).length
            const coCount = cuentas.filter((c: any) => { const e = (c.estado || '').toLowerCase(); const t = (c.tipo_negativo || ''); return t === 'charge_off' || e.includes('charge off') || e.includes('charge-off') }).length
            const negCount = cuentas.filter((c: any) => c.negativo || (c.tipo_negativo && c.tipo_negativo !== '')).length
            const uniqueCount = new Set(cuentas.map((c: any) => (c.acreedor || '').toLowerCase().trim())).size
            return [
              { label: 'Total Accounts', val: uniqueCount || rg.total_cuentas || 0, color: '#e2e8f0' },
              { label: 'Positive', val: (cuentas.length || rg.total_cuentas || 0) - negCount || rg.cuentas_positivas || 0, color: '#00ff88' },
              { label: 'Negative', val: negCount || rg.cuentas_negativas || 0, color: '#ef4444' },
              { label: 'Collections', val: colCount || rg.collections || 0, color: '#ef4444' },
              { label: 'Charge-offs', val: coCount || rg.charge_offs || 0, color: '#ef4444' },
              { label: 'Hard Inquiries', val: inquiries.filter((q: any) => q.tipo === 'hard' || !q.tipo).length || rg.hard_inquiries || 0, color: '#f59e0b' },
              { label: 'Duplicates', val: (analisis.cuentas_duplicadas || []).length || rg.cuentas_duplicadas_detectadas || 0, color: '#f87171' },
              { label: 'Personal Issues', val: (analisis.inconsistencias_personales || []).length || rg.inconsistencias_personales_detectadas || 0, color: '#a78bfa' },
            ]
          })().map(m => (
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
      {/* Personal Info Inconsistencies */}
      {(analisis.inconsistencias_personales || []).length > 0 && (
        <div className="print-section" style={{ background: 'rgba(167,139,250,0.05)', border: '2px solid rgba(167,139,250,0.35)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 4px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            Personal Info Inconsistencies ({analisis.inconsistencias_personales.length})
          </h2>
          <p style={{ fontSize: '11px', color: '#c4b5fd', margin: '0 0 14px' }}>Names, addresses, or employers that differ between bureaus or appear suspicious — disputable under FCRA.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analisis.inconsistencias_personales.map((item: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px' }}>
                <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '3px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', textTransform: 'uppercase', marginTop: '1px', flexShrink: 0 }}>
                  {item.tipo || 'info'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: '600' }}>{item.valor_reportado || item.descripcion}</div>
                  {item.valor_reportado && item.descripcion !== item.valor_reportado && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{item.descripcion}</div>}
                  {item.buro && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{item.buro}</div>}
                </div>
                {item.disputable && (
                  <button className="no-print"
                    onClick={() => generarCarta('carta_datos_personales', item.buro || 'Experian', 'FCRA', { acreedor: item.valor_reportado, tipo: item.tipo })}
                    disabled={!!generando}
                    style={{ padding: '3px 9px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '5px', color: '#a78bfa', fontSize: '10px', cursor: 'pointer', flexShrink: 0 }}>
                    Dispute
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cuentas.length > 0 && (() => {
        const BUREAU_CFG = [
          { name: 'TransUnion', abbr: 'TU', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.45)' },
          { name: 'Equifax',    abbr: 'EQ', color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.45)' },
          { name: 'Experian',   abbr: 'EX', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.45)' },
        ]
        // Only show negative accounts (collections, charge-offs, derogatory, late, past due)
        const cuentasNeg = cuentas.filter((c: any) => {
          const e = (c.estado || '').toLowerCase()
          const t = (c.tipo_negativo || c.tipo || '').toLowerCase()
          return c.negativo || t === 'collection' || t === 'charge_off' ||
            e.includes('collection') || e.includes('charge off') || e.includes('charge-off') ||
            e.includes('chargeoff') || e.includes('derogatory') || e.includes('past due') ||
            e.includes('late') || e.includes('transferred')
        })
        if (cuentasNeg.length === 0) return null
        // Group by normalized creditor name
        const grouped: Record<string, any[]> = {}
        cuentasNeg.forEach((c: any) => {
          const key = (c.acreedor || 'unknown').toLowerCase().trim().replace(/\s+/g, ' ')
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(c)
        })
        const grupos = Object.values(grouped)
        return (
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '12px', margin: '0 0 14px', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
              Negative Accounts ({grupos.length}<span style={{ color: '#475569', fontWeight: 'normal' }}> unique · {cuentasNeg.length} total</span>)
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Creditor', 'Type', 'Balance', 'Status', 'Bureaus', 'Disputable'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', color: '#64748b', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                    <th className="no-print" style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.05)', color: '#64748b', fontSize: '10px', textTransform: 'uppercase' }}>Letter</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((accounts: any[], i: number) => {
                    const c = accounts[0]
                    const burosPresentes = accounts.map((a: any) => (a.buro || '').trim()).filter(Boolean)
                    const estadoLower = (c.estado || '').toLowerCase()
                    const tipoLower = (c.tipo || '').toLowerCase()
                    const esColeccion = c.tipo_negativo === 'collection' || estadoLower.includes('collection') || tipoLower.includes('collection')
                    const esChargeOff = c.tipo_negativo === 'charge_off' || estadoLower.includes('charge off') || estadoLower.includes('charge-off') || estadoLower.includes('chargeoff')
                    const esNegativo = c.negativo || esColeccion || esChargeOff || estadoLower.includes('derogatory') || estadoLower.includes('past due') || estadoLower.includes('late')
                    const bgColor = esColeccion ? 'rgba(239,68,68,0.08)' : esChargeOff ? 'rgba(239,68,68,0.05)' : 'transparent'
                    const borderLeft = esColeccion ? '3px solid #ef4444' : esChargeOff ? '3px solid #f97316' : '3px solid transparent'
                    const statusBg = esColeccion ? 'rgba(239,68,68,0.2)' : esChargeOff ? 'rgba(249,115,22,0.15)' : esNegativo ? 'rgba(239,68,68,0.1)' : 'rgba(0,255,136,0.1)'
                    const statusColor = esColeccion ? '#ef4444' : esChargeOff ? '#f97316' : esNegativo ? '#f87171' : '#00ff88'
                    const firstBuro = burosPresentes[0] || 'Experian'
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: bgColor, borderLeft }}>
                        <td style={{ padding: '9px 10px', color: esNegativo ? '#fca5a5' : '#f1f5f9', fontWeight: esNegativo ? '700' : '400' }}>
                          {esColeccion && <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: '3px', marginRight: '6px' }}>COLLECTION</span>}
                          {esChargeOff && <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#f97316', background: 'rgba(249,115,22,0.15)', padding: '1px 5px', borderRadius: '3px', marginRight: '6px' }}>CHARGE OFF</span>}
                          {c.acreedor || '—'}
                          {c.original_creditor && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Orig: {c.original_creditor}</div>}
                        </td>
                        <td style={{ padding: '9px 10px', color: '#94a3b8' }}>{c.tipo || '—'}</td>
                        <td style={{ padding: '9px 10px', color: esNegativo ? '#ef4444' : '#94a3b8', fontWeight: esNegativo ? '600' : '400' }}>{c.balance || '—'}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: statusBg, color: statusColor, fontWeight: esColeccion ? 'bold' : 'normal' }}>
                            {c.estado || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {BUREAU_CFG.map(b => {
                              const presente = burosPresentes.some((bp: string) => bp.toLowerCase().includes(b.name.toLowerCase()))
                              return (
                                <span key={b.name} title={presente ? b.name : `Not in ${b.name}`} style={{
                                  fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '3px',
                                  background: presente ? b.bg : 'rgba(255,255,255,0.03)',
                                  color: presente ? b.color : '#1e293b',
                                  border: `1px solid ${presente ? b.border : 'rgba(255,255,255,0.05)'}`,
                                  letterSpacing: '0.5px', userSelect: 'none'
                                }}>
                                  {b.abbr}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          {(c.disputable || esColeccion || esChargeOff)
                            ? <span style={{ color: '#f59e0b', fontSize: '11px' }}>⚠ {c.razon_disputa || (esColeccion ? 'Collection account' : esChargeOff ? 'Charge-off' : 'Yes')}</span>
                            : <span style={{ color: '#475569', fontSize: '11px' }}>—</span>}
                        </td>
                        <td className="no-print" style={{ padding: '9px 10px' }}>
                          {(c.disputable || esColeccion || esChargeOff) && (
                            <button
                              onClick={() => generarCarta(esColeccion ? 'carta_coleccion' : inferTipoCarta(c.tipo || ''), firstBuro, esColeccion ? 'FDCPA' : 'FCRA', c)}
                              disabled={!!generando}
                              style={{ padding: '3px 9px', background: esColeccion ? 'rgba(239,68,68,0.15)' : 'rgba(0,255,136,0.1)', border: `1px solid ${esColeccion ? 'rgba(239,68,68,0.4)' : 'rgba(0,255,136,0.3)'}`, borderRadius: '5px', color: esColeccion ? '#ef4444' : '#00ff88', fontSize: '10px', cursor: 'pointer' }}>
                              Draft
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Cuentas Duplicadas */}
      {(analisis.cuentas_duplicadas || []).length > 0 && (
        <div className="print-section" style={{ background: 'rgba(239,68,68,0.05)', border: '2px solid rgba(239,68,68,0.4)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', margin: '0 0 4px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            Duplicate Accounts Detected ({analisis.cuentas_duplicadas.length})
          </h2>
          <p style={{ fontSize: '11px', color: '#f87171', margin: '0 0 14px' }}>Same debt reported multiple times with different creditor names — highly disputable under FCRA.</p>
          {analisis.cuentas_duplicadas.map((d: any, i: number) => (
            <div key={i} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '3px' }}>Account 1</div>
                  <div style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 'bold' }}>{d.acreedor_1}</div>
                  {d.numero_1 && <div style={{ fontSize: '11px', color: '#64748b' }}>#{d.numero_1} · {d.buro_1} · {d.balance_1}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>≈</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', marginBottom: '3px' }}>Account 2</div>
                  <div style={{ fontSize: '13px', color: '#fca5a5', fontWeight: 'bold' }}>{d.acreedor_2}</div>
                  {d.numero_2 && <div style={{ fontSize: '11px', color: '#64748b' }}>#{d.numero_2} · {d.buro_2} · {d.balance_2}</div>}
                </div>
              </div>
              {d.original_creditor && <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '6px' }}>Original Creditor: <strong>{d.original_creditor}</strong></div>}
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{d.descripcion}</div>
            </div>
          ))}
        </div>
      )}

      {/* Inquiries */}
      {inquiries.length > 0 && (() => {
        const hardInquiries = inquiries.filter((q: any) => q.tipo === 'hard' || !q.tipo)
        const INQBUREAUS = [
          { name: 'TransUnion', color: '#34d399', border: 'rgba(52,211,153,0.25)', bg: 'rgba(52,211,153,0.04)', pill: 'rgba(52,211,153,0.12)' },
          { name: 'Equifax',    color: '#f87171', border: 'rgba(248,113,113,0.25)', bg: 'rgba(248,113,113,0.04)', pill: 'rgba(248,113,113,0.12)' },
          { name: 'Experian',   color: '#818cf8', border: 'rgba(129,140,248,0.25)', bg: 'rgba(129,140,248,0.04)', pill: 'rgba(129,140,248,0.12)' },
        ]

        const disputableInquiries = hardInquiries

        // Group by bureau; inquiries with no bureau go to "Unknown"
        const byBureau: Record<string, any[]> = {}
        disputableInquiries.forEach((q: any) => {
          const b = (q.buro || '').trim() || 'Unknown'
          if (!byBureau[b]) byBureau[b] = []
          byBureau[b].push(q)
        })
        return (
          <div className="print-section" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '12px', margin: '0 0 16px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
              Hard Inquiries ({hardInquiries.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {INQBUREAUS.filter(b => byBureau[b.name]).map(b => (
                <div key={b.name} style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: b.color, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    {b.name} · {byBureau[b.name].length} inquir{byBureau[b.name].length === 1 ? 'y' : 'ies'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {byBureau[b.name].map((q: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: b.pill, border: `1px solid ${b.border}`, borderRadius: '7px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{q.empresa || q.acreedor || '—'}</div>
                          {q.fecha && <div style={{ fontSize: '10px', color: '#64748b' }}>{q.fecha}</div>}
                        </div>
                        <button className="no-print"
                          onClick={() => generarCarta('carta_inquiry', b.name, 'FCRA', q)}
                          disabled={!!generando}
                          style={{ padding: '3px 9px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '5px', color: '#f59e0b', fontSize: '10px', cursor: 'pointer' }}>
                          Dispute
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Inquiries with no bureau assigned */}
              {byBureau['Unknown'] && (
                <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Bureau not identified · {byBureau['Unknown'].length}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {byBureau['Unknown'].map((q: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '7px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{q.empresa || q.acreedor || '—'}</div>
                          {q.fecha && <div style={{ fontSize: '10px', color: '#64748b' }}>{q.fecha}</div>}
                        </div>
                        <button className="no-print"
                          onClick={() => generarCarta('carta_inquiry', q.buro || 'Experian', 'FCRA', q)}
                          disabled={!!generando}
                          style={{ padding: '3px 9px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '5px', color: '#f59e0b', fontSize: '10px', cursor: 'pointer' }}>
                          Dispute
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

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

      {/* Rapid Rescore Section */}
      <div className="print-section" style={{ marginTop: '16px', background: 'rgba(56,189,248,0.02)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#38bdf8,#a78bfa,transparent)' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '12px', margin: '0 0 3px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Rapid Rescore Analysis</h2>
            <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>Estimate score impact per account before submitting a rescore request</p>
          </div>
          <button className="no-print" onClick={() => setShowRescoreForm(f => !f)}
            style={{ padding: '7px 14px', background: showRescoreForm ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '8px', color: '#38bdf8', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
            {showRescoreForm ? '✕ Cancel' : '+ Add Account'}
          </button>
        </div>

        {/* Form */}
        {showRescoreForm && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            {rescoreError && <p style={{ color: '#f87171', fontSize: '12px', margin: '0 0 10px' }}>{rescoreError}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginBottom: '12px' }}>
              {[
                { label: 'Current Score *', key: 'score_actual', type: 'number', placeholder: 'e.g. 580' },
                { label: 'Bank / Creditor *', key: 'banco', type: 'text', placeholder: 'e.g. Capital One' },
                { label: 'Account # (optional)', key: 'numero_cuenta', type: 'text', placeholder: 'XXXX-XXXX' },
                { label: 'Balance ($)', key: 'balance', type: 'number', placeholder: '0.00' },
                { label: 'Credit Limit ($)', key: 'limite_credito', type: 'number', placeholder: '0.00' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} value={(rescoreForm as any)[f.key]}
                    onChange={e => setRescoreForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '7px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>Account Type</label>
                <select value={rescoreForm.tipo_cuenta} onChange={e => setRescoreForm(p => ({ ...p, tipo_cuenta: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '7px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  {['Collection','Charge-Off','Credit Card','Auto Loan','Student Loan','Medical Collection','Late Payment','Mortgage','Personal Loan','Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>Proposed Action</label>
                <select value={rescoreForm.accion} onChange={e => setRescoreForm(p => ({ ...p, accion: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0f1e', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '7px', color: '#f1f5f9', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                  {['Pay in Full','Settle Account','Remove / Delete','Pay for Delete','Goodwill Deletion','Reduce Balance','Dispute & Remove'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => calcularRescore('formula')} disabled={!!calculandoRescore}
                style={{ flex: 1, padding: '10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '8px', color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                {calculandoRescore === 'formula' ? 'Calculating...' : '⚡ Quick Calculate'}
              </button>
              <button onClick={() => calcularRescore('ia')} disabled={!!calculandoRescore}
                style={{ flex: 1, padding: '10px', background: calculandoRescore === 'ia' ? 'rgba(0,255,136,0.1)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#030712', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                {calculandoRescore === 'ia' ? 'AI Analyzing...' : '🤖 Calculate with AI'}
              </button>
            </div>
          </div>
        )}

        {/* Results list */}
        {rescores.length === 0 && !showRescoreForm && (
          <p style={{ color: '#475569', fontSize: '12px', margin: 0, textAlign: 'center', padding: '20px 0' }}>No rapid rescore calculations yet. Click "+ Add Account" to start.</p>
        )}
        {rescores.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rescores.map((rs: any, i: number) => {
              const impColor = rs.impacto_puntos >= 60 ? '#00ff88' : rs.impacto_puntos >= 30 ? '#f59e0b' : '#94a3b8'
              return (
                <div key={rs.id || i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${impColor}22`, borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f1f5f9' }}>{rs.banco}</span>
                      {rs.numero_cuenta && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>#{rs.numero_cuenta}</span>}
                      <span style={{ fontSize: '10px', color: '#475569', marginLeft: '8px' }}>{rs.tipo_cuenta} · {rs.accion}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{rs.score_actual}</span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>→</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: impColor }}>{rs.score_estimado}</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '20px', background: impColor + '20', color: impColor, border: `1px solid ${impColor}44` }}>+{rs.impacto_puntos} pts</span>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>{rs.modo === 'ia' ? 'AI' : 'Formula'}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px' }}>{rs.explicacion}</p>
                  {rs.recomendacion && <p style={{ fontSize: '11px', color: '#a78bfa', margin: 0 }}>Rec: {rs.recomendacion}</p>}
                  {rs.tiempo_estimado && <p style={{ fontSize: '10px', color: '#475569', margin: '4px 0 0' }}>Timeline: {rs.tiempo_estimado}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
