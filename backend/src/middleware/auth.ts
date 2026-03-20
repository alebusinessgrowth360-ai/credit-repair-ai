import { Request, Response, NextFunction } from 'express'
import pool from '../db/client'

export interface AuthRequest extends Request {
  usuario?: { id: string; email: string; rol: string }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
  try {
    const payload = JSON.parse(Buffer.from(auth.replace('Bearer ', ''), 'base64').toString())
    if (payload.exp < Date.now()) return res.status(401).json({ error: 'Token expirado' })
    const result = await pool.query('SELECT id, email, rol FROM usuarios WHERE id = $1', [payload.id])
    if (result.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' })
    req.usuario = result.rows[0]
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
}
