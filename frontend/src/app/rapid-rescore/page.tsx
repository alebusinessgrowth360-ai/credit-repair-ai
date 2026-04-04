'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

const TIPOS_CUENTA = ['Collection', 'Charge-Off', 'Credit Card', 'Auto Loan', 'Student Loan', 'Medical Collection', 'Late Payment', 'Mortgage', 'Personal Loan', 'Other']
const ACCIONES = ['Pay in Full', 'Settle Account', 'Remove / Delete', 'Pay for Delete', 'Goodwill Deletion', 'Reduce Balance', 'Dispute & Remove']

const inp = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '8px', color: '#f1f5f9', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }
const sel = { ...inp, background: '#0a0f1e' }
const lbl = { display: 'block', fontSize: '10px', color: '#00ff88', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '6px' }

export default function RapidRescorePage() {
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  const [banco, setBanco] = useState('')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('Collection')
  const [balance, setBalance] = useState('')
  const [limiteCredito, setLimiteCredito] = useState('')
  const [accion, setAccion] = useState('Pay in Full')
  const [scoreActual, setScoreActual] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [calculando, setCalculando] = useState(false)
  const [modo, setModo] = useState<'ia' | 'formula'>('ia')
  const [error, setError] = useState('')

  async function calcular(modoCalculo: 'ia' | 'formula') {
    if (!banco || !scoreActual) { setError('Banco y Score actual son requeridos.'); return }
    setCalculando(true); setError(''); setResultado(null); setModo(modoCalculo)
    const token = getToken()
    const endpoint = modoCalculo === 'ia' ? '/api/rapid-rescore/calcular' : '/api/rapid-rescore/calcular-rapido'
    try {
      const res = await fetch(API + endpoint.replace('/api', ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ banco, numero_cuenta: numeroCuenta, tipo_cuenta: tipoCuenta, balance: parseFloat(balance) || 0, limite_credito: parseFloat(limiteCredito) || 0, accion, score_actual: parseInt(scoreActual) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data.data)
    } catch (err: any) { setError(err.message) }
    finally { setCalculando(false) }
  }

  const impactoColor = !resultado ? '#00ff88' : resultado.impacto_puntos >= 60 ? '#00ff88' : resultado.impacto_puntos >= 30 ? '#f59e0b' : '#94a3b8'

  return (
    <div style={{ minHeight: '100vh', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '14px' }}>← Dashboard</button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', margin: 0, color: '#f1f5f9', fontWeight: 'bold' }}>⚡ Rapid Rescore Calculator</h1>
          <p style={{ color: '#475569', fontSize: '12px', margin: '4px 0 0' }}>Estimate credit score impact before submitting a rapid rescore request</p>
        </div>
        <div style={{ width: '80px' }}></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '16px', padding: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>
          <h2 style={{ fontSize: '12px', color: '#00ff88', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 20px' }}>Account Details</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Current Credit Score *</label>
              <input type="number" placeholder="e.g. 580" value={scoreActual} onChange={e => setScoreActual(e.target.value)} min={300} max={850} style={{ ...inp, fontSize: '18px', fontWeight: 'bold', color: '#00ff88' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Bank / Creditor *</label>
              <input placeholder="e.g. Capital One, Midland Credit" value={banco} onChange={e => setBanco(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Account Number</label>
              <input placeholder="XXXX-XXXX" value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Account Type</label>
              <select value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)} style={sel}>
                {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Balance ($)</label>
              <input type="number" placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Credit Limit ($)</label>
              <input type="number" placeholder="0.00" value={limiteCredito} onChange={e => setLimiteCredito(e.target.value)} style={inp} />
            </div>
            {balance && limiteCredito && parseFloat(limiteCredito) > 0 && (
              <div style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: '#475569' }}>Current Utilization:</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: parseFloat(balance) / parseFloat(limiteCredito) > 0.3 ? '#ef4444' : '#00ff88' }}>
                  {((parseFloat(balance) / parseFloat(limiteCredito)) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Proposed Action</label>
              <select value={accion} onChange={e => setAccion(e.target.value)} style={sel}>
                {ACCIONES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '12px', margin: '16px 0 0' }}>{error}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => calcular('formula')} disabled={calculando}
              style={{ padding: '12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '9px', color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              {calculando && modo === 'formula' ? 'Calculating...' : '⚡ Quick Calculate'}
            </button>
            <button onClick={() => calcular('ia')} disabled={calculando}
              style={{ padding: '12px', background: calculando && modo === 'ia' ? 'rgba(0,255,136,0.1)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '9px', color: '#030712', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              {calculando && modo === 'ia' ? 'AI Analyzing...' : '🤖 Calculate with AI'}
            </button>
          </div>
          <p style={{ fontSize: '10px', color: '#475569', margin: '10px 0 0', textAlign: 'center' }}>
            ⚡ Quick = instant formula &nbsp;|&nbsp; 🤖 AI = precise GPT-4o analysis (uses tokens)
          </p>
        </div>

        {/* Results */}
        <div>
          {!resultado ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '60px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Fill in the account details and click Calculate to see the estimated score impact.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Score impact card */}
              <div style={{ background: 'rgba(0,255,136,0.04)', border: `1px solid ${impactoColor}44`, borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,${impactoColor},transparent)` }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '11px', color: impactoColor, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Score Impact</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: impactoColor + '20', color: impactoColor, border: `1px solid ${impactoColor}44` }}>
                    {modo === 'ia' ? '🤖 AI Analysis' : '⚡ Quick Formula'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#94a3b8' }}>{resultado.score_actual}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>CURRENT</div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: impactoColor }}>+{resultado.impacto_puntos}</div>
                  </div>
                  <div style={{ textAlign: 'center', background: `${impactoColor}15`, borderRadius: '10px', padding: '14px', border: `1px solid ${impactoColor}33` }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: impactoColor }}>{resultado.score_estimado}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>ESTIMATED</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                    ⏱ {resultado.tiempo_estimado}
                  </span>
                </div>
              </div>

              {/* Explanation */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '18px' }}>
                <h3 style={{ fontSize: '11px', color: '#00ff88', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Analysis</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.7' }}>{resultado.explicacion}</p>
              </div>

              {/* Recommendation */}
              <div style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', padding: '18px' }}>
                <h3 style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Recommendation</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.7' }}>{resultado.recomendacion}</p>
              </div>

              {/* Warnings (AI only) */}
              {resultado.advertencias && (
                <div style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: '12px', padding: '18px' }}>
                  <h3 style={{ fontSize: '11px', color: '#fb923c', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>⚠ Important</h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.7' }}>{resultado.advertencias}</p>
                </div>
              )}

              {/* Account summary */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Account Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                  {[
                    ['Bank', resultado.banco],
                    ['Account #', resultado.numero_cuenta || '—'],
                    ['Type', resultado.tipo_cuenta],
                    ['Action', resultado.accion],
                    ['Balance', `$${parseFloat(resultado.balance).toLocaleString()}`],
                    ['Credit Limit', resultado.limite_credito > 0 ? `$${parseFloat(resultado.limite_credito).toLocaleString()}` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '5px' }}>
                      <span style={{ color: '#475569' }}>{k}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: '500' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => { setResultado(null); setBanco(''); setNumeroCuenta(''); setBalance(''); setLimiteCredito(''); setScoreActual('') }}
                style={{ padding: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#475569', fontSize: '12px', cursor: 'pointer' }}>
                + New Calculation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
