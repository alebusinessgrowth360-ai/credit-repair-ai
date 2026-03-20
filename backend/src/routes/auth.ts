import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import pool from '../db/client'

const router = Router()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + (process.env.SECRET_KEY || 'secret')).digest('hex')
}

function generateToken(userId: string): string {
  return Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64')
}

router.post('/register', async (req: Request, res: Response) => {
  const { nombre, email, password } = req.body
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan campos' })
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
    if (existe.rows.length > 0) return res.status(400).json({ error: 'El email ya está registrado' })
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email, hashPassword(password)]
    )
    const user = result.rows[0]
    res.status(201).json({ data: { token: generateToken(user.id), usuario: user }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' })
  try {
    const result = await pool.query(
      'SELECT id, nombre, email FROM usuarios WHERE email = $1 AND password_hash = $2',
      [email, hashPassword(password)]
    )
    if (result.rows.length === 0) return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    const user = result.rows[0]
    res.json({ data: { token: generateToken(user.id), usuario: user }, error: null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/me', async (req: Request, res: Response) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Sin token' })
  try {
    const payload = JSON.parse(Buffer.from(auth.replace('Bearer ', ''), 'base64').toString())
    if (payload.exp < Date.now()) return res.status(401).json({ error: 'Token expirado' })
    const result = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE id = $1', [payload.id])
    res.json({ data: result.rows[0], error: null })
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
})

export default router
