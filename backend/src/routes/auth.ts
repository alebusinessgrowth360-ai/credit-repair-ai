import { Router, Request, Response } from 'express'
const router = Router()
router.get('/me', (_req: Request, res: Response) => { res.json({ message: 'auth ok' }) })
export default router
