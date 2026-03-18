import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import clientesRoutes from './routes/clientes'
import reportesRoutes from './routes/reportes'
import analisisRoutes from './routes/analisis'
import cartasRoutes from './routes/cartas'
import exportarRoutes from './routes/exportar'
import iaRoutes from './routes/ia'
import dashboardRoutes from './routes/dashboard'
import brandingRoutes from './routes/branding'
import disputasRoutes from './routes/disputas'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rutas — orden importante: auth primero, luego protegidas
app.use('/api/auth',       authRoutes)
app.use('/api/ia',         iaRoutes)
app.use('/api/clientes',   clientesRoutes)
app.use('/api/reportes',   reportesRoutes)
app.use('/api/analizar',   analisisRoutes)
app.use('/api/cartas',     cartasRoutes)
app.use('/api/exportar',   exportarRoutes)
app.use('/api/dashboard',  dashboardRoutes)
app.use('/api/branding',   brandingRoutes)
app.use('/api/disputas',   disputasRoutes)

// Error handler global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`)
})

export default app
