import { Router, Request, Response } from 'express'
const router = Router()
router.post('/evaluacion/:id', (_req: Request, res: Response) => { res.json({ data: { url: '' }, error: null }) })
router.post('/comparacion/:id', (_req: Request, res: Response) => { res.json({ data: { url: '' }, error: null }) })
router.post('/carta/:id', (_req: Request, res: Response) => { res.json({ data: { url: '' }, error: null }) })
export default router
