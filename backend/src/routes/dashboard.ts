import { Router, Request, Response } from 'express'
const router = Router()
router.get('/resumen', (_req: Request, res: Response) => { res.json({ data: { total_clientes: 0, clientes_activos: 0, reportes_este_mes: 0, cartas_generadas: 0, disputas_pendientes: 0 }, error: null }) })
export default router
