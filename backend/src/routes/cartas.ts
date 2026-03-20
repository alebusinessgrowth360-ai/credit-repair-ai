import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/generar', requireAuth, async (req: AuthRequest, res: Response) => {
  const { cliente_id, reporte_id, tipo_carta, destinatario, ley_aplicada } = req.body
  if (!cliente_id || !tipo_carta || !destinatario) return res.status(400).json({ error: 'Faltan campos requeridos' })
  try {
    if (reporte_id) {
      const analisis = await pool.query('SELECT id FROM analisis_reportes WHERE reporte_id = $1', [reporte_id])
      if (analisis.rows.length === 0) return res.status(400).json({ error: 'Analiza el reporte primero antes de generar cartas.' })
    }
    const result = await pool.query(
      'INSERT INTO cartas (cliente_id, reporte_id, tipo_carta, destinatario, contenido, ley_aplicada, estado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [cliente_id, reporte_id || null, tipo_carta, destinatario, 'Borrador pendiente.', ley_aplicada || 'FCRA', 'borrador']
    )
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { contenido, estado } = req.body
  try {
    const result = await pool.query('UPDATE cartas SET contenido=$1, estado=$2, updated_at=NOW() WHERE id=$3 RETURNING *', [contenido, estado || 'editada', id])
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { cliente_id } = req.query
  try {
    const query = cliente_id
      ? 'SELECT * FROM cartas WHERE cliente_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM cartas ORDER BY created_at DESC'
    const result = await pool.query(query, cliente_id ? [cliente_id] : [])
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
