import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/disputas — listar todas, opcional filtro por cliente_id
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id } = req.query
  try {
    const query = cliente_id
      ? `SELECT d.* FROM disputas d
         JOIN clientes c ON c.id = d.cliente_id
         WHERE c.usuario_id = $1 AND d.cliente_id = $2
         ORDER BY d.created_at DESC`
      : `SELECT d.* FROM disputas d
         JOIN clientes c ON c.id = d.cliente_id
         WHERE c.usuario_id = $1
         ORDER BY d.created_at DESC`
    const params = cliente_id ? [usuarioId, cliente_id] : [usuarioId]
    const result = await pool.query(query, params)
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/disputas/:id — obtener una disputa
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id } = req.params
  try {
    const result = await pool.query(
      `SELECT d.* FROM disputas d
       JOIN clientes c ON c.id = d.cliente_id
       WHERE d.id = $1 AND c.usuario_id = $2`,
      [id, usuarioId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Disputa no encontrada' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/disputas — crear nueva disputa
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, reporte_id, carta_id, tipo_disputa, buro_o_entidad, fecha_envio, notas } = req.body
  if (!cliente_id || !tipo_disputa || !buro_o_entidad) {
    return res.status(400).json({ error: 'Se requieren cliente_id, tipo_disputa y buro_o_entidad' })
  }
  try {
    const cliente = await pool.query(
      'SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2',
      [cliente_id, usuarioId]
    )
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })

    const result = await pool.query(
      `INSERT INTO disputas (cliente_id, reporte_id, carta_id, tipo_disputa, buro_o_entidad, fecha_envio, notas, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente') RETURNING *`,
      [cliente_id, reporte_id || null, carta_id || null, tipo_disputa, buro_o_entidad, fecha_envio || null, notas || null]
    )

    // Marcar carta como enviada si se vincula
    if (carta_id) {
      await pool.query('UPDATE cartas SET estado=$1, updated_at=NOW() WHERE id=$2', ['enviada', carta_id])
    }

    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/disputas/:id — actualizar estado y resultado
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { id } = req.params
  const { estado, resultado, fecha_respuesta, notas } = req.body
  try {
    const disputa = await pool.query(
      `SELECT d.id FROM disputas d
       JOIN clientes c ON c.id = d.cliente_id
       WHERE d.id = $1 AND c.usuario_id = $2`,
      [id, usuarioId]
    )
    if (disputa.rows.length === 0) return res.status(404).json({ error: 'Disputa no encontrada' })

    const result = await pool.query(
      `UPDATE disputas SET estado=$1, resultado=$2, fecha_respuesta=$3, notas=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [estado || 'pendiente', resultado || null, fecha_respuesta || null, notas || null, id]
    )
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
