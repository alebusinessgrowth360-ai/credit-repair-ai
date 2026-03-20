import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Credit Repair AI Suite',
  description: 'Plataforma profesional de reparación de crédito con IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: '#0a0f1e' }}>
        {children}
      </body>
    </html>
  )
}
