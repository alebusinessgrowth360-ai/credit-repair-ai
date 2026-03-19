import { Router, Request, Response } from 'express'
const router = Router()
router.post('/config', (_req: Request, res: Response) => { res.json({ data: null, error: null }) })
router.post('/test-connection', (_req: Request, res: Response) => { res.json({ data: { status: 'ok' }, error: null }) })
export default router
