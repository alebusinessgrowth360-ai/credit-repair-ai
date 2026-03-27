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
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/auth/login'); return }
    const API = process.env.NEXT_PUBLIC_API_URL
    Promise.all([
      fetch(API + '/dashboard/resumen', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(API + '/dashboard/clientes_progreso', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json())
    ]).then(([resumen, prog]) => {
      setData(resumen.data)
      setClientes(prog.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'40px' }}>
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

      {/* Per-client progress */}
      {clientes.length > 0 && (
        <>
          <h2 style={{ fontSize:'13px', fontWeight:'bold', color:'#00ff88', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'16px' }}>Progreso de clientes</h2>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
            {clientes.map((c: any, i: number) => {
              const estadoColor: Record<string,string> = { riesgo_bajo:'#00ff88', riesgo_medio:'#f59e0b', riesgo_alto:'#ef4444', critico:'#dc2626' }
              const casoColor: Record<string,string> = { activo:'#00ff88', en_progreso:'#f59e0b', pendiente:'#94a3b8', cerrado:'#475569' }
              const creditoEstado = c.estado_credito || '—'
              const color = estadoColor[creditoEstado] || '#475569'
              const fechaStr = c.ultimo_reporte ? new Date(c.ultimo_reporte).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : 'Sin reportes'
              return (
                <div key={c.id}
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom: i < clientes.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor:'pointer' }}
                  onClick={() => router.push('/clientes/' + c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1 }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:`linear-gradient(135deg,${color}22,${color}11)`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'bold', color }}>
                      {c.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'bold', color:'#f1f5f9' }}>{c.nombre_completo}</div>
                      <div style={{ fontSize:'11px', color:'#475569' }}>Último reporte: {fechaStr}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'16px', fontWeight:'bold', color: (c.errores_count || 0) > 0 ? '#ef4444' : '#00ff88' }}>{c.errores_count || 0}</div>
                      <div style={{ fontSize:'10px', color:'#475569' }}>Errores</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'16px', fontWeight:'bold', color: (c.disputas_pendientes || 0) > 0 ? '#f59e0b' : '#475569' }}>{c.disputas_pendientes || 0}</div>
                      <div style={{ fontSize:'10px', color:'#475569' }}>Disputas</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'16px', fontWeight:'bold', color:'#a78bfa' }}>{c.cartas_count || 0}</div>
                      <div style={{ fontSize:'10px', color:'#475569' }}>Cartas</div>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:'bold', padding:'3px 10px', borderRadius:'20px', background: (casoColor[c.estado_caso] || '#94a3b8') + '20', color: casoColor[c.estado_caso] || '#94a3b8', border:`1px solid ${casoColor[c.estado_caso] || '#94a3b8'}44` }}>
                      {c.estado_caso}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
