'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',     icon: '◈' },
  { href: '/clientes',        label: 'Clientes',       icon: '👥' },
  { href: '/reportes',        label: 'Reportes',       icon: '📄' },
  { href: '/cartas',          label: 'Cartas',         icon: '✉️' },
  { href: '/comparacion',     label: 'Comparación',    icon: '📊' },
  { href: '/exportaciones',   label: 'Exportaciones',  icon: '⬇️' },
  { href: '/configuracion',   label: 'Config. IA',     icon: '🔑' },
  { href: '/branding',        label: 'Branding',       icon: '🎨' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClientComponentClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#0a0f1e',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
        position: 'sticky', top: 0, height: '100vh'
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', flexShrink: 0
            }}>✦</div>
            <span style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '15px', color: '#f1f5f9', lineHeight: '1.2'
            }}>Credit Repair<br/>AI Suite</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: active ? 500 : 400,
                  color: active ? '#f1f5f9' : '#64748b',
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  transition: 'all .15s'
                }}
                  onMouseEnter={e => !active && (e.currentTarget.style.color = '#94a3b8')}
                  onMouseLeave={e => !active && (e.currentTarget.style.color = '#64748b')}
                >
                  <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                  {active && <div style={{
                    marginLeft: 'auto', width: '4px', height: '4px',
                    borderRadius: '50%', background: '#6366f1'
                  }} />}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '13px', color: '#64748b',
              cursor: 'pointer', borderRadius: '10px',
              transition: 'color .15s',
              fontFamily: "'DM Sans', sans-serif"
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <span>🚪</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
