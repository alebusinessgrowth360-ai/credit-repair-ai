import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /api/branding — obtener configuracion de branding del usuario
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const result = await pool.query('SELECT * FROM branding WHERE usuario_id = $1', [usuarioId])
    res.json({ data: result.rows[0] || null, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/branding — crear o actualizar branding
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { logo_url, color_primario, color_secundario, color_acento, tipografia, encabezado_pdf, pie_pagina_pdf } = req.body
  try {
    const existe = await pool.query('SELECT id FROM branding WHERE usuario_id = $1', [usuarioId])
    let result
    if (existe.rows.length > 0) {
      result = await pool.query(
        `UPDATE branding SET logo_url=$1, color_primario=$2, color_secundario=$3, color_acento=$4,
         tipografia=$5, encabezado_pdf=$6, pie_pagina_pdf=$7, updated_at=NOW()
         WHERE usuario_id=$8 RETURNING *`,
        [
          logo_url || null,
          color_primario || '#1a1a2e',
          color_secundario || '#16213e',
          color_acento || '#0f3460',
          tipografia || 'Inter',
          encabezado_pdf || null,
          pie_pagina_pdf || null,
          usuarioId
        ]
      )
    } else {
      result = await pool.query(
        `INSERT INTO branding (usuario_id, logo_url, color_primario, color_secundario, color_acento, tipografia, encabezado_pdf, pie_pagina_pdf)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          usuarioId,
          logo_url || null,
          color_primario || '#1a1a2e',
          color_secundario || '#16213e',
          color_acento || '#0f3460',
          tipografia || 'Inter',
          encabezado_pdf || null,
          pie_pagina_pdf || null
        ]
      )
    }
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
