'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function getToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/token=([^;]+)/)
  return match ? match[1] : localStorage.getItem('token')
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    fetch(process.env.NEXT_PUBLIC_API_URL + '/dashboard/resumen', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json()).then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0f1e', color:'#94a3b8', fontFamily:'sans-serif' }}>Cargando...</div>

  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#f1f5f9', fontFamily:'sans-serif', padding:'40px' }}>
      <h1 style={{ fontSize:'24px', marginBottom:'32px' }}>Dashboard</h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'14px', marginBottom:'32px' }}>
        {[
          { label:'Total clientes', value: data ? data.total_clientes : 0 },
          { label:'Casos activos', value: data ? data.clientes_activos : 0 },
          { label:'Reportes este mes', value: data ? data.reportes_este_mes : 0 },
          { label:'Cartas generadas', value: data ? data.cartas_generadas : 0 },
          { label:'Disputas pendientes', value: data ? data.disputas_pendientes : 0 },
        ].map(m => (
          <div key={m.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' }}>
            <div style={{ fontSize:'28px', fontWeight:'bold', color:'#6366f1' }}>{m.value}</div>
            <div style={{ fontSize:'12px', color:'#64748b', marginTop:'6px' }}>{m.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px' }}>
        {[
          { href:'/clientes', label:'Clientes' },
{ href:'/clientes', label:'Reportes' },
{ href:'/clientes', label:'Cartas' },
{ href:'/configuracion', label:'Config. IA' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'18px', color:'#f1f5f9', fontSize:'13px', fontWeight:'bold' }}>
              {a.label} arrow
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
