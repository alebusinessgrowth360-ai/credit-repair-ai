import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const result = await pool.query(
      'SELECT * FROM clientes WHERE usuario_id = $1 ORDER BY created_at DESC',
      [usuarioId]
    )
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { nombre_completo, email, telefono, direccion, ciudad, estado, zip, notas } = req.body
  if (!nombre_completo) return res.status(400).json({ error: 'Nombre requerido' })
  try {
    const result = await pool.query(
      'INSERT INTO clientes (usuario_id, nombre_completo, email, telefono, direccion, ciudad, estado, zip, notas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [usuarioId, nombre_completo, email, telefono, direccion, ciudad, estado, zip, notas]
    )
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id } = req.params
  try {
    const result = await pool.query(
      'SELECT * FROM clientes WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id } = req.params
  const { nombre_completo, email, telefono, direccion, ciudad, estado, zip, notas, estado_caso } = req.body
  try {
    const result = await pool.query(
      'UPDATE clientes SET nombre_completo=$1, email=$2, telefono=$3, direccion=$4, ciudad=$5, estado=$6, zip=$7, notas=$8, estado_caso=$9, updated_at=NOW() WHERE id=$10 AND usuario_id=$11 RETURNING *',
      [nombre_completo, email, telefono, direccion, ciudad, estado, zip, notas, estado_caso, id, usuarioId]
    )
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
