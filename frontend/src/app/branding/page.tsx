'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function BrandingPage() {
  const [logoUrl, setLogoUrl] = useState('')
  const [colorPrimario, setColorPrimario] = useState('#1a1a2e')
  const [colorSecundario, setColorSecundario] = useState('#16213e')
  const [colorAcento, setColorAcento] = useState('#0f3460')
  const [tipografia, setTipografia] = useState('Inter')
  const [encabezado, setEncabezado] = useState('')
  const [piePagina, setPiePagina] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    fetch(API + '/branding', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setLogoUrl(d.data.logo_url || '')
          setColorPrimario(d.data.color_primario || '#1a1a2e')
          setColorSecundario(d.data.color_secundario || '#16213e')
          setColorAcento(d.data.color_acento || '#0f3460')
          setTipografia(d.data.tipografia || 'Inter')
          setEncabezado(d.data.encabezado_pdf || '')
          setPiePagina(d.data.pie_pagina_pdf || '')
        }
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true); setError(''); setMensaje('')
    const token = getToken()
    try {
      const res = await fetch(API + '/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          logo_url: logoUrl || null,
          color_primario: colorPrimario,
          color_secundario: colorSecundario,
          color_acento: colorAcento,
          tipografia,
          encabezado_pdf: encabezado || null,
          pie_pagina_pdf: piePagina || null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMensaje('Branding guardado correctamente.')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: '8px', color: '#f1f5f9',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const
  }

  const labelStyle = {
    display: 'block', fontSize: '11px', color: '#00ff88',
    marginBottom: '6px', fontWeight: 'bold',
    letterSpacing: '1px', textTransform: 'uppercase' as const
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', color: '#00ff88', fontFamily: 'monospace' }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#030712', backgroundImage: 'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color: '#e2e8f0', fontFamily: 'sans-serif', padding: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontSize: '14px' }}>← Dashboard</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#00ff88,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>💳</div>
          <span style={{ fontSize: '13px', color: '#475569' }}>Credit Repair AI</span>
        </div>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', margin: '0 0 4px', color: '#f1f5f9', fontWeight: 'bold' }}>Branding</h1>
        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Personaliza la apariencia de tus reportes y cartas exportadas</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '900px' }}>

        {/* Form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,#00ff88,#0ea5e9,transparent)' }}></div>

          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>URL del Logo</label>
              <input type="url" placeholder="https://tu-empresa.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Color primario</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="color" value={colorPrimario} onChange={e => setColorPrimario(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <input type="text" value={colorPrimario} onChange={e => setColorPrimario(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Color secundario</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="color" value={colorSecundario} onChange={e => setColorSecundario(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <input type="text" value={colorSecundario} onChange={e => setColorSecundario(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Color acento</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="color" value={colorAcento} onChange={e => setColorAcento(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                  <input type="text" value={colorAcento} onChange={e => setColorAcento(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tipografía</label>
              <select value={tipografia} onChange={e => setTipografia(e.target.value)}
                style={{ ...inputStyle, background: '#0d1117' }}>
                <option value="Inter">Inter</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Helvetica">Helvetica</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Encabezado de documentos PDF</label>
              <input type="text" placeholder="Ej: Mi Empresa - Credit Repair Professionals" value={encabezado} onChange={e => setEncabezado(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Pie de página PDF</label>
              <input type="text" placeholder="Ej: © 2025 Mi Empresa · (555) 123-4567 · miempresa.com" value={piePagina} onChange={e => setPiePagina(e.target.value)} style={inputStyle} />
            </div>

            {mensaje && <p style={{ color: '#00ff88', fontSize: '13px', margin: 0 }}>{mensaje}</p>}
            {error && <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={guardando}
              style={{ padding: '11px', background: guardando ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#030712', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
              {guardando ? 'Guardando...' : 'Guardar branding'}
            </button>
          </form>
        </div>

        {/* Preview */}
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#00ff88', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Vista previa</h2>
          <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <div style={{ background: colorPrimario, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '32px', objectFit: 'contain' }} onError={e => { (e.target as any).style.display = 'none' }} />}
              <span style={{ color: 'white', fontFamily: tipografia, fontWeight: 'bold', fontSize: '14px' }}>{encabezado || 'Credit Repair Services'}</span>
            </div>
            <div style={{ padding: '16px 20px', fontFamily: tipografia }}>
              <div style={{ height: '8px', background: colorAcento, borderRadius: '4px', marginBottom: '8px', width: '60%' }}></div>
              <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '4px', marginBottom: '6px' }}></div>
              <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '4px', width: '80%', marginBottom: '6px' }}></div>
              <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '4px', width: '70%' }}></div>
            </div>
            <div style={{ background: colorSecundario, padding: '10px 20px' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: tipografia }}>{piePagina || 'Generated by Credit Repair AI Suite'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
