// v2
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
import rapidRescoreRoutes from './routes/rapidRescore'
import scraperRoutes from './routes/scraper'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Allowed origins — set FRONTEND_URL in .env (comma-separated for multiple)
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow PDF/file resources across origins
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks) in non-production
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth',      authRoutes)
app.use('/api/ia',        iaRoutes)
app.use('/api/clientes',  clientesRoutes)
app.use('/api/reportes',  reportesRoutes)
app.use('/api/analizar',  analisisRoutes)
app.use('/api/cartas',    cartasRoutes)
app.use('/api/exportar',  exportarRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/branding',  brandingRoutes)
app.use('/api/disputas',      disputasRoutes)
app.use('/api/rapid-rescore', rapidRescoreRoutes)
app.use('/api/scraper',      scraperRoutes)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => console.log(`✓ Servidor en http://localhost:${PORT}`))

export default app
