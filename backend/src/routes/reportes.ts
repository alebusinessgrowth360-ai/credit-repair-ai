import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/upload', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, tipo_reporte, fecha_reporte, nombre_archivo, pdf_base64 } = req.body
  if (!pdf_base64) return res.status(400).json({ error: 'No se recibio el archivo PDF' })
  if (!cliente_id || !tipo_reporte) return res.status(400).json({ error: 'Faltan campos requeridos' })
  try {
    const cliente = await pool.query('SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    const version = await pool.query('SELECT COUNT(*) FROM reportes_credito WHERE cliente_id = $1', [cliente_id])
    const numVersion = parseInt(version.rows[0].count) + 1
    const result = await pool.query(
      'INSERT INTO reportes_credito (cliente_id, nombre_archivo, ruta_archivo, fecha_reporte, tipo_reporte, version, pdf_contenido) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, cliente_id, nombre_archivo, fecha_reporte, tipo_reporte, version, created_at',
      [cliente_id, nombre_archivo || 'reporte.pdf', 'db', fecha_reporte || new Date().toISOString().split('T')[0], tipo_reporte, numVersion, pdf_base64]
    )
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/cliente/:cliente_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id } = req.params
  try {
    const result = await pool.query(
  'SELECT r.id, r.cliente_id, r.nombre_archivo, r.fecha_reporte, r.tipo_reporte, r.version, r.created_at FROM reportes_credito r JOIN clientes c ON c.id = r.cliente_id WHERE r.cliente_id = $1 AND c.usuario_id = $2 ORDER BY r.created_at DESC',
  [cliente_id, usuarioId]
)
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/by-id/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    const result = await pool.query('SELECT id, cliente_id, nombre_archivo, tipo_reporte, version FROM reportes_credito WHERE id = $1', [reporte_id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
router.get('/pdf/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    const result = await pool.query(
      'SELECT id, nombre_archivo, pdf_contenido FROM reportes_credito WHERE id = $1',
      [reporte_id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
router.delete('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    await pool.query('DELETE FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    await pool.query('DELETE FROM reportes_credito WHERE id = $1', [reporte_id])
    res.json({ data: { deleted: true }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
  export default router
