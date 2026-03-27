import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

router.get('/resumen', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const [totalClientes, clientesActivos, reportesMes, cartasTotal, disputasPend] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM clientes WHERE usuario_id = $1', [usuarioId]),
      pool.query('SELECT COUNT(*) FROM clientes WHERE usuario_id = $1 AND estado_caso = $2', [usuarioId, 'activo']),
      pool.query('SELECT COUNT(*) FROM reportes_credito r JOIN clientes c ON c.id = r.cliente_id WHERE c.usuario_id = $1 AND r.created_at >= date_trunc($2, NOW())', [usuarioId, 'month']),
      pool.query('SELECT COUNT(*) FROM cartas ca JOIN clientes c ON c.id = ca.cliente_id WHERE c.usuario_id = $1', [usuarioId]),
      pool.query('SELECT COUNT(*) FROM disputas d JOIN clientes c ON c.id = d.cliente_id WHERE c.usuario_id = $1 AND d.estado = $2', [usuarioId, 'pendiente'])
    ])
    res.json({
      data: {
        total_clientes: parseInt(totalClientes.rows[0].count),
        clientes_activos: parseInt(clientesActivos.rows[0].count),
        reportes_este_mes: parseInt(reportesMes.rows[0].count),
        cartas_generadas: parseInt(cartasTotal.rows[0].count),
        disputas_pendientes: parseInt(disputasPend.rows[0].count)
      },
      error: null
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/clientes_progreso', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.nombre_completo,
        c.estado_caso,
        (SELECT MAX(r.created_at) FROM reportes_credito r WHERE r.cliente_id = c.id) AS ultimo_reporte,
        (SELECT COUNT(*) FROM reportes_credito r WHERE r.cliente_id = c.id) AS total_reportes,
        (SELECT a.estado_general FROM analisis_reportes a JOIN reportes_credito r ON r.id = a.reporte_id WHERE r.cliente_id = c.id ORDER BY r.created_at DESC LIMIT 1) AS estado_credito,
        (SELECT jsonb_array_length(a.errores_detectados) FROM analisis_reportes a JOIN reportes_credito r ON r.id = a.reporte_id WHERE r.cliente_id = c.id ORDER BY r.created_at DESC LIMIT 1) AS errores_count,
        (SELECT COUNT(*) FROM disputas d WHERE d.cliente_id = c.id AND d.estado = 'pendiente') AS disputas_pendientes,
        (SELECT COUNT(*) FROM disputas d WHERE d.cliente_id = c.id AND d.estado = 'enviada') AS disputas_enviadas,
        (SELECT COUNT(*) FROM cartas ca WHERE ca.cliente_id = c.id) AS cartas_count
      FROM clientes c
      WHERE c.usuario_id = $1
      ORDER BY ultimo_reporte DESC NULLS LAST, c.created_at DESC
      LIMIT 10
    `, [usuarioId])
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
