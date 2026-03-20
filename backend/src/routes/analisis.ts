import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({ data: null, error: 'Análisis con IA próximamente disponible' })
})

router.get('/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    const result = await pool.query('SELECT * FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Análisis no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
