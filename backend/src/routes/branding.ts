import { Router, Request, Response } from 'express'
const router = Router()
router.post('/', (_req: Request, res: Response) => { res.json({ data: null, error: null }) })
router.get('/', (_req: Request, res: Response) => { res.json({ data: null, error: null }) })
export default router
