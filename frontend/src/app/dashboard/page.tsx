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

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712', color:'#00ff88', fontFamily:'monospace' }}>
      Cargando...
    </div>
  )

  const stats = [
    { label:'Total clientes', value: data?.total_clientes || 0, color:'#00ff88' },
    { label:'Casos activos', value: data?.clientes_activos || 0, color:'#38bdf8' },
    { label:'Reportes este mes', value: data?.reportes_este_mes || 0, color:'#a78bfa' },
    { label:'Cartas generadas', value: data?.cartas_generadas || 0, color:'#00ff88' },
    { label:'Disputas pendientes', value: data?.disputas_pendientes || 0, color:'#fb923c' },
  ]

  const links = [
    { href:'/clientes', label:'Clientes', icon:'👥', desc:'Administra tus clientes' },
    { href:'/disputas', label:'Disputas', icon:'📋', desc:'Seguimiento de disputas' },
    { href:'/branding', label:'Branding', icon:'🎨', desc:'Personaliza tus documentos' },
    { href:'/configuracion', label:'Config. IA', icon:'⚙️', desc:'Configura tu API Key' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#030712', backgroundImage:'radial-gradient(ellipse at top, #0d1f0d 0%, #030712 70%)', color:'#e2e8f0', fontFamily:'sans-serif', padding:'40px' }}>
      
      {/* Header */}
      <div style={{ marginBottom:'40px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#00ff88', boxShadow:'0 0 8px #00ff88' }}></div>
          <span style={{ fontSize:'12px', color:'#00ff88', fontWeight:'bold', letterSpacing:'2px', textTransform:'uppercase' }}>Sistema activo</span>
        </div>
        <h1 style={{ fontSize:'28px', margin:0, color:'#f1f5f9', fontWeight:'bold' }}>Dashboard</h1>
        <p style={{ color:'#475569', fontSize:'14px', margin:'6px 0 0' }}>Resumen general de tu plataforma</p>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'14px', marginBottom:'40px' }}>
        {stats.map(m => (
          <div key={m.label} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${m.color}22`, borderRadius:'14px', padding:'20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg, ${m.color}, transparent)` }}></div>
            <div style={{ fontSize:'32px', fontWeight:'bold', color: m.color, marginBottom:'6px' }}>{m.value}</div>
            <div style={{ fontSize:'12px', color:'#64748b' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Links */}
      <h2 style={{ fontSize:'13px', fontWeight:'bold', color:'#00ff88', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'16px' }}>Acceso rápido</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px' }}>
        {links.map(a => (
          <Link key={a.label} href={a.href} style={{ textDecoration:'none' }}>
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(0,255,136,0.1)', borderRadius:'14px', padding:'20px', cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'; e.currentTarget.style.background = 'rgba(0,255,136,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize:'24px', marginBottom:'10px' }}>{a.icon}</div>
              <div style={{ fontSize:'14px', fontWeight:'bold', color:'#f1f5f9', marginBottom:'4px' }}>{a.label}</div>
              <div style={{ fontSize:'11px', color:'#475569' }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
