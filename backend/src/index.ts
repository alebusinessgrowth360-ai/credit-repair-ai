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

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (_req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(cors({ origin: '*' }))
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
app.use('/api/disputas',  disputasRoutes)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => console.log(`✓ Servidor en http://localhost:${PORT}`))

export default app
