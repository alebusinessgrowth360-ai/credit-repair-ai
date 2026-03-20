import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.post('/config', requireAuth, async (req: AuthRequest, res: Response) => {
  const { api_key, modelo, proveedor_ia } = req.body
  const usuarioId = req.usuario!.id
  if (!api_key) return res.status(400).json({ error: 'API Key requerida' })
  try {
    const existe = await pool.query('SELECT id FROM configuracion_ia WHERE usuario_id = $1', [usuarioId])
    let result
    if (existe.rows.length > 0) {
      result = await pool.query(
        'UPDATE configuracion_ia SET api_key_encriptada=$1, modelo=$2, proveedor_ia=$3, estado_conexion=$4, updated_at=NOW() WHERE usuario_id=$5 RETURNING *',
        [api_key, modelo || 'gpt-4o', proveedor_ia || 'openai', 'pendiente', usuarioId]
      )
    } else {
      result = await pool.query(
        'INSERT INTO configuracion_ia (usuario_id, api_key_encriptada, modelo, proveedor_ia, estado_conexion) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [usuarioId, api_key, modelo || 'gpt-4o', proveedor_ia || 'openai', 'pendiente']
      )
    }
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/test-connection', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const config = await pool.query('SELECT api_key_encriptada, modelo FROM configuracion_ia WHERE usuario_id = $1', [usuarioId])
    if (config.rows.length === 0) return res.status(400).json({ error: 'No hay API Key configurada' })
    const apiKey = config.rows[0].api_key_encriptada
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!response.ok) {
      await pool.query('UPDATE configuracion_ia SET estado_conexion=$1 WHERE usuario_id=$2', ['error', usuarioId])
      return res.status(400).json({ error: 'API Key inválida' })
    }
    await pool.query('UPDATE configuracion_ia SET estado_conexion=$1, ultimo_test_conexion=NOW() WHERE usuario_id=$2', ['activo', usuarioId])
    res.json({ data: { status: 'activo' }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/config', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const result = await pool.query(
      'SELECT id, proveedor_ia, modelo, estado_conexion, ultimo_test_conexion FROM configuracion_ia WHERE usuario_id = $1',
      [usuarioId]
    )
    res.json({ data: result.rows[0] || null, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
