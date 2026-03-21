import { Router, Response } from 'express'
import pool from '../db/client'
import { requireAuth, AuthRequest } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()
const storage = multer.diskStorage({ destination: '/tmp/uploads/', filename: (_req: any, file: any, cb: any) => { cb(null, Date.now() + '-' + file.originalname) } })
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/upload', requireAuth, upload.single('pdf'), async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id, tipo_reporte, fecha_reporte } = req.body
  if (!req.file) return res.status(400).json({ error: 'No se subio ningun archivo' })
  if (!cliente_id || !tipo_reporte) return res.status(400).json({ error: 'Faltan campos requeridos' })
  try {
    const cliente = await pool.query('SELECT id FROM clientes WHERE id = $1 AND usuario_id = $2', [cliente_id, usuarioId])
    if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    const version = await pool.query('SELECT COUNT(*) FROM reportes_credito WHERE cliente_id = $1', [cliente_id])
    const numVersion = parseInt(version.rows[0].count) + 1
    const result = await pool.query(
      'INSERT INTO reportes_credito (cliente_id, nombre_archivo, ruta_archivo, fecha_reporte, tipo_reporte, version) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [cliente_id, req.file.originalname, req.file.path, fecha_reporte || new Date().toISOString().split("T")[0], tipo_reporte, numVersion]
    )
    res.status(201).json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/cliente/:cliente_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const usuarioId = req.usuario!.id
  const { cliente_id } = req.params
  try {
    const result = await pool.query(
      'SELECT r.* FROM reportes_credito r JOIN clientes c ON c.id = r.cliente_id WHERE r.cliente_id = $1 AND c.usuario_id = $2 ORDER BY r.created_at DESC',
      [cliente_id, usuarioId]
    )
    res.json({ data: result.rows, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})


router.get('/by-id/:reporte_id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { reporte_id } = req.params
  try {
    const result = await pool.query('SELECT * FROM reportes_credito WHERE id = $1', [reporte_id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' })
    res.json({ data: result.rows[0], error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
