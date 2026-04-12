'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function VerPDFPage() {
  const { id } = useParams()
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    const token = getToken()
    if (!token || !id) { router.push('/auth/login'); return }
    fetch(API + '/reportes/pdf/' + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => {
        if (d.data?.pdf_contenido) {
          const binary = atob(d.data.pdf_contenido)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'application/pdf' })
          setPdfUrl(URL.createObjectURL(blob))
        } else {
          setError('No se encontró el PDF')
        }
        setLoading(false)
      }).catch(() => { setError('Error al cargar el PDF'); setLoading(false) })
  }, [id])

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif' }}>Cargando PDF...</div>
  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#fca5a5', fontFamily:'sans-serif' }}>{error}</div>

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 24px', display:'flex', alignItems:'center', gap:'16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontSize:'14px' }}>← Volver</button>
        <span style={{ color:'#f1f5f9', fontSize:'14px' }}>Reporte de crédito</span>
      </div>
      <iframe src={pdfUrl} style={{ flex:1, border:'none', width:'100%', minHeight:'calc(100vh - 60px)' }} />
    </div>
  )
}
