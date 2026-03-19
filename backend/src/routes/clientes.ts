import { Router, Request, Response } from 'express'
const router = Router()
router.get('/', (_req: Request, res: Response) => { res.json({ data: [], error: null }) })
router.post('/', (_req: Request, res: Response) => { res.json({ data: null, error: null }) })
router.get('/:id', (req: Request, res: Response) => { res.json({ data: { id: req.params.id }, error: null }) })
export default router
