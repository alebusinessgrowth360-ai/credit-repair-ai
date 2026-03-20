'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function AnalisisPage() {
  const { id } = useParams()
  const [analisis, setAnalisis] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !id) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/analisis/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => { setAnalisis(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif' }}>Cargando análisis...</div>

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <h1 style={{ fontSize:'24px', marginBottom:'24px' }}>Análisis del reporte</h1>
      {!analisis ? (
        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', padding:'48px', textAlign:'center' }}>
          <p style={{ color:'#64748b' }}>No hay análisis todavía para este reporte.</p>
        </div>
      ) : (
        <pre style={{ color:'#94a3b8', fontSize:'12px' }}>{JSON.stringify(analisis, null, 2)}</pre>
      )}
    </div>
  )
}
