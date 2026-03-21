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

export default router
